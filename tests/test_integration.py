"""End-to-end integration tests: perception -> brain -> action -> speech -> sprite."""
import json
import os
import tempfile
import numpy as np
from engine.brain import BuddyBrain
from engine.identity import SPECIES_LIST


def test_full_session_lifecycle():
    """Simulate a complete coding session."""
    brain = BuddyBrain()
    result = brain.hatch("integration_test_user")
    assert result["species"] in SPECIES_LIST

    actions_seen = set()
    for i in range(20):
        tool_event = {
            "tool_name": ["Bash", "Edit", "Read", "Write", "Grep"][i % 5],
            "tool_input": {
                "command": "pytest tests/" if i % 5 == 0 else "",
                "file_path": f"/project/src/module_{i % 3}.py",
            },
            "success": i % 3 != 0,
        }
        tick_result = brain.tick(tool_event)
        assert "action" in tick_result
        assert "expression" in tick_result
        assert "sprite_frame" in tick_result
        actions_seen.add(tick_result["action"])

    assert len(actions_seen) >= 2

    state = brain.get_state()
    assert state["tick_count"] == 20
    assert len(state["dominant_traits"]) == 5

    card = brain.get_card()
    assert len(card["traits"]) == 10
    assert "council_activations" in card


def test_save_load_preserves_evolution():
    """Ensure evolved state survives save/load cycle."""
    with tempfile.TemporaryDirectory() as tmpdir:
        brain1 = BuddyBrain()
        brain1.hatch("persistence_user")

        for i in range(30):
            brain1.tick({
                "tool_name": "Bash",
                "tool_input": {"command": "pytest"},
                "success": i > 15,
            })

        traits_before = brain1._traits.copy()
        mind_path = os.path.join(tmpdir, "mind.json")
        brain1.save_mind(mind_path)

        brain2 = BuddyBrain()
        brain2.load_mind(mind_path, "persistence_user")

        np.testing.assert_array_almost_equal(brain2._traits, traits_before)
        assert brain2._tick_count == 30
        assert brain2._species == brain1._species


def test_two_users_diverge():
    """Two users with same species but different activity should diverge."""
    brain_a = BuddyBrain()
    brain_b = BuddyBrain()

    brain_a.hatch("same_user")
    brain_b.hatch("same_user")
    np.testing.assert_array_equal(brain_a._traits, brain_b._traits)

    for _ in range(20):
        brain_a.tick({"tool_name": "Bash", "tool_input": {"command": "pytest"}, "success": False})

    for i in range(20):
        brain_b.tick({"tool_name": "Read", "tool_input": {"file_path": f"/new/file_{i}.py"}, "success": True})

    assert not np.allclose(brain_a._traits, brain_b._traits, atol=0.001)


def test_context_injection():
    """Ensure context string is well-formed for Claude prompt injection."""
    brain = BuddyBrain()
    brain.hatch("context_user")
    brain.tick({"tool_name": "Bash", "tool_input": {"command": "ls"}, "success": True})

    context = brain.get_context()
    assert isinstance(context, str)
    assert len(context) > 20
    assert brain._species in context
    assert "companion" in context.lower()


def test_mind_json_is_valid():
    """Ensure serialized mind is valid JSON with expected structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        brain = BuddyBrain()
        brain.hatch("json_user")
        brain.tick({"tool_name": "Edit", "tool_input": {"file_path": "x.py"}, "success": True})

        path = os.path.join(tmpdir, "mind.json")
        brain.save_mind(path)

        with open(path) as f:
            data = json.load(f)

        assert data["species"] in SPECIES_LIST
        assert len(data["traits"]) == 50
        assert len(data["traits_at_creation"]) == 50
        assert "director_pool" in data
        assert data["tick_count"] == 1
