import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const cleanPassage = "Worldwide, population is seven billion. Projections are that population in the United States will reach 400 million by 2050 – a 33 percent increase in roughly 40 years’ time; the U.S. registered its 300 millionth resident in 2006. With an increase in world population has come an increase in air pollution.";

let fixedCount = 0;
for (const chunk of manifest.chunks) {
  if (chunk.id === "hi-IN:validation:12:validation:0") {
    chunk.content = `Question: प्रदूषण के कारण मानव आबादी कैसे बढ़ती है Evidence: ${cleanPassage}`;
    chunk.metadata.field = "passages.English_passages[0]";
    fixedCount++;
  } else if (chunk.id === "mr-IN:validation:12:validation:0") {
    chunk.content = `Question: प्रदूषणामुळे मानवी लोकसंख्या कशी वाढते Evidence: ${cleanPassage}`;
    chunk.metadata.field = "passages.English_passages[0]";
    fixedCount++;
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Updated manifest.json: fixed ${fixedCount} corrupted entries.`);
