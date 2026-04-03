from engine.identity import fnv1a_32, Mulberry32, roll_bones, SPECIES_LIST

def test_species_list():
    assert len(SPECIES_LIST) == 18
    assert "duck" in SPECIES_LIST
    assert "cat" in SPECIES_LIST
    assert "capybara" in SPECIES_LIST

def test_fnv1a_deterministic():
    h1 = fnv1a_32("test_user_123friend-2026-401")
    h2 = fnv1a_32("test_user_123friend-2026-401")
    assert h1 == h2
    assert isinstance(h1, int)

def test_fnv1a_different_inputs():
    h1 = fnv1a_32("user_a")
    h2 = fnv1a_32("user_b")
    assert h1 != h2

def test_mulberry32_deterministic():
    rng1 = Mulberry32(12345)
    rng2 = Mulberry32(12345)
    seq1 = [rng1.next() for _ in range(10)]
    seq2 = [rng2.next() for _ in range(10)]
    assert seq1 == seq2

def test_mulberry32_range():
    rng = Mulberry32(42)
    for _ in range(100):
        val = rng.next()
        assert 0 <= val < 2**32

def test_roll_bones_deterministic():
    bones1 = roll_bones("user_abc")
    bones2 = roll_bones("user_abc")
    assert bones1.species == bones2.species
    assert bones1.trait_seeds == bones2.trait_seeds

def test_roll_bones_different_users():
    bones1 = roll_bones("user_abc")
    bones2 = roll_bones("user_xyz")
    assert bones1.species != bones2.species or bones1.trait_seeds != bones2.trait_seeds

def test_roll_bones_species_is_valid():
    bones = roll_bones("any_user_id")
    assert bones.species in SPECIES_LIST

def test_roll_bones_trait_seeds_correct_count():
    bones = roll_bones("any_user_id")
    assert len(bones.trait_seeds) == 50
    for seed in bones.trait_seeds:
        assert 0.0 <= seed <= 1.0
