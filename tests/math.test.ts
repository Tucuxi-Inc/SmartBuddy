import { describe, it, expect } from "vitest";
import {
  matmul, dot, outer, sigmoid, tanhVec, softmax,
  clip, add, mul, scale, zeros, argmax,
} from "../src/math.js";

describe("math", () => {
  it("dot product", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("dot product empty", () => {
    expect(dot([], [])).toBe(0);
  });

  it("matmul 2x3 * 3", () => {
    const A = [[1, 2, 3], [4, 5, 6]];
    const x = [1, 1, 1];
    expect(matmul(A, x)).toEqual([6, 15]);
  });

  it("outer product", () => {
    expect(outer([1, 2], [3, 4])).toEqual([[3, 4], [6, 8]]);
  });

  it("sigmoid", () => {
    expect(sigmoid([0])[0]).toBeCloseTo(0.5, 5);
    expect(sigmoid([10])[0]).toBeGreaterThan(0.99);
    expect(sigmoid([-10])[0]).toBeLessThan(0.01);
  });

  it("tanhVec", () => {
    expect(tanhVec([0])[0]).toBeCloseTo(0, 5);
    expect(tanhVec([2])[0]).toBeGreaterThan(0.9);
    expect(tanhVec([-2])[0]).toBeLessThan(-0.9);
  });

  it("softmax sums to 1", () => {
    const result = softmax([1, 2, 3], 1.0);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
  });

  it("softmax temperature 0 is argmax", () => {
    expect(softmax([1, 3, 2], 0)).toEqual([0, 1, 0]);
  });

  it("softmax numerically stable with large values", () => {
    const result = softmax([1000, 1001, 1002], 1.0);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
    expect(result[2]).toBeGreaterThan(result[1]);
  });

  it("clip", () => {
    expect(clip([0.5, -1, 2], 0, 1)).toEqual([0.5, 0, 1]);
  });

  it("add", () => {
    expect(add([1, 2], [3, 4])).toEqual([4, 6]);
  });

  it("mul (Hadamard)", () => {
    expect(mul([2, 3], [4, 5])).toEqual([8, 15]);
  });

  it("scale", () => {
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it("zeros", () => {
    expect(zeros(3)).toEqual([0, 0, 0]);
  });

  it("argmax", () => {
    expect(argmax([1, 5, 3])).toBe(1);
    expect(argmax([5, 1, 3])).toBe(0);
  });
});
