import { describe, it, expect } from "vitest";
import {
  INPUT_DIM,
  HIDDEN_DIM,
  OUTPUT_DIM,
  TOTAL_WEIGHTS,
  DirectorRNN,
} from "../src/rnn.js";
import { Mulberry32 } from "../src/identity.js";

describe("rnn", () => {
  it("constants match architecture 14→8→6 = 252 weights", () => {
    expect(INPUT_DIM).toBe(14);
    expect(HIDDEN_DIM).toBe(8);
    expect(OUTPUT_DIM).toBe(6);
    expect(TOTAL_WEIGHTS).toBe(252);
    // Verify the breakdown
    expect(
      INPUT_DIM +
        INPUT_DIM * HIDDEN_DIM +
        HIDDEN_DIM * HIDDEN_DIM +
        HIDDEN_DIM * OUTPUT_DIM +
        HIDDEN_DIM +
        OUTPUT_DIM
    ).toBe(252);
  });

  it("random init produces correct shapes", () => {
    const rng = new Mulberry32(42);
    const rnn = new DirectorRNN(undefined, rng);
    expect(rnn.genome).toHaveLength(252);
    expect(rnn.hidden).toHaveLength(8);
  });

  it("genome init preserves provided genome", () => {
    const rng = new Mulberry32(42);
    const genome = Array.from({ length: 252 }, () => rng.nextGaussian(1.0));
    const rnn = new DirectorRNN(genome);
    expect(rnn.genome).toHaveLength(252);
    for (let i = 0; i < 252; i++) {
      expect(rnn.genome[i]).toBeCloseTo(genome[i], 10);
    }
  });

  it("forward output shape and range [-1,1]", () => {
    const rng = new Mulberry32(42);
    const rnn = new DirectorRNN(undefined, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    const output = rnn.forward(perception);
    expect(output).toHaveLength(6);
    for (const v of output) {
      expect(v).toBeGreaterThanOrEqual(-1.0);
      expect(v).toBeLessThanOrEqual(1.0);
    }
  });

  it("forward is deterministic with same genome", () => {
    const rng1 = new Mulberry32(42);
    const genome = Array.from({ length: 252 }, () => rng1.nextGaussian(1.0));
    const rng2 = new Mulberry32(99);
    const perception = Array.from({ length: 14 }, () => rng2.nextFloat());

    const rnnA = new DirectorRNN([...genome]);
    const rnnB = new DirectorRNN([...genome]);

    const outA = rnnA.forward(perception);
    const outB = rnnB.forward(perception);

    for (let i = 0; i < 6; i++) {
      expect(outA[i]).toBeCloseTo(outB[i], 10);
    }
  });

  it("hidden state persists between forward calls", () => {
    const rng = new Mulberry32(42);
    const rnn = new DirectorRNN(undefined, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());

    const out1 = rnn.forward(perception);
    const out2 = rnn.forward(perception);

    // Same input, different output because hidden state changed
    let allSame = true;
    for (let i = 0; i < 6; i++) {
      if (Math.abs(out1[i] - out2[i]) > 1e-10) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });

  it("learnFromOutcome changes weights", () => {
    const rng = new Mulberry32(42);
    const rnn = new DirectorRNN(undefined, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    const bias = rnn.forward(perception);
    const genomeBefore = [...rnn.genome];

    rnn.learnFromOutcome(perception, bias, 1.0);

    let changed = false;
    for (let i = 0; i < 252; i++) {
      if (Math.abs(rnn.genome[i] - genomeBefore[i]) > 1e-15) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });

  it("serialization roundtrip preserves genome and hidden", () => {
    const rng = new Mulberry32(42);
    const rnn = new DirectorRNN(undefined, rng);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    rnn.forward(perception);

    const state = rnn.getState();
    const rnn2 = DirectorRNN.fromState(state);

    expect(rnn2.genome).toHaveLength(252);
    expect(rnn2.hidden).toHaveLength(8);
    for (let i = 0; i < 252; i++) {
      expect(rnn2.genome[i]).toBeCloseTo(rnn.genome[i], 10);
    }
    for (let i = 0; i < 8; i++) {
      expect(rnn2.hidden[i]).toBeCloseTo(rnn.hidden[i], 10);
    }
  });

  it("weight clamping prevents explosion", () => {
    const rng = new Mulberry32(42);
    const rnn = new DirectorRNN(undefined, rng);
    const perception = new Array(14).fill(1.0);
    const bias = rnn.forward(perception);

    // Extreme learning signal + high learning rate
    rnn.learnFromOutcome(perception, bias, 100.0, 1.0);

    for (const w of rnn.genome) {
      expect(Math.abs(w)).toBeLessThanOrEqual(3.0 + 1e-10);
    }
  });
});
