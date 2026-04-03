import numpy as np
from engine.traits import TraitSystem
from engine.emotional_state import Emotion, EmotionalState, EmotionalSystem, EMOTION_TRAIT_MODIFIERS

def test_emotion_enum():
    assert Emotion.JOY.value == "joy"
    assert Emotion.FRUSTRATION.value == "frustration"
    assert len(Emotion) == 12

def test_emotional_state_decay():
    state = EmotionalState(emotion=Emotion.JOY, intensity=1.0, valence=1.0, tick_created=0, decay_ticks=100)
    assert state.current_intensity(0) == 1.0
    assert abs(state.current_intensity(50) - 0.5) < 0.01
    assert state.current_intensity(100) == 0.0
    assert state.current_intensity(150) == 0.0

def test_emotional_state_is_active():
    state = EmotionalState(emotion=Emotion.JOY, intensity=1.0, valence=1.0, tick_created=0, decay_ticks=50)
    assert state.is_active(0)
    assert state.is_active(49)
    assert not state.is_active(50)

def test_add_emotion():
    ts = TraitSystem()
    system = EmotionalSystem(ts)
    state = system.add_emotion(Emotion.CURIOSITY, intensity=0.8, valence=0.5, tick=10)
    assert state.emotion == Emotion.CURIOSITY
    assert state.intensity == 0.8

def test_compute_trait_modifiers():
    ts = TraitSystem()
    system = EmotionalSystem(ts)
    states = [system.add_emotion(Emotion.JOY, intensity=1.0, valence=1.0, tick=0)]
    mods = system.compute_trait_modifiers(states, current_tick=0)
    assert mods.shape == (50,)
    assert mods[ts.trait_index("extraversion")] > 0.0

def test_decay_emotions_filters():
    ts = TraitSystem()
    system = EmotionalSystem(ts)
    states = [
        system.add_emotion(Emotion.JOY, intensity=1.0, valence=1.0, tick=0, decay_ticks=10),
        system.add_emotion(Emotion.FRUSTRATION, intensity=0.5, valence=-0.5, tick=0, decay_ticks=100),
    ]
    filtered = EmotionalSystem.decay_emotions(states, current_tick=20)
    assert len(filtered) == 1
    assert filtered[0].emotion == Emotion.FRUSTRATION

def test_all_emotions_have_modifiers():
    for emotion in Emotion:
        assert emotion in EMOTION_TRAIT_MODIFIERS, f"Missing modifier for {emotion}"
