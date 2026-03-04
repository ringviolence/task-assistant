import { NextResponse } from "next/server";
import { getAllPrompts, setPrompt } from "@/lib/db";

export async function GET() {
  const prompts = await getAllPrompts();
  return NextResponse.json({ prompts });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { key, value } = body as { key?: string; value?: unknown };
  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }
  await setPrompt(key, value);
  return NextResponse.json({ ok: true });
}
