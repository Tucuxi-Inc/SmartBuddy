---
name: buddy-card
description: Show your buddy's full stat card with traits, emotions, and evolution history
---

# Buddy Card

Read the buddy's mind.json file from the plugin data directory to get full stats. Display a formatted card showing:

1. **Species** and tick count
2. **Top 10 traits** with current values and shift from creation
3. **Active emotions** with intensity
4. **Recent evolution events**
5. **Earned adornments**
6. **Council activations**

The mind.json location is `${CLAUDE_PLUGIN_DATA}/mind.json` or `~/.smartbuddy/mind.json`.
