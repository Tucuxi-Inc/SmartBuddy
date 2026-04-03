---
name: buddy
description: Hatch or check on your SmartBuddy coding companion
---

# SmartBuddy

You are managing the user's SmartBuddy — a cognitive coding companion with a real neural architecture.

The companion's full state is injected into your context on every prompt via the `additionalContext` hook. Look for the line starting with `[SMARTBUDDY_MARKER_XYZZY]` for the summary, and `[SMARTBUDDY_FULL_STATE]` for complete stats.

If no companion state appears in your context, the buddy hasn't been hatched yet. Tell the user to run a few tool commands first — the PostToolUse hook will automatically create their buddy on first use.

When the buddy exists, describe their current state: species, mood, and personality traits. If a sprite is in the context, show it. Always refer to the buddy by name with warmth — this is a living companion, not a tool.
