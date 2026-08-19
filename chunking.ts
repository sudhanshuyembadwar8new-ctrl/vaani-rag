export type ChunkStrategy = "semantic" | "sliding" | "document";

export type SourceMetadata = {
  language: string;
  split: string;
  sourceFile: string;
  row: number;
  field: string;
  sourceQuery?: string;
};

export type CorpusChunk = {
  id: string;
  passageId: string;
  content: string;
  strategy: ChunkStrategy;
  metadata: SourceMetadata;
};

export type ChunkingInput = {
  passageId: string;
  content: string;
  metadata: SourceMetadata;
};

const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

const splitThoughts = (value: string) => {
  const paragraphs = value.split(/\n{2,}/).map(compact).filter(Boolean);
  return paragraphs.flatMap(paragraph =>
    paragraph
      .split(/(?<=[.!?।])\s+(?=\S)/)
      .map(compact)
      .filter(Boolean),
  );
};

const slidingWindows = (tokens: string[], size: number, overlap: number) => {
  const output: string[] = [];
  const stride = Math.max(1, size - overlap);
  for (let cursor = 0; cursor < tokens.length; cursor += stride) {
    const window = tokens.slice(cursor, cursor + size);
    if (window.length < Math.min(28, size)) break;
    output.push(window.join(" "));
    if (cursor + size >= tokens.length) break;
  }
  return output;
};

const semanticWindows = (sentences: string[], target: number, overlap: number) => {
  const output: string[] = [];
  let current: string[] = [];
  let size = 0;

  for (const sentence of sentences) {
    const sentenceTokens = words(sentence).length;
    if (current.length && size + sentenceTokens > target) {
      output.push(current.join(" "));
      const tail = words(current.join(" ")).slice(-overlap).join(" ");
      current = tail ? [tail] : [];
      size = words(tail).length;
    }
    current.push(sentence);
    size += sentenceTokens;
  }
  if (current.length) output.push(current.join(" "));
  return output.filter(window => words(window).length >= 28);
};

/**
 * Produces three complementary retrieval views: semantic thought groups for explanation,
 * overlapping precision windows for facts, and a full short-document view for context.
 */
export function createMultiStrategyChunks(input: ChunkingInput): CorpusChunk[] {
  const content = compact(input.content);
  const tokens = words(content);
  if (tokens.length < 18) return [];

  const candidates: Array<{ strategy: ChunkStrategy; content: string }> = [];
  const sentences = splitThoughts(input.content);
  semanticWindows(sentences.length ? sentences : [content], 168, 28).forEach(value =>
    candidates.push({ strategy: "semantic", content: value }),
  );
  slidingWindows(tokens, 96, 24).forEach(value => candidates.push({ strategy: "sliding", content: value }));
  if (tokens.length <= 280) candidates.push({ strategy: "document", content });

  const unique = new Map<string, { strategy: ChunkStrategy; content: string }>();
  candidates.forEach(candidate => {
    const normalized = compact(candidate.content).toLowerCase();
    if (!unique.has(normalized)) unique.set(normalized, { ...candidate, content: compact(candidate.content) });
  });

  return Array.from(unique.values()).map((candidate, position) => ({
    id: `${input.passageId}:${candidate.strategy}:${position}`,
    passageId: input.passageId,
    content: candidate.content,
    strategy: candidate.strategy,
    metadata: input.metadata,
  }));
}
