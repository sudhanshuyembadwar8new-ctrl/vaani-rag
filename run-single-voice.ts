import { readFile } from "node:fs/promises";
import { runVoiceQuery } from "../server/rag/service";

const [audioPath, languageCode = "en-IN"] = process.argv.slice(2);
if (!audioPath) throw new Error("Usage: pnpm tsx scripts/run-single-voice.ts <audio-path> [language-code]");
const audio = await readFile(audioPath);
try {
  const result = await runVoiceQuery({ audioBase64: audio.toString("base64"), mimeType: "audio/wav", languageCode });
  console.log(JSON.stringify({
    outcome: result.outcome,
    transcript: result.transcript ?? null,
    answer: result.outcome === "answered" ? result.answer : null,
    refusalReason: result.outcome === "refused" ? result.reason : null,
    citations: result.outcome === "answered" ? result.citations : [],
    sources: result.sources.slice(0, 3).map(source => ({ id: source.id, language: source.metadata.language, similarity: source.similarity, content: source.content.slice(0, 500) })),
    totalMs: result.totalMs,
    stages: result.stages,
  }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ outcome: "error", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
