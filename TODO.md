# Improvements

- [x] **Next.js dev indicator overlaps chat input** — Disabled via `devIndicators: false` in `next.config.ts`.
- [x] **500 error on first chat message** — Root cause was insufficient API credits. Improved error handling in `route.ts` to surface actual Anthropic API errors instead of a generic 500.
