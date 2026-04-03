import { BuddyBrain } from "../src/brain.js";
import * as fs from "node:fs";
import * as path from "node:path";

const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = "default_user";
const mindPath = path.join(stateDir, "mind.json");
const lastTickPath = path.join(stateDir, "last_tick.json");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const brain = new BuddyBrain();
    brain.loadMind(mindPath, userId);
    const context = brain.getContext();

    // Load the last tick result (sprite + speech) if available
    let buddyDisplay = "";
    if (fs.existsSync(lastTickPath)) {
      try {
        const tick = JSON.parse(fs.readFileSync(lastTickPath, "utf-8"));
        const sprite = (tick.spriteFrame ?? []).join("\n");
        if (sprite) {
          buddyDisplay += `\n\nYour buddy's current appearance:\n\`\`\`\n${sprite}\n\`\`\``;
        }
        if (tick.speech) {
          buddyDisplay += `\nBuddy says: "${tick.speech}"`;
        }
        buddyDisplay += `\nExpression: ${tick.expression ?? "neutral"} | Action: ${tick.action ?? "observe"}`;
        if (tick.councilDominant) {
          buddyDisplay += ` | Dominant voice: ${tick.councilDominant}`;
        }
      } catch {
        // last_tick.json unreadable — skip display
      }
    }

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: context + buddyDisplay,
      },
    }));
  } catch {
    // Silent failure — don't write to stderr, it breaks hook parsing
  }
});
