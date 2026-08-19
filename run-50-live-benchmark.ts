import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBenchmarkQueries } from "../server/rag/indexStore";
import { runTextQuery } from "../server/rag/service";

type MetricSet = { samples: number; p50: number | null; p70: number | null; p100: number | null };

const rank = (values: number[], percentile: number) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil((percentile / 100) * ordered.length) - 1))] ?? null;
};

const metric = (values: number[]): MetricSet => ({ samples: values.length, p50: rank(values, 50), p70: rank(values, 70), p100: rank(values, 100) });
const delayMs = Number(process.env.VALIDATION_DELAY_MS || 18_000);
const outputPath = resolve(process.env.VALIDATION_BENCHMARK_OUTPUT || "docs/validation-artifacts/benchmark-50.json");

const queries = await getBenchmarkQueries(50);
if (queries.length < 50) throw new Error(`The persisted index yielded only ${queries.length} distinct source queries; 50 are required for this validation.`);

const samples: Array<Record<string, unknown>> = [];
for (let index = 0; index < queries.length; index += 1) {
  const question = queries[index];
  const startedAt = new Date().toISOString();
  try {
    const result = await runTextQuery(question);
    const stageDurations = Object.fromEntries(result.stages.map(stage => [stage.name, stage.durationMs]));
    const ragCoreMs = [stageDurations.embedding, stageDurations.retrieving, stageDurations.generating]
      .filter((value): value is number => typeof value === "number")
      .reduce((sum, value) => sum + value, 0);
    samples.push({ index: index + 1, question, startedAt, outcome: result.outcome, totalMs: result.totalMs, ragCoreMs, stageDurations, error: null });
    console.log(`[${index + 1}/50] ${result.outcome} total=${result.totalMs}ms core=${ragCoreMs}ms`);
  } catch (error) {
    samples.push({ index: index + 1, question, startedAt, outcome: "error", error: error instanceof Error ? error.message : String(error) });
    console.error(`[${index + 1}/50] error: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (index + 1 < queries.length) await new Promise(resolveDelay => setTimeout(resolveDelay, delayMs));
}

const successful = samples.filter((sample): sample is Record<string, unknown> & { totalMs: number; ragCoreMs: number; stageDurations: Record<string, number | null> } => typeof sample.totalMs === "number" && typeof sample.ragCoreMs === "number" && Boolean(sample.stageDurations));
const stageMetric = (stage: string) => metric(successful.map(sample => sample.stageDurations[stage]).filter((value): value is number => typeof value === "number"));
const report = {
  generatedAt: new Date().toISOString(),
  source: "Distinct metadata.sourceQuery values from the persisted MSMARCO-XI index",
  requested: 50,
  completed: successful.length,
  errors: samples.length - successful.length,
  delayMs,
  totals: metric(successful.map(sample => sample.totalMs)),
  ragCore: metric(successful.map(sample => sample.ragCoreMs)),
  stages: {
    transcribing: stageMetric("transcribing"),
    embedding: stageMetric("embedding"),
    retrieving: stageMetric("retrieving"),
    generating: stageMetric("generating"),
    guardrailVerification: stageMetric("verifying"),
  },
  samples,
};
mkdirSync(resolve(outputPath, ".."), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (successful.length < 50) process.exitCode = 1;
