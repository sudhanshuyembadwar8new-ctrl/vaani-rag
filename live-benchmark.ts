import { runBenchmark } from "../server/rag/service";

const result = await runBenchmark();
console.log(JSON.stringify(result, null, 2));
if (result.sampleCount < 5) throw new Error("Benchmark did not produce the required minimum of five observed samples.");
