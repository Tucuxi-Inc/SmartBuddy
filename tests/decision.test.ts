import { describe, it, expect } from "vitest";
import {
  BUDDY_ACTION_MAP,
  BUDDY_ACTIONS,
  DecisionModel,
} from "../src/decision.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

const ts = new TraitSystem();

describe("decision", () => {
  it("BUDDY_ACTIONS has 11 entries", () => {
    expect(BUDDY_ACTIONS).toHaveLength(11);
    expect(BUDDY_ACTIONS).toContain("observe");
    expect(BUDDY_ACTIONS).toContain("gift");
  });

  it("action map vectors are 6-dimensional", () => {
    for (const action of BUDDY_ACTIONS) {
      expect(BUDDY_ACTION_MAP[action]).toHaveLength(6);
    }
  });

  it("decide returns a DecisionResult", () => {
    const model = new DecisionModel(ts);
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const situation = { activity: 0.5, novelty: 0.3 };
    const result = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, rng);
    expect(result.chosenAction).toBeDefined();
    expect(BUDDY_ACTIONS).toContain(result.chosenAction);
    expect(result.probabilities).toHaveLength(BUDDY_ACTIONS.length);
    expect(result.utilities).toHaveLength(BUDDY_ACTIONS.length);
  });

  it("probabilities sum to 1", () => {
    const model = new DecisionModel(ts);
    const rng = new Mulberry32(99);
    const traits = ts.randomTraits(rng);
    const situation = { focus: 0.8 };
    const result = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, rng);
    const sum = result.probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("explainability returns trait contributions above threshold", () => {
    const model = new DecisionModel(ts);
    const rng = new Mulberry32(7);
    const traits = ts.randomTraits(rng);
    const situation = { intensity: 1.0 };
    const result = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, rng);
    const explanation = result.explain();
    // explain() returns only entries with |contribution| > 0.001
    for (const [_name, contribution] of Object.entries(explanation)) {
      expect(Math.abs(contribution)).toBeGreaterThan(0.001);
    }
    // Should have at least some contributing traits
    expect(Object.keys(explanation).length).toBeGreaterThan(0);
  });

  it("council modulation affects probabilities", () => {
    const model = new DecisionModel(ts, 1.0, 0);
    const rng1 = new Mulberry32(42);
    const rng2 = new Mulberry32(42);
    const traits = ts.randomTraits(new Mulberry32(42));
    const situation = { activity: 0.5 };

    // No modulation
    const base = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, rng1);

    // With modulation that zeroes out some traits
    const modulation = new Array(50).fill(1.0);
    modulation[0] = 0.0; // zero out openness
    modulation[2] = 0.0; // zero out extraversion
    modulation[6] = 0.0; // zero out curiosity
    const modulated = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, modulation, undefined, rng2);

    // Probabilities should differ when traits are modulated
    let anyDiffers = false;
    for (let i = 0; i < base.probabilities.length; i++) {
      if (Math.abs(base.probabilities[i] - modulated.probabilities[i]) > 1e-6) {
        anyDiffers = true;
        break;
      }
    }
    expect(anyDiffers).toBe(true);
  });

  it("director biases affect decision", () => {
    const model = new DecisionModel(ts, 1.0, 0);
    const rng1 = new Mulberry32(42);
    const rng2 = new Mulberry32(42);
    const traits = ts.randomTraits(new Mulberry32(42));
    const situation = { activity: 0.5 };

    // No director biases
    const base = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, rng1);

    // Strong director bias toward caution (dim 0) — should favor observe/study/journal
    const directorBiases = [5.0, -2.0, -2.0, -2.0, -2.0, -2.0];
    const biased = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, directorBiases, rng2);

    // Probabilities should differ
    let anyDiffers = false;
    for (let i = 0; i < base.probabilities.length; i++) {
      if (Math.abs(base.probabilities[i] - biased.probabilities[i]) > 1e-6) {
        anyDiffers = true;
        break;
      }
    }
    expect(anyDiffers).toBe(true);
  });

  it("temperature 0 is deterministic (argmax)", () => {
    const model = new DecisionModel(ts, 0.0, 0);
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(new Mulberry32(42));
    const situation = { activity: 0.5 };
    const result = model.decide(traits, situation, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, rng);

    // With temperature 0, the max-probability action should have probability 1
    const maxProb = Math.max(...result.probabilities);
    expect(maxProb).toBe(1.0);

    // And only one action should have probability 1
    const onesCount = result.probabilities.filter(p => p === 1.0).length;
    expect(onesCount).toBe(1);
  });
});
