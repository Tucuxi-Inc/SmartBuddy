import numpy as np
from engine.traits import TraitSystem
from engine.decision import DecisionModel, DecisionResult, BUDDY_ACTION_MAP, BUDDY_ACTIONS


def test_buddy_actions():
    expected = ["observe", "curious_comment", "engage", "study", "encourage",
                "suggest", "challenge", "teach", "emote", "journal", "gift"]
    assert BUDDY_ACTIONS == expected


def test_buddy_action_map_dimensions():
    for action, vec in BUDDY_ACTION_MAP.items():
        assert len(vec) == 6, f"{action} has wrong dimension"


def test_decision_returns_result():
    ts = TraitSystem()
    model = DecisionModel(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    situation = {"pressure": 0.5, "novelty": 0.3}
    result = model.decide(traits=traits, situation=situation, actions=BUDDY_ACTIONS, rng=np.random.default_rng(42))
    assert isinstance(result, DecisionResult)
    assert result.chosen_action in BUDDY_ACTIONS


def test_decision_probabilities_sum_to_one():
    ts = TraitSystem()
    model = DecisionModel(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    result = model.decide(traits=traits, situation={"pressure": 0.5}, actions=BUDDY_ACTIONS, rng=np.random.default_rng(42))
    total = sum(result.probabilities.values())
    assert abs(total - 1.0) < 0.001


def test_decision_explainability():
    ts = TraitSystem()
    model = DecisionModel(ts)
    traits = np.zeros(50)
    traits[ts.trait_index("curiosity")] = 0.95
    result = model.decide(traits=traits, situation={"novelty": 0.8}, actions=BUDDY_ACTIONS, rng=np.random.default_rng(42))
    explanation = result.explain()
    assert isinstance(explanation, dict)
    assert len(explanation) > 0


def test_council_modulation_affects_decision():
    ts = TraitSystem()
    model = DecisionModel(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    situation = {"pressure": 0.5}
    r1 = model.decide(traits=traits, situation=situation, actions=BUDDY_ACTIONS, rng=np.random.default_rng(99))
    mod = np.ones(50) * 1.5
    r2 = model.decide(traits=traits, situation=situation, actions=BUDDY_ACTIONS, council_modulation=mod, rng=np.random.default_rng(99))
    assert r1.probabilities != r2.probabilities


def test_director_biases_affect_decision():
    ts = TraitSystem()
    model = DecisionModel(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    cooperative_bias = np.array([0.0, 0.0, 0.0, 1.0, 0.0, 0.0])
    result = model.decide(traits=traits, situation={"pressure": 0.5}, actions=BUDDY_ACTIONS, director_biases=cooperative_bias, rng=np.random.default_rng(42))
    assert result.probabilities["encourage"] > 0.01


def test_temperature_zero_is_deterministic():
    ts = TraitSystem()
    model = DecisionModel(ts, temperature=0.0)
    traits = ts.random_traits(np.random.default_rng(42))
    r1 = model.decide(traits=traits, situation={"pressure": 0.5}, actions=BUDDY_ACTIONS, rng=np.random.default_rng(1))
    r2 = model.decide(traits=traits, situation={"pressure": 0.5}, actions=BUDDY_ACTIONS, rng=np.random.default_rng(2))
    assert r1.chosen_action == r2.chosen_action
