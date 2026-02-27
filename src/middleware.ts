import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeSessionToken, validateApiKey, COOKIE_NAME } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/");
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  const password = process.env.APP_PASSWORD;

  // Validate session cookie
  if (password && sessionCookie) {
    const expected = await computeSessionToken(password);
    if (sessionCookie === expected) {
      return NextResponse.next();
    }
  }

  // Maintenance endpoint also accepts API key or Vercel Cron secret
  if (pathname === "/api/maintenance") {
    const apiKey = request.headers.get("x-api-key") ?? undefined;
    if (validateApiKey(apiKey)) return NextResponse.next();

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return NextResponse.next();
  }

  // Ingest endpoint accepts API key auth
  if (pathname === "/api/ingest") {
    const apiKey = request.headers.get("x-api-key") ?? undefined;
    if (validateApiKey(apiKey)) return NextResponse.next();
  }

  // Unauthorized — return JSON for API routes, redirect to login for pages
  if (isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
