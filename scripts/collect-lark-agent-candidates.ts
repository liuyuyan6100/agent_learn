import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertAgentSignalsDataset } from "../src/lib/agent-signals";

interface SearchMessage {
  content?: unknown;
  create_time?: unknown;
  chat_id?: unknown;
  message_id?: unknown;
}

interface Candidate {
  rank: number;
  kind: "article" | "conversation";
  title: string;
  url: string | null;
  matchedKeywords: string[];
  evidenceCount: number;
  chatCount: number;
  latestAt: string | null;
  summary: string;
}

interface CandidateDraft {
  kind: "article" | "conversation";
  title: string;
  url: string | null;
  matchedKeywords: Set<string>;
  messageIds: Set<string>;
  chatIds: Set<string>;
  latestAt: string | null;
}

const args = parseArgs(process.argv.slice(2));
const dataset = assertAgentSignalsDataset(JSON.parse(readFileSync("data/agent-signals.json", "utf8")));
const policy = dataset.source.collectionPolicy.dailyLarkDigest;
const date = args.date ?? formatShanghaiDate(new Date());
const pageLimit = Number.parseInt(args.pageLimit ?? "2", 10);
const outputFile =
  args.output ??
  path.join(
    process.env.AGENT_LEARN_STATE_DIR ?? ".tmp",
    "lark-agent-candidates",
    `${date}.json`
  );

if (!policy.enabled) {
  throw new Error("Daily Lark digest is disabled in data/agent-signals.json.");
}

const start = `${date}T00:00:00+08:00`;
const end = `${date}T23:59:59+08:00`;
const articleDrafts = new Map<string, CandidateDraft>();
const topicDrafts = new Map<string, CandidateDraft>();

for (const keyword of policy.queryKeywords) {
  const messages = searchMessages(keyword, start, end, pageLimit);
  const topicDraft = getDraft(topicDrafts, `topic:${keyword}`, {
    kind: "conversation",
    title: `飞书中关于 ${keyword} 的讨论热度`,
    url: null
  });
  topicDraft.matchedKeywords.add(keyword);

  for (const message of messages) {
    const messageId = getString(message.message_id);
    const chatId = getString(message.chat_id);
    const createdAt = normalizeCreateTime(getString(message.create_time));
    const content = stringifyContent(message.content);
    const urls = extractPublicUrls(content);

    if (messageId) {
      topicDraft.messageIds.add(messageId);
    }
    if (chatId) {
      topicDraft.chatIds.add(chatId);
    }
    topicDraft.latestAt = latestDate(topicDraft.latestAt, createdAt);

    for (const url of urls) {
      const draft = getDraft(articleDrafts, url, {
        kind: "article",
        title: titleFromUrl(url),
        url
      });
      draft.matchedKeywords.add(keyword);
      if (messageId) {
        draft.messageIds.add(messageId);
      }
      if (chatId) {
        draft.chatIds.add(chatId);
      }
      draft.latestAt = latestDate(draft.latestAt, createdAt);
    }
  }
}

const candidates = [...articleDrafts.values(), ...topicDrafts.values()]
  .filter((draft) => draft.messageIds.size > 0)
  .sort(compareDrafts)
  .slice(0, 8)
  .map(toCandidate);

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  date,
  source: {
    tool: "lark-cli im +messages-search",
    containsRawChat: false,
    containsMessageIds: false,
    containsChatIds: false,
    privacyMode: policy.privacyMode
  },
  queryKeywords: policy.queryKeywords,
  totals: {
    candidates: candidates.length,
    articleCandidates: candidates.filter((candidate) => candidate.kind === "article").length,
    conversationCandidates: candidates.filter((candidate) => candidate.kind === "conversation").length
  },
  candidates
};

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${candidates.length} Lark Agent candidates to ${outputFile}`);

function searchMessages(keyword: string, start: string, end: string, limit: number): SearchMessage[] {
  const stdout = execFileSync(
    "lark-cli",
    [
      "im",
      "+messages-search",
      "--as",
      "user",
      "--query",
      keyword,
      "--start",
      start,
      "--end",
      end,
      "--page-size",
      "50",
      "--page-limit",
      String(limit),
      "--no-reactions",
      "--format",
      "json"
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  const parsed = JSON.parse(stdout) as {
    data?: { items?: SearchMessage[]; messages?: SearchMessage[] };
    items?: SearchMessage[];
    messages?: SearchMessage[];
  };
  return parsed.data?.items ?? parsed.data?.messages ?? parsed.items ?? parsed.messages ?? [];
}

function getDraft(
  drafts: Map<string, CandidateDraft>,
  key: string,
  defaults: Pick<CandidateDraft, "kind" | "title" | "url">
): CandidateDraft {
  const existing = drafts.get(key);
  if (existing) {
    return existing;
  }
  const draft: CandidateDraft = {
    ...defaults,
    matchedKeywords: new Set(),
    messageIds: new Set(),
    chatIds: new Set(),
    latestAt: null
  };
  drafts.set(key, draft);
  return draft;
}

function toCandidate(draft: CandidateDraft, index: number): Candidate {
  const evidenceCount = draft.messageIds.size;
  const chatCount = draft.chatIds.size;
  return {
    rank: index + 1,
    kind: draft.kind,
    title: draft.title,
    url: draft.url,
    matchedKeywords: [...draft.matchedKeywords].sort(),
    evidenceCount,
    chatCount,
    latestAt: draft.latestAt,
    summary:
      draft.kind === "article"
        ? `飞书聊天中 ${evidenceCount} 条消息提到该公开链接，覆盖 ${chatCount} 个会话，可作为 Agent Signals 文章候选。`
        : `飞书聊天中 ${evidenceCount} 条消息命中该 Agent 主题，覆盖 ${chatCount} 个会话，可作为人工复核的热门讨论候选。`
  };
}

function compareDrafts(a: CandidateDraft, b: CandidateDraft): number {
  return (
    b.messageIds.size - a.messageIds.size ||
    b.chatIds.size - a.chatIds.size ||
    String(b.latestAt ?? "").localeCompare(String(a.latestAt ?? "")) ||
    a.title.localeCompare(b.title)
  );
}

function extractPublicUrls(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s"'<>\\)]+/g) ?? [];
  const urls = matches
    .map((value) => value.replace(/[.,，。;；:：]+$/, ""))
    .filter(isPublicHttpUrl);
  return [...new Set(urls)];
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      hostname !== "localhost" &&
      !hostname.endsWith(".local") &&
      !hostname.startsWith("127.") &&
      !hostname.startsWith("10.") &&
      !hostname.startsWith("192.168.") &&
      !/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value ?? "");
}

function titleFromUrl(value: string): string {
  const url = new URL(value);
  const pathTitle = decodeURIComponent(url.pathname)
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[-_]+/g, " ")
    .trim();
  return pathTitle ? `${url.hostname} / ${pathTitle}` : url.hostname;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCreateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestDate(current: string | null, next: string | null): string | null {
  if (!next) {
    return current;
  }
  if (!current || next > current) {
    return next;
  }
  return current;
}

function formatShanghaiDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function parseArgs(values: string[]): Record<string, string | undefined> {
  const parsed: Record<string, string | undefined> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    parsed[key] = values[index + 1];
    index += 1;
  }
  return parsed;
}
