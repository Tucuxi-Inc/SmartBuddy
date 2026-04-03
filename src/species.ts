/**
 * Species Archetypes for SmartBuddy.
 *
 * Maps 18 animal species to trait biases (high/low). Used by createBuddyTraits
 * to generate species-flavoured personality vectors from deterministic Bones.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */

import type { Bones } from "./identity.js";
import { TraitSystem, TRAIT_COUNT } from "./traits.js";

const ts = new TraitSystem();

// ---------------------------------------------------------------------------
// SpeciesArchetype
// ---------------------------------------------------------------------------
export interface SpeciesArchetype {
  high: string[];
  low: string[];
}

// ---------------------------------------------------------------------------
// 18 species archetypes
// ---------------------------------------------------------------------------
export const SPECIES_ARCHETYPES: Record<string, SpeciesArchetype> = {
  duck:     { high: ["sociability", "optimism", "adaptability", "extraversion"],             low: ["persistence", "independence"] },
  goose:    { high: ["assertiveness", "loyalty", "persistence", "dominance"],                low: ["agreeableness", "flexibility"] },
  cat:      { high: ["independence", "patience", "self_control", "sensitivity"],             low: ["agreeableness", "sociability"] },
  rabbit:   { high: ["sensitivity", "adaptability", "conscientiousness", "neuroticism"],     low: ["emotional_stability", "risk_taking"] },
  owl:      { high: ["analytical", "patience", "conscientiousness", "depth_drive"],          low: ["playfulness", "extraversion"] },
  penguin:  { high: ["persistence", "loyalty", "sociability", "discipline"],                 low: ["independence", "adventurousness"] },
  turtle:   { high: ["persistence", "caution", "conscientiousness", "patience"],             low: ["risk_taking", "playfulness"] },
  snail:    { high: ["patience", "conscientiousness", "self_control", "humility"],           low: ["assertiveness", "dominance"] },
  dragon:   { high: ["assertiveness", "confidence", "curiosity", "ambition"],                low: ["caution", "agreeableness"] },
  octopus:  { high: ["creativity", "adaptability", "curiosity", "resourcefulness"],          low: ["discipline", "persistence"] },
  axolotl:  { high: ["resilience", "optimism", "adaptability", "emotional_stability"],       low: ["competitiveness", "dominance"] },
  ghost:    { high: ["independence", "creativity", "depth_drive", "introversion"],           low: ["sociability", "extraversion"] },
  robot:    { high: ["conscientiousness", "discipline", "self_control", "analytical"],       low: ["expressiveness", "playfulness"] },
  blob:     { high: ["adaptability", "agreeableness", "resilience", "emotional_stability"],  low: ["assertiveness", "ambition"] },
  cactus:   { high: ["independence", "persistence", "resourcefulness", "stoicism"],          low: ["sociability", "sensitivity"] },
  mushroom: { high: ["depth_drive", "patience", "cooperativeness", "empathy"],               low: ["assertiveness", "dominance"] },
  chonk:    { high: ["emotional_stability", "discipline", "patience", "warmth"],             low: ["ambition", "risk_taking"] },
  capybara: { high: ["sociability", "emotional_stability", "empathy", "agreeableness"],      low: ["neuroticism", "competitiveness"] },
};

// ---------------------------------------------------------------------------
// createBuddyTraits
// ---------------------------------------------------------------------------
/**
 * Generate a 50-dim trait vector biased by species archetype.
 *
 * - High traits: 0.65 + seed * 0.10  (range [0.65, 0.75])
 * - Low traits:  0.25 + seed * 0.10  (range [0.25, 0.35])
 * - Neutral:     0.30 + seed * 0.40  (range [0.30, 0.70])
 */
export function createBuddyTraits(bones: Bones): number[] {
  const archetype = SPECIES_ARCHETYPES[bones.species];
  const highIndices = new Set(archetype.high.map(n => ts.traitIndex(n)));
  const lowIndices = new Set(archetype.low.map(n => ts.traitIndex(n)));

  const traits: number[] = new Array(TRAIT_COUNT);
  for (let i = 0; i < TRAIT_COUNT; i++) {
    if (highIndices.has(i)) {
      traits[i] = 0.65 + bones.traitSeeds[i] * 0.10;
    } else if (lowIndices.has(i)) {
      traits[i] = 0.25 + bones.traitSeeds[i] * 0.10;
    } else {
      traits[i] = 0.30 + bones.traitSeeds[i] * 0.40;
    }
  }
  return traits;
}
