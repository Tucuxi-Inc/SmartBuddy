import { describe, it, expect } from "vitest";
import {
  PERCEPTION_DIM,
  PERCEPTION_NAMES,
  PerceptionMapper,
} from "../src/perception.js";

describe("perception", () => {
  it("constants match expected dimensions", () => {
    expect(PERCEPTION_DIM).toBe(14);
    expect(PERCEPTION_NAMES).toHaveLength(14);
  });

  it("initial vector is 14-dim with values in [-1, 1]", () => {
    const mapper = new PerceptionMapper();
    const vec = mapper.getVector();
    expect(vec).toHaveLength(14);
    for (const v of vec) {
      expect(v).toBeGreaterThanOrEqual(-1.0);
      expect(v).toBeLessThanOrEqual(1.0);
    }
  });

  it("bash test pass increases recent_success", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Bash", { command: "pytest tests/ -v" }, true);
    const vec = mapper.getVector();
    // recent_success (dim 9) should be positive
    expect(vec[9]).toBeGreaterThan(0.0);
    // pressure_level (dim 1) should be low
    expect(vec[1]).toBeLessThan(0.5);
  });

  it("bash test fail increases pressure", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Bash", { command: "pytest tests/ -v" }, false);
    const vec = mapper.getVector();
    // pressure_level (dim 1) should increase
    expect(vec[1]).toBeGreaterThan(0.0);
  });

  it("edit increases session depth", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent(
      "Edit",
      { file_path: "/project/src/new_module.py" },
      true,
    );
    const vec = mapper.getVector();
    // session_depth (dim 8) should increase
    expect(vec[8]).toBeGreaterThan(0.0);
  });

  it("novelty increases with new files", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Read", { file_path: "/project/src/a.py" }, true);
    mapper.updateFromToolEvent("Read", { file_path: "/project/src/b.py" }, true);
    mapper.updateFromToolEvent("Read", { file_path: "/project/src/c.py" }, true);
    const vec = mapper.getVector();
    // novelty (dim 5) should be elevated
    expect(vec[5]).toBeGreaterThan(0.0);
  });

  it("familiarity increases with repeated files", () => {
    const mapper = new PerceptionMapper();
    for (let i = 0; i < 5; i++) {
      mapper.updateFromToolEvent(
        "Read",
        { file_path: "/project/src/main.py" },
        true,
      );
    }
    const vec = mapper.getVector();
    // codebase_familiarity (dim 13) should be high
    expect(vec[13]).toBeGreaterThan(0.3);
  });

  it("time of day encoding satisfies sin²+cos²≈1", () => {
    const mapper = new PerceptionMapper();
    const vec = mapper.getVector();
    expect(vec[6]).toBeGreaterThanOrEqual(-1.0);
    expect(vec[6]).toBeLessThanOrEqual(1.0);
    expect(vec[7]).toBeGreaterThanOrEqual(-1.0);
    expect(vec[7]).toBeLessThanOrEqual(1.0);
    // sin² + cos² should be ~1
    expect(Math.abs(vec[6] ** 2 + vec[7] ** 2 - 1.0)).toBeLessThan(0.01);
  });

  it("reset clears accumulated state", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Bash", { command: "ls" }, true);
    mapper.reset();
    const vec = mapper.getVector();
    // After reset, accumulated signals should be zero (except time)
    expect(vec[8]).toBe(0.0); // session_depth
    expect(vec[9]).toBe(0.0); // recent_success
  });
});
