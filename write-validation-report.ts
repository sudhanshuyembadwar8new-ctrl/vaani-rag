import { readFile, writeFile } from "node:fs/promises";

type Stage = { name: string; status: string; durationMs: number | null };
type Source = { id: string; similarity: number; language: string; content: string };
type VoiceRun = {
  id: number;
  class: string;
  outcome: "answered" | "refused" | "error";
  transcript: string | null;
  answer: string | null;
  refusalReason: string | null;
  citations: string[];
  sources: Source[];
  totalMs: number;
  stages: Stage[];
};

const readJson = async <T>(path: string) => JSON.parse(await readFile(path, "utf8")) as T;
const benchmark = await readJson<{
  requestedDistinctQueries: number;
  completedObservations: number;
  initialCompleted: number;
  fixedRerunsCompleted: number;
  initialErrors: number;
  delayMs: number;
  totals: { p50: number; p70: number; p100: number };
  ragCore: { p50: number; p70: number; p100: number };
  stages: Record<string, { p50: number | null; p70: number | null; p100: number | null }>;
}>("docs/validation-artifacts/benchmark-50-combined.json");
const voiceArtifact = await readJson<{ results: VoiceRun[] }>("docs/validation-artifacts/voice-10.json");
const edge = await readJson<{ results: Array<{ name: string; outcome: string; error?: string; transcript?: string; answer?: string; refusalReason?: string; totalMs?: number }> }>("docs/validation-artifacts/edge-cases.json");
const edgeRerun = await readJson<{ results: Array<{ name: string; outcome: string; error?: string; transcript?: string; answer?: string; refusalReason?: string; totalMs?: number }> }>("docs/validation-artifacts/rapid-edge-rerun.json");
const cleanOffTopic = await readJson<{ outcome: string; transcript: string; refusalReason: string; totalMs: number }>("docs/validation-artifacts/voice-offtopic-clean.json");
const transcription = await readJson<{ requestedObservations: number; completedObservations: number; errors: number; stage: { p50: number; p70: number; p100: number } }>("docs/validation-artifacts/transcription-50.json");

const ms = (value: number | null | undefined) => value == null ? "—" : `${value.toLocaleString()} ms`;
const esc = (value: string | null | undefined) => (value || "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const stage = (run: VoiceRun, name: string) => run.stages.find(item => item.name === name)?.durationMs;
const sourceSummary = (run: VoiceRun) => run.sources.slice(0, 2).map(source => `${source.id} (${(source.similarity * 100).toFixed(1)}%)`).join("; ") || "No sources";
const outcomeCheck = (run: VoiceRun) => run.outcome === "answered"
  ? `Released; verification ${run.stages.find(item => item.name === "verifying")?.status ?? "unknown"}; citations: ${run.citations.join(", ")}`
  : `Withheld; ${esc(run.refusalReason)}`;
const voiceRows = voiceArtifact.results.map(run =>
  `| ${run.id} · ${run.class} | ${esc(run.transcript)} | ${sourceSummary(run)} | ${run.outcome === "answered" ? esc(run.answer) : "—"} | ${outcomeCheck(run)} | ${ms(run.totalMs)} |`,
).join("\n");
const voiceStageRows = voiceArtifact.results.map(run =>
  `| ${run.id} | ${ms(stage(run, "transcribing"))} | ${ms(stage(run, "embedding"))} | ${ms(stage(run, "retrieving"))} | ${ms(stage(run, "generating"))} | ${ms(stage(run, "verifying"))} |`,
).join("\n");
const edgeRows = edge.results.map(result =>
  `| ${result.name} | ${result.outcome} | ${esc(result.transcript || result.answer || result.refusalReason || result.error)} |`,
).join("\n");
const rapidRows = edgeRerun.results.map(result =>
  `| ${result.name} | ${result.outcome} | ${esc(result.transcript || result.answer || result.refusalReason || result.error)} |`,
).join("\n");

const report = `# Vaani Live Validation Report

**Validation window:** August 16–17, 2026  
**System under test:** Sarvam STT → Gemini Embedding → persisted cosine HNSW → Groq generation → citation and semantic-support gates  
**Corpus state:** 51 persisted **validation-document** chunks derived from 52 MSMARCO-XI validation rows across Hindi, Marathi, Tamil, and Telugu.

## Executive result

The validation produced a complete, auditable **50-observation text benchmark** and **10 end-to-end voice runs** using live upstream services and the persisted multilingual index. The application passed the integrity, live-data, legacy-migration, and primary voice-flow checks. It did **not** meet the 200 ms RAG-core target: the observed P50 was ${ms(benchmark.ragCore.p50)}, exceeding the target by **${(benchmark.ragCore.p50 - 200).toLocaleString()} ms**. The benchmark therefore establishes an honest performance baseline rather than a target claim.

| Requested validation section | Result | Evidence-based conclusion |
|---|---|---|
| 50-query benchmark | **PASS, with disclosed remediation** | ${benchmark.completedObservations} completed observations represent ${benchmark.requestedDistinctQueries} source-derived MSMARCO-XI questions: ${benchmark.initialCompleted} completed on the first pass and ${benchmark.fixedRerunsCompleted} original failures completed after focused fixes. |
| Transcription-stage benchmark | **PASS** | ${transcription.completedObservations}/${transcription.requestedObservations} live Sarvam observations completed with ${transcription.errors} errors: P50 ${ms(transcription.stage.p50)}, P70 ${ms(transcription.stage.p70)}, P100 ${ms(transcription.stage.p100)}. |
| RAG-core <200 ms | **FAIL** | P50 ${ms(benchmark.ragCore.p50)}, P70 ${ms(benchmark.ragCore.p70)}, P100 ${ms(benchmark.ragCore.p100)}. External generation dominates latency. |
| Ten live voice queries | **PASS** | Seven grounded answers and three grounded refusals; transcripts, sources, similarities, answers, and verification outcomes are recorded below. |
| Edge-case stress | **PASS, with documented constraints and fixes** | Silence and malformed inputs return explicit errors; a 97.64-second input is rejected by Sarvam’s synchronous endpoint; browser capture is now capped at 25 seconds; two simultaneous runs succeed after changing to a live-listed Groq model. |
| Legacy architecture audit | **PASS** | Repository grep returned no remaining legacy local-embedding or tunnel configuration references. |
| Live UI data panels | **PASS** | A fresh browser query rendered 51 index chunks, a 3,162 ms observed run, live P50/P70/P100 values, a grounded answer, citations, and seven retrieved passages with similarity scores. |

## 1. Text benchmark

The harness selected distinct **metadata.sourceQuery** values from the persisted MSMARCO-XI index and used an ${benchmark.delayMs / 1000}-second inter-query delay. The first pass completed ${benchmark.initialCompleted} of ${benchmark.requestedDistinctQueries} observations; four failures were traced to the retired **llama-3.1-8b-instant** model, request timeout, and structured-output errors. The exact failed source queries were rerun after switching to the live-listed **groq/compound-mini** model, extending Groq’s bounded generation timeout, and tightening evidence/output budgets. The combined artifact contains all ${benchmark.completedObservations} completed observations and retains the original failure count for audit transparency.

| Metric | P50 | P70 | P100 |
|---|---:|---:|---:|
| Full text pipeline | ${ms(benchmark.totals.p50)} | ${ms(benchmark.totals.p70)} | ${ms(benchmark.totals.p100)} |
| **RAG-core: embed + retrieve + generate** | **${ms(benchmark.ragCore.p50)}** | **${ms(benchmark.ragCore.p70)}** | **${ms(benchmark.ragCore.p100)}** |
| Gemini embedding | ${ms(benchmark.stages.embedding.p50)} | ${ms(benchmark.stages.embedding.p70)} | ${ms(benchmark.stages.embedding.p100)} |
| HNSW retrieval | ${ms(benchmark.stages.retrieving.p50)} | ${ms(benchmark.stages.retrieving.p70)} | ${ms(benchmark.stages.retrieving.p100)} |
| Groq generation | ${ms(benchmark.stages.generating.p50)} | ${ms(benchmark.stages.generating.p70)} | ${ms(benchmark.stages.generating.p100)} |
| Guardrail verification | ${ms(benchmark.stages.guardrailVerification.p50)} | ${ms(benchmark.stages.guardrailVerification.p70)} | ${ms(benchmark.stages.guardrailVerification.p100)} |
| Sarvam transcription (separate ${transcription.completedObservations}-observation voice measurement) | ${ms(transcription.stage.p50)} | ${ms(transcription.stage.p70)} | ${ms(transcription.stage.p100)} |

> The 50-query RAG benchmark is text-only. Transcription percentiles come from a separate ${transcription.completedObservations}-observation live Sarvam measurement that cycles the ten recorded multilingual fixtures five times; no generated answer data is included in that stage-only measurement.

Generation is the clear bottleneck: its P50 alone is ${ms(benchmark.stages.generating.p50)}. The RAG-core P50 misses the 200 ms target by ${(benchmark.ragCore.p50 - 200).toLocaleString()} ms; the P70 and P100 miss by ${(benchmark.ragCore.p70 - 200).toLocaleString()} ms and ${(benchmark.ragCore.p100 - 200).toLocaleString()} ms, respectively. No latency value in this report is hardcoded or simulated.

### Post-fix rerun disclosure

After the combined benchmark was completed, a fresh standalone 50-query rerun was attempted to validate later resilience changes. It produced 40 clean observations before the authenticated Groq account reported its live token ceiling. A final recovery probe still reported a further 36-minute provider wait. The exact provider messages and partial sample stream are preserved in **validation-artifacts/benchmark-50-postfix-provider-cap.console.log**. A second live-listed model was also probed, but its benchmark emitted recurrent malformed structured output and was not retained as the production default. The reported 50-observation percentiles therefore remain the completed combined artifact, while the raw later attempts are retained rather than concealed.

## 2. Ten live voice runs

Each fixture was a generated WAV submitted to the same server path used by browser voice capture. The retrieved-passage column gives the first two source IDs and their real cosine similarities; full passages, all seven candidates, exact citations, and complete traces are preserved in **validation-artifacts/voice-10.json**.

| Run · intent | Live transcript | Top retrieved passages (similarity) | Generated answer | Guardrail / citation outcome | Total |
|---|---|---|---|---|---:|
${voiceRows}

### Voice stage timings

| Run | Transcribe | Embed | Retrieve | Generate | Verify |
|---|---:|---:|---:|---:|---:|
${voiceStageRows}

The two required outside-corpus cases both withheld an answer. The weather request was refused because the retrieved evidence contained no Goa weather information. The original World Cup fixture also withheld an answer but its generated speech included a spoken style instruction; a clean rerun transcribed exactly **“${esc(cleanOffTopic.transcript)}”** and was refused with **“${esc(cleanOffTopic.refusalReason)}”** in ${ms(cleanOffTopic.totalMs)}. The borderline low-potassium-chart run withheld an answer despite a strong top similarity (87.9%) because the retrieved passage only named a list and did not substantiate the requested chart; this is a conservative grounding decision, not an unsupported answer.

## 3. Edge-case stress results

| Case | Initial observed result | Actual behavior |
|---|---|---|
${edgeRows}

The long fixture was **97.64 seconds** and **4.5 MB**. Sarvam’s synchronous REST endpoint documents a maximum duration of 30 seconds; it recommends splitting audio or using a batch endpoint for longer input. The application now automatically stops browser microphone capture at 25 seconds, prevents UI-originated captures from exceeding that contract, and displays why recording stopped. The direct stress harness intentionally bypassed this UI safeguard and therefore continued to receive the provider rejection.

| Focused rapid-request rerun after model fix | Result | Actual behavior |
|---|---|---|
${rapidRows}

The original simultaneous runs exposed that **llama-3.1-8b-instant** was no longer present in the authenticated Groq model catalog. The application now defaults to **groq/compound-mini**, which was verified using the live model-list endpoint and a full RAG probe before the rapid rerun.

## 4. Live UI and codebase audit

The restarted UI was verified in a browser with the source-derived Hindi query **“कॉर्पोरेशन क्या है?”**. It displayed a live grounded answer, two exact citations, seven retrieved candidates, and top similarities of 84.3%, 82.0%, and 80.7%. The Index state panel displayed **“Persisted HNSW index loaded”**, 51 chunks, all four validation source files, and **gemini-embedding-001**. Its telemetry panel updated from empty state to P50/P70/P100 = 3,162 ms from the fresh visible run. This confirms that Index state, latency telemetry, and evidence are populated from runtime backend results rather than placeholder data.

The full codebase audit command returned no matches for the retired local-embedding provider, model, environment variable, or tunnel-provider identifiers in **server**, **client**, **scripts**, **docs**, or **package.json**.

## 5. Fixes made during validation

| Finding | Fix | Verification |
|---|---|---|
| Oversized Groq prompts and free-tier TPM pressure | Reduced generation context to two evidence passages × 350 characters and bounded output budget while retaining source IDs and post-generation verification. | All four original failed benchmark queries completed after the final adjustment. |
| Transient Groq generation timeout | Raised the generation request timeout from 15 to 35 seconds. | Targeted failed queries completed successfully. |
| Multilingual structured JSON failure / truncation | Added a strict JSON fallback request and resilient JSON-object extraction; retained schema validation. | Tamil and Telugu failure reruns returned grounded answers. |
| Retired Groq default model | Replaced **llama-3.1-8b-instant** with live-listed **groq/compound-mini** and strengthened the live model-access test. | Full RAG probe and two simultaneous voice requests succeeded. |
| Long UI microphone capture violated Sarvam sync limit | Added a 25-second automatic recording cap and explicit user message; increased Sarvam timeout for legitimate shorter captures. | TypeScript check and full deterministic suite pass; documented direct 97.64-second provider rejection remains reproducible. |

## Reproducibility artifacts

| Artifact | Contents |
|---|---|
| **validation-artifacts/benchmark-50.json** | First 50-query pass, including four raw failure observations. |
| **validation-artifacts/benchmark-failure-rerun.json** | Exact reruns of the four failed source queries after fixes. |
| **validation-artifacts/benchmark-50-combined.json** | Transparent 50-completion benchmark aggregate and percentile calculations. |
| **validation-artifacts/voice-10.json** | Complete ten-run voice evidence: transcripts, passages, similarities, answers/refusals, citations, and traces. |
| **validation-artifacts/edge-cases.json** | Initial silent, long, malformed, and simultaneous-input outcomes. |
| **validation-artifacts/rapid-edge-rerun.json** | Two simultaneous voice successes after the Groq model correction. |
| **validation-artifacts/voice-offtopic-clean.json** | Clean World Cup off-topic transcription and grounded refusal. |

## References

[1] [Sarvam Speech-to-Text REST API — duration, format, and error limits](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api)
`;

await writeFile("docs/live-validation-report.md", report);
