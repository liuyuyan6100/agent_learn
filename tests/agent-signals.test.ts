import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertAgentSignalsDataset,
  filterSignals,
  findAgentSignalPrivacyLeaks,
  getRecentSignals,
  getSignalFilters,
  isAgentSignalsDatasetStale,
  paginateSignals,
  sortSignalsByDateDesc,
  type AgentSignalsDataset
} from "../src/lib/agent-signals";

const dataset = readDataset();

test("SIG-001 validates the public agent signals dataset", () => {
  assert.doesNotThrow(() => assertAgentSignalsDataset(dataset));
});

test("SIG-002 rejects signals missing required public fields", () => {
  const invalid = clone(dataset);
  delete (invalid.signals[0] as Partial<(typeof invalid.signals)[number]>).id;
  assert.throws(() => assertAgentSignalsDataset(invalid), /signals\.0\.id/);

  const missingSummary = clone(dataset);
  delete (missingSummary.signals[0] as Partial<(typeof missingSummary.signals)[number]>).summary;
  assert.throws(() => assertAgentSignalsDataset(missingSummary), /signals\.0\.summary/);

  const missingIntelValue = clone(dataset);
  delete (missingIntelValue.signals[0] as Partial<(typeof missingIntelValue.signals)[number]>).intelValue;
  assert.throws(() => assertAgentSignalsDataset(missingIntelValue), /signals\.0\.intelValue/);
});

test("SIG-003 rejects unsupported sourceType values", () => {
  const invalid = clone(dataset);
  invalid.signals[0].sourceType = "newsletter" as (typeof invalid.signals)[number]["sourceType"];
  assert.throws(() => assertAgentSignalsDataset(invalid), /sourceType/);
});

test("SIG-004 rejects non-public URLs while allowing null URLs", () => {
  const invalid = clone(dataset);
  invalid.signals[0].url = "file:///home/user/private-note.md";
  assert.throws(() => assertAgentSignalsDataset(invalid), /public HTTP\(S\) URL/);

  const local = clone(dataset);
  local.signals[0].url = "http://localhost:3000/private";
  assert.throws(() => assertAgentSignalsDataset(local), /public HTTP\(S\) URL/);

  const valid = clone(dataset);
  valid.signals[0].url = null;
  assert.doesNotThrow(() => assertAgentSignalsDataset(valid));
});

test("SIG-005 rejects emails, API keys, cookies, local paths, raw prompts and raw HTML", () => {
  const leaks = findAgentSignalPrivacyLeaks({
    note: "contact person@example.com",
    nested: {
      path: "/home/user/.config/agent/session",
      rawPrompt: "private prompt",
      htmlCopy: "<html><body>raw scrape</body></html>",
      cookieDump: "cookie=sessionid=secret"
    },
    privacy: {
      redactedFields: ["email", "apiKey", "cookie", "rawPrompt"]
    }
  });

  assert.deepEqual(leaks, ["note", "nested.path", "nested.rawPrompt", "nested.htmlCopy", "nested.cookieDump"]);
});

test("SIG-006 rejects raw scrape and private interview flags", () => {
  const rawScrapes = clone(dataset);
  rawScrapes.source.containsRawScrapes = true as AgentSignalsDataset["source"]["containsRawScrapes"];
  assert.throws(() => assertAgentSignalsDataset(rawScrapes), /containsRawScrapes/);

  const privateInterview = clone(dataset);
  privateInterview.source.containsPrivateInterviewDetails =
    true as AgentSignalsDataset["source"]["containsPrivateInterviewDetails"];
  assert.throws(() => assertAgentSignalsDataset(privateInterview), /containsPrivateInterviewDetails/);
});

test("SIG-007 sorts signals by date descending", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const sorted = sortSignalsByDateDesc([...valid.signals].reverse());

  assert.deepEqual(
    sorted.map((signal) => signal.date),
    [...valid.signals].map((signal) => signal.date).sort().reverse()
  );
});

test("SIG-008 returns a homepage-safe recent signal preview", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const recent = getRecentSignals(valid, 3);
  const expected = sortSignalsByDateDesc(valid.signals).slice(0, 3);

  assert.equal(recent.length, 3);
  assert.deepEqual(recent, expected);
});

test("SIG-009 accepts an empty signal dataset for UI empty state", () => {
  const empty = clone(dataset);
  empty.signals = [];

  assert.doesNotThrow(() => assertAgentSignalsDataset(empty));
  assert.deepEqual(getRecentSignals(assertAgentSignalsDataset(empty), 3), []);
});

test("SIG-010 identifies stale generatedAt timestamps", () => {
  assert.equal(
    isAgentSignalsDatasetStale("2026-06-10T00:00:00.000Z", 7, new Date("2026-06-22T00:00:00.000Z")),
    true
  );
  assert.equal(
    isAgentSignalsDatasetStale(dataset.generatedAt, 7, new Date("2026-06-22T12:00:00.000Z")),
    false
  );
});

test("SIG-011 filters signals by source type", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const productSignals = filterSignals(valid.signals, { sourceType: "product" });

  assert.ok(productSignals.length >= 1);
  assert.ok(productSignals.every((signal) => signal.sourceType === "product"));
});

test("SIG-012 filters signals by capability tag", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const filters = getSignalFilters(valid.signals);
  const evalSignals = filterSignals(valid.signals, { capabilityTag: "evals" });

  assert.ok(filters.capabilityTags.includes("evals"));
  assert.ok(evalSignals.length >= 1);
  assert.ok(evalSignals.every((signal) => signal.capabilityTags.includes("evals")));
});

test("SIG-013 requires Chinese intel summaries for public signals", () => {
  const invalid = clone(dataset);
  invalid.signals[0].summary = "English-only summary";
  assert.throws(() => assertAgentSignalsDataset(invalid), /Chinese narrative string/);

  const invalidIntel = clone(dataset);
  invalidIntel.signals[0].intelValue = "English-only intel";
  assert.throws(() => assertAgentSignalsDataset(invalidIntel), /Chinese narrative string/);
});

test("SIG-014 keeps multiple recruiting, article, product and open-source signals represented", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const counts = new Map<string, number>();
  for (const signal of valid.signals) {
    counts.set(signal.sourceType, (counts.get(signal.sourceType) ?? 0) + 1);
  }

  for (const sourceType of ["job", "article", "product", "open_source"]) {
    assert.ok((counts.get(sourceType) ?? 0) >= 2, `${sourceType} should have at least two reviewed signals`);
  }
});

test("SIG-015 paginates signals for continued archive growth", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const sorted = sortSignalsByDateDesc(valid.signals);
  const firstPage = paginateSignals(sorted, 1, 8);
  const secondPage = paginateSignals(sorted, 2, 8);
  const overflowPage = paginateSignals(sorted, 999, 8);

  assert.equal(firstPage.totalItems, valid.signals.length);
  assert.ok(firstPage.totalItems > 20);
  assert.equal(firstPage.totalPages, Math.ceil(valid.signals.length / 8));
  assert.deepEqual(firstPage.items, sorted.slice(0, 8));
  assert.deepEqual(secondPage.items, sorted.slice(8, 16));
  assert.equal(overflowPage.currentPage, firstPage.totalPages);
});

test("SIG-016 keeps reviewed public source URLs unique", () => {
  const valid = assertAgentSignalsDataset(dataset);
  const urls = valid.signals.map((signal) => signal.url).filter((url): url is string => Boolean(url));

  assert.equal(new Set(urls).size, urls.length);
});

test("SIG-017 enforces weighted source collection policy", () => {
  const valid = assertAgentSignalsDataset(dataset);

  assert.equal(valid.source.collectionPolicy.articleSearchWeights.overseasFamousAgentCommunities, 70);
  assert.equal(valid.source.collectionPolicy.articleSearchWeights.chinaAgentCommunities, 30);
  assert.equal(valid.source.collectionPolicy.jobSearchWeights.overseasJobs, 20);
  assert.equal(valid.source.collectionPolicy.jobSearchWeights.chinaJobs, 80);
  assert.ok(valid.source.collectionPolicy.requiredChinaJobBoards.some((board) => board.includes("BOSS")));
  assert.ok(
    valid.source.collectionPolicy.requiredChinaJobBoards.some(
      (board) => board.includes("51job") || board.includes("前程无忧")
    )
  );
  assert.equal(valid.source.collectionPolicy.dailyLarkDigest.enabled, true);
  assert.equal(valid.source.collectionPolicy.dailyLarkDigest.privacyMode, "summary_only_no_raw_chat");
});

test("SIG-018 rejects drift from required source weights", () => {
  const invalidArticleWeights = clone(dataset);
  invalidArticleWeights.source.collectionPolicy.articleSearchWeights.overseasFamousAgentCommunities =
    60 as AgentSignalsDataset["source"]["collectionPolicy"]["articleSearchWeights"]["overseasFamousAgentCommunities"];
  assert.throws(() => assertAgentSignalsDataset(invalidArticleWeights), /overseasFamousAgentCommunities/);

  const missingChinaJobBoard = clone(dataset);
  missingChinaJobBoard.source.collectionPolicy.requiredChinaJobBoards = ["Lagou", "Liepin"];
  assert.throws(() => assertAgentSignalsDataset(missingChinaJobBoard), /BOSS/);
});

function readDataset(): AgentSignalsDataset {
  return JSON.parse(readFileSync("data/agent-signals.json", "utf8")) as AgentSignalsDataset;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
