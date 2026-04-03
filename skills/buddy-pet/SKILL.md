---
name: buddy-pet
description: Pet your buddy — heart animation and joy boost
---

# Pet Buddy

Use the `buddy_tick` MCP tool with a special "pet" event:
```json
{"tool_name": "_pet", "tool_input": {}, "success": true}
```

This triggers a joy emotion in the buddy's cognitive engine.

Display a short heart animation in text:

```
  <3 <3 <3
  [buddy sprite with happy expression]
  *purrs contentedly*
```

Then show the buddy's reaction using `buddy_state`. The buddy genuinely feels joy from being petted — it's a real emotion in their cognitive system that influences their next decisions.
