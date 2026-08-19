export type PipelineStageName = "transcribing" | "embedding" | "retrieving" | "generating" | "verifying" | "answered";
export type StageStatus = "pending" | "running" | "complete" | "refused" | "error";

export type StageTrace = {
  name: PipelineStageName;
  status: StageStatus;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  retries: number;
  detail?: string;
};

export type LatencyRecord = {
  id: string;
  outcome: "answered" | "refused";
  totalMs: number;
  createdAt: number;
  stages: StageTrace[];
};

const stageNames: PipelineStageName[] = ["transcribing", "embedding", "retrieving", "generating", "verifying", "answered"];

export class PipelineTrace {
  readonly id = crypto.randomUUID();
  readonly startedAt = Date.now();
  private readonly traces = new Map<PipelineStageName, StageTrace>(
    stageNames.map(name => [name, { name, status: "pending", startedAt: null, completedAt: null, durationMs: null, retries: 0 }]),
  );

  start(name: PipelineStageName) {
    const stage = this.traces.get(name)!;
    stage.status = "running";
    stage.startedAt = Date.now();
  }

  complete(name: PipelineStageName, detail?: string, retries = 0) {
    const stage = this.traces.get(name)!;
    const completedAt = Date.now();
    stage.status = "complete";
    stage.completedAt = completedAt;
    stage.durationMs = stage.startedAt ? completedAt - stage.startedAt : 0;
    stage.retries = retries;
    stage.detail = detail;
  }

  refuse(name: PipelineStageName, detail: string) {
    const stage = this.traces.get(name)!;
    const completedAt = Date.now();
    stage.status = "refused";
    stage.completedAt = completedAt;
    stage.durationMs = stage.startedAt ? completedAt - stage.startedAt : 0;
    stage.detail = detail;
  }

  fail(name: PipelineStageName, detail: string, retries = 0) {
    const stage = this.traces.get(name)!;
    const completedAt = Date.now();
    stage.status = "error";
    stage.completedAt = completedAt;
    stage.durationMs = stage.startedAt ? completedAt - stage.startedAt : 0;
    stage.retries = retries;
    stage.detail = detail;
  }

  snapshot() {
    return stageNames.map(name => this.traces.get(name)!);
  }

  totalMs() {
    return Date.now() - this.startedAt;
  }
}

const nearestRank = (values: number[], percentile: number) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil((percentile / 100) * ordered.length) - 1))] ?? null;
};

export class LatencyRegistry {
  private samples: LatencyRecord[] = [];
  constructor(private readonly maximumSamples = 250) {}

  record(record: LatencyRecord) {
    this.samples = [record, ...this.samples].slice(0, this.maximumSamples);
  }

  metrics() {
    const totals = this.samples.map(sample => sample.totalMs);
    return {
      sampleCount: totals.length,
      p50: nearestRank(totals, 50),
      p70: nearestRank(totals, 70),
      p100: nearestRank(totals, 100),
      latest: this.samples[0] ?? null,
      updatedAt: this.samples[0]?.createdAt ?? null,
    };
  }
}

export const latencyRegistry = new LatencyRegistry();
