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

const DEFAULT_USER_CONTEXT = `Anna is Director of Operations at Horizon Public Service, an organization building a pipeline of people with emerging tech expertise into public policy. She works closely with Joan (the director and her manager), manages team members including Brooke and ZT, and collaborates with Zach A on operations oversight.

Her work spans: hiring rounds with internal capacity building, office management and space decisions, core operations functions with financial compliance, team onboarding, and quarterly goal tracking. A key metric is reducing Joan's workload through proactive communication and smooth execution.

Working patterns: Anna front-loads Joan-dependent items early in the week before potential absences. She batches Slack messages, works in 30-60 minute focused blocks followed by 1-2 hour deep work sessions. Weekly rhythm includes 1:1s with Joan on Fridays and creating plans for the following week before Friday lunch.

Key people: Joan (director/manager), Brooke (being onboarded, taking on project management ownership), ZT (operations), Zach A (operations oversight), Tim (payroll).`;

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
      source      TEXT NOT NULL DEFAULT 'chat',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Migrate existing databases that don't have the source column yet
  await sql`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'chat'
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

  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `;
  console.log("✓ config table ready");

  await sql`
    INSERT INTO config (key, value)
    VALUES ('user_context', ${DEFAULT_USER_CONTEXT})
    ON CONFLICT DO NOTHING
  `;
  console.log("✓ config seeded");

  console.log("\nDatabase setup complete.");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
