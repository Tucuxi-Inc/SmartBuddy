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

import { matmul, outer, sigmoid, tanhVec, add, mul, zeros, clip } from "./math.js";
import { Mulberry32 } from "./identity.js";

// ---------------------------------------------------------------------------
// Architecture constants
// ---------------------------------------------------------------------------
export const INPUT_DIM = 14;
export const HIDDEN_DIM = 8;
export const OUTPUT_DIM = 6;
export const TOTAL_WEIGHTS =
  INPUT_DIM +                   // attention_mask: 14
  INPUT_DIM * HIDDEN_DIM +      // W_ih: 112
  HIDDEN_DIM * HIDDEN_DIM +     // W_hh: 64
  HIDDEN_DIM * OUTPUT_DIM +     // W_ho: 48
  HIDDEN_DIM +                  // bias_h: 8
  OUTPUT_DIM;                   // bias_o: 6
// = 252

// ---------------------------------------------------------------------------
// Training / initialisation constants
// ---------------------------------------------------------------------------
export const INIT_SIGMA = 0.3;
export const LEARNING_RATE = 0.01;
export const WEIGHT_CLAMP = 3.0;

// ---------------------------------------------------------------------------
// Output indices (behavioral bias dimensions)
// ---------------------------------------------------------------------------
export const CAUTION_BIAS = 0;
export const SOCIAL_BIAS = 1;
export const EXPLORATION_BIAS = 2;
export const COOPERATION_BIAS = 3;
export const RESOURCE_BIAS = 4;
export const URGENCY_BIAS = 5;

// ---------------------------------------------------------------------------
// Helpers: reshape flat slice into row-major 2D array
// ---------------------------------------------------------------------------
function reshapeToMatrix(flat: number[], rows: number, cols: number): number[][] {
  const m: number[][] = [];
  for (let r = 0; r < rows; r++) {
    m.push(flat.slice(r * cols, (r + 1) * cols));
  }
  return m;
}

function flattenMatrix(m: number[][]): number[] {
  const out: number[] = [];
  for (const row of m) {
    for (const v of row) out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DirectorRNN
// ---------------------------------------------------------------------------
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
export class DirectorRNN {
  private _genome: number[];
  hidden: number[];

  constructor(genome?: number[], rng?: Mulberry32) {
    if (genome !== undefined) {
      if (genome.length !== TOTAL_WEIGHTS) {
        throw new Error(
          `Genome must have ${TOTAL_WEIGHTS} weights, got ${genome.length}`
        );
      }
      this._genome = [...genome];
    } else {
      const r = rng ?? new Mulberry32(Date.now() >>> 0);
      this._genome = new Array(TOTAL_WEIGHTS);

      // Attention mask: initialized near -1 (perception-blind Gen 0)
      // sigmoid(-1) ~= 0.27, so Directors start with low sensitivity
      for (let i = 0; i < INPUT_DIM; i++) {
        this._genome[i] = -1.0 + r.nextGaussian(INIT_SIGMA);
      }
      // Remaining weights: normal(0, 0.3)
      for (let i = INPUT_DIM; i < TOTAL_WEIGHTS; i++) {
        this._genome[i] = r.nextGaussian(INIT_SIGMA);
      }
    }

    this.hidden = zeros(HIDDEN_DIM);
  }

  // ----- Genome access -----

  get genome(): number[] {
    return this._genome;
  }

  // ----- Weight extraction helpers -----

  private getAttentionMask(): number[] {
    return this._genome.slice(0, INPUT_DIM);
  }

  private getWih(): number[][] {
    const offset = INPUT_DIM;
    return reshapeToMatrix(
      this._genome.slice(offset, offset + INPUT_DIM * HIDDEN_DIM),
      HIDDEN_DIM,
      INPUT_DIM
    );
  }

  private getWhh(): number[][] {
    const offset = INPUT_DIM + INPUT_DIM * HIDDEN_DIM;
    return reshapeToMatrix(
      this._genome.slice(offset, offset + HIDDEN_DIM * HIDDEN_DIM),
      HIDDEN_DIM,
      HIDDEN_DIM
    );
  }

  private getWho(): number[][] {
    const offset = INPUT_DIM + INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM * HIDDEN_DIM;
    return reshapeToMatrix(
      this._genome.slice(offset, offset + HIDDEN_DIM * OUTPUT_DIM),
      OUTPUT_DIM,
      HIDDEN_DIM
    );
  }

  private getBiasH(): number[] {
    const offset =
      INPUT_DIM +
      INPUT_DIM * HIDDEN_DIM +
      HIDDEN_DIM * HIDDEN_DIM +
      HIDDEN_DIM * OUTPUT_DIM;
    return this._genome.slice(offset, offset + HIDDEN_DIM);
  }

  private getBiasO(): number[] {
    const offset =
      INPUT_DIM +
      INPUT_DIM * HIDDEN_DIM +
      HIDDEN_DIM * HIDDEN_DIM +
      HIDDEN_DIM * OUTPUT_DIM +
      HIDDEN_DIM;
    return this._genome.slice(offset, offset + OUTPUT_DIM);
  }

  // ----- Weight write-back helpers -----

  private setAttentionMask(mask: number[]): void {
    for (let i = 0; i < INPUT_DIM; i++) this._genome[i] = mask[i];
  }

  private setWih(m: number[][]): void {
    const flat = flattenMatrix(m);
    const offset = INPUT_DIM;
    for (let i = 0; i < flat.length; i++) this._genome[offset + i] = flat[i];
  }

  private setWho(m: number[][]): void {
    const flat = flattenMatrix(m);
    const offset = INPUT_DIM + INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM * HIDDEN_DIM;
    for (let i = 0; i < flat.length; i++) this._genome[offset + i] = flat[i];
  }

  // ----- Forward pass -----

  forward(perception: number[]): number[] {
    if (perception.length !== INPUT_DIM) {
      throw new Error(
        `Perception must be ${INPUT_DIM}-dimensional, got ${perception.length}`
      );
    }

    // Learned attention mask: sigmoid(mask) gates [0,1] per dimension
    const attentionMask = this.getAttentionMask();
    const attention = sigmoid(attentionMask);
    const masked = mul(perception, attention);

    // Hidden update: h_new = tanh(W_ih @ masked + W_hh @ h + bias_h)
    const Wih = this.getWih();
    const Whh = this.getWhh();
    const biasH = this.getBiasH();
    this.hidden = tanhVec(add(add(matmul(Wih, masked), matmul(Whh, this.hidden)), biasH));

    // Output: y = tanh(W_ho @ h + bias_o)
    const Who = this.getWho();
    const biasO = this.getBiasO();
    return tanhVec(add(matmul(Who, this.hidden), biasO));
  }

  // ----- REINFORCE learning -----

  learnFromOutcome(
    perception: number[],
    biasProduced: number[],
    outcomeSignal: number,
    lr: number = LEARNING_RATE
  ): void {
    // Recompute attention gating (same as forward pass)
    const attentionMask = this.getAttentionMask();
    const attention = sigmoid(attentionMask);
    const masked = mul(perception, attention);

    // --- Gradient for W_ho: outcomeSignal * outer(biasProduced, hidden) ---
    const Who = this.getWho();
    const gradHo = outer(biasProduced, this.hidden);
    for (let r = 0; r < OUTPUT_DIM; r++) {
      for (let c = 0; c < HIDDEN_DIM; c++) {
        Who[r][c] += lr * outcomeSignal * gradHo[r][c];
      }
    }

    // --- Gradient for W_ih: outcomeSignal * outer((1 - hidden^2), masked) ---
    const Wih = this.getWih();
    const hiddenGrad: number[] = new Array(HIDDEN_DIM);
    for (let i = 0; i < HIDDEN_DIM; i++) {
      hiddenGrad[i] = outcomeSignal * (1.0 - this.hidden[i] * this.hidden[i]);
    }
    const gradIh = outer(hiddenGrad, masked);
    for (let r = 0; r < HIDDEN_DIM; r++) {
      for (let c = 0; c < INPUT_DIM; c++) {
        Wih[r][c] += lr * gradIh[r][c];
      }
    }

    // --- Gradient for attention mask: chain rule through sigmoid and W_ih ---
    // W_ih^T @ hiddenGrad (transpose multiply)
    const wihTHiddenGrad: number[] = new Array(INPUT_DIM).fill(0);
    for (let j = 0; j < INPUT_DIM; j++) {
      for (let i = 0; i < HIDDEN_DIM; i++) {
        wihTHiddenGrad[j] += Wih[i][j] * hiddenGrad[i];
      }
    }
    // sigGrad = attention * (1 - attention)
    const sigGrad: number[] = new Array(INPUT_DIM);
    for (let i = 0; i < INPUT_DIM; i++) {
      sigGrad[i] = attention[i] * (1.0 - attention[i]);
    }
    // attnGrad = outcomeSignal * wihTHiddenGrad * perception * sigGrad
    const newMask = [...attentionMask];
    for (let i = 0; i < INPUT_DIM; i++) {
      newMask[i] += lr * outcomeSignal * wihTHiddenGrad[i] * perception[i] * sigGrad[i];
    }

    // --- Clamp and write back ---
    const clampedWho = Who.map(row => clip(row, -WEIGHT_CLAMP, WEIGHT_CLAMP));
    const clampedWih = Wih.map(row => clip(row, -WEIGHT_CLAMP, WEIGHT_CLAMP));
    const clampedMask = clip(newMask, -WEIGHT_CLAMP, WEIGHT_CLAMP);

    this.setWho(clampedWho);
    this.setWih(clampedWih);
    this.setAttentionMask(clampedMask);
  }

  // ----- Serialisation -----

  getState(): DirectorRNNState {
    return {
      genome: [...this._genome],
      hidden: [...this.hidden],
    };
  }

  static fromState(state: DirectorRNNState): DirectorRNN {
    const rnn = new DirectorRNN(state.genome);
    if (state.hidden) {
      rnn.hidden = [...state.hidden];
    }
    return rnn;
  }
}
