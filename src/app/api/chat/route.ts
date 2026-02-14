import { NextResponse } from "next/server";
import { getAllTasks, applyOperations } from "@/lib/db";
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

    // 1. Get current tasks
    const currentTasks = await getAllTasks();

    // 2. Call Claude with message, history, and current tasks
    const { reply, operations } = await callClaude(
      body.message,
      body.history ?? [],
      currentTasks
    );

    // 3. Apply any task operations
    if (operations.length > 0) {
      await applyOperations(operations);
    }

    // 4. Fetch updated tasks
    const tasks = await getAllTasks();

    return NextResponse.json<ChatResponse>({ reply, tasks });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
