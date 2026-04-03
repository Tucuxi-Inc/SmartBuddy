"""
Personality Evolution Engine for SmartBuddy.

Implements dynamic personality changes based on coding session patterns,
emotional experiences, and interaction types over time.  Personalities
shift gradually through accumulated ``PersonalityShift`` events that decay
linearly over a configurable number of session ticks.

Correlated shifts propagate changes to related traits (e.g. a patience
shift co-triggers a self_control shift at 25% magnitude).

Triggers are grounded in real coding workflows: debugging, creative
exploration, methodical testing, collaborative sessions, grind work,
breakthroughs, and cautious recovery after mistakes.

Extracted from Living Worlds' cognitive/core/personality_evolution.py.
Pure math (NumPy), no I/O, no Living Worlds dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import numpy as np

from engine.traits import TraitSystem, TRAIT_NAME_TO_INDEX, dampen_trait_update


# ---------------------------------------------------------------------------
# EvolutionTrigger
# ---------------------------------------------------------------------------
class EvolutionTrigger(Enum):
    """Types of coding-session events that can trigger personality evolution."""
    SUSTAINED_DEBUGGING = "sustained_debugging"
    CREATIVE_EXPLORATION = "creative_exploration"
    METHODICAL_TESTING = "methodical_testing"
    COLLABORATIVE_SESSION = "collaborative_session"
    LONG_GRIND = "long_grind"
    BREAKTHROUGH = "breakthrough"
    CAUTIOUS_RECOVERY = "cautious_recovery"


# ---------------------------------------------------------------------------
# PersonalityShift
# ---------------------------------------------------------------------------
@dataclass
class PersonalityShift:
    """
    A single shift event applied to a personality trait.

    The shift has a base ``magnitude`` that decays linearly from
    ``tick_created`` over ``decay_ticks`` session ticks.

    Attributes
    ----------
    trait_index : int
        Index into the 50-dim trait vector.
    magnitude : float
        Signed shift amount in [-1, 1].  Positive increases the trait;
        negative decreases it.
    trigger : EvolutionTrigger
        What caused this shift.
    tick_created : int
        Session tick at which this shift was created.
    decay_ticks : int
        Number of ticks over which this shift linearly decays to zero.
    """
    trait_index: int
    magnitude: float
    trigger: EvolutionTrigger
    tick_created: int
    decay_ticks: int = 100

    def current_magnitude(self, current_tick: int) -> float:
        """
        Compute the remaining magnitude at *current_tick* via linear decay.

        Returns 0.0 if the shift has fully decayed (elapsed >= decay_ticks).
        """
        elapsed = current_tick - self.tick_created
        if elapsed < 0:
            return self.magnitude
        if elapsed >= self.decay_ticks:
            return 0.0
        decay_factor = 1.0 - (elapsed / self.decay_ticks)
        return self.magnitude * decay_factor


# ---------------------------------------------------------------------------
# Trait correlation matrix
# ---------------------------------------------------------------------------
# Maps (source_trait, target_trait) -> co-shift ratio.
# When the source trait shifts by X, the target co-shifts by X * ratio.
# Every pair (a, b) must have a matching (b, a) entry for symmetry.
TRAIT_CORRELATION_MATRIX: dict[tuple[str, str], float] = {
    # Trust <-> Loyalty
    ("trust", "loyalty"): 0.3,
    ("loyalty", "trust"): 0.25,
    # Empathy <-> Warmth
    ("empathy", "warmth"): 0.3,
    ("warmth", "empathy"): 0.25,
    # Conscientiousness <-> Discipline
    ("conscientiousness", "discipline"): 0.35,
    ("discipline", "conscientiousness"): 0.3,
    # Openness <-> Curiosity
    ("openness", "curiosity"): 0.3,
    ("curiosity", "openness"): 0.25,
    # Extraversion <-> Sociability
    ("extraversion", "sociability"): 0.18,
    ("sociability", "extraversion"): 0.15,
    # Neuroticism <-> Emotional stability (inverse)
    ("neuroticism", "emotional_stability"): -0.2,
    ("emotional_stability", "neuroticism"): -0.18,
    # Confidence <-> Assertiveness
    ("confidence", "assertiveness"): 0.3,
    ("assertiveness", "confidence"): 0.25,
    # Resilience <-> Persistence
    ("resilience", "persistence"): 0.3,
    ("persistence", "resilience"): 0.25,
    # Creativity <-> Innovation
    ("creativity", "innovation"): 0.3,
    ("innovation", "creativity"): 0.25,
    # Agreeableness <-> Cooperativeness
    ("agreeableness", "cooperativeness"): 0.18,
    ("cooperativeness", "agreeableness"): 0.15,
    # Ambition <-> Competitiveness
    ("ambition", "competitiveness"): 0.25,
    ("competitiveness", "ambition"): 0.2,
    # Optimism <-> Confidence
    ("optimism", "confidence"): 0.25,
    ("confidence", "optimism"): 0.2,
    # Risk taking <-> Adventurousness
    ("risk_taking", "adventurousness"): 0.3,
    ("adventurousness", "risk_taking"): 0.25,
    # Caution <-> Risk taking (inverse)
    ("caution", "risk_taking"): -0.3,
    ("risk_taking", "caution"): -0.25,
    # Patience <-> Self control
    ("patience", "self_control"): 0.25,
    ("self_control", "patience"): 0.2,
    # Generosity <-> Empathy
    ("generosity", "empathy"): 0.2,
    ("empathy", "generosity"): 0.15,
}


# ---------------------------------------------------------------------------
# Evolution rules
# ---------------------------------------------------------------------------
# Maps trigger -> list of (trait_name, direction, base_magnitude).
# Direction: +1 = increase trait, -1 = decrease trait.
EVOLUTION_RULES: dict[EvolutionTrigger, list[tuple[str, float, float]]] = {
    EvolutionTrigger.SUSTAINED_DEBUGGING: [
        ("patience", +1, 0.02),
        ("self_control", +1, 0.015),
        ("resilience", +1, 0.01),
        ("risk_taking", -1, 0.01),
    ],
    EvolutionTrigger.CREATIVE_EXPLORATION: [
        ("curiosity", +1, 0.02),
        ("openness", +1, 0.015),
        ("caution", -1, 0.01),
        ("adventurousness", +1, 0.01),
    ],
    EvolutionTrigger.METHODICAL_TESTING: [
        ("conscientiousness", +1, 0.02),
        ("discipline", +1, 0.015),
        ("patience", +1, 0.01),
        ("playfulness", -1, 0.01),
    ],
    EvolutionTrigger.COLLABORATIVE_SESSION: [
        ("sociability", +1, 0.02),
        ("empathy", +1, 0.015),
        ("cooperativeness", +1, 0.01),
        ("independence", -1, 0.01),
    ],
    EvolutionTrigger.LONG_GRIND: [
        ("persistence", +1, 0.02),
        ("resilience", +1, 0.015),
        ("optimism", -1, 0.01),
        ("patience", +1, 0.01),
    ],
    EvolutionTrigger.BREAKTHROUGH: [
        ("confidence", +1, 0.03),
        ("optimism", +1, 0.02),
        ("curiosity", +1, 0.015),
        ("neuroticism", -1, 0.02),
    ],
    EvolutionTrigger.CAUTIOUS_RECOVERY: [
        ("caution", +1, 0.02),
        ("conscientiousness", +1, 0.015),
        ("risk_taking", -1, 0.015),
        ("patience", +1, 0.01),
    ],
}


# ---------------------------------------------------------------------------
# PersonalityEvolutionEngine
# ---------------------------------------------------------------------------
class PersonalityEvolutionEngine:
    """
    Manages personality evolution based on coding session experiences.

    Parameters
    ----------
    trait_system : TraitSystem
        Provides trait count and name lookups.
    learning_rates : np.ndarray, optional
        Per-trait learning-rate multipliers (shape ``(trait_count,)``).
        Defaults to all-ones (uniform learning rate).
    """

    def __init__(
        self,
        trait_system: TraitSystem,
        learning_rates: np.ndarray | None = None,
    ):
        self.trait_system = trait_system
        if learning_rates is not None:
            self.learning_rates = learning_rates.copy()
        else:
            self.learning_rates = np.ones(trait_system.count, dtype=np.float64)

    def create_shift(
        self,
        trigger: EvolutionTrigger,
        base_magnitude: float = 0.05,
        tick: int = 0,
        decay_ticks: int = 100,
    ) -> list[PersonalityShift]:
        """
        Generate primary + correlated personality shifts for a trigger.

        The primary shifts are drawn from ``EVOLUTION_RULES`` and scaled
        by *base_magnitude*.  For each primary shift, any correlated
        traits (from ``TRAIT_CORRELATION_MATRIX``) receive a proportional
        co-shift.

        Parameters
        ----------
        trigger : EvolutionTrigger
            The type of event that occurred.
        base_magnitude : float
            Scaling factor applied to the rule's default magnitude.
            For example, a particularly intense event might use 0.10.
        tick : int
            The session tick at which the event occurred.
        decay_ticks : int
            How many ticks until each shift fully decays.

        Returns
        -------
        list[PersonalityShift]
            All shifts to be applied (primary + correlated).
        """
        rules = EVOLUTION_RULES.get(trigger, [])
        shifts: list[PersonalityShift] = []
        created_indices: set[int] = set()

        for trait_name, direction, rule_mag in rules:
            idx = TRAIT_NAME_TO_INDEX.get(trait_name)
            if idx is None:
                continue

            magnitude = direction * rule_mag * (base_magnitude / 0.05)
            magnitude *= float(self.learning_rates[idx])

            primary = PersonalityShift(
                trait_index=idx,
                magnitude=magnitude,
                trigger=trigger,
                tick_created=tick,
                decay_ticks=decay_ticks,
            )
            shifts.append(primary)
            created_indices.add(idx)

            # Correlated shifts
            for (src, tgt), ratio in TRAIT_CORRELATION_MATRIX.items():
                if src == trait_name:
                    tgt_idx = TRAIT_NAME_TO_INDEX.get(tgt)
                    if tgt_idx is not None and tgt_idx not in created_indices:
                        co_magnitude = magnitude * ratio
                        co_shift = PersonalityShift(
                            trait_index=tgt_idx,
                            magnitude=co_magnitude,
                            trigger=trigger,
                            tick_created=tick,
                            decay_ticks=decay_ticks,
                        )
                        shifts.append(co_shift)
                        created_indices.add(tgt_idx)

        return shifts

    def apply_shifts(
        self,
        traits: np.ndarray,
        shifts: list[PersonalityShift],
        current_tick: int,
    ) -> np.ndarray:
        """
        Apply all active (non-decayed) shifts to a trait vector.

        Parameters
        ----------
        traits : np.ndarray
            Base trait vector (shape = trait count).
        shifts : list[PersonalityShift]
            All accumulated shifts (may include already-decayed ones).
        current_tick : int
            Current session tick.

        Returns
        -------
        np.ndarray
            New trait vector clamped to [0, 1].
        """
        result = traits.copy()
        for shift in shifts:
            mag = shift.current_magnitude(current_tick)
            if mag != 0.0:
                result[shift.trait_index] = dampen_trait_update(
                    float(result[shift.trait_index]), mag,
                )
        return result

    @staticmethod
    def get_active_shifts(
        shifts: list[PersonalityShift], current_tick: int
    ) -> list[PersonalityShift]:
        """Return only shifts that have not fully decayed."""
        return [
            s for s in shifts
            if s.current_magnitude(current_tick) != 0.0
        ]
