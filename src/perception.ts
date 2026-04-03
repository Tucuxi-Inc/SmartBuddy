/**
 * perception.ts — Map Claude Code tool events to the 14-dim perception vector.
 *
 * Standalone module: accumulates coding tool events (Bash, Edit, Read, etc.)
 * and produces a normalized 14-dimensional vector for the Director RNN.
 */

export const PERCEPTION_DIM = 14;

export const PERCEPTION_NAMES: readonly string[] = [
  "collaboration_density",   // 0
  "pressure_level",          // 1
  "project_health",          // 2
  "session_momentum",        // 3
  "user_consistency",        // 4
  "novelty",                 // 5
  "time_of_day_sin",         // 6
  "time_of_day_cos",         // 7
  "session_depth",           // 8
  "recent_success",          // 9
  "iteration_pattern",       // 10
  "friction_level",          // 11
  "conversation_density",    // 12
  "codebase_familiarity",    // 13
];

const TEST_COMMANDS = ["pytest", "npm test", "cargo test", "go test", "jest", "vitest", "mocha"];
const RISKY_COMMANDS = ["git push --force", "git reset --hard", "rm -rf", "drop table", "git push -f"];

export class PerceptionMapper {
  private filesSeen: Set<string>;
  private fileTouches: Map<string, number>;
  private toolCount: number;
  private successCount: number;
  private failCount: number;
  private testRuns: number;
  private testPasses: number;
  private editCount: number;
  private recentResults: boolean[];
  private frictionEvents: number;
  private messageCount: number;
  private collaborationSignals: number;

  constructor() {
    this.filesSeen = new Set();
    this.fileTouches = new Map();
    this.toolCount = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.testRuns = 0;
    this.testPasses = 0;
    this.editCount = 0;
    this.recentResults = [];
    this.frictionEvents = 0;
    this.messageCount = 0;
    this.collaborationSignals = 0;
  }

  /** Reset all accumulated state for a new session. */
  reset(): void {
    this.filesSeen = new Set();
    this.fileTouches = new Map();
    this.toolCount = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.testRuns = 0;
    this.testPasses = 0;
    this.editCount = 0;
    this.recentResults = [];
    this.frictionEvents = 0;
    this.messageCount = 0;
    this.collaborationSignals = 0;
  }

  /** Process a single tool use event. */
  updateFromToolEvent(
    toolName: string,
    toolInput: Record<string, unknown>,
    success: boolean,
  ): void {
    this.toolCount++;
    this.recentResults.push(success);
    if (this.recentResults.length > 20) {
      this.recentResults.shift();
    }

    if (success) {
      this.successCount++;
    } else {
      this.failCount++;
      this.frictionEvents++;
    }

    // File tracking
    const filePath = (toolInput.file_path as string) ?? "";
    if (filePath) {
      this.filesSeen.add(filePath);
      this.fileTouches.set(filePath, (this.fileTouches.get(filePath) ?? 0) + 1);
    }

    // Tool-specific signals
    if (toolName === "Bash") {
      const cmd = ((toolInput.command as string) ?? "").toLowerCase();
      if (TEST_COMMANDS.some((tc) => cmd.includes(tc))) {
        this.testRuns++;
        if (success) {
          this.testPasses++;
        }
      }
      if (RISKY_COMMANDS.some((rc) => cmd.includes(rc))) {
        this.frictionEvents++;
      }
      if (cmd.includes("git") && (cmd.includes("pr") || cmd.includes("review"))) {
        this.collaborationSignals++;
      }
    } else if (toolName === "Edit" || toolName === "Write") {
      this.editCount++;
    }
  }

  /** Track user message (for conversation_density). */
  updateFromMessage(): void {
    this.messageCount++;
  }

  /** Compute the current 14-dim perception vector. */
  getVector(): number[] {
    const vec = new Array<number>(PERCEPTION_DIM).fill(0);

    // [0] collaboration_density
    vec[0] = Math.min(1.0, this.collaborationSignals / 5.0);

    // [1] pressure_level — recent failures increase pressure
    if (this.toolCount > 0) {
      const recent5 = this.recentResults.slice(-5);
      const failCount = recent5.filter((r) => !r).length;
      vec[1] = failCount / Math.max(recent5.length, 1);
    }

    // [2] project_health — test pass rate
    if (this.testRuns > 0) {
      vec[2] = this.testPasses / this.testRuns;
    } else {
      vec[2] = 0.5; // neutral when no tests run
    }

    // [3] session_momentum — streak of recent successes
    if (this.recentResults.length > 0) {
      let streak = 0;
      for (let i = this.recentResults.length - 1; i >= 0; i--) {
        if (this.recentResults[i]) {
          streak++;
        } else {
          break;
        }
      }
      vec[3] = Math.min(1.0, streak / 5.0);
    }

    // [4] user_consistency — success rate (if enough tools used)
    if (this.toolCount > 5) {
      vec[4] = this.successCount / this.toolCount;
    }

    // [5] novelty — ratio of unique files to total file touches
    let totalTouches = 0;
    for (const count of this.fileTouches.values()) {
      totalTouches += count;
    }
    if (totalTouches > 0) {
      vec[5] = Math.min(1.0, this.filesSeen.size / totalTouches);
    }

    // [6, 7] time_of_day — circadian encoding
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60.0;
    vec[6] = Math.sin((2 * Math.PI * hour) / 24.0);
    vec[7] = Math.cos((2 * Math.PI * hour) / 24.0);

    // [8] session_depth — total tools used, normalized
    vec[8] = Math.min(1.0, this.toolCount / 50.0);

    // [9] recent_success — success rate of last 10
    if (this.recentResults.length > 0) {
      const recent10 = this.recentResults.slice(-10);
      vec[9] = recent10.filter((r) => r).length / recent10.length;
    }

    // [10] iteration_pattern — edit/test balance (TDD signal)
    if (this.editCount > 0 && this.testRuns > 0) {
      vec[10] =
        Math.min(this.testRuns, this.editCount) /
        Math.max(this.testRuns, this.editCount);
    }

    // [11] friction_level — permission denials, errors, risky ops
    vec[11] = Math.min(1.0, this.frictionEvents / 10.0);

    // [12] conversation_density — message frequency
    vec[12] = Math.min(1.0, this.messageCount / 20.0);

    // [13] codebase_familiarity — ratio of repeatedly-accessed files
    if (this.fileTouches.size > 0) {
      let repeatCount = 0;
      for (const count of this.fileTouches.values()) {
        if (count > 1) repeatCount++;
      }
      vec[13] = repeatCount / this.fileTouches.size;
    }

    return vec;
  }
}
