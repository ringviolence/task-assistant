import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { Task, TaskRow, TaskOperation, Goals, MaintenanceResult } from "./types";

const DB_DIR = join(process.cwd(), "data");
const DB_PATH = join(DB_DIR, "tasks.db");

const globalForDb = globalThis as unknown as { __db: Database | undefined };

function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    tags: JSON.parse(row.tags),
    time_horizon: row.time_horizon as Task["time_horizon"],
    status: row.status as Task["status"],
  };
}

async function getDb(): Promise<Database> {
  if (globalForDb.__db) return globalForDb.__db;

  const SQL = await initSqlJs();

  let db: Database;
  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      time_horizon TEXT NOT NULL DEFAULT 'later',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      level TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT ''
    )
  `);
  db.run(`INSERT OR IGNORE INTO goals (level) VALUES ('right_now'), ('weekly'), ('quarterly')`);

  // Migrate old time_horizon values to new system
  db.run("UPDATE tasks SET time_horizon = 'soon' WHERE time_horizon = 'this_week'");
  db.run("UPDATE tasks SET time_horizon = 'later' WHERE time_horizon = 'this_month'");

  persist(db);
  globalForDb.__db = db;
  return db;
}

function persist(db: Database) {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

function countWhere(db: Database, horizon: string): number {
  const stmt = db.prepare(
    "SELECT COUNT(*) FROM tasks WHERE time_horizon = ? AND status NOT IN ('done', 'deleted')"
  );
  stmt.bind([horizon]);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return (Object.values(row)[0] as number) ?? 0;
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

function findDuplicates(
  db: Database
): Array<{ id1: number; title1: string; id2: number; title2: string }> {
  const stmt = db.prepare("SELECT id, title FROM tasks WHERE status = 'active'");
  const rows: { id: number; title: string }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: number; title: string };
    rows.push(row);
  }
  stmt.free();

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
  return pairs;
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM tasks WHERE status != 'deleted' ORDER BY id");
  const tasks: Task[] = [];
  while (stmt.step()) {
    tasks.push(rowToTask(stmt.getAsObject() as unknown as TaskRow));
  }
  stmt.free();
  return tasks;
}

export async function addTask(
  title: string,
  description?: string | null,
  tags?: string[],
  time_horizon?: Task["time_horizon"]
): Promise<Task> {
  const db = await getDb();
  db.run(
    "INSERT INTO tasks (title, description, tags, time_horizon) VALUES (?, ?, ?, ?)",
    [title, description ?? null, JSON.stringify(tags ?? []), time_horizon ?? "later"]
  );
  const id = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] as number;
  persist(db);
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  stmt.bind([id]);
  stmt.step();
  const task = rowToTask(stmt.getAsObject() as unknown as TaskRow);
  stmt.free();
  return task;
}

export async function updateTask(
  id: number,
  fields: Partial<Pick<Task, "title" | "description" | "tags" | "time_horizon" | "status">>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: (string | null)[] = [];

  if (fields.title !== undefined) {
    sets.push("title = ?");
    vals.push(fields.title);
  }
  if (fields.description !== undefined) {
    sets.push("description = ?");
    vals.push(fields.description ?? null);
  }
  if (fields.tags !== undefined) {
    sets.push("tags = ?");
    vals.push(JSON.stringify(fields.tags));
  }
  if (fields.time_horizon !== undefined) {
    sets.push("time_horizon = ?");
    vals.push(fields.time_horizon);
  }
  if (fields.status !== undefined) {
    sets.push("status = ?");
    vals.push(fields.status);
  }

  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  vals.push(String(id));
  db.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, vals);
  persist(db);
}

export async function completeTask(id: number): Promise<void> {
  await updateTask(id, { status: "done" });
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM tasks WHERE id = ?", [id]);
  persist(db);
}

export async function getGoals(): Promise<Goals> {
  const db = await getDb();
  const result = db.exec("SELECT level, content FROM goals");
  const goals: Goals = { right_now: "", weekly: "", quarterly: "" };
  if (result.length > 0) {
    for (const row of result[0].values) {
      const level = row[0] as keyof Goals;
      goals[level] = row[1] as string;
    }
  }
  return goals;
}

export async function setGoal(level: string, content: string): Promise<void> {
  const db = await getDb();
  db.run("UPDATE goals SET content = ? WHERE level = ?", [content, level]);
  persist(db);
}

export async function applyOperations(ops: TaskOperation[]): Promise<void> {
  for (const op of ops) {
    switch (op.op) {
      case "add":
        if (op.title) {
          await addTask(op.title, op.description, op.tags, op.time_horizon);
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
  const db = await getDb();

  const DAY_NAMES = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayIdx = new Date().getDay(); // 0=Sun … 6=Sat
  const todayName = DAY_NAMES[todayIdx];

  // 1. tomorrow → today
  const tomorrowCount = countWhere(db, "tomorrow");
  if (tomorrowCount > 0) {
    db.run(
      "UPDATE tasks SET time_horizon = 'today', updated_at = datetime('now') WHERE time_horizon = 'tomorrow' AND status NOT IN ('done', 'deleted')"
    );
  }

  // 2. Named day that matches today → today
  const todayNameCount = countWhere(db, todayName);
  if (todayNameCount > 0) {
    db.run(
      "UPDATE tasks SET time_horizon = 'today', updated_at = datetime('now') WHERE time_horizon = ? AND status NOT IN ('done', 'deleted')",
      [todayName]
    );
  }

  // 3. Past named days (day index < today's) → today (overdue)
  // e.g. if today is Thursday(4), then sunday(0), monday(1), tuesday(2), wednesday(3) are past
  let overdueCount = 0;
  const pastDays = DAY_NAMES.filter((_, idx) => idx < todayIdx);
  for (const dayName of pastDays) {
    const cnt = countWhere(db, dayName);
    if (cnt > 0) {
      db.run(
        "UPDATE tasks SET time_horizon = 'today', updated_at = datetime('now') WHERE time_horizon = ? AND status NOT IN ('done', 'deleted')",
        [dayName]
      );
      overdueCount += cnt;
    }
  }

  // 4. Detect potential duplicate tasks
  const duplicates = findDuplicates(db);

  persist(db);
  return { shifted: tomorrowCount + todayNameCount, overdue: overdueCount, duplicates };
}
