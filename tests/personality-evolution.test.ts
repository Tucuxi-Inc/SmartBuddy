import { describe, it, expect } from "vitest";
import {
  EvolutionTrigger,
  PersonalityShift,
  PersonalityEvolutionEngine,
  TRAIT_CORRELATION_MATRIX,
  EVOLUTION_RULES,
} from "../src/personality-evolution.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("personality-evolution", () => {
  it("trigger values match expected strings", () => {
    expect(EvolutionTrigger.SUSTAINED_DEBUGGING).toBe("sustained_debugging");
    expect(EvolutionTrigger.CREATIVE_EXPLORATION).toBe("creative_exploration");
    expect(EvolutionTrigger.METHODICAL_TESTING).toBe("methodical_testing");
    expect(EvolutionTrigger.COLLABORATIVE_SESSION).toBe("collaborative_session");
    expect(EvolutionTrigger.LONG_GRIND).toBe("long_grind");
    expect(EvolutionTrigger.BREAKTHROUGH).toBe("breakthrough");
    expect(EvolutionTrigger.CAUTIOUS_RECOVERY).toBe("cautious_recovery");
  });

  it("shift decay is linear from full to zero", () => {
    const shift: PersonalityShift = {
      traitIndex: 6,
      magnitude: 0.05,
      trigger: EvolutionTrigger.SUSTAINED_DEBUGGING,
      tickCreated: 0,
      decayTicks: 100,
    };
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 0)).toBeCloseTo(0.05, 5);
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 50)).toBeCloseTo(0.025, 3);
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 100)).toBe(0.0);
    // Past decay window is zero
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 150)).toBe(0.0);
  });

  it("createShift produces primary + correlated shifts", () => {
    const ts = new TraitSystem();
    const engine = new PersonalityEvolutionEngine(ts);
    const shifts = engine.createShift(EvolutionTrigger.SUSTAINED_DEBUGGING, 0);
    // Must have more than just primary shifts (correlated ones too)
    expect(shifts.length).toBeGreaterThan(1);
    // All share the same trigger
    for (const s of shifts) {
      expect(s.trigger).toBe(EvolutionTrigger.SUSTAINED_DEBUGGING);
    }
  });

  it("applyShifts modifies traits and stays in bounds", () => {
    const ts = new TraitSystem();
    const engine = new PersonalityEvolutionEngine(ts);
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const original = [...traits];
    const shifts = engine.createShift(EvolutionTrigger.BREAKTHROUGH, 0);
    const updated = engine.applyShifts(traits, shifts, 0);
    // Should be modified
    let anyDifferent = false;
    for (let i = 0; i < updated.length; i++) {
      if (Math.abs(updated[i] - original[i]) > 1e-9) {
        anyDifferent = true;
      }
      expect(updated[i]).toBeGreaterThanOrEqual(0.0);
      expect(updated[i]).toBeLessThanOrEqual(1.0);
    }
    expect(anyDifferent).toBe(true);
  });

  it("applyShifts respects decay — late tick has no effect", () => {
    const ts = new TraitSystem();
    const engine = new PersonalityEvolutionEngine(ts);
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    const shifts = engine.createShift(EvolutionTrigger.SUSTAINED_DEBUGGING, 0, 0.05, 10);

    const earlyTraits = [...traits];
    const updatedEarly = engine.applyShifts(earlyTraits, shifts, 0);
    let earlyChanged = false;
    for (let i = 0; i < traits.length; i++) {
      if (Math.abs(updatedEarly[i] - traits[i]) > 1e-9) earlyChanged = true;
    }
    expect(earlyChanged).toBe(true);

    const lateTraits = [...traits];
    const updatedLate = engine.applyShifts(lateTraits, shifts, 20);
    for (let i = 0; i < traits.length; i++) {
      expect(updatedLate[i]).toBeCloseTo(traits[i], 9);
    }
  });

  it("all triggers have rules", () => {
    const triggerValues = Object.values(EvolutionTrigger);
    for (const trigger of triggerValues) {
      expect(EVOLUTION_RULES.has(trigger)).toBe(true);
    }
  });

  it("correlation matrix has symmetric key pairs", () => {
    for (const key of TRAIT_CORRELATION_MATRIX.keys()) {
      const [a, b] = key.split(",");
      const reverse = `${b},${a}`;
      expect(TRAIT_CORRELATION_MATRIX.has(reverse)).toBe(true);
    }
  });
});
