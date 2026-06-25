import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertTokenUsageDataset, type TokenUsageDataset } from "./token-usage";

const DEFAULT_TOKEN_USAGE_DATA_PATH = "data/token-usage.json";

export function getTokenUsageDataPath(): string {
  return process.env.AGENT_LEARN_TOKEN_USAGE_PATH ?? resolve(process.cwd(), DEFAULT_TOKEN_USAGE_DATA_PATH);
}

export async function readTokenUsageDataset(filePath = getTokenUsageDataPath()): Promise<TokenUsageDataset> {
  const rawData = await readFile(filePath, "utf8");
  return assertTokenUsageDataset(JSON.parse(rawData));
}
