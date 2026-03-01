import Anthropic from "@anthropic-ai/sdk";
import type { Task, OutcomeWithTasks, ChatMessage, TaskOperation } from "./types";

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

export function buildSystemPrompt(userContext: string): string {
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

  const contextSection = userContext.trim()
    ? `\n\n## Context\n\n${userContext.trim()}`
    : "";

  return `You are a task management assistant. You help the user capture, organize, and track their tasks through natural conversation.

Today is: ${dateTime}.${contextSection}

## Your Behavior

### New tasks (no referenced tasks attached)
When a message has no referenced tasks or outcomes, treat it as new task capture or general conversation.
- If it sounds like a task, add it. Synthesize messy input into a clean title and description.
- Assign reasonable time_horizon and tags based on context.
- Don't ask clarifying questions unless something is completely unintelligible.

### Working with referenced tasks
When tasks are attached to a message, the user wants to discuss or update those specific tasks.
- Use the task IDs from the references for any operations (update, complete, delete).
- Never create a duplicate of a referenced task — update it instead.
- The user might say "this is done" (complete it), "move this to Friday" (update time_horizon), "actually this should be tagged hiring" (update tags), or just want to discuss it.

### Outcomes
Outcomes are meaningful milestones with a definition of done. Tasks can be linked to outcomes.

When an outcome is referenced:
- Discuss before making changes. Explore, suggest, think through implications with the user.
- Only emit outcome operations (create, update, close, split) when the user confirms or explicitly asks for the update.
- When the user describes splitting an outcome, create new outcomes and reassign tasks as discussed.
- When the user references multiple outcomes for merging/reorganizing, wait for confirmation before restructuring.

When tasks are referenced and the user says to assign them to an outcome, use the outcome's title or context to identify which outcome — since there are typically few active outcomes, fuzzy matching is fine here.

Creating outcomes: When the user describes a new milestone or workstream, create an outcome. Tasks can be linked at creation or later.

### Tone
- Be concise and direct. Acknowledge what you did briefly.
- Don't be overly chatty or ask unnecessary follow-up questions.

### Hard Deadlines
Most dates mentioned in conversation are soft targets, not hard deadlines — "let's do this Tuesday" just means a time horizon. Only flag something for the calendar when the user indicates a genuine external deadline that cannot slip (e.g. "the application closes March 15"). When you do flag one, remind the user to put it on their calendar since this task system is not a calendar.

### Communicating changes

Be unambiguous about whether you are proposing changes or have already made them.

When you MAKE changes (your response includes a TASK_OPS block):
- Use past tense. "Done. Deleted #2, kept #39, linked #29 to the tax outcome."
- Be specific about what changed. List the operations clearly and concisely.
- Don't say "I'll do this" or "I'm going to" — the changes are already applied the moment you include the TASK_OPS block.

When you are PROPOSING changes and want confirmation first (no TASK_OPS block):
- Use future tense or questions. "I'd suggest deleting #2 and keeping #39. Want me to go ahead?"
- Do NOT include a TASK_OPS block — wait for the user to confirm.
- Only after confirmation, include the TASK_OPS block in your next response.

For quick task actions (marking done, moving to a day, simple updates): just do it and confirm in past tense. No need to ask permission.
For outcome-level changes (restructuring, splitting, merging, closing): propose first, wait for confirmation, then execute.

### Overlapping references
If a task appears both as a standalone reference and inside a referenced outcome, the user is pointing at that specific task within the outcome. Don't treat them as separate — it's one task, and the user is giving you extra focus on it. Use the task ID consistently and never create a duplicate.

## Task Operations

After your conversational response, if any tasks or outcomes need to be created, updated, or deleted, output a JSON block wrapped in delimiters like this:

<<<TASK_OPS>>>
[
  {"op": "add", "title": "Task title", "description": "Optional detail", "tags": ["tag1"], "time_horizon": "today", "outcome_id": 3},
  {"op": "update", "id": 1, "title": "New title", "time_horizon": "thursday"},
  {"op": "complete", "id": 2},
  {"op": "delete", "id": 3},
  {"op": "create_outcome", "title": "All five roles filled", "definition_of_done": "Offers accepted for all five positions"},
  {"op": "update_outcome", "id": 1, "definition_of_done": "Updated definition"},
  {"op": "close_outcome", "id": 1},
  {"op": "delete_outcome", "id": 1},
  {"op": "link_task", "task_id": 42, "outcome_id": 3},
  {"op": "unlink_task", "task_id": 42}
]
<<<END_TASK_OPS>>>

Task operation rules:
- "add": requires "title". Optional: "description", "tags" (array), "time_horizon" (${validHorizons}), "outcome_id". Use ONLY for genuinely new tasks — never for tasks that were referenced in the message. When creating a new outcome AND new tasks for it in the same response, set "outcome_id": "new" on the task operations — the system will link them to the newly created outcome automatically.
- "update": requires "id". Include only the fields to change.
- "complete": requires "id". Marks a task as done.
- "delete": requires "id". Permanently removes a task.

Outcome operation rules:
- "create_outcome": requires "title". Optional: "definition_of_done", "description". Color is assigned automatically.
- "update_outcome": requires "id". Optional: "title", "definition_of_done", "description".
- "close_outcome": requires "id". Marks the outcome as done.
- "delete_outcome": requires "id". Permanently removes the outcome and unlinks its tasks.
- "link_task": requires "task_id" and "outcome_id". Links a task to an outcome.
- "unlink_task": requires "task_id". Removes a task from its outcome.

If referenced tasks are attached, use their IDs for operations. Do not create new tasks for things that match referenced tasks.
If referenced outcomes are attached, use their IDs for outcome operations. Only make changes when the user confirms.

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

function formatReferencedOutcomes(outcomes: OutcomeWithTasks[]): string {
  const lines: string[] = ["[Referenced Outcomes]"];
  for (const o of outcomes) {
    lines.push(`Outcome #${o.id}: "${o.title}"`);
    if (o.definition_of_done) lines.push(`  Definition of done: ${o.definition_of_done}`);
    if (o.description) lines.push(`  Description: ${o.description}`);
    if (o.tasks.length > 0) {
      lines.push(`  Active tasks:`);
      for (const t of o.tasks) {
        const meta: string[] = [`time_horizon: ${t.time_horizon}`, `status: ${t.status}`];
        if (t.tags.length > 0) meta.push(`tags: [${t.tags.join(", ")}]`);
        lines.push(`    Task #${t.id}: "${t.title}" (${meta.join(", ")})`);
      }
    }
  }
  lines.push("[End Referenced Outcomes]");
  return lines.join("\n");
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
  referencedOutcomes: OutcomeWithTasks[],
  userContext: string
): Promise<{ reply: string; operations: TaskOperation[] }> {
  const systemPrompt = buildSystemPrompt(userContext);

  // Cap history at last 20 messages
  const recentHistory = history.slice(-20);

  // Build enriched message with referenced context
  const parts: string[] = [];
  if (referencedTasks.length > 0) parts.push(formatReferencedTasks(referencedTasks));
  if (referencedOutcomes.length > 0) parts.push(formatReferencedOutcomes(referencedOutcomes));
  parts.push(message);
  const content = parts.join("\n\n");

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
