"""
Utility-based decision model for SmartBuddy.

All buddy decisions flow through this model:
  U(action | personality, situation) = personality . w * sit_magnitude + b

Action selection via softmax with configurable temperature.
Every decision produces a DecisionResult with per-trait explainability.

Adapted from Living Worlds' decision.py (Seldon-based).
Pure math (NumPy), no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import numpy as np

from engine.traits import TraitSystem, TRAIT_INDEX_TO_NAME


# ---------------------------------------------------------------------------
# Buddy → Action mapping
# ---------------------------------------------------------------------------
# Each row maps the 6 director bias dimensions (CAUTION, SOCIAL, EXPLORATION,
# COOPERATION, RESOURCE, URGENCY) to an action's affinity.
# dot(action_row, director_output) produces a per-action bias term.
BUDDY_ACTION_MAP: dict[str, list[float]] = {
    "observe":         [ 0.2, -0.3, -0.3,  0.0,  0.0, -0.5],
    "curious_comment": [-0.2,  0.1,  0.5,  0.1, -0.1,  0.2],
    "engage":          [ 0.0,  0.5,  0.0,  0.3,  0.0,  0.1],
    "study":           [ 0.2, -0.2,  0.2,  0.0,  0.3, -0.3],
    "encourage":       [ 0.0,  0.4,  0.0,  0.5, -0.1,  0.0],
    "suggest":         [ 0.0,  0.2,  0.1,  0.2,  0.3,  0.2],
    "challenge":       [-0.3,  0.1,  0.0, -0.3,  0.0,  0.4],
    "teach":           [ 0.1,  0.3, -0.1,  0.3, -0.2,  0.0],
    "emote":           [-0.1,  0.3,  0.1,  0.1, -0.2,  0.1],
    "journal":         [ 0.3, -0.1, -0.2,  0.0,  0.2, -0.2],
    "gift":            [ 0.1,  0.2,  0.0,  0.3,  0.3, -0.1],
}

BUDDY_ACTIONS: list[str] = list(BUDDY_ACTION_MAP.keys())


# ---------------------------------------------------------------------------
# DecisionResult
# ---------------------------------------------------------------------------
@dataclass
class DecisionResult:
    """
    Result of a utility-based decision with explainability data.

    Attributes
    ----------
    chosen_action : str
        The selected action name.
    probabilities : dict[str, float]
        Softmax probability for every candidate action.
    trait_contributions : np.ndarray
        Per-trait influence on the chosen action (shape = trait count).
    utilities : dict[str, float]
        Raw utility value for every candidate action.
    """
    chosen_action: str
    probabilities: dict[str, float]
    trait_contributions: np.ndarray
    utilities: dict[str, float]

    def explain(self, trait_names: list[str] | None = None) -> dict[str, float]:
        """
        Return a readable mapping of trait name -> influence score.

        Only includes traits whose absolute contribution exceeds 0.01.

        Parameters
        ----------
        trait_names : list[str], optional
            Ordered trait names matching the contribution vector.
            If ``None``, uses the global ``TRAIT_INDEX_TO_NAME`` mapping.
        """
        if trait_names is None:
            names = [TRAIT_INDEX_TO_NAME[i] for i in range(len(self.trait_contributions))]
        else:
            names = trait_names

        return {
            name: float(self.trait_contributions[i])
            for i, name in enumerate(names)
            if abs(self.trait_contributions[i]) > 0.001
        }

    def to_dict(self) -> dict[str, Any]:
        """Serialise the result to a plain dict (no NumPy)."""
        return {
            "chosen_action": self.chosen_action,
            "probabilities": self.probabilities,
            "utilities": self.utilities,
        }


# ---------------------------------------------------------------------------
# DecisionModel
# ---------------------------------------------------------------------------
class DecisionModel:
    """
    Unified utility-based decision engine for SmartBuddy.

    U(a|P,x) = P . w * sit_magnitude + b

    Where ``P`` is the trait vector, ``w`` is a per-action weight vector,
    ``sit_magnitude`` is the mean absolute value of the situation vector,
    and ``b`` is a per-action bias.

    An optional *council_modulation* vector amplifies trait values before
    the dot product.

    Default per-action trait weight vectors are drawn from a fixed seed so
    different actions weight traits differently, making council modulation
    and trait differences meaningful even without explicit ``action_weights``.

    Parameters
    ----------
    trait_system : TraitSystem
        Provides the trait count.
    temperature : float
        Softmax temperature.  Lower values make decisions more
        deterministic; higher values increase randomness.
    weight_seed : int
        Seed for default action weight initialisation (reproducible).
    """

    def __init__(
        self,
        trait_system: TraitSystem,
        temperature: float = 1.0,
        weight_seed: int = 0,
    ):
        self.trait_system = trait_system
        self.temperature = temperature

        # Pre-generate per-action default weight vectors once.
        # Using a fixed seed makes weights deterministic and action-specific
        # so council modulation produces differentiable utility distributions.
        rng = np.random.default_rng(weight_seed)
        tc = trait_system.count
        self._default_weights: dict[str, np.ndarray] = {}
        for action in BUDDY_ACTION_MAP:
            w = rng.random(tc).astype(np.float64)
            w /= w.sum()  # normalise to sum=1 (same scale as uniform 1/tc)
            self._default_weights[action] = w

    def decide(
        self,
        traits: np.ndarray,
        situation: dict[str, float],
        actions: list[str],
        action_weights: dict[str, np.ndarray] | None = None,
        action_biases: dict[str, float] | None = None,
        council_modulation: np.ndarray | None = None,
        director_biases: np.ndarray | None = None,
        rng: np.random.Generator | None = None,
    ) -> DecisionResult:
        """
        Compute utility for each action and select one via softmax.

        Parameters
        ----------
        traits : np.ndarray
            The buddy's personality vector (shape = trait count).
        situation : dict[str, float]
            Context variables (e.g. pressure, novelty).
        actions : list[str]
            Available actions to choose from (at least one).
        action_weights : dict[str, np.ndarray], optional
            Per-action trait weight vectors, shape ``(trait_count,)``.
            If ``None``, uses uniform weights ``1 / trait_count``.
        action_biases : dict[str, float], optional
            Per-action bias terms.  Default 0 for all actions.
        council_modulation : np.ndarray, optional
            Per-trait amplification vector.  Values > 1 amplify; < 1 dampen.
        director_biases : np.ndarray, optional
            6-dim vector mapped to per-action bias via ``BUDDY_ACTION_MAP``.
        rng : Generator, optional

        Returns
        -------
        DecisionResult with chosen action, probabilities, and explainability.

        Raises
        ------
        ValueError
            If ``actions`` is empty.
        """
        rng = rng or np.random.default_rng()

        if not actions:
            raise ValueError("At least one action required")

        # Fast path for single action
        if len(actions) == 1:
            return DecisionResult(
                chosen_action=actions[0],
                probabilities={actions[0]: 1.0},
                trait_contributions=traits.copy(),
                utilities={actions[0]: 1.0},
            )

        # Apply council modulation as trait amplifier
        effective_traits = traits.copy()
        if council_modulation is not None:
            effective_traits = effective_traits * council_modulation

        # Compute situation magnitude for scaling
        sit_values = np.array(list(situation.values())) if situation else np.array([1.0])
        sit_magnitude = float(np.mean(np.abs(sit_values))) if len(sit_values) > 0 else 1.0

        # Compute utility for each action
        utilities: dict[str, float] = {}
        contributions_by_action: dict[str, np.ndarray] = {}

        tc = self.trait_system.count

        for action in actions:
            if action_weights and action in action_weights:
                w = action_weights[action]
            elif action in self._default_weights:
                # Action-specific default weights (seeded, non-uniform)
                w = self._default_weights[action]
            else:
                # Fallback for unknown actions: uniform weight vector
                w = np.ones(tc, dtype=np.float64) / tc

            bias = (action_biases or {}).get(action, 0.0)

            # Add director bias via buddy action mapping
            if director_biases is not None and action in BUDDY_ACTION_MAP:
                action_map_row = np.array(BUDDY_ACTION_MAP[action])
                bias += float(np.dot(action_map_row, director_biases))

            # U(a|P,x) = P . w * sit_magnitude + b
            contributions = effective_traits * w * sit_magnitude
            utility = float(contributions.sum()) + bias

            utilities[action] = utility
            contributions_by_action[action] = contributions

        # Softmax with temperature
        values = np.array([utilities[a] for a in actions])
        probabilities = self._softmax(values, self.temperature)
        prob_dict = dict(zip(actions, probabilities.tolist()))

        # Select action
        chosen_idx = int(rng.choice(len(actions), p=probabilities))
        chosen = actions[chosen_idx]

        return DecisionResult(
            chosen_action=chosen,
            probabilities=prob_dict,
            trait_contributions=contributions_by_action[chosen],
            utilities=utilities,
        )

    @staticmethod
    def _softmax(values: np.ndarray, temperature: float) -> np.ndarray:
        """
        Numerically stable softmax with temperature scaling.

        Parameters
        ----------
        values : np.ndarray
            Raw utility scores.
        temperature : float
            Scaling factor.  If <= 0, returns a deterministic one-hot
            vector on the argmax.
        """
        if temperature <= 0:
            result = np.zeros_like(values, dtype=np.float64)
            result[np.argmax(values)] = 1.0
            return result

        scaled = (values - values.max()) / temperature
        exp_vals = np.exp(scaled)
        return exp_vals / exp_vals.sum()
