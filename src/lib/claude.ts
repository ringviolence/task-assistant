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

function buildSystemPrompt(tasks: Task[], goals: Goals): string {
  const now = new Date();
  const todayIdx = now.getDay(); // 0=Sun

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
  const horizonLabels: Record<string, string> = {
    today: "Today",
    tomorrow: "Tomorrow",
    soon: "Soon",
    later: "Later",
    someday: "Someday",
  };
  namedDayEntries.forEach((e) => {
    horizonLabels[e.name] = e.label;
  });

  const validHorizons = horizonOrder.join(", ");

  const activeTasks = tasks.filter((t) => t.status === "active");
  const waitingTasks = tasks.filter((t) => t.status === "waiting");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const formatTask = (t: Task) => {
    const parts = [`  [${t.id}] ${t.title}`];
    if (t.description) parts.push(`      ${t.description}`);
    if (t.tags.length > 0) parts.push(`      tags: ${t.tags.join(", ")}`);
    return parts.join("\n");
  };

  const sections: string[] = [];
  for (const horizon of horizonOrder) {
    const hTasks = activeTasks.filter((t) => t.time_horizon === horizon);
    if (hTasks.length > 0) {
      sections.push(`### ${horizonLabels[horizon]}\n${hTasks.map(formatTask).join("\n")}`);
    }
  }
  if (waitingTasks.length > 0) {
    sections.push(`### Waiting\n${waitingTasks.map(formatTask).join("\n")}`);
  }
  if (doneTasks.length > 0) {
    sections.push(`### Recently Completed\n${doneTasks.map(formatTask).join("\n")}`);
  }

  const taskSection =
    tasks.length === 0 || sections.length === 0
      ? "No tasks yet."
      : sections.join("\n\n");

  const dateTime = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);

  // Named days list for the Time Horizons section
  const namedDaysList = namedDayEntries.map((e) => e.label).join(", ");
  const namedDaysShort = namedDayEntries.map((e) => e.name).join(", ");

  return `You are a task management assistant. You help the user capture, organize, and track their tasks through natural conversation.

Today is: ${dateTime}.

## Current Priorities

### Right now
${goals.right_now || "(not set)"}

### Weekly goals
${goals.weekly || "(not set)"}

### Quarterly goals
${goals.quarterly || "(not set)"}

## Current Tasks

${taskSection}

## Your Behavior

### Capture
- When the user dumps tasks, they may be messy, incomplete, or lack context. Acknowledge briefly and add them. Don't ask clarifying questions at capture time unless something is completely unintelligible.
- Synthesize messy input into a clean title and description. If the user rambles, distill it into one sentence title with bullet points in the description for detail.
- When something sounds like a task, add it. Don't ask for confirmation unless genuinely ambiguous.
- Assign reasonable time_horizon and tags based on context. Use your judgment.

### Deduplication
- Before adding a task, check if a very similar task already exists in the current task list. If it does, update the existing task by ID instead of creating a duplicate.
- Reference tasks by their ID when they already exist.

### Check-ins vs. Daily Planning
These are different interactions:
- Check-in ("what's on my list," "what needs attention," "what's next"): Read back what's relevant, flag anything time-sensitive given the current time, note anything that needs more context. Be concise. Don't add extra questions.
- Daily planning ("what should I work on today," "let's plan today"): Read back what's relevant for today, then ask "What's the most important thing today, and why?" This helps the user check alignment with their goals, not just react to what's urgent.

### Time Horizons
Valid time horizons are: today, tomorrow, ${namedDaysShort}, soon, later, someday.
- "today" and "tomorrow" are self-explanatory.
- Named days (${namedDaysShort}): use the lowercase day name when the user references a specific day within the next 7 days. "Let's do this Thursday" → use "thursday".
- "soon": within 2–3 weeks but not in the 7-day window.
- "later": has a vague timeframe (next month, next quarter) but not imminent.
- "someday": no timeframe, just don't lose it.

### Prioritization
When recommending what to focus on, use the Current Priorities hierarchy: "right now" priorities first, then weekly goals, then quarterly goals. If no priorities have been set, fall back to time_horizon ordering (today > tomorrow > named days > soon > later > someday).

### Hard Deadlines
Most dates mentioned in conversation are soft targets, not hard deadlines — "let's do this Tuesday" just means a time horizon. Only flag something for the calendar when the user indicates a genuine external deadline that cannot slip (e.g. "the application closes March 15," "the board meeting is on the 3rd"). When you do flag one, remind the user to put it on their calendar since this task system is not a calendar.

### Task Completion
When the user says something is done, acknowledge and mark it complete. If they say "2 and 3 are done" referring to a numbered list, update accordingly.

### Goals
The user can update their priorities by explicitly asking, e.g. "update my weekly goals to: finish hiring round, finalize lease." Only update goals when the user explicitly asks — don't infer goal changes from casual conversation.

### Tone
- Be concise and direct. Acknowledge what you did briefly — don't list out every field you set.
- Don't be overly chatty or ask unnecessary follow-up questions.

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
- "add": requires "title". Optional: "description", "tags" (array), "time_horizon" (${validHorizons}).
- "update": requires "id". Include only the fields to change.
- "complete": requires "id". Marks a task as done.
- "delete": requires "id". Permanently removes a task.
- "set_goals": requires "level" (right_now|weekly|quarterly) and "content" (string). Replaces the goals at that level.

Only include the TASK_OPS block if you need to make changes. If the user is just chatting, respond without it.
Valid time_horizon values: ${validHorizons}.
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
  tasks: Task[],
  goals: Goals
): Promise<{ reply: string; operations: TaskOperation[] }> {
  const systemPrompt = buildSystemPrompt(tasks, goals);

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
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return parseTaskOperations(text);
}
