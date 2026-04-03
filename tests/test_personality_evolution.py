import numpy as np
from engine.traits import TraitSystem
from engine.personality_evolution import (
    EvolutionTrigger, PersonalityShift, PersonalityEvolutionEngine,
    TRAIT_CORRELATION_MATRIX, EVOLUTION_RULES,
)

def test_evolution_triggers():
    assert EvolutionTrigger.SUSTAINED_DEBUGGING.value == "sustained_debugging"
    assert EvolutionTrigger.CREATIVE_EXPLORATION.value == "creative_exploration"
    assert EvolutionTrigger.BREAKTHROUGH.value == "breakthrough"

def test_personality_shift_decay():
    shift = PersonalityShift(trait_index=6, magnitude=0.05, trigger=EvolutionTrigger.SUSTAINED_DEBUGGING, tick_created=0, decay_ticks=100)
    assert shift.current_magnitude(0) == 0.05
    assert abs(shift.current_magnitude(50) - 0.025) < 0.001
    assert shift.current_magnitude(100) == 0.0

def test_create_shift_produces_correlated_shifts():
    ts = TraitSystem()
    engine = PersonalityEvolutionEngine(ts)
    shifts = engine.create_shift(EvolutionTrigger.SUSTAINED_DEBUGGING, tick=0)
    assert len(shifts) > 1
    assert all(s.trigger == EvolutionTrigger.SUSTAINED_DEBUGGING for s in shifts)

def test_apply_shifts_modifies_traits():
    ts = TraitSystem()
    engine = PersonalityEvolutionEngine(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    original = traits.copy()
    shifts = engine.create_shift(EvolutionTrigger.BREAKTHROUGH, tick=0)
    updated = engine.apply_shifts(traits, shifts, current_tick=0)
    assert not np.allclose(original, updated)
    assert np.all(updated >= 0.0)
    assert np.all(updated <= 1.0)

def test_apply_shifts_respects_decay():
    ts = TraitSystem()
    engine = PersonalityEvolutionEngine(ts)
    traits = ts.random_traits(np.random.default_rng(42))
    shifts = engine.create_shift(EvolutionTrigger.SUSTAINED_DEBUGGING, tick=0, decay_ticks=10)
    updated_early = engine.apply_shifts(traits.copy(), shifts, current_tick=0)
    updated_late = engine.apply_shifts(traits.copy(), shifts, current_tick=20)
    np.testing.assert_array_almost_equal(traits, updated_late)
    assert not np.allclose(traits, updated_early)

def test_all_triggers_have_rules():
    for trigger in EvolutionTrigger:
        assert trigger in EVOLUTION_RULES, f"Missing rules for {trigger}"

def test_trait_correlation_matrix_is_symmetric_in_keys():
    keys = set(TRAIT_CORRELATION_MATRIX.keys())
    for a, b in keys:
        assert (b, a) in keys, f"Missing reverse correlation ({b}, {a})"
