import { NextResponse } from "next/server";
import { runMaintenance, getAllTasks } from "@/lib/db";
import type { MaintenanceResult } from "@/lib/types";

export async function POST() {
  try {
    const result = await runMaintenance();
    const tasks = await getAllTasks();
    return NextResponse.json<MaintenanceResult & { tasks: typeof tasks }>({
      ...result,
      tasks,
    });
  } catch (error) {
    console.error("Maintenance error:", error);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
