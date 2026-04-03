/**
 * Cognitive Council + Director Pool.
 *
 * The Cognitive Council is an 8-voice modulation layer where each sub-agent
 * maps to personality traits via configurable weights. It amplifies or
 * dampens trait influences based on which cognitive voices are strongest.
 *
 * The Director Pool manages a variable number of functional directors drawn
 * from five role types (ANALYST, EVALUATOR, STRATEGIST, CRITIC, INTEGRATOR),
 * each with its own DirectorRNN that learns from experience.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { TraitSystem } from "./traits.js";
import { DirectorRNN, DirectorRNNState } from "./rnn.js";
import { Mulberry32 } from "./identity.js";
/** Maps sub-agent name -> array of [trait_name, weight] pairs. */
export declare const DEFAULT_COUNCIL_WEIGHTS: Record<string, [string, number][]>;
/** Ordered sub-agent names (keys of DEFAULT_COUNCIL_WEIGHTS). */
export declare const SUB_AGENT_NAMES: string[];
/**
 * 8-voice cognitive modulation layer.
 *
 * Each sub-agent has an activation level computed from the agent's traits.
 * The dominant voice influences behaviour; the full council produces a
 * modulation vector that amplifies/dampens trait contributions.
 */
export declare class CognitiveCouncil {
    private traitSystem;
    private enabled;
    private weightVectors;
    private validAgents;
    constructor(traitSystem: TraitSystem, enabled?: boolean, weights?: Record<string, [string, number][]>);
    /**
     * Compute activation level for each sub-agent based on trait values.
     *
     * desperation_factor (0.0-1.0) boosts Hypothalamus (+0.6*df) and
     * Amygdala (+0.4*df) when the agent is under survival pressure.
     */
    getActivations(traits: number[], desperationFactor?: number): Record<string, number>;
    /**
     * Determine which sub-agent is strongest for these traits.
     * Returns null if the council is disabled.
     */
    getDominantVoice(traits: number[]): string | null;
    /**
     * Compute a per-trait modulation vector.
     *
     * Values are centred around 1.0 and clamped to [0.5, 1.5].
     * Traits associated with the dominant voice are amplified (>1);
     * traits from opposing voices are dampened (<1).
     *
     * Returns null if the council is disabled.
     */
    computeCouncilModulation(traits: number[]): number[] | null;
}
/** Functional cognitive role for a director in the pool. */
export declare const DirectorRole: {
    readonly ANALYST: "analyst";
    readonly EVALUATOR: "evaluator";
    readonly STRATEGIST: "strategist";
    readonly CRITIC: "critic";
    readonly INTEGRATOR: "integrator";
};
export type DirectorRoleValue = (typeof DirectorRole)[keyof typeof DirectorRole];
/** Priority order for role assignment when cycling. */
export declare const DIRECTOR_ROLE_PRIORITY: DirectorRoleValue[];
interface Director {
    role: DirectorRoleValue;
    rnn: DirectorRNN;
    totalRuns: number;
    meanOutcome: number;
}
export interface DirectorPoolState {
    director_count: number;
    directors: Record<string, {
        rnn: DirectorRNNState;
        total_runs: number;
        mean_outcome: number;
    }>;
    total_runs?: number;
    mean_outcome?: number;
}
/**
 * Pool of functional directors with variable count (2-12).
 *
 * Directors are drawn from the five DirectorRole types in priority order.
 * When count exceeds 5, roles cycle (e.g., 7 directors = 5 unique + 2
 * repeated from the top of the priority list).
 *
 * Directors are keyed by string identifiers like "analyst_0",
 * "integrator_1", where the suffix is floor(i / 5).
 */
export declare class DirectorPool {
    directorCount: number;
    directors: Map<string, Director>;
    constructor(directorCount?: number, rng?: Mulberry32);
    /**
     * Run RNNs and return their bias vectors.
     *
     * If activeCount is provided, only the first activeCount directors run.
     */
    process(perception: number[], activeCount?: number): Record<string, number[]>;
    /**
     * Train a specific director's RNN from an outcome signal.
     * Also updates the director's running mean outcome.
     */
    learn(key: string, perception: number[], bias: number[], outcome: number): void;
    /** Serialise the entire pool for persistence (snake_case keys). */
    getState(): DirectorPoolState;
    /** Reconstruct a pool from persisted state. */
    static fromState(state: DirectorPoolState): DirectorPool;
}
export {};
