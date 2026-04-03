---
name: buddy-reset
description: Factory reset your buddy — keep species, wipe all learned behavior
---

# Buddy Reset

**This is destructive.** Warn the user:

"This will erase all of your buddy's learned behavior — traits, memories, emotional history, and adornments. They'll keep their species but start with a fresh mind. Are you sure?"

Wait for confirmation. Then delete `${CLAUDE_PLUGIN_DATA}/mind.json` (or `~/.smartbuddy/mind.json`). The next tool use will trigger a fresh hatch.
