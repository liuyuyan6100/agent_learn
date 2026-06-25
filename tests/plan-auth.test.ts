import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPlanSessionToken,
  getPlanSessionUserFromCloudflareAccessHeaders,
  sanitizeNextPath,
  verifyPlanLogin,
  verifyPlanSessionToken
} from "../src/lib/plan-auth";
import { isSameOriginHeaders } from "../src/lib/request-security";

test("PLAN-001 verifies configured login credentials", () => {
  withPlanAuthEnv(() => {
    assert.equal(verifyPlanLogin("Planner@Example.com", "secret-pass"), true);
    assert.equal(verifyPlanLogin("planner@example.com", "wrong-pass"), false);
    assert.equal(verifyPlanLogin("wrong@example.com", "secret-pass"), false);
  });
});

test("PLAN-002 creates and verifies signed plan sessions", () => {
  withPlanAuthEnv(() => {
    const now = Date.UTC(2026, 5, 24, 0, 0, 0);
    const token = createPlanSessionToken("Planner@Example.com", now);

    assert.ok(token);
    assert.deepEqual(verifyPlanSessionToken(token!, now + 60_000), {
      email: "planner@example.com",
      expiresAt: now + 2 * 60 * 60 * 1000,
      source: "cookie"
    });
    assert.equal(verifyPlanSessionToken(token!, now + 3 * 60 * 60 * 1000), null);
  });
});

test("PLAN-003 rejects tampered plan sessions", () => {
  withPlanAuthEnv(() => {
    const token = createPlanSessionToken("planner@example.com", Date.UTC(2026, 5, 24, 0, 0, 0));
    assert.ok(token);

    const [payload] = token!.split(".");
    const tampered = `${payload}.bad-signature`;
    assert.equal(verifyPlanSessionToken(tampered), null);
  });
});

test("PLAN-004 sanitizes post-login redirect targets", () => {
  assert.equal(sanitizeNextPath("/plan"), "/plan");
  assert.equal(sanitizeNextPath("/plan?mode=edit"), "/plan?mode=edit");
  assert.equal(sanitizeNextPath("https://evil.test"), "/plan");
  assert.equal(sanitizeNextPath("//evil.test/plan"), "/plan");
  assert.equal(sanitizeNextPath("/api/plan"), "/plan");
});

test("PLAN-005 allows same-origin headers and rejects foreign origins", () => {
  const sameOrigin = new Headers({
    origin: "https://agent.example.com",
    host: "agent.example.com"
  });
  const crossOrigin = new Headers({
    origin: "https://evil.example.com",
    host: "agent.example.com"
  });

  assert.equal(isSameOriginHeaders(sameOrigin), true);
  assert.equal(isSameOriginHeaders(crossOrigin), false);
});

test("PLAN-006 trusts Cloudflare Access email only when explicitly enabled", () => {
  withPlanAuthEnv(() => {
    const headers = new Headers({
      "cf-access-authenticated-user-email": "Planner@Example.com"
    });
    assert.equal(getPlanSessionUserFromCloudflareAccessHeaders(headers), null);
  });

  withPlanAuthEnv(() => {
    process.env.PLAN_TRUST_CLOUDFLARE_ACCESS = "true";
    const now = Date.UTC(2026, 5, 24, 0, 0, 0);
    const headers = new Headers({
      "cf-access-authenticated-user-email": "Planner@Example.com"
    });

    assert.deepEqual(getPlanSessionUserFromCloudflareAccessHeaders(headers, now), {
      email: "planner@example.com",
      expiresAt: now + 2 * 60 * 60 * 1000,
      source: "cloudflare-access"
    });
  });
});

function withPlanAuthEnv(run: () => void): void {
  const previous = {
    PLAN_ACCESS_EMAIL: process.env.PLAN_ACCESS_EMAIL,
    PLAN_ACCESS_EMAILS: process.env.PLAN_ACCESS_EMAILS,
    PLAN_ACCESS_USERNAME: process.env.PLAN_ACCESS_USERNAME,
    PLAN_ACCESS_PASSWORD: process.env.PLAN_ACCESS_PASSWORD,
    PLAN_SESSION_SECRET: process.env.PLAN_SESSION_SECRET,
    PLAN_SESSION_TTL_SECONDS: process.env.PLAN_SESSION_TTL_SECONDS,
    PLAN_TRUST_CLOUDFLARE_ACCESS: process.env.PLAN_TRUST_CLOUDFLARE_ACCESS
  };

  delete process.env.PLAN_ACCESS_EMAIL;
  process.env.PLAN_ACCESS_EMAILS = "planner@example.com, reviewer@example.com";
  delete process.env.PLAN_ACCESS_USERNAME;
  process.env.PLAN_ACCESS_PASSWORD = "secret-pass";
  process.env.PLAN_SESSION_SECRET = "signing-secret";
  process.env.PLAN_SESSION_TTL_SECONDS = "7200";
  delete process.env.PLAN_TRUST_CLOUDFLARE_ACCESS;

  try {
    run();
  } finally {
    restoreEnv(previous);
  }
}

function restoreEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
