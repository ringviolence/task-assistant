import { NextResponse } from "next/server";
import { getAllOutcomes } from "@/lib/db";
import type { OutcomesResponse } from "@/lib/types";

export async function GET() {
  const outcomes = await getAllOutcomes();
  return NextResponse.json<OutcomesResponse>({ outcomes });
}
