"""ASCII sprite system with trait-driven expressions and earned adornments."""
from __future__ import annotations

from typing import Optional

import numpy as np

from engine.emotional_state import Emotion
from engine.traits import TraitSystem

_ts = TraitSystem()

EXPRESSIONS = {
    "neutral":     ". .",
    "happy":       "^ ^",
    "focused":     "- -",
    "surprised":   "O O",
    "skeptical":   "> .",
    "tired":       "~ ~",
    "excited":     "* *",
    "side_glance": ". ·",
}

# Minimal sprite templates — 5 lines, {E} = eye placeholder
# Community can contribute more elaborate ones
_SPRITE_TEMPLATES: dict[str, list[list[str]]] = {
    "cat": [
        [" /\\_/\\ ", " /\\_/\\ ", " /\\_/\\ "],
        ["( {E} )", "( {E} )", "( {E} )"],
        [" > ^ < ", " > ^ < ", " > ^ < "],
        [" /| |\\ ", "  | |  ", " /| |\\ "],
        ["(_| |_)", " (_|_) ", "(_| |_)"],
    ],
    "duck": [
        ["  __   ", "  __   ", "  __   "],
        [" ({E}) ", " ({E}) ", " ({E}) "],
        ["  )>   ", "  )>   ", "  )<   "],
        [" / |   ", "  /|   ", " / |   "],
        ["(_/    ", " (_/   ", "(_/    "],
    ],
    "dragon": [
        [" /\\/\\  ", " /\\/\\  ", " /\\/\\  "],
        ["({E} ) ", "({E} ) ", "({E} ) "],
        [" >===< ", " >===< ", " >==<  "],
        [" | /|  ", "  /|   ", " | /|  "],
        [" |/ |~ ", " |/ |~ ", " |/ |~ "],
    ],
}

# Fallback for species without custom sprites
_DEFAULT_SPRITE = [
    ["  ___  ", "  ___  ", "  ___  "],
    [" ({E}) ", " ({E}) ", " ({E}) "],
    [" |   | ", " |   | ", " |   | "],
    [" |   | ", "  | |  ", " |   | "],
    [" |___|", "  |_| ", " |___|"],
]

ADORNMENT_THRESHOLDS = {
    "battle_scars": {"frustration_count": 50},
    "reading_glasses": {"trait": "analytical", "min_value": 0.80},
    "star_mark": {"max_trait_shift": 0.30},
    "heart": {"traits": ["sociability", "empathy"], "min_value": 0.75},
    "lightning": {"trait": "assertiveness", "min_value": 0.80, "challenge_count": 20},
}


def get_expression(
    action: str,
    dominant_emotion: Optional[Emotion],
    council_activations: dict[str, float],
    session_momentum: float,
) -> str:
    """Select eye expression based on cognitive state."""
    if dominant_emotion == Emotion.JOY:
        return "happy"
    if dominant_emotion == Emotion.SURPRISE:
        return "surprised"
    if dominant_emotion == Emotion.CURIOSITY:
        return "excited"
    if dominant_emotion in (Emotion.FRUSTRATION, Emotion.IRRITATION):
        return "focused"
    if action == "challenge" and council_activations.get("prudence", 0) > 0.3:
        return "skeptical"
    if session_momentum < 0.2:
        return "tired"
    if action == "study":
        return "focused"
    return "neutral"


def get_sprite_frame(
    species: str,
    expression: str = "neutral",
    frame_index: int = 0,
) -> list[str]:
    """Get a single animation frame for a species with the given expression."""
    template = _SPRITE_TEMPLATES.get(species, _DEFAULT_SPRITE)
    frame_idx = frame_index % len(template[0])
    eyes = EXPRESSIONS.get(expression, EXPRESSIONS["neutral"])
    lines = []
    for row in template:
        line = row[frame_idx].replace("{E}", eyes)
        lines.append(line)
    return lines


def get_idle_animation(species: str, curiosity_trait: float, tick: int) -> str:
    """Determine idle animation state based on time and traits."""
    # Blink every 8-15 seconds (curiosity affects frequency)
    blink_interval = 15 - int(curiosity_trait * 7)  # 8-15
    if tick % blink_interval == 0:
        return "blink"
    # Side glance every 20-40 seconds
    glance_interval = 40 - int(curiosity_trait * 20)  # 20-40
    if tick % glance_interval == 0:
        return "side_glance"
    return "idle"


def check_adornments(
    traits: np.ndarray,
    traits_at_creation: np.ndarray,
    frustration_count: int = 0,
    challenge_count: int = 0,
) -> list[str]:
    """Check which adornments have been earned based on cognitive milestones."""
    earned = []

    if frustration_count >= 50:
        earned.append("battle_scars")

    if traits[_ts.trait_index("analytical")] > 0.80:
        earned.append("reading_glasses")

    max_shift = float(np.max(np.abs(traits - traits_at_creation)))
    if max_shift > 0.30:
        earned.append("star_mark")

    if (traits[_ts.trait_index("sociability")] > 0.75 and
            traits[_ts.trait_index("empathy")] > 0.75):
        earned.append("heart")

    if traits[_ts.trait_index("assertiveness")] > 0.80 and challenge_count >= 20:
        earned.append("lightning")

    return earned
