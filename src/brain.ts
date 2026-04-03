/**
 * BuddyBrain: the main orchestrator tying all cognitive systems together.
 *
 * Ported from engine/brain.py. Orchestrates perception, emotion, council,
 * directors, decision, evolution, expression, speech, and sprites into
 * a single tick pipeline.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { BuddyAction, SPEECH_ACTIONS } from "./actions.js";
import { CognitiveCouncil, DirectorPool, DirectorPoolState } from "./council.js";
import { DecisionModel, BUDDY_ACTIONS } from "./decision.js";
import {
  Emotion,
  EmotionalState,
  EmotionalSystem,
  EmotionValue,
} from "./emotional-state.js";
import { rollBones, Mulberry32 } from "./identity.js";
import { PerceptionMapper } from "./perception.js";
import {
  EvolutionTrigger,
  EvolutionTriggerValue,
  PersonalityEvolutionEngine,
  PersonalityShift,
} from "./personality-evolution.js";
import { createBuddyTraits } from "./species.js";
import { selectSpeech } from "./speech.js";
import { checkAdornments, getExpression, getSpriteFrame } from "./sprites.js";
import { TraitSystem } from "./traits.js";
import { clip } from "./math.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolEvent {
  tool_name: string;
  tool_input: Record<string, unknown>;
  success: boolean;
}

interface TickResult {
  action: string;
  expression: string;
  speech: string | null;
  spriteFrame: string[];
  councilDominant: string | null;
}

interface HatchResult {
  name: string;
  species: string;
  traitsSummary: [string, number][];
}

interface BuddyState {
  name: string;
  species: string;
  dominantTraits: [string, number][];
  mood: string;
  expression: string;
  adornments: string[];
  tickCount: number;
}

interface BuddyCard {
  name: string;
  species: string;
  tickCount: number;
  traits: Record<string, number>;
  traitShifts: Record<string, number>;
  emotions: { emotion: string; intensity: number }[];
  evolutionHistory: Record<string, unknown>[];
  adornments: string[];
  councilActivations: Record<string, number>;
}

interface ResetResult {
  species: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Serialisation types (snake_case for JSON persistence)
// ---------------------------------------------------------------------------

interface SavedEmotionalState {
  emotion: string;
  intensity: number;
  valence: number;
  tick_created: number;
  decay_ticks: number;
}

interface SavedPersonalityShift {
  trait_index: number;
  magnitude: number;
  trigger: string;
  tick_created: number;
  decay_ticks: number;
}

interface SavedState {
  name?: string;
  species: string;
  traits: number[];
  traits_at_creation: number[];
  director_pool: DirectorPoolState;
  emotional_states: SavedEmotionalState[];
  personality_shifts: SavedPersonalityShift[];
  evolution_history: Record<string, unknown>[];
  tick_count: number;
  frustration_count: number;
  challenge_count: number;
}

// ---------------------------------------------------------------------------
// BuddyBrain
// ---------------------------------------------------------------------------

export class BuddyBrain {
  private _ts: TraitSystem;
  private _council: CognitiveCouncil;
  private _decisionModel: DecisionModel;
  private _emotionalSystem: EmotionalSystem;
  private _evolutionEngine: PersonalityEvolutionEngine;
  private _perception: PerceptionMapper;

  // State (populated by hatch or load)
  private _name: string = "";
  private _species: string = "";
  private _traits: number[] | null = null;
  private _traitsAtCreation: number[] | null = null;
  private _directorPool: DirectorPool | null = null;
  private _emotionalStates: EmotionalState[] = [];
  private _personalityShifts: PersonalityShift[] = [];
  private _evolutionHistory: Record<string, unknown>[] = [];
  private _tickCount: number = 0;
  private _rng: Mulberry32;

  // Session tracking for evolution triggers
  private _sessionFrictionCount: number = 0;
  private _sessionTestFails: number = 0;
  private _sessionTestPasses: number = 0;
  private _frustrationCount: number = 0;
  private _challengeCount: number = 0;
  private _prevMomentum: number = 0.0;

  constructor() {
    this._ts = new TraitSystem();
    this._council = new CognitiveCouncil(this._ts);
    this._decisionModel = new DecisionModel(this._ts);
    this._emotionalSystem = new EmotionalSystem(this._ts);
    this._evolutionEngine = new PersonalityEvolutionEngine(this._ts);
    this._perception = new PerceptionMapper();
    this._rng = new Mulberry32(Date.now() >>> 0);
  }

  // -----------------------------------------------------------------------
  // hatch
  // -----------------------------------------------------------------------

  hatch(userId: string): HatchResult {
    const bones = rollBones(userId);
    this._name = bones.name;
    this._species = bones.species;
    this._traits = createBuddyTraits(bones);
    this._traitsAtCreation = [...this._traits];
    this._directorPool = new DirectorPool(5);
    this._emotionalStates = [];
    this._personalityShifts = [];
    this._evolutionHistory = [];
    this._tickCount = 0;
    this._perception.reset();

    return {
      name: this._name,
      species: this._species,
      traitsSummary: this._ts.getDominantTraits(this._traits, 5),
    };
  }

  // -----------------------------------------------------------------------
  // tick
  // -----------------------------------------------------------------------

  tick(toolEvent: ToolEvent): TickResult {
    if (this._traits === null) {
      throw new Error("Must hatch before ticking");
    }

    this._tickCount += 1;

    // 1. Update perception from tool event
    this._perception.updateFromToolEvent(
      toolEvent.tool_name ?? "",
      (toolEvent.tool_input ?? {}) as Record<string, unknown>,
      toolEvent.success ?? true,
    );

    // 2. Track test outcomes for evolution triggers
    const cmd = (
      ((toolEvent.tool_input ?? {}) as Record<string, unknown>).command ?? ""
    ) as string;
    const cmdLower = cmd.toLowerCase();
    if (
      ["pytest", "npm test", "cargo test", "jest"].some((t) =>
        cmdLower.includes(t),
      )
    ) {
      if (toolEvent.success) {
        this._sessionTestPasses += 1;
      } else {
        this._sessionTestFails += 1;
      }
    }

    // 3. Track friction
    if (!toolEvent.success) {
      this._sessionFrictionCount += 1;
    }

    // 4. Trigger emotions from events
    this._triggerEmotions(toolEvent);

    // 5. Decay emotions
    this._emotionalStates = EmotionalSystem.decayEmotions(
      this._emotionalStates,
      this._tickCount,
    );

    // 6. Apply personality shifts
    this._traits = this._evolutionEngine.applyShifts(
      this._traits,
      this._personalityShifts,
      this._tickCount,
    );

    // 7. Check evolution triggers
    this._checkEvolutionTriggers();

    // 8. Compute perception vector
    const perceptionVec = this._perception.getVector();

    // 9. Run director pool, compute mean bias
    const directorResults = this._directorPool!.process(perceptionVec);
    const directorOutputs = Object.values(directorResults);
    const meanBias = [0, 0, 0, 0, 0, 0];
    for (const output of directorOutputs) {
      for (let d = 0; d < 6; d++) {
        meanBias[d] += output[d];
      }
    }
    if (directorOutputs.length > 0) {
      for (let d = 0; d < 6; d++) {
        meanBias[d] /= directorOutputs.length;
      }
    }

    // 10. Compute council modulation
    const councilActivations = this._council.getActivations(this._traits);
    const councilMod = this._council.computeCouncilModulation(this._traits);

    // 11. Apply emotional modifiers to traits
    const emotionMods = this._emotionalSystem.computeTraitModifiers(
      this._emotionalStates,
      this._tickCount,
    );
    const effectiveTraits = clip(
      this._traits.map((t, i) => t + emotionMods[i]),
      0.0,
      1.0,
    );

    // 12. Decide action
    const result = this._decisionModel.decide(
      effectiveTraits,
      { tick: this._tickCount / 100.0 },
      BUDDY_ACTIONS,
      undefined, // actionWeights
      undefined, // actionBiases
      councilMod ?? undefined,
      meanBias,
      this._rng,
    );

    const actionName = result.chosenAction;
    if (actionName === "challenge") {
      this._challengeCount += 1;
    }

    // 13. REINFORCE learning
    const reward = this._computeReward(toolEvent);
    for (const [key, bias] of Object.entries(directorResults)) {
      this._directorPool!.learn(key, perceptionVec, bias, reward);
    }

    // 14. Determine expression
    const dominantEmotion = this._getDominantEmotion();
    const expression = getExpression(
      actionName,
      dominantEmotion,
      councilActivations,
      perceptionVec[3],
    );

    // 15. Select speech
    let speech: string | null = null;
    if (SPEECH_ACTIONS.has(actionName)) {
      speech = selectSpeech(
        actionName,
        effectiveTraits,
        dominantEmotion,
        this._rng,
      );
    }

    // 16. Get sprite frame
    const spriteFrame = getSpriteFrame(
      this._species,
      expression,
      this._tickCount,
    );

    this._prevMomentum = perceptionVec[3];

    return {
      action: actionName,
      expression,
      speech,
      spriteFrame,
      councilDominant: this._council.getDominantVoice(this._traits),
    };
  }

  // -----------------------------------------------------------------------
  // getState
  // -----------------------------------------------------------------------

  getState(): BuddyState {
    if (this._traits === null) {
      throw new Error("Must hatch before getting state");
    }
    const dominantEmotion = this._getDominantEmotion();
    const adornments = checkAdornments(
      this._traits,
      this._traitsAtCreation!,
      this._frustrationCount,
      this._challengeCount,
    );
    const expression = getExpression(
      "observe",
      dominantEmotion,
      this._council.getActivations(this._traits),
      0.5,
    );
    return {
      name: this._name,
      species: this._species,
      dominantTraits: this._ts.getDominantTraits(this._traits, 5),
      mood: dominantEmotion ?? "neutral",
      expression,
      adornments,
      tickCount: this._tickCount,
    };
  }

  // -----------------------------------------------------------------------
  // getCard
  // -----------------------------------------------------------------------

  getCard(): BuddyCard {
    if (this._traits === null) {
      throw new Error("Must hatch before getting card");
    }
    const dominantTraitPairs = this._ts.getDominantTraits(this._traits, 10);
    const traits: Record<string, number> = {};
    const traitShifts: Record<string, number> = {};
    for (const [name] of dominantTraitPairs) {
      const idx = this._ts.traitIndex(name);
      traits[name] = this._traits[idx];
      traitShifts[name] = this._traits[idx] - this._traitsAtCreation![idx];
    }

    const emotions: { emotion: string; intensity: number }[] = [];
    for (const s of this._emotionalStates) {
      if (EmotionalSystem.isActive(s, this._tickCount)) {
        emotions.push({
          emotion: s.emotion,
          intensity: EmotionalSystem.currentIntensity(s, this._tickCount),
        });
      }
    }

    return {
      name: this._name,
      species: this._species,
      tickCount: this._tickCount,
      traits,
      traitShifts,
      emotions,
      evolutionHistory: this._evolutionHistory.slice(-10),
      adornments: checkAdornments(
        this._traits,
        this._traitsAtCreation!,
        this._frustrationCount,
        this._challengeCount,
      ),
      councilActivations: this._council.getActivations(this._traits),
    };
  }

  // -----------------------------------------------------------------------
  // getContext
  // -----------------------------------------------------------------------

  getContext(): string {
    if (this._traits === null) {
      throw new Error("Must hatch before getting context");
    }
    const dominant = this._ts.getDominantTraits(this._traits, 3);
    const mood = this._getDominantEmotion();
    const moodStr = mood ?? "neutral";
    const traitStr = dominant
      .map(([name, val]) => `${name}(${val.toFixed(1)})`)
      .join(", ");
    return (
      `[SMARTBUDDY_MARKER_XYZZY] ` +
      `Your coding companion is ${this._name} the ${this._species}. ` +
      `Current mood: ${moodStr}. Key traits: ${traitStr}. ` +
      `The companion is a separate entity with its own personality — ` +
      `if the user addresses them by name, respond in character.`
    );
  }

  // -----------------------------------------------------------------------
  // resetMind
  // -----------------------------------------------------------------------

  resetMind(): ResetResult {
    this._traits = [...this._traitsAtCreation!];
    this._directorPool = new DirectorPool(5);
    this._emotionalStates = [];
    this._personalityShifts = [];
    this._evolutionHistory = [];
    this._tickCount = 0;
    this._frustrationCount = 0;
    this._challengeCount = 0;
    this._perception.reset();
    return { species: this._species, status: "reset" };
  }

  // -----------------------------------------------------------------------
  // saveMind
  // -----------------------------------------------------------------------

  saveMind(filePath: string): void {
    const state: SavedState = {
      name: this._name,
      species: this._species,
      traits: [...this._traits!],
      traits_at_creation: [...this._traitsAtCreation!],
      director_pool: this._directorPool!.getState(),
      emotional_states: this._emotionalStates.map((s) => ({
        emotion: s.emotion,
        intensity: s.intensity,
        valence: s.valence,
        tick_created: s.tickCreated,
        decay_ticks: s.decayTicks,
      })),
      personality_shifts: this._personalityShifts.map((s) => ({
        trait_index: s.traitIndex,
        magnitude: s.magnitude,
        trigger: s.trigger,
        tick_created: s.tickCreated,
        decay_ticks: s.decayTicks,
      })),
      evolution_history: this._evolutionHistory,
      tick_count: this._tickCount,
      frustration_count: this._frustrationCount,
      challenge_count: this._challengeCount,
    };
    const dir = path.dirname(filePath) || ".";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  // -----------------------------------------------------------------------
  // loadMind
  // -----------------------------------------------------------------------

  loadMind(filePath: string, userId: string): void {
    if (!fs.existsSync(filePath)) {
      this.hatch(userId);
      return;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const state: SavedState = JSON.parse(raw);

    this._species = state.species;
    // Derive name for existing buddies that predate name generation
    this._name = state.name ?? rollBones(userId).name;
    this._traits = [...state.traits];
    this._traitsAtCreation = [...state.traits_at_creation];
    this._directorPool = DirectorPool.fromState(state.director_pool);
    this._emotionalStates = (state.emotional_states ?? []).map(
      (s: SavedEmotionalState): EmotionalState => ({
        emotion: s.emotion as EmotionValue,
        intensity: s.intensity,
        valence: s.valence,
        tickCreated: s.tick_created,
        decayTicks: s.decay_ticks,
      }),
    );
    this._personalityShifts = (state.personality_shifts ?? []).map(
      (s: SavedPersonalityShift): PersonalityShift => ({
        traitIndex: s.trait_index,
        magnitude: s.magnitude,
        trigger: s.trigger as EvolutionTriggerValue,
        tickCreated: s.tick_created,
        decayTicks: s.decay_ticks,
      }),
    );
    this._evolutionHistory = state.evolution_history ?? [];
    this._tickCount = state.tick_count ?? 0;
    this._frustrationCount = state.frustration_count ?? 0;
    this._challengeCount = state.challenge_count ?? 0;
    this._perception.reset();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _triggerEmotions(toolEvent: ToolEvent): void {
    const success = toolEvent.success ?? true;
    const cmd = (
      ((toolEvent.tool_input ?? {}) as Record<string, unknown>).command ?? ""
    ) as string;
    const cmdLower = cmd.toLowerCase();
    const isTest = ["pytest", "npm test", "cargo test", "jest"].some((t) =>
      cmdLower.includes(t),
    );

    if (isTest && success) {
      this._emotionalStates.push(
        this._emotionalSystem.addEmotion(
          Emotion.JOY,
          0.6,
          0.8,
          this._tickCount,
        ),
      );
    } else if (isTest && !success) {
      this._emotionalStates.push(
        this._emotionalSystem.addEmotion(
          Emotion.FRUSTRATION,
          0.5,
          -0.6,
          this._tickCount,
        ),
      );
      this._frustrationCount += 1;
    } else if (!success) {
      this._emotionalStates.push(
        this._emotionalSystem.addEmotion(
          Emotion.WARINESS,
          0.3,
          -0.3,
          this._tickCount,
        ),
      );
    }

    // Novelty triggers curiosity
    const vec = this._perception.getVector();
    if (vec[5] > 0.6) {
      this._emotionalStates.push(
        this._emotionalSystem.addEmotion(
          Emotion.CURIOSITY,
          0.5,
          0.4,
          this._tickCount,
        ),
      );
    }

    // Limit active emotions
    if (this._emotionalStates.length > 20) {
      this._emotionalStates = this._emotionalStates.slice(-20);
    }
  }

  private _checkEvolutionTriggers(): void {
    const vec = this._perception.getVector();

    // Sustained debugging: high pressure over many ticks
    if (
      vec[1] > 0.5 &&
      this._sessionTestFails > 10 &&
      this._tickCount > 10
    ) {
      const shifts = this._evolutionEngine.createShift(
        EvolutionTrigger.SUSTAINED_DEBUGGING,
        this._tickCount,
      );
      this._personalityShifts.push(...shifts);
      this._evolutionHistory.push({
        trigger: "sustained_debugging",
        tick: this._tickCount,
      });
    }

    // Creative exploration: high novelty
    if (vec[5] > 0.6 && this._tickCount > 5) {
      const shifts = this._evolutionEngine.createShift(
        EvolutionTrigger.CREATIVE_EXPLORATION,
        this._tickCount,
        0.02,
      );
      this._personalityShifts.push(...shifts);
    }

    // Breakthrough: sudden momentum jump
    if (vec[3] - this._prevMomentum > 0.5) {
      const shifts = this._evolutionEngine.createShift(
        EvolutionTrigger.BREAKTHROUGH,
        this._tickCount,
      );
      this._personalityShifts.push(...shifts);
      this._evolutionHistory.push({
        trigger: "breakthrough",
        tick: this._tickCount,
      });
    }

    // Methodical testing: balanced edit/test ratio
    if (vec[10] > 0.5 && this._tickCount > 8) {
      const shifts = this._evolutionEngine.createShift(
        EvolutionTrigger.METHODICAL_TESTING,
        this._tickCount,
        0.02,
      );
      this._personalityShifts.push(...shifts);
    }
  }

  private _computeReward(toolEvent: ToolEvent): number {
    if (toolEvent.success) {
      return 0.5;
    }
    return -0.3;
  }

  private _getDominantEmotion(): string | null {
    const active = this._emotionalStates.filter((s) =>
      EmotionalSystem.isActive(s, this._tickCount),
    );
    if (active.length === 0) return null;

    let strongest = active[0];
    let strongestIntensity = EmotionalSystem.currentIntensity(
      strongest,
      this._tickCount,
    );
    for (let i = 1; i < active.length; i++) {
      const intensity = EmotionalSystem.currentIntensity(
        active[i],
        this._tickCount,
      );
      if (intensity > strongestIntensity) {
        strongest = active[i];
        strongestIntensity = intensity;
      }
    }

    if (strongestIntensity < 0.1) return null;
    return strongest.emotion;
  }
}
