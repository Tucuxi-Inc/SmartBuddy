/**
 * Emotional State System for SmartBuddy.
 *
 * Defines 12 emotions with trait modifiers and linear decay.
 * Each emotion maps to a sparse 50-dim modifier vector that shifts
 * personality traits while the emotion is active.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { TraitSystem } from "./traits.js";
export declare const Emotion: {
    readonly JOY: "joy";
    readonly CURIOSITY: "curiosity";
    readonly FRUSTRATION: "frustration";
    readonly ANXIETY: "anxiety";
    readonly SATISFACTION: "satisfaction";
    readonly SURPRISE: "surprise";
    readonly DETERMINATION: "determination";
    readonly BOREDOM: "boredom";
    readonly EXCITEMENT: "excitement";
    readonly WARINESS: "wariness";
    readonly CONTENTMENT: "contentment";
    readonly IRRITATION: "irritation";
};
export type EmotionValue = (typeof Emotion)[keyof typeof Emotion];
export interface EmotionalState {
    readonly emotion: EmotionValue;
    readonly intensity: number;
    readonly valence: number;
    readonly tickCreated: number;
    readonly decayTicks: number;
}
export declare const EMOTION_TRAIT_MODIFIERS: Readonly<Record<EmotionValue, Readonly<Record<string, number>>>>;
export declare class EmotionalSystem {
    private readonly traitSystem;
    /** Pre-built 50-dim modifier vectors keyed by emotion string. */
    private readonly modifierVectors;
    constructor(traitSystem: TraitSystem);
    /**
     * Create an EmotionalState, clamping intensity to [0,1] and valence to [-1,1].
     */
    addEmotion(emotion: EmotionValue, intensity: number, valence: number, tick: number, decayTicks?: number): EmotionalState;
    /**
     * Sum modifier vectors weighted by each state's decayed intensity.
     * Returns a 50-dim trait modifier vector.
     */
    computeTraitModifiers(states: EmotionalState[], currentTick: number): number[];
    /**
     * Compute current intensity after linear decay.
     * Returns 0 when elapsed >= decayTicks.
     */
    static currentIntensity(state: EmotionalState, currentTick: number): number;
    /**
     * Whether the emotion still has positive intensity at currentTick.
     */
    static isActive(state: EmotionalState, currentTick: number): boolean;
    /**
     * Filter out emotions that have fully decayed.
     */
    static decayEmotions(states: EmotionalState[], currentTick: number): EmotionalState[];
}
