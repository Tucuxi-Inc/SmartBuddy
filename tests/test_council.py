import numpy as np
from engine.traits import TraitSystem
from engine.rnn import DirectorRNN
from engine.council import (
    CognitiveCouncil,
    DirectorRole,
    Director,
    DirectorPool,
    SUB_AGENT_NAMES,
    DEFAULT_COUNCIL_WEIGHTS,
)


def test_sub_agent_names():
    expected = ["cortex", "seer", "oracle", "house", "prudence",
                "hypothalamus", "amygdala", "conscience"]
    assert SUB_AGENT_NAMES == expected


def test_council_activations_shape():
    ts = TraitSystem()
    council = CognitiveCouncil(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    activations = council.get_activations(traits)
    assert len(activations) == 8
    assert all(name in activations for name in SUB_AGENT_NAMES)


def test_council_dominant_voice():
    ts = TraitSystem()
    council = CognitiveCouncil(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    dominant = council.get_dominant_voice(traits)
    assert dominant in SUB_AGENT_NAMES


def test_council_modulation_shape():
    ts = TraitSystem()
    council = CognitiveCouncil(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    mod = council.compute_council_modulation(traits)
    assert mod.shape == (50,)
    assert np.all(mod >= 0.5)
    assert np.all(mod <= 1.5)


def test_council_disabled():
    ts = TraitSystem()
    council = CognitiveCouncil(ts, enabled=False)
    traits = ts.random_traits(np.random.default_rng(42))
    assert council.get_dominant_voice(traits) is None
    assert council.compute_council_modulation(traits) is None


def test_director_roles():
    assert DirectorRole.ANALYST.value == "analyst"
    assert DirectorRole.INTEGRATOR.value == "integrator"


def test_director_pool_creation():
    pool = DirectorPool(director_count=5)
    assert len(pool.directors) == 5


def test_director_pool_process():
    pool = DirectorPool(director_count=5)
    perception = np.random.default_rng(42).random(14)
    results = pool.process(perception)
    assert len(results) == 5
    for key, bias in results.items():
        assert bias.shape == (6,)


def test_director_pool_learn():
    pool = DirectorPool(director_count=5)
    perception = np.random.default_rng(42).random(14)
    results = pool.process(perception)
    key = list(results.keys())[0]
    pool.learn(key, perception, results[key], outcome=1.0)


def test_director_pool_serialization():
    pool = DirectorPool(director_count=5)
    perception = np.random.default_rng(42).random(14)
    pool.process(perception)
    state = pool.get_state()
    pool2 = DirectorPool.from_state(state)
    assert len(pool2.directors) == 5
