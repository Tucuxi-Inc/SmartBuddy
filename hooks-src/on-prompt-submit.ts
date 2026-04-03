import { BuddyBrain } from "../src/brain.js";
import * as path from "node:path";

const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = "default_user";
const mindPath = path.join(stateDir, "mind.json");

// Must consume stdin before writing stdout — Claude Code sends hook input on stdin
let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const brain = new BuddyBrain();
    brain.loadMind(mindPath, userId);
    const context = brain.getContext();
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { additionalContext: context },
    }));
  } catch {
    // Silent failure — don't break the user's workflow
  }
});
