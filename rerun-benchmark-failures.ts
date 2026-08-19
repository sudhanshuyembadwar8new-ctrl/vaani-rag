import { writeFile } from "node:fs/promises";
import { runTextQuery } from "../server/rag/service";

const questions = [
  "वॉव पर अनुयायियों को कैसे इकट्ठा किया जाए, इसका मार्गदर्शक",
  "ஏன் ரேச்சல் கார்சன் ஒரு கடமையை நிறைவேற்ற வேண்டும் என்று எழுதினார்",
  "மாசுபாடு மனித மக்கள்தொகையை எப்படி அதிகரிக்கிறது",
  "రాచెల్ కార్సన్ ఎందుకు సహించాల్సిన బాధ్యతను వ్రాశారు",
];

const results = [];
for (const [index, question] of questions.entries()) {
  if (index > 0) await new Promise(resolve => setTimeout(resolve, 65_000));
  try {
    const result = await runTextQuery(question);
    results.push({
      question,
      outcome: result.outcome,
      totalMs: result.totalMs,
      ragCoreMs: result.stages.filter(stage => ["embedding", "retrieving", "generating", "verifying"].includes(stage.name)).reduce((sum, stage) => sum + (stage.durationMs ?? 0), 0),
      answer: result.outcome === "answered" ? result.answer : null,
      reason: result.outcome === "refused" ? result.reason : null,
      sourceCount: result.sources.length,
      stages: result.stages,
    });
    console.log(`${result.outcome} total=${result.totalMs}ms ${question}`);
  } catch (error) {
    results.push({ question, outcome: "error", error: error instanceof Error ? error.message : String(error) });
    console.log(`error ${question}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await writeFile("docs/validation-artifacts/benchmark-failure-rerun.json", JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
if (results.some(result => result.outcome === "error")) process.exitCode = 1;
