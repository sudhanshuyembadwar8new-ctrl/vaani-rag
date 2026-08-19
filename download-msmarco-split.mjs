import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const relativeFile = process.argv[2] || "validation/hinval.parquet";
const output = resolve(process.argv[3] || `.rag-source/${relativeFile.replace("/", "-")}`);
const url = `https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/${relativeFile}?download=true`;

if (!existsSync(dirname(output))) mkdirSync(dirname(output), { recursive: true });
console.log(`Downloading ${relativeFile} from the supplied ai4bharat/MSMARCO-XI dataset…`);
const response = await fetch(url);
if (!response.ok || !response.body) throw new Error(`Dataset download failed (${response.status}).`);
await pipeline(Readable.fromWeb(response.body), createWriteStream(output));
console.log(`Saved corpus split to ${output}`);
