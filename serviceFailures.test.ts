import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./clients", () => {
  class UpstreamServiceError extends Error {
    constructor(message: string, readonly retries = 0) {
      super(message);
      this.name = "UpstreamServiceError";
    }
  }
  return {
    UpstreamServiceError,
    embedWithGemini: vi.fn(),
    generateWithGroq: vi.fn(),
    transcribeWithSarvam: vi.fn(),
  };
});

vi.mock("./indexStore", () => {
  class RetrievalSetupError extends Error {}
  return {
    RetrievalSetupError,
    getBenchmarkQueries: vi.fn(),
    getIndexStatus: vi.fn(),
    retrieve: vi.fn(),
    retrieveByAnswerVector: vi.fn(),
  };
});

import { embedWithGemini, generateWithGroq, transcribeWithSarvam, UpstreamServiceError } from "./clients";
import { retrieve } from "./indexStore";
import { getRunStatus, startTextRun, startVoiceRun } from "./service";

const waitForRun = async (runId: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const result = getRunStatus(runId);
    if (result.status !== "running") return result;
  }
  throw new Error("Timed out waiting for test run.");
};

const source = (id: string) => ({
  id,
  label: 0,
  content: "Evidence for a grounded answer.",
  strategy: "semantic" as const,
  metadata: { language: "en-IN", split: "validation", sourceFile: "test.parquet", row: 1, field: "passage" },
  similarity: 0.92,
});

describe("RAG orchestration failures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("surfaces a failed Sarvam call at the transcribing stage", async () => {
    vi.mocked(transcribeWithSarvam).mockRejectedValue(new UpstreamServiceError("Sarvam unavailable", 1));
    const { runId } = startVoiceRun({ audioBase64: "dGVzdA==", mimeType: "audio/webm", languageCode: "en-IN" });
    const run = await waitForRun(runId);

    expect(run.status).toBe("error");
    expect(run.stages.find(stage => stage.name === "transcribing")).toMatchObject({ status: "error", retries: 1 });
  });

  it("surfaces an embedding failure at the embedding stage", async () => {
    vi.mocked(embedWithGemini).mockRejectedValue(new UpstreamServiceError("Gemini Embedding unavailable", 1));
    const { runId } = startTextRun("What does this benchmark contain?");
    const run = await waitForRun(runId);

    expect(run.status).toBe("error");
    expect(run.stages.find(stage => stage.name === "embedding")).toMatchObject({ status: "error", retries: 1 });
  });

  it("surfaces a generation failure at the generating stage after grounded retrieval", async () => {
    vi.mocked(embedWithGemini).mockResolvedValue({ value: [0.4, 0.2, 0.1], retries: 0 });
    vi.mocked(retrieve).mockResolvedValue([source("evidence-1"), source("evidence-2")]);
    vi.mocked(generateWithGroq).mockRejectedValue(new UpstreamServiceError("Groq temporarily unavailable", 1));
    const { runId } = startTextRun("What does this benchmark contain?");
    const run = await waitForRun(runId);

    expect(run.status).toBe("error");
    expect(run.stages.find(stage => stage.name === "generating")).toMatchObject({ status: "error", retries: 1 });
  });
});
