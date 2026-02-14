import Anthropic from "@anthropic-ai/sdk";
import type { Task, ChatMessage, TaskOperation } from "./types";

const anthropic = new Anthropic();

function buildSystemPrompt(tasks: Task[]): string {
  const activeTasks = tasks.filter((t) => t.status === "active");
  const waitingTasks = tasks.filter((t) => t.status === "waiting");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const formatTask = (t: Task) => {
    const parts = [`  [${t.id}] ${t.title} (${t.time_horizon})`];
    if (t.description) parts.push(`      ${t.description}`);
    if (t.tags.length > 0) parts.push(`      tags: ${t.tags.join(", ")}`);
    return parts.join("\n");
  };

  const taskSection =
    tasks.length === 0
      ? "No tasks yet."
      : [
          activeTasks.length > 0
            ? `Active tasks:\n${activeTasks.map(formatTask).join("\n")}`
            : null,
          waitingTasks.length > 0
            ? `Waiting tasks:\n${waitingTasks.map(formatTask).join("\n")}`
            : null,
          doneTasks.length > 0
            ? `Recently completed:\n${doneTasks.map(formatTask).join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n");

  return `You are a task management assistant. You help the user capture, organize, and track their tasks through natural conversation.

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

## Current Tasks

${taskSection}

## Your Behavior

- Be conversational and concise. Acknowledge what you did briefly — don't list out every field you set.
- When a user mentions something that sounds like a task, add it. Don't ask for confirmation unless genuinely ambiguous.
- Synthesize messy input into clean task titles. The user might ramble — distill it.
- Assign reasonable time_horizon and tags based on context. Use your judgment.
- When the user asks "what's next?" or similar, look at active tasks and recommend based on time_horizon priority (today > this_week > this_month > later > someday).

## Task Operations

After your conversational response, if any tasks need to be created, updated, completed, or deleted, output a JSON block wrapped in delimiters like this:

<<<TASK_OPS>>>
[
  {"op": "add", "title": "Task title", "description": "Optional detail", "tags": ["tag1"], "time_horizon": "today"},
  {"op": "update", "id": 1, "title": "New title", "time_horizon": "this_week"},
  {"op": "complete", "id": 2},
  {"op": "delete", "id": 3}
]
<<<END_TASK_OPS>>>

Rules for operations:
- "add": requires "title". Optional: "description", "tags" (array), "time_horizon" (today|this_week|this_month|later|someday).
- "update": requires "id". Include only the fields to change.
- "complete": requires "id". Marks a task as done.
- "delete": requires "id". Permanently removes a task.

Only include the TASK_OPS block if you need to make changes. If the user is just chatting, respond without it.
Time horizons: today, this_week, this_month, later, someday.
Statuses: active, done, waiting.`;
}

const TASK_OPS_REGEX = /<<<TASK_OPS>>>\s*([\s\S]*?)\s*<<<END_TASK_OPS>>>/;

export function parseTaskOperations(text: string): {
  reply: string;
  operations: TaskOperation[];
} {
  const match = text.match(TASK_OPS_REGEX);

  if (!match) {
    return { reply: text.trim(), operations: [] };
  }

  const reply = text.replace(TASK_OPS_REGEX, "").trim();

  let operations: TaskOperation[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      operations = parsed;
    }
  } catch (e) {
    console.error("Failed to parse TASK_OPS JSON:", e);
  }

  return { reply, operations };
}

export async function callClaude(
  message: string,
  history: ChatMessage[],
  tasks: Task[]
): Promise<{ reply: string; operations: TaskOperation[] }> {
  const systemPrompt = buildSystemPrompt(tasks);

  // Cap history at last 20 messages
  const recentHistory = history.slice(-20);

  const messages = [
    ...recentHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: message },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return parseTaskOperations(text);
}
