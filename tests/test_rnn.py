import numpy as np
from engine.rnn import (
    DirectorRNN,
    INPUT_DIM,
    HIDDEN_DIM,
    OUTPUT_DIM,
    TOTAL_WEIGHTS,
    LEARNING_RATE,
)


def test_constants():
    assert INPUT_DIM == 14
    assert HIDDEN_DIM == 8
    assert OUTPUT_DIM == 6
    assert TOTAL_WEIGHTS == 252


def test_random_init():
    rnn = DirectorRNN()
    assert rnn.attention_mask.shape == (14,)
    assert rnn.W_ih.shape == (8, 14)
    assert rnn.W_hh.shape == (8, 8)
    assert rnn.W_ho.shape == (6, 8)
    assert rnn.bias_h.shape == (8,)
    assert rnn.bias_o.shape == (6,)


def test_genome_init():
    genome = np.random.default_rng(42).standard_normal(252)
    rnn = DirectorRNN(genome=genome)
    assert rnn.genome.shape == (252,)
    np.testing.assert_array_almost_equal(rnn.genome, genome)


def test_forward_shape():
    rnn = DirectorRNN()
    perception = np.random.default_rng(42).random(14)
    output = rnn.forward(perception)
    assert output.shape == (6,)
    assert np.all(output >= -1.0)
    assert np.all(output <= 1.0)


def test_forward_deterministic():
    genome = np.random.default_rng(42).standard_normal(252)
    perception = np.random.default_rng(99).random(14)
    rnn_a = DirectorRNN(genome=genome.copy())
    rnn_b = DirectorRNN(genome=genome.copy())
    out_a = rnn_a.forward(perception)
    out_b = rnn_b.forward(perception)
    np.testing.assert_array_almost_equal(out_a, out_b)


def test_hidden_state_persists():
    rnn = DirectorRNN()
    p = np.random.default_rng(42).random(14)
    out1 = rnn.forward(p)
    out2 = rnn.forward(p)
    assert not np.allclose(out1, out2)


def test_learn_from_outcome_changes_weights():
    rnn = DirectorRNN()
    p = np.random.default_rng(42).random(14)
    bias = rnn.forward(p)
    genome_before = rnn.genome.copy()
    rnn.learn_from_outcome(p, bias, outcome_signal=1.0)
    assert not np.allclose(rnn.genome, genome_before)


def test_serialization_roundtrip():
    rnn = DirectorRNN()
    p = np.random.default_rng(42).random(14)
    rnn.forward(p)
    state = rnn.get_state()
    rnn2 = DirectorRNN.from_state(state)
    np.testing.assert_array_almost_equal(rnn.genome, rnn2.genome)
    np.testing.assert_array_almost_equal(rnn.hidden_state, rnn2.hidden_state)


def test_weight_clamping():
    rnn = DirectorRNN()
    p = np.ones(14)
    bias = rnn.forward(p)
    rnn.learn_from_outcome(p, bias, outcome_signal=100.0, lr=1.0)
    assert np.all(np.abs(rnn.genome) <= 3.0)
