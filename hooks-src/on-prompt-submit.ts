import { BuddyBrain } from "../src/brain.js";
import * as fs from "node:fs";
import * as path from "node:path";

const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = "default_user";
const mindPath = path.join(stateDir, "mind.json");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const brain = new BuddyBrain();
    brain.loadMind(mindPath, userId);
    const context = brain.getContext();
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: context,
      },
    }));
  } catch {
    // Silent failure — don't write to stderr, it breaks hook parsing
  }
});
