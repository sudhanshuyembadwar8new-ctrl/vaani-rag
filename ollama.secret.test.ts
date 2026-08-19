import { describe, expect, it } from "vitest";

// Ollama/bge-m3 was scrapped. All embeddings now use Gemini Embedding API.
// This test verifies the Gemini embedding endpoint is reachable with the configured key.
describe("Gemini Embedding API connectivity", () => {
  it("responds to the gemini-embedding-001 endpoint with a valid vector", async () => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY is not configured.");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ content: { parts: [{ text: "Vaani connectivity probe" }] } }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { embedding?: { values?: number[] } };
    expect(payload.embedding?.values?.length).toBeGreaterThan(0);
  }, 20_000);
});
