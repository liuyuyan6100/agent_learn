import { NextResponse, type NextRequest } from "next/server";
import {
  createPlanSessionToken,
  getPlanSessionCookieName,
  getPlanSessionTtlSeconds,
  isPlanAuthConfigured,
  sanitizeNextPath,
  verifyPlanLogin
} from "@/src/lib/plan-auth";
import { isSameOriginRequest } from "@/src/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return redirectWithLocation("/login?error=invalid");
  }

  if (!isPlanAuthConfigured()) {
    return redirectWithLocation("/login?error=config");
  }

  const formData = await request.formData();
  const email = getStringValue(formData.get("email") ?? formData.get("username"));
  const password = getStringValue(formData.get("password"));
  const nextPath = sanitizeNextPath(getStringValue(formData.get("next")));

  if (!verifyPlanLogin(email, password)) {
    return redirectWithLocation(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  const token = createPlanSessionToken(email);
  if (!token) {
    return redirectWithLocation("/login?error=config");
  }

  const response = redirectWithLocation(nextPath);
  response.cookies.set({
    name: getPlanSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getPlanSessionTtlSeconds()
  });
  return response;
}

function getStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithLocation(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location
    }
  });
}
