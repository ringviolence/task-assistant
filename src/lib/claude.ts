import Anthropic from "@anthropic-ai/sdk";
import type { Task, OutcomeWithTasks, ChatMessage, TaskOperation } from "./types";
import { getPrompt } from "./db";

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

export async function buildSystemPrompt(): Promise<string> {
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

  const [template, userContext] = await Promise.all([
    getPrompt("system_prompt"),
    getPrompt("user_context"),
  ]);

  const contextSection = userContext.trim()
    ? `\n\n## Context\n\n${userContext.trim()}`
    : "";

  return template
    .replaceAll("{{DATE_TIME}}", dateTime)
    .replaceAll("{{VALID_HORIZONS}}", validHorizons)
    .replaceAll("{{CONTEXT_SECTION}}", contextSection);
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

// ── Search ─────────────────────────────────────────────────────────────────

export async function searchTasks(
  query: string,
  tasks: Task[],
  outcomes: OutcomeWithTasks[]
): Promise<number[]> {
  const systemPrompt = await getPrompt("search_prompt");
  const outcomeMap = new Map(outcomes.map((o) => [o.id, o.title]));

  const taskLines = tasks.map((t) => {
    const meta: string[] = [t.time_horizon];
    if (t.tags.length > 0) meta.push(`tags: ${t.tags.join("/")}`);
    meta.push(`status: ${t.status}`);
    if (t.outcome_id) {
      const outcomeTitle = outcomeMap.get(t.outcome_id);
      if (outcomeTitle) meta.push(`outcome: ${outcomeTitle}`);
    }
    let line = `[${t.id}] ${t.title} (${meta.join(", ")})`;
    if (t.description) line += `\n  ${t.description}`;
    return line;
  });

  const content = `## Tasks to search\n\n${taskLines.join("\n")}\n\n## User's search query\n\n${query}`;

  // Use claude-haiku-4-5-20251001 — lighter/cheaper model; search is simpler than the main chat task
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: "user", content }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";

  try {
    const ids = JSON.parse(text.trim());
    if (Array.isArray(ids)) {
      return ids.filter((id): id is number => typeof id === "number");
    }
  } catch {
    console.error("Failed to parse search response:", text);
  }

  return [];
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
): Promise<{ reply: string; operations: TaskOperation[] }> {
  const systemPrompt = await buildSystemPrompt();

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
