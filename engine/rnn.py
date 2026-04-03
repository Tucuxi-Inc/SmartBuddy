"""
Director RNN -- 252-weight recurrent neural network for adaptive director modulation.

Architecture: 14 inputs -> 8 hidden (tanh) -> 6 outputs (tanh)
252 weights: attention_mask(14) + W_ih(112) + W_hh(64) + W_ho(48) + biasH(8) + biasO(6)

Produces 6 bias signals in [-1, 1] that modulate behavioral tendencies:
  0: CAUTION_BIAS      -- cautious vs bold action selection
  1: SOCIAL_BIAS       -- social vs solitary preference
  2: EXPLORATION_BIAS  -- explore vs exploit
  3: COOPERATION_BIAS  -- cooperative vs competitive
  4: RESOURCE_BIAS     -- gather/hoard vs share/trade
  5: URGENCY_BIAS      -- act now vs wait/observe

The attention mask is a 14-dim vector of learned weights. In the forward
pass, perception is gated: masked = perception * sigmoid(attention_mask).
Initialized near zero so Gen 0 Directors start nearly perception-blind
and must discover which inputs matter through REINFORCE learning.

Pure NumPy, no external dependencies.
"""

from __future__ import annotations

from typing import Optional

import numpy as np

# ---------------------------------------------------------------------------
# Architecture constants
# ---------------------------------------------------------------------------
INPUT_DIM = 14
HIDDEN_DIM = 8
OUTPUT_DIM = 6
TOTAL_WEIGHTS = (
    INPUT_DIM                  # attention_mask: 14 (learned perceptual gating)
    + INPUT_DIM * HIDDEN_DIM   # W_ih: 112
    + HIDDEN_DIM * HIDDEN_DIM  # W_hh: 64
    + HIDDEN_DIM * OUTPUT_DIM  # W_ho: 48
    + HIDDEN_DIM               # bias_h: 8
    + OUTPUT_DIM               # bias_o: 6
)  # = 252

# ---------------------------------------------------------------------------
# Training / initialisation constants
# ---------------------------------------------------------------------------
INIT_SIGMA = 0.3
LEARNING_RATE = 0.01
WEIGHT_CLAMP = 3.0

# ---------------------------------------------------------------------------
# Output indices (behavioral bias dimensions)
# ---------------------------------------------------------------------------
CAUTION_BIAS = 0
SOCIAL_BIAS = 1
EXPLORATION_BIAS = 2
COOPERATION_BIAS = 3
RESOURCE_BIAS = 4
URGENCY_BIAS = 5


# ---------------------------------------------------------------------------
# DirectorRNN
# ---------------------------------------------------------------------------
class DirectorRNN:
    """252-weight RNN with learned attention mask for perceptual gating.

    Genome layout: attention_mask(14) + W_ih(112) + W_hh(64) + W_ho(48) + bias_h(8) + bias_o(6)

    The attention mask is a 14-dim vector. In the forward pass, perception is
    gated: masked = perception * sigmoid(attention_mask). Initialized near -1
    so Gen 0 Directors start nearly perception-blind (~0.27 sensitivity) and
    discover which inputs matter through REINFORCE learning.
    """

    def __init__(self, genome: Optional[np.ndarray] = None):
        """
        Create a DirectorRNN from an explicit genome or random initialisation.

        Parameters
        ----------
        genome : np.ndarray, optional
            Flat array of TOTAL_WEIGHTS (252) floats. If None, a random genome
            is drawn with attention mask initialized near -1 (perception-blind).
        """
        if genome is not None:
            if len(genome) != TOTAL_WEIGHTS:
                raise ValueError(
                    f"Genome must have {TOTAL_WEIGHTS} weights, got {len(genome)}"
                )
            self._genome = genome.copy().astype(np.float64)
        else:
            rng = np.random.default_rng()
            self._genome = np.zeros(TOTAL_WEIGHTS, dtype=np.float64)
            # Attention mask: initialize near -1 (perception-blind Gen 0)
            # sigmoid(-1) ≈ 0.27, so Directors start with low sensitivity
            self._genome[0:INPUT_DIM] = rng.normal(-1.0, 0.3, INPUT_DIM)
            # Remaining weights: normal initialization
            self._genome[INPUT_DIM:] = rng.normal(0.0, INIT_SIGMA, TOTAL_WEIGHTS - INPUT_DIM)

        # Unpack genome into weight matrices (views into _genome for in-place updates)
        offset = 0

        self.attention_mask = self._genome[offset: offset + INPUT_DIM]
        offset += INPUT_DIM

        self.W_ih = self._genome[offset: offset + INPUT_DIM * HIDDEN_DIM].reshape(
            HIDDEN_DIM, INPUT_DIM
        )
        offset += INPUT_DIM * HIDDEN_DIM

        self.W_hh = self._genome[offset: offset + HIDDEN_DIM * HIDDEN_DIM].reshape(
            HIDDEN_DIM, HIDDEN_DIM
        )
        offset += HIDDEN_DIM * HIDDEN_DIM

        self.W_ho = self._genome[offset: offset + HIDDEN_DIM * OUTPUT_DIM].reshape(
            OUTPUT_DIM, HIDDEN_DIM
        )
        offset += HIDDEN_DIM * OUTPUT_DIM

        self.bias_h = self._genome[offset: offset + HIDDEN_DIM]
        offset += HIDDEN_DIM

        self.bias_o = self._genome[offset: offset + OUTPUT_DIM]

        # Hidden state persists between forward() calls
        self.hidden = np.zeros(HIDDEN_DIM, dtype=np.float64)

    # ----- Forward pass -----

    def forward(self, perception: np.ndarray) -> np.ndarray:
        """
        One forward pass through the RNN.

        Parameters
        ----------
        perception : np.ndarray
            14-element input vector.

        Returns
        -------
        np.ndarray of shape (6,) with values in [-1, 1].
        """
        perception = np.asarray(perception, dtype=np.float64)
        if perception.shape != (INPUT_DIM,):
            raise ValueError(
                f"Perception must be {INPUT_DIM}-dimensional, got {perception.shape}"
            )

        # Learned attention mask: sigmoid(mask) gates [0,1] per dimension.
        # Gen 0 starts near-blind (mask ≈ -1 → sigmoid ≈ 0.27).
        attention = 1.0 / (1.0 + np.exp(-self.attention_mask))  # sigmoid
        masked_perception = perception * attention

        # Hidden update: h_new = tanh(W_ih @ masked_x + W_hh @ h + bias_h)
        self.hidden = np.tanh(
            self.W_ih @ masked_perception + self.W_hh @ self.hidden + self.bias_h
        )

        # Output: y = tanh(W_ho @ h + bias_o)
        output = np.tanh(self.W_ho @ self.hidden + self.bias_o)
        return output

    # ----- REINFORCE learning -----

    def learn_from_outcome(
        self,
        perception: np.ndarray,
        bias_produced: np.ndarray,
        outcome_signal: float,
        lr: float = LEARNING_RATE,
    ) -> None:
        """
        REINFORCE-like update on W_ho, W_ih, and attention_mask.

        Pushes weights toward biases that correlated with positive outcomes
        and away from those that correlated with negative outcomes.

        Parameters
        ----------
        perception : np.ndarray
            The perception vector used during forward().
        bias_produced : np.ndarray
            The bias output from forward().
        outcome_signal : float
            Quality relative to director mean (positive = better than average).
        lr : float
            Learning rate.
        """
        perception = np.asarray(perception, dtype=np.float64)
        bias_produced = np.asarray(bias_produced, dtype=np.float64)

        # Apply attention mask for gradient computation (same as forward pass)
        attention = 1.0 / (1.0 + np.exp(-self.attention_mask))
        masked_perception = perception * attention

        # Gradient for W_ho: outcome * bias * hidden^T
        grad_ho = outcome_signal * np.outer(bias_produced, self.hidden)
        self.W_ho += lr * grad_ho

        # Gradient for W_ih: outcome * (1 - hidden^2) * masked_perception^T
        hidden_grad = outcome_signal * (1.0 - self.hidden ** 2)
        grad_ih = np.outer(hidden_grad, masked_perception)
        self.W_ih += lr * grad_ih

        # Gradient for attention mask: chain rule through sigmoid and W_ih
        sig_grad = attention * (1.0 - attention)  # sigmoid derivative
        attn_grad = outcome_signal * (self.W_ih.T @ hidden_grad) * perception * sig_grad
        self.attention_mask += lr * attn_grad

        # Clamp weights to prevent explosion
        np.clip(self.W_ho, -WEIGHT_CLAMP, WEIGHT_CLAMP, out=self.W_ho)
        np.clip(self.W_ih, -WEIGHT_CLAMP, WEIGHT_CLAMP, out=self.W_ih)
        np.clip(self.attention_mask, -WEIGHT_CLAMP, WEIGHT_CLAMP, out=self.attention_mask)

    # ----- Serialisation -----

    def get_state(self) -> dict:
        """Serialize RNN state for persistence."""
        return {
            "genome": self._genome.tolist(),
            "hidden": self.hidden.tolist(),
        }

    @classmethod
    def from_state(cls, state: dict) -> DirectorRNN:
        """Reconstruct from persisted state."""
        genome = np.array(state["genome"], dtype=np.float64)
        rnn = cls(genome=genome)
        if "hidden" in state:
            rnn.hidden = np.array(state["hidden"], dtype=np.float64)
        return rnn

    # ----- Properties -----

    @property
    def genome(self) -> np.ndarray:
        """Read-only access to the flat genome array."""
        return self._genome

    @property
    def hidden_state(self) -> np.ndarray:
        """Read-only access to the current hidden state."""
        return self.hidden
