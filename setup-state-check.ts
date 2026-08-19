import { getSystemHealth, runTextQuery } from "../server/rag/service";

const originalGeminiKey = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
const health = await getSystemHealth();
let errorMessage = "";
try {
  await runTextQuery("What is an Association?");
} catch (error) {
  errorMessage = error instanceof Error ? error.message : String(error);
}
if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;

console.log(JSON.stringify({
  geminiStatus: health.gemini,
  indexReady: health.index.ready,
  errorMessage,
}, null, 2));
if (health.gemini !== "missing" || !errorMessage.includes("Gemini Embedding API")) {
  throw new Error("Missing Gemini setup state was not surfaced honestly.");
}
