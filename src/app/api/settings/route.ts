import { NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/db";

export async function GET() {
  const userContext = await getConfig("user_context");
  return NextResponse.json({ userContext });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (typeof body.userContext !== "string") {
    return NextResponse.json(
      { error: "userContext must be a string" },
      { status: 400 }
    );
  }
  await setConfig("user_context", body.userContext);
  return NextResponse.json({ ok: true });
}
