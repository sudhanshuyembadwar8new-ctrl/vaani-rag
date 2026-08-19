import { chromium } from "playwright";

const url = process.env.VAANI_PREVIEW_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.getByText("System armed").waitFor({ state: "visible", timeout: 20_000 });

const voiceButton = page.getByRole("button", { name: /Ask Vaani with your voice/i });
await voiceButton.focus();
if (await page.evaluate(() => document.activeElement?.textContent?.includes("Ask Vaani") !== true)) throw new Error("Voice action did not receive keyboard focus.");
await page.keyboard.press("Space");
const stopVoiceButton = page.getByRole("button", { name: /Stop & send voice/i });
await stopVoiceButton.waitFor({ state: "visible", timeout: 10_000 });
await stopVoiceButton.focus();
await page.keyboard.press("Space");
await page.getByRole("button", { name: /Ask Vaani with your voice/i }).waitFor({ state: "visible", timeout: 10_000 });

const textarea = page.locator("textarea");
await textarea.focus();
await textarea.fill("What is an Association?");
const submit = page.getByRole("button", { name: "Run query" });
await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.hasAttribute("disabled"), null, { timeout: 20_000 });
await submit.focus();
if (!(await submit.evaluate(element => element === document.activeElement))) throw new Error("Text submit did not receive keyboard focus.");
await page.keyboard.press("Enter");
const disclosure = page.locator("details").first();
await disclosure.waitFor({ state: "visible", timeout: 30_000 });

await page.mouse.click(2, 2);
const seen = {};
for (let index = 1; index <= 80; index += 1) {
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => {
    const element = document.activeElement;
    return element ? { tag: element.tagName, text: (element.textContent || "").trim().slice(0, 80), type: element.getAttribute("type") || "" } : null;
  });
  const label = active?.tag === "TEXTAREA" ? "textarea" : active?.tag === "SUMMARY" ? "summary" : active?.text?.includes("Run query") ? "submit" : active?.text?.includes("Run benchmark") ? "benchmark" : active?.text?.includes("Ask Vaani") ? "voice" : null;
  if (label && !seen[label]) seen[label] = index;
  if (seen.voice && seen.textarea && seen.submit && seen.summary && seen.benchmark) break;
}
for (const label of ["voice", "textarea", "submit", "summary", "benchmark"]) if (!seen[label]) throw new Error(`Tab traversal did not reach ${label}.`);

const summary = disclosure.locator("summary");
await summary.focus();
await summary.press("Space");
if (!(await disclosure.evaluate(element => element.open))) await summary.press("Enter");
if (!(await disclosure.evaluate(element => element.open))) throw new Error("Evidence disclosure did not open with Space or Enter.");
await summary.press("Space");

const benchmark = page.getByRole("button", { name: /Run benchmark/i });
const reverseSeen = {};
await benchmark.focus();
for (let index = 1; index <= 12; index += 1) {
  await page.keyboard.press("Shift+Tab");
  const active = await page.evaluate(() => {
    const element = document.activeElement;
    return element ? { tag: element.tagName, text: (element.textContent || "").trim().slice(0, 80) } : null;
  });
  const label = active?.tag === "TEXTAREA" ? "textarea" : active?.tag === "SUMMARY" ? "summary" : active?.text?.includes("Run query") ? "submit" : active?.text?.includes("Ask Vaani") ? "voice" : null;
  if (label && !reverseSeen[label]) reverseSeen[label] = index;
  if (reverseSeen.voice && reverseSeen.textarea && reverseSeen.submit && reverseSeen.summary) break;
}
for (const label of ["voice", "textarea", "submit", "summary"]) if (!reverseSeen[label]) throw new Error(`Shift+Tab traversal did not reach ${label}.`);

let benchmarkTriggered = false;
await page.route("**/api/trpc/**", async route => {
  const requestText = `${route.request().url()} ${route.request().postData() || ""}`;
  if (requestText.includes("benchmark")) {
    benchmarkTriggered = true;
    await route.abort();
    return;
  }
  await route.continue();
});
await benchmark.focus();
await benchmark.press("Enter");
await page.waitForTimeout(500);
if (!benchmarkTriggered) throw new Error("Enter did not activate the benchmark request.");
benchmarkTriggered = false;
await benchmark.focus();
await benchmark.press("Space");
await page.waitForTimeout(500);
if (!benchmarkTriggered) throw new Error("Space did not activate the benchmark request.");
console.log(JSON.stringify({ tabOrder: seen, reverseTabOrder: reverseSeen, voiceSpace: true, formEnter: true, disclosureSpaceEnter: true, benchmarkEnter: true, benchmarkSpace: true }));
await browser.close();
