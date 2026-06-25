import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePlanBoardSnapshot } from "../src/lib/plan-board";
import { readPlanBoardState, updateBoardStatus, writePlanBoardState } from "../src/lib/plan-board-state";

test("PLANBOARD-001 persists board item statuses outside the document body", async () => {
  await withPlanBoardStateFile(async () => {
    const initial = await readPlanBoardState();
    const next = updateBoardStatus(initial, "weekly-summary", "done");
    const saved = await writePlanBoardState(next);
    const reread = await readPlanBoardState();

    assert.equal(saved.statuses["weekly-summary"], "done");
    assert.equal(reread.statuses["weekly-summary"], "done");
  });
});

test("PLANBOARD-002 ignores unknown item ids and invalid statuses", () => {
  const normalized = normalizePlanBoardSnapshot({
    updatedAt: "2026-06-24T00:00:00.000Z",
    statuses: {
      "weekly-summary": "done",
      "visual-polish": "invalid",
      "unknown-item": "done"
    }
  });
  const next = updateBoardStatus(normalized, "unknown-item", "blocked");

  assert.equal(normalized.statuses["weekly-summary"], "done");
  assert.equal(normalized.statuses["visual-polish"], "optimize");
  assert.equal(Object.hasOwn(normalized.statuses, "unknown-item"), false);
  assert.deepEqual(next.statuses, normalized.statuses);
});

async function withPlanBoardStateFile(run: () => Promise<void>): Promise<void> {
  const previousPath = process.env.PLAN_BOARD_STATE_PATH;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "agent-learn-plan-"));
  process.env.PLAN_BOARD_STATE_PATH = path.join(tempDir, "plan-board-state.json");

  try {
    await run();
  } finally {
    if (previousPath === undefined) {
      delete process.env.PLAN_BOARD_STATE_PATH;
    } else {
      process.env.PLAN_BOARD_STATE_PATH = previousPath;
    }

    await rm(tempDir, { recursive: true, force: true });
  }
}
