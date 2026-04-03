import numpy as np
from engine.traits import (
    TRAIT_COUNT,
    TraitDefinition,
    TRAITS,
    TRAIT_NAME_TO_INDEX,
    TRAIT_INDEX_TO_NAME,
    TraitSystem,
    dampen_trait_update,
)


def test_trait_count_is_50():
    assert TRAIT_COUNT == 50
    assert len(TRAITS) == 50


def test_all_traits_have_unique_indices():
    indices = [t.index for t in TRAITS]
    assert len(set(indices)) == 50
    assert sorted(indices) == list(range(50))


def test_trait_name_lookup():
    ts = TraitSystem()
    assert ts.trait_index("openness") == 0
    assert ts.trait_index("curiosity") == 6


def test_trait_name_lookup_invalid():
    ts = TraitSystem()
    try:
        ts.trait_index("nonexistent_trait")
        assert False, "Should have raised KeyError"
    except KeyError:
        pass


def test_random_traits_shape_and_range():
    ts = TraitSystem()
    traits = ts.random_traits(np.random.default_rng(42))
    assert traits.shape == (50,)
    assert np.all(traits >= 0.0)
    assert np.all(traits <= 1.0)


def test_random_traits_deterministic_with_seed():
    ts = TraitSystem()
    traits_a = ts.random_traits(np.random.default_rng(42))
    traits_b = ts.random_traits(np.random.default_rng(42))
    np.testing.assert_array_equal(traits_a, traits_b)


def test_trait_distance():
    ts = TraitSystem()
    a = np.zeros(50)
    b = np.ones(50)
    d = ts.trait_distance(a, b)
    assert 0.0 < d <= 1.0
    assert ts.trait_distance(a, a) == 0.0


def test_get_dominant_traits():
    ts = TraitSystem()
    traits = np.zeros(50)
    traits[6] = 0.95  # curiosity
    traits[0] = 0.90  # openness
    top = ts.get_dominant_traits(traits, top_n=2)
    assert len(top) == 2
    assert top[0][0] == "curiosity"
    assert top[1][0] == "openness"


def test_dampen_trait_update_stays_in_bounds():
    result = dampen_trait_update(0.85, 0.1)
    assert result <= 0.90
    assert result > 0.85

    result = dampen_trait_update(0.15, -0.1)
    assert result >= 0.10
    assert result < 0.15

    result = dampen_trait_update(0.5, 0.04)
    assert abs(result - 0.54) < 0.001


def test_dampen_trait_update_hard_clamp():
    assert dampen_trait_update(0.89, 0.5) <= 0.90
    assert dampen_trait_update(0.11, -0.5) >= 0.10
