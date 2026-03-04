import { NextResponse } from "next/server";
import { getAllTasks, getAllOutcomes, applyOperations } from "@/lib/db";
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

    // 1. Call Claude with message, history, and referenced tasks/outcomes
    const { reply, operations } = await callClaude(
      body.message,
      body.history ?? [],
      body.referencedTasks ?? [],
      body.referencedOutcomes ?? [],
    );

    // 3. Apply any task/outcome operations
    if (operations.length > 0) {
      await applyOperations(operations);
    }

    // 4. Fetch updated tasks and outcomes
    const [tasks, outcomes] = await Promise.all([getAllTasks(), getAllOutcomes()]);

    return NextResponse.json<ChatResponse>({ reply, tasks, outcomes });
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
