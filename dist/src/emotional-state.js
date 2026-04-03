/**
 * Emotional State System for SmartBuddy.
 *
 * Defines 12 emotions with trait modifiers and linear decay.
 * Each emotion maps to a sparse 50-dim modifier vector that shifts
 * personality traits while the emotion is active.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { zeros, add, scale } from "./math.js";
// ---------------------------------------------------------------------------
// Emotion constants
// ---------------------------------------------------------------------------
export const Emotion = {
    JOY: "joy",
    CURIOSITY: "curiosity",
    FRUSTRATION: "frustration",
    ANXIETY: "anxiety",
    SATISFACTION: "satisfaction",
    SURPRISE: "surprise",
    DETERMINATION: "determination",
    BOREDOM: "boredom",
    EXCITEMENT: "excitement",
    WARINESS: "wariness",
    CONTENTMENT: "contentment",
    IRRITATION: "irritation",
};
// ---------------------------------------------------------------------------
// Emotion → trait modifier map (trait name → modifier value)
// ---------------------------------------------------------------------------
export const EMOTION_TRAIT_MODIFIERS = {
    [Emotion.JOY]: {
        extraversion: 0.10,
        optimism: 0.15,
        neuroticism: -0.10,
    },
    [Emotion.CURIOSITY]: {
        openness: 0.15,
        creativity: 0.10,
        curiosity: 0.15,
    },
    [Emotion.FRUSTRATION]: {
        patience: -0.15,
        neuroticism: 0.10,
        emotional_stability: -0.10,
    },
    [Emotion.ANXIETY]: {
        neuroticism: 0.15,
        risk_taking: -0.10,
        confidence: -0.10,
    },
    [Emotion.SATISFACTION]: {
        emotional_stability: 0.10,
        optimism: 0.10,
        patience: 0.10,
    },
    [Emotion.SURPRISE]: {
        confidence: 0.15,
        assertiveness: 0.10,
        humility: -0.10,
    },
    [Emotion.DETERMINATION]: {
        assertiveness: 0.10,
        persistence: 0.15,
        patience: 0.05,
    },
    [Emotion.BOREDOM]: {
        extraversion: -0.10,
        optimism: -0.10,
        curiosity: -0.10,
    },
    [Emotion.EXCITEMENT]: {
        extraversion: 0.12,
        risk_taking: 0.10,
        playfulness: 0.10,
    },
    [Emotion.WARINESS]: {
        caution: 0.15,
        risk_taking: -0.15,
        confidence: -0.10,
    },
    [Emotion.CONTENTMENT]: {
        emotional_stability: 0.15,
        patience: 0.12,
        neuroticism: -0.12,
    },
    [Emotion.IRRITATION]: {
        assertiveness: 0.15,
        self_control: -0.10,
        agreeableness: -0.10,
        patience: -0.10,
    },
};
// ---------------------------------------------------------------------------
// EmotionalSystem
// ---------------------------------------------------------------------------
export class EmotionalSystem {
    traitSystem;
    /** Pre-built 50-dim modifier vectors keyed by emotion string. */
    modifierVectors;
    constructor(traitSystem) {
        this.traitSystem = traitSystem;
        this.modifierVectors = new Map();
        // Pre-build dense modifier vectors for each emotion
        for (const emotion of Object.values(Emotion)) {
            const vec = zeros(traitSystem.count);
            const mods = EMOTION_TRAIT_MODIFIERS[emotion];
            for (const [traitName, value] of Object.entries(mods)) {
                vec[traitSystem.traitIndex(traitName)] = value;
            }
            this.modifierVectors.set(emotion, vec);
        }
    }
    /**
     * Create an EmotionalState, clamping intensity to [0,1] and valence to [-1,1].
     */
    addEmotion(emotion, intensity, valence, tick, decayTicks = 50) {
        return {
            emotion,
            intensity: Math.max(0, Math.min(1, intensity)),
            valence: Math.max(-1, Math.min(1, valence)),
            tickCreated: tick,
            decayTicks,
        };
    }
    /**
     * Sum modifier vectors weighted by each state's decayed intensity.
     * Returns a 50-dim trait modifier vector.
     */
    computeTraitModifiers(states, currentTick) {
        let result = zeros(this.traitSystem.count);
        for (const state of states) {
            const intensity = EmotionalSystem.currentIntensity(state, currentTick);
            if (intensity <= 0)
                continue;
            const vec = this.modifierVectors.get(state.emotion);
            if (!vec)
                continue;
            result = add(result, scale(vec, intensity));
        }
        return result;
    }
    /**
     * Compute current intensity after linear decay.
     * Returns 0 when elapsed >= decayTicks.
     */
    static currentIntensity(state, currentTick) {
        const elapsed = currentTick - state.tickCreated;
        if (elapsed >= state.decayTicks)
            return 0;
        if (elapsed <= 0)
            return state.intensity;
        return state.intensity * (1 - elapsed / state.decayTicks);
    }
    /**
     * Whether the emotion still has positive intensity at currentTick.
     */
    static isActive(state, currentTick) {
        return EmotionalSystem.currentIntensity(state, currentTick) > 0;
    }
    /**
     * Filter out emotions that have fully decayed.
     */
    static decayEmotions(states, currentTick) {
        return states.filter(s => EmotionalSystem.isActive(s, currentTick));
    }
}
//# sourceMappingURL=emotional-state.js.map