import { describe, it, expect } from "vitest";
import { SPECIES_ARCHETYPES, createBuddyTraits } from "../src/species.js";
import { SPECIES_LIST, rollBones } from "../src/identity.js";
import { TraitSystem, TRAIT_COUNT } from "../src/traits.js";

const ts = new TraitSystem();

describe("species", () => {
  it("all 18 species have archetypes", () => {
    for (const sp of SPECIES_LIST) {
      expect(SPECIES_ARCHETYPES[sp]).toBeDefined();
    }
    expect(Object.keys(SPECIES_ARCHETYPES)).toHaveLength(SPECIES_LIST.length);
  });

  it("all trait names in archetypes are valid", () => {
    for (const [species, arch] of Object.entries(SPECIES_ARCHETYPES)) {
      for (const name of arch.high) {
        expect(() => ts.traitIndex(name)).not.toThrow();
      }
      for (const name of arch.low) {
        expect(() => ts.traitIndex(name)).not.toThrow();
      }
    }
  });

  it("createBuddyTraits returns correct shape and range", () => {
    const bones = rollBones("test-user-alpha");
    const traits = createBuddyTraits(bones);
    expect(traits).toHaveLength(TRAIT_COUNT);
    for (const v of traits) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("createBuddyTraits is deterministic for same bones", () => {
    const bones = rollBones("determinism-check");
    const a = createBuddyTraits(bones);
    const b = createBuddyTraits(bones);
    expect(a).toEqual(b);
  });

  it("species bias: cat independence > duck independence", () => {
    // Use seeds that produce the same species reliably
    // Instead, construct bones directly to control species
    const catBones = { species: "cat", traitSeeds: new Array(TRAIT_COUNT).fill(0.5) };
    const duckBones = { species: "duck", traitSeeds: new Array(TRAIT_COUNT).fill(0.5) };
    const catTraits = createBuddyTraits(catBones);
    const duckTraits = createBuddyTraits(duckBones);
    const indIdx = ts.traitIndex("independence");
    // Cat has independence as high, duck does not
    expect(catTraits[indIdx]).toBeGreaterThan(duckTraits[indIdx]);
  });

  it("different seeds produce different traits", () => {
    const bonesA = { species: "owl", traitSeeds: new Array(TRAIT_COUNT).fill(0.1) };
    const bonesB = { species: "owl", traitSeeds: new Array(TRAIT_COUNT).fill(0.9) };
    const traitsA = createBuddyTraits(bonesA);
    const traitsB = createBuddyTraits(bonesB);
    // At least some traits should differ
    const diffs = traitsA.filter((v, i) => Math.abs(v - traitsB[i]) > 0.01);
    expect(diffs.length).toBeGreaterThan(0);
  });
});
