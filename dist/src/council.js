/**
 * Cognitive Council + Director Pool.
 *
 * The Cognitive Council is an 8-voice modulation layer where each sub-agent
 * maps to personality traits via configurable weights. It amplifies or
 * dampens trait influences based on which cognitive voices are strongest.
 *
 * The Director Pool manages a variable number of functional directors drawn
 * from five role types (ANALYST, EVALUATOR, STRATEGIST, CRITIC, INTEGRATOR),
 * each with its own DirectorRNN that learns from experience.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { dot, zeros, clip } from "./math.js";
import { TRAIT_NAME_TO_INDEX } from "./traits.js";
import { DirectorRNN } from "./rnn.js";
// ---------------------------------------------------------------------------
// Default council weight map
// ---------------------------------------------------------------------------
/** Maps sub-agent name -> array of [trait_name, weight] pairs. */
export const DEFAULT_COUNCIL_WEIGHTS = {
    cortex: [
        ["openness", 0.4],
        ["conscientiousness", 0.3],
        ["adaptability", 0.15],
        ["self_control", 0.15],
    ],
    seer: [
        ["creativity", 0.4],
        ["depth_drive", 0.35],
        ["openness", 0.25],
    ],
    oracle: [
        ["risk_taking", 0.3],
        ["ambition", 0.35],
        ["adaptability", 0.2],
        ["openness", 0.15],
    ],
    house: [
        ["trust", 0.3],
        ["self_control", 0.25],
        ["agreeableness", 0.25],
        ["empathy", 0.2],
    ],
    prudence: [
        ["conscientiousness", 0.35],
        ["self_control", 0.35],
        ["neuroticism", 0.15],
        ["trust", 0.15],
    ],
    hypothalamus: [
        ["extraversion", 0.35],
        ["dominance", 0.3],
        ["ambition", 0.2],
        ["risk_taking", 0.15],
    ],
    amygdala: [
        ["neuroticism", 0.45],
        ["resilience", -0.3],
        ["trust", -0.25],
    ],
    conscience: [
        ["agreeableness", 0.3],
        ["empathy", 0.35],
        ["trust", 0.2],
        ["self_control", 0.15],
    ],
};
/** Ordered sub-agent names (keys of DEFAULT_COUNCIL_WEIGHTS). */
export const SUB_AGENT_NAMES = Object.keys(DEFAULT_COUNCIL_WEIGHTS);
// ---------------------------------------------------------------------------
// CognitiveCouncil
// ---------------------------------------------------------------------------
/**
 * 8-voice cognitive modulation layer.
 *
 * Each sub-agent has an activation level computed from the agent's traits.
 * The dominant voice influences behaviour; the full council produces a
 * modulation vector that amplifies/dampens trait contributions.
 */
export class CognitiveCouncil {
    traitSystem;
    enabled;
    weightVectors;
    validAgents;
    constructor(traitSystem, enabled = true, weights) {
        this.traitSystem = traitSystem;
        this.enabled = enabled;
        const rawWeights = weights ?? DEFAULT_COUNCIL_WEIGHTS;
        this.weightVectors = new Map();
        this.validAgents = [];
        for (const [agentName, traitWeights] of Object.entries(rawWeights)) {
            const vec = zeros(traitSystem.count);
            let valid = false;
            for (const [traitName, weight] of traitWeights) {
                const idx = TRAIT_NAME_TO_INDEX.get(traitName);
                if (idx !== undefined) {
                    vec[idx] = weight;
                    valid = true;
                }
            }
            if (valid) {
                this.weightVectors.set(agentName, vec);
                this.validAgents.push(agentName);
            }
        }
    }
    /**
     * Compute activation level for each sub-agent based on trait values.
     *
     * desperation_factor (0.0-1.0) boosts Hypothalamus (+0.6*df) and
     * Amygdala (+0.4*df) when the agent is under survival pressure.
     */
    getActivations(traits, desperationFactor = 0.0) {
        const activations = {};
        for (const name of this.validAgents) {
            activations[name] = dot(this.weightVectors.get(name), traits);
        }
        if (desperationFactor > 0.0) {
            if ("hypothalamus" in activations) {
                activations.hypothalamus += desperationFactor * 0.6;
            }
            if ("amygdala" in activations) {
                activations.amygdala += desperationFactor * 0.4;
            }
        }
        return activations;
    }
    /**
     * Determine which sub-agent is strongest for these traits.
     * Returns null if the council is disabled.
     */
    getDominantVoice(traits) {
        if (!this.enabled)
            return null;
        const activations = this.getActivations(traits);
        const entries = Object.entries(activations);
        if (entries.length === 0)
            return null;
        let maxName = entries[0][0];
        let maxVal = entries[0][1];
        for (let i = 1; i < entries.length; i++) {
            if (entries[i][1] > maxVal) {
                maxVal = entries[i][1];
                maxName = entries[i][0];
            }
        }
        return maxName;
    }
    /**
     * Compute a per-trait modulation vector.
     *
     * Values are centred around 1.0 and clamped to [0.5, 1.5].
     * Traits associated with the dominant voice are amplified (>1);
     * traits from opposing voices are dampened (<1).
     *
     * Returns null if the council is disabled.
     */
    computeCouncilModulation(traits) {
        if (!this.enabled)
            return null;
        const activations = this.getActivations(traits);
        const actValues = Object.values(activations);
        if (actValues.length === 0)
            return null;
        const actMin = Math.min(...actValues);
        const actMax = Math.max(...actValues);
        if (actMax === actMin) {
            return new Array(this.traitSystem.count).fill(1.0);
        }
        const actRange = actMax - actMin;
        const normalized = {};
        for (const [name, val] of Object.entries(activations)) {
            normalized[name] = (val - actMin) / actRange;
        }
        // Build modulation: weighted sum of sub-agent weight vectors scaled
        // by their normalised activation
        const modulation = new Array(this.traitSystem.count).fill(1.0);
        for (const [name, normAct] of Object.entries(normalized)) {
            const weightVec = this.weightVectors.get(name);
            const influence = 0.2 * (normAct - 0.5);
            for (let i = 0; i < weightVec.length; i++) {
                if (weightVec[i] !== 0) {
                    modulation[i] += influence * Math.abs(weightVec[i]);
                }
            }
        }
        return clip(modulation, 0.5, 1.5);
    }
}
// ---------------------------------------------------------------------------
// DirectorRole (functional roles)
// ---------------------------------------------------------------------------
/** Functional cognitive role for a director in the pool. */
export const DirectorRole = {
    ANALYST: "analyst",
    EVALUATOR: "evaluator",
    STRATEGIST: "strategist",
    CRITIC: "critic",
    INTEGRATOR: "integrator",
};
/** Priority order for role assignment when cycling. */
export const DIRECTOR_ROLE_PRIORITY = [
    DirectorRole.INTEGRATOR,
    DirectorRole.ANALYST,
    DirectorRole.EVALUATOR,
    DirectorRole.STRATEGIST,
    DirectorRole.CRITIC,
];
// ---------------------------------------------------------------------------
// Pool constants
// ---------------------------------------------------------------------------
const DEFAULT_DIRECTOR_COUNT = 5;
const MIN_DIRECTOR_COUNT = 2;
const MAX_DIRECTOR_COUNT = 12;
// ---------------------------------------------------------------------------
// DirectorPool
// ---------------------------------------------------------------------------
/**
 * Pool of functional directors with variable count (2-12).
 *
 * Directors are drawn from the five DirectorRole types in priority order.
 * When count exceeds 5, roles cycle (e.g., 7 directors = 5 unique + 2
 * repeated from the top of the priority list).
 *
 * Directors are keyed by string identifiers like "analyst_0",
 * "integrator_1", where the suffix is floor(i / 5).
 */
export class DirectorPool {
    directorCount;
    directors;
    constructor(directorCount = DEFAULT_DIRECTOR_COUNT, rng) {
        if (directorCount < MIN_DIRECTOR_COUNT || directorCount > MAX_DIRECTOR_COUNT) {
            throw new Error(`directorCount must be between ${MIN_DIRECTOR_COUNT} and ` +
                `${MAX_DIRECTOR_COUNT}, got ${directorCount}`);
        }
        this.directorCount = directorCount;
        this.directors = new Map();
        for (let i = 0; i < directorCount; i++) {
            const role = DIRECTOR_ROLE_PRIORITY[i % DIRECTOR_ROLE_PRIORITY.length];
            const instance = Math.floor(i / DIRECTOR_ROLE_PRIORITY.length);
            const key = `${role}_${instance}`;
            this.directors.set(key, {
                role,
                rnn: new DirectorRNN(undefined, rng),
                totalRuns: 0,
                meanOutcome: 0.0,
            });
        }
    }
    /**
     * Run RNNs and return their bias vectors.
     *
     * If activeCount is provided, only the first activeCount directors run.
     */
    process(perception, activeCount) {
        const count = activeCount !== undefined
            ? Math.min(activeCount, this.directorCount)
            : this.directorCount;
        const results = {};
        let i = 0;
        for (const [key, director] of this.directors) {
            if (i >= count)
                break;
            results[key] = director.rnn.forward(perception);
            director.totalRuns += 1;
            i++;
        }
        return results;
    }
    /**
     * Train a specific director's RNN from an outcome signal.
     * Also updates the director's running mean outcome.
     */
    learn(key, perception, bias, outcome) {
        const director = this.directors.get(key);
        if (!director) {
            throw new Error(`Unknown director key: "${key}"`);
        }
        director.rnn.learnFromOutcome(perception, bias, outcome);
        // Update running mean
        const n = Math.max(director.totalRuns, 1);
        director.meanOutcome += (outcome - director.meanOutcome) / n;
    }
    /** Serialise the entire pool for persistence (snake_case keys). */
    getState() {
        const directors = {};
        for (const [key, director] of this.directors) {
            directors[key] = {
                rnn: director.rnn.getState(),
                total_runs: director.totalRuns,
                mean_outcome: director.meanOutcome,
            };
        }
        return {
            director_count: this.directorCount,
            directors,
        };
    }
    /** Reconstruct a pool from persisted state. */
    static fromState(state) {
        const count = state.director_count;
        // Create instance without running constructor logic
        const pool = Object.create(DirectorPool.prototype);
        pool.directorCount = count;
        pool.directors = new Map();
        const directorsData = state.directors ?? {};
        for (let i = 0; i < count; i++) {
            const role = DIRECTOR_ROLE_PRIORITY[i % DIRECTOR_ROLE_PRIORITY.length];
            const instance = Math.floor(i / DIRECTOR_ROLE_PRIORITY.length);
            const key = `${role}_${instance}`;
            const data = directorsData[key];
            const rnn = data?.rnn
                ? DirectorRNN.fromState(data.rnn)
                : new DirectorRNN();
            pool.directors.set(key, {
                role,
                rnn,
                totalRuns: data?.total_runs ?? 0,
                meanOutcome: data?.mean_outcome ?? 0.0,
            });
        }
        return pool;
    }
}
//# sourceMappingURL=council.js.map