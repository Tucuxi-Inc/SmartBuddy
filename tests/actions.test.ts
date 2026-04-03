import { describe, it, expect } from "vitest";
import { BuddyAction, SILENT_ACTIONS, SPEECH_ACTIONS, actionToBehavior } from "../src/actions.js";

describe("actions", () => {
  it("BuddyAction has 11 values", () => {
    expect(Object.keys(BuddyAction)).toHaveLength(11);
    expect(BuddyAction.OBSERVE).toBe("observe");
    expect(BuddyAction.CHALLENGE).toBe("challenge");
  });

  it("actionToBehavior", () => {
    const behavior = actionToBehavior(BuddyAction.ENCOURAGE);
    expect(behavior.description).toBeDefined();
    expect(behavior.isSilent).toBe(false);
    expect(behavior.hasSpeech).toBe(true);
  });

  it("silent actions", () => {
    expect(SILENT_ACTIONS.has(BuddyAction.OBSERVE)).toBe(true);
    expect(SILENT_ACTIONS.has(BuddyAction.STUDY)).toBe(true);
    expect(SILENT_ACTIONS.has(BuddyAction.ENCOURAGE)).toBe(false);
  });

  it("speech actions", () => {
    expect(SPEECH_ACTIONS.has(BuddyAction.ENCOURAGE)).toBe(true);
    expect(SPEECH_ACTIONS.has(BuddyAction.CHALLENGE)).toBe(true);
    expect(SPEECH_ACTIONS.has(BuddyAction.OBSERVE)).toBe(false);
  });
});
