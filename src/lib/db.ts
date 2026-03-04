import { neon } from "@neondatabase/serverless";
import type { Task, Outcome, OutcomeWithTasks, TaskOperation, MaintenanceResult, Prompt } from "./types";

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(process.env.DATABASE_URL);
}

function rowToTask(row: Record<string, unknown>): Task {
  const created = row.created_at;
  const updated = row.updated_at;
  return {
    id: row.id as number,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    tags: JSON.parse(row.tags as string),
    time_horizon: row.time_horizon as Task["time_horizon"],
    status: row.status as Task["status"],
    source: (row.source as string | null) ?? "chat",
    source_url: (row.source_url as string | null) ?? null,
    outcome_id: (row.outcome_id as number | null) ?? null,
    created_at: created instanceof Date ? created.toISOString() : String(created),
    updated_at: updated instanceof Date ? updated.toISOString() : String(updated),
  };
}

function rowToOutcome(row: Record<string, unknown>): Outcome {
  const created = row.created_at;
  const updated = row.updated_at;
  return {
    id: row.id as number,
    title: row.title as string,
    definition_of_done: (row.definition_of_done as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    color: row.color as string,
    status: row.status as Outcome["status"],
    created_at: created instanceof Date ? created.toISOString() : String(created),
    updated_at: updated instanceof Date ? updated.toISOString() : String(updated),
  };
}

function wordSet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function similarityScore(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  return intersection / Math.min(setA.size, setB.size);
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function getAllTasks(): Promise<Task[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM tasks WHERE status != 'deleted' ORDER BY id`;
  return rows.map((row) => rowToTask(row as Record<string, unknown>));
}

export async function addTask(
  title: string,
  description?: string | null,
  tags?: string[],
  time_horizon?: Task["time_horizon"],
  source?: string,
  outcome_id?: number | null,
  source_url?: string | null
): Promise<Task> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO tasks (title, description, tags, time_horizon, source, outcome_id, source_url)
    VALUES (
      ${title},
      ${description ?? null},
      ${JSON.stringify(tags ?? [])},
      ${time_horizon ?? "later"},
      ${source ?? "chat"},
      ${outcome_id ?? null},
      ${source_url ?? null}
    )
    RETURNING *
  `;
  return rowToTask(rows[0] as Record<string, unknown>);
}

export async function updateTask(
  id: number,
  fields: Partial<Pick<Task, "title" | "description" | "tags" | "time_horizon" | "status">>
): Promise<void> {
  const sql = getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (fields.title !== undefined) {
    sets.push(`title = $${vals.length + 1}`);
    vals.push(fields.title);
  }
  if (fields.description !== undefined) {
    sets.push(`description = $${vals.length + 1}`);
    vals.push(fields.description ?? null);
  }
  if (fields.tags !== undefined) {
    sets.push(`tags = $${vals.length + 1}`);
    vals.push(JSON.stringify(fields.tags));
  }
  if (fields.time_horizon !== undefined) {
    sets.push(`time_horizon = $${vals.length + 1}`);
    vals.push(fields.time_horizon);
  }
  if (fields.status !== undefined) {
    sets.push(`status = $${vals.length + 1}`);
    vals.push(fields.status);
  }

  if (sets.length === 0) return;
  sets.push("updated_at = NOW()");
  vals.push(id);
  await sql.query(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function completeTask(id: number): Promise<void> {
  await updateTask(id, { status: "done" });
}

export async function deleteTask(id: number): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM tasks WHERE id = ${id}`;
}

export async function linkTask(taskId: number, outcomeId: number): Promise<void> {
  const sql = getDb();
  await sql`UPDATE tasks SET outcome_id = ${outcomeId}, updated_at = NOW() WHERE id = ${taskId}`;
}

export async function unlinkTask(taskId: number): Promise<void> {
  const sql = getDb();
  await sql`UPDATE tasks SET outcome_id = NULL, updated_at = NOW() WHERE id = ${taskId}`;
}

// ── Outcomes ───────────────────────────────────────────────────────────────

const OUTCOME_COLORS = [
  "#B5D8EB", // soft blue
  "#F5C6D0", // soft pink
  "#C5E8D0", // soft green
  "#F0DDB5", // soft peach
  "#D4C5F0", // soft lavender
  "#B5EBE0", // soft teal
  "#F5E6B5", // soft yellow
  "#E0C5B5", // soft terracotta
  "#C5D4F0", // soft periwinkle
  "#D8F0B5", // soft lime
];

async function getNextOutcomeColor(): Promise<string> {
  const sql = getDb();
  const rows = await sql`SELECT color FROM outcomes WHERE status = 'active'`;
  const usedColors = new Set(rows.map((r) => r.color as string));
  const unused = OUTCOME_COLORS.find((c) => !usedColors.has(c));
  if (unused) return unused;
  // All in use — cycle by total count
  const countRows = await sql`SELECT COUNT(*) as count FROM outcomes`;
  return OUTCOME_COLORS[Number(countRows[0].count) % OUTCOME_COLORS.length];
}

export async function getAllOutcomes(): Promise<OutcomeWithTasks[]> {
  const sql = getDb();
  const outcomeRows = await sql`SELECT * FROM outcomes ORDER BY id`;
  const taskRows = await sql`
    SELECT * FROM tasks
    WHERE outcome_id IS NOT NULL AND status NOT IN ('done', 'deleted')
    ORDER BY id
  `;
  const tasks = taskRows.map((r) => rowToTask(r as Record<string, unknown>));
  return outcomeRows.map((row) => {
    const outcome = rowToOutcome(row as Record<string, unknown>);
    return { ...outcome, tasks: tasks.filter((t) => t.outcome_id === outcome.id) };
  });
}

export async function createOutcome(
  title: string,
  definition_of_done?: string | null,
  description?: string | null
): Promise<Outcome> {
  const sql = getDb();
  const color = await getNextOutcomeColor();
  const rows = await sql`
    INSERT INTO outcomes (title, definition_of_done, description, color)
    VALUES (${title}, ${definition_of_done ?? null}, ${description ?? null}, ${color})
    RETURNING *
  `;
  return rowToOutcome(rows[0] as Record<string, unknown>);
}

export async function updateOutcome(
  id: number,
  fields: Partial<Pick<Outcome, "title" | "definition_of_done" | "description">>
): Promise<void> {
  const sql = getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (fields.title !== undefined) {
    sets.push(`title = $${vals.length + 1}`);
    vals.push(fields.title);
  }
  if (fields.definition_of_done !== undefined) {
    sets.push(`definition_of_done = $${vals.length + 1}`);
    vals.push(fields.definition_of_done ?? null);
  }
  if (fields.description !== undefined) {
    sets.push(`description = $${vals.length + 1}`);
    vals.push(fields.description ?? null);
  }

  if (sets.length === 0) return;
  sets.push("updated_at = NOW()");
  vals.push(id);
  await sql.query(
    `UPDATE outcomes SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function closeOutcome(id: number): Promise<void> {
  const sql = getDb();
  await sql`UPDATE outcomes SET status = 'done', updated_at = NOW() WHERE id = ${id}`;
}

export async function deleteOutcome(id: number): Promise<void> {
  const sql = getDb();
  await sql`UPDATE tasks SET outcome_id = NULL WHERE outcome_id = ${id}`;
  await sql`DELETE FROM outcomes WHERE id = ${id}`;
}

// ── Config ─────────────────────────────────────────────────────────────────

export async function getConfig(key: string): Promise<string> {
  const sql = getDb();
  const rows = await sql`SELECT value FROM config WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as string) : "";
}

export async function setConfig(key: string, value: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO config (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

// ── Prompts ─────────────────────────────────────────────────────────────────

export async function getPrompt(key: string): Promise<string> {
  const sql = getDb();
  const rows = await sql`SELECT value FROM prompts WHERE key = ${key}`;
  return rows.length > 0 ? (rows[0].value as string) : "";
}

export async function setPrompt(key: string, value: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE prompts SET value = ${value}, updated_at = NOW() WHERE key = ${key}`;
}

export async function getAllPrompts(): Promise<Prompt[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM prompts ORDER BY sort_order ASC`;
  return rows.map((r) => ({
    key: r.key as string,
    label: r.label as string,
    description: r.description as string,
    sensitivity: r.sensitivity as Prompt["sensitivity"],
    value: r.value as string,
    sort_order: r.sort_order as number,
    updated_at: String(r.updated_at),
  }));
}

// ── Operations ─────────────────────────────────────────────────────────────

export async function applyOperations(ops: TaskOperation[], source?: string): Promise<void> {
  // Pass 1: create_outcome ops first so new tasks can reference the resulting ID
  let newOutcomeId: number | undefined;
  for (const op of ops) {
    if (op.op === "create_outcome" && op.title) {
      const outcome = await createOutcome(op.title, op.definition_of_done, op.description);
      newOutcomeId = outcome.id;
    }
  }

  // Pass 2: everything else — resolve "new" outcome_id placeholder
  for (const op of ops) {
    if (op.op === "create_outcome") continue;

    const outcomeId =
      op.outcome_id === "new" ? (newOutcomeId ?? null) : op.outcome_id;

    switch (op.op) {
      case "add":
        if (op.title) {
          await addTask(op.title, op.description, op.tags, op.time_horizon, source, outcomeId, op.source_url);
        }
        break;
      case "update":
        if (op.id) {
          await updateTask(op.id, {
            title: op.title,
            description: op.description,
            tags: op.tags,
            time_horizon: op.time_horizon,
            status: op.status,
          });
        }
        break;
      case "complete":
        if (op.id) await completeTask(op.id);
        break;
      case "delete":
        if (op.id) await deleteTask(op.id);
        break;
      case "update_outcome":
        if (op.id) {
          await updateOutcome(op.id, {
            title: op.title,
            definition_of_done: op.definition_of_done,
            description: op.description,
          });
        }
        break;
      case "close_outcome":
        if (op.id) await closeOutcome(op.id);
        break;
      case "delete_outcome":
        if (op.id) await deleteOutcome(op.id);
        break;
      case "link_task": {
        const taskId = op.task_id ?? op.id;
        if (taskId && outcomeId) await linkTask(taskId, outcomeId as number);
        break;
      }
      case "unlink_task": {
        const taskId = op.task_id ?? op.id;
        if (taskId) await unlinkTask(taskId);
        break;
      }
    }
  }
}

// ── Maintenance ────────────────────────────────────────────────────────────

export async function runMaintenance(): Promise<MaintenanceResult> {
  const sql = getDb();

  // Idempotency guard: only run once per calendar day (UTC)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lastShift = await getConfig("last_shift_date");
  if (lastShift === today) {
    return { shifted: 0, overdue: 0, duplicates: [] };
  }

  const DAY_NAMES = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayIdx = new Date().getDay();
  const todayName = DAY_NAMES[todayIdx];

  async function countWhere(horizon: string): Promise<number> {
    const result = await sql`
      SELECT COUNT(*) as count FROM tasks
      WHERE time_horizon = ${horizon} AND status NOT IN ('done', 'deleted')
    `;
    return Number(result[0].count);
  }

  // 1. tomorrow → today
  const tomorrowCount = await countWhere("tomorrow");
  if (tomorrowCount > 0) {
    await sql`
      UPDATE tasks SET time_horizon = 'today', updated_at = NOW()
      WHERE time_horizon = 'tomorrow' AND status NOT IN ('done', 'deleted')
    `;
  }

  // 2. Named day that matches today → today
  const todayNameCount = await countWhere(todayName);
  if (todayNameCount > 0) {
    await sql`
      UPDATE tasks SET time_horizon = 'today', updated_at = NOW()
      WHERE time_horizon = ${todayName} AND status NOT IN ('done', 'deleted')
    `;
  }

  // 3. Past named days (day index < today's) → today (overdue)
  let overdueCount = 0;
  const pastDays = DAY_NAMES.filter((_, idx) => idx < todayIdx);
  for (const dayName of pastDays) {
    const cnt = await countWhere(dayName);
    if (cnt > 0) {
      await sql`
        UPDATE tasks SET time_horizon = 'today', updated_at = NOW()
        WHERE time_horizon = ${dayName} AND status NOT IN ('done', 'deleted')
      `;
      overdueCount += cnt;
    }
  }

  // 4. Detect potential duplicate tasks
  const activeRows = await sql`SELECT id, title FROM tasks WHERE status = 'active'`;
  const rows = activeRows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
  }));

  const pairs: Array<{ id1: number; title1: string; id2: number; title2: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (similarityScore(rows[i].title, rows[j].title) > 0.6) {
        pairs.push({
          id1: rows[i].id,
          title1: rows[i].title,
          id2: rows[j].id,
          title2: rows[j].title,
        });
      }
    }
  }

  await setConfig("last_shift_date", today);
  return { shifted: tomorrowCount + todayNameCount, overdue: overdueCount, duplicates: pairs };
}
