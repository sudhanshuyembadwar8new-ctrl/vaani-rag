import { readFile, writeFile } from "node:fs/promises";
import { transcribeWithSarvam } from "../server/rag/clients";

const fixtures = [
  { id: 1, path: "/home/ubuntu/webdev-static-assets/vaani-validation-01-hi.wav", languageCode: "hi-IN" },
  { id: 2, path: "/home/ubuntu/webdev-static-assets/vaani-validation-02-hi.wav", languageCode: "hi-IN" },
  { id: 3, path: "/home/ubuntu/webdev-static-assets/vaani-validation-03-hi.wav", languageCode: "hi-IN" },
  { id: 4, path: "/home/ubuntu/webdev-static-assets/vaani-validation-04-hi.wav", languageCode: "hi-IN" },
  { id: 5, path: "/home/ubuntu/webdev-static-assets/vaani-validation-05-hi.wav", languageCode: "hi-IN" },
  { id: 6, path: "/home/ubuntu/webdev-static-assets/vaani-validation-06-hi.wav", languageCode: "hi-IN" },
  { id: 7, path: "/home/ubuntu/webdev-static-assets/vaani-validation-07-offtopic.wav", languageCode: "en-IN" },
  { id: 8, path: "/home/ubuntu/webdev-static-assets/vaani-validation-08-offtopic.wav", languageCode: "en-IN" },
  { id: 9, path: "/home/ubuntu/webdev-static-assets/vaani-validation-09-mr.wav", languageCode: "mr-IN" },
  { id: 10, path: "/home/ubuntu/webdev-static-assets/vaani-validation-10-ta.wav", languageCode: "ta-IN" },
] as const;

const percentile = (values: number[], point: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((point / 100) * sorted.length) - 1)] ?? null;
};

const observations: Array<Record<string, unknown>> = [];
for (let iteration = 0; iteration < 5; iteration += 1) {
  for (const fixture of fixtures) {
    const audio = await readFile(fixture.path);
    const started = performance.now();
    try {
      const response = await transcribeWithSarvam({ audio, mimeType: "audio/wav", languageCode: fixture.languageCode });
      const durationMs = Math.round(performance.now() - started);
      observations.push({ iteration: iteration + 1, fixture: fixture.id, languageCode: fixture.languageCode, outcome: "complete", durationMs, retries: response.retries, transcript: response.value.transcript });
      console.log(`[${observations.length}/50] fixture=${fixture.id} ${durationMs}ms`);
    } catch (error) {
      observations.push({ iteration: iteration + 1, fixture: fixture.id, languageCode: fixture.languageCode, outcome: "error", error: error instanceof Error ? error.message : String(error) });
      console.log(`[${observations.length}/50] fixture=${fixture.id} error`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

const completed = observations.filter((item): item is { durationMs: number } => item.outcome === "complete" && typeof item.durationMs === "number");
const durations = completed.map(item => item.durationMs);
const artifact = {
  generatedAt: new Date().toISOString(),
  requestedObservations: 50,
  completedObservations: completed.length,
  errors: observations.length - completed.length,
  stage: { p50: percentile(durations, 50), p70: percentile(durations, 70), p100: percentile(durations, 100) },
  observations,
};
await writeFile("docs/validation-artifacts/transcription-50.json", JSON.stringify(artifact, null, 2));
if (completed.length !== 50) process.exitCode = 1;
