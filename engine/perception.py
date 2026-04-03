"""Map Claude Code tool events to the 14-dim perception vector."""
from __future__ import annotations

import math
import time
from collections import defaultdict

import numpy as np


PERCEPTION_DIM = 14

PERCEPTION_NAMES = [
    "collaboration_density",   # 0
    "pressure_level",          # 1
    "project_health",          # 2
    "session_momentum",        # 3
    "user_consistency",        # 4
    "novelty",                 # 5
    "time_of_day_sin",         # 6
    "time_of_day_cos",         # 7
    "session_depth",           # 8
    "recent_success",          # 9
    "iteration_pattern",       # 10
    "friction_level",          # 11
    "conversation_density",    # 12
    "codebase_familiarity",    # 13
]

# Tool commands that indicate test runs
_TEST_COMMANDS = ("pytest", "npm test", "cargo test", "go test", "jest", "vitest", "mocha")

# Tool commands that indicate risky operations
_RISKY_COMMANDS = ("git push --force", "git reset --hard", "rm -rf", "drop table", "git push -f")


class PerceptionMapper:
    """Accumulates coding events and produces a 14-dim perception vector."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        """Reset all accumulated state for a new session."""
        self._files_seen: set[str] = set()
        self._file_touches: defaultdict[str, int] = defaultdict(int)
        self._tool_count = 0
        self._success_count = 0
        self._fail_count = 0
        self._test_runs = 0
        self._test_passes = 0
        self._edit_count = 0
        self._recent_results: list[bool] = []  # last 20 tool outcomes
        self._friction_events = 0
        self._message_count = 0
        self._collaboration_signals = 0

    def update_from_tool_event(
        self,
        tool_name: str,
        tool_input: dict,
        success: bool,
    ) -> None:
        """Process a single tool use event."""
        self._tool_count += 1
        self._recent_results.append(success)
        if len(self._recent_results) > 20:
            self._recent_results.pop(0)

        if success:
            self._success_count += 1
        else:
            self._fail_count += 1
            self._friction_events += 1

        # File tracking
        file_path = tool_input.get("file_path", "")
        if file_path:
            is_new = file_path not in self._files_seen
            self._files_seen.add(file_path)
            self._file_touches[file_path] += 1

        # Tool-specific signals
        if tool_name == "Bash":
            cmd = tool_input.get("command", "")
            cmd_lower = cmd.lower()
            if any(tc in cmd_lower for tc in _TEST_COMMANDS):
                self._test_runs += 1
                if success:
                    self._test_passes += 1
            if any(rc in cmd_lower for rc in _RISKY_COMMANDS):
                self._friction_events += 1
            if "git" in cmd_lower and ("pr" in cmd_lower or "review" in cmd_lower):
                self._collaboration_signals += 1
        elif tool_name in ("Edit", "Write"):
            self._edit_count += 1

    def update_from_message(self) -> None:
        """Track user message (for conversation_density)."""
        self._message_count += 1

    def get_vector(self) -> np.ndarray:
        """Compute the current 14-dim perception vector."""
        vec = np.zeros(PERCEPTION_DIM, dtype=np.float64)

        # [0] collaboration_density
        vec[0] = min(1.0, self._collaboration_signals / 5.0)

        # [1] pressure_level — recent failures increase pressure
        if self._tool_count > 0:
            recent_fail_rate = sum(1 for r in self._recent_results[-5:] if not r) / max(len(self._recent_results[-5:]), 1)
            vec[1] = recent_fail_rate

        # [2] project_health — test pass rate
        if self._test_runs > 0:
            vec[2] = self._test_passes / self._test_runs
        else:
            vec[2] = 0.5  # neutral when no tests run

        # [3] session_momentum — streak of recent successes
        if self._recent_results:
            streak = 0
            for r in reversed(self._recent_results):
                if r:
                    streak += 1
                else:
                    break
            vec[3] = min(1.0, streak / 5.0)

        # [4] user_consistency — variance in tool usage patterns
        if self._tool_count > 5:
            # Low variance = high consistency
            success_rate = self._success_count / self._tool_count
            vec[4] = 1.0 - abs(success_rate - 0.5) * 2  # peaks at 50/50, low at extremes
            vec[4] = max(0.0, min(1.0, success_rate))  # simpler: just success rate

        # [5] novelty — ratio of new files to total files seen
        total_touches = sum(self._file_touches.values())
        if total_touches > 0:
            unique_ratio = len(self._files_seen) / total_touches
            vec[5] = min(1.0, unique_ratio)

        # [6, 7] time_of_day — circadian encoding
        hour = time.localtime().tm_hour + time.localtime().tm_min / 60.0
        vec[6] = math.sin(2 * math.pi * hour / 24.0)
        vec[7] = math.cos(2 * math.pi * hour / 24.0)

        # [8] session_depth — total tools used, normalized
        vec[8] = min(1.0, self._tool_count / 50.0)

        # [9] recent_success — success rate of last 10
        if self._recent_results:
            recent = self._recent_results[-10:]
            vec[9] = sum(1 for r in recent if r) / len(recent)

        # [10] iteration_pattern — edit->test cycles (TDD signal)
        if self._edit_count > 0 and self._test_runs > 0:
            ratio = min(self._test_runs, self._edit_count) / max(self._test_runs, self._edit_count)
            vec[10] = ratio  # 1.0 = perfect edit/test balance

        # [11] friction_level — permission denials, errors, risky ops
        vec[11] = min(1.0, self._friction_events / 10.0)

        # [12] conversation_density — message frequency
        vec[12] = min(1.0, self._message_count / 20.0)

        # [13] codebase_familiarity — repeated file access
        if self._file_touches:
            repeat_ratio = sum(1 for c in self._file_touches.values() if c > 1) / len(self._file_touches)
            vec[13] = repeat_ratio

        return vec
