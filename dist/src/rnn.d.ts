/**
 * Director RNN -- 252-weight recurrent neural network for adaptive director modulation.
 *
 * Architecture: 14 inputs -> 8 hidden (tanh) -> 6 outputs (tanh)
 * 252 weights: attention_mask(14) + W_ih(112) + W_hh(64) + W_ho(48) + bias_h(8) + bias_o(6)
 *
 * Produces 6 bias signals in [-1, 1] that modulate behavioral tendencies:
 *   0: CAUTION_BIAS      -- cautious vs bold action selection
 *   1: SOCIAL_BIAS       -- social vs solitary preference
 *   2: EXPLORATION_BIAS  -- explore vs exploit
 *   3: COOPERATION_BIAS  -- cooperative vs competitive
 *   4: RESOURCE_BIAS     -- gather/hoard vs share/trade
 *   5: URGENCY_BIAS      -- act now vs wait/observe
 *
 * The attention mask is a 14-dim vector of learned weights. In the forward
 * pass, perception is gated: masked = perception * sigmoid(attention_mask).
 * Initialized near -1 so Gen 0 Directors start nearly perception-blind
 * (~0.27 sensitivity) and must discover which inputs matter through REINFORCE.
 *
 * Ported from Living Worlds' cognitive engine. Pure math, no I/O.
 */
import { Mulberry32 } from "./identity.js";
export declare const INPUT_DIM = 14;
export declare const HIDDEN_DIM = 8;
export declare const OUTPUT_DIM = 6;
export declare const TOTAL_WEIGHTS: number;
export declare const INIT_SIGMA = 0.3;
export declare const LEARNING_RATE = 0.01;
export declare const WEIGHT_CLAMP = 3;
export declare const CAUTION_BIAS = 0;
export declare const SOCIAL_BIAS = 1;
export declare const EXPLORATION_BIAS = 2;
export declare const COOPERATION_BIAS = 3;
export declare const RESOURCE_BIAS = 4;
export declare const URGENCY_BIAS = 5;
export interface DirectorRNNState {
    genome: number[];
    hidden: number[];
}
/**
 * 252-weight RNN with learned attention mask for perceptual gating.
 *
 * Genome layout:
 *   attention_mask(14) + W_ih(112) + W_hh(64) + W_ho(48) + bias_h(8) + bias_o(6)
 */
export declare class DirectorRNN {
    private _genome;
    hidden: number[];
    constructor(genome?: number[], rng?: Mulberry32);
    get genome(): number[];
    private getAttentionMask;
    private getWih;
    private getWhh;
    private getWho;
    private getBiasH;
    private getBiasO;
    private setAttentionMask;
    private setWih;
    private setWho;
    forward(perception: number[]): number[];
    learnFromOutcome(perception: number[], biasProduced: number[], outcomeSignal: number, lr?: number): void;
    getState(): DirectorRNNState;
    static fromState(state: DirectorRNNState): DirectorRNN;
}
