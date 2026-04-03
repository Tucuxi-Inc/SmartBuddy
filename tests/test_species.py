import numpy as np
from engine.traits import TraitSystem, TRAIT_COUNT
from engine.identity import SPECIES_LIST, roll_bones, Bones
from engine.species import SPECIES_ARCHETYPES, create_buddy_traits

def test_all_species_have_archetypes():
    for species in SPECIES_LIST:
        assert species in SPECIES_ARCHETYPES, f"Missing archetype for {species}"

def test_archetype_trait_names_valid():
    ts = TraitSystem()
    for species, archetype in SPECIES_ARCHETYPES.items():
        for trait_name in archetype.get("high", []):
            ts.trait_index(trait_name)
        for trait_name in archetype.get("low", []):
            ts.trait_index(trait_name)

def test_create_buddy_traits_shape():
    bones = roll_bones("test_user")
    traits = create_buddy_traits(bones)
    assert traits.shape == (TRAIT_COUNT,)
    assert np.all(traits >= 0.0)
    assert np.all(traits <= 1.0)

def test_create_buddy_traits_deterministic():
    bones = roll_bones("test_user")
    t1 = create_buddy_traits(bones)
    t2 = create_buddy_traits(bones)
    np.testing.assert_array_equal(t1, t2)

def test_species_bias_applied():
    ts = TraitSystem()
    bones = roll_bones("test_user")
    cat_bones = Bones(species="cat", trait_seeds=bones.trait_seeds)
    traits = create_buddy_traits(cat_bones)
    duck_bones = Bones(species="duck", trait_seeds=bones.trait_seeds)
    duck_traits = create_buddy_traits(duck_bones)
    cat_ind = traits[ts.trait_index("independence")]
    duck_ind = duck_traits[ts.trait_index("independence")]
    assert cat_ind > duck_ind

def test_different_seeds_produce_different_traits():
    bones1 = Bones(species="cat", trait_seeds=tuple(i / 50 for i in range(50)))
    bones2 = Bones(species="cat", trait_seeds=tuple((49 - i) / 50 for i in range(50)))
    t1 = create_buddy_traits(bones1)
    t2 = create_buddy_traits(bones2)
    assert not np.allclose(t1, t2)
