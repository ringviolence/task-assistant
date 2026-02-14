import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/db";
import type { TasksResponse } from "@/lib/types";

export async function GET() {
  try {
    const tasks = await getAllTasks();
    return NextResponse.json<TasksResponse>({ tasks });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
