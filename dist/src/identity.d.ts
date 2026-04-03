export declare const SALT = "friend-2026-401";
export declare const SPECIES_LIST: readonly ["duck", "goose", "cat", "rabbit", "owl", "penguin", "turtle", "snail", "dragon", "octopus", "axolotl", "ghost", "robot", "blob", "cactus", "mushroom", "chonk", "capybara"];
/** FNV-1a 32-bit hash, matching original Buddy's implementation. */
export declare function fnv1a32(data: string): number;
/** Mulberry32 PRNG, matching original Buddy's implementation. */
export declare class Mulberry32 {
    private state;
    constructor(seed: number);
    next(): number;
    nextFloat(): number;
    /** Box-Muller transform for normal distribution. */
    nextGaussian(sigma: number): number;
}
export interface Bones {
    species: string;
    name: string;
    traitSeeds: number[];
}
export declare function rollBones(userId: string): Bones;
