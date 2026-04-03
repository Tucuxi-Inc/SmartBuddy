"""Identity system: deterministic bones from userId hash + LLM-generated soul."""
from __future__ import annotations
from dataclasses import dataclass

SALT = "friend-2026-401"

SPECIES_LIST = [
    "duck", "goose", "cat", "rabbit", "owl", "penguin",
    "turtle", "snail", "dragon", "octopus", "axolotl", "ghost",
    "robot", "blob", "cactus", "mushroom", "chonk", "capybara",
]

def fnv1a_32(data: str) -> int:
    """FNV-1a 32-bit hash, matching original Buddy's implementation."""
    h = 0x811C9DC5
    for byte in data.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h

class Mulberry32:
    """Mulberry32 PRNG, matching original Buddy's implementation."""
    def __init__(self, seed: int) -> None:
        self._state = seed & 0xFFFFFFFF

    def next(self) -> int:
        self._state = (self._state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self._state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ ((t ^ (t >> 7)) * (t | 61))) & 0xFFFFFFFF
        return (t ^ (t >> 14)) & 0xFFFFFFFF

    def next_float(self) -> float:
        return self.next() / 0x100000000

@dataclass(frozen=True)
class Bones:
    species: str
    trait_seeds: tuple[float, ...]

def roll_bones(user_id: str) -> Bones:
    hash_val = fnv1a_32(user_id + SALT)
    rng = Mulberry32(hash_val)
    species = SPECIES_LIST[rng.next() % len(SPECIES_LIST)]
    for _ in range(10):
        rng.next()
    trait_seeds = tuple(rng.next_float() for _ in range(50))
    return Bones(species=species, trait_seeds=trait_seeds)
