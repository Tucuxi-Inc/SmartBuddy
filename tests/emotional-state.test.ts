import { describe, it, expect } from "vitest";
import {
  Emotion,
  EmotionalState,
  EmotionalSystem,
  EMOTION_TRAIT_MODIFIERS,
} from "../src/emotional-state.js";
import { TraitSystem } from "../src/traits.js";

describe("emotional-state", () => {
  it("Emotion has 12 values", () => {
    const values = Object.values(Emotion);
    expect(values).toHaveLength(12);
    expect(values).toContain("joy");
    expect(values).toContain("frustration");
    expect(values).toContain("curiosity");
  });

  it("linear decay math", () => {
    const state: EmotionalState = {
      emotion: Emotion.JOY,
      intensity: 1.0,
      valence: 1.0,
      tickCreated: 0,
      decayTicks: 100,
    };
    expect(EmotionalSystem.currentIntensity(state, 0)).toBe(1.0);
    expect(EmotionalSystem.currentIntensity(state, 50)).toBeCloseTo(0.5, 2);
    expect(EmotionalSystem.currentIntensity(state, 100)).toBe(0.0);
    // Past decay window stays at 0
    expect(EmotionalSystem.currentIntensity(state, 150)).toBe(0.0);
  });

  it("isActive returns false at/after full decay", () => {
    const state: EmotionalState = {
      emotion: Emotion.JOY,
      intensity: 1.0,
      valence: 1.0,
      tickCreated: 0,
      decayTicks: 50,
    };
    expect(EmotionalSystem.isActive(state, 0)).toBe(true);
    expect(EmotionalSystem.isActive(state, 49)).toBe(true);
    expect(EmotionalSystem.isActive(state, 50)).toBe(false);
  });

  it("addEmotion clamps intensity and valence", () => {
    const ts = new TraitSystem();
    const system = new EmotionalSystem(ts);

    const s1 = system.addEmotion(Emotion.CURIOSITY, 0.8, 0.5, 10);
    expect(s1.emotion).toBe(Emotion.CURIOSITY);
    expect(s1.intensity).toBe(0.8);

    // Over-range clamped
    const s2 = system.addEmotion(Emotion.JOY, 1.5, 2.0, 0);
    expect(s2.intensity).toBe(1.0);
    expect(s2.valence).toBe(1.0);

    // Under-range clamped
    const s3 = system.addEmotion(Emotion.ANXIETY, -0.5, -2.0, 0);
    expect(s3.intensity).toBe(0.0);
    expect(s3.valence).toBe(-1.0);
  });

  it("computeTraitModifiers applies decayed weights", () => {
    const ts = new TraitSystem();
    const system = new EmotionalSystem(ts);
    const states = [system.addEmotion(Emotion.JOY, 1.0, 1.0, 0)];
    const mods = system.computeTraitModifiers(states, 0);

    expect(mods).toHaveLength(50);
    // JOY: extraversion +0.10
    expect(mods[ts.traitIndex("extraversion")]).toBeCloseTo(0.10, 4);
    // JOY: optimism +0.15
    expect(mods[ts.traitIndex("optimism")]).toBeCloseTo(0.15, 4);
    // JOY: neuroticism -0.10
    expect(mods[ts.traitIndex("neuroticism")]).toBeCloseTo(-0.10, 4);

    // Half-decayed: intensity 1.0 at tick 25 with 50-tick decay = 0.5
    const halfStates = [system.addEmotion(Emotion.JOY, 1.0, 1.0, 0, 50)];
    const halfMods = system.computeTraitModifiers(halfStates, 25);
    expect(halfMods[ts.traitIndex("extraversion")]).toBeCloseTo(0.05, 4);
  });

  it("decayEmotions filters expired states", () => {
    const ts = new TraitSystem();
    const system = new EmotionalSystem(ts);
    const states = [
      system.addEmotion(Emotion.JOY, 1.0, 1.0, 0, 10),
      system.addEmotion(Emotion.FRUSTRATION, 0.5, -0.5, 0, 100),
    ];
    const filtered = EmotionalSystem.decayEmotions(states, 20);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].emotion).toBe(Emotion.FRUSTRATION);
  });

  it("all 12 emotions have modifier entries", () => {
    const emotionValues = Object.values(Emotion);
    for (const emotion of emotionValues) {
      expect(EMOTION_TRAIT_MODIFIERS).toHaveProperty(emotion);
    }
  });
});
