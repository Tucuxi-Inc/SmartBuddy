/**
 * 50-Trait Personality System for SmartBuddy.
 *
 * Implements a 50-dimensional personality trait vector organized into five
 * categories (Big Five, Cognitive, Social, Emotional, Behavioral). Each trait
 * is a continuous value in [0, 1].
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { Mulberry32 } from "./identity.js";
export declare const TRAIT_COUNT = 50;
export interface TraitDefinition {
    readonly index: number;
    readonly name: string;
    readonly description: string;
    readonly category: string;
}
export declare const TRAITS: readonly TraitDefinition[];
export declare const TRAIT_NAME_TO_INDEX: ReadonlyMap<string, number>;
export declare const TRAIT_INDEX_TO_NAME: ReadonlyMap<number, string>;
export declare class TraitSystem {
    get count(): number;
    /** Return the integer index of a trait by name. Throws if not found. */
    traitIndex(name: string): number;
    /**
     * Generate a random trait vector with each value drawn uniformly from [0, 1].
     * Uses Mulberry32 PRNG for deterministic generation.
     */
    randomTraits(rng: Mulberry32): number[];
    /**
     * Compute normalised Euclidean distance between two trait vectors.
     * Result is in [0, 1] when both vectors are in [0, 1].
     */
    traitDistance(a: number[], b: number[]): number;
    /**
     * Return the top_n traits with the highest values.
     * Returns array of [traitName, value] tuples sorted descending by value.
     */
    getDominantTraits(traits: number[], topN?: number): [string, number][];
}
/**
 * Apply delta with frequency-dependent + boundary dampening.
 *
 * Two-stage dampening prevents experiential saturation:
 *
 * Stage 1 (frequency-dependent): When trait > 0.70 (positive delta)
 * or < 0.30 (negative delta), delta is halved.
 *
 * Stage 2 (boundary fade): When trait > 0.75 (positive delta) or
 * < 0.25 (negative delta), delta is further scaled by remaining
 * headroom toward the hard limits.
 *
 * Returns the new trait value clamped to [0.10, 0.90].
 */
export declare function dampenTraitUpdate(current: number, delta: number): number;
