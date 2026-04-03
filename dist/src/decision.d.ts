/**
 * Decision Model for SmartBuddy.
 *
 * Computes utility for each candidate action given personality traits,
 * situational context, and optional council/director modulation, then
 * selects an action via softmax-weighted random sampling.
 *
 * Ported from Living Worlds' cognitive engine decision model:
 *   U(a|P,x) = P^T · W · x + b
 *
 * Pure math, no I/O.
 */
import { Mulberry32 } from "./identity.js";
import { TraitSystem } from "./traits.js";
/**
 * Maps each buddy action to a 6-dimensional director bias affinity vector.
 * Dimensions: [caution, social, exploration, cooperation, resource, urgency]
 */
export declare const BUDDY_ACTION_MAP: Record<string, number[]>;
/** All action names in insertion order. */
export declare const BUDDY_ACTIONS: string[];
export interface DecisionResult {
    /** The selected action string. */
    chosenAction: string;
    /** Softmax probability distribution over actions (same order as input actions). */
    probabilities: number[];
    /** Per-trait contribution to the chosen action's utility (length TRAIT_COUNT). */
    traitContributions: number[];
    /** Raw utility values per action (same order as input actions). */
    utilities: number[];
    /**
     * Returns a map of trait name → contribution for the chosen action,
     * filtered to |contribution| > 0.001.
     */
    explain(): Record<string, number>;
}
export declare class DecisionModel {
    private readonly traitSystem;
    private readonly temperature;
    /** Pre-generated weight vectors per action: action → number[TRAIT_COUNT], normalized sum=1. */
    private readonly defaultWeights;
    /**
     * @param traitSystem  The trait system providing trait metadata.
     * @param temperature  Softmax temperature (0 = deterministic argmax).
     * @param weightSeed   Seed for generating default per-action weight vectors.
     */
    constructor(traitSystem: TraitSystem, temperature?: number, weightSeed?: number);
    /**
     * Select an action given personality traits and situational context.
     *
     * @param traits           50-dim trait vector in [0, 1].
     * @param situation        Named situational values (arbitrary keys, values typically in [-1, 1]).
     * @param actions          List of candidate action names to choose from.
     * @param actionWeights    Optional per-action weight overrides: action → number[TRAIT_COUNT].
     * @param actionBiases     Optional per-action scalar bias: action → number.
     * @param councilModulation Optional 50-dim vector, element-wise multiplied onto traits.
     * @param directorBiases   Optional 6-dim director bias vector, dotted with action affinity.
     * @param rng              Optional PRNG for weighted random selection.
     * @returns                DecisionResult with chosen action, probabilities, and explainability.
     */
    decide(traits: number[], situation: Record<string, number>, actions: string[], actionWeights?: Map<string, number[]>, actionBiases?: Map<string, number>, councilModulation?: number[], directorBiases?: number[], rng?: Mulberry32): DecisionResult;
    /** Uniform weight vector (fallback for unknown actions). */
    private _uniformWeights;
    /** Weighted random selection from a probability distribution. */
    private _weightedSelect;
}
