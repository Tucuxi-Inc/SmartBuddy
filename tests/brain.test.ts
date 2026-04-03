// tests/brain.test.ts
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BuddyBrain } from "../src/brain.js";

describe("BuddyBrain", () => {
  it("hatch creates state with valid species", () => {
    const brain = new BuddyBrain();
    const result = brain.hatch("test-user-123");
    expect(result.species).toBeTruthy();
    expect(typeof result.species).toBe("string");
    expect(result.traitsSummary.length).toBeGreaterThan(0);
  });

  it("hatch is deterministic (same userId -> same species)", () => {
    const brain1 = new BuddyBrain();
    const brain2 = new BuddyBrain();
    const r1 = brain1.hatch("determinism-check");
    const r2 = brain2.hatch("determinism-check");
    expect(r1.species).toBe(r2.species);
    expect(r1.traitsSummary).toEqual(r2.traitsSummary);
  });

  it("tick returns action with expression", () => {
    const brain = new BuddyBrain();
    brain.hatch("ticker");
    const result = brain.tick({
      tool_name: "Bash",
      tool_input: { command: "echo hello" },
      success: true,
    });
    expect(result.action).toBeTruthy();
    expect(typeof result.action).toBe("string");
    expect(result.expression).toBeTruthy();
    expect(typeof result.expression).toBe("string");
    expect(Array.isArray(result.spriteFrame)).toBe(true);
  });

  it("getState has required fields", () => {
    const brain = new BuddyBrain();
    brain.hatch("state-test");
    const state = brain.getState();
    expect(state).toHaveProperty("species");
    expect(state).toHaveProperty("dominantTraits");
    expect(state).toHaveProperty("mood");
    expect(state).toHaveProperty("expression");
    expect(state).toHaveProperty("adornments");
    expect(state).toHaveProperty("tickCount");
  });

  it("getCard has required fields", () => {
    const brain = new BuddyBrain();
    brain.hatch("card-test");
    const card = brain.getCard();
    expect(card).toHaveProperty("species");
    expect(card).toHaveProperty("tickCount");
    expect(card).toHaveProperty("traits");
    expect(card).toHaveProperty("traitShifts");
    expect(card).toHaveProperty("emotions");
    expect(card).toHaveProperty("evolutionHistory");
    expect(card).toHaveProperty("adornments");
    expect(card).toHaveProperty("councilActivations");
  });

  it("resetMind resets tickCount to 0", () => {
    const brain = new BuddyBrain();
    brain.hatch("reset-test");
    // Tick a few times
    for (let i = 0; i < 5; i++) {
      brain.tick({
        tool_name: "Edit",
        tool_input: { file_path: "/test.ts" },
        success: true,
      });
    }
    expect(brain.getState().tickCount).toBe(5);
    const result = brain.resetMind();
    expect(result.status).toBe("reset");
    expect(brain.getState().tickCount).toBe(0);
  });

  it("saveMind/loadMind roundtrip", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-test-"));
    const savePath = path.join(tmpDir, "buddy.json");

    try {
      const brain1 = new BuddyBrain();
      brain1.hatch("roundtrip-user");
      // Tick a few times to build state
      brain1.tick({
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        success: true,
      });
      brain1.tick({
        tool_name: "Edit",
        tool_input: { file_path: "/foo.ts" },
        success: false,
      });
      brain1.saveMind(savePath);

      // Load into fresh brain
      const brain2 = new BuddyBrain();
      brain2.loadMind(savePath, "roundtrip-user");

      const state1 = brain1.getState();
      const state2 = brain2.getState();
      expect(state2.species).toBe(state1.species);
      expect(state2.tickCount).toBe(state1.tickCount);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("loadMind falls back to hatch when file missing", () => {
    const brain = new BuddyBrain();
    brain.loadMind("/nonexistent/path/buddy.json", "fallback-user");
    const state = brain.getState();
    expect(state.species).toBeTruthy();
    expect(state.tickCount).toBe(0);
  });

  it("multiple ticks evolve traits (15 fails + 15 passes)", () => {
    const brain = new BuddyBrain();
    brain.hatch("evolution-test");

    const before = brain.getCard().traits;

    // 15 test failures
    for (let i = 0; i < 15; i++) {
      brain.tick({
        tool_name: "Bash",
        tool_input: { command: "npx jest --runInBand" },
        success: false,
      });
    }
    // 15 test passes
    for (let i = 0; i < 15; i++) {
      brain.tick({
        tool_name: "Bash",
        tool_input: { command: "npx jest --runInBand" },
        success: true,
      });
    }

    const after = brain.getCard().traits;

    // At least one trait should have shifted
    const traitNames = Object.keys(before);
    let anyShifted = false;
    for (const name of traitNames) {
      if (Math.abs((after[name] ?? 0) - (before[name] ?? 0)) > 0.001) {
        anyShifted = true;
        break;
      }
    }
    expect(anyShifted).toBe(true);
  });
});
