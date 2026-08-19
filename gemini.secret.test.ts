import { describe, expect, it } from "vitest";

describe("GEMINI_API_KEY secret", () => {
  it("can call gemini-embedding-001", async () => {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY is not configured.");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ content: { parts: [{ text: "Vaani embedding validation" }] } }),
      signal: AbortSignal.timeout(15_000),
    });
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { embedding?: { values?: number[] } };
    expect(payload.embedding?.values?.length).toBeGreaterThan(0);
  }, 20_000);
});
