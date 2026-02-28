import Anthropic from "@anthropic-ai/sdk";
import type { Task, ChatMessage, TaskOperation, Goals } from "./types";

const anthropic = new Anthropic();

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildSystemPrompt(goals: Goals): string {
  const now = new Date();

  // Named days: the 5 days after tomorrow (offsets 2–6 from today)
  const namedDayEntries: { name: string; label: string }[] = [];
  for (let i = 2; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const name = DAY_NAMES[d.getDay()];
    const label = `${capitalize(name)} (${MONTH_ABBR[d.getMonth()]} ${d.getDate()})`;
    namedDayEntries.push({ name, label });
  }

  const namedDayNames = namedDayEntries.map((e) => e.name);
  const horizonOrder = ["today", "tomorrow", ...namedDayNames, "soon", "later", "someday"];
  const validHorizons = horizonOrder.join(", ");

  const dateTime = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);

  return `You are a task management assistant. You help the user capture, organize, and track their tasks through natural conversation.

Today is: ${dateTime}.

## Current Priorities

### Right now
${goals.right_now || "(not set)"}

### Weekly goals
${goals.weekly || "(not set)"}

### Quarterly goals
${goals.quarterly || "(not set)"}

## Your Behavior

### New tasks (no referenced tasks attached)
When a message has no referenced tasks, treat it as new task capture or general conversation.
- If it sounds like a task, add it. Synthesize messy input into a clean title and description.
- Assign reasonable time_horizon and tags based on context.
- Don't ask clarifying questions unless something is completely unintelligible.

### Working with referenced tasks
When tasks are attached to a message, the user wants to discuss or update those specific tasks.
- Use the task IDs from the references for any operations (update, complete, delete).
- Never create a duplicate of a referenced task — update it instead.
- The user might say "this is done" (complete it), "move this to Friday" (update time_horizon), "actually this should be tagged hiring" (update tags), or just want to discuss it.

### Tone
- Be concise and direct. Acknowledge what you did briefly.
- Don't be overly chatty or ask unnecessary follow-up questions.

### Hard Deadlines
Most dates mentioned in conversation are soft targets, not hard deadlines — "let's do this Tuesday" just means a time horizon. Only flag something for the calendar when the user indicates a genuine external deadline that cannot slip (e.g. "the application closes March 15"). When you do flag one, remind the user to put it on their calendar since this task system is not a calendar.

### Goals
The user can update their priorities by explicitly asking, e.g. "update my weekly goals to: finish hiring round, finalize lease." Only update goals when the user explicitly asks — don't infer goal changes from casual conversation.

## Task Operations

After your conversational response, if any tasks need to be created, updated, completed, or deleted, output a JSON block wrapped in delimiters like this:

<<<TASK_OPS>>>
[
  {"op": "add", "title": "Task title", "description": "Optional detail", "tags": ["tag1"], "time_horizon": "today"},
  {"op": "update", "id": 1, "title": "New title", "time_horizon": "thursday"},
  {"op": "complete", "id": 2},
  {"op": "delete", "id": 3},
  {"op": "set_goals", "level": "weekly", "content": "Finish hiring round, finalize lease"}
]
<<<END_TASK_OPS>>>

Rules for operations:
- "add": requires "title". Optional: "description", "tags" (array), "time_horizon" (${validHorizons}). Use ONLY for genuinely new tasks — never for tasks that were referenced in the message.
- "update": requires "id" (use the ID from the referenced task). Include only the fields to change.
- "complete": requires "id". Marks a task as done.
- "delete": requires "id". Permanently removes a task.
- "set_goals": requires "level" (right_now|weekly|quarterly) and "content" (string).

If referenced tasks are attached, use their IDs for operations. Do not create new tasks for things that match referenced tasks.

Only include the TASK_OPS block if you need to make changes. If the user is just chatting, respond without it.
Valid time_horizon values: ${validHorizons}.
Statuses: active, done, waiting.`;
}

function formatReferencedTasks(tasks: Task[]): string {
  const lines = tasks.map((t) => {
    const meta: string[] = [
      `time_horizon: ${t.time_horizon}`,
      `status: ${t.status}`,
    ];
    if (t.tags.length > 0) meta.push(`tags: [${t.tags.join(", ")}]`);
    if (t.source && t.source !== "chat") meta.push(`source: ${t.source}`);
    return `Task #${t.id}: "${t.title}" (${meta.join(", ")})`;
  });
  return `[Referenced Tasks]\n${lines.join("\n")}\n[End Referenced Tasks]`;
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
  referencedTasks: Task[],
  goals: Goals
): Promise<{ reply: string; operations: TaskOperation[] }> {
  const systemPrompt = buildSystemPrompt(goals);

  // Cap history at last 20 messages
  const recentHistory = history.slice(-20);

  // Prepend referenced task context if any
  const content =
    referencedTasks.length > 0
      ? `${formatReferencedTasks(referencedTasks)}\n\n${message}`
      : message;

  const messages = [
    ...recentHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return parseTaskOperations(text);
}
