# Improvements

- [x] **Next.js dev indicator overlaps chat input** — Disabled via `devIndicators: false` in `next.config.ts`.
- [x] **500 error on first chat message** — Root cause was insufficient API credits. Improved error handling in `route.ts` to surface actual Anthropic API errors instead of a generic 500.

# Roadmap

## Deploy to production
- [ ] **Swap database from sql.js to hosted DB** — sql.js is in-memory with file persistence, which won't work on stateless platforms like Vercel. Options: Vercel Postgres, Neon, or Turso (hosted SQLite). The `db.ts` layer is already isolated so the swap is contained.
- [ ] **Deploy to Vercel** — Set `ANTHROPIC_API_KEY` as an environment variable in project settings. No code changes needed for the API key; the SDK reads it from `process.env` automatically.

## Slack integration (via Zapier)
- [ ] **Smart ingest API route** — New endpoint (e.g. `/api/ingest`) that receives a Slack message or thread from Zapier, passes it through Claude with a Slack-specific system prompt to extract a clean task, and writes it to the database. Avoids storing raw messy Slack content that requires manual cleanup.
- [ ] **Slack-specific system prompt** — One-shot extraction prompt: given a Slack message/thread the user bookmarked, infer the task title, description, urgency, and tags. Simpler than the chat prompt since there's no conversation — just input → structured task.
- [ ] **Zapier workflow** — Slack trigger (e.g. saved message, reaction, or slash command) → HTTP POST to the ingest endpoint. Zapier handles all Slack auth and event listening.
- [ ] **Auth on ingest endpoint** — Shared secret or bearer token to prevent unauthorized POST requests. Store the token in Vercel env vars and validate it in the route.
- [ ] **Thread support** — When available, send the full Slack thread (not just a single message) to give Claude enough context to extract a meaningful task.

## Future input sources
- [ ] The smart ingest pattern generalizes beyond Slack — email forwards, voice memo transcriptions, screenshots, etc. could all go through the same route with source-specific prompt framing.
