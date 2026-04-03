import { BuddyBrain } from "../src/brain.js";
import * as path from "node:path";
const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = process.env.CLAUDE_USER_ID ?? "default_user";
const mindPath = path.join(stateDir, "mind.json");
let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
    try {
        const event = JSON.parse(input);
        const toolName = event.tool_name ?? event.toolName ?? "";
        const toolInput = event.tool_input ?? event.toolInput ?? {};
        const success = event.success ?? event.toolResult?.success ?? true;
        const brain = new BuddyBrain();
        brain.loadMind(mindPath, userId);
        const result = brain.tick({ tool_name: toolName, tool_input: toolInput, success });
        brain.saveMind(mindPath);
        if (result.speech) {
            const sprite = result.spriteFrame?.join("\n") ?? "";
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    message: `${sprite}\n\u{1F4AC} ${result.speech}`,
                },
            }));
        }
    }
    catch {
        // Silent failure — don't break user's workflow
    }
});
//# sourceMappingURL=on-tool-use.js.map