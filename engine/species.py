"""Species archetypes: 18 species with trait biases that create starting personality."""
from __future__ import annotations
import numpy as np
from engine.identity import Bones
from engine.traits import TraitSystem, TRAIT_COUNT

_ts = TraitSystem()

# "determination" → "persistence" (no determination trait in system)
# "diligence" → "conscientiousness" (no diligence trait in system)
SPECIES_ARCHETYPES: dict[str, dict[str, list[str]]] = {
    "duck":     {"high": ["sociability", "optimism", "adaptability", "extraversion"],    "low": ["persistence", "independence"]},
    "goose":    {"high": ["assertiveness", "loyalty", "persistence", "dominance"],        "low": ["agreeableness", "flexibility"]},
    "cat":      {"high": ["independence", "patience", "self_control", "sensitivity"],     "low": ["agreeableness", "sociability"]},
    "rabbit":   {"high": ["sensitivity", "adaptability", "conscientiousness", "neuroticism"], "low": ["emotional_stability", "risk_taking"]},
    "owl":      {"high": ["analytical", "patience", "conscientiousness", "depth_drive"],  "low": ["playfulness", "extraversion"]},
    "penguin":  {"high": ["persistence", "loyalty", "sociability", "discipline"],         "low": ["independence", "adventurousness"]},
    "turtle":   {"high": ["persistence", "caution", "conscientiousness", "patience"],     "low": ["risk_taking", "playfulness"]},
    "snail":    {"high": ["patience", "conscientiousness", "self_control", "humility"],   "low": ["assertiveness", "dominance"]},
    "dragon":   {"high": ["assertiveness", "confidence", "curiosity", "ambition"],        "low": ["caution", "agreeableness"]},
    "octopus":  {"high": ["creativity", "adaptability", "curiosity", "resourcefulness"],  "low": ["discipline", "persistence"]},
    "axolotl":  {"high": ["resilience", "optimism", "adaptability", "emotional_stability"], "low": ["competitiveness", "dominance"]},
    "ghost":    {"high": ["independence", "creativity", "depth_drive", "introversion"],   "low": ["sociability", "extraversion"]},
    "robot":    {"high": ["conscientiousness", "discipline", "self_control", "analytical"], "low": ["expressiveness", "playfulness"]},
    "blob":     {"high": ["adaptability", "agreeableness", "resilience", "emotional_stability"], "low": ["assertiveness", "ambition"]},
    "cactus":   {"high": ["independence", "persistence", "resourcefulness", "stoicism"],  "low": ["sociability", "sensitivity"]},
    "mushroom": {"high": ["depth_drive", "patience", "cooperativeness", "empathy"],       "low": ["assertiveness", "dominance"]},
    "chonk":    {"high": ["emotional_stability", "discipline", "patience", "warmth"],     "low": ["ambition", "risk_taking"]},
    "capybara": {"high": ["sociability", "emotional_stability", "empathy", "agreeableness"], "low": ["neuroticism", "competitiveness"]},
}

def create_buddy_traits(bones: Bones) -> np.ndarray:
    archetype = SPECIES_ARCHETYPES[bones.species]
    traits = np.array(bones.trait_seeds, dtype=np.float64)
    high_indices = {_ts.trait_index(name) for name in archetype.get("high", [])}
    low_indices = {_ts.trait_index(name) for name in archetype.get("low", [])}
    for i in range(TRAIT_COUNT):
        if i in high_indices:
            traits[i] = 0.65 + bones.trait_seeds[i] * 0.10
        elif i in low_indices:
            traits[i] = 0.25 + bones.trait_seeds[i] * 0.10
        else:
            traits[i] = 0.30 + bones.trait_seeds[i] * 0.40
    return traits
