import { describe, expect, it } from "vitest";

describe("Groq credential", () => {
  it("authenticates and exposes the configured generation model", async () => {
    const key = process.env.GROQ_API_KEY?.trim();
    expect(key, "GROQ_API_KEY must be configured for live validation").toBeTruthy();

    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });

    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain('"id":"groq/compound-mini"');
  }, 20_000);
});
