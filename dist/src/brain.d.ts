/**
 * BuddyBrain: the main orchestrator tying all cognitive systems together.
 *
 * Ported from engine/brain.py. Orchestrates perception, emotion, council,
 * directors, decision, evolution, expression, speech, and sprites into
 * a single tick pipeline.
 */
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
    species: string;
    traitsSummary: [string, number][];
}
interface BuddyState {
    species: string;
    dominantTraits: [string, number][];
    mood: string;
    expression: string;
    adornments: string[];
    tickCount: number;
}
interface BuddyCard {
    species: string;
    tickCount: number;
    traits: Record<string, number>;
    traitShifts: Record<string, number>;
    emotions: {
        emotion: string;
        intensity: number;
    }[];
    evolutionHistory: Record<string, unknown>[];
    adornments: string[];
    councilActivations: Record<string, number>;
}
interface ResetResult {
    species: string;
    status: string;
}
export declare class BuddyBrain {
    private _ts;
    private _council;
    private _decisionModel;
    private _emotionalSystem;
    private _evolutionEngine;
    private _perception;
    private _species;
    private _traits;
    private _traitsAtCreation;
    private _directorPool;
    private _emotionalStates;
    private _personalityShifts;
    private _evolutionHistory;
    private _tickCount;
    private _rng;
    private _sessionFrictionCount;
    private _sessionTestFails;
    private _sessionTestPasses;
    private _frustrationCount;
    private _challengeCount;
    private _prevMomentum;
    constructor();
    hatch(userId: string): HatchResult;
    tick(toolEvent: ToolEvent): TickResult;
    getState(): BuddyState;
    getCard(): BuddyCard;
    getContext(): string;
    resetMind(): ResetResult;
    saveMind(filePath: string): void;
    loadMind(filePath: string, userId: string): void;
    private _triggerEmotions;
    private _checkEvolutionTriggers;
    private _computeReward;
    private _getDominantEmotion;
}
export {};
