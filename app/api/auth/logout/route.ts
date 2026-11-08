import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSessionCookieSecure } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSessionCookieSecure(),
    path: "/",
    maxAge: 0,
  });
  return response;
}
