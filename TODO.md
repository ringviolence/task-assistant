# Improvements

- [ ] **Next.js dev indicator overlaps chat input** — The floating "N" button in dev mode covers the input field. Fix: disable it in `next.config.ts` with `devIndicators: false`, or reposition the chat input to avoid the conflict.
- [ ] **500 error on first chat message** — `page.tsx:38` in `handleSend` — the `/api/chat` POST returns 500. Root cause is in `api/chat/route.ts` — check terminal logs to find the actual error (likely Anthropic API key issue, sql.js init failure, or response parsing).
