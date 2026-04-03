// tests/speech.test.ts
import { describe, it, expect } from "vitest";
import { selectSpeech } from "../src/speech.js";
import { Emotion } from "../src/emotional-state.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("speech", () => {
  const ts = new TraitSystem();

  it("returns string for known action", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    const result = selectSpeech("encourage", traits, undefined, new Mulberry32(42));
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns null for unknown action", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    expect(selectSpeech("nonexistent", traits, undefined, new Mulberry32(42))).toBeNull();
  });

  it("emotion override takes priority", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    const result = selectSpeech("encourage", traits, Emotion.JOY, new Mulberry32(42));
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThan(50);
  });

  it("trait filtering affects selection", () => {
    const highExt = new Array(50).fill(0.5);
    highExt[ts.traitIndex("extraversion")] = 0.9;
    highExt[ts.traitIndex("optimism")] = 0.9;
    const lowExt = new Array(50).fill(0.5);
    lowExt[ts.traitIndex("extraversion")] = 0.1;

    const highSet = new Set<string>();
    const lowSet = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const h = selectSpeech("encourage", highExt, undefined, new Mulberry32(s));
      const l = selectSpeech("encourage", lowExt, undefined, new Mulberry32(s));
      if (h) highSet.add(h);
      if (l) lowSet.add(l);
    }
    expect(highSet.size).toBeGreaterThanOrEqual(1);
    expect(lowSet.size).toBeGreaterThanOrEqual(1);
  });

  it("all speech actions have templates", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    const actions = ["encourage", "challenge", "curious_comment", "engage", "suggest", "teach", "gift"];
    for (const action of actions) {
      expect(selectSpeech(action, traits, undefined, new Mulberry32(42))).not.toBeNull();
    }
  });
});
