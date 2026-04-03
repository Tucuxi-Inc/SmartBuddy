/**
 * Species Archetypes for SmartBuddy.
 *
 * Maps 18 animal species to trait biases (high/low). Used by createBuddyTraits
 * to generate species-flavoured personality vectors from deterministic Bones.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import type { Bones } from "./identity.js";
export interface SpeciesArchetype {
    high: string[];
    low: string[];
}
export declare const SPECIES_ARCHETYPES: Record<string, SpeciesArchetype>;
/**
 * Generate a 50-dim trait vector biased by species archetype.
 *
 * - High traits: 0.65 + seed * 0.10  (range [0.65, 0.75])
 * - Low traits:  0.25 + seed * 0.10  (range [0.25, 0.35])
 * - Neutral:     0.30 + seed * 0.40  (range [0.30, 0.70])
 */
export declare function createBuddyTraits(bones: Bones): number[];
