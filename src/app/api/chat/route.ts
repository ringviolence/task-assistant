import { NextResponse } from "next/server";
import { getAllTasks, applyOperations, getGoals } from "@/lib/db";
import { callClaude } from "@/lib/claude";
import type { ChatRequest, ChatResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // 1. Get current tasks and goals
    const currentTasks = await getAllTasks();
    const goals = await getGoals();

    // 2. Call Claude with message, history, current tasks, and goals
    const { reply, operations } = await callClaude(
      body.message,
      body.history ?? [],
      currentTasks,
      goals
    );

    // 3. Apply any task operations
    if (operations.length > 0) {
      await applyOperations(operations);
    }

    // 4. Fetch updated tasks
    const tasks = await getAllTasks();

    return NextResponse.json<ChatResponse>({ reply, tasks });
  } catch (error: unknown) {
    console.error("Chat API error:", error);

    if (error instanceof Error && "status" in error) {
      const apiError = error as { status: number; error?: { message?: string } };
      const message = apiError.error?.message ?? error.message;
      return NextResponse.json(
        { error: message },
        { status: apiError.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
