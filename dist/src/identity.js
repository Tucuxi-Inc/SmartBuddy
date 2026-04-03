export const SALT = "friend-2026-401";
export const SPECIES_LIST = [
    "duck", "goose", "cat", "rabbit", "owl", "penguin",
    "turtle", "snail", "dragon", "octopus", "axolotl", "ghost",
    "robot", "blob", "cactus", "mushroom", "chonk", "capybara",
];
/** FNV-1a 32-bit hash, matching original Buddy's implementation. */
export function fnv1a32(data) {
    let h = 0x811C9DC5;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);
    for (const byte of bytes) {
        h ^= byte;
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}
/** Mulberry32 PRNG, matching original Buddy's implementation. */
export class Mulberry32 {
    state;
    constructor(seed) {
        this.state = seed >>> 0;
    }
    next() {
        this.state = (this.state + 0x6D2B79F5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
        t = (t ^ Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
        return (t ^ (t >>> 14)) >>> 0;
    }
    nextFloat() {
        return this.next() / 0x100000000;
    }
    /** Box-Muller transform for normal distribution. */
    nextGaussian(sigma) {
        const u1 = this.nextFloat() || 1e-10; // avoid log(0)
        const u2 = this.nextFloat();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return z * sigma;
    }
}
export function rollBones(userId) {
    const hashVal = fnv1a32(userId + SALT);
    const rng = new Mulberry32(hashVal);
    const species = SPECIES_LIST[rng.next() % SPECIES_LIST.length];
    for (let i = 0; i < 10; i++)
        rng.next();
    const traitSeeds = Array.from({ length: 50 }, () => rng.nextFloat());
    return { species, traitSeeds };
}
//# sourceMappingURL=identity.js.map