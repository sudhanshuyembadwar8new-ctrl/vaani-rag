import { getBenchmarkQueries } from "../server/rag/indexStore";
import { runTextQuery } from "../server/rag/service";

const [question] = await getBenchmarkQueries(1);
if (!question) throw new Error("No indexed source query is available for the Groq context regression check.");
const result = await runTextQuery(question);
console.log(JSON.stringify({
  question,
  outcome: result.outcome,
  totalMs: result.totalMs,
  stages: result.stages,
  sourceCount: result.sources.length,
  answer: result.outcome === "answered" ? result.answer : undefined,
  reason: result.outcome === "refused" ? result.reason : undefined,
}, null, 2));
if (result.outcome !== "answered") throw new Error("The compacted Groq context regression query did not return a grounded answer.");
