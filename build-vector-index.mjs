import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import hnswlib from "hnswlib-node";

const { HierarchicalNSW } = hnswlib;
const destination = resolve(process.argv[2] || "server/rag-index");
const rowsPath = resolve(process.env.RAG_ROWS_JSON || ".rag-source/msmarco_rows.json");
const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error("GEMINI_API_KEY is required to produce real gemini-embedding-001 vectors.");
if (!existsSync(rowsPath)) throw new Error(`Extracted corpus rows not found: ${rowsPath}. Run the corpus extraction command first.`);

const rows = JSON.parse(readFileSync(rowsPath, "utf8"));
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const words = value => clean(value).split(/\s+/).filter(Boolean);
const getStrings = (value, path = "") => {
  if (typeof value === "string") return value.length >= 80 ? [{ field: path || "text", value: clean(value) }] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => getStrings(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([name, item]) => getStrings(item, path ? `${path}.${name}` : name));
  return [];
};
const chunk = (content, metadata, passageId) => {
  const tokens = words(content);
  if (tokens.length < 18) return [];
  const parts = [];
  for (let i = 0; i < tokens.length; i += 140) {
    const window = tokens.slice(i, i + 168);
    if (window.length >= 28) parts.push({ strategy: "semantic", content: window.join(" ") });
    if (i + 168 >= tokens.length) break;
  }
  for (let i = 0; i < tokens.length; i += 72) {
    const window = tokens.slice(i, i + 96);
    if (window.length >= 28) parts.push({ strategy: "sliding", content: window.join(" ") });
    if (i + 96 >= tokens.length) break;
  }
  if (tokens.length <= 280) parts.push({ strategy: "document", content: tokens.join(" ") });
  const seen = new Set();
  return parts.filter(part => {
    const signature = part.content.toLowerCase();
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).map((part, position) => ({ id: `${passageId}:${part.strategy}:${position}`, passageId, ...part, metadata }));
};

const isDegenerate = text => {
  const tokenList = clean(text).split(/\s+/).filter(Boolean);
  if (tokenList.length > 20) {
    const unique = new Set(tokenList);
    if (unique.size / tokenList.length < 0.35) return true;
  }
  return false;
};

const chunks = [];
const compactCorpus = process.env.RAG_COMPACT_CORPUS === "1";
for (const source of rows) {
  const data = source.data || {};
  const sourceQuery = clean(data.query || data.question || data.query_text);
  if (compactCorpus) {
    const candidates = getStrings(data).filter(candidate => !isDegenerate(candidate.value));
    const answer = candidates.find(candidate => /(^|\.)(English_passages|passages_text|Answer|Eng_Answer)/i.test(candidate.field)) ?? candidates[0];
    if (!answer) continue;
    const content = clean(`${sourceQuery ? `Question: ${sourceQuery}\n` : ""}Evidence: ${answer.value}`);
    if (words(content).length >= 18) {
      chunks.push({
        id: `${source.language}:${source.split}:${source.row}:validation:0`,
        passageId: `${source.language}:${source.split}:${source.row}`,
        strategy: "validation-document",
        content,
        metadata: { language: source.language, split: source.split, sourceFile: source.sourceFile, row: source.row, field: answer.field, sourceQuery: sourceQuery || undefined },
      });
    }
    continue;
  }
  for (const candidate of getStrings(data)) {
    if (/^(query|question|query_text)$/i.test(candidate.field)) continue;
    if (isDegenerate(candidate.value)) continue;
    chunks.push(...chunk(candidate.value, { language: source.language, split: source.split, sourceFile: source.sourceFile, row: source.row, field: candidate.field, sourceQuery: sourceQuery || undefined }, `${source.language}:${source.split}:${source.row}`));
  }
}
if (!chunks.length) throw new Error("No passage-like text fields were found in the selected MSMARCO-XI rows.");

const wait = milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
const embedBatch = async texts => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] },
          })),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await response.json().catch(() => ({}));
      const vectors = body.embeddings?.map(item => item.values);
      if (!response.ok || !Array.isArray(vectors) || vectors.length !== texts.length || vectors.some(vector => !Array.isArray(vector) || !vector.length || vector.some(value => !Number.isFinite(value)))) {
        throw new Error(body.error?.message || `Gemini batch embedding failed (${response.status}).`);
      }
      return vectors;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini batch embedding failed.");
};

console.log(`Embedding ${chunks.length} chunks from ${rows.length} MSMARCO-XI rows with gemini-embedding-001…`);
const vectors = [];
const batchSize = 50;
for (let position = 0; position < chunks.length; position += batchSize) {
  const batch = chunks.slice(position, position + batchSize);
  vectors.push(...await embedBatch(batch.map(chunkItem => chunkItem.content)));
  console.log(`Embedded ${Math.min(position + batch.length, chunks.length)}/${chunks.length}`);
  await wait(100);
}
const dimensions = vectors[0].length;
if (vectors.some(vector => vector.length !== dimensions)) throw new Error("Gemini returned inconsistent vector dimensions.");
if (!existsSync(destination)) mkdirSync(destination, { recursive: true });
const index = new HierarchicalNSW("cosine", dimensions);
index.initIndex({ maxElements: vectors.length, m: 16, efConstruction: 200, randomSeed: 43 });
vectors.forEach((vector, label) => index.addPoint(vector, label));
index.writeIndexSync(resolve(destination, "vectors.hnsw"));
const sourceFiles = [...new Set(rows.map(row => row.sourceFile))];
const languages = [...new Set(rows.map(row => row.language))];
writeFileSync(resolve(destination, "manifest.json"), JSON.stringify({ version: 1, model: "gemini-embedding-001", dimensions, metric: "cosine", builtAt: Date.now(), corpus: { dataset: "ai4bharat/MSMARCO-XI", split: "validation", sourceFile: sourceFiles.join(", "), sourceRows: rows.length, languages }, chunks: chunks.map((item, label) => ({ id: item.id, label, content: item.content, strategy: item.strategy, metadata: item.metadata })) }, null, 2));
console.log(`Wrote ${chunks.length} real Gemini vectors to ${destination}/vectors.hnsw with provenance manifest.`);
