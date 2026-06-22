export interface TokenUsageDataset {
  schemaVersion: 1;
  generatedAt: string;
  period: {
    start: string;
    end: string;
    timezone: string;
  };
  source: {
    tool: "tokscale";
    sourceCommand: string;
    containsRawPrompts: false;
    containsLocalPaths: false;
  };
  privacy: {
    modelNames: "public";
    clientNames: "public_category";
    costDisplay: "hidden" | "visible";
    redactedFields: string[];
  };
  totals: TokenUsageTotals;
  windows: {
    today: TokenUsageWindow;
    last7Days: TokenUsageWindow;
    last30Days: TokenUsageWindow;
  };
  models: TokenUsageModel[];
  daily: TokenUsageDay[];
  milestones?: TokenUsageMilestone[];
}

export interface TokenUsageTotals {
  totalTokens: number;
  directTokens: number;
  cacheTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  messageCount: number;
  activeDays: number;
  totalDays: number;
  totalCostUsd: number | null;
}

export interface TokenUsageWindow {
  totalTokens: number;
  directTokens: number;
  messageCount: number;
  activeDays?: number;
}

export interface TokenUsageModel {
  modelName: string;
  modelProvider: string;
  modelCategory?: string;
  totalTokens: number;
  directTokens: number;
  messageCount: number;
}

export interface TokenUsageDay {
  date: string;
  totalTokens: number;
  directTokens: number;
  cacheTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  messageCount: number;
  activeTimeMs: number | null;
  intensity: number;
  breakdown: TokenUsageBreakdown[];
}

export interface TokenUsageBreakdown {
  clientCategory: string;
  modelName: string;
  modelProvider: string;
  modelCategory?: string;
  totalTokens: number;
  directTokens: number;
  messageCount: number;
}

export interface TokenUsageMilestone {
  date: string;
  type: "token_volume" | "practice_streak" | "manual_note";
  label: string;
  value: number;
  note?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_KEYS = new Set([
  "account",
  "apikey",
  "api_key",
  "email",
  "internalproject",
  "organizationid",
  "organization_id",
  "rawprompt",
  "raw_prompt",
  "sessionpath",
  "session_path",
  "workspacepath",
  "workspace_path"
]);
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const API_KEY_RE = /\b(sk-[A-Za-z0-9_-]{12,}|OPENAI_API_KEY|ANTHROPIC_API_KEY|api[_-]?key\s*[=:])/i;
const LOCAL_PATH_RE = /(\/home\/|\/Users\/|[A-Z]:\\|\.config\/|session[s]?\b.*\/|workspace[s]?\b.*\/)/i;

type UnknownRecord = Record<string, unknown>;

export function assertTokenUsageDataset(value: unknown): TokenUsageDataset {
  const dataset = asObject(value, "dataset");

  assertEqual(dataset.schemaVersion, 1, "schemaVersion must be 1");
  assertIsoDateTime(dataset.generatedAt, "generatedAt");
  assertPeriod(dataset.period);
  assertSource(dataset.source);
  assertPrivacy(dataset.privacy);

  const daily = assertDailyArray(dataset.daily);
  const totals = assertTotals(dataset.totals);
  const windows = assertWindows(dataset.windows);
  const models = assertModels(dataset.models);

  if ("milestones" in dataset && dataset.milestones !== undefined) {
    assertMilestones(dataset.milestones);
  }

  const leaks = findSensitiveLeaks(dataset);
  if (leaks.length > 0) {
    throw new Error(`Sensitive public data leak: ${leaks.join(", ")}`);
  }

  assertDailyMath(daily);
  assertTotalsMath(totals, daily);
  assertWindowsMath(windows, daily, asObject(dataset.period, "period").end as string);
  assertModelMath(models, totals);

  return dataset as unknown as TokenUsageDataset;
}

export function aggregateWindow(daily: TokenUsageDay[], endDate: string, days: number): TokenUsageWindow {
  const end = utcDate(endDate);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - days + 1);

  const inWindow = daily.filter((day) => {
    const current = utcDate(day.date);
    return current >= start && current <= end;
  });

  return {
    totalTokens: sum(inWindow, "totalTokens"),
    directTokens: sum(inWindow, "directTokens"),
    messageCount: sum(inWindow, "messageCount"),
    activeDays: inWindow.filter((day) => day.totalTokens > 0 || day.messageCount > 0).length
  };
}

export function findSensitiveLeaks(value: unknown): string[] {
  const leaks: string[] = [];

  function walk(current: unknown, path: string[]): void {
    if (Array.isArray(current)) {
      current.forEach((item, index) => walk(item, [...path, String(index)]));
      return;
    }

    if (current && typeof current === "object") {
      for (const [key, nestedValue] of Object.entries(current as UnknownRecord)) {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
        const nestedPath = [...path, key];
        if (FORBIDDEN_KEYS.has(normalizedKey)) {
          leaks.push(nestedPath.join("."));
        }
        walk(nestedValue, nestedPath);
      }
      return;
    }

    if (typeof current !== "string") {
      return;
    }

    if (isAllowedRedactedFieldValue(path)) {
      return;
    }

    if (EMAIL_RE.test(current) || API_KEY_RE.test(current) || LOCAL_PATH_RE.test(current)) {
      leaks.push(path.join("."));
    }
  }

  walk(value, []);
  return leaks;
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
    notation: value >= 10000 ? "compact" : "standard"
  }).format(value);
}

export function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(utcDate(date));
}

export function formatGeneratedAt(dateTime: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(dateTime));
}

export function isDatasetStale(generatedAt: string, thresholdHours = 48, now = new Date()): boolean {
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) {
    return true;
  }
  return now.getTime() - generated.getTime() > thresholdHours * 60 * 60 * 1000;
}

export function sortDaily(daily: TokenUsageDay[]): TokenUsageDay[] {
  return [...daily].sort((a, b) => a.date.localeCompare(b.date));
}

export function isSyntheticModelName(modelName: string): boolean {
  const normalized = modelName.trim().toLowerCase();
  return normalized === "<synthetic>" || normalized === "synthetic";
}

function assertPeriod(value: unknown): void {
  const period = asObject(value, "period");
  assertIsoDate(period.start, "period.start");
  assertIsoDate(period.end, "period.end");
  assertString(period.timezone, "period.timezone");
}

function assertSource(value: unknown): void {
  const source = asObject(value, "source");
  assertEqual(source.tool, "tokscale", "source.tool must be tokscale");
  assertString(source.sourceCommand, "source.sourceCommand");
  assertEqual(source.containsRawPrompts, false, "source.containsRawPrompts must be false");
  assertEqual(source.containsLocalPaths, false, "source.containsLocalPaths must be false");
}

function assertPrivacy(value: unknown): void {
  const privacy = asObject(value, "privacy");
  assertEqual(privacy.modelNames, "public", "privacy.modelNames must be public");
  assertEqual(privacy.clientNames, "public_category", "privacy.clientNames must be public_category");
  if (privacy.costDisplay !== "hidden" && privacy.costDisplay !== "visible") {
    throw new Error("privacy.costDisplay must be hidden or visible");
  }
  assertStringArray(privacy.redactedFields, "privacy.redactedFields");
}

function assertTotals(value: unknown): TokenUsageTotals {
  const totals = asObject(value, "totals");
  for (const key of [
    "totalTokens",
    "directTokens",
    "cacheTokens",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "reasoningTokens",
    "messageCount",
    "activeDays",
    "totalDays"
  ]) {
    assertNonNegativeNumber(totals[key], `totals.${key}`);
  }
  if (totals.totalCostUsd !== null) {
    assertNonNegativeNumber(totals.totalCostUsd, "totals.totalCostUsd");
  }
  return totals as unknown as TokenUsageTotals;
}

function assertWindows(value: unknown): TokenUsageDataset["windows"] {
  const windows = asObject(value, "windows");
  assertWindow(windows.today, "windows.today", false);
  assertWindow(windows.last7Days, "windows.last7Days", true);
  assertWindow(windows.last30Days, "windows.last30Days", true);
  return windows as unknown as TokenUsageDataset["windows"];
}

function assertWindow(value: unknown, path: string, requireActiveDays: boolean): void {
  const windowValue = asObject(value, path);
  assertNonNegativeNumber(windowValue.totalTokens, `${path}.totalTokens`);
  assertNonNegativeNumber(windowValue.directTokens, `${path}.directTokens`);
  assertNonNegativeNumber(windowValue.messageCount, `${path}.messageCount`);
  if (requireActiveDays || windowValue.activeDays !== undefined) {
    assertNonNegativeNumber(windowValue.activeDays, `${path}.activeDays`);
  }
}

function assertModels(value: unknown): TokenUsageModel[] {
  if (!Array.isArray(value)) {
    throw new Error("models must be an array");
  }
  value.forEach((model, index) => {
    const path = `models.${index}`;
    const record = asObject(model, path);
    assertString(record.modelName, `${path}.modelName`);
    if (isSyntheticModelName(record.modelName as string)) {
      throw new Error(`${path}.modelName must be a real public model name`);
    }
    assertString(record.modelProvider, `${path}.modelProvider`);
    if (record.modelCategory !== undefined) {
      assertString(record.modelCategory, `${path}.modelCategory`);
    }
    assertNonNegativeNumber(record.totalTokens, `${path}.totalTokens`);
    assertNonNegativeNumber(record.directTokens, `${path}.directTokens`);
    assertNonNegativeNumber(record.messageCount, `${path}.messageCount`);
  });
  return value as TokenUsageModel[];
}

function assertDailyArray(value: unknown): TokenUsageDay[] {
  if (!Array.isArray(value)) {
    throw new Error("daily must be an array");
  }
  value.forEach((day, index) => assertDay(day, `daily.${index}`));
  return value as TokenUsageDay[];
}

function assertDay(value: unknown, path: string): void {
  const day = asObject(value, path);
  assertIsoDate(day.date, `${path}.date`);
  for (const key of [
    "totalTokens",
    "directTokens",
    "cacheTokens",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "reasoningTokens",
    "messageCount",
    "intensity"
  ]) {
    assertNonNegativeNumber(day[key], `${path}.${key}`);
  }
  if (day.activeTimeMs !== null) {
    assertNonNegativeNumber(day.activeTimeMs, `${path}.activeTimeMs`);
  }
  if (!Array.isArray(day.breakdown)) {
    throw new Error(`${path}.breakdown must be an array`);
  }
  day.breakdown.forEach((breakdown, index) => assertBreakdown(breakdown, `${path}.breakdown.${index}`));
}

function assertBreakdown(value: unknown, path: string): void {
  const breakdown = asObject(value, path);
  assertString(breakdown.clientCategory, `${path}.clientCategory`);
  assertString(breakdown.modelName, `${path}.modelName`);
  if (isSyntheticModelName(breakdown.modelName as string)) {
    throw new Error(`${path}.modelName must be a real public model name`);
  }
  assertString(breakdown.modelProvider, `${path}.modelProvider`);
  if (breakdown.modelCategory !== undefined) {
    assertString(breakdown.modelCategory, `${path}.modelCategory`);
  }
  assertNonNegativeNumber(breakdown.totalTokens, `${path}.totalTokens`);
  assertNonNegativeNumber(breakdown.directTokens, `${path}.directTokens`);
  assertNonNegativeNumber(breakdown.messageCount, `${path}.messageCount`);
}

function assertMilestones(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error("milestones must be an array");
  }
  value.forEach((milestone, index) => {
    const path = `milestones.${index}`;
    const record = asObject(milestone, path);
    assertIsoDate(record.date, `${path}.date`);
    if (record.type !== "token_volume" && record.type !== "practice_streak" && record.type !== "manual_note") {
      throw new Error(`${path}.type is invalid`);
    }
    assertString(record.label, `${path}.label`);
    assertNonNegativeNumber(record.value, `${path}.value`);
    if (record.note !== undefined) {
      assertString(record.note, `${path}.note`);
    }
  });
}

function assertDailyMath(daily: TokenUsageDay[]): void {
  for (const day of daily) {
    const directTokens = day.inputTokens + day.outputTokens + day.reasoningTokens;
    const cacheTokens = day.cacheReadTokens + day.cacheWriteTokens;
    const totalTokens = directTokens + cacheTokens;
    assertEqual(day.directTokens, directTokens, `${day.date} directTokens mismatch`);
    assertEqual(day.cacheTokens, cacheTokens, `${day.date} cacheTokens mismatch`);
    assertEqual(day.totalTokens, totalTokens, `${day.date} totalTokens mismatch`);
  }
}

function assertTotalsMath(totals: TokenUsageTotals, daily: TokenUsageDay[]): void {
  const activeDays = daily.filter((day) => day.totalTokens > 0 || day.messageCount > 0).length;
  assertEqual(totals.totalTokens, sum(daily, "totalTokens"), "totals.totalTokens mismatch");
  assertEqual(totals.directTokens, sum(daily, "directTokens"), "totals.directTokens mismatch");
  assertEqual(totals.cacheTokens, sum(daily, "cacheTokens"), "totals.cacheTokens mismatch");
  assertEqual(totals.inputTokens, sum(daily, "inputTokens"), "totals.inputTokens mismatch");
  assertEqual(totals.outputTokens, sum(daily, "outputTokens"), "totals.outputTokens mismatch");
  assertEqual(totals.cacheReadTokens, sum(daily, "cacheReadTokens"), "totals.cacheReadTokens mismatch");
  assertEqual(totals.cacheWriteTokens, sum(daily, "cacheWriteTokens"), "totals.cacheWriteTokens mismatch");
  assertEqual(totals.reasoningTokens, sum(daily, "reasoningTokens"), "totals.reasoningTokens mismatch");
  assertEqual(totals.messageCount, sum(daily, "messageCount"), "totals.messageCount mismatch");
  assertEqual(totals.activeDays, activeDays, "totals.activeDays mismatch");
}

function assertWindowsMath(windows: TokenUsageDataset["windows"], daily: TokenUsageDay[], endDate: string): void {
  const today = aggregateWindow(daily, endDate, 1);
  const last7Days = aggregateWindow(daily, endDate, 7);
  const last30Days = aggregateWindow(daily, endDate, 30);

  assertWindowMatch(windows.today, today, "windows.today", false);
  assertWindowMatch(windows.last7Days, last7Days, "windows.last7Days", true);
  assertWindowMatch(windows.last30Days, last30Days, "windows.last30Days", true);
}

function assertWindowMatch(actual: TokenUsageWindow, expected: TokenUsageWindow, path: string, includeActiveDays: boolean): void {
  assertEqual(actual.totalTokens, expected.totalTokens, `${path}.totalTokens mismatch`);
  assertEqual(actual.directTokens, expected.directTokens, `${path}.directTokens mismatch`);
  assertEqual(actual.messageCount, expected.messageCount, `${path}.messageCount mismatch`);
  if (includeActiveDays) {
    assertEqual(actual.activeDays, expected.activeDays, `${path}.activeDays mismatch`);
  }
}

function assertModelMath(models: TokenUsageModel[], totals: TokenUsageTotals): void {
  if (models.length === 0 && totals.totalTokens > 0) {
    throw new Error("models must not be empty when token totals are present");
  }
  if (sum(models, "totalTokens") > totals.totalTokens) {
    throw new Error("models totalTokens must not exceed totals.totalTokens");
  }
  if (sum(models, "directTokens") > totals.directTokens) {
    throw new Error("models directTokens must not exceed totals.directTokens");
  }
  if (sum(models, "messageCount") > totals.messageCount) {
    throw new Error("models messageCount must not exceed totals.messageCount");
  }
}

function asObject(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as UnknownRecord;
}

function assertString(value: unknown, path: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, path: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${path} must be a string array`);
  }
}

function assertNonNegativeNumber(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a non-negative number`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function assertIsoDate(value: unknown, path: string): void {
  assertString(value, path);
  if (!ISO_DATE_RE.test(value as string) || Number.isNaN(utcDate(value as string).getTime())) {
    throw new Error(`${path} must be YYYY-MM-DD`);
  }
}

function assertIsoDateTime(value: unknown, path: string): void {
  assertString(value, path);
  if (Number.isNaN(new Date(value as string).getTime())) {
    throw new Error(`${path} must be an ISO datetime`);
  }
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function sum<T extends Record<K, number>, K extends keyof T>(items: T[], key: K): number {
  return items.reduce((total, item) => total + item[key], 0);
}

function isAllowedRedactedFieldValue(path: string[]): boolean {
  return path.length >= 3 && path[path.length - 3] === "privacy" && path[path.length - 2] === "redactedFields";
}
