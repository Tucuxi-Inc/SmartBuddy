# tests/test_sprites.py
from engine.sprites import (
    get_expression,
    get_sprite_frame,
    get_idle_animation,
    check_adornments,
    EXPRESSIONS,
)
from engine.emotional_state import Emotion
import numpy as np


def test_expressions_defined():
    assert "neutral" in EXPRESSIONS
    assert "happy" in EXPRESSIONS
    assert "side_glance" in EXPRESSIONS
    assert len(EXPRESSIONS) >= 8


def test_get_expression_happy():
    expr = get_expression(
        action="encourage",
        dominant_emotion=Emotion.JOY,
        council_activations={},
        session_momentum=0.8,
    )
    assert expr == "happy"


def test_get_expression_default():
    expr = get_expression(
        action="observe",
        dominant_emotion=None,
        council_activations={},
        session_momentum=0.5,
    )
    assert expr == "neutral"


def test_get_sprite_frame():
    frame = get_sprite_frame("cat", expression="neutral", frame_index=0)
    assert isinstance(frame, list)
    assert len(frame) > 0
    assert all(isinstance(line, str) for line in frame)


def test_check_adornments():
    adornments = check_adornments(
        traits=np.ones(50) * 0.5,
        traits_at_creation=np.ones(50) * 0.5,
        frustration_count=60,
        challenge_count=10,
    )
    # 60 frustrations should earn battle scars
    assert "battle_scars" in adornments
