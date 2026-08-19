import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ChunkStrategy, SourceMetadata } from "./chunking";

export type IndexedChunk = {
  id: string;
  label: number;
  content: string;
  strategy: ChunkStrategy;
  metadata: SourceMetadata;
};

type IndexManifest = {
  version: 1;
  model: string;
  dimensions: number;
  metric: "cosine";
  builtAt: number;
  corpus: { dataset: string; split: string; sourceFile: string; sourceRows: number };
  chunks: IndexedChunk[];
};

type HnswLike = {
  readIndexSync(file: string): void;
  searchKnn(vector: number[], limit: number): { distances: number[]; neighbors: number[] };
  getPoint(label: number): number[];
  setEf(value: number): void;
};

type ActiveIndex = { index: HnswLike; manifest: IndexManifest; dir: string };
let active: ActiveIndex | null = null;
let lastLoadError: string | null = null;

const indexDirectory = () => process.env.VAANI_INDEX_DIR || path.resolve(process.cwd(), "server", "rag-index");

export class RetrievalSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalSetupError";
  }
}

async function loadIndex() {
  const dir = indexDirectory();
  if (active?.dir === dir) return active;

  const manifestPath = path.join(dir, "manifest.json");
  const graphPath = path.join(dir, "vectors.hnsw");
  if (!existsSync(manifestPath) || !existsSync(graphPath)) {
    lastLoadError = "No persisted MSMARCO-XI vector index is available yet.";
    return null;
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as IndexManifest;
    if (manifest.version !== 1 || manifest.metric !== "cosine" || !manifest.chunks.length || !manifest.dimensions) {
      throw new Error("The index manifest is incomplete or incompatible.");
    }
    const module = await import("hnswlib-node");
    const hnsw = module.default ?? module;
    const HnswConstructor = hnsw.HierarchicalNSW;
    if (!HnswConstructor) throw new Error("The HNSW native constructor is unavailable in the installed binding.");
    const index = new HnswConstructor("cosine", manifest.dimensions) as HnswLike;
    index.readIndexSync(graphPath);
    index.setEf(96);
    active = { index, manifest, dir };
    lastLoadError = null;
    return active;
  } catch (error) {
    lastLoadError = error instanceof Error ? error.message : "The HNSW index could not be loaded.";
    return null;
  }
}

export type RetrievedChunk = IndexedChunk & { similarity: number };

export async function retrieve(vector: number[], limit = 6): Promise<RetrievedChunk[]> {
  const loaded = await loadIndex();
  if (!loaded) {
    throw new RetrievalSetupError(`${lastLoadError ?? "The vector index is unavailable."} Build it with the corpus preparation command before querying.`);
  }
  if (vector.length !== loaded.manifest.dimensions) {
    throw new RetrievalSetupError(`Embedding dimensions (${vector.length}) do not match the persisted index (${loaded.manifest.dimensions}).`);
  }
  const result = loaded.index.searchKnn(vector, Math.min(limit, loaded.manifest.chunks.length));
  const byLabel = new Map(loaded.manifest.chunks.map(chunk => [chunk.label, chunk]));
  return result.neighbors
    .map((label, position) => {
      const chunk = byLabel.get(label);
      if (!chunk) return null;
      const distance = result.distances[position] ?? 1;
      return { ...chunk, similarity: Math.max(0, Math.min(1, 1 - distance)) };
    })
    .filter((chunk): chunk is RetrievedChunk => Boolean(chunk))
    .sort((a, b) => b.similarity - a.similarity);
}

export async function retrieveByAnswerVector(vector: number[], limit = 6) {
  return retrieve(vector, limit);
}

export async function getIndexStatus() {
  const loaded = await loadIndex();
  if (!loaded) {
    return { ready: false, message: lastLoadError ?? "The vector index has not been built." };
  }
  return {
    ready: true,
    message: "Persisted HNSW index loaded.",
    model: loaded.manifest.model,
    chunkCount: loaded.manifest.chunks.length,
    builtAt: loaded.manifest.builtAt,
    corpus: loaded.manifest.corpus,
  };
}

export async function getBenchmarkQueries(limit = 20) {
  const loaded = await loadIndex();
  if (!loaded) return [];
  return Array.from(new Set(loaded.manifest.chunks.map(chunk => chunk.metadata.sourceQuery?.trim()).filter((query): query is string => Boolean(query))))
    .filter(query => query.length > 8)
    .slice(0, limit);
}
