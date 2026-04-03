/**
 * perception.ts — Map Claude Code tool events to the 14-dim perception vector.
 *
 * Standalone module: accumulates coding tool events (Bash, Edit, Read, etc.)
 * and produces a normalized 14-dimensional vector for the Director RNN.
 */
export declare const PERCEPTION_DIM = 14;
export declare const PERCEPTION_NAMES: readonly string[];
export declare class PerceptionMapper {
    private filesSeen;
    private fileTouches;
    private toolCount;
    private successCount;
    private failCount;
    private testRuns;
    private testPasses;
    private editCount;
    private recentResults;
    private frictionEvents;
    private messageCount;
    private collaborationSignals;
    constructor();
    /** Reset all accumulated state for a new session. */
    reset(): void;
    /** Process a single tool use event. */
    updateFromToolEvent(toolName: string, toolInput: Record<string, unknown>, success: boolean): void;
    /** Track user message (for conversation_density). */
    updateFromMessage(): void;
    /** Compute the current 14-dim perception vector. */
    getVector(): number[];
}
