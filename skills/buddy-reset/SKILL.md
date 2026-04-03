---
name: buddy-reset
description: Factory reset your buddy — keep species, wipe all learned behavior
---

# Buddy Reset

**This is destructive.** Warn the user:

"This will erase all of your buddy's learned behavior — traits, memories, emotional history, and adornments. They'll keep their species but start with a fresh mind. Are you sure?"

Wait for explicit confirmation. Then delete the mind.json file (its path is in your context under `[SMARTBUDDY_FULL_STATE]` → "State file:"). The next tool use will trigger a fresh hatch.
