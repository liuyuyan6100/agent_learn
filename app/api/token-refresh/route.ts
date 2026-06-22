import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const REFRESH_UNIT = process.env.AGENT_LEARN_REFRESH_UNIT ?? "agent-learn-refresh.service";
const REFRESH_REQUEST_PATH = process.env.AGENT_LEARN_REFRESH_REQUEST_PATH ?? "/var/lib/agent-learn/refresh.request";
const REFRESH_COOLDOWN_SECONDS = parsePositiveInt(process.env.AGENT_LEARN_REFRESH_COOLDOWN_SECONDS, 15 * 60);
const SYSTEMCTL_PATH = process.env.AGENT_LEARN_SYSTEMCTL_PATH ?? "/usr/bin/systemctl";
const TOUCH_PATH = process.env.AGENT_LEARN_TOUCH_PATH ?? "/usr/bin/touch";
const EXEC_OPTIONS = { maxBuffer: 1024 * 1024, timeout: 5000 };

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin refresh requests are not allowed." }, { status: 403 });
  }

  if (await isRefreshActive()) {
    return NextResponse.json({ error: "Refresh is already running." }, { status: 409 });
  }

  const cooldownSeconds = await getCooldownRemainingSeconds();
  if (cooldownSeconds > 0) {
    return NextResponse.json(
      { error: "Refresh was requested recently.", retryAfterSeconds: cooldownSeconds },
      { status: 429, headers: { "Retry-After": String(cooldownSeconds) } }
    );
  }

  try {
    await execFileAsync(TOUCH_PATH, [REFRESH_REQUEST_PATH], EXEC_OPTIONS);
    return NextResponse.json({ status: "started" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Refresh request could not be queued." }, { status: 500 });
  }
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return true;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function isRefreshActive(): Promise<boolean> {
  try {
    await execFileAsync(SYSTEMCTL_PATH, ["is-active", "--quiet", REFRESH_UNIT], EXEC_OPTIONS);
    return true;
  } catch {
    return false;
  }
}

async function getCooldownRemainingSeconds(): Promise<number> {
  const lastStartedAt = await getLastRefreshStartTime();
  if (!lastStartedAt) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - lastStartedAt.getTime()) / 1000);
  return Math.max(0, REFRESH_COOLDOWN_SECONDS - elapsedSeconds);
}

async function getLastRefreshStartTime(): Promise<Date | null> {
  try {
    const { stdout } = await execFileAsync(
      SYSTEMCTL_PATH,
      ["show", REFRESH_UNIT, "--property=ExecMainStartTimestamp", "--value"],
      EXEC_OPTIONS
    );
    const value = stdout.trim();
    if (!value || value === "n/a") {
      return null;
    }

    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  } catch {
    return null;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
