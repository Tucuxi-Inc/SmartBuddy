"""
50-Trait Personality System for SmartBuddy.

Implements a 50-dimensional personality trait vector organized into five
categories (Big Five, Cognitive, Social, Emotional, Behavioral). Each trait
is a continuous value in [0, 1].

Extracted from Living Worlds' cognitive engine. Pure math (NumPy), no I/O,
no Living Worlds dependencies.

Key types:
    TraitDefinition  -- metadata for a single trait (index, name, category)
    TraitSystem      -- lookup, random generation, distance, dominant traits
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

# ---------------------------------------------------------------------------
# Trait count
# ---------------------------------------------------------------------------
TRAIT_COUNT = 50


# ---------------------------------------------------------------------------
# TraitDefinition
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class TraitDefinition:
    """Metadata for a single personality trait."""
    index: int
    name: str
    description: str
    category: str


# ---------------------------------------------------------------------------
# The 50 traits (indices 0-49)
# ---------------------------------------------------------------------------
TRAITS: list[TraitDefinition] = [
    # Big Five (0-4)
    TraitDefinition(0,  "openness",            "Openness to experience",               "big_five"),
    TraitDefinition(1,  "conscientiousness",    "Organization and discipline",          "big_five"),
    TraitDefinition(2,  "extraversion",         "Social energy and outgoingness",       "big_five"),
    TraitDefinition(3,  "agreeableness",        "Cooperation and trust in others",      "big_five"),
    TraitDefinition(4,  "neuroticism",          "Emotional reactivity and sensitivity", "big_five"),

    # Cognitive (5-9)
    TraitDefinition(5,  "creativity",           "Imaginative and inventive thinking",   "cognitive"),
    TraitDefinition(6,  "curiosity",            "Desire to explore and learn",          "cognitive"),
    TraitDefinition(7,  "adaptability",         "Ability to adjust to new situations",  "cognitive"),
    TraitDefinition(8,  "resilience",           "Recovery from setbacks",               "cognitive"),
    TraitDefinition(9,  "ambition",             "Drive for achievement",                "cognitive"),

    # Social (10-14)
    TraitDefinition(10, "empathy",              "Understanding others' feelings",       "social"),
    TraitDefinition(11, "trust",                "Willingness to rely on others",        "social"),
    TraitDefinition(12, "assertiveness",        "Directness in communication",          "social"),
    TraitDefinition(13, "self_control",         "Restraint and impulse regulation",     "social"),
    TraitDefinition(14, "optimism",             "Positive expectation of outcomes",     "social"),

    # Emotional (15-19)
    TraitDefinition(15, "risk_taking",          "Willingness to accept uncertainty",    "emotional"),
    TraitDefinition(16, "patience",             "Tolerance for delay",                  "emotional"),
    TraitDefinition(17, "humor",                "Appreciation of comedy and play",      "emotional"),
    TraitDefinition(18, "independence",         "Self-reliance and autonomy",           "emotional"),
    TraitDefinition(19, "sensitivity",          "Awareness of subtle stimuli",          "emotional"),

    # Behavioral (20-24)
    TraitDefinition(20, "depth_drive",          "Compulsion toward deep processing",    "behavioral"),
    TraitDefinition(21, "dominance",            "Desire to lead and control",           "behavioral"),
    TraitDefinition(22, "warmth",               "Emotional approachability",            "behavioral"),
    TraitDefinition(23, "discipline",           "Adherence to routine and structure",   "behavioral"),
    TraitDefinition(24, "integrity",            "Consistency of values and actions",    "behavioral"),

    # Social extended (25-29)
    TraitDefinition(25, "loyalty",              "Faithfulness to commitments",          "social"),
    TraitDefinition(26, "competitiveness",      "Drive to outperform others",           "social"),
    TraitDefinition(27, "generosity",           "Willingness to share resources",       "social"),
    TraitDefinition(28, "pragmatism",           "Practical problem-solving focus",      "cognitive"),
    TraitDefinition(29, "idealism",             "Pursuit of abstract principles",       "cognitive"),

    # Cognitive extended (30-34)
    TraitDefinition(30, "sociability",          "Enjoyment of social interaction",      "social"),
    TraitDefinition(31, "introversion",         "Preference for solitude and reflection", "emotional"),
    TraitDefinition(32, "analytical",           "Systematic logical reasoning",         "cognitive"),
    TraitDefinition(33, "intuitive",            "Gut-feel pattern recognition",         "cognitive"),
    TraitDefinition(34, "emotional_stability",  "Steadiness under pressure",            "emotional"),

    # Behavioral extended (35-39)
    TraitDefinition(35, "persistence",          "Tenacity in pursuing goals",           "behavioral"),
    TraitDefinition(36, "flexibility",          "Willingness to change approach",       "behavioral"),
    TraitDefinition(37, "confidence",           "Belief in own abilities",              "emotional"),
    TraitDefinition(38, "humility",             "Modesty and openness to correction",   "emotional"),
    TraitDefinition(39, "cooperativeness",      "Tendency to work with others",         "social"),

    # Final block (40-49)
    TraitDefinition(40, "resourcefulness",      "Ability to find creative solutions",   "behavioral"),
    TraitDefinition(41, "adventurousness",      "Appetite for novel experiences",        "behavioral"),
    TraitDefinition(42, "caution",              "Careful evaluation before acting",      "behavioral"),
    TraitDefinition(43, "traditionalism",       "Respect for established ways",          "behavioral"),
    TraitDefinition(44, "innovation",           "Drive to create new methods",           "cognitive"),
    TraitDefinition(45, "tolerance",            "Acceptance of differing views",         "social"),
    TraitDefinition(46, "expressiveness",       "Outward display of inner states",       "emotional"),
    TraitDefinition(47, "stoicism",             "Endurance without complaint",           "emotional"),
    TraitDefinition(48, "spirituality",         "Sense of transcendent meaning",         "emotional"),
    TraitDefinition(49, "playfulness",          "Lighthearted engagement with the world", "behavioral"),
]

assert len(TRAITS) == TRAIT_COUNT, f"Expected {TRAIT_COUNT} traits, got {len(TRAITS)}"

# ---------------------------------------------------------------------------
# Index look-ups
# ---------------------------------------------------------------------------
TRAIT_NAME_TO_INDEX: dict[str, int] = {t.name: t.index for t in TRAITS}
TRAIT_INDEX_TO_NAME: dict[int, str] = {t.index: t.name for t in TRAITS}


# ---------------------------------------------------------------------------
# Boundary constants for experiential updates
# ---------------------------------------------------------------------------
TRAIT_BOUNDARY_FADE_THRESHOLD = 0.75    # boundary dampening starts here
TRAIT_FREQUENCY_DEPENDENT_THRESHOLD = 0.70  # frequency-dependent halving starts here
TRAIT_EXPERIENTIAL_MIN = 0.10           # hard floor for experiential updates
TRAIT_EXPERIENTIAL_MAX = 0.90           # hard ceiling for experiential updates

# Derived: dampening goes from 1.0 at threshold to 0.0 at max
_UPPER_FADE_RANGE = TRAIT_EXPERIENTIAL_MAX - TRAIT_BOUNDARY_FADE_THRESHOLD  # 0.15
_LOWER_FADE_RANGE = (1.0 - TRAIT_BOUNDARY_FADE_THRESHOLD) - TRAIT_EXPERIENTIAL_MIN  # 0.15


# ---------------------------------------------------------------------------
# TraitSystem
# ---------------------------------------------------------------------------
class TraitSystem:
    """
    Core trait operations: lookup, random generation, distance, dominant traits.

    All trait vectors are ``np.ndarray`` of shape ``(50,)`` with values in [0, 1].
    """

    # Named index constants for convenient attribute-style access.
    OPENNESS            = 0
    CONSCIENTIOUSNESS   = 1
    EXTRAVERSION        = 2
    AGREEABLENESS       = 3
    NEUROTICISM         = 4
    CREATIVITY          = 5
    CURIOSITY           = 6
    ADAPTABILITY        = 7
    RESILIENCE          = 8
    AMBITION            = 9
    EMPATHY             = 10
    TRUST               = 11
    ASSERTIVENESS       = 12
    SELF_CONTROL        = 13
    OPTIMISM            = 14
    RISK_TAKING         = 15
    PATIENCE            = 16
    HUMOR               = 17
    INDEPENDENCE        = 18
    SENSITIVITY         = 19
    DEPTH_DRIVE         = 20
    DOMINANCE           = 21
    WARMTH              = 22
    DISCIPLINE          = 23
    INTEGRITY           = 24
    LOYALTY             = 25
    COMPETITIVENESS     = 26
    GENEROSITY          = 27
    PRAGMATISM          = 28
    IDEALISM            = 29
    SOCIABILITY         = 30
    INTROVERSION        = 31
    ANALYTICAL          = 32
    INTUITIVE           = 33
    EMOTIONAL_STABILITY = 34
    PERSISTENCE         = 35
    FLEXIBILITY         = 36
    CONFIDENCE          = 37
    HUMILITY            = 38
    COOPERATIVENESS     = 39
    RESOURCEFULNESS     = 40
    ADVENTUROUSNESS     = 41
    CAUTION             = 42
    TRADITIONALISM      = 43
    INNOVATION          = 44
    TOLERANCE           = 45
    EXPRESSIVENESS      = 46
    STOICISM            = 47
    SPIRITUALITY        = 48
    PLAYFULNESS         = 49

    @property
    def count(self) -> int:
        """Number of traits in the system."""
        return TRAIT_COUNT

    def trait_index(self, name: str) -> int:
        """
        Return the integer index of a trait by name.

        Raises ``KeyError`` if the name is not recognised.
        """
        try:
            return TRAIT_NAME_TO_INDEX[name]
        except KeyError:
            raise KeyError(f"Unknown trait name: {name!r}")

    def random_traits(self, rng: Optional[np.random.Generator] = None) -> np.ndarray:
        """
        Generate a random trait vector with each value drawn uniformly from [0, 1].

        Parameters
        ----------
        rng : numpy Generator, optional
            Reproducible random source.

        Returns
        -------
        np.ndarray of shape (50,) with dtype float64, values in [0, 1].
        """
        rng = rng or np.random.default_rng()
        return rng.uniform(0.0, 1.0, TRAIT_COUNT).astype(np.float64)

    @staticmethod
    def trait_distance(a: np.ndarray, b: np.ndarray) -> float:
        """
        Compute normalised Euclidean distance between two trait vectors.

        The raw Euclidean distance is divided by ``sqrt(TRAIT_COUNT)`` so the
        result is in [0, 1] when both vectors are in [0, 1].
        """
        return float(np.linalg.norm(a - b) / np.sqrt(TRAIT_COUNT))

    @staticmethod
    def get_dominant_traits(
        traits: np.ndarray, top_n: int = 5
    ) -> list[tuple[str, float]]:
        """
        Return the *top_n* traits with the highest values.

        Returns
        -------
        List of ``(trait_name, value)`` tuples sorted descending by value.
        """
        indices = np.argsort(traits)[::-1][:top_n]
        return [(TRAIT_INDEX_TO_NAME[int(i)], float(traits[i])) for i in indices]


# ---------------------------------------------------------------------------
# Experiential update helper
# ---------------------------------------------------------------------------
def dampen_trait_update(current: float, delta: float) -> float:
    """Apply delta with frequency-dependent + boundary dampening.

    Two-stage dampening prevents experiential saturation:

    Stage 1 (frequency-dependent): When trait > 0.70 (positive delta)
    or < 0.30 (negative delta), delta is halved. Models diminishing
    returns — an already-extreme buddy gains less from reinforcement.

    Stage 2 (boundary fade): When trait > 0.75 (positive delta) or
    < 0.25 (negative delta), delta is further scaled by remaining
    headroom toward the hard limits.

    Returns the new trait value clamped to [0.10, 0.90].
    """
    # Stage 1: frequency-dependent halving for extreme traits
    if delta > 0 and current > TRAIT_FREQUENCY_DEPENDENT_THRESHOLD:
        delta *= 0.5
    elif delta < 0 and current < (1.0 - TRAIT_FREQUENCY_DEPENDENT_THRESHOLD):
        delta *= 0.5

    # Stage 2: boundary fade toward hard limits
    if delta > 0 and current > TRAIT_BOUNDARY_FADE_THRESHOLD:
        headroom = max(TRAIT_EXPERIENTIAL_MAX - current, 0.0)
        delta *= headroom / _UPPER_FADE_RANGE
    elif delta < 0 and current < (1.0 - TRAIT_BOUNDARY_FADE_THRESHOLD):
        headroom = max(current - TRAIT_EXPERIENTIAL_MIN, 0.0)
        delta *= headroom / _LOWER_FADE_RANGE

    new_val = current + delta
    return max(TRAIT_EXPERIENTIAL_MIN, min(TRAIT_EXPERIENTIAL_MAX, new_val))
