import { NextResponse, type NextRequest } from "next/server";
import { getPlanSessionUser } from "@/src/lib/plan-auth";
import { applyBoardStatus, hasPlanBoardItem, isPlanStatus, type PlanStatus } from "@/src/lib/plan-board";
import { readPlanBoardState, updateBoardStatus, writePlanBoardState } from "@/src/lib/plan-board-state";
import { isSameOriginRequest } from "@/src/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getPlanSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const board = await readPlanBoardState();
  return NextResponse.json(board);
}

export async function PUT(request: NextRequest) {
  const user = await getPlanSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin plan updates are not allowed." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as { itemId?: unknown; status?: unknown } | null;
  if (!payload || typeof payload.itemId !== "string" || !isPlanStatus(payload.status)) {
    return NextResponse.json({ error: "规划状态格式无效。" }, { status: 400 });
  }

  if (!hasPlanBoardItem(payload.itemId)) {
    return NextResponse.json({ error: "未知规划条目。" }, { status: 400 });
  }

  const current = await readPlanBoardState();
  const next = updateBoardStatus(current, payload.itemId, payload.status as PlanStatus);
  const saved = await writePlanBoardState(next);
  return NextResponse.json({
    ...saved,
    statuses: applyBoardStatus(saved.statuses, payload.itemId, payload.status as PlanStatus)
  });
}
