import { NextResponse } from "next/server";
import { getAllTasks, getAllOutcomes } from "@/lib/db";
import { searchTasks } from "@/lib/claude";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body?.query;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const [tasks, outcomes] = await Promise.all([getAllTasks(), getAllOutcomes()]);
    const rankedIds = await searchTasks(query.trim(), tasks, outcomes);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const results = rankedIds.map((id) => taskMap.get(id)).filter(Boolean);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
