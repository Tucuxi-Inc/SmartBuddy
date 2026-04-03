---
name: buddy-card
description: Show your buddy's full stat card with traits, emotions, and evolution history
---

# Buddy Card

The buddy's full state is already in your context — look for the `[SMARTBUDDY_FULL_STATE]` block. Format a stat card from it showing:

1. **Name, species**, and tick count
2. **Sprite** — the ASCII art from "Current appearance"
3. **Top 10 traits** as a table with current values and shifts from creation
4. **Active emotions** with intensity
5. **Active personality shifts** if any traits show non-zero shift values
6. **Council activations** — which voices are dominant
7. **Evolution history** — triggers that fired
8. **Earned adornments**

Do NOT read mind.json from disk — everything you need is in your context.
