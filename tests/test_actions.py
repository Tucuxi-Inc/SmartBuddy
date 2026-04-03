# tests/test_actions.py
from engine.actions import (
    BuddyAction,
    action_to_behavior,
    SILENT_ACTIONS,
    SPEECH_ACTIONS,
)


def test_buddy_action_enum():
    assert BuddyAction.OBSERVE.value == "observe"
    assert BuddyAction.CHALLENGE.value == "challenge"
    assert len(BuddyAction) == 11


def test_action_to_behavior():
    behavior = action_to_behavior(BuddyAction.ENCOURAGE)
    assert "description" in behavior
    assert "is_silent" in behavior
    assert behavior["is_silent"] is False


def test_silent_actions():
    assert BuddyAction.OBSERVE in SILENT_ACTIONS
    assert BuddyAction.STUDY in SILENT_ACTIONS
    assert BuddyAction.ENCOURAGE not in SILENT_ACTIONS


def test_speech_actions():
    assert BuddyAction.ENCOURAGE in SPEECH_ACTIONS
    assert BuddyAction.CHALLENGE in SPEECH_ACTIONS
    assert BuddyAction.OBSERVE not in SPEECH_ACTIONS
