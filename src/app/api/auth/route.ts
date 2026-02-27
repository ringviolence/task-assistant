import { NextResponse } from "next/server";
import { computeSessionToken, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const appPassword = process.env.APP_PASSWORD;

    if (!appPassword) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    if (password !== appPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await computeSessionToken(appPassword);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
