import { describe, expect, it } from "vitest";
import { createMultiStrategyChunks } from "./chunking";

const longPassage = Array.from(
  { length: 90 },
  (_, index) => `Evidence sentence ${index + 1} explains a distinct part of the retrieval benchmark with enough detail for contextual grounding.`,
).join(" ");

describe("multi-strategy chunking", () => {
  it("creates distinct semantic and overlapping precision retrieval views with source metadata", () => {
    const chunks = createMultiStrategyChunks({
      passageId: "hinval:12",
      content: longPassage,
      metadata: { language: "hi-IN", split: "validation", sourceFile: "hinval.parquet", row: 12, field: "passage" },
    });

    expect(chunks.length).toBeGreaterThan(4);
    const strategies = new Set(chunks.map(chunk => chunk.strategy));
    expect(strategies.has("semantic")).toBe(true);
    expect(strategies.has("sliding")).toBe(true);
    expect(chunks.every(chunk => chunk.metadata.sourceFile === "hinval.parquet")).toBe(true);
    expect(new Set(chunks.map(chunk => chunk.id)).size).toBe(chunks.length);
  });
});
