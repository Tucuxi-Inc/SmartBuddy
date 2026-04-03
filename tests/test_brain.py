import json
import os
import tempfile
import numpy as np
from engine.brain import BuddyBrain


def test_hatch_creates_state():
    brain = BuddyBrain()
    result = brain.hatch("test_user_123")
    assert "species" in result
    assert "traits_summary" in result
    assert result["species"] in [
        "duck", "goose", "cat", "rabbit", "owl", "penguin",
        "turtle", "snail", "dragon", "octopus", "axolotl", "ghost",
        "robot", "blob", "cactus", "mushroom", "chonk", "capybara",
    ]


def test_hatch_deterministic():
    brain1 = BuddyBrain()
    brain2 = BuddyBrain()
    r1 = brain1.hatch("same_user")
    r2 = brain2.hatch("same_user")
    assert r1["species"] == r2["species"]


def test_tick_returns_action():
    brain = BuddyBrain()
    brain.hatch("test_user")
    result = brain.tick({
        "tool_name": "Bash",
        "tool_input": {"command": "pytest -v"},
        "success": True,
    })
    assert "action" in result
    assert "expression" in result
    assert "speech" in result or result.get("speech") is None


def test_get_state():
    brain = BuddyBrain()
    brain.hatch("test_user")
    state = brain.get_state()
    assert "species" in state
    assert "dominant_traits" in state
    assert "expression" in state
    assert "adornments" in state


def test_get_card():
    brain = BuddyBrain()
    brain.hatch("test_user")
    card = brain.get_card()
    assert "species" in card
    assert "traits" in card
    assert "emotions" in card
    assert "evolution_history" in card


def test_reset_mind():
    brain = BuddyBrain()
    brain.hatch("test_user")
    # Do some ticks to evolve
    for _ in range(5):
        brain.tick({"tool_name": "Bash", "tool_input": {"command": "ls"}, "success": True})
    # Reset
    result = brain.reset_mind()
    assert result["species"] == brain._species
    # Traits should be back to creation values
    np.testing.assert_array_almost_equal(
        brain._traits, brain._traits_at_creation
    )


def test_save_and_load():
    with tempfile.TemporaryDirectory() as tmpdir:
        brain1 = BuddyBrain()
        brain1.hatch("test_user")
        for _ in range(3):
            brain1.tick({"tool_name": "Edit", "tool_input": {"file_path": "a.py"}, "success": True})

        mind_path = os.path.join(tmpdir, "mind.json")
        brain1.save_mind(mind_path)

        brain2 = BuddyBrain()
        brain2.load_mind(mind_path, "test_user")
        assert brain2._species == brain1._species
        np.testing.assert_array_almost_equal(brain2._traits, brain1._traits)
        assert brain2._tick_count == brain1._tick_count


def test_multiple_ticks_evolve_traits():
    brain = BuddyBrain()
    brain.hatch("test_user")
    original_traits = brain._traits.copy()

    # Simulate sustained debugging (many test failures then passes)
    for _ in range(15):
        brain.tick({"tool_name": "Bash", "tool_input": {"command": "pytest"}, "success": False})
    for _ in range(15):
        brain.tick({"tool_name": "Bash", "tool_input": {"command": "pytest"}, "success": True})

    # Traits should have shifted
    assert not np.allclose(brain._traits, original_traits, atol=0.001)
