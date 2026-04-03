"""BuddyBrain: the main orchestrator tying all cognitive systems together."""
from __future__ import annotations

import json
import os
from typing import Any, Optional

import numpy as np

from engine.actions import BuddyAction, SILENT_ACTIONS, SPEECH_ACTIONS, action_to_behavior
from engine.council import CognitiveCouncil, DirectorPool
from engine.decision import DecisionModel, BUDDY_ACTIONS
from engine.emotional_state import Emotion, EmotionalState, EmotionalSystem
from engine.identity import roll_bones
from engine.perception import PerceptionMapper
from engine.personality_evolution import (
    EvolutionTrigger,
    PersonalityEvolutionEngine,
    PersonalityShift,
)
from engine.species import create_buddy_traits
from engine.speech import select_speech
from engine.sprites import check_adornments, get_expression, get_sprite_frame
from engine.traits import TraitSystem


# Mapping from perception patterns to evolution triggers
_TRIGGER_THRESHOLDS = {
    EvolutionTrigger.SUSTAINED_DEBUGGING: {"pressure_level_min": 0.5, "min_ticks": 10},
    EvolutionTrigger.CREATIVE_EXPLORATION: {"novelty_min": 0.6, "min_ticks": 5},
    EvolutionTrigger.METHODICAL_TESTING: {"iteration_pattern_min": 0.5, "min_ticks": 8},
    EvolutionTrigger.COLLABORATIVE_SESSION: {"collaboration_density_min": 0.3, "min_ticks": 5},
    EvolutionTrigger.LONG_GRIND: {"session_depth_min": 0.7, "min_ticks": 20},
    EvolutionTrigger.BREAKTHROUGH: {"momentum_jump": 0.5},
    EvolutionTrigger.CAUTIOUS_RECOVERY: {"friction_then_success": True},
}


class BuddyBrain:
    """Main cognitive engine orchestrator for a single buddy."""

    def __init__(self) -> None:
        self._ts = TraitSystem()
        self._council = CognitiveCouncil(self._ts)
        self._decision_model = DecisionModel(self._ts)
        self._emotional_system = EmotionalSystem(self._ts)
        self._evolution_engine = PersonalityEvolutionEngine(self._ts)
        self._perception = PerceptionMapper()

        # State (populated by hatch or load)
        self._species: str = ""
        self._traits: Optional[np.ndarray] = None
        self._traits_at_creation: Optional[np.ndarray] = None
        self._director_pool: Optional[DirectorPool] = None
        self._emotional_states: list[EmotionalState] = []
        self._personality_shifts: list[PersonalityShift] = []
        self._evolution_history: list[dict] = []
        self._tick_count: int = 0
        self._rng = np.random.default_rng()

        # Session tracking for evolution triggers
        self._session_friction_count: int = 0
        self._session_test_fails: int = 0
        self._session_test_passes: int = 0
        self._frustration_count: int = 0
        self._challenge_count: int = 0
        self._prev_momentum: float = 0.0

    def hatch(self, user_id: str) -> dict:
        """Initialize a new buddy from userId. Deterministic species + traits."""
        bones = roll_bones(user_id)
        self._species = bones.species
        self._traits = create_buddy_traits(bones)
        self._traits_at_creation = self._traits.copy()
        self._director_pool = DirectorPool(director_count=5)
        self._emotional_states = []
        self._personality_shifts = []
        self._evolution_history = []
        self._tick_count = 0
        self._perception.reset()

        return {
            "species": self._species,
            "traits_summary": self._ts.get_dominant_traits(self._traits, top_n=5),
        }

    def tick(self, tool_event: dict) -> dict:
        """Process one cognitive tick from a tool event.

        Args:
            tool_event: {"tool_name": str, "tool_input": dict, "success": bool}

        Returns:
            {"action": str, "expression": str, "speech": str|None,
             "sprite_frame": list[str]}
        """
        assert self._traits is not None, "Must hatch before ticking"

        self._tick_count += 1

        # 1. Update perception from tool event
        self._perception.update_from_tool_event(
            tool_name=tool_event.get("tool_name", ""),
            tool_input=tool_event.get("tool_input", {}),
            success=tool_event.get("success", True),
        )

        # Track test outcomes for evolution triggers
        cmd = tool_event.get("tool_input", {}).get("command", "").lower()
        if any(t in cmd for t in ("pytest", "npm test", "cargo test", "jest")):
            if tool_event.get("success"):
                self._session_test_passes += 1
            else:
                self._session_test_fails += 1

        if not tool_event.get("success"):
            self._session_friction_count += 1

        # 2. Trigger emotions from events
        self._trigger_emotions(tool_event)

        # 3. Decay emotions
        self._emotional_states = EmotionalSystem.decay_emotions(
            self._emotional_states, self._tick_count
        )

        # 4. Apply personality evolution (pending shifts)
        self._traits = self._evolution_engine.apply_shifts(
            self._traits, self._personality_shifts, self._tick_count
        )

        # 5. Check evolution triggers
        self._check_evolution_triggers()

        # 6. Compute perception vector
        perception_vec = self._perception.get_vector()

        # 7. Run director pool
        director_results = self._director_pool.process(perception_vec)
        mean_bias = np.mean(list(director_results.values()), axis=0)

        # 8. Compute council modulation
        council_activations = self._council.get_activations(self._traits)
        council_mod = self._council.compute_council_modulation(self._traits)

        # 9. Apply emotional modifiers to traits
        emotion_mods = self._emotional_system.compute_trait_modifiers(
            self._emotional_states, self._tick_count
        )
        effective_traits = np.clip(self._traits + emotion_mods, 0.0, 1.0)

        # 10. Decide action
        result = self._decision_model.decide(
            traits=effective_traits,
            situation={"tick": self._tick_count / 100.0},
            actions=BUDDY_ACTIONS,
            council_modulation=council_mod,
            director_biases=mean_bias,
            rng=self._rng,
        )

        action_name = result.chosen_action
        if action_name == "challenge":
            self._challenge_count += 1

        # 11. REINFORCE learning
        reward = self._compute_reward(tool_event)
        for key, bias in director_results.items():
            self._director_pool.learn(key, perception_vec, bias, reward)

        # 12. Determine expression
        dominant_emotion = self._get_dominant_emotion()
        expression = get_expression(
            action=action_name,
            dominant_emotion=dominant_emotion,
            council_activations=council_activations,
            session_momentum=perception_vec[3],
        )

        # 13. Select speech
        speech = None
        if BuddyAction(action_name) in SPEECH_ACTIONS:
            speech = select_speech(
                action=action_name,
                traits=effective_traits,
                dominant_emotion=dominant_emotion,
                rng=self._rng,
            )

        # 14. Get sprite frame
        sprite = get_sprite_frame(self._species, expression, self._tick_count)

        self._prev_momentum = perception_vec[3]

        return {
            "action": action_name,
            "expression": expression,
            "speech": speech,
            "sprite_frame": sprite,
            "council_dominant": self._council.get_dominant_voice(self._traits),
        }

    def get_state(self) -> dict:
        """Return current buddy state summary."""
        assert self._traits is not None
        dominant_emotion = self._get_dominant_emotion()
        adornments = check_adornments(
            self._traits, self._traits_at_creation,
            self._frustration_count, self._challenge_count,
        )
        expression = get_expression(
            "observe", dominant_emotion,
            self._council.get_activations(self._traits), 0.5,
        )
        return {
            "species": self._species,
            "dominant_traits": self._ts.get_dominant_traits(self._traits, top_n=5),
            "mood": dominant_emotion.value if dominant_emotion else "neutral",
            "expression": expression,
            "adornments": adornments,
            "tick_count": self._tick_count,
        }

    def get_card(self) -> dict:
        """Return full stat card for display."""
        assert self._traits is not None
        return {
            "species": self._species,
            "tick_count": self._tick_count,
            "traits": {name: float(self._traits[self._ts.trait_index(name)])
                       for name, _ in self._ts.get_dominant_traits(self._traits, top_n=10)},
            "trait_shifts": {name: float(self._traits[self._ts.trait_index(name)] -
                                        self._traits_at_creation[self._ts.trait_index(name)])
                            for name, _ in self._ts.get_dominant_traits(self._traits, top_n=10)},
            "emotions": [{"emotion": s.emotion.value, "intensity": s.current_intensity(self._tick_count)}
                         for s in self._emotional_states if s.is_active(self._tick_count)],
            "evolution_history": self._evolution_history[-10:],
            "adornments": check_adornments(
                self._traits, self._traits_at_creation,
                self._frustration_count, self._challenge_count,
            ),
            "council_activations": self._council.get_activations(self._traits),
        }

    def get_context(self) -> str:
        """Return additionalContext string for Claude prompt injection."""
        assert self._traits is not None
        dominant = self._ts.get_dominant_traits(self._traits, top_n=3)
        mood = self._get_dominant_emotion()
        mood_str = mood.value if mood else "neutral"
        trait_str = ", ".join(f"{name}({val:.1f})" for name, val in dominant)
        return (
            f"Your coding companion is a {self._species}. "
            f"Current mood: {mood_str}. Key traits: {trait_str}. "
            f"The companion is a separate entity with its own personality — "
            f"if the user addresses them, respond in character."
        )

    def reset_mind(self) -> dict:
        """Factory reset: keep species, wipe learned state."""
        self._traits = self._traits_at_creation.copy()
        self._director_pool = DirectorPool(director_count=5)
        self._emotional_states = []
        self._personality_shifts = []
        self._evolution_history = []
        self._tick_count = 0
        self._frustration_count = 0
        self._challenge_count = 0
        self._perception.reset()
        return {"species": self._species, "status": "reset"}

    def save_mind(self, path: str) -> None:
        """Persist full cognitive state to JSON."""
        state = {
            "species": self._species,
            "traits": self._traits.tolist(),
            "traits_at_creation": self._traits_at_creation.tolist(),
            "director_pool": self._director_pool.get_state(),
            "emotional_states": [
                {"emotion": s.emotion.value, "intensity": s.intensity,
                 "valence": s.valence, "tick_created": s.tick_created,
                 "decay_ticks": s.decay_ticks}
                for s in self._emotional_states
            ],
            "personality_shifts": [
                {"trait_index": s.trait_index, "magnitude": s.magnitude,
                 "trigger": s.trigger.value, "tick_created": s.tick_created,
                 "decay_ticks": s.decay_ticks}
                for s in self._personality_shifts
            ],
            "evolution_history": self._evolution_history,
            "tick_count": self._tick_count,
            "frustration_count": self._frustration_count,
            "challenge_count": self._challenge_count,
        }
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as f:
            json.dump(state, f, indent=2)

    def load_mind(self, path: str, user_id: str) -> None:
        """Load cognitive state from JSON. Falls back to fresh hatch if missing."""
        if not os.path.exists(path):
            self.hatch(user_id)
            return

        with open(path) as f:
            state = json.load(f)

        self._species = state["species"]
        self._traits = np.array(state["traits"], dtype=np.float64)
        self._traits_at_creation = np.array(state["traits_at_creation"], dtype=np.float64)
        self._director_pool = DirectorPool.from_state(state["director_pool"])
        self._emotional_states = [
            EmotionalState(
                emotion=Emotion(s["emotion"]),
                intensity=s["intensity"],
                valence=s["valence"],
                tick_created=s["tick_created"],
                decay_ticks=s["decay_ticks"],
            )
            for s in state.get("emotional_states", [])
        ]
        self._personality_shifts = [
            PersonalityShift(
                trait_index=s["trait_index"],
                magnitude=s["magnitude"],
                trigger=EvolutionTrigger(s["trigger"]),
                tick_created=s["tick_created"],
                decay_ticks=s["decay_ticks"],
            )
            for s in state.get("personality_shifts", [])
        ]
        self._evolution_history = state.get("evolution_history", [])
        self._tick_count = state.get("tick_count", 0)
        self._frustration_count = state.get("frustration_count", 0)
        self._challenge_count = state.get("challenge_count", 0)
        self._perception.reset()

    # --- Private helpers ---

    def _trigger_emotions(self, tool_event: dict) -> None:
        """Generate emotions from coding events."""
        success = tool_event.get("success", True)
        cmd = tool_event.get("tool_input", {}).get("command", "").lower()
        is_test = any(t in cmd for t in ("pytest", "npm test", "cargo test", "jest"))

        if is_test and success:
            self._emotional_states.append(
                self._emotional_system.add_emotion(
                    Emotion.JOY, intensity=0.6, valence=0.8, tick=self._tick_count
                )
            )
        elif is_test and not success:
            self._emotional_states.append(
                self._emotional_system.add_emotion(
                    Emotion.FRUSTRATION, intensity=0.5, valence=-0.6, tick=self._tick_count
                )
            )
            self._frustration_count += 1
        elif not success:
            self._emotional_states.append(
                self._emotional_system.add_emotion(
                    Emotion.WARINESS, intensity=0.3, valence=-0.3, tick=self._tick_count
                )
            )

        # Novelty triggers curiosity
        vec = self._perception.get_vector()
        if vec[5] > 0.6:  # high novelty
            self._emotional_states.append(
                self._emotional_system.add_emotion(
                    Emotion.CURIOSITY, intensity=0.5, valence=0.4, tick=self._tick_count
                )
            )

        # Limit active emotions
        if len(self._emotional_states) > 20:
            self._emotional_states = self._emotional_states[-20:]

    def _check_evolution_triggers(self) -> None:
        """Check if any evolution triggers fire based on session patterns."""
        vec = self._perception.get_vector()

        # Sustained debugging: high pressure over many ticks
        if (vec[1] > 0.5 and self._session_test_fails > 10
                and self._tick_count > 10):
            shifts = self._evolution_engine.create_shift(
                EvolutionTrigger.SUSTAINED_DEBUGGING, tick=self._tick_count
            )
            self._personality_shifts.extend(shifts)
            self._evolution_history.append({
                "trigger": "sustained_debugging", "tick": self._tick_count
            })

        # Creative exploration: high novelty
        if vec[5] > 0.6 and self._tick_count > 5:
            shifts = self._evolution_engine.create_shift(
                EvolutionTrigger.CREATIVE_EXPLORATION, tick=self._tick_count,
                base_magnitude=0.02,
            )
            self._personality_shifts.extend(shifts)

        # Breakthrough: sudden momentum jump
        if vec[3] - self._prev_momentum > 0.5:
            shifts = self._evolution_engine.create_shift(
                EvolutionTrigger.BREAKTHROUGH, tick=self._tick_count
            )
            self._personality_shifts.extend(shifts)
            self._evolution_history.append({
                "trigger": "breakthrough", "tick": self._tick_count
            })

        # Methodical testing: balanced edit/test ratio
        if vec[10] > 0.5 and self._tick_count > 8:
            shifts = self._evolution_engine.create_shift(
                EvolutionTrigger.METHODICAL_TESTING, tick=self._tick_count,
                base_magnitude=0.02,
            )
            self._personality_shifts.extend(shifts)

    def _compute_reward(self, tool_event: dict) -> float:
        """Compute REINFORCE reward signal from session state."""
        if tool_event.get("success"):
            return 0.5
        return -0.3

    def _get_dominant_emotion(self) -> Optional[Emotion]:
        """Return the strongest active emotion, or None."""
        active = [s for s in self._emotional_states if s.is_active(self._tick_count)]
        if not active:
            return None
        strongest = max(active, key=lambda s: s.current_intensity(self._tick_count))
        if strongest.current_intensity(self._tick_count) < 0.1:
            return None
        return strongest.emotion
