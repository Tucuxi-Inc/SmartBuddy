"""Template-based speech bubbles, filtered by traits and emotions."""
from __future__ import annotations

from typing import Optional

import numpy as np

from engine.emotional_state import Emotion
from engine.traits import TraitSystem

_ts = TraitSystem()


# Templates: list of (trait_filter, text)
# trait_filter: dict of trait_name -> (comparison, threshold)
# Empty filter = always eligible
_TEMPLATES: dict[str, list[tuple[dict, str]]] = {
    "encourage": [
        ({}, "Nice work."),
        ({"extraversion": (">", 0.6)}, "That's looking great!"),
        ({"extraversion": (">", 0.6), "optimism": (">", 0.6)}, "Yes! Nailed it!"),
        ({"patience": (">", 0.7)}, "Solid progress. Keep going."),
        ({"self_control": (">", 0.7)}, "Clean execution."),
        ({"humor": (">", 0.6)}, "Tests pass? Must be a holiday."),
        ({"warmth": (">", 0.6)}, "I'm proud of us."),
        ({"discipline": (">", 0.7)}, "Tests pass. Good."),
        ({"confidence": (">", 0.7)}, "Knew you had it."),
        ({"curiosity": (">", 0.6)}, "Interesting approach. It works!"),
    ],
    "challenge": [
        ({}, "You sure about that?"),
        ({"caution": (">", 0.7)}, "Hmm... might want to think twice."),
        ({"assertiveness": (">", 0.7)}, "Bold move. Let's see if it holds."),
        ({"patience": (">", 0.7)}, "Take a breath first?"),
        ({"humor": (">", 0.6)}, "I mean, what could go wrong?"),
        ({"conscientiousness": (">", 0.7)}, "Did you check the tests first?"),
        ({"independence": (">", 0.6)}, "Your call. I'd reconsider."),
        ({"analytical": (">", 0.6)}, "The data suggests otherwise."),
        ({"empathy": (">", 0.6)}, "Future you might not appreciate this."),
    ],
    "curious_comment": [
        ({}, "Huh, that's new."),
        ({"curiosity": (">", 0.7)}, "Ooh, what's this? Never seen this before."),
        ({"openness": (">", 0.6)}, "Interesting territory."),
        ({"caution": (">", 0.6)}, "New file... let's see what we're dealing with."),
        ({"depth_drive": (">", 0.6)}, "There's something deeper here."),
        ({"humor": (">", 0.6)}, "Uncharted waters. Exciting and terrifying."),
        ({"adaptability": (">", 0.6)}, "New context. Adjusting."),
        ({"analytical": (">", 0.6)}, "First time in this module. Analyzing."),
    ],
    "engage": [
        ({}, "What are we working on?"),
        ({"sociability": (">", 0.7)}, "Good to be coding together!"),
        ({"extraversion": (">", 0.6)}, "Let's do this!"),
        ({"patience": (">", 0.7)}, "I'm here whenever you need me."),
        ({"independence": (">", 0.6)}, "Watching. Just say the word."),
        ({"warmth": (">", 0.6)}, "How's it going?"),
    ],
    "suggest": [
        ({}, "Just a thought..."),
        ({"confidence": (">", 0.7)}, "You should try this."),
        ({"humility": (">", 0.6)}, "Not sure if this helps, but..."),
        ({"analytical": (">", 0.6)}, "Pattern detected. Consider this."),
        ({"creativity": (">", 0.6)}, "What if you approached it differently?"),
        ({"patience": (">", 0.7)}, "When you have a moment — I noticed something."),
    ],
    "teach": [
        ({}, "I remember something about this."),
        ({"depth_drive": (">", 0.6)}, "Last time, this pattern worked well."),
        ({"patience": (">", 0.7)}, "Let me share what I've learned here."),
        ({"confidence": (">", 0.7)}, "Trust me on this one — I've seen it before."),
        ({"warmth": (">", 0.6)}, "Here, this might help."),
    ],
    "gift": [
        ({}, "Made you something."),
        ({"generosity": (">", 0.6)}, "Here — thought you could use this."),
        ({"creativity": (">", 0.6)}, "I put something together for you."),
        ({"warmth": (">", 0.6)}, "A little something for the road."),
    ],
}

# Emotion-specific overrides (take priority when active)
_EMOTION_SPEECH: dict[str, dict[Emotion, list[str]]] = {
    "encourage": {
        Emotion.JOY: ["Yes!", "That's the stuff!", "Beautiful."],
        Emotion.EXCITEMENT: ["This is going great!", "We're on fire!"],
        Emotion.SATISFACTION: ["That felt good.", "Well earned."],
    },
    "challenge": {
        Emotion.ANXIETY: ["Wait wait wait...", "Are we sure about this?"],
        Emotion.WARINESS: ["Something feels off here.", "Proceed with caution."],
    },
    "curious_comment": {
        Emotion.CURIOSITY: ["What's THIS?", "Now I'm intrigued.", "Tell me more."],
        Emotion.SURPRISE: ["Whoa. Didn't expect that.", "That's... unexpected."],
    },
}


def select_speech(
    action: str,
    traits: np.ndarray,
    dominant_emotion: Optional[Emotion] = None,
    rng: Optional[np.random.Generator] = None,
) -> Optional[str]:
    """Select a speech bubble text based on action, traits, and emotion.

    Returns None for actions that don't produce speech.
    """
    if rng is None:
        rng = np.random.default_rng()

    # Check emotion override first
    if dominant_emotion and action in _EMOTION_SPEECH:
        emotion_options = _EMOTION_SPEECH[action].get(dominant_emotion)
        if emotion_options:
            return emotion_options[rng.integers(len(emotion_options))]

    # Fall back to trait-filtered templates
    templates = _TEMPLATES.get(action)
    if not templates:
        return None

    # Filter by trait thresholds
    eligible = []
    for trait_filter, text in templates:
        matches = True
        specificity = len(trait_filter)
        for trait_name, (op, threshold) in trait_filter.items():
            idx = _ts.trait_index(trait_name)
            val = traits[idx]
            if op == ">" and val <= threshold:
                matches = False
                break
            elif op == "<" and val >= threshold:
                matches = False
                break
        if matches:
            eligible.append((specificity, text))

    if not eligible:
        return None

    # Prefer more specific matches (more trait filters = higher priority)
    eligible.sort(key=lambda x: x[0], reverse=True)
    # Pick from top 3 most specific
    top = eligible[:3]
    idx = rng.integers(len(top))
    return top[idx][1]
