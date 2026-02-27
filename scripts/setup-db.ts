/**
 * Initialize the Neon Postgres schema.
 * Run once against a fresh database:
 *   DATABASE_URL=... npx tsx scripts/setup-db.ts
 */
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function setup() {
  console.log("Setting up database schema...");

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      tags        TEXT NOT NULL DEFAULT '[]',
      time_horizon TEXT NOT NULL DEFAULT 'later',
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ tasks table ready");

  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      level   TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT ''
    )
  `;
  console.log("✓ goals table ready");

  await sql`
    INSERT INTO goals (level)
    VALUES ('right_now'), ('weekly'), ('quarterly')
    ON CONFLICT DO NOTHING
  `;
  console.log("✓ goals seeded");

  console.log("\nDatabase setup complete.");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
