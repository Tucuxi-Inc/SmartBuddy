// tests/sprites.test.ts
import { describe, it, expect } from "vitest";
import {
  EXPRESSIONS, getExpression, getSpriteFrame, checkAdornments,
} from "../src/sprites.js";
import { Emotion } from "../src/emotional-state.js";

describe("sprites", () => {
  it("expressions defined", () => {
    expect(EXPRESSIONS.neutral).toBeDefined();
    expect(EXPRESSIONS.happy).toBeDefined();
    expect(Object.keys(EXPRESSIONS).length).toBeGreaterThanOrEqual(8);
  });

  it("getExpression happy on joy", () => {
    expect(getExpression("encourage", Emotion.JOY, {}, 0.8)).toBe("happy");
  });

  it("getExpression default neutral", () => {
    expect(getExpression("observe", null, {}, 0.5)).toBe("neutral");
  });

  it("getSpriteFrame returns lines", () => {
    const frame = getSpriteFrame("cat", "neutral", 0);
    expect(Array.isArray(frame)).toBe(true);
    expect(frame.length).toBeGreaterThan(0);
    expect(frame.every(l => typeof l === "string")).toBe(true);
  });

  it("checkAdornments battle scars at 60 frustrations", () => {
    const traits = new Array(50).fill(0.5);
    const adornments = checkAdornments(traits, traits, 60, 10);
    expect(adornments).toContain("battle_scars");
  });
});
