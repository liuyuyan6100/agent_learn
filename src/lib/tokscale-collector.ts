import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  aggregateWindow,
  assertTokenUsageDataset,
  isSyntheticModelName,
  type TokenUsageDataset,
  type TokenUsageDay,
  type TokenUsageModel
} from "./token-usage";

interface NormalizeOptions {
  start: string;
  end: string;
  timezone: string;
  generatedAt?: string;
  sourceCommand: string;
}

interface CollectFromOutputsOptions extends NormalizeOptions {
  graphOutput: string;
  aggregateOutput: string;
  outPath: string;
}

type RawRecord = Record<string, unknown>;

export function parseJsonFromTokscaleOutput(output: string): unknown {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    throw new Error("tokscale output is empty");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("tokscale output is not valid JSON");
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
  }
}

export function collectTokenUsageToFileFromOutputs(options: CollectFromOutputsOptions): TokenUsageDataset {
  const graph = parseJsonFromTokscaleOutput(options.graphOutput);
  const aggregate = parseJsonFromTokscaleOutput(options.aggregateOutput);
  const dataset = normalizeTokscaleData(graph, aggregate, options);
  const validDataset = assertTokenUsageDataset(dataset);

  writeJsonAtomically(options.outPath, validDataset);
  return validDataset;
}

export function normalizeTokscaleData(graphInput: unknown, aggregateInput: unknown, options: NormalizeOptions): TokenUsageDataset {
  const graph = asRecord(graphInput);
  const aggregate = asRecord(aggregateInput);
  const daily = normalizeDaily(graph);
  const periodStart = daily[0]?.date ?? options.start;
  const totals = aggregateTotals(daily);
  const models = normalizeModels(aggregate, totals);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    period: {
      start: periodStart,
      end: options.end,
      timezone: options.timezone
    },
    source: {
      tool: "tokscale",
      sourceCommand: options.sourceCommand,
      containsRawPrompts: false,
      containsLocalPaths: false
    },
    privacy: {
      modelNames: "public",
      clientNames: "public_category",
      costDisplay: "hidden",
      redactedFields: [
        "account",
        "email",
        "apiKey",
        "organizationId",
        "rawPrompt",
        "sessionPath",
        "workspacePath",
        "internalProject"
      ]
    },
    totals,
    windows: {
      today: stripActiveDays(aggregateWindow(daily, options.end, 1)),
      last7Days: aggregateWindow(daily, options.end, 7),
      last30Days: aggregateWindow(daily, options.end, 30)
    },
    models,
    daily,
    milestones: []
  };
}

function normalizeDaily(graph: RawRecord): TokenUsageDay[] {
  const contributions = Array.isArray(graph.contributions) ? graph.contributions : [];

  return contributions
    .map((contribution) => {
      const record = asRecord(contribution);
      const tokenBreakdown = asRecord(record.tokenBreakdown ?? record.totals ?? record);
      const totals = asRecord(record.totals ?? {});
      const inputTokens = pickNumber(tokenBreakdown, ["inputTokens", "input", "totalInput"]);
      const outputTokens = pickNumber(tokenBreakdown, ["outputTokens", "output", "totalOutput"]);
      const cacheReadTokens = pickNumber(tokenBreakdown, ["cacheReadTokens", "cacheRead", "totalCacheRead"]);
      const cacheWriteTokens = pickNumber(tokenBreakdown, ["cacheWriteTokens", "cacheWrite", "totalCacheWrite"]);
      const reasoningTokens = pickNumber(tokenBreakdown, ["reasoningTokens", "reasoning", "totalReasoning"]);
      const directTokens = inputTokens + outputTokens + reasoningTokens;
      const cacheTokens = cacheReadTokens + cacheWriteTokens;

      return {
        date: String(record.date ?? ""),
        totalTokens: directTokens + cacheTokens,
        directTokens,
        cacheTokens,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        reasoningTokens,
        messageCount: pickNumber(totals, ["messageCount", "messages", "totalMessages"]),
        activeTimeMs: typeof record.activeTimeMs === "number" ? record.activeTimeMs : null,
        intensity: pickNumber(record, ["intensity"]),
        breakdown: normalizeDailyBreakdown(record)
      };
    })
    .filter((day) => day.date.length > 0)
    .filter((day) => day.totalTokens > 0 || day.messageCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeDailyBreakdown(record: RawRecord): TokenUsageDay["breakdown"] {
  const clients = record.clients;
  if (!clients) {
    return [];
  }

  const entries = Array.isArray(clients)
    ? clients
    : Object.entries(asRecord(clients)).map(([client, value]) => ({ client, ...(asRecord(value) as RawRecord) }));

  return entries
    .map((entry) => {
      const item = asRecord(entry);
      const tokens = asRecord(item.tokens ?? item);
      const inputTokens = pickNumber(tokens, ["inputTokens", "input", "totalInput"]);
      const outputTokens = pickNumber(tokens, ["outputTokens", "output", "totalOutput"]);
      const cacheReadTokens = pickNumber(tokens, ["cacheReadTokens", "cacheRead", "totalCacheRead"]);
      const cacheWriteTokens = pickNumber(tokens, ["cacheWriteTokens", "cacheWrite", "totalCacheWrite"]);
      const reasoningTokens = pickNumber(tokens, ["reasoningTokens", "reasoning", "totalReasoning"]);
      const directTokens = inputTokens + outputTokens + reasoningTokens;
      const modelName = String(item.model ?? item.modelId ?? "unknown");

      return {
        clientCategory: mapClientCategory(String(item.client ?? item.name ?? "unknown")),
        modelName,
        modelProvider: String(item.provider ?? item.providerId ?? "unknown"),
        modelCategory: mapModelCategory(modelName),
        totalTokens: directTokens + cacheReadTokens + cacheWriteTokens,
        directTokens,
        messageCount: pickNumber(item, ["messageCount", "messages", "totalMessages"])
      };
    })
    .filter((item) => !isSyntheticModelName(item.modelName));
}

function normalizeModels(aggregate: RawRecord, totals: TokenUsageDataset["totals"]): TokenUsageModel[] {
  const entries = Array.isArray(aggregate.entries) ? aggregate.entries : [];
  const grouped = new Map<string, TokenUsageModel>();

  for (const entry of entries) {
    const item = asRecord(entry);
    const modelName = String(item.model ?? item.modelId ?? "unknown");
    const modelProvider = String(item.provider ?? "unknown");
    const inputTokens = pickNumber(item, ["inputTokens", "input", "totalInput"]);
    const outputTokens = pickNumber(item, ["outputTokens", "output", "totalOutput"]);
    const cacheReadTokens = pickNumber(item, ["cacheReadTokens", "cacheRead", "totalCacheRead"]);
    const cacheWriteTokens = pickNumber(item, ["cacheWriteTokens", "cacheWrite", "totalCacheWrite"]);
    const reasoningTokens = pickNumber(item, ["reasoningTokens", "reasoning", "totalReasoning"]);
    const directTokens = inputTokens + outputTokens + reasoningTokens;
    const totalTokens = directTokens + cacheReadTokens + cacheWriteTokens;
    if (isSyntheticModelName(modelName)) {
      continue;
    }

    const key = `${modelProvider}:${modelName}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.totalTokens += totalTokens;
      existing.directTokens += directTokens;
      existing.messageCount += pickNumber(item, ["messageCount", "messages", "totalMessages"]);
      continue;
    }

    grouped.set(key, {
      modelName,
      modelProvider,
      modelCategory: mapModelCategory(modelName),
      totalTokens,
      directTokens,
      messageCount: pickNumber(item, ["messageCount", "messages", "totalMessages"])
    });
  }

  const models = [...grouped.values()].filter((model) => model.totalTokens > 0 || model.messageCount > 0);
  if (models.length === 0 && totals.totalTokens > 0) {
    throw new Error("tokscale aggregate output must include entries[] with public model names");
  }
  return models.sort((a, b) => b.totalTokens - a.totalTokens);
}

function aggregateTotals(daily: TokenUsageDay[]): TokenUsageDataset["totals"] {
  return {
    totalTokens: sum(daily, "totalTokens"),
    directTokens: sum(daily, "directTokens"),
    cacheTokens: sum(daily, "cacheTokens"),
    inputTokens: sum(daily, "inputTokens"),
    outputTokens: sum(daily, "outputTokens"),
    cacheReadTokens: sum(daily, "cacheReadTokens"),
    cacheWriteTokens: sum(daily, "cacheWriteTokens"),
    reasoningTokens: sum(daily, "reasoningTokens"),
    messageCount: sum(daily, "messageCount"),
    activeDays: daily.filter((day) => day.totalTokens > 0 || day.messageCount > 0).length,
    totalDays: daily.length,
    totalCostUsd: null
  };
}

function writeJsonAtomically(outPath: string, dataset: TokenUsageDataset): void {
  mkdirSync(dirname(outPath), { recursive: true });
  const previous = exists(outPath) ? readFileSync(outPath, "utf8") : null;
  const temporaryPath = `${outPath}.tmp`;

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(dataset, null, 2)}\n`);
    renameSync(temporaryPath, outPath);
  } catch (error) {
    if (previous !== null) {
      writeFileSync(outPath, previous);
    }
    throw error;
  }
}

function stripActiveDays(windowValue: ReturnType<typeof aggregateWindow>) {
  return {
    totalTokens: windowValue.totalTokens,
    directTokens: windowValue.directTokens,
    messageCount: windowValue.messageCount
  };
}

function mapClientCategory(client: string): string {
  const lower = client.toLowerCase();
  if (lower.includes("codex") || lower.includes("cursor") || lower.includes("claude")) {
    return "coding_agent";
  }
  if (lower.includes("cli") || lower.includes("terminal")) {
    return "assistant_cli";
  }
  return "other_agent_tool";
}

function mapModelCategory(modelName: string): string {
  const lower = modelName.toLowerCase();
  if (lower.includes("gpt-5") || lower.includes("o3") || lower.includes("o4")) {
    return "frontier_reasoning";
  }
  if (lower.includes("claude") || lower.includes("sonnet")) {
    return "frontier_coding";
  }
  if (lower.includes("gemini")) {
    return "general_llm";
  }
  return "unknown";
}

function pickNumber(record: RawRecord, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function asRecord(value: unknown): RawRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as RawRecord;
}

function sum<T>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => {
    const value = item[key];
    return typeof value === "number" ? total + value : total;
  }, 0);
}

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
