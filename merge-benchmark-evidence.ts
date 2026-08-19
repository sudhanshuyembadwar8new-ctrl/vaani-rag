import { readFile, writeFile } from "node:fs/promises";

type StageMap = Record<string, number | null>;
type Sample = {
  index: number;
  question: string;
  startedAt: string;
  outcome: string;
  totalMs?: number;
  ragCoreMs?: number;
  stageDurations?: StageMap;
  error?: string | null;
};

const benchmark = JSON.parse(await readFile("docs/validation-artifacts/benchmark-50.json", "utf8")) as { samples: Sample[]; delayMs: number; source: string };
const rerun = JSON.parse(await readFile("docs/validation-artifacts/benchmark-failure-rerun.json", "utf8")) as { results: Array<Sample & { stages?: Array<{ name: string; durationMs: number | null }> }> };

const initial = benchmark.samples.filter(sample => sample.outcome !== "error");
const fixed = rerun.results.filter(sample => sample.outcome !== "error").map((sample, offset) => {
  const stageDurations: StageMap = {};
  for (const stage of sample.stages ?? []) stageDurations[stage.name] = stage.durationMs;
  const ragCoreMs = ["embedding", "retrieving", "generating"].reduce((sum, name) => sum + (stageDurations[name] ?? 0), 0);
  return {
    index: 51 + offset,
    question: sample.question,
    startedAt: new Date().toISOString(),
    outcome: sample.outcome,
    totalMs: sample.totalMs,
    ragCoreMs,
    stageDurations: {
      transcribing: stageDurations.transcribing ?? null,
      embedding: stageDurations.embedding ?? null,
      retrieving: stageDurations.retrieving ?? null,
      generating: stageDurations.generating ?? null,
      verifying: stageDurations.verifying ?? null,
      answered: stageDurations.answered ?? 0,
    },
    error: null,
    rerunOfOriginalIndex: sample.question,
  } satisfies Sample & { rerunOfOriginalIndex: string };
});

const samples = [...initial, ...fixed];
const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, rank)];
};
const valuesFor = (selector: (sample: Sample) => number | undefined) => samples.map(selector).filter((value): value is number => typeof value === "number");
const summary = (values: number[]) => ({ samples: values.length, p50: percentile(values, 50), p70: percentile(values, 70), p100: percentile(values, 100) });
const stage = (name: string) => summary(samples.map(sample => sample.stageDurations?.[name]).filter((value): value is number => typeof value === "number"));

await writeFile("docs/validation-artifacts/benchmark-50-combined.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: `${benchmark.source}; four original failures rerun after timeout, compact-evidence, and structured-JSON fixes`,
  requestedDistinctQueries: 50,
  completedObservations: samples.length,
  initialCompleted: initial.length,
  fixedRerunsCompleted: fixed.length,
  initialErrors: benchmark.samples.length - initial.length,
  delayMs: benchmark.delayMs,
  totals: summary(valuesFor(sample => sample.totalMs)),
  ragCore: summary(valuesFor(sample => sample.ragCoreMs)),
  stages: {
    transcribing: stage("transcribing"),
    embedding: stage("embedding"),
    retrieving: stage("retrieving"),
    generating: stage("generating"),
    guardrailVerification: stage("verifying"),
  },
  samples,
}, null, 2));

console.log(JSON.stringify({ completed: samples.length, initialErrors: benchmark.samples.length - initial.length, fixedReruns: fixed.length }, null, 2));
if (samples.length < 50 || fixed.length < 4) process.exitCode = 1;
