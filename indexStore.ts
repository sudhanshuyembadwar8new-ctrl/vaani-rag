import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  corpus: { dataset: string; split: string; sourceFile: string; sourceRows: number; languages?: string[] };
  chunks: IndexedChunk[];
};

type HnswLike = {
  readIndexSync(file: string): void;
  searchKnn(vector: number[], limit: number): { distances: number[]; neighbors: number[] };
  getPoint(label: number): number[];
  setEf(value: number): void;
  initIndex(options: any): void;
  addPoint(vector: number[], label: number): void;
  writeIndexSync(file: string): void;
};

type ActiveIndex = { index: HnswLike; manifest: IndexManifest; dir: string };
let active: ActiveIndex | null = null;
let lastLoadError: string | null = null;
let buildingPromise: Promise<ActiveIndex | null> | null = null;

const indexDirectory = () => process.env.VAANI_INDEX_DIR || path.resolve(process.cwd(), "server", "rag-index");

export class RetrievalSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalSetupError";
  }
}

export async function ensureIndexReady(): Promise<ActiveIndex | null> {
  if (active) return active;
  const dir = indexDirectory();
  const manifestPath = path.join(dir, "manifest.json");
  const graphPath = path.join(dir, "vectors.hnsw");

  if (existsSync(manifestPath) && existsSync(graphPath)) {
    return loadIndex();
  }

  if (buildingPromise) return buildingPromise;

  buildingPromise = (async () => {
    try {
      const rootManifestPath = path.resolve(process.cwd(), "manifest.json");
      if (!existsSync(rootManifestPath)) {
        lastLoadError = "No persisted MSMARCO-XI vector index or root manifest.json available.";
        return null;
      }

      const key = process.env.GEMINI_API_KEY?.trim();
      if (!key) {
        lastLoadError = "GEMINI_API_KEY is required to build the vector index.";
        return null;
      }

      console.log("[IndexStore] Building MSMARCO-XI HNSW index from bundled manifest.json using Gemini Embedding...");
      const manifest = JSON.parse(readFileSync(rootManifestPath, "utf8")) as IndexManifest;
      const chunks = manifest.chunks;
      if (!chunks?.length) throw new Error("No chunks found in manifest.json");

      const module = await import("hnswlib-node");
      const hnsw = module.default ?? module;
      const HnswConstructor = hnsw.HierarchicalNSW;
      if (!HnswConstructor) throw new Error("The HNSW native constructor is unavailable in the installed binding.");

      const vectors: number[][] = [];
      const batchSize = 50;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        let batchVectors: number[][] | undefined;
        let lastErr: unknown;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": key },
              body: JSON.stringify({
                requests: batch.map(c => ({
                  model: "models/gemini-embedding-001",
                  content: { parts: [{ text: c.content }] },
                })),
              }),
              signal: AbortSignal.timeout(30_000),
            });
            const body = (await response.json().catch(() => ({}))) as {
              embeddings?: Array<{ values?: number[] }>;
              error?: { message?: string };
            };
            const extracted = body.embeddings?.map(item => item.values);
            if (!response.ok || !Array.isArray(extracted) || extracted.length !== batch.length || extracted.some(v => !Array.isArray(v) || !v.length)) {
              throw new Error(body.error?.message || `Gemini embedding failed with HTTP ${response.status}`);
            }
            batchVectors = extracted as number[][];
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          }
        }

        if (!batchVectors) throw lastErr instanceof Error ? lastErr : new Error("Failed to embed batch with Gemini.");
        vectors.push(...batchVectors);
      }

      const dimensions = vectors[0].length;
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const hnswIndex = new HnswConstructor("cosine", dimensions) as HnswLike;
      hnswIndex.initIndex({ maxElements: vectors.length, m: 16, efConstruction: 200, randomSeed: 43 });
      vectors.forEach((vec, label) => hnswIndex.addPoint(vec, label));

      hnswIndex.writeIndexSync(graphPath);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

      hnswIndex.setEf(96);
      active = { index: hnswIndex, manifest, dir };
      lastLoadError = null;
      console.log(`[IndexStore] Vector index built and ready: ${chunks.length} chunks, ${dimensions} dimensions.`);
      return active;
    } catch (error) {
      console.error("[IndexStore] Failed to build vector index:", error);
      lastLoadError = error instanceof Error ? error.message : "The HNSW index could not be built.";
      return null;
    } finally {
      buildingPromise = null;
    }
  })();

  return buildingPromise;
}

async function loadIndex() {
  const dir = indexDirectory();
  if (active?.dir === dir) return active;

  const manifestPath = path.join(dir, "manifest.json");
  const graphPath = path.join(dir, "vectors.hnsw");
  if (!existsSync(manifestPath) || !existsSync(graphPath)) {
    return ensureIndexReady();
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
