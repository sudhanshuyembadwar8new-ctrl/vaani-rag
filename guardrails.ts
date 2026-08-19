/**
 * guardrails.ts
 * Pipeline safety and grounding checks for the Vaani RAG system.
 *
 * Four gates protect answer quality:
 *   1. safetyCheck      — blocks unsafe/off-topic queries before any API call
 *   2. retrievalCheck   — blocks answers when similarity scores are too weak
 *   3. citationCheck    — verifies generated citations exist in retrieved chunks
 *   4. semanticSupportCheck — verifies the answer vector is supported by retrieved evidence
 */

import type { RetrievedChunk } from "./indexStore";

/** Patterns that trigger an immediate pre-retrieval refusal. */
const UNSAFE_PATTERNS: RegExp[] = [
  /\b(bomb|weapon|explosive|poison|malware|hack\b|exploit\b|ransomware)\b/i,
  /\b(how to (kill|harm|hurt|attack|abuse|stalk))\b/i,
  /\b(child (porn|sex|abuse|grooming))\b/i,
];

/** Minimum cosine similarity for a retrieved chunk to count as grounded evidence. */
const SIMILARITY_THRESHOLD = 0.55;

/** Minimum number of chunks that must exceed the similarity threshold. */
const MIN_GROUNDED_CHUNKS = 2;

// ---------------------------------------------------------------------------
// 1. Safety gate — checked before any embedding/retrieval/generation call
// ---------------------------------------------------------------------------

export function safetyCheck(question: string): { allowed: boolean; reason: string } {
  const normalised = question.trim();
  if (!normalised || normalised.length < 3) {
    return { allowed: false, reason: "The question is too short to process." };
  }
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(normalised)) {
      return {
        allowed: false,
        reason:
          "This question cannot be answered because it matches a category of content the system is not permitted to process.",
      };
    }
  }
  return { allowed: true, reason: "" };
}

// ---------------------------------------------------------------------------
// 2. Retrieval gate — checked after HNSW search, before generation
// ---------------------------------------------------------------------------

export function retrievalCheck(sources: RetrievedChunk[]): {
  grounded: boolean;
  reason: string;
  chunks: RetrievedChunk[];
} {
  const qualified = sources.filter(chunk => chunk.similarity >= SIMILARITY_THRESHOLD);
  if (qualified.length < MIN_GROUNDED_CHUNKS) {
    return {
      grounded: false,
      reason:
        `Only ${qualified.length} of ${sources.length} retrieved passages exceeded the ${SIMILARITY_THRESHOLD} cosine similarity threshold. ` +
        "The corpus does not contain sufficient grounding evidence for this question.",
      chunks: qualified,
    };
  }
  return { grounded: true, reason: "", chunks: qualified };
}

// ---------------------------------------------------------------------------
// 3. Citation gate — checked after generation, before release
// ---------------------------------------------------------------------------

export function citationCheck(
  rawCitations: string[],
  chunks: RetrievedChunk[],
): { valid: boolean; citations: string[] } {
  const validIds = new Set(chunks.map(chunk => chunk.id));
  const verified = rawCitations.filter(id => validIds.has(id));
  return {
    valid: verified.length > 0,
    citations: verified,
  };
}

// ---------------------------------------------------------------------------
// 4. Semantic support gate — answer vector must be close to cited evidence
// ---------------------------------------------------------------------------

/** Minimum similarity between the answer embedding and any cited chunk. */
const SEMANTIC_SUPPORT_THRESHOLD = 0.45;

export function semanticSupportCheck(
  answerMatches: RetrievedChunk[],
  citedCitations: string[] | { citations: string[] },
): boolean {
  const citations = Array.isArray(citedCitations) ? citedCitations : citedCitations?.citations;
  if (!citations || !citations.length) return false;
  const citedIds = new Set(citations);
  return answerMatches.some(
    match => citedIds.has(match.id) && match.similarity >= SEMANTIC_SUPPORT_THRESHOLD,
  );
}
