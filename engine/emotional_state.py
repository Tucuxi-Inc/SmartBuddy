"""
Emotional State System for SmartBuddy.

Implements real-time emotional influences on personality traits, allowing
the buddy to temporarily exhibit different personality characteristics based
on its current emotional state.  Emotions decay linearly over session ticks
and produce a modifier vector that is added to the buddy's base traits.

Emotions are grounded in coding/learning contexts (joy at a fix, curiosity
when exploring, frustration when stuck, etc.).

Extracted from Living Worlds' cognitive/core/emotional_state.py.
Pure math (NumPy), no I/O, no Living Worlds dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np

from engine.traits import TraitSystem, TRAIT_NAME_TO_INDEX


# ---------------------------------------------------------------------------
# Emotion enum
# ---------------------------------------------------------------------------
class Emotion(Enum):
    """Primary emotions the SmartBuddy can experience during a coding session."""
    JOY = "joy"
    CURIOSITY = "curiosity"
    FRUSTRATION = "frustration"
    ANXIETY = "anxiety"
    SATISFACTION = "satisfaction"
    SURPRISE = "surprise"
    DETERMINATION = "determination"
    BOREDOM = "boredom"
    EXCITEMENT = "excitement"
    WARINESS = "wariness"
    CONTENTMENT = "contentment"
    IRRITATION = "irritation"


# ---------------------------------------------------------------------------
# EmotionalState
# ---------------------------------------------------------------------------
@dataclass
class EmotionalState:
    """
    A single active emotional state.

    Intensity decays linearly from ``tick_created`` over ``decay_ticks``.

    Attributes
    ----------
    emotion : Emotion
        The type of emotion.
    intensity : float
        Starting intensity in [0, 1].
    valence : float
        Hedonic valence in [-1, 1].  Positive = pleasant, negative = unpleasant.
    tick_created : int
        Session tick at which this emotion began.
    decay_ticks : int
        Number of ticks until intensity reaches zero.
    """
    emotion: Emotion
    intensity: float
    valence: float
    tick_created: int
    decay_ticks: int = 50

    def current_intensity(self, current_tick: int) -> float:
        """
        Compute remaining intensity at *current_tick* via linear decay.

        Returns 0.0 when elapsed >= decay_ticks.
        """
        elapsed = current_tick - self.tick_created
        if elapsed < 0:
            return self.intensity
        if elapsed >= self.decay_ticks:
            return 0.0
        decay_factor = 1.0 - (elapsed / self.decay_ticks)
        return self.intensity * decay_factor

    def is_active(self, current_tick: int) -> bool:
        """Return ``True`` if the emotion has not fully decayed."""
        return self.current_intensity(current_tick) > 0.0


# ---------------------------------------------------------------------------
# Emotion -> trait modifier map
# ---------------------------------------------------------------------------
# Maps Emotion -> dict of trait_name -> modifier per unit intensity.
# These are additive adjustments applied to the base trait vector.
EMOTION_TRAIT_MODIFIERS: dict[Emotion, dict[str, float]] = {
    # JOY ← HAPPY: positive affect, social energy, reduced anxiety
    Emotion.JOY: {
        "extraversion": 0.10,
        "optimism": 0.15,
        "neuroticism": -0.10,
    },
    # CURIOSITY: exploration drive, openness, cognitive engagement
    Emotion.CURIOSITY: {
        "openness": 0.15,
        "creativity": 0.10,
        "curiosity": 0.15,
    },
    # FRUSTRATION ← FRUSTRATED: patience erodes, instability rises
    Emotion.FRUSTRATION: {
        "patience": -0.15,
        "neuroticism": 0.10,
        "emotional_stability": -0.10,
    },
    # ANXIETY ← ANXIOUS: worry, reduced risk-taking and confidence
    Emotion.ANXIETY: {
        "neuroticism": 0.15,
        "risk_taking": -0.10,
        "confidence": -0.10,
    },
    # SATISFACTION ← CONTENT: calm achievement, stable positive state
    Emotion.SATISFACTION: {
        "emotional_stability": 0.10,
        "optimism": 0.10,
        "patience": 0.10,
    },
    # SURPRISE ← PROUD: heightened confidence and assertiveness
    Emotion.SURPRISE: {
        "confidence": 0.15,
        "assertiveness": 0.10,
        "humility": -0.10,
    },
    # DETERMINATION ← ANGRY (redirected positively): persistence, drive
    Emotion.DETERMINATION: {
        "assertiveness": 0.10,
        "persistence": 0.15,
        "patience": 0.05,
    },
    # BOREDOM ← SAD: withdrawal, reduced curiosity and energy
    Emotion.BOREDOM: {
        "extraversion": -0.10,
        "optimism": -0.10,
        "curiosity": -0.10,
    },
    # EXCITEMENT ← EXCITED: high energy, playful, risk-positive
    Emotion.EXCITEMENT: {
        "extraversion": 0.12,
        "risk_taking": 0.10,
        "playfulness": 0.10,
    },
    # WARINESS ← FEARFUL: caution up, risk-taking and confidence down
    Emotion.WARINESS: {
        "caution": 0.15,
        "risk_taking": -0.15,
        "confidence": -0.10,
    },
    # CONTENTMENT ← CALM: stability, patience, reduced neurotic reactivity
    Emotion.CONTENTMENT: {
        "emotional_stability": 0.15,
        "patience": 0.12,
        "neuroticism": -0.12,
    },
    # IRRITATION ← ANGRY: assertiveness spikes, agreeableness and patience drop
    Emotion.IRRITATION: {
        "assertiveness": 0.15,
        "self_control": -0.10,
        "agreeableness": -0.10,
        "patience": -0.10,
    },
}


# ---------------------------------------------------------------------------
# EmotionalSystem
# ---------------------------------------------------------------------------
class EmotionalSystem:
    """
    Manages active emotions and computes their combined effect on traits.

    Parameters
    ----------
    trait_system : TraitSystem
        Provides the trait count and name-to-index lookups.
    """

    def __init__(self, trait_system: TraitSystem):
        self.trait_system = trait_system

        # Pre-build modifier vectors for each emotion (index-based for speed)
        self._modifier_vectors: dict[Emotion, np.ndarray] = {}
        for emotion, modifiers in EMOTION_TRAIT_MODIFIERS.items():
            vec = np.zeros(trait_system.count, dtype=np.float64)
            for trait_name, value in modifiers.items():
                idx = TRAIT_NAME_TO_INDEX.get(trait_name)
                if idx is not None:
                    vec[idx] = value
            self._modifier_vectors[emotion] = vec

    def add_emotion(
        self,
        emotion: Emotion,
        intensity: float,
        valence: float,
        tick: int,
        decay_ticks: int = 50,
    ) -> EmotionalState:
        """
        Create a new EmotionalState.

        Parameters
        ----------
        emotion : Emotion
            Which emotion.
        intensity : float
            Starting intensity in [0, 1].
        valence : float
            Hedonic valence in [-1, 1].
        tick : int
            Current session tick (used as creation time).
        decay_ticks : int
            Ticks until the emotion fully decays.

        Returns
        -------
        EmotionalState
        """
        return EmotionalState(
            emotion=emotion,
            intensity=float(np.clip(intensity, 0.0, 1.0)),
            valence=float(np.clip(valence, -1.0, 1.0)),
            tick_created=tick,
            decay_ticks=decay_ticks,
        )

    def compute_trait_modifiers(
        self,
        active_states: list[EmotionalState],
        current_tick: int,
    ) -> np.ndarray:
        """
        Compute the combined trait modifier vector from all active emotions.

        The result is an additive vector (not multiplicative) that should
        be summed with the base trait vector.  Each emotion's contribution
        is scaled by its current (decayed) intensity.

        Parameters
        ----------
        active_states : list[EmotionalState]
            All emotional states (may include already-decayed ones).
        current_tick : int
            Current session tick.

        Returns
        -------
        np.ndarray of shape ``(trait_count,)`` -- add to base traits.
        """
        modifier = np.zeros(self.trait_system.count, dtype=np.float64)

        for state in active_states:
            ci = state.current_intensity(current_tick)
            if ci <= 0.0:
                continue
            vec = self._modifier_vectors.get(state.emotion)
            if vec is not None:
                modifier += vec * ci

        return modifier

    @staticmethod
    def decay_emotions(
        states: list[EmotionalState], current_tick: int
    ) -> list[EmotionalState]:
        """
        Filter out fully-decayed emotional states.

        Parameters
        ----------
        states : list[EmotionalState]
            Full list of emotional states (active + expired).
        current_tick : int
            Current session tick.

        Returns
        -------
        list[EmotionalState] containing only still-active states.
        """
        return [s for s in states if s.is_active(current_tick)]
