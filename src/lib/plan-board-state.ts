import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyBoardStatus,
  createDefaultPlanBoardState,
  normalizePlanBoardSnapshot,
  type PlanBoardSnapshot,
  type PlanStatus
} from "./plan-board";

const DEFAULT_PLAN_BOARD_STATE_PATH = path.join(
  /* turbopackIgnore: true */ "/var/lib/agent-learn",
  "plan-board-state.json"
);

export function getPlanBoardStatePath(): string {
  return process.env.PLAN_BOARD_STATE_PATH ?? DEFAULT_PLAN_BOARD_STATE_PATH;
}

export async function readPlanBoardState(): Promise<PlanBoardSnapshot> {
  const filePath = getPlanBoardStatePath();
  try {
    const [content, info] = await Promise.all([
      readFile(/* turbopackIgnore: true */ filePath, "utf8"),
      stat(/* turbopackIgnore: true */ filePath)
    ]);
    const parsed = JSON.parse(content) as unknown;
    const normalized = normalizePlanBoardSnapshot(parsed);
    return {
      ...normalized,
      updatedAt: info.mtime.toISOString()
    };
  } catch {
    const snapshot = createDefaultPlanBoardState();
    await writePlanBoardState(snapshot);
    return snapshot;
  }
}

export async function writePlanBoardState(snapshot: PlanBoardSnapshot): Promise<PlanBoardSnapshot> {
  const filePath = getPlanBoardStatePath();
  await mkdir(path.dirname(/* turbopackIgnore: true */ filePath), { recursive: true });
  const normalized = normalizePlanBoardSnapshot(snapshot);
  await writeFile(/* turbopackIgnore: true */ filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  const info = await stat(/* turbopackIgnore: true */ filePath);
  return {
    ...normalized,
    updatedAt: info.mtime.toISOString()
  };
}

export function updateBoardStatus(
  snapshot: PlanBoardSnapshot,
  itemId: string,
  status: PlanStatus
): PlanBoardSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    statuses: applyBoardStatus(snapshot.statuses, itemId, status)
  };
}
