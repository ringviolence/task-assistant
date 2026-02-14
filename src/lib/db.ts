import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { Task, TaskRow, TaskOperation } from "./types";

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
    }
  }
}
