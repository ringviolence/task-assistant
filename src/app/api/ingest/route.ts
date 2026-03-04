import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { applyOperations, getPrompt } from "@/lib/db";
import { buildSystemPrompt, parseTaskOperations } from "@/lib/claude";

const anthropic = new Anthropic();


interface IngestBody {
  source: string;
  [key: string]: unknown;
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

    const userMessage =
      `[Incoming payload from ${body.source}]\n\n` +
      JSON.stringify(body, null, 2) +
      "\n\nProcess this as a new task.";

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
