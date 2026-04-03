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
import { norm, argsortDesc } from "./math.js";

// ---------------------------------------------------------------------------
// Trait count
// ---------------------------------------------------------------------------
export const TRAIT_COUNT = 50;

// ---------------------------------------------------------------------------
// TraitDefinition
// ---------------------------------------------------------------------------
export interface TraitDefinition {
  readonly index: number;
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

// ---------------------------------------------------------------------------
// The 50 traits (indices 0-49)
// ---------------------------------------------------------------------------
export const TRAITS: readonly TraitDefinition[] = [
  // Big Five (0-4)
  { index: 0,  name: "openness",           description: "Openness to experience",               category: "big_five" },
  { index: 1,  name: "conscientiousness",   description: "Organization and discipline",          category: "big_five" },
  { index: 2,  name: "extraversion",        description: "Social energy and outgoingness",       category: "big_five" },
  { index: 3,  name: "agreeableness",       description: "Cooperation and trust in others",      category: "big_five" },
  { index: 4,  name: "neuroticism",         description: "Emotional reactivity and sensitivity", category: "big_five" },

  // Cognitive (5-9)
  { index: 5,  name: "creativity",          description: "Imaginative and inventive thinking",   category: "cognitive" },
  { index: 6,  name: "curiosity",           description: "Desire to explore and learn",          category: "cognitive" },
  { index: 7,  name: "adaptability",        description: "Ability to adjust to new situations",  category: "cognitive" },
  { index: 8,  name: "resilience",          description: "Recovery from setbacks",               category: "cognitive" },
  { index: 9,  name: "ambition",            description: "Drive for achievement",                category: "cognitive" },

  // Social (10-14)
  { index: 10, name: "empathy",             description: "Understanding others' feelings",       category: "social" },
  { index: 11, name: "trust",               description: "Willingness to rely on others",        category: "social" },
  { index: 12, name: "assertiveness",       description: "Directness in communication",          category: "social" },
  { index: 13, name: "self_control",        description: "Restraint and impulse regulation",     category: "social" },
  { index: 14, name: "optimism",            description: "Positive expectation of outcomes",     category: "social" },

  // Emotional (15-19)
  { index: 15, name: "risk_taking",         description: "Willingness to accept uncertainty",    category: "emotional" },
  { index: 16, name: "patience",            description: "Tolerance for delay",                  category: "emotional" },
  { index: 17, name: "humor",               description: "Appreciation of comedy and play",      category: "emotional" },
  { index: 18, name: "independence",        description: "Self-reliance and autonomy",           category: "emotional" },
  { index: 19, name: "sensitivity",         description: "Awareness of subtle stimuli",          category: "emotional" },

  // Behavioral (20-24)
  { index: 20, name: "depth_drive",         description: "Compulsion toward deep processing",    category: "behavioral" },
  { index: 21, name: "dominance",           description: "Desire to lead and control",           category: "behavioral" },
  { index: 22, name: "warmth",              description: "Emotional approachability",             category: "behavioral" },
  { index: 23, name: "discipline",          description: "Adherence to routine and structure",   category: "behavioral" },
  { index: 24, name: "integrity",           description: "Consistency of values and actions",    category: "behavioral" },

  // Social extended (25-27)
  { index: 25, name: "loyalty",             description: "Faithfulness to commitments",          category: "social" },
  { index: 26, name: "competitiveness",     description: "Drive to outperform others",           category: "social" },
  { index: 27, name: "generosity",          description: "Willingness to share resources",       category: "social" },

  // Cognitive extended (28-29)
  { index: 28, name: "pragmatism",          description: "Practical problem-solving focus",      category: "cognitive" },
  { index: 29, name: "idealism",            description: "Pursuit of abstract principles",       category: "cognitive" },

  // Social (30)
  { index: 30, name: "sociability",         description: "Enjoyment of social interaction",      category: "social" },

  // Emotional (31)
  { index: 31, name: "introversion",        description: "Preference for solitude and reflection", category: "emotional" },

  // Cognitive (32-33)
  { index: 32, name: "analytical",          description: "Systematic logical reasoning",         category: "cognitive" },
  { index: 33, name: "intuitive",           description: "Gut-feel pattern recognition",         category: "cognitive" },

  // Emotional (34)
  { index: 34, name: "emotional_stability", description: "Steadiness under pressure",            category: "emotional" },

  // Behavioral (35-36)
  { index: 35, name: "persistence",         description: "Tenacity in pursuing goals",           category: "behavioral" },
  { index: 36, name: "flexibility",         description: "Willingness to change approach",       category: "behavioral" },

  // Emotional (37-38)
  { index: 37, name: "confidence",          description: "Belief in own abilities",              category: "emotional" },
  { index: 38, name: "humility",            description: "Modesty and openness to correction",   category: "emotional" },

  // Social (39)
  { index: 39, name: "cooperativeness",     description: "Tendency to work with others",         category: "social" },

  // Behavioral/Cognitive final block (40-49)
  { index: 40, name: "resourcefulness",     description: "Ability to find creative solutions",   category: "behavioral" },
  { index: 41, name: "adventurousness",     description: "Appetite for novel experiences",       category: "behavioral" },
  { index: 42, name: "caution",             description: "Careful evaluation before acting",     category: "behavioral" },
  { index: 43, name: "traditionalism",      description: "Respect for established ways",         category: "behavioral" },
  { index: 44, name: "innovation",          description: "Drive to create new methods",          category: "cognitive" },
  { index: 45, name: "tolerance",           description: "Acceptance of differing views",        category: "social" },
  { index: 46, name: "expressiveness",      description: "Outward display of inner states",      category: "emotional" },
  { index: 47, name: "stoicism",            description: "Endurance without complaint",          category: "emotional" },
  { index: 48, name: "spirituality",        description: "Sense of transcendent meaning",        category: "emotional" },
  { index: 49, name: "playfulness",         description: "Lighthearted engagement with the world", category: "behavioral" },
];

// ---------------------------------------------------------------------------
// Index look-ups
// ---------------------------------------------------------------------------
export const TRAIT_NAME_TO_INDEX: ReadonlyMap<string, number> = new Map(
  TRAITS.map(t => [t.name, t.index])
);

export const TRAIT_INDEX_TO_NAME: ReadonlyMap<number, string> = new Map(
  TRAITS.map(t => [t.index, t.name])
);

// ---------------------------------------------------------------------------
// Boundary constants for experiential updates
// ---------------------------------------------------------------------------
const TRAIT_BOUNDARY_FADE_THRESHOLD = 0.75;
const TRAIT_FREQUENCY_DEPENDENT_THRESHOLD = 0.70;
const TRAIT_EXPERIENTIAL_MIN = 0.10;
const TRAIT_EXPERIENTIAL_MAX = 0.90;

const _UPPER_FADE_RANGE = TRAIT_EXPERIENTIAL_MAX - TRAIT_BOUNDARY_FADE_THRESHOLD; // 0.15
const _LOWER_FADE_RANGE = (1.0 - TRAIT_BOUNDARY_FADE_THRESHOLD) - TRAIT_EXPERIENTIAL_MIN; // 0.15

// ---------------------------------------------------------------------------
// TraitSystem
// ---------------------------------------------------------------------------
export class TraitSystem {
  get count(): number {
    return TRAIT_COUNT;
  }

  /** Return the integer index of a trait by name. Throws if not found. */
  traitIndex(name: string): number {
    const idx = TRAIT_NAME_TO_INDEX.get(name);
    if (idx === undefined) {
      throw new Error(`Unknown trait name: "${name}"`);
    }
    return idx;
  }

  /**
   * Generate a random trait vector with each value drawn uniformly from [0, 1].
   * Uses Mulberry32 PRNG for deterministic generation.
   */
  randomTraits(rng: Mulberry32): number[] {
    return Array.from({ length: TRAIT_COUNT }, () => rng.nextFloat());
  }

  /**
   * Compute normalised Euclidean distance between two trait vectors.
   * Result is in [0, 1] when both vectors are in [0, 1].
   */
  traitDistance(a: number[], b: number[]): number {
    const diff = a.map((v, i) => v - b[i]);
    return norm(diff) / Math.sqrt(TRAIT_COUNT);
  }

  /**
   * Return the top_n traits with the highest values.
   * Returns array of [traitName, value] tuples sorted descending by value.
   */
  getDominantTraits(traits: number[], topN: number = 5): [string, number][] {
    const indices = argsortDesc(traits).slice(0, topN);
    return indices.map(i => [TRAIT_INDEX_TO_NAME.get(i)!, traits[i]]);
  }
}

// ---------------------------------------------------------------------------
// Experiential update helper
// ---------------------------------------------------------------------------
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
export function dampenTraitUpdate(current: number, delta: number): number {
  // Stage 1: frequency-dependent halving for extreme traits
  if (delta > 0 && current > TRAIT_FREQUENCY_DEPENDENT_THRESHOLD) {
    delta *= 0.5;
  } else if (delta < 0 && current < (1.0 - TRAIT_FREQUENCY_DEPENDENT_THRESHOLD)) {
    delta *= 0.5;
  }

  // Stage 2: boundary fade toward hard limits
  if (delta > 0 && current > TRAIT_BOUNDARY_FADE_THRESHOLD) {
    const headroom = Math.max(TRAIT_EXPERIENTIAL_MAX - current, 0.0);
    delta *= headroom / _UPPER_FADE_RANGE;
  } else if (delta < 0 && current < (1.0 - TRAIT_BOUNDARY_FADE_THRESHOLD)) {
    const headroom = Math.max(current - TRAIT_EXPERIENTIAL_MIN, 0.0);
    delta *= headroom / _LOWER_FADE_RANGE;
  }

  const newVal = current + delta;
  return Math.max(TRAIT_EXPERIENTIAL_MIN, Math.min(TRAIT_EXPERIENTIAL_MAX, newVal));
}
