"""
Cognitive Council + Director Pool.

The Cognitive Council is an 8-voice modulation layer where each sub-agent
maps to personality traits via configurable weights. It amplifies or
dampens trait influences based on which cognitive voices are strongest
for a given agent.

The Director Pool manages a variable number of functional directors drawn
from five role types (ANALYST, EVALUATOR, STRATEGIST, CRITIC, INTEGRATOR),
each with its own DirectorRNN that learns from experience. Roles cycle when
count exceeds 5 (e.g., 7 directors = 5 unique + 2 repeats).

Adapted from Seldon's council.py + Cognitive Partner's director_roles.py.
Pure math (NumPy), no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np

from engine.traits import TraitSystem
from engine.rnn import DirectorRNN

# ---------------------------------------------------------------------------
# Default council weight map
# ---------------------------------------------------------------------------
# Maps sub-agent name -> list of (trait_name, weight) tuples.
DEFAULT_COUNCIL_WEIGHTS: dict[str, list[tuple[str, float]]] = {
    "cortex": [
        ("openness", 0.4),
        ("conscientiousness", 0.3),
        ("adaptability", 0.15),
        ("self_control", 0.15),
    ],
    "seer": [
        ("creativity", 0.4),
        ("depth_drive", 0.35),
        ("openness", 0.25),
    ],
    "oracle": [
        ("risk_taking", 0.3),
        ("ambition", 0.35),
        ("adaptability", 0.2),
        ("openness", 0.15),
    ],
    "house": [
        ("trust", 0.3),
        ("self_control", 0.25),
        ("agreeableness", 0.25),
        ("empathy", 0.2),
    ],
    "prudence": [
        ("conscientiousness", 0.35),
        ("self_control", 0.35),
        ("neuroticism", 0.15),
        ("trust", 0.15),
    ],
    "hypothalamus": [
        ("extraversion", 0.35),
        ("dominance", 0.3),
        ("ambition", 0.2),
        ("risk_taking", 0.15),
    ],
    "amygdala": [
        ("neuroticism", 0.45),
        ("resilience", -0.3),
        ("trust", -0.25),
    ],
    "conscience": [
        ("agreeableness", 0.3),
        ("empathy", 0.35),
        ("trust", 0.2),
        ("self_control", 0.15),
    ],
}

SUB_AGENT_NAMES: list[str] = list(DEFAULT_COUNCIL_WEIGHTS.keys())


# ---------------------------------------------------------------------------
# CognitiveCouncil
# ---------------------------------------------------------------------------
class CognitiveCouncil:
    """
    8-voice cognitive modulation layer.

    Each sub-agent has an activation level computed from the agent's traits.
    The dominant voice influences behaviour; the full council can produce
    a modulation vector that amplifies/dampens trait contributions in
    the decision model.

    Parameters
    ----------
    trait_system : TraitSystem
        Provides trait-name-to-index lookups.
    enabled : bool
        If ``False``, all methods return ``None`` or pass-through values.
    weights : dict, optional
        Custom weight mapping.  Falls back to ``DEFAULT_COUNCIL_WEIGHTS``.
    """

    def __init__(
        self,
        trait_system: TraitSystem,
        enabled: bool = True,
        weights: dict[str, list[tuple[str, float]]] | None = None,
    ):
        self.trait_system = trait_system
        self.enabled = enabled

        raw_weights = weights if weights is not None else DEFAULT_COUNCIL_WEIGHTS

        # Pre-compute weight vectors for each sub-agent
        self._weight_vectors: dict[str, np.ndarray] = {}
        self._valid_agents: list[str] = []

        for agent_name, trait_weights in raw_weights.items():
            vec = np.zeros(trait_system.count, dtype=np.float64)
            valid = False
            for trait_name, weight in trait_weights:
                try:
                    idx = trait_system.trait_index(trait_name)
                    vec[idx] = weight
                    valid = True
                except KeyError:
                    # Trait not in current system -- skip silently
                    pass
            if valid:
                self._weight_vectors[agent_name] = vec
                self._valid_agents.append(agent_name)

    # ----- Activation -----

    def get_activations(
        self,
        traits: np.ndarray,
        desperation_factor: float = 0.0,
    ) -> dict[str, float]:
        """
        Compute activation level for each sub-agent based on trait values.

        desperation_factor (0.0-1.0) boosts Hypothalamus and Amygdala
        when the agent is under pressure, triggering survival-driven
        behavioral shifts through existing council modulation math.

        Returns
        -------
        dict mapping sub-agent name -> activation (may be negative for
        agents with negative weights like amygdala).
        """
        activations: dict[str, float] = {}
        for name in self._valid_agents:
            activations[name] = float(np.dot(self._weight_vectors[name], traits))

        # Survival pressure: spike Hypothalamus (homeostasis) and
        # Amygdala (threat response) under stress.
        if desperation_factor > 0.0:
            if "hypothalamus" in activations:
                activations["hypothalamus"] += desperation_factor * 0.6
            if "amygdala" in activations:
                # Amygdala flips from suppressed to activated under stress
                activations["amygdala"] += desperation_factor * 0.4

        return activations

    # ----- Dominant voice -----

    def get_dominant_voice(self, traits: np.ndarray) -> str | None:
        """
        Determine which sub-agent is strongest for these traits.

        Returns ``None`` if the council is disabled.
        """
        if not self.enabled:
            return None

        activations = self.get_activations(traits)
        if not activations:
            return None

        return max(activations, key=activations.get)  # type: ignore[arg-type]

    # ----- Modulation vector -----

    def compute_council_modulation(
        self, traits: np.ndarray
    ) -> np.ndarray | None:
        """
        Compute a per-trait modulation vector.

        Values are centred around 1.0 and clamped to [0.5, 1.5].
        Traits associated with the dominant voice are amplified (>1);
        traits from opposing voices are dampened (<1).

        Returns ``None`` if the council is disabled.
        """
        if not self.enabled:
            return None

        activations = self.get_activations(traits)
        if not activations:
            return None

        # Normalise activations to [0, 1]
        act_values = np.array(list(activations.values()))
        act_min = act_values.min()
        act_max = act_values.max()
        if act_max == act_min:
            return np.ones(self.trait_system.count, dtype=np.float64)

        act_range = act_max - act_min
        normalized = {
            name: (val - act_min) / act_range for name, val in activations.items()
        }

        # Build modulation: weighted sum of sub-agent weight vectors scaled
        # by their normalised activation
        modulation = np.ones(self.trait_system.count, dtype=np.float64)
        for name, norm_act in normalized.items():
            weight_vec = self._weight_vectors[name]
            # Modulation: amplify by 0.2 * (norm_act - 0.5) so dominant
            # voices get up to +10% and weak voices get up to -10%
            influence = 0.2 * (norm_act - 0.5)
            mask = weight_vec != 0
            modulation[mask] += influence * np.abs(weight_vec[mask])

        return np.clip(modulation, 0.5, 1.5)


# ---------------------------------------------------------------------------
# DirectorRole (functional roles)
# ---------------------------------------------------------------------------
class DirectorRole(Enum):
    """Functional cognitive role for a director in the pool."""
    ANALYST = "analyst"
    EVALUATOR = "evaluator"
    STRATEGIST = "strategist"
    CRITIC = "critic"
    INTEGRATOR = "integrator"


# ---------------------------------------------------------------------------
# Director dataclass
# ---------------------------------------------------------------------------
@dataclass
class Director:
    """
    A single director with a functional role and its own RNN.

    Attributes
    ----------
    role : DirectorRole
        The cognitive function this director serves.
    rnn : DirectorRNN
        The RNN that produces bias signals.
    experience : dict
        Free-form storage for learned experience data.
    total_runs : int
        Number of forward passes this director has performed.
    mean_outcome : float
        Running mean of outcome signals received.
    """
    role: DirectorRole
    rnn: DirectorRNN
    experience: dict = field(default_factory=dict)
    total_runs: int = 0
    mean_outcome: float = 0.0


# ---------------------------------------------------------------------------
# Director pool constants
# ---------------------------------------------------------------------------
DIRECTOR_ROLE_PRIORITY = [
    DirectorRole.INTEGRATOR,
    DirectorRole.ANALYST,
    DirectorRole.EVALUATOR,
    DirectorRole.STRATEGIST,
    DirectorRole.CRITIC,
]

DEFAULT_DIRECTOR_COUNT = 5
MIN_DIRECTOR_COUNT = 2
MAX_DIRECTOR_COUNT = 12


# ---------------------------------------------------------------------------
# DirectorPool
# ---------------------------------------------------------------------------
class DirectorPool:
    """
    Pool of functional directors with variable count (2-12).

    Directors are drawn from the five ``DirectorRole`` types in priority
    order. When count exceeds 5, roles cycle (e.g., 7 directors means
    5 unique roles + 2 repeated from the top of the priority list).

    Directors are keyed by string identifiers like ``"analyst_0"``,
    ``"integrator_1"`` etc., where the suffix is the instance index
    within that role.

    Parameters
    ----------
    director_count : int
        Number of directors (2-12). Defaults to ``DEFAULT_DIRECTOR_COUNT`` (5).

    Methods
    -------
    process(perception)
        Run all RNNs and return their outputs keyed by string id.
    learn(key, perception, bias, outcome)
        Train a specific director's RNN from an outcome signal.
    get_state() / from_state(state)
        Serialise and reconstruct the pool.
    """

    def __init__(self, director_count: int = DEFAULT_DIRECTOR_COUNT) -> None:
        """Create a pool with ``director_count`` directors.

        Parameters
        ----------
        director_count : int
            Number of directors to create (2-12).

        Raises
        ------
        ValueError
            If director_count is outside [MIN_DIRECTOR_COUNT, MAX_DIRECTOR_COUNT].
        """
        if director_count < MIN_DIRECTOR_COUNT or director_count > MAX_DIRECTOR_COUNT:
            raise ValueError(
                f"director_count must be between {MIN_DIRECTOR_COUNT} and "
                f"{MAX_DIRECTOR_COUNT}, got {director_count}"
            )

        self.director_count = director_count
        self.directors: dict[str, Director] = {}

        for i in range(director_count):
            role = DIRECTOR_ROLE_PRIORITY[i % len(DIRECTOR_ROLE_PRIORITY)]
            instance = i // len(DIRECTOR_ROLE_PRIORITY)
            key = f"{role.value}_{instance}"
            self.directors[key] = Director(
                role=role,
                rnn=DirectorRNN(),
            )

    def process(
        self, perception: np.ndarray, active_count: int | None = None,
    ) -> dict[str, np.ndarray]:
        """
        Run RNNs and return their bias vectors.

        Parameters
        ----------
        perception : np.ndarray
            Perception vector broadcast to every director.
        active_count : int | None
            If provided, only the first ``active_count`` directors run.

        Returns
        -------
        dict mapping director string key -> 6-element bias vector.
        """
        count = (
            min(active_count, self.director_count)
            if active_count is not None
            else self.director_count
        )
        results: dict[str, np.ndarray] = {}
        for i, (key, director) in enumerate(self.directors.items()):
            if i >= count:
                break
            results[key] = director.rnn.forward(perception)
            director.total_runs += 1
        return results

    def learn(
        self,
        key: str | DirectorRole,
        perception: np.ndarray,
        bias: np.ndarray,
        outcome: float,
    ) -> None:
        """
        Train a specific director's RNN from an outcome signal.

        Also updates the director's running mean outcome.

        Parameters
        ----------
        key : str | DirectorRole
            Which director to train. Accepts string key (e.g. ``"analyst_0"``)
            or ``DirectorRole`` enum (maps to ``f"{role.value}_0"``).
        perception : np.ndarray
            The perception vector used during ``process()``.
        bias : np.ndarray
            The bias output from ``process()`` for this key.
        outcome : float
            Quality signal (positive = better than average).
        """
        # Convert DirectorRole enum to string key for convenience
        if isinstance(key, DirectorRole):
            key = f"{key.value}_0"

        director = self.directors[key]
        director.rnn.learn_from_outcome(perception, bias, outcome)

        # Update running mean
        n = max(director.total_runs, 1)
        director.mean_outcome += (outcome - director.mean_outcome) / n

    def get_state(self) -> dict:
        """Serialise the entire pool for persistence.

        Returns a dict with ``director_count`` and ``directors`` sub-dict.
        """
        return {
            "director_count": self.director_count,
            "directors": {
                key: {
                    "rnn": director.rnn.get_state(),
                    "experience": director.experience,
                    "total_runs": director.total_runs,
                    "mean_outcome": director.mean_outcome,
                }
                for key, director in self.directors.items()
            },
        }

    @classmethod
    def from_state(cls, state: dict) -> DirectorPool:
        """Reconstruct a pool from persisted state."""
        if not state:
            return cls()

        return cls._from_new_state(state)

    @classmethod
    def _from_new_state(cls, state: dict) -> DirectorPool:
        """Reconstruct from serialised state with director_count."""
        count = state["director_count"]
        pool = cls.__new__(cls)
        pool.director_count = count
        pool.directors = {}

        directors_data = state.get("directors", {})
        for i in range(count):
            role = DIRECTOR_ROLE_PRIORITY[i % len(DIRECTOR_ROLE_PRIORITY)]
            instance = i // len(DIRECTOR_ROLE_PRIORITY)
            key = f"{role.value}_{instance}"

            data = directors_data.get(key, {})
            rnn_state = data.get("rnn")
            rnn = DirectorRNN.from_state(rnn_state) if rnn_state else DirectorRNN()
            pool.directors[key] = Director(
                role=role,
                rnn=rnn,
                experience=data.get("experience", {}),
                total_runs=data.get("total_runs", 0),
                mean_outcome=data.get("mean_outcome", 0.0),
            )

        return pool
