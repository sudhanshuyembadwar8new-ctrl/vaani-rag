import { readFile } from "node:fs/promises";

type Source = { id: string; similarity: number; language: string; content: string };
type Stage = { name: string; durationMs: number | null; status: string };
type Run = {
  id: number;
  class: string;
  outcome: string;
  transcript: string | null;
  answer: string | null;
  refusalReason: string | null;
  citations: string[];
  sources: Source[];
  totalMs: number;
  stages: Stage[];
};

const artifact = JSON.parse(await readFile("docs/validation-artifacts/voice-10.json", "utf8")) as { results: Run[] };
const summary = artifact.results.map(run => ({
  id: run.id,
  class: run.class,
  outcome: run.outcome,
  transcript: run.transcript,
  answer: run.answer,
  refusalReason: run.refusalReason,
  citations: run.citations,
  topSources: run.sources.slice(0, 3).map(source => ({ id: source.id, similarity: Number(source.similarity.toFixed(3)), language: source.language, excerpt: source.content.slice(0, 220) })),
  totalMs: run.totalMs,
  stages: Object.fromEntries(run.stages.map(stage => [stage.name, { status: stage.status, durationMs: stage.durationMs }])),
}));
console.log(JSON.stringify(summary, null, 2));
