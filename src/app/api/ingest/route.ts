import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { applyOperations, getPrompt } from "@/lib/db";
import { buildSystemPrompt, parseTaskOperations } from "@/lib/claude";

const anthropic = new Anthropic();


interface IngestBody {
  source: string;
  content: string;
  metadata?: {
    notes?: string;
    due_date?: string;
    url?: string;
    [key: string]: unknown;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IngestBody;

    if (!body.source || typeof body.source !== "string") {
      return NextResponse.json(
        { ok: false, error: "source is required" },
        { status: 400 }
      );
    }
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { ok: false, error: "content is required" },
        { status: 400 }
      );
    }

    // Build user message
    let userMessage = `[Incoming task from ${body.source}] ${body.content}.`;
    if (body.metadata?.notes) {
      userMessage += ` ${body.metadata.notes}.`;
    }
    if (body.metadata?.due_date) {
      userMessage += ` The source suggests a due date of ${body.metadata.due_date}.`;
    }
    if (body.metadata?.url) {
      userMessage += ` url: ${body.metadata.url}`;
    }
    userMessage += " Process this as a new task.";

    // Build system prompt with source-specific addition
    const basePrompt = await buildSystemPrompt();
    let sourceInstruction = await getPrompt(`source_${body.source}`);
    if (!sourceInstruction) sourceInstruction = await getPrompt("source_default");
    const systemPrompt = basePrompt + "\n\n## Ingest Context\n" + sourceInstruction;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const { operations } = parseTaskOperations(text);

    if (operations.length > 0) {
      await applyOperations(operations, body.source);
    }

    return NextResponse.json({
      ok: true,
      message: "Task processed",
      operations,
    });
  } catch (error: unknown) {
    console.error("Ingest API error:", error);

    if (error instanceof Error && "status" in error) {
      const apiError = error as { status: number; error?: { message?: string } };
      const message = apiError.error?.message ?? error.message;
      return NextResponse.json({ ok: false, error: message }, { status: apiError.status });
    }

    return NextResponse.json(
      { ok: false, error: "Failed to process ingest" },
      { status: 500 }
    );
  }
}
