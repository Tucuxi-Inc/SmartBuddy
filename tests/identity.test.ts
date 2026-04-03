import { describe, it, expect } from "vitest";
import {
  fnv1a32, Mulberry32, rollBones, Bones, SPECIES_LIST, SALT,
} from "../src/identity.js";

describe("identity", () => {
  it("species list has 18 entries", () => {
    expect(SPECIES_LIST).toHaveLength(18);
    expect(SPECIES_LIST).toContain("duck");
    expect(SPECIES_LIST).toContain("cat");
    expect(SPECIES_LIST).toContain("capybara");
  });

  it("fnv1a32 is deterministic", () => {
    const h1 = fnv1a32("test_user_123" + SALT);
    const h2 = fnv1a32("test_user_123" + SALT);
    expect(h1).toBe(h2);
    expect(typeof h1).toBe("number");
  });

  it("fnv1a32 different inputs differ", () => {
    expect(fnv1a32("user_a")).not.toBe(fnv1a32("user_b"));
  });

  it("Mulberry32 is deterministic", () => {
    const rng1 = new Mulberry32(12345);
    const rng2 = new Mulberry32(12345);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("Mulberry32 range", () => {
    const rng = new Mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(2 ** 32);
    }
  });

  it("Mulberry32 nextFloat in [0,1)", () => {
    const rng = new Mulberry32(99);
    for (let i = 0; i < 100; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("Mulberry32 nextGaussian produces varied values", () => {
    const rng = new Mulberry32(77);
    const values = Array.from({ length: 100 }, () => rng.nextGaussian(1.0));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(Math.abs(mean)).toBeLessThan(0.5);
    expect(values.some(v => v < 0)).toBe(true);
  });

  it("rollBones is deterministic", () => {
    const b1 = rollBones("user_abc");
    const b2 = rollBones("user_abc");
    expect(b1.species).toBe(b2.species);
    expect(b1.traitSeeds).toEqual(b2.traitSeeds);
  });

  it("rollBones different users differ", () => {
    const b1 = rollBones("user_abc");
    const b2 = rollBones("user_xyz");
    expect(b1.species !== b2.species || JSON.stringify(b1.traitSeeds) !== JSON.stringify(b2.traitSeeds)).toBe(true);
  });

  it("rollBones species is valid", () => {
    const bones = rollBones("any_user_id");
    expect(SPECIES_LIST).toContain(bones.species);
  });

  it("rollBones trait seeds count and range", () => {
    const bones = rollBones("any_user_id");
    expect(bones.traitSeeds).toHaveLength(50);
    for (const seed of bones.traitSeeds) {
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(1);
    }
  });
});
