import { describe, it, expect } from "vitest";
import {
  DEFAULT_COUNCIL_WEIGHTS,
  SUB_AGENT_NAMES,
  CognitiveCouncil,
  DirectorRole,
  DIRECTOR_ROLE_PRIORITY,
  DirectorPool,
} from "../src/council.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";
import { OUTPUT_DIM } from "../src/rnn.js";

const ts = new TraitSystem();

describe("council", () => {
  it("sub agent names match expected 8 voices", () => {
    const expected = [
      "cortex", "seer", "oracle", "house",
      "prudence", "hypothalamus", "amygdala", "conscience",
    ];
    expect(SUB_AGENT_NAMES).toEqual(expected);
    expect(SUB_AGENT_NAMES).toHaveLength(8);
  });

  it("activations shape — one entry per sub-agent", () => {
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const council = new CognitiveCouncil(ts);
    const activations = council.getActivations(traits);

    expect(Object.keys(activations)).toHaveLength(8);
    for (const name of SUB_AGENT_NAMES) {
      expect(activations).toHaveProperty(name);
      expect(typeof activations[name]).toBe("number");
    }
  });

  it("dominant voice is one of the sub-agent names", () => {
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const council = new CognitiveCouncil(ts);
    const dominant = council.getDominantVoice(traits);

    expect(dominant).not.toBeNull();
    expect(SUB_AGENT_NAMES).toContain(dominant);
  });

  it("modulation shape is 50 and values in [0.5, 1.5]", () => {
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const council = new CognitiveCouncil(ts);
    const mod = council.computeCouncilModulation(traits);

    expect(mod).not.toBeNull();
    expect(mod!).toHaveLength(50);
    for (const v of mod!) {
      expect(v).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
  });

  it("modulation centered near 1.0", () => {
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const council = new CognitiveCouncil(ts);
    const mod = council.computeCouncilModulation(traits)!;

    // Most values should be near 1.0 — the mean should be close
    const mean = mod.reduce((a, b) => a + b, 0) / mod.length;
    expect(mean).toBeGreaterThan(0.9);
    expect(mean).toBeLessThan(1.1);
  });

  it("disabled council returns null", () => {
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const council = new CognitiveCouncil(ts, false);

    expect(council.getDominantVoice(traits)).toBeNull();
    expect(council.computeCouncilModulation(traits)).toBeNull();
  });

  it("desperation boosts hypothalamus and amygdala", () => {
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const council = new CognitiveCouncil(ts);

    const base = council.getActivations(traits, 0.0);
    const desperate = council.getActivations(traits, 1.0);

    expect(desperate.hypothalamus).toBeCloseTo(base.hypothalamus + 0.6, 10);
    expect(desperate.amygdala).toBeCloseTo(base.amygdala + 0.4, 10);
    // Others unchanged
    expect(desperate.cortex).toBeCloseTo(base.cortex, 10);
    expect(desperate.seer).toBeCloseTo(base.seer, 10);
  });

  it("director roles have correct values", () => {
    expect(DirectorRole.ANALYST).toBe("analyst");
    expect(DirectorRole.EVALUATOR).toBe("evaluator");
    expect(DirectorRole.STRATEGIST).toBe("strategist");
    expect(DirectorRole.CRITIC).toBe("critic");
    expect(DirectorRole.INTEGRATOR).toBe("integrator");
  });

  it("pool creation with default count", () => {
    const rng = new Mulberry32(42);
    const pool = new DirectorPool(5, rng);
    const state = pool.getState();

    expect(state.director_count).toBe(5);
    expect(Object.keys(state.directors)).toHaveLength(5);
    // First 5 keys should be role_0 in priority order
    const keys = Object.keys(state.directors);
    expect(keys).toContain("integrator_0");
    expect(keys).toContain("analyst_0");
    expect(keys).toContain("evaluator_0");
    expect(keys).toContain("strategist_0");
    expect(keys).toContain("critic_0");
  });

  it("pool process returns bias vectors", () => {
    const rng = new Mulberry32(42);
    const pool = new DirectorPool(5, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    const results = pool.process(perception);

    expect(Object.keys(results)).toHaveLength(5);
    for (const [key, bias] of Object.entries(results)) {
      expect(bias).toHaveLength(OUTPUT_DIM);
      for (const v of bias) {
        expect(v).toBeGreaterThanOrEqual(-1.0);
        expect(v).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it("pool learn updates director", () => {
    const rng = new Mulberry32(42);
    const pool = new DirectorPool(5, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    const results = pool.process(perception);

    const key = Object.keys(results)[0];
    const genomeBefore = [...pool.getState().directors[key].rnn.genome];

    pool.learn(key, perception, results[key], 1.0);

    const genomeAfter = pool.getState().directors[key].rnn.genome;
    let changed = false;
    for (let i = 0; i < genomeBefore.length; i++) {
      if (Math.abs(genomeBefore[i] - genomeAfter[i]) > 1e-15) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });

  it("pool serialization roundtrip", () => {
    const rng = new Mulberry32(42);
    const pool = new DirectorPool(5, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    pool.process(perception);

    const state = pool.getState();
    const pool2 = DirectorPool.fromState(state);
    const state2 = pool2.getState();

    expect(state2.director_count).toBe(state.director_count);
    expect(Object.keys(state2.directors)).toHaveLength(5);

    // Verify RNN genomes match
    for (const key of Object.keys(state.directors)) {
      expect(state2.directors[key]).toBeDefined();
      const g1 = state.directors[key].rnn.genome;
      const g2 = state2.directors[key].rnn.genome;
      for (let i = 0; i < g1.length; i++) {
        expect(g2[i]).toBeCloseTo(g1[i], 10);
      }
    }
  });
});
