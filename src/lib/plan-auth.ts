import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

const PLAN_SESSION_COOKIE = "agent_plan_session";
const DEFAULT_LOGIN_PATH = "/login";
const DEFAULT_PLAN_PATH = "/plan";
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_VERSION = "v1";
const CF_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PlanAuthConfig {
  allowedEmails: string[];
  legacyUsername?: string;
  password?: string;
  secret: string;
  sessionTtlSeconds: number;
  trustCloudflareAccess: boolean;
}

interface SessionPayload {
  sub: string;
  exp: number;
  ver: string;
}

export interface PlanSessionUser {
  email: string;
  expiresAt: number;
  source: "cookie" | "cloudflare-access";
}

export function getPlanAuthConfig(): PlanAuthConfig | null {
  const developmentEmail = process.env.NODE_ENV === "production" ? undefined : ["admin", "example.test"].join("@");
  const allowedEmails = parseEmailList(
    process.env.PLAN_ACCESS_EMAILS ?? process.env.PLAN_ACCESS_EMAIL ?? developmentEmail
  );
  const legacyUsername = process.env.PLAN_ACCESS_USERNAME ?? devFallback("admin");
  const password = process.env.PLAN_ACCESS_PASSWORD ?? devFallback("agent-plan-dev");
  const secret = process.env.PLAN_SESSION_SECRET ?? devFallback("agent-plan-secret-dev");
  const trustCloudflareAccess = parseBoolean(process.env.PLAN_TRUST_CLOUDFLARE_ACCESS);

  if (!secret) {
    return null;
  }

  const formLoginConfigured = Boolean(password && (allowedEmails.length > 0 || legacyUsername));
  if (!formLoginConfigured && !trustCloudflareAccess) {
    return null;
  }

  return {
    allowedEmails,
    legacyUsername,
    password,
    secret,
    sessionTtlSeconds: parsePositiveInt(process.env.PLAN_SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS),
    trustCloudflareAccess
  };
}

export function isPlanAuthConfigured(): boolean {
  return getPlanAuthConfig() !== null;
}

export function isPlanFormLoginConfigured(): boolean {
  const config = getPlanAuthConfig();
  return Boolean(config?.password && (config.allowedEmails.length > 0 || config.legacyUsername));
}

export function getPlanSessionTtlSeconds(): number {
  return getPlanAuthConfig()?.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
}

export function verifyPlanLogin(email: string, password: string): boolean {
  const config = getPlanAuthConfig();
  if (!config?.password) {
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  const matchesEmail = normalizedEmail ? config.allowedEmails.some((allowedEmail) => safeEqual(normalizedEmail, allowedEmail)) : false;
  const matchesLegacyUsername = config.legacyUsername ? safeEqual(email.trim(), config.legacyUsername) : false;

  return (matchesEmail || matchesLegacyUsername) && safeEqual(password, config.password);
}

export function createPlanSessionToken(email: string, now = Date.now()): string | null {
  const config = getPlanAuthConfig();
  if (!config) {
    return null;
  }

  const subject = normalizeEmail(email) ?? email.trim();
  if (!isAllowedPlanSubject(subject, config)) {
    return null;
  }

  const payload = encodePayload({
    sub: subject,
    exp: now + config.sessionTtlSeconds * 1000,
    ver: SESSION_VERSION
  });
  const signature = signValue(payload, config.secret);
  return `${payload}.${signature}`;
}

export function verifyPlanSessionToken(token: string, now = Date.now()): PlanSessionUser | null {
  const config = getPlanAuthConfig();
  if (!config) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signValue(payload, config.secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  const parsed = decodePayload(payload);
  if (!parsed || parsed.ver !== SESSION_VERSION) {
    return null;
  }

  if (parsed.exp <= now || !isAllowedPlanSubject(parsed.sub, config)) {
    return null;
  }

  return {
    email: parsed.sub,
    expiresAt: parsed.exp,
    source: "cookie"
  };
}

export async function getPlanSessionUser(): Promise<PlanSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLAN_SESSION_COOKIE)?.value;

  if (token) {
    const cookieUser = verifyPlanSessionToken(token);
    if (cookieUser) {
      return cookieUser;
    }
  }

  const headerStore = await headers();
  return getPlanSessionUserFromCloudflareAccessHeaders(headerStore);
}

export function getPlanSessionUserFromCloudflareAccessHeaders(headerStore: Headers, now = Date.now()): PlanSessionUser | null {
  const config = getPlanAuthConfig();
  if (!config?.trustCloudflareAccess) {
    return null;
  }

  const email = normalizeEmail(headerStore.get(CF_ACCESS_EMAIL_HEADER));
  if (!email) {
    return null;
  }

  if (config.allowedEmails.length > 0 && !config.allowedEmails.some((allowedEmail) => safeEqual(email, allowedEmail))) {
    return null;
  }

  return {
    email,
    expiresAt: now + config.sessionTtlSeconds * 1000,
    source: "cloudflare-access"
  };
}

export function getPlanSessionCookieName(): string {
  return PLAN_SESSION_COOKIE;
}

export function getPlanLoginPath(nextPath?: string): string {
  const next = sanitizeNextPath(nextPath);
  return `${DEFAULT_LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_PLAN_PATH;
  }

  if (value.startsWith("/api/")) {
    return DEFAULT_PLAN_PATH;
  }

  return value;
}

function devFallback(value: string): string | undefined {
  return process.env.NODE_ENV === "production" ? undefined : value;
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const emails = value
    .split(/[,\s]+/)
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item));

  return [...new Set(emails)];
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return EMAIL_RE.test(normalized) ? normalized : null;
}

function isAllowedPlanSubject(subject: string, config: PlanAuthConfig): boolean {
  const normalizedEmail = normalizeEmail(subject);
  if (normalizedEmail && config.allowedEmails.some((allowedEmail) => safeEqual(normalizedEmail, allowedEmail))) {
    return true;
  }

  return Boolean(config.legacyUsername && safeEqual(subject, config.legacyUsername));
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
