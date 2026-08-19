import { describe, expect, it } from "vitest";

const required = (key: string) => {
  const value = process.env[key];
  expect(value, `${key} must be configured`).toBeTruthy();
  return value as string;
};

const fetchWithTimeout = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const describeLive = process.env.RUN_LIVE_SERVICE_TESTS === "true" ? describe : describe.skip;

describeLive("live Vaani service configuration", () => {
  it("authorizes Groq and returns its available models", async () => {
    const groqKey = required("GROQ_API_KEY");
    const response = await fetchWithTimeout("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${groqKey}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("authorizes Gemini Embedding and returns gemini-embedding-001 vectors", async () => {
    const geminiKey = required("GEMINI_API_KEY");
    const response = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({ content: { parts: [{ text: "Vaani live embedding probe" }] } }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { embedding?: { values?: number[] } };
    expect(body.embedding?.values?.length).toBeGreaterThan(0);
  });

  it("passes Sarvam authentication before audio processing", async () => {
    const sarvamKey = required("SARVAM_API_KEY");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([82, 73, 70, 70])], { type: "audio/wav" }), "probe.wav");
    form.append("model", "saaras:v4");

    const response = await fetchWithTimeout("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": sarvamKey },
      body: form,
    });

    expect([401, 403]).not.toContain(response.status);
  });
});
