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

  assert.equal(recent.length, 3);
  assert.deepEqual(
    recent.map((signal) => signal.date),
    ["2026-06-22", "2026-06-21", "2026-06-20"]
  );
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

function readDataset(): AgentSignalsDataset {
  return JSON.parse(readFileSync("data/agent-signals.json", "utf8")) as AgentSignalsDataset;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
