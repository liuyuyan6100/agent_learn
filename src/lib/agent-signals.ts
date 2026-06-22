export type AgentSignalSourceType = "job" | "article" | "open_source" | "paper" | "product" | "manual";
export type AgentSignalStatus = "planned" | "in_progress" | "done" | "skipped";
export type AgentSignalsSourceMode = "manual_reviewed" | "automated_candidates_reviewed";

export interface AgentSignalsDataset {
  schemaVersion: 1;
  generatedAt: string;
  period: {
    start: string;
    end: string;
    timezone: string;
  };
  source: {
    mode: AgentSignalsSourceMode;
    containsRawScrapes: false;
    containsPrivateInterviewDetails: false;
    containsLocalPaths: false;
  };
  privacy: {
    publicUrlsOnly: true;
    redactedFields: string[];
  };
  signals: AgentSignal[];
}

export interface AgentSignal {
  id: string;
  date: string;
  sourceType: AgentSignalSourceType;
  sourceName: string;
  title: string;
  url: string | null;
  summary: string;
  capabilityTags: string[];
  requirements: string[];
  currentGap: string;
  nextAction: string;
  status: AgentSignalStatus;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = new Set<AgentSignalSourceType>(["job", "article", "open_source", "paper", "product", "manual"]);
const STATUSES = new Set<AgentSignalStatus>(["planned", "in_progress", "done", "skipped"]);
const SOURCE_MODES = new Set<AgentSignalsSourceMode>(["manual_reviewed", "automated_candidates_reviewed"]);
const FORBIDDEN_KEYS = new Set([
  "account",
  "apikey",
  "api_key",
  "cookie",
  "email",
  "html",
  "internalproject",
  "organizationid",
  "organization_id",
  "privateinterviewdetail",
  "private_interview_detail",
  "rawprompt",
  "raw_prompt",
  "rawscrape",
  "raw_scrape",
  "sessionpath",
  "session_path",
  "workspacepath",
  "workspace_path"
]);
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const API_KEY_RE = /\b(sk-[A-Za-z0-9_-]{12,}|OPENAI_API_KEY|ANTHROPIC_API_KEY|api[_-]?key\s*[=:])/i;
const LOCAL_PATH_RE = /(\/home\/|\/Users\/|[A-Z]:\\|\.config\/|session[s]?\b.*\/|workspace[s]?\b.*\/)/i;
const RAW_HTML_RE = /<!doctype html|<html[\s>]|<body[\s>]/i;
const COOKIE_RE = /\b(document\.cookie|set-cookie:|cookie\s*[=:]|sessionid=)/i;
const DISPLAY_TIME_ZONE = "Asia/Shanghai";

type UnknownRecord = Record<string, unknown>;

export const SOURCE_TYPE_LABELS: Record<AgentSignalSourceType, string> = {
  job: "招聘",
  article: "文章",
  open_source: "开源",
  paper: "论文",
  product: "产品",
  manual: "手记"
};

export const STATUS_LABELS: Record<AgentSignalStatus, string> = {
  planned: "计划中",
  in_progress: "推进中",
  done: "已完成",
  skipped: "暂缓"
};

export function assertAgentSignalsDataset(value: unknown): AgentSignalsDataset {
  const dataset = asObject(value, "dataset");

  assertEqual(dataset.schemaVersion, 1, "schemaVersion must be 1");
  assertIsoDateTime(dataset.generatedAt, "generatedAt");
  assertPeriod(dataset.period);
  assertSource(dataset.source);
  assertPrivacy(dataset.privacy);

  const signals = assertSignals(dataset.signals);
  const leaks = findAgentSignalPrivacyLeaks(dataset);
  if (leaks.length > 0) {
    throw new Error(`Sensitive public signal leak: ${leaks.join(", ")}`);
  }

  assertSignalIdsAreUnique(signals);

  return dataset as unknown as AgentSignalsDataset;
}

export function findAgentSignalPrivacyLeaks(value: unknown): string[] {
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
        if (FORBIDDEN_KEYS.has(normalizedKey) && !isAllowedRedactedFieldKey(nestedPath)) {
          leaks.push(nestedPath.join("."));
        }
        walk(nestedValue, nestedPath);
      }
      return;
    }

    if (typeof current !== "string" || isAllowedRedactedFieldValue(path)) {
      return;
    }

    if (
      EMAIL_RE.test(current) ||
      API_KEY_RE.test(current) ||
      LOCAL_PATH_RE.test(current) ||
      RAW_HTML_RE.test(current) ||
      COOKIE_RE.test(current)
    ) {
      leaks.push(path.join("."));
    }
  }

  walk(value, []);
  return leaks;
}

export function sortSignalsByDateDesc(signals: AgentSignal[]): AgentSignal[] {
  return [...signals].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function getRecentSignals(dataset: AgentSignalsDataset, limit = 3): AgentSignal[] {
  return sortSignalsByDateDesc(dataset.signals).slice(0, limit);
}

export function getSignalFilters(signals: AgentSignal[]): {
  sourceTypes: AgentSignalSourceType[];
  capabilityTags: string[];
} {
  return {
    sourceTypes: [...new Set(signals.map((signal) => signal.sourceType))].sort(),
    capabilityTags: [...new Set(signals.flatMap((signal) => signal.capabilityTags))].sort()
  };
}

export function filterSignals(
  signals: AgentSignal[],
  filters: { sourceType?: string; capabilityTag?: string }
): AgentSignal[] {
  return sortSignalsByDateDesc(signals).filter((signal) => {
    if (filters.sourceType && signal.sourceType !== filters.sourceType) {
      return false;
    }

    if (filters.capabilityTag && !signal.capabilityTags.includes(filters.capabilityTag)) {
      return false;
    }

    return true;
  });
}

export function formatSignalDate(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TIME_ZONE
  }).format(utcDate(date));
}

export function formatAgentSignalsGeneratedAt(dateTime: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE
  }).format(new Date(dateTime));
}

export function isAgentSignalsDatasetStale(generatedAt: string, thresholdDays = 7, now = new Date()): boolean {
  const generated = new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) {
    return true;
  }
  return now.getTime() - generated.getTime() > thresholdDays * 24 * 60 * 60 * 1000;
}

function assertPeriod(value: unknown): void {
  const period = asObject(value, "period");
  assertIsoDate(period.start, "period.start");
  assertIsoDate(period.end, "period.end");
  assertString(period.timezone, "period.timezone");

  if (typeof period.start === "string" && typeof period.end === "string" && period.start > period.end) {
    throw new Error("period.start must be on or before period.end");
  }
}

function assertSource(value: unknown): void {
  const source = asObject(value, "source");
  assertEnum(source.mode, SOURCE_MODES, "source.mode");
  assertEqual(source.containsRawScrapes, false, "source.containsRawScrapes must be false");
  assertEqual(source.containsPrivateInterviewDetails, false, "source.containsPrivateInterviewDetails must be false");
  assertEqual(source.containsLocalPaths, false, "source.containsLocalPaths must be false");
}

function assertPrivacy(value: unknown): void {
  const privacy = asObject(value, "privacy");
  assertEqual(privacy.publicUrlsOnly, true, "privacy.publicUrlsOnly must be true");
  assertStringArray(privacy.redactedFields, "privacy.redactedFields");
}

function assertSignals(value: unknown): AgentSignal[] {
  if (!Array.isArray(value)) {
    throw new Error("signals must be an array");
  }

  value.forEach((item, index) => assertSignal(item, `signals.${index}`));
  return value as AgentSignal[];
}

function assertSignal(value: unknown, path: string): void {
  const signal = asObject(value, path);
  assertString(signal.id, `${path}.id`);
  assertIsoDate(signal.date, `${path}.date`);
  assertEnum(signal.sourceType, SOURCE_TYPES, `${path}.sourceType`);
  assertString(signal.sourceName, `${path}.sourceName`);
  assertString(signal.title, `${path}.title`);
  assertNullablePublicUrl(signal.url, `${path}.url`);
  assertString(signal.summary, `${path}.summary`);
  assertStringArray(signal.capabilityTags, `${path}.capabilityTags`, { minItems: 1 });
  assertStringArray(signal.requirements, `${path}.requirements`, { minItems: 1 });
  assertString(signal.currentGap, `${path}.currentGap`);
  assertString(signal.nextAction, `${path}.nextAction`);
  assertEnum(signal.status, STATUSES, `${path}.status`);
}

function assertSignalIdsAreUnique(signals: AgentSignal[]): void {
  const ids = new Set<string>();
  for (const signal of signals) {
    if (ids.has(signal.id)) {
      throw new Error(`Duplicate signal id: ${signal.id}`);
    }
    ids.add(signal.id);
  }
}

function assertNullablePublicUrl(value: unknown, path: string): void {
  if (value === null) {
    return;
  }

  assertString(value, path);
  if (typeof value !== "string" || !isPublicHttpUrl(value)) {
    throw new Error(`${path} must be a public HTTP(S) URL or null`);
  }
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function asObject(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as UnknownRecord;
}

function assertString(value: unknown, path: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, path: string, options: { minItems?: number } = {}): void {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  if (options.minItems !== undefined && value.length < options.minItems) {
    throw new Error(`${path} must contain at least ${options.minItems} item`);
  }

  value.forEach((item, index) => assertString(item, `${path}.${index}`));
}

function assertIsoDate(value: unknown, path: string): void {
  assertString(value, path);
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    throw new Error(`${path} must be YYYY-MM-DD`);
  }
}

function assertIsoDateTime(value: unknown, path: string): void {
  assertString(value, path);
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${path} must be an ISO datetime`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function assertEnum<T extends string>(value: unknown, allowed: Set<T>, path: string): void {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`${path} must be one of ${[...allowed].join(", ")}`);
  }
}

function isAllowedRedactedFieldKey(path: string[]): boolean {
  return path.length >= 2 && path[path.length - 2] === "privacy" && path[path.length - 1] === "redactedFields";
}

function isAllowedRedactedFieldValue(path: string[]): boolean {
  return path.length >= 3 && path[path.length - 3] === "privacy" && path[path.length - 2] === "redactedFields";
}

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
