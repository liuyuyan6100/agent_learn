import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("HOME-001 keeps the private plan board out of the public module list", () => {
  const homepageSource = readFileSync("app/page.tsx", "utf8");

  assert.equal(homepageSource.includes('className="module-card" href="/plan"'), false);
  assert.equal(homepageSource.includes("Private Plan"), false);
  assert.equal(homepageSource.includes("Plan Board 已上线"), false);
  assert.equal(homepageSource.includes("规划状态看板"), false);
});

test("HOME-002 exposes a separate admin access entry on the homepage", () => {
  const homepageSource = readFileSync("app/page.tsx", "utf8");

  assert.equal(homepageSource.includes("admin-access"), true);
  assert.equal(homepageSource.includes("管理员登录"), true);
  assert.equal(homepageSource.includes('href={getPlanLoginPath("/plan")}'), true);
});
