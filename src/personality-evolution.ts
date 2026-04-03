/**
 * Personality Evolution — trait shifts from coding session patterns.
 *
 * Triggers (sustained debugging, creative exploration, etc.) produce primary
 * personality shifts plus correlated secondary shifts. All shifts decay
 * linearly over a configurable tick window.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */

import { TraitSystem, TRAIT_NAME_TO_INDEX, dampenTraitUpdate } from "./traits.js";

// ---------------------------------------------------------------------------
// EvolutionTrigger — const enum of 7 coding-session triggers
// ---------------------------------------------------------------------------
export const EvolutionTrigger = {
  SUSTAINED_DEBUGGING: "sustained_debugging",
  CREATIVE_EXPLORATION: "creative_exploration",
  METHODICAL_TESTING: "methodical_testing",
  COLLABORATIVE_SESSION: "collaborative_session",
  LONG_GRIND: "long_grind",
  BREAKTHROUGH: "breakthrough",
  CAUTIOUS_RECOVERY: "cautious_recovery",
} as const;

export type EvolutionTriggerValue = (typeof EvolutionTrigger)[keyof typeof EvolutionTrigger];

// ---------------------------------------------------------------------------
// PersonalityShift
// ---------------------------------------------------------------------------
export interface PersonalityShift {
  readonly traitIndex: number;
  readonly magnitude: number;
  readonly trigger: EvolutionTriggerValue;
  readonly tickCreated: number;
  readonly decayTicks: number;
}

// ---------------------------------------------------------------------------
// TRAIT_CORRELATION_MATRIX — asymmetric pairs keyed as "source,target"
// ---------------------------------------------------------------------------
export const TRAIT_CORRELATION_MATRIX: ReadonlyMap<string, number> = new Map<string, number>([
  ["trust,loyalty", 0.3],              ["loyalty,trust", 0.25],
  ["empathy,warmth", 0.3],            ["warmth,empathy", 0.25],
  ["conscientiousness,discipline", 0.35], ["discipline,conscientiousness", 0.3],
  ["openness,curiosity", 0.3],        ["curiosity,openness", 0.25],
  ["extraversion,sociability", 0.18], ["sociability,extraversion", 0.15],
  ["neuroticism,emotional_stability", -0.2], ["emotional_stability,neuroticism", -0.18],
  ["confidence,assertiveness", 0.3],  ["assertiveness,confidence", 0.25],
  ["resilience,persistence", 0.3],    ["persistence,resilience", 0.25],
  ["creativity,innovation", 0.3],     ["innovation,creativity", 0.25],
  ["agreeableness,cooperativeness", 0.18], ["cooperativeness,agreeableness", 0.15],
  ["ambition,competitiveness", 0.25], ["competitiveness,ambition", 0.2],
  ["optimism,confidence", 0.25],      ["confidence,optimism", 0.2],
  ["risk_taking,adventurousness", 0.3], ["adventurousness,risk_taking", 0.25],
  ["caution,risk_taking", -0.3],      ["risk_taking,caution", -0.25],
  ["patience,self_control", 0.25],    ["self_control,patience", 0.2],
  ["generosity,empathy", 0.2],        ["empathy,generosity", 0.15],
]);

// ---------------------------------------------------------------------------
// EVOLUTION_RULES — trigger → array of [trait_name, direction, base_magnitude]
// ---------------------------------------------------------------------------
type EvolutionRule = readonly [string, number, number];

export const EVOLUTION_RULES: ReadonlyMap<EvolutionTriggerValue, readonly EvolutionRule[]> = new Map([
  [EvolutionTrigger.SUSTAINED_DEBUGGING, [
    ["patience",     +1, 0.02],
    ["self_control", +1, 0.015],
    ["resilience",   +1, 0.01],
    ["risk_taking",  -1, 0.01],
  ] as const],
  [EvolutionTrigger.CREATIVE_EXPLORATION, [
    ["curiosity",       +1, 0.02],
    ["openness",        +1, 0.015],
    ["caution",         -1, 0.01],
    ["adventurousness", +1, 0.01],
  ] as const],
  [EvolutionTrigger.METHODICAL_TESTING, [
    ["conscientiousness", +1, 0.02],
    ["discipline",        +1, 0.015],
    ["patience",          +1, 0.01],
    ["playfulness",       -1, 0.01],
  ] as const],
  [EvolutionTrigger.COLLABORATIVE_SESSION, [
    ["sociability",      +1, 0.02],
    ["empathy",          +1, 0.015],
    ["cooperativeness",  +1, 0.01],
    ["independence",     -1, 0.01],
  ] as const],
  [EvolutionTrigger.LONG_GRIND, [
    ["persistence", +1, 0.02],
    ["resilience",  +1, 0.015],
    ["optimism",    -1, 0.01],
    ["patience",    +1, 0.01],
  ] as const],
  [EvolutionTrigger.BREAKTHROUGH, [
    ["confidence",  +1, 0.03],
    ["optimism",    +1, 0.02],
    ["curiosity",   +1, 0.015],
    ["neuroticism", -1, 0.02],
  ] as const],
  [EvolutionTrigger.CAUTIOUS_RECOVERY, [
    ["caution",            +1, 0.02],
    ["conscientiousness",  +1, 0.015],
    ["risk_taking",        -1, 0.015],
    ["patience",           +1, 0.01],
  ] as const],
]);

// ---------------------------------------------------------------------------
// PersonalityEvolutionEngine
// ---------------------------------------------------------------------------
export class PersonalityEvolutionEngine {
  private readonly ts: TraitSystem;

  constructor(traitSystem: TraitSystem) {
    this.ts = traitSystem;
  }

  /**
   * Create primary + correlated shifts for a trigger.
   *
   * Primary shifts come from EVOLUTION_RULES. For each primary shift, any
   * correlated traits (from TRAIT_CORRELATION_MATRIX) produce secondary shifts
   * whose magnitude is scaled by the correlation coefficient.
   */
  createShift(
    trigger: EvolutionTriggerValue,
    tick: number,
    baseMagnitude: number = 0.05,
    decayTicks: number = 100,
  ): PersonalityShift[] {
    const rules = EVOLUTION_RULES.get(trigger);
    if (!rules) {
      throw new Error(`No evolution rules for trigger: ${trigger}`);
    }

    const shifts: PersonalityShift[] = [];
    // Track which trait indices already have shifts to avoid duplicates
    const seenIndices = new Set<number>();

    // Primary shifts
    for (const [traitName, direction, ruleMagnitude] of rules) {
      const idx = this.ts.traitIndex(traitName);
      const mag = direction * ruleMagnitude * (baseMagnitude / 0.05);
      shifts.push({
        traitIndex: idx,
        magnitude: mag,
        trigger,
        tickCreated: tick,
        decayTicks,
      });
      seenIndices.add(idx);
    }

    // Correlated shifts — walk primary traits through correlation matrix
    for (const [traitName, direction, ruleMagnitude] of rules) {
      // Look for correlations where this trait is the source
      for (const [key, correlation] of TRAIT_CORRELATION_MATRIX) {
        const [source, target] = key.split(",");
        if (source !== traitName) continue;

        const targetIdx = TRAIT_NAME_TO_INDEX.get(target);
        if (targetIdx === undefined) continue;
        if (seenIndices.has(targetIdx)) continue;

        const corMag = direction * ruleMagnitude * correlation * (baseMagnitude / 0.05);
        // Only emit if magnitude is non-negligible
        if (Math.abs(corMag) < 1e-9) continue;

        shifts.push({
          traitIndex: targetIdx,
          magnitude: corMag,
          trigger,
          tickCreated: tick,
          decayTicks,
        });
        seenIndices.add(targetIdx);
      }
    }

    return shifts;
  }

  /**
   * Apply all active shifts to a traits vector (in-place), returning it.
   *
   * Each shift's effective magnitude is linearly decayed based on how many
   * ticks have elapsed since creation. The dampened update function from
   * traits.ts ensures values stay bounded.
   */
  applyShifts(traits: number[], shifts: readonly PersonalityShift[], currentTick: number): number[] {
    for (const shift of shifts) {
      const mag = PersonalityEvolutionEngine.currentMagnitude(shift, currentTick);
      if (Math.abs(mag) < 1e-12) continue;
      traits[shift.traitIndex] = dampenTraitUpdate(traits[shift.traitIndex], mag);
    }
    return traits;
  }

  /**
   * Compute the effective magnitude of a shift at `currentTick`.
   * Linear decay from full magnitude at tickCreated to 0 at tickCreated + decayTicks.
   */
  static currentMagnitude(shift: PersonalityShift, currentTick: number): number {
    const elapsed = currentTick - shift.tickCreated;
    if (elapsed < 0) return shift.magnitude; // future shift — full strength
    if (elapsed >= shift.decayTicks) return 0.0;
    const remaining = 1.0 - elapsed / shift.decayTicks;
    return shift.magnitude * remaining;
  }

  /**
   * Filter shifts to only those still active at `currentTick`.
   */
  static getActiveShifts(shifts: readonly PersonalityShift[], currentTick: number): PersonalityShift[] {
    return shifts.filter(s => {
      const elapsed = currentTick - s.tickCreated;
      return elapsed < s.decayTicks;
    });
  }
}
