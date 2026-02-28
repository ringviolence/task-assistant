import { neon } from "@neondatabase/serverless";
import type { Task, TaskOperation, Goals, MaintenanceResult } from "./types";

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
  source?: string
): Promise<Task> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO tasks (title, description, tags, time_horizon, source)
    VALUES (${title}, ${description ?? null}, ${JSON.stringify(tags ?? [])}, ${time_horizon ?? "later"}, ${source ?? "chat"})
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

export async function getGoals(): Promise<Goals> {
  const sql = getDb();
  const rows = await sql`SELECT level, content FROM goals`;
  const goals: Goals = { right_now: "", weekly: "", quarterly: "" };
  for (const row of rows) {
    const level = row.level as keyof Goals;
    goals[level] = row.content as string;
  }
  return goals;
}

export async function setGoal(level: string, content: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE goals SET content = ${content} WHERE level = ${level}`;
}

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

export async function applyOperations(ops: TaskOperation[], source?: string): Promise<void> {
  for (const op of ops) {
    switch (op.op) {
      case "add":
        if (op.title) {
          await addTask(op.title, op.description, op.tags, op.time_horizon, source);
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
      case "set_goals":
        if (op.level && op.content !== undefined) await setGoal(op.level, op.content);
        break;
    }
  }
}

export async function runMaintenance(): Promise<MaintenanceResult> {
  const sql = getDb();

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

  return { shifted: tomorrowCount + todayNameCount, overdue: overdueCount, duplicates: pairs };
}
