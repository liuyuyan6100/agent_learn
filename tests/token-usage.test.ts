import { readFileSync } from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateWindow,
  assertTokenUsageDataset,
  findSensitiveLeaks,
  isDatasetStale,
  isSyntheticModelName,
  type TokenUsageDataset
} from "../src/lib/token-usage";
import { collectTokenUsageToFileFromOutputs, normalizeTokscaleData } from "../src/lib/tokscale-collector";

const dataset = readDataset();

test("TUD-001 validates the public token usage dataset", () => {
  assert.doesNotThrow(() => assertTokenUsageDataset(dataset));
});

test("TUD-002 rejects models without public modelName", () => {
  const invalid = clone(dataset);
  delete (invalid.models[0] as Partial<(typeof invalid.models)[number]>).modelName;
  assert.throws(() => assertTokenUsageDataset(invalid), /modelName/);
});

test("TUD-003 requires privacy.modelNames to be public", () => {
  const invalid = clone(dataset);
  invalid.privacy.modelNames = "category" as TokenUsageDataset["privacy"]["modelNames"];
  assert.throws(() => assertTokenUsageDataset(invalid), /privacy\.modelNames/);
});

test("TUD-004 rejects raw prompts, API keys, emails and path-like public values", () => {
  const invalid = clone(dataset) as TokenUsageDataset & { rawPrompt?: string };
  invalid.rawPrompt = "summarize a private prompt";
  assert.throws(() => assertTokenUsageDataset(invalid), /Sensitive public data leak/);

  const leaks = findSensitiveLeaks({
    publicNote: "contact me at person@example.com",
    privacy: { redactedFields: ["email", "apiKey", "rawPrompt"] }
  });
  assert.deepEqual(leaks, ["publicNote"]);
});

test("TUD-005 rejects clientCategory values that look like local paths", () => {
  const invalid = clone(dataset);
  invalid.daily[0].breakdown[0].clientCategory = "/home/user/.config/agent/session";
  assert.throws(() => assertTokenUsageDataset(invalid), /Sensitive public data leak/);
});

test("TUD-006 verifies token arithmetic for every daily record", () => {
  const valid = assertTokenUsageDataset(dataset);
  for (const day of valid.daily) {
    assert.equal(day.directTokens, day.inputTokens + day.outputTokens + day.reasoningTokens);
    assert.equal(day.cacheTokens, day.cacheReadTokens + day.cacheWriteTokens);
    assert.equal(day.totalTokens, day.directTokens + day.cacheTokens);
  }
});

test("TUD-007 verifies last 7 and last 30 day windows from daily data", () => {
  const valid = assertTokenUsageDataset(dataset);
  assert.deepEqual(valid.windows.last7Days, aggregateWindow(valid.daily, valid.period.end, 7));
  assert.deepEqual(valid.windows.last30Days, aggregateWindow(valid.daily, valid.period.end, 30));
});

test("TUD-008 accepts a no-cache day without breaking totals", () => {
  const noCache = clone(dataset);
  const day = noCache.daily[0];
  day.totalTokens = day.directTokens;
  day.cacheTokens = 0;
  day.cacheReadTokens = 0;
  day.cacheWriteTokens = 0;
  noCache.totals = {
    totalTokens: noCache.daily.reduce((total, item) => total + item.totalTokens, 0),
    directTokens: noCache.daily.reduce((total, item) => total + item.directTokens, 0),
    cacheTokens: noCache.daily.reduce((total, item) => total + item.cacheTokens, 0),
    inputTokens: noCache.daily.reduce((total, item) => total + item.inputTokens, 0),
    outputTokens: noCache.daily.reduce((total, item) => total + item.outputTokens, 0),
    cacheReadTokens: noCache.daily.reduce((total, item) => total + item.cacheReadTokens, 0),
    cacheWriteTokens: noCache.daily.reduce((total, item) => total + item.cacheWriteTokens, 0),
    reasoningTokens: noCache.daily.reduce((total, item) => total + item.reasoningTokens, 0),
    messageCount: noCache.daily.reduce((total, item) => total + item.messageCount, 0),
    activeDays: noCache.daily.filter((item) => item.totalTokens > 0 || item.messageCount > 0).length,
    totalDays: noCache.daily.length,
    totalCostUsd: null
  };
  noCache.windows.today = aggregateWindow(noCache.daily, noCache.period.end, 1);
  delete noCache.windows.today.activeDays;
  noCache.windows.last7Days = aggregateWindow(noCache.daily, noCache.period.end, 7);
  noCache.windows.last30Days = aggregateWindow(noCache.daily, noCache.period.end, 30);
  noCache.models[0].totalTokens -= dataset.daily[0].cacheTokens;
  assert.doesNotThrow(() => assertTokenUsageDataset(noCache));
});

test("TUD-009 exposes public model names", () => {
  const valid = assertTokenUsageDataset(dataset);
  assert.ok(valid.models.length >= 1);
  assert.ok(valid.models.every((model) => model.modelName.length > 0));
  assert.ok(valid.daily.every((day) => day.breakdown.every((item) => item.modelName.length > 0)));
  assert.ok(valid.models.every((model) => !isSyntheticModelName(model.modelName)));
  assert.ok(valid.daily.every((day) => day.breakdown.every((item) => !isSyntheticModelName(item.modelName))));
});

test("TUD-010 keeps cost hidden in the MVP public dataset", () => {
  const valid = assertTokenUsageDataset(dataset);
  assert.equal(valid.privacy.costDisplay, "hidden");
  assert.equal(valid.totals.totalCostUsd, null);
});

test("TUD-011 accepts an empty zero-token dataset for UI empty state", () => {
  const empty = clone(dataset);
  empty.daily = [];
  empty.models = [];
  empty.totals = {
    totalTokens: 0,
    directTokens: 0,
    cacheTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    messageCount: 0,
    activeDays: 0,
    totalDays: 30,
    totalCostUsd: null
  };
  empty.windows = {
    today: { totalTokens: 0, directTokens: 0, messageCount: 0 },
    last7Days: { totalTokens: 0, directTokens: 0, messageCount: 0, activeDays: 0 },
    last30Days: { totalTokens: 0, directTokens: 0, messageCount: 0, activeDays: 0 }
  };

  assert.doesNotThrow(() => assertTokenUsageDataset(empty));
});

test("TUD-012 identifies stale generatedAt timestamps", () => {
  assert.equal(isDatasetStale("2026-06-20T00:00:00.000Z", 48, new Date("2026-06-22T01:00:00.000Z")), true);
  assert.equal(isDatasetStale(dataset.generatedAt, 48, new Date("2026-06-22T12:00:00.000Z")), false);
});

test("TUD-013 does not overwrite existing public data when tokscale output is invalid JSON", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "agent-learn-"));
  const outPath = join(tempDir, "token-usage.json");
  writeFileSync(outPath, "existing-public-data\n");

  assert.throws(
    () =>
      collectTokenUsageToFileFromOutputs({
        graphOutput: "not-json",
        aggregateOutput: "{}",
        outPath,
        start: "2026-06-01",
        end: "2026-06-22",
        timezone: "Etc/UTC",
        sourceCommand: "tokscale graph --since 2026-06-01 --until 2026-06-22"
      }),
    /valid JSON/
  );
  assert.equal(readFileSync(outPath, "utf8"), "existing-public-data\n");
});

test("TUD-014 allows unknown model categories while preserving modelName", () => {
  const unknown = clone(dataset);
  unknown.models[0].modelName = "new-public-model";
  unknown.models[0].modelProvider = "unknown";
  unknown.models[0].modelCategory = "unknown";
  assert.equal(assertTokenUsageDataset(unknown).models[0].modelName, "new-public-model");
});

test("TUD-015 rejects synthetic public model names", () => {
  const invalid = clone(dataset);
  invalid.models.push({
    modelName: "<synthetic>",
    modelProvider: "unknown",
    modelCategory: "unknown",
    totalTokens: 0,
    directTokens: 0,
    messageCount: 0
  });

  assert.throws(() => assertTokenUsageDataset(invalid), /real public model name/);
});

test("TUD-016 normalizes real tokscale graph tokenBreakdown and nested client tokens", () => {
  const normalized = normalizeTokscaleData(
    {
      contributions: [
        {
          date: "2026-06-22",
          totals: {
            tokens: 162,
            messages: 4
          },
          intensity: 2,
          tokenBreakdown: {
            input: 10,
            output: 20,
            cacheRead: 100,
            cacheWrite: 30,
            reasoning: 2
          },
          clients: [
            {
              client: "claude",
              modelId: "claude-opus-4-8",
              providerId: "anthropic",
              tokens: {
                input: 10,
                output: 20,
                cacheRead: 100,
                cacheWrite: 30,
                reasoning: 2
              },
              messages: 3
            },
            {
              client: "claude",
              modelId: "<synthetic>",
              providerId: "unknown",
              tokens: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                reasoning: 0
              },
              messages: 1
            }
          ]
        }
      ]
    },
    {
      entries: [
        {
          client: "claude",
          model: "claude-opus-4-8",
          provider: "anthropic",
          input: 10,
          output: 20,
          cacheRead: 100,
          cacheWrite: 30,
          reasoning: 2,
          messageCount: 3
        },
        {
          client: "claude",
          model: "<synthetic>",
          provider: "unknown",
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          reasoning: 0,
          messageCount: 1
        }
      ]
    },
    {
      start: "2026-06-22",
      end: "2026-06-22",
      timezone: "Etc/UTC",
      generatedAt: "2026-06-22T00:00:00.000Z",
      sourceCommand: "tokscale graph --since 2026-06-22 --until 2026-06-22"
    }
  );

  assert.equal(normalized.daily[0].totalTokens, 162);
  assert.equal(normalized.daily[0].directTokens, 32);
  assert.equal(normalized.daily[0].cacheTokens, 130);
  assert.equal(normalized.daily[0].messageCount, 4);
  assert.equal(normalized.daily[0].breakdown.length, 1);
  assert.equal(normalized.models.length, 1);
  assert.equal(normalized.daily[0].breakdown[0].modelName, "claude-opus-4-8");
  assert.equal(normalized.daily[0].breakdown[0].modelProvider, "anthropic");
  assert.doesNotThrow(() => assertTokenUsageDataset(normalized));
});

test("TUD-017 uses the first real usage date for all-time collection periods", () => {
  const normalized = normalizeTokscaleData(
    {
      contributions: [
        {
          date: "1970-01-01",
          totals: {
            tokens: 0,
            messages: 0
          },
          tokenBreakdown: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            reasoning: 0
          }
        },
        {
          date: "2026-06-22",
          totals: {
            tokens: 162,
            messages: 4
          },
          tokenBreakdown: {
            input: 10,
            output: 20,
            cacheRead: 100,
            cacheWrite: 30,
            reasoning: 2
          },
          clients: [
            {
              client: "codex",
              modelId: "gpt-5.5",
              providerId: "OpenAI",
              tokens: {
                input: 10,
                output: 20,
                cacheRead: 100,
                cacheWrite: 30,
                reasoning: 2
              },
              messages: 4
            }
          ]
        }
      ]
    },
    {
      entries: [
        {
          client: "codex",
          model: "gpt-5.5",
          provider: "OpenAI",
          input: 10,
          output: 20,
          cacheRead: 100,
          cacheWrite: 30,
          reasoning: 2,
          messageCount: 4
        }
      ]
    },
    {
      start: "1970-01-01",
      end: "2026-06-22",
      timezone: "Etc/UTC",
      generatedAt: "2026-06-22T00:00:00.000Z",
      sourceCommand: "tokscale graph --since 1970-01-01 --until 2026-06-22"
    }
  );

  assert.equal(normalized.period.start, "2026-06-22");
  assert.equal(normalized.daily.length, 1);
  assert.equal(normalized.totals.totalTokens, 162);
  assert.doesNotThrow(() => assertTokenUsageDataset(normalized));
});

test("TUD-018 keeps synthetic model tokens out of the public model breakdown", () => {
  const normalized = normalizeTokscaleData(
    {
      contributions: [
        {
          date: "2026-06-22",
          totals: {
            tokens: 165,
            messages: 5
          },
          tokenBreakdown: {
            input: 13,
            output: 20,
            cacheRead: 100,
            cacheWrite: 30,
            reasoning: 2
          }
        }
      ]
    },
    {
      entries: [
        {
          client: "codex",
          model: "gpt-5.5",
          provider: "OpenAI",
          input: 10,
          output: 20,
          cacheRead: 100,
          cacheWrite: 30,
          reasoning: 2,
          messageCount: 4
        },
        {
          client: "unknown",
          model: "<synthetic>",
          provider: "unknown",
          input: 3,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          reasoning: 0,
          messageCount: 1
        }
      ]
    },
    {
      start: "1970-01-01",
      end: "2026-06-22",
      timezone: "Etc/UTC",
      generatedAt: "2026-06-22T00:00:00.000Z",
      sourceCommand: "tokscale graph --since 1970-01-01 --until 2026-06-22"
    }
  );

  assert.equal(normalized.totals.totalTokens, 165);
  assert.equal(normalized.models.length, 1);
  assert.equal(normalized.models[0].modelName, "gpt-5.5");
  assert.doesNotThrow(() => assertTokenUsageDataset(normalized));
});

function readDataset(): TokenUsageDataset {
  return JSON.parse(readFileSync("data/token-usage.json", "utf8")) as TokenUsageDataset;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
