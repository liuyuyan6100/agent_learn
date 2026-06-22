import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertTokenUsageDataset } from "../src/lib/token-usage";

const file = resolve(process.cwd(), "data/token-usage.json");
const dataset = JSON.parse(readFileSync(file, "utf8")) as unknown;

assertTokenUsageDataset(dataset);
console.log(`Validated public token usage dataset: ${file}`);
