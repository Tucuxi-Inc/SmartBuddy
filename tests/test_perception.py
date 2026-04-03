# tests/test_perception.py
import math
import numpy as np
from engine.perception import (
    PerceptionMapper,
    PERCEPTION_DIM,
    PERCEPTION_NAMES,
)


def test_perception_dim():
    assert PERCEPTION_DIM == 14
    assert len(PERCEPTION_NAMES) == 14


def test_mapper_initial_state():
    mapper = PerceptionMapper()
    vec = mapper.get_vector()
    assert vec.shape == (14,)
    assert np.all(vec >= -1.0)
    assert np.all(vec <= 1.0)


def test_update_from_tool_use_bash_test_pass():
    mapper = PerceptionMapper()
    mapper.update_from_tool_event(
        tool_name="Bash",
        tool_input={"command": "pytest tests/ -v"},
        success=True,
    )
    vec = mapper.get_vector()
    # recent_success (dim 9) should be positive
    assert vec[9] > 0.0
    # pressure_level (dim 1) should be low
    assert vec[1] < 0.5


def test_update_from_tool_use_bash_test_fail():
    mapper = PerceptionMapper()
    mapper.update_from_tool_event(
        tool_name="Bash",
        tool_input={"command": "pytest tests/ -v"},
        success=False,
    )
    vec = mapper.get_vector()
    # pressure_level (dim 1) should increase
    assert vec[1] > 0.0


def test_update_from_edit():
    mapper = PerceptionMapper()
    mapper.update_from_tool_event(
        tool_name="Edit",
        tool_input={"file_path": "/project/src/new_module.py"},
        success=True,
    )
    vec = mapper.get_vector()
    # session_depth (dim 8) should increase
    assert vec[8] > 0.0


def test_novelty_increases_with_new_files():
    mapper = PerceptionMapper()
    mapper.update_from_tool_event(
        tool_name="Read",
        tool_input={"file_path": "/project/src/file_a.py"},
        success=True,
    )
    mapper.update_from_tool_event(
        tool_name="Read",
        tool_input={"file_path": "/project/src/file_b.py"},
        success=True,
    )
    mapper.update_from_tool_event(
        tool_name="Read",
        tool_input={"file_path": "/project/src/file_c.py"},
        success=True,
    )
    vec = mapper.get_vector()
    # novelty (dim 5) should be elevated
    assert vec[5] > 0.0


def test_familiarity_increases_with_repeated_files():
    mapper = PerceptionMapper()
    for _ in range(5):
        mapper.update_from_tool_event(
            tool_name="Read",
            tool_input={"file_path": "/project/src/main.py"},
            success=True,
        )
    vec = mapper.get_vector()
    # codebase_familiarity (dim 13) should be high
    assert vec[13] > 0.3


def test_time_of_day_encoding():
    mapper = PerceptionMapper()
    vec = mapper.get_vector()
    # Dims 6 and 7 are sin/cos of time — should be valid trig values
    assert -1.0 <= vec[6] <= 1.0
    assert -1.0 <= vec[7] <= 1.0
    # sin^2 + cos^2 should be ~1
    assert abs(vec[6] ** 2 + vec[7] ** 2 - 1.0) < 0.01


def test_reset():
    mapper = PerceptionMapper()
    mapper.update_from_tool_event("Bash", {"command": "ls"}, True)
    mapper.reset()
    vec = mapper.get_vector()
    # After reset, accumulated signals should be zero (except time)
    assert vec[8] == 0.0  # session_depth
    assert vec[9] == 0.0  # recent_success
