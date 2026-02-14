# Task System Concept Note

**One-liner:** A chat-based task system where an LLM maintains your prioritized list, you capture from anywhere, and the list stays sorted against your goals hierarchy without you ever manually organizing it.

## The Core Idea

Something that lives between a to-do list and an assistant. It doesn't act autonomously — you stay in the driver's seat. The intelligence is in the capture, sorting, and surfacing layer. The killer interaction is asking "what's next?" and getting a confident, context-aware answer.

## The Interface

Split-screen app. Left side is a chat conversation with an LLM. Right side is a live, read-only task list rendered from a persistent store. You talk to the left side, and the right side updates. You never manually edit the list — the conversation is the editor.

## How Sorting Works

You give the system a goals hierarchy:
- **Layer 1:** Explicit daily priorities ("here's what matters today")
- **Layer 2:** Weekly goals (used when daily priorities are done or unclear)
- **Layer 3:** Quarterly goals (the background context for everything)

The LLM continuously re-sorts your list against this hierarchy. When you ask "what's next?" it gives you the right answer based on current state. You update your priorities conversationally ("actually the budget is more urgent than the hiring doc this week") and the list reshuffles.

## Capture Methods

### 1. Direct chat input (primary)
You type into the conversation. Can be high-context ("Schedule the lease review for Friday and flag it as urgent") or low-context ("Don't forget to message Joan about the lease"). The LLM figures out whether there's enough information to slot it directly or whether it needs to ask a triage question.

### 2. Global hotkey quick capture (weekend project 5)
Option+Space (or similar) from anywhere on your Mac. A small floating text field appears, you blurb out a thought, hit enter, it disappears. The task lands in the system. Same logic applies — if there's enough context, it gets slotted; if not, it queues for triage next time you open the app.

Inspiration: Things 3's quick capture, but without the manual sorting bottleneck afterward.

### 3. Slack saved messages via webhook (weekend project 2)
When you save a Slack message for later, Zapier sends it to the system's API endpoint. This also covers Google Doc comment notifications, since those show up in Slack anyway — just save the Slack notification and it flows in like any other task.

## Triage Flow

When something arrives without enough context, the system queues it. Next time you check in, the LLM surfaces untriaged items and asks: "When does this need to happen?" You answer conversationally, and it slots into the list.

## Task Structure

Keep the schema minimal. A task is:
- **Title:** A one-line summary, synthesized by the LLM from whatever you said. You can ramble for three minutes in capture mode and the LLM distills it into a clean sentence
- **Description:** Optional detail — bullet points, context, dependencies. The LLM generates this from your blurb, not you
- **Tags:** LLM-generated and flexible (e.g. "hiring", "fellowship", "lease"). The LLM creates and applies tags based on context — you don't maintain a taxonomy
- **Time horizon:** Today / this week / this month / later / someday. Relative, not absolute — these shift automatically as time passes ("this week" becomes "today" on Monday). Not a hard due date unless you explicitly give one. Hard deadlines go on the calendar, not here
- **Status:** Active / done / waiting
- **Created date:** For staleness tracking

No priority scores, no nested subtasks, no complex metadata. The LLM handles prioritization conversationally — the store just needs enough structure to support windowing and filtering.

**Daily time horizon recalculation:** The system needs to shift relative horizons forward as days pass. "This week" tasks become "today" on the relevant day; "this month" tasks become "this week" as the month progresses. This is better than fixed dates because priorities genuinely shift over time — the time horizon is an intention, not a contract.

## The Performance Problem (Key Risk)

If the full task list gets injected into the LLM context on every message, the system gets slow and the LLM gets worse at reasoning over long lists. The fix is a **windowing strategy:**

- **Always in context:** Today's tasks, this week's priorities, anything flagged urgent, untriaged items
- **On request:** "What's coming up in March?" or "Show me everything tagged hiring" — the LLM reaches into the full store
- **Background:** Everything else lives in the database and renders on the right panel, but isn't in the LLM's context by default

This means "what's next?" is fast (reasoning over ~20-30 items), but nothing is ever lost or forgotten.

The right panel always shows the full list — you can scroll and see everything without asking the LLM. The LLM is for interaction, the panel is for overview.

## Interaction Modes

### Daily mode (default)
Tight context window. "What's next?" energy. The LLM surfaces your immediate priorities based on your goals hierarchy and handles triage of new items. You don't get reminded of everything — just what matters right now.

### Weekly review mode
Wider context window. The LLM pulls in the full task list grouped by tags, surfaces things that might be stale or need reprioritization, and asks reflective questions: "Is this still relevant? Has anything shifted?" This is where you update your weekly goals, reassess time horizons, and clean house.

Same data, same app, different system prompt / "skill." The mode determines how much of the store the LLM loads and what kind of conversation it drives.

## Architecture (Weekend Project 1)

- A React app with a two-panel layout
- Left panel: chat interface that sends messages to Claude's API
- Right panel: task list rendered from a persistent store (SQLite or even a JSON file)
- The current task state is injected into the system prompt with each message
- Claude responds conversationally AND outputs structured task updates (e.g. a JSON block)
- The app parses the structured output, updates the store, and re-renders the right panel
- No weekly conversation resets needed — the persistent store means the LLM always knows your full state

## Build Progression

| Phase | What | Key addition |
|-------|------|-------------|
| Weekend 1 | Split-screen chat + persistent task store | Core product |
| Weekend 2 | Slack saved messages via Zapier webhook | First external ingest |
| Weekend 5 | Native Mac app with global hotkey capture | Capture from anywhere |

Each phase is independently useful.

## Future Ideas (Not Core)

### People context
Over time, the system naturally accumulates knowledge about the people you interact with — how Joan likes updates, who's involved in hiring, communication preferences. This could become an explicit, persistent "people store" that helps with things like drafting messages or remembering context about collaborators. Emerges naturally from use rather than requiring upfront setup.

### Work + personal in one system
Start with work context only. Personal tasks are a later addition. They need to be separated in a fundamentally different way than work sub-categories (hiring vs. compliance) — this is a real design problem, not just a tagging question. Solve it later.

## Lessons from the Current System

The current system is Claude conversations in a Project with custom instructions. Key things learned:

**Capture behavior is already right.** "Don't ask clarifying questions at capture time unless unintelligible." Low-friction capture, separate triage. This carries directly into the built version.

**The weekly handoff is a manual serialization hack.** Walk through open tasks, verify status, generate a summary, paste into next week's conversation. This entire ritual disappears with a persistent store — the review part stays, the state-transfer part goes.

**Time awareness matters.** The system needs to know what time it is so it doesn't surface past events as upcoming. Currently requires manual input ("it's 9am"); in a built version the app just knows. Free win.

**The LLM is good at synthesizing messy input.** Three minutes of rambling becomes a clean one-liner with bullet points. This is a core strength to preserve — the schema should support it (title + description) rather than forcing structured input.

**Bridging work and personal is currently manual.** A daily planning reminder says "check your personal Claude for work tasks to transfer." This is a hack that works, and points toward eventually unifying the two contexts.

**Project memory is proto-config.** Claude's accumulated context about colleagues, org structure, and communication preferences is essentially a static config layer that rarely changes. In the built version, this lives separately from the task data — task store for what changes constantly, config/context store for what changes rarely.

## Key Design Decisions

- **The list is read-only.** The LLM is the single source of truth for how tasks get added, prioritized, and completed. This keeps the interaction model clean and avoids sync issues.
- **The LLM doesn't act autonomously.** It captures, sorts, and surfaces. You decide and execute.
- **Triage is conversational.** When the system can't figure out priority on its own, it asks you — it doesn't guess.
- **The failure mode is gentle.** If something sits in triage for a few hours, nothing bad happens.

## Why This Works (The Things 3 Lesson)

Things 3's quick capture was amazing. The bottleneck was everything after capture — keeping tasks sorted, tagged, prioritized, and current was a full-time job. This system keeps the effortless capture but replaces the manual maintenance with an LLM that does the sorting for you, continuously, against your stated goals.
