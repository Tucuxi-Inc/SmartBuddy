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
    const card = brain.getCard();

    // Build full state block so skills never need to find mind.json
    const traitLines = Object.entries(card.traits)
      .map(([name, val]) => {
        const shift = card.traitShifts[name];
        const shiftStr = shift && Math.abs(shift) > 0.001
          ? ` (${shift > 0 ? "+" : ""}${shift.toFixed(3)})`
          : "";
        return `  ${name}: ${(val as number).toFixed(3)}${shiftStr}`;
      })
      .join("\n");

    const emotionLines = card.emotions.length > 0
      ? card.emotions.map(e => `  ${e.emotion}: ${e.intensity.toFixed(2)}`).join("\n")
      : "  (none)";

    const adornmentStr = card.adornments.length > 0
      ? card.adornments.join(", ")
      : "none";

    const evolutionLines = card.evolutionHistory.length > 0
      ? card.evolutionHistory.map(e => `  ${(e as Record<string, unknown>).trigger} (tick ${(e as Record<string, unknown>).tick})`).join("\n")
      : "  (none yet)";

    const councilLines = Object.entries(card.councilActivations)
      .map(([voice, act]) => `  ${voice}: ${(act as number).toFixed(3)}`)
      .join("\n");

    let fullState = `\n\n[SMARTBUDDY_FULL_STATE]`;
    fullState += `\nName: ${card.name} | Species: ${card.species} | Ticks: ${card.tickCount}`;
    fullState += `\nState file: ${mindPath}`;
    fullState += `\n\nTop traits:\n${traitLines}`;
    fullState += `\n\nActive emotions:\n${emotionLines}`;
    fullState += `\n\nAdornments: ${adornmentStr}`;
    fullState += `\n\nEvolution history:\n${evolutionLines}`;
    fullState += `\n\nCouncil activations:\n${councilLines}`;

    // Load the last tick result (sprite + speech) if available
    if (fs.existsSync(lastTickPath)) {
      try {
        const tick = JSON.parse(fs.readFileSync(lastTickPath, "utf-8"));
        const sprite = (tick.spriteFrame ?? []).join("\n");
        if (sprite) {
          fullState += `\n\nCurrent appearance:\n\`\`\`\n${sprite}\n\`\`\``;
        }
        if (tick.speech) {
          fullState += `\nBuddy says: "${tick.speech}"`;
        }
        fullState += `\nExpression: ${tick.expression ?? "neutral"} | Action: ${tick.action ?? "observe"}`;
        if (tick.councilDominant) {
          fullState += ` | Dominant voice: ${tick.councilDominant}`;
        }
      } catch {
        // last_tick.json unreadable — skip display
      }
    }

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: context + fullState,
      },
    }));
  } catch {
    // Silent failure — don't write to stderr, it breaks hook parsing
  }
});
