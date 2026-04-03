"""Map cognitive decisions to observable buddy behaviors."""
from __future__ import annotations

from enum import Enum


class BuddyAction(Enum):
    """Enum for behavior mapping. String values match BUDDY_ACTIONS in decision.py.

    decision.py uses BUDDY_ACTIONS (list[str]) for the decision model.
    actions.py uses BuddyAction (Enum) for behavior classification.
    brain.py bridges them: decision model returns a string, BuddyAction(string) wraps it.
    """
    OBSERVE = "observe"
    CURIOUS_COMMENT = "curious_comment"
    ENGAGE = "engage"
    STUDY = "study"
    ENCOURAGE = "encourage"
    SUGGEST = "suggest"
    CHALLENGE = "challenge"
    TEACH = "teach"
    EMOTE = "emote"
    JOURNAL = "journal"
    GIFT = "gift"


SILENT_ACTIONS = {BuddyAction.OBSERVE, BuddyAction.STUDY, BuddyAction.EMOTE, BuddyAction.JOURNAL}
SPEECH_ACTIONS = {BuddyAction.CURIOUS_COMMENT, BuddyAction.ENGAGE, BuddyAction.ENCOURAGE,
                  BuddyAction.SUGGEST, BuddyAction.CHALLENGE, BuddyAction.TEACH, BuddyAction.GIFT}

_BEHAVIOR_DESCRIPTIONS = {
    BuddyAction.OBSERVE: "Watching quietly, absorbing patterns",
    BuddyAction.CURIOUS_COMMENT: "Reacting to something novel",
    BuddyAction.ENGAGE: "Actively responding to what's happening",
    BuddyAction.STUDY: "Silently learning about the codebase",
    BuddyAction.ENCOURAGE: "Cheering on good work",
    BuddyAction.SUGGEST: "Offering an observation",
    BuddyAction.CHALLENGE: "Gently questioning a choice",
    BuddyAction.TEACH: "Sharing something from past sessions",
    BuddyAction.EMOTE: "Expressing a mood",
    BuddyAction.JOURNAL: "Writing a journal entry",
    BuddyAction.GIFT: "Creating something useful",
}


def action_to_behavior(action: BuddyAction) -> dict:
    """Convert a BuddyAction to a behavior descriptor."""
    return {
        "action": action.value,
        "description": _BEHAVIOR_DESCRIPTIONS[action],
        "is_silent": action in SILENT_ACTIONS,
        "has_speech": action in SPEECH_ACTIONS,
    }
