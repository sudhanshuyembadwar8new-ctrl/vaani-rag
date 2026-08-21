import { readFileSync } from "node:fs";

const m = JSON.parse(readFileSync("manifest.json", "utf8"));
console.log(`Total chunks in manifest.json: ${m.chunks.length}`);
for (const c of m.chunks) {
  const words = c.content.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;
  if (ratio < 0.5 || words.length > 200) {
    console.log(`[${c.id}] lang=${c.metadata.language} row=${c.metadata.row} field=${c.metadata.field} words=${words.length} unique=${uniqueWords.size} ratio=${ratio.toFixed(2)}`);
    console.log("   Preview:", c.content.slice(0, 120) + "...");
  }
}
