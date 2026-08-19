import { embedWithGemini } from "../server/rag/clients";

const question = process.argv.slice(2).join(" ");
if (!question) throw new Error("Provide a query to embed.");
try {
  const vector = await embedWithGemini(question);
  console.log(JSON.stringify({ status: "complete", length: vector.length, query: question }));
} catch (error) {
  console.log(JSON.stringify({ status: "error", query: question, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
