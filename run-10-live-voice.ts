import { readFile, writeFile } from "node:fs/promises";
import { runVoiceQuery } from "../server/rag/service";

const fixtures = [
  { id: 1, path: "/home/ubuntu/webdev-static-assets/vaani-validation-01-hi.wav", languageCode: "hi-IN", class: "answerable" },
  { id: 2, path: "/home/ubuntu/webdev-static-assets/vaani-validation-02-hi.wav", languageCode: "hi-IN", class: "answerable" },
  { id: 3, path: "/home/ubuntu/webdev-static-assets/vaani-validation-03-hi.wav", languageCode: "hi-IN", class: "borderline" },
  { id: 4, path: "/home/ubuntu/webdev-static-assets/vaani-validation-04-hi.wav", languageCode: "hi-IN", class: "borderline" },
  { id: 5, path: "/home/ubuntu/webdev-static-assets/vaani-validation-05-hi.wav", languageCode: "hi-IN", class: "answerable" },
  { id: 6, path: "/home/ubuntu/webdev-static-assets/vaani-validation-06-hi.wav", languageCode: "hi-IN", class: "borderline" },
  { id: 7, path: "/home/ubuntu/webdev-static-assets/vaani-validation-07-offtopic.wav", languageCode: "en-IN", class: "guardrail-offtopic" },
  { id: 8, path: "/home/ubuntu/webdev-static-assets/vaani-validation-08-offtopic.wav", languageCode: "en-IN", class: "guardrail-offtopic" },
  { id: 9, path: "/home/ubuntu/webdev-static-assets/vaani-validation-09-mr.wav", languageCode: "mr-IN", class: "answerable" },
  { id: 10, path: "/home/ubuntu/webdev-static-assets/vaani-validation-10-ta.wav", languageCode: "ta-IN", class: "answerable" },
] as const;

const results = [];
for (const [index, fixture] of fixtures.entries()) {
  if (index > 0) await new Promise(resolve => setTimeout(resolve, 65_000));
  const startedAt = new Date().toISOString();
  try {
    const audio = await readFile(fixture.path);
    const result = await runVoiceQuery({
      audioBase64: audio.toString("base64"),
      mimeType: "audio/wav",
      languageCode: fixture.languageCode,
    });
    results.push({
      ...fixture,
      startedAt,
      outcome: result.outcome,
      transcript: result.transcript ?? null,
      answer: result.outcome === "answered" ? result.answer : null,
      citations: result.outcome === "answered" ? result.citations : [],
      refusalReason: result.outcome === "refused" ? result.reason : null,
      sources: result.sources.map(source => ({
        id: source.id,
        strategy: source.strategy,
        language: source.metadata.language,
        similarity: source.similarity,
        content: source.content,
      })),
      totalMs: result.totalMs,
      stages: result.stages,
    });
    console.log(`[${fixture.id}/10] ${result.outcome} total=${result.totalMs}ms transcript=${JSON.stringify(result.transcript)}`);
  } catch (error) {
    results.push({ ...fixture, startedAt, outcome: "error", error: error instanceof Error ? error.message : String(error) });
    console.log(`[${fixture.id}/10] error ${error instanceof Error ? error.message : String(error)}`);
  }
}

await writeFile("docs/validation-artifacts/voice-10.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "Ten generated WAV fixtures executed through Sarvam STT, Gemini embedding, HNSW retrieval, Groq generation, and verification.",
  requested: fixtures.length,
  results,
}, null, 2));

const successfulOrRefused = results.filter(result => result.outcome === "answered" || result.outcome === "refused").length;
if (successfulOrRefused !== fixtures.length) process.exitCode = 1;
