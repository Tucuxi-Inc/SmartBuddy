/**
 * Personality Evolution — trait shifts from coding session patterns.
 *
 * Triggers (sustained debugging, creative exploration, etc.) produce primary
 * personality shifts plus correlated secondary shifts. All shifts decay
 * linearly over a configurable tick window.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { TraitSystem } from "./traits.js";
export declare const EvolutionTrigger: {
    readonly SUSTAINED_DEBUGGING: "sustained_debugging";
    readonly CREATIVE_EXPLORATION: "creative_exploration";
    readonly METHODICAL_TESTING: "methodical_testing";
    readonly COLLABORATIVE_SESSION: "collaborative_session";
    readonly LONG_GRIND: "long_grind";
    readonly BREAKTHROUGH: "breakthrough";
    readonly CAUTIOUS_RECOVERY: "cautious_recovery";
};
export type EvolutionTriggerValue = (typeof EvolutionTrigger)[keyof typeof EvolutionTrigger];
export interface PersonalityShift {
    readonly traitIndex: number;
    readonly magnitude: number;
    readonly trigger: EvolutionTriggerValue;
    readonly tickCreated: number;
    readonly decayTicks: number;
}
export declare const TRAIT_CORRELATION_MATRIX: ReadonlyMap<string, number>;
type EvolutionRule = readonly [string, number, number];
export declare const EVOLUTION_RULES: ReadonlyMap<EvolutionTriggerValue, readonly EvolutionRule[]>;
export declare class PersonalityEvolutionEngine {
    private readonly ts;
    constructor(traitSystem: TraitSystem);
    /**
     * Create primary + correlated shifts for a trigger.
     *
     * Primary shifts come from EVOLUTION_RULES. For each primary shift, any
     * correlated traits (from TRAIT_CORRELATION_MATRIX) produce secondary shifts
     * whose magnitude is scaled by the correlation coefficient.
     */
    createShift(trigger: EvolutionTriggerValue, tick: number, baseMagnitude?: number, decayTicks?: number): PersonalityShift[];
    /**
     * Apply all active shifts to a traits vector (in-place), returning it.
     *
     * Each shift's effective magnitude is linearly decayed based on how many
     * ticks have elapsed since creation. The dampened update function from
     * traits.ts ensures values stay bounded.
     */
    applyShifts(traits: number[], shifts: readonly PersonalityShift[], currentTick: number): number[];
    /**
     * Compute the effective magnitude of a shift at `currentTick`.
     * Linear decay from full magnitude at tickCreated to 0 at tickCreated + decayTicks.
     */
    static currentMagnitude(shift: PersonalityShift, currentTick: number): number;
    /**
     * Filter shifts to only those still active at `currentTick`.
     */
    static getActiveShifts(shifts: readonly PersonalityShift[], currentTick: number): PersonalityShift[];
}
export {};
