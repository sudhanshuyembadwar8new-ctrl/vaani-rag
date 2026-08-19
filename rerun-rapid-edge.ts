import { readFile, writeFile } from "node:fs/promises";
import { runVoiceQuery } from "../server/rag/service";

const input = async (path: string, languageCode: string) => {
  const audio = await readFile(path);
  return { audioBase64: audio.toString("base64"), mimeType: "audio/wav", languageCode };
};

const execute = async (name: string, payload: { audioBase64: string; mimeType: string; languageCode: string }) => {
  try {
    const result = await runVoiceQuery(payload);
    return {
      name,
      outcome: result.outcome,
      transcript: result.transcript ?? null,
      answer: result.outcome === "answered" ? result.answer : null,
      refusalReason: result.outcome === "refused" ? result.reason : null,
      sourceCount: result.sources.length,
      totalMs: result.totalMs,
      stages: result.stages,
    };
  } catch (error) {
    return { name, outcome: "error", error: error instanceof Error ? error.message : String(error) };
  }
};

const results = await Promise.all([
  execute("rapid_back_to_back_a_model_fix", await input("/home/ubuntu/webdev-static-assets/vaani-validation-01-hi.wav", "hi-IN")),
  execute("rapid_back_to_back_b_model_fix", await input("/home/ubuntu/webdev-static-assets/vaani-validation-05-hi.wav", "hi-IN")),
]);
await writeFile("docs/validation-artifacts/rapid-edge-rerun.json", JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
for (const result of results) console.log(`${result.name}: ${result.outcome}`);
