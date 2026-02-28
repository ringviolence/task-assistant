# Task Assistant — Status

## Done

- **Core app** — Split-screen chat + task list, Claude via Anthropic SDK, non-streaming
- **Neon Postgres** — Tasks, outcomes, config tables; session auth (HMAC cookie)
- **Vercel deploy** — Cron job for daily shift at 9am UTC, environment variables set
- **Reference-based architecture** — Tasks/outcomes not injected into system prompt; user attaches them explicitly via @ button; chips shown at input
- **Outcomes** — Milestones with definition of done; pastel color system; Tasks/Outcomes tabs; linked task rows get a color tint; outcome chips in chat
- **User context** — Static background about the user injected into every system prompt; editable at `/settings`
- **Daily shift idempotency** — Runs once per calendar day via `last_shift_date` in config
- **Ingest endpoint** — `POST /api/ingest` accepts tasks from external sources (Slack via Zapier, Google Tasks, etc.) with source-specific prompting
- **Maintenance endpoint** — `POST /api/maintenance` for duplicate detection and horizon shifting; also called by Vercel Cron

## Possible next work

### Outcomes follow-on
- [ ] **Outcome progress indicator** — Show how many tasks are done vs. total within an outcome (e.g. "3 of 7 tasks done")
- [ ] **Assign tasks to outcomes from task tab** — Currently done through chat; could add a quick-assign UI directly on the task card

### Input sources
- [ ] **Google Tasks sync** — Pull tasks from Google Tasks via the ingest endpoint; source field already supported
- [ ] **Zapier thread support** — Send full Slack thread context (not just the triggering message) for better task extraction

### Context
- [ ] **Context auto-update** — Background job that synthesizes recent conversation history to keep the user context block fresh; currently manually maintained
