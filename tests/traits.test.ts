import { describe, it, expect } from "vitest";
import {
  TRAIT_COUNT,
  TRAITS,
  TRAIT_NAME_TO_INDEX,
  TRAIT_INDEX_TO_NAME,
  TraitSystem,
  dampenTraitUpdate,
} from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("traits", () => {
  it("trait count is 50", () => {
    expect(TRAIT_COUNT).toBe(50);
    expect(TRAITS).toHaveLength(50);
  });

  it("all traits have unique indices 0-49", () => {
    const indices = TRAITS.map(t => t.index);
    expect(new Set(indices).size).toBe(50);
    expect([...indices].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, i) => i)
    );
  });

  it("trait name lookup works", () => {
    const ts = new TraitSystem();
    expect(ts.traitIndex("openness")).toBe(0);
    expect(ts.traitIndex("curiosity")).toBe(6);
  });

  it("invalid trait name throws", () => {
    const ts = new TraitSystem();
    expect(() => ts.traitIndex("nonexistent_trait")).toThrow();
  });

  it("randomTraits returns 50 values in [0,1]", () => {
    const ts = new TraitSystem();
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    expect(traits).toHaveLength(50);
    for (const v of traits) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("randomTraits deterministic with same seed", () => {
    const ts = new TraitSystem();
    const a = ts.randomTraits(new Mulberry32(42));
    const b = ts.randomTraits(new Mulberry32(42));
    expect(a).toEqual(b);
  });

  it("traitDistance: zero vs ones gives 0 < d <= 1, self-distance is 0", () => {
    const ts = new TraitSystem();
    const a = new Array(50).fill(0);
    const b = new Array(50).fill(1);
    const d = ts.traitDistance(a, b);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
    expect(ts.traitDistance(a, a)).toBe(0);
  });

  it("getDominantTraits returns correct top traits", () => {
    const ts = new TraitSystem();
    const traits = new Array(50).fill(0);
    traits[6] = 0.95;  // curiosity
    traits[0] = 0.90;  // openness
    const top = ts.getDominantTraits(traits, 2);
    expect(top).toHaveLength(2);
    expect(top[0][0]).toBe("curiosity");
    expect(top[1][0]).toBe("openness");
  });

  it("dampenTraitUpdate stays in bounds", () => {
    // High trait + positive delta: dampened
    const r1 = dampenTraitUpdate(0.85, 0.1);
    expect(r1).toBeLessThanOrEqual(0.90);
    expect(r1).toBeGreaterThan(0.85);

    // Low trait + negative delta: dampened
    const r2 = dampenTraitUpdate(0.15, -0.1);
    expect(r2).toBeGreaterThanOrEqual(0.10);
    expect(r2).toBeLessThan(0.15);

    // Middle trait: no dampening
    const r3 = dampenTraitUpdate(0.5, 0.04);
    expect(Math.abs(r3 - 0.54)).toBeLessThan(0.001);
  });

  it("dampenTraitUpdate hard clamp", () => {
    expect(dampenTraitUpdate(0.89, 0.5)).toBeLessThanOrEqual(0.90);
    expect(dampenTraitUpdate(0.11, -0.5)).toBeGreaterThanOrEqual(0.10);
  });
});
