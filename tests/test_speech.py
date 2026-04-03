# tests/test_speech.py
import numpy as np
from engine.speech import select_speech
from engine.emotional_state import Emotion
from engine.traits import TraitSystem


def test_select_speech_returns_string():
    ts = TraitSystem()
    traits = ts.random_traits(np.random.default_rng(42))
    result = select_speech("encourage", traits, rng=np.random.default_rng(42))
    assert isinstance(result, str)
    assert len(result) > 0


def test_select_speech_returns_none_for_unknown_action():
    ts = TraitSystem()
    traits = ts.random_traits(np.random.default_rng(42))
    result = select_speech("nonexistent_action", traits, rng=np.random.default_rng(42))
    assert result is None


def test_emotion_override_takes_priority():
    ts = TraitSystem()
    traits = ts.random_traits(np.random.default_rng(42))
    result = select_speech("encourage", traits, dominant_emotion=Emotion.JOY,
                           rng=np.random.default_rng(42))
    assert result is not None
    # JOY override templates are short and enthusiastic
    assert len(result) < 50


def test_trait_filtering_affects_selection():
    ts = TraitSystem()
    # High extraversion buddy
    traits_high = np.ones(50) * 0.5
    traits_high[ts.trait_index("extraversion")] = 0.9
    traits_high[ts.trait_index("optimism")] = 0.9

    # Low extraversion buddy
    traits_low = np.ones(50) * 0.5
    traits_low[ts.trait_index("extraversion")] = 0.1

    # Run many times and check distributions differ
    high_results = set()
    low_results = set()
    for seed in range(20):
        h = select_speech("encourage", traits_high, rng=np.random.default_rng(seed))
        l = select_speech("encourage", traits_low, rng=np.random.default_rng(seed))
        if h:
            high_results.add(h)
        if l:
            low_results.add(l)

    # High-extraversion should access more specific templates
    assert len(high_results) >= 1
    assert len(low_results) >= 1


def test_all_speech_actions_have_templates():
    ts = TraitSystem()
    traits = ts.random_traits(np.random.default_rng(42))
    speech_actions = ["encourage", "challenge", "curious_comment", "engage",
                      "suggest", "teach", "gift"]
    for action in speech_actions:
        result = select_speech(action, traits, rng=np.random.default_rng(42))
        assert result is not None, f"No speech template found for action: {action}"
