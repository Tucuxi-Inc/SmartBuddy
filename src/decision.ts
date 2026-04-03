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
import { TraitSystem, TRAIT_INDEX_TO_NAME, TRAIT_COUNT } from "./traits.js";
import { dot, mul, softmax, zeros } from "./math.js";

// ---------------------------------------------------------------------------
// Action → 6-dim director bias affinity vectors
// ---------------------------------------------------------------------------

/**
 * Maps each buddy action to a 6-dimensional director bias affinity vector.
 * Dimensions: [caution, social, exploration, cooperation, resource, urgency]
 */
export const BUDDY_ACTION_MAP: Record<string, number[]> = {
  observe:         [ 0.2, -0.3, -0.3,  0.0,  0.0, -0.5],
  curious_comment: [-0.2,  0.1,  0.5,  0.1, -0.1,  0.2],
  engage:          [ 0.0,  0.5,  0.0,  0.3,  0.0,  0.1],
  study:           [ 0.2, -0.2,  0.2,  0.0,  0.3, -0.3],
  encourage:       [ 0.0,  0.4,  0.0,  0.5, -0.1,  0.0],
  suggest:         [ 0.0,  0.2,  0.1,  0.2,  0.3,  0.2],
  challenge:       [-0.3,  0.1,  0.0, -0.3,  0.0,  0.4],
  teach:           [ 0.1,  0.3, -0.1,  0.3, -0.2,  0.0],
  emote:           [-0.1,  0.3,  0.1,  0.1, -0.2,  0.1],
  journal:         [ 0.3, -0.1, -0.2,  0.0,  0.2, -0.2],
  gift:            [ 0.1,  0.2,  0.0,  0.3,  0.3, -0.1],
};

/** All action names in insertion order. */
export const BUDDY_ACTIONS: string[] = Object.keys(BUDDY_ACTION_MAP);

// ---------------------------------------------------------------------------
// DecisionResult
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DecisionModel
// ---------------------------------------------------------------------------

export class DecisionModel {
  private readonly traitSystem: TraitSystem;
  private readonly temperature: number;
  /** Pre-generated weight vectors per action: action → number[TRAIT_COUNT], normalized sum=1. */
  private readonly defaultWeights: Map<string, number[]>;

  /**
   * @param traitSystem  The trait system providing trait metadata.
   * @param temperature  Softmax temperature (0 = deterministic argmax).
   * @param weightSeed   Seed for generating default per-action weight vectors.
   */
  constructor(traitSystem: TraitSystem, temperature: number = 1.0, weightSeed: number = 0) {
    this.traitSystem = traitSystem;
    this.temperature = temperature;

    // Pre-generate deterministic weight vectors for all known actions.
    this.defaultWeights = new Map();
    const rng = new Mulberry32(weightSeed);
    for (const action of BUDDY_ACTIONS) {
      const raw = Array.from({ length: TRAIT_COUNT }, () => rng.nextFloat());
      const sum = raw.reduce((a, b) => a + b, 0);
      const normalized = raw.map(v => v / sum);
      this.defaultWeights.set(action, normalized);
    }
  }

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
  decide(
    traits: number[],
    situation: Record<string, number>,
    actions: string[],
    actionWeights?: Map<string, number[]>,
    actionBiases?: Map<string, number>,
    councilModulation?: number[],
    directorBiases?: number[],
    rng?: Mulberry32,
  ): DecisionResult {
    // Apply council modulation: element-wise multiply on traits.
    const effectiveTraits = councilModulation
      ? mul(traits, councilModulation)
      : [...traits];

    // Situation magnitude: mean of |values|, minimum 1.0.
    const sitValues = Object.values(situation);
    const sitMagnitude = sitValues.length > 0
      ? Math.max(sitValues.reduce((s, v) => s + Math.abs(v), 0) / sitValues.length, 1e-10)
      : 1.0;

    // Compute utility for each action.
    const utilities: number[] = [];
    const perActionContributions: number[][] = [];

    for (const action of actions) {
      // Weight vector for this action (custom or default).
      const w = actionWeights?.get(action)
        ?? this.defaultWeights.get(action)
        ?? this._uniformWeights();

      // Per-trait contribution: effective_traits[i] * w[i] * sit_magnitude.
      const contributions = effectiveTraits.map((t, i) => t * w[i] * sitMagnitude);
      perActionContributions.push(contributions);

      let utility = contributions.reduce((a, b) => a + b, 0);

      // Add scalar bias.
      const bias = actionBiases?.get(action) ?? 0;
      utility += bias;

      // Add director bias dot product with action affinity vector.
      if (directorBiases && BUDDY_ACTION_MAP[action]) {
        utility += dot(directorBiases, BUDDY_ACTION_MAP[action]);
      }

      utilities.push(utility);
    }

    // Softmax to get probabilities.
    const probabilities = softmax(utilities, this.temperature);

    // Weighted random selection.
    const chosenIndex = this._weightedSelect(probabilities, rng);
    const chosenAction = actions[chosenIndex];
    const traitContributions = perActionContributions[chosenIndex];

    return {
      chosenAction,
      probabilities,
      traitContributions,
      utilities,
      explain(): Record<string, number> {
        const result: Record<string, number> = {};
        for (let i = 0; i < traitContributions.length; i++) {
          if (Math.abs(traitContributions[i]) > 0.001) {
            const name = TRAIT_INDEX_TO_NAME.get(i);
            if (name) {
              result[name] = traitContributions[i];
            }
          }
        }
        return result;
      },
    };
  }

  /** Uniform weight vector (fallback for unknown actions). */
  private _uniformWeights(): number[] {
    return new Array(TRAIT_COUNT).fill(1.0 / TRAIT_COUNT);
  }

  /** Weighted random selection from a probability distribution. */
  private _weightedSelect(probabilities: number[], rng?: Mulberry32): number {
    const r = rng ? rng.nextFloat() : Math.random();
    let cumulative = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (r < cumulative) return i;
    }
    // Floating-point edge case: return last index.
    return probabilities.length - 1;
  }
}
