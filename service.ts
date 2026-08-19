import { TRPCError } from "@trpc/server";
import { embedWithGemini, generateWithGroq, transcribeWithSarvam, UpstreamServiceError } from "./clients";
import { citationCheck, retrievalCheck, safetyCheck, semanticSupportCheck } from "./guardrails";
import { getBenchmarkQueries, getIndexStatus, retrieve, retrieveByAnswerVector, RetrievalSetupError } from "./indexStore";
import { latencyRegistry, PipelineTrace } from "./telemetry";

type QuerySuccess = {
  outcome: "answered";
  answer: string;
  citations: string[];
  sources: Awaited<ReturnType<typeof retrieve>>;
  transcript?: string;
  stages: ReturnType<PipelineTrace["snapshot"]>;
  totalMs: number;
};

type QueryRefusal = {
  outcome: "refused";
  reason: string;
  sources: Awaited<ReturnType<typeof retrieve>>;
  transcript?: string;
  stages: ReturnType<PipelineTrace["snapshot"]>;
  totalMs: number;
};

export type QueryResult = QuerySuccess | QueryRefusal;

type LiveRun = {
  id: string;
  trace: PipelineTrace;
  status: "running" | "complete" | "error";
  createdAt: number;
  transcript?: string;
  result?: QueryResult;
  error?: string;
};

const liveRuns = new Map<string, LiveRun>();

const retainLiveRuns = () => {
  const expiry = Date.now() - 15 * 60 * 1000;
  Array.from(liveRuns.entries()).forEach(([id, run]) => {
    if (run.createdAt < expiry) liveRuns.delete(id);
  });
};

const serviceError = (error: unknown, fallback: string) => {
  if (error instanceof RetrievalSetupError) {
    return new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
  }
  if (error instanceof UpstreamServiceError) {
    return new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : fallback });
};

const record = (trace: PipelineTrace, outcome: "answered" | "refused") => {
  const totalMs = trace.totalMs();
  latencyRegistry.record({ id: trace.id, outcome, totalMs, createdAt: Date.now(), stages: trace.snapshot() });
  return totalMs;
};

async function answerQuestion(question: string, trace: PipelineTrace, transcript?: string): Promise<QueryResult> {
  const safety = safetyCheck(question);
  if (!safety.allowed) {
    trace.start("verifying");
    trace.refuse("verifying", safety.reason);
    trace.start("answered");
    trace.refuse("answered", "Guardrail refusal recorded.");
    return { outcome: "refused", reason: safety.reason, sources: [], transcript, stages: trace.snapshot(), totalMs: record(trace, "refused") };
  }

  let activeStage: "embedding" | "retrieving" | "generating" | "verifying" = "embedding";
  try {
    trace.start("embedding");
    const embedded = await embedWithGemini(question);
    trace.complete("embedding", "Gemini query vector returned.", embedded.retries);
    activeStage = "retrieving";
    trace.start("retrieving");
    const sources = await retrieve(embedded.value, 7);
    trace.complete("retrieving", `${sources.length} HNSW candidates returned.`, embedded.retries);

    const retrieval = retrievalCheck(sources);
    if (!retrieval.grounded) {
      trace.start("verifying");
      trace.refuse("verifying", retrieval.reason);
      trace.start("answered");
      trace.refuse("answered", "Similarity threshold gate refused the answer.");
      return {
        outcome: "refused",
        reason: retrieval.reason,
        sources,
        transcript,
        stages: trace.snapshot(),
        totalMs: record(trace, "refused"),
      };
    }

    activeStage = "generating";
    trace.start("generating");
    const generated = await generateWithGroq(question, retrieval.chunks.map(source => ({ id: source.id, content: source.content })));
    trace.complete("generating", "Structured, source-cited answer returned.", generated.retries);

    activeStage = "verifying";
    trace.start("verifying");
    const citations = citationCheck(generated.value.citations, retrieval.chunks);
    const answerVector = await embedWithGemini(generated.value.answer);
    const answerMatches = await retrieveByAnswerVector(answerVector.value, 6);
    const verified = generated.value.grounded && citations.valid && semanticSupportCheck(answerMatches, citations.citations);
    if (!verified) {
      const reason = generated.value.refusalReason || "The generated response could not be verified against its retrieved evidence.";
      trace.refuse("verifying", reason);
      trace.start("answered");
      trace.refuse("answered", "Post-generation groundedness gate refused the answer.");
      return { outcome: "refused", reason, sources, transcript, stages: trace.snapshot(), totalMs: record(trace, "refused") };
    }
    trace.complete("verifying", "Citations and semantic support verified.", answerVector.retries);
    trace.start("answered");
    trace.complete("answered", "Grounded answer released.");
    return {
      outcome: "answered",
      answer: generated.value.answer,
      citations: citations.citations,
      sources,
      transcript,
      stages: trace.snapshot(),
      totalMs: record(trace, "answered"),
    };
  } catch (error) {
    const retries = error instanceof UpstreamServiceError ? error.retries : 0;
    trace.fail(activeStage, error instanceof Error ? error.message : "The current pipeline stage failed.", retries);
    throw serviceError(error, "The RAG pipeline could not complete.");
  }
}

export async function runTextQuery(question: string) {
  return answerQuestion(question.trim(), new PipelineTrace());
}

async function executeVoiceQuery(
  input: { audioBase64: string; mimeType: string; languageCode: string },
  trace: PipelineTrace,
  onTranscript?: (transcript: string) => void,
) {
  try {
    const audio = Buffer.from(input.audioBase64, "base64");
    if (!audio.length || audio.length > 8 * 1024 * 1024) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Audio capture must be between 1 byte and 8 MB." });
    }
    trace.start("transcribing");
    const transcription = await transcribeWithSarvam({ audio, mimeType: input.mimeType, languageCode: input.languageCode });
    trace.complete("transcribing", transcription.value.languageCode ? `Detected ${transcription.value.languageCode}.` : "Transcript received.", transcription.retries);
    onTranscript?.(transcription.value.transcript);
    return answerQuestion(transcription.value.transcript, trace, transcription.value.transcript);
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    trace.fail("transcribing", error instanceof Error ? error.message : "Transcription failed.", error instanceof UpstreamServiceError ? error.retries : 0);
    throw serviceError(error, "The voice query could not be transcribed.");
  }
}

export async function runVoiceQuery(input: { audioBase64: string; mimeType: string; languageCode: string }) {
  return executeVoiceQuery(input, new PipelineTrace());
}

export async function getSystemHealth() {
  const index = await getIndexStatus();
  return {
    sarvam: process.env.SARVAM_API_KEY ? "configured-unverified" : "missing",
    groq: process.env.GROQ_API_KEY ? "configured-unverified" : "missing",
    gemini: process.env.GEMINI_API_KEY ? "configured-unverified" : "missing",
    index,
  } as const;
}

function startRun(executor: (run: LiveRun) => Promise<QueryResult>) {
  retainLiveRuns();
  const trace = new PipelineTrace();
  const run: LiveRun = { id: trace.id, trace, status: "running", createdAt: Date.now() };
  liveRuns.set(run.id, run);
  void executor(run)
    .then(result => {
      run.result = result;
      run.status = "complete";
    })
    .catch(error => {
      run.status = "error";
      run.error = error instanceof Error ? error.message : "The pipeline stopped unexpectedly.";
    });
  return { runId: run.id };
}

export function startTextRun(question: string) {
  return startRun(run => answerQuestion(question.trim(), run.trace));
}

export function startVoiceRun(input: { audioBase64: string; mimeType: string; languageCode: string }) {
  return startRun(run => executeVoiceQuery(input, run.trace, transcript => { run.transcript = transcript; }));
}

export function getRunStatus(runId: string) {
  const run = liveRuns.get(runId);
  if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "This pipeline run is no longer available. Start a new question." });
  return {
    id: run.id,
    status: run.status,
    transcript: run.transcript,
    stages: run.trace.snapshot(),
    currentMs: run.trace.totalMs(),
    result: run.result,
    error: run.error,
  };
}

export async function runBenchmark() {
  const queries = [
    "What is an Association?",
    "What are the types of business structures?",
    "How do you start a business?",
    "How do you update an existing business?",
    "What examples of companies are described?",
  ];
  const outcomes: Array<{ outcome: QueryResult["outcome"]; totalMs: number }> = [];
  for (let index = 0; index < queries.length; index += 1) {
    if (index > 0) await new Promise(resolve => setTimeout(resolve, 15_000));
    const result = await runTextQuery(queries[index]);
    outcomes.push({ outcome: result.outcome, totalMs: result.totalMs });
  }
  return { attempted: queries.length, distinctQueries: queries.length, outcomes, metrics: latencyRegistry.metrics() };
}
