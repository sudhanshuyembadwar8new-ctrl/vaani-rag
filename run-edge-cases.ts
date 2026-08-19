import { readFile, writeFile } from "node:fs/promises";
import { runVoiceQuery } from "../server/rag/service";

type CaseResult = Record<string, unknown>;

const toInput = async (path: string, languageCode: string) => {
  const audio = await readFile(path);
  return { audioBase64: audio.toString("base64"), mimeType: "audio/wav", languageCode };
};

const runCase = async (name: string, input: { audioBase64: string; mimeType: string; languageCode: string }): Promise<CaseResult> => {
  const startedAt = new Date().toISOString();
  try {
    const result = await runVoiceQuery(input);
    return {
      name,
      startedAt,
      outcome: result.outcome,
      transcript: result.transcript ?? null,
      answer: result.outcome === "answered" ? result.answer : null,
      refusalReason: result.outcome === "refused" ? result.reason : null,
      sourceCount: result.sources.length,
      topSources: result.sources.slice(0, 2).map(source => ({ id: source.id, similarity: source.similarity, language: source.metadata.language, content: source.content.slice(0, 500) })),
      totalMs: result.totalMs,
      stages: result.stages,
    };
  } catch (error) {
    return { name, startedAt, outcome: "error", error: error instanceof Error ? error.message : String(error) };
  }
};

const silent = await runCase("silent_audio", await toInput("/home/ubuntu/webdev-static-assets/vaani-edge-silent.wav", "en-IN"));
await new Promise(resolve => setTimeout(resolve, 65_000));
const longQuery = await runCase("long_spoken_query", await toInput("/home/ubuntu/webdev-static-assets/vaani-edge-long-query.wav", "en-IN"));
await new Promise(resolve => setTimeout(resolve, 65_000));
const malformed = await runCase("malformed_audio", { audioBase64: Buffer.from("not a valid wav container").toString("base64"), mimeType: "audio/wav", languageCode: "en-IN" });
await new Promise(resolve => setTimeout(resolve, 65_000));
const [rapidA, rapidB] = await Promise.all([
  runCase("rapid_back_to_back_a", await toInput("/home/ubuntu/webdev-static-assets/vaani-validation-01-hi.wav", "hi-IN")),
  runCase("rapid_back_to_back_b", await toInput("/home/ubuntu/webdev-static-assets/vaani-validation-05-hi.wav", "hi-IN")),
]);

const results = [silent, longQuery, malformed, rapidA, rapidB];
await writeFile("docs/validation-artifacts/edge-cases.json", JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
for (const result of results) console.log(`${result.name}: ${result.outcome}`);
