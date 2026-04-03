import { BuddyBrain } from "../src/brain.js";
import * as path from "node:path";

const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = process.env.CLAUDE_USER_ID ?? "default_user";
const mindPath = path.join(stateDir, "mind.json");

try {
  const brain = new BuddyBrain();
  brain.loadMind(mindPath, userId);
  const context = brain.getContext();
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { additionalContext: context },
  }));
} catch {
  // Silent failure
}
