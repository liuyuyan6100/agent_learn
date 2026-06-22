import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertAgentSignalsDataset } from "../src/lib/agent-signals";

const file = resolve(process.cwd(), "data/agent-signals.json");
const dataset = JSON.parse(readFileSync(file, "utf8")) as unknown;

assertAgentSignalsDataset(dataset);
console.log(`Validated public agent signals dataset: ${file}`);
