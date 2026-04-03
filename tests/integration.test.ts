// tests/integration.test.ts — end-to-end integration tests
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BuddyBrain } from "../src/brain.js";
import { SPECIES_LIST } from "../src/identity.js";

describe("Integration", () => {
  it("full session lifecycle: 20 ticks with mixed tools", () => {
    const brain = new BuddyBrain();
    const hatchResult = brain.hatch("integration_test_user");
    expect(SPECIES_LIST).toContain(hatchResult.species);

    const actionsSeen = new Set<string>();
    const toolNames = ["Bash", "Edit", "Read", "Write", "Grep"];

    for (let i = 0; i < 20; i++) {
      const toolName = toolNames[i % toolNames.length];
      const tickResult = brain.tick({
        tool_name: toolName,
        tool_input: {
          command: toolName === "Bash" ? "pytest tests/" : "",
          file_path: `/project/src/module_${i % 3}.py`,
        },
        success: i % 3 !== 0,
      });
      expect(tickResult.action).toBeTruthy();
      expect(tickResult.expression).toBeTruthy();
      expect(Array.isArray(tickResult.spriteFrame)).toBe(true);
      actionsSeen.add(tickResult.action);
    }

    // Should see at least 2 distinct actions across 20 ticks
    expect(actionsSeen.size).toBeGreaterThanOrEqual(2);

    const state = brain.getState();
    expect(state.tickCount).toBe(20);

    const card = brain.getCard();
    expect(Object.keys(card.traits).length).toBe(10);
    expect(card.councilActivations).toBeTruthy();
    expect(Object.keys(card.councilActivations).length).toBeGreaterThan(0);
  });

  it("save/load preserves evolution after 30 ticks", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-save-"));

    try {
      const brain1 = new BuddyBrain();
      brain1.hatch("persistence_user");

      for (let i = 0; i < 30; i++) {
        brain1.tick({
          tool_name: "Bash",
          tool_input: { command: "pytest" },
          success: i > 15,
        });
      }

      const state1 = brain1.getState();
      const mindPath = path.join(tmpDir, "mind.json");
      brain1.saveMind(mindPath);

      const brain2 = new BuddyBrain();
      brain2.loadMind(mindPath, "persistence_user");

      const state2 = brain2.getState();
      expect(state2.tickCount).toBe(30);
      expect(state2.species).toBe(state1.species);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("two users with same id diverge under different activity", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-div-"));

    try {
      const brainA = new BuddyBrain();
      const brainB = new BuddyBrain();

      brainA.hatch("same_user");
      brainB.hatch("same_user");

      // Same species from same userId
      expect(brainA.getState().species).toBe(brainB.getState().species);

      // User A: repeated test failures (frustration + sustained debugging path)
      for (let i = 0; i < 30; i++) {
        brainA.tick({
          tool_name: "Bash",
          tool_input: { command: "npx jest --runInBand" },
          success: false,
        });
      }

      // User B: all file reads with success (exploration path)
      for (let i = 0; i < 30; i++) {
        brainB.tick({
          tool_name: "Read",
          tool_input: { file_path: `/new/file_${i}.py` },
          success: true,
        });
      }

      // Save both and compare full 50-trait arrays
      const pathA = path.join(tmpDir, "a.json");
      const pathB = path.join(tmpDir, "b.json");
      brainA.saveMind(pathA);
      brainB.saveMind(pathB);

      const dataA = JSON.parse(fs.readFileSync(pathA, "utf-8"));
      const dataB = JSON.parse(fs.readFileSync(pathB, "utf-8"));

      let anyDifferent = false;
      for (let i = 0; i < 50; i++) {
        if (Math.abs(dataA.traits[i] - dataB.traits[i]) > 0.001) {
          anyDifferent = true;
          break;
        }
      }
      expect(anyDifferent).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("getContext returns string with species name and companion", () => {
    const brain = new BuddyBrain();
    brain.hatch("context_user");
    brain.tick({
      tool_name: "Bash",
      tool_input: { command: "ls" },
      success: true,
    });

    const context = brain.getContext();
    expect(typeof context).toBe("string");
    expect(context.length).toBeGreaterThan(20);

    const state = brain.getState();
    expect(context).toContain(state.species);
    expect(context.toLowerCase()).toContain("companion");
  });

  it("mind.json is valid JSON with expected structure", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-json-"));

    try {
      const brain = new BuddyBrain();
      brain.hatch("json_user");
      brain.tick({
        tool_name: "Edit",
        tool_input: { file_path: "x.py" },
        success: true,
      });

      const mindPath = path.join(tmpDir, "mind.json");
      brain.saveMind(mindPath);

      const raw = fs.readFileSync(mindPath, "utf-8");
      const data = JSON.parse(raw);

      expect(SPECIES_LIST).toContain(data.species);
      expect(data.traits).toHaveLength(50);
      expect(data.traits_at_creation).toHaveLength(50);
      expect(data.director_pool).toBeTruthy();
      expect(data.tick_count).toBe(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
