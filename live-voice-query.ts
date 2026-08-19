import { readFile } from "node:fs/promises";
import { runVoiceQuery } from "../server/rag/service";

const audioPath = process.argv[2] || "/home/ubuntu/webdev-static-assets/vaani-live-query.wav";
const audio = await readFile(audioPath);
const result = await runVoiceQuery({
  audioBase64: audio.toString("base64"),
  mimeType: "audio/wav",
  languageCode: "en-IN",
});

console.log(JSON.stringify({
  outcome: result.outcome,
  transcript: result.transcript,
  answer: result.outcome === "answered" ? result.answer : undefined,
  citations: result.outcome === "answered" ? result.citations : undefined,
  reason: result.outcome === "refused" ? result.reason : undefined,
  sourceCount: result.sources.length,
  sources: result.sources.slice(0, 5).map(source => ({ id: source.id, strategy: source.strategy, language: source.metadata.language, content: source.content })),
  totalMs: result.totalMs,
  stages: result.stages,
}, null, 2));

if (result.outcome !== "answered" || !result.sources.length || !result.transcript) {
  throw new Error("Live voice verification did not produce a grounded answer with transcript and retrieved passages.");
}
