import { NextResponse, type NextRequest } from "next/server";
import { getPlanSessionCookieName } from "@/src/lib/plan-auth";
import { isSameOriginRequest } from "@/src/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login"
    }
  });

  if (!isSameOriginRequest(request)) {
    return response;
  }

  response.cookies.set({
    name: getPlanSessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
