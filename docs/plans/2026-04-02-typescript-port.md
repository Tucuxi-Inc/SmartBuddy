# SmartBuddy TypeScript Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the SmartBuddy cognitive engine from Python/NumPy to pure TypeScript with zero runtime dependencies, backward-compatible `mind.json` state, and hooks-only plugin integration (no MCP server).

**Architecture:** 1:1 module mapping from `engine/*.py` to `src/*.ts`. All NumPy operations replaced by a ~50-line `math.ts` utility module using plain `number[]` and `number[][]`. Hook handlers in `hooks-src/` replace shell scripts. Pre-compiled `dist/` committed for zero-build install.

**Tech Stack:** TypeScript 5.4+, Vitest 1.x (dev only), Node.js ES2022 modules. Zero runtime dependencies.

---

## File Structure

```
SmartBuddy/
├── src/
│   ├── math.ts                  # Array math (~50 lines, replaces NumPy)
│   ├── identity.ts              # FNV-1a, Mulberry32, rollBones
│   ├── traits.ts                # 50-trait system, TraitSystem, dampenTraitUpdate
│   ├── species.ts               # 18 archetypes, createBuddyTraits
│   ├── actions.ts               # BuddyAction enum, SILENT/SPEECH sets
│   ├── emotional-state.ts       # 12 emotions, EmotionalSystem
│   ├── rnn.ts                   # DirectorRNN 14→8→6
│   ├── council.ts               # CognitiveCouncil + DirectorPool
│   ├── decision.ts              # DecisionModel, BUDDY_ACTION_MAP
│   ├── personality-evolution.ts  # 7 triggers, correlation matrix
│   ├── perception.ts            # PerceptionMapper → 14-dim vector
│   ├── sprites.ts               # ASCII art + expressions
│   ├── speech.ts                # Template-based speech
│   ├── brain.ts                 # BuddyBrain orchestrator
│   └── index.ts                 # Public API re-exports
├── hooks-src/
│   ├── on-tool-use.ts           # PostToolUse → cognitive tick
│   └── on-prompt-submit.ts      # UserPromptSubmit → inject context
├── tests/
│   ├── math.test.ts
│   ├── identity.test.ts
│   ├── traits.test.ts
│   ├── species.test.ts
│   ├── actions.test.ts
│   ├── emotional-state.test.ts
│   ├── rnn.test.ts
│   ├── council.test.ts
│   ├── decision.test.ts
│   ├── personality-evolution.test.ts
│   ├── perception.test.ts
│   ├── sprites.test.ts
│   ├── speech.test.ts
│   ├── brain.test.ts
│   └── integration.test.ts
├── dist/                        # Pre-compiled (committed)
├── skills/                      # Updated (no MCP references)
├── hooks/hooks.json             # Updated (references dist/hooks/*.js)
├── .claude-plugin/plugin.json   # Updated (no mcpServers)
├── package.json
├── tsconfig.json
└── .gitignore                   # Updated for node_modules, dist
```

---

## Conventions

- Python `snake_case` → TypeScript `camelCase` for functions/methods
- Constants stay `UPPER_SNAKE_CASE`
- File names use `kebab-case.ts`
- JSON field names stay `snake_case` (backward compat with Python `mind.json`)
- Vectors are `number[]`, matrices are `number[][]` (row-major)
- All RNG uses `Mulberry32` from `identity.ts` (extended with `nextFloat`, `nextGaussian`)
- Tests use `describe`/`it` with `expect` (Vitest)

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "smartbuddy",
  "version": "0.2.0",
  "description": "A cognitive coding companion that actually thinks",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "vitest": "^1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*", "hooks-src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Update .gitignore**

Replace `.gitignore` with:

```
# Node
node_modules/

# Python (legacy, preserved in v0.1.0 tag)
__pycache__/
*.py[cod]
*.egg-info/
.eggs/
*.egg
.venv/
venv/
.pytest_cache/
smartbuddy_engine.egg-info/

# Environment
.env
.DS_Store
*.swp
*.swo

# Note: dist/ is NOT ignored — committed for zero-build install
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created with typescript and vitest

- [ ] **Step 5: Verify TypeScript compiles (empty project)**

Create a minimal `src/index.ts`:
```typescript
export const VERSION = "0.2.0";
```

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Verify vitest runs**

Create `tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run`
Expected: 1 test passed

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore src/index.ts tests/smoke.test.ts
git commit -m "feat: TypeScript project scaffold with vitest"
```

---

### Task 2: Math Utilities

**Files:**
- Create: `src/math.ts`
- Create: `tests/math.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/math.test.ts
import { describe, it, expect } from "vitest";
import {
  matmul, dot, outer, sigmoid, tanhVec, softmax,
  clip, add, mul, scale, zeros, argmax,
} from "../src/math.js";

describe("math", () => {
  it("dot product", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("dot product empty", () => {
    expect(dot([], [])).toBe(0);
  });

  it("matmul 2x3 * 3", () => {
    const A = [[1, 2, 3], [4, 5, 6]];
    const x = [1, 1, 1];
    const result = matmul(A, x);
    expect(result).toEqual([6, 15]);
  });

  it("outer product", () => {
    const result = outer([1, 2], [3, 4]);
    expect(result).toEqual([[3, 4], [6, 8]]);
  });

  it("sigmoid", () => {
    const result = sigmoid([0]);
    expect(result[0]).toBeCloseTo(0.5, 5);
    // Large positive → near 1
    expect(sigmoid([10])[0]).toBeGreaterThan(0.99);
    // Large negative → near 0
    expect(sigmoid([-10])[0]).toBeLessThan(0.01);
  });

  it("tanhVec", () => {
    const result = tanhVec([0]);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(tanhVec([2])[0]).toBeGreaterThan(0.9);
    expect(tanhVec([-2])[0]).toBeLessThan(-0.9);
  });

  it("softmax sums to 1", () => {
    const result = softmax([1, 2, 3], 1.0);
    const total = result.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("softmax temperature 0 is argmax", () => {
    const result = softmax([1, 3, 2], 0);
    expect(result).toEqual([0, 1, 0]);
  });

  it("softmax numerically stable with large values", () => {
    const result = softmax([1000, 1001, 1002], 1.0);
    const total = result.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
    expect(result[2]).toBeGreaterThan(result[1]);
  });

  it("clip", () => {
    expect(clip([0.5, -1, 2], 0, 1)).toEqual([0.5, 0, 1]);
  });

  it("add", () => {
    expect(add([1, 2], [3, 4])).toEqual([4, 6]);
  });

  it("mul (Hadamard)", () => {
    expect(mul([2, 3], [4, 5])).toEqual([8, 15]);
  });

  it("scale", () => {
    expect(scale([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it("zeros", () => {
    expect(zeros(3)).toEqual([0, 0, 0]);
  });

  it("argmax", () => {
    expect(argmax([1, 5, 3])).toBe(1);
    expect(argmax([5, 1, 3])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/math.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement math.ts**

```typescript
// src/math.ts

/** Matrix (row-major) × vector */
export function matmul(A: number[][], x: number[]): number[] {
  return A.map(row => dot(row, x));
}

/** Dot product */
export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Outer product: a (column) × b (row) */
export function outer(a: number[], b: number[]): number[][] {
  return a.map(ai => b.map(bj => ai * bj));
}

/** Element-wise sigmoid */
export function sigmoid(x: number[]): number[] {
  return x.map(v => 1 / (1 + Math.exp(-v)));
}

/** Element-wise tanh */
export function tanhVec(x: number[]): number[] {
  return x.map(v => Math.tanh(v));
}

/** Numerically stable softmax with temperature */
export function softmax(x: number[], temperature: number): number[] {
  if (temperature <= 0) {
    const idx = argmax(x);
    return x.map((_, i) => i === idx ? 1 : 0);
  }
  const max = Math.max(...x);
  const exps = x.map(v => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

/** Element-wise clamp */
export function clip(x: number[], min: number, max: number): number[] {
  return x.map(v => Math.max(min, Math.min(max, v)));
}

/** Element-wise addition */
export function add(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/** Element-wise multiplication (Hadamard) */
export function mul(a: number[], b: number[]): number[] {
  return a.map((v, i) => v * b[i]);
}

/** Scalar multiply */
export function scale(a: number[], s: number): number[] {
  return a.map(v => v * s);
}

/** Zero vector */
export function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

/** Index of maximum value */
export function argmax(x: number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < x.length; i++) {
    if (x[i] > x[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/** Euclidean norm */
export function norm(x: number[]): number {
  return Math.sqrt(x.reduce((s, v) => s + v * v, 0));
}

/** argsort descending — returns indices */
export function argsortDesc(x: number[]): number[] {
  return x.map((v, i) => i).sort((a, b) => x[b] - x[a]);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/math.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/math.ts tests/math.test.ts
git commit -m "feat: math.ts — pure TS array math replacing NumPy"
```

---

### Task 3: Identity System

**Files:**
- Create: `src/identity.ts`
- Create: `tests/identity.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/identity.test.ts
import { describe, it, expect } from "vitest";
import {
  fnv1a32, Mulberry32, rollBones, Bones, SPECIES_LIST, SALT,
} from "../src/identity.js";

describe("identity", () => {
  it("species list has 18 entries", () => {
    expect(SPECIES_LIST).toHaveLength(18);
    expect(SPECIES_LIST).toContain("duck");
    expect(SPECIES_LIST).toContain("cat");
    expect(SPECIES_LIST).toContain("capybara");
  });

  it("fnv1a32 is deterministic", () => {
    const h1 = fnv1a32("test_user_123" + SALT);
    const h2 = fnv1a32("test_user_123" + SALT);
    expect(h1).toBe(h2);
    expect(typeof h1).toBe("number");
  });

  it("fnv1a32 different inputs differ", () => {
    expect(fnv1a32("user_a")).not.toBe(fnv1a32("user_b"));
  });

  it("Mulberry32 is deterministic", () => {
    const rng1 = new Mulberry32(12345);
    const rng2 = new Mulberry32(12345);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it("Mulberry32 range", () => {
    const rng = new Mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(2 ** 32);
    }
  });

  it("Mulberry32 nextFloat in [0,1)", () => {
    const rng = new Mulberry32(99);
    for (let i = 0; i < 100; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("Mulberry32 nextGaussian produces varied values", () => {
    const rng = new Mulberry32(77);
    const values = Array.from({ length: 100 }, () => rng.nextGaussian(1.0));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // Mean should be near 0 for large N
    expect(Math.abs(mean)).toBeLessThan(0.5);
    // Should have negative values
    expect(values.some(v => v < 0)).toBe(true);
  });

  it("rollBones is deterministic", () => {
    const b1 = rollBones("user_abc");
    const b2 = rollBones("user_abc");
    expect(b1.species).toBe(b2.species);
    expect(b1.traitSeeds).toEqual(b2.traitSeeds);
  });

  it("rollBones different users differ", () => {
    const b1 = rollBones("user_abc");
    const b2 = rollBones("user_xyz");
    expect(b1.species !== b2.species || b1.traitSeeds !== b2.traitSeeds).toBe(true);
  });

  it("rollBones species is valid", () => {
    const bones = rollBones("any_user_id");
    expect(SPECIES_LIST).toContain(bones.species);
  });

  it("rollBones trait seeds count and range", () => {
    const bones = rollBones("any_user_id");
    expect(bones.traitSeeds).toHaveLength(50);
    for (const seed of bones.traitSeeds) {
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/identity.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement identity.ts**

```typescript
// src/identity.ts

export const SALT = "friend-2026-401";

export const SPECIES_LIST = [
  "duck", "goose", "cat", "rabbit", "owl", "penguin",
  "turtle", "snail", "dragon", "octopus", "axolotl", "ghost",
  "robot", "blob", "cactus", "mushroom", "chonk", "capybara",
] as const;

/** FNV-1a 32-bit hash, matching original Buddy's implementation. */
export function fnv1a32(data: string): number {
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
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return (t ^ (t >>> 14)) >>> 0;
  }

  nextFloat(): number {
    return this.next() / 0x100000000;
  }

  /** Box-Muller transform for normal distribution. */
  nextGaussian(sigma: number): number {
    const u1 = this.nextFloat() || 1e-10; // avoid log(0)
    const u2 = this.nextFloat();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * sigma;
  }
}

export interface Bones {
  species: string;
  traitSeeds: number[];
}

export function rollBones(userId: string): Bones {
  const hashVal = fnv1a32(userId + SALT);
  const rng = new Mulberry32(hashVal);
  const species = SPECIES_LIST[rng.next() % SPECIES_LIST.length];
  // Skip 10 values (matches Python)
  for (let i = 0; i < 10; i++) rng.next();
  const traitSeeds = Array.from({ length: 50 }, () => rng.nextFloat());
  return { species, traitSeeds };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/identity.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/identity.ts tests/identity.test.ts
git commit -m "feat: identity.ts — FNV-1a, Mulberry32, rollBones"
```

---

### Task 4: Traits System

**Files:**
- Create: `src/traits.ts`
- Create: `tests/traits.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/traits.test.ts
import { describe, it, expect } from "vitest";
import {
  TRAIT_COUNT, TRAITS, TRAIT_NAME_TO_INDEX, TRAIT_INDEX_TO_NAME,
  TraitSystem, dampenTraitUpdate,
} from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("traits", () => {
  it("trait count is 50", () => {
    expect(TRAIT_COUNT).toBe(50);
    expect(TRAITS).toHaveLength(50);
  });

  it("all traits have unique indices", () => {
    const indices = TRAITS.map(t => t.index);
    expect(new Set(indices).size).toBe(50);
    expect([...indices].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, i) => i)
    );
  });

  it("trait name lookup", () => {
    const ts = new TraitSystem();
    expect(ts.traitIndex("openness")).toBe(0);
    expect(ts.traitIndex("curiosity")).toBe(6);
  });

  it("trait name lookup invalid throws", () => {
    const ts = new TraitSystem();
    expect(() => ts.traitIndex("nonexistent_trait")).toThrow();
  });

  it("randomTraits shape and range", () => {
    const ts = new TraitSystem();
    const rng = new Mulberry32(42);
    const traits = ts.randomTraits(rng);
    expect(traits).toHaveLength(50);
    for (const v of traits) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("randomTraits deterministic with seed", () => {
    const ts = new TraitSystem();
    const a = ts.randomTraits(new Mulberry32(42));
    const b = ts.randomTraits(new Mulberry32(42));
    expect(a).toEqual(b);
  });

  it("traitDistance", () => {
    const ts = new TraitSystem();
    const a = new Array(50).fill(0);
    const b = new Array(50).fill(1);
    const d = ts.traitDistance(a, b);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
    expect(ts.traitDistance(a, a)).toBe(0);
  });

  it("getDominantTraits", () => {
    const ts = new TraitSystem();
    const traits = new Array(50).fill(0);
    traits[6] = 0.95; // curiosity
    traits[0] = 0.90; // openness
    const top = ts.getDominantTraits(traits, 2);
    expect(top).toHaveLength(2);
    expect(top[0][0]).toBe("curiosity");
    expect(top[1][0]).toBe("openness");
  });

  it("dampenTraitUpdate stays in bounds", () => {
    let result = dampenTraitUpdate(0.85, 0.1);
    expect(result).toBeLessThanOrEqual(0.90);
    expect(result).toBeGreaterThan(0.85);

    result = dampenTraitUpdate(0.15, -0.1);
    expect(result).toBeGreaterThanOrEqual(0.10);
    expect(result).toBeLessThan(0.15);

    result = dampenTraitUpdate(0.5, 0.04);
    expect(Math.abs(result - 0.54)).toBeLessThan(0.001);
  });

  it("dampenTraitUpdate hard clamp", () => {
    expect(dampenTraitUpdate(0.89, 0.5)).toBeLessThanOrEqual(0.90);
    expect(dampenTraitUpdate(0.11, -0.5)).toBeGreaterThanOrEqual(0.10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/traits.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement traits.ts**

```typescript
// src/traits.ts
import { Mulberry32 } from "./identity.js";
import { norm, argsortDesc } from "./math.js";

export const TRAIT_COUNT = 50;

export interface TraitDefinition {
  index: number;
  name: string;
  description: string;
  category: string;
}

export const TRAITS: TraitDefinition[] = [
  // Big Five (0-4)
  { index: 0,  name: "openness",           description: "Openness to experience",               category: "big_five" },
  { index: 1,  name: "conscientiousness",   description: "Organization and discipline",          category: "big_five" },
  { index: 2,  name: "extraversion",        description: "Social energy and outgoingness",       category: "big_five" },
  { index: 3,  name: "agreeableness",       description: "Cooperation and trust in others",      category: "big_five" },
  { index: 4,  name: "neuroticism",         description: "Emotional reactivity and sensitivity", category: "big_five" },
  // Cognitive (5-9)
  { index: 5,  name: "creativity",          description: "Imaginative and inventive thinking",   category: "cognitive" },
  { index: 6,  name: "curiosity",           description: "Desire to explore and learn",          category: "cognitive" },
  { index: 7,  name: "adaptability",        description: "Ability to adjust to new situations",  category: "cognitive" },
  { index: 8,  name: "resilience",          description: "Recovery from setbacks",               category: "cognitive" },
  { index: 9,  name: "ambition",            description: "Drive for achievement",                category: "cognitive" },
  // Social (10-14)
  { index: 10, name: "empathy",             description: "Understanding others' feelings",       category: "social" },
  { index: 11, name: "trust",               description: "Willingness to rely on others",        category: "social" },
  { index: 12, name: "assertiveness",       description: "Directness in communication",          category: "social" },
  { index: 13, name: "self_control",        description: "Restraint and impulse regulation",     category: "social" },
  { index: 14, name: "optimism",            description: "Positive expectation of outcomes",     category: "social" },
  // Emotional (15-19)
  { index: 15, name: "risk_taking",         description: "Willingness to accept uncertainty",    category: "emotional" },
  { index: 16, name: "patience",            description: "Tolerance for delay",                  category: "emotional" },
  { index: 17, name: "humor",               description: "Appreciation of comedy and play",      category: "emotional" },
  { index: 18, name: "independence",        description: "Self-reliance and autonomy",           category: "emotional" },
  { index: 19, name: "sensitivity",         description: "Awareness of subtle stimuli",          category: "emotional" },
  // Behavioral (20-24)
  { index: 20, name: "depth_drive",         description: "Compulsion toward deep processing",    category: "behavioral" },
  { index: 21, name: "dominance",           description: "Desire to lead and control",           category: "behavioral" },
  { index: 22, name: "warmth",              description: "Emotional approachability",            category: "behavioral" },
  { index: 23, name: "discipline",          description: "Adherence to routine and structure",   category: "behavioral" },
  { index: 24, name: "integrity",           description: "Consistency of values and actions",    category: "behavioral" },
  // Social extended (25-29)
  { index: 25, name: "loyalty",             description: "Faithfulness to commitments",          category: "social" },
  { index: 26, name: "competitiveness",     description: "Drive to outperform others",           category: "social" },
  { index: 27, name: "generosity",          description: "Willingness to share resources",       category: "social" },
  { index: 28, name: "pragmatism",          description: "Practical problem-solving focus",      category: "cognitive" },
  { index: 29, name: "idealism",            description: "Pursuit of abstract principles",       category: "cognitive" },
  // Cognitive extended (30-34)
  { index: 30, name: "sociability",         description: "Enjoyment of social interaction",      category: "social" },
  { index: 31, name: "introversion",        description: "Preference for solitude and reflection", category: "emotional" },
  { index: 32, name: "analytical",          description: "Systematic logical reasoning",         category: "cognitive" },
  { index: 33, name: "intuitive",           description: "Gut-feel pattern recognition",         category: "cognitive" },
  { index: 34, name: "emotional_stability", description: "Steadiness under pressure",            category: "emotional" },
  // Behavioral extended (35-39)
  { index: 35, name: "persistence",         description: "Tenacity in pursuing goals",           category: "behavioral" },
  { index: 36, name: "flexibility",         description: "Willingness to change approach",       category: "behavioral" },
  { index: 37, name: "confidence",          description: "Belief in own abilities",              category: "emotional" },
  { index: 38, name: "humility",            description: "Modesty and openness to correction",   category: "emotional" },
  { index: 39, name: "cooperativeness",     description: "Tendency to work with others",         category: "social" },
  // Final block (40-49)
  { index: 40, name: "resourcefulness",     description: "Ability to find creative solutions",   category: "behavioral" },
  { index: 41, name: "adventurousness",     description: "Appetite for novel experiences",       category: "behavioral" },
  { index: 42, name: "caution",             description: "Careful evaluation before acting",     category: "behavioral" },
  { index: 43, name: "traditionalism",      description: "Respect for established ways",         category: "behavioral" },
  { index: 44, name: "innovation",          description: "Drive to create new methods",          category: "cognitive" },
  { index: 45, name: "tolerance",           description: "Acceptance of differing views",        category: "social" },
  { index: 46, name: "expressiveness",      description: "Outward display of inner states",      category: "emotional" },
  { index: 47, name: "stoicism",            description: "Endurance without complaint",          category: "emotional" },
  { index: 48, name: "spirituality",        description: "Sense of transcendent meaning",        category: "emotional" },
  { index: 49, name: "playfulness",         description: "Lighthearted engagement with the world", category: "behavioral" },
];

export const TRAIT_NAME_TO_INDEX: Record<string, number> = Object.fromEntries(
  TRAITS.map(t => [t.name, t.index])
);

export const TRAIT_INDEX_TO_NAME: Record<number, string> = Object.fromEntries(
  TRAITS.map(t => [t.index, t.name])
);

// Boundary constants for experiential updates
const TRAIT_BOUNDARY_FADE_THRESHOLD = 0.75;
const TRAIT_FREQUENCY_DEPENDENT_THRESHOLD = 0.70;
const TRAIT_EXPERIENTIAL_MIN = 0.10;
const TRAIT_EXPERIENTIAL_MAX = 0.90;
const UPPER_FADE_RANGE = TRAIT_EXPERIENTIAL_MAX - TRAIT_BOUNDARY_FADE_THRESHOLD;
const LOWER_FADE_RANGE = (1.0 - TRAIT_BOUNDARY_FADE_THRESHOLD) - TRAIT_EXPERIENTIAL_MIN;

export class TraitSystem {
  get count(): number { return TRAIT_COUNT; }

  traitIndex(name: string): number {
    const idx = TRAIT_NAME_TO_INDEX[name];
    if (idx === undefined) throw new Error(`Unknown trait name: "${name}"`);
    return idx;
  }

  randomTraits(rng: Mulberry32): number[] {
    return Array.from({ length: TRAIT_COUNT }, () => rng.nextFloat());
  }

  traitDistance(a: number[], b: number[]): number {
    const diff = a.map((v, i) => v - b[i]);
    return norm(diff) / Math.sqrt(TRAIT_COUNT);
  }

  getDominantTraits(traits: number[], topN: number = 5): [string, number][] {
    const indices = argsortDesc(traits);
    return indices.slice(0, topN).map(i => [TRAIT_INDEX_TO_NAME[i], traits[i]]);
  }
}

export function dampenTraitUpdate(current: number, delta: number): number {
  // Stage 1: frequency-dependent halving
  if (delta > 0 && current > TRAIT_FREQUENCY_DEPENDENT_THRESHOLD) {
    delta *= 0.5;
  } else if (delta < 0 && current < 1.0 - TRAIT_FREQUENCY_DEPENDENT_THRESHOLD) {
    delta *= 0.5;
  }

  // Stage 2: boundary fade
  if (delta > 0 && current > TRAIT_BOUNDARY_FADE_THRESHOLD) {
    const headroom = Math.max(TRAIT_EXPERIENTIAL_MAX - current, 0);
    delta *= headroom / UPPER_FADE_RANGE;
  } else if (delta < 0 && current < 1.0 - TRAIT_BOUNDARY_FADE_THRESHOLD) {
    const headroom = Math.max(current - TRAIT_EXPERIENTIAL_MIN, 0);
    delta *= headroom / LOWER_FADE_RANGE;
  }

  return Math.max(TRAIT_EXPERIENTIAL_MIN, Math.min(TRAIT_EXPERIENTIAL_MAX, current + delta));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/traits.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/traits.ts tests/traits.test.ts
git commit -m "feat: traits.ts — 50-trait personality system"
```

---

### Task 5: Actions

**Files:**
- Create: `src/actions.ts`
- Create: `tests/actions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/actions.test.ts
import { describe, it, expect } from "vitest";
import {
  BuddyAction, SILENT_ACTIONS, SPEECH_ACTIONS, actionToBehavior,
} from "../src/actions.js";

describe("actions", () => {
  it("BuddyAction has 11 values", () => {
    expect(Object.keys(BuddyAction)).toHaveLength(11);
    expect(BuddyAction.OBSERVE).toBe("observe");
    expect(BuddyAction.CHALLENGE).toBe("challenge");
  });

  it("actionToBehavior", () => {
    const behavior = actionToBehavior(BuddyAction.ENCOURAGE);
    expect(behavior.description).toBeDefined();
    expect(behavior.isSilent).toBe(false);
    expect(behavior.hasSpeech).toBe(true);
  });

  it("silent actions", () => {
    expect(SILENT_ACTIONS.has(BuddyAction.OBSERVE)).toBe(true);
    expect(SILENT_ACTIONS.has(BuddyAction.STUDY)).toBe(true);
    expect(SILENT_ACTIONS.has(BuddyAction.ENCOURAGE)).toBe(false);
  });

  it("speech actions", () => {
    expect(SPEECH_ACTIONS.has(BuddyAction.ENCOURAGE)).toBe(true);
    expect(SPEECH_ACTIONS.has(BuddyAction.CHALLENGE)).toBe(true);
    expect(SPEECH_ACTIONS.has(BuddyAction.OBSERVE)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement actions.ts**

```typescript
// src/actions.ts

export const BuddyAction = {
  OBSERVE: "observe",
  CURIOUS_COMMENT: "curious_comment",
  ENGAGE: "engage",
  STUDY: "study",
  ENCOURAGE: "encourage",
  SUGGEST: "suggest",
  CHALLENGE: "challenge",
  TEACH: "teach",
  EMOTE: "emote",
  JOURNAL: "journal",
  GIFT: "gift",
} as const;

export type BuddyActionValue = typeof BuddyAction[keyof typeof BuddyAction];

export const SILENT_ACTIONS = new Set<string>([
  BuddyAction.OBSERVE, BuddyAction.STUDY, BuddyAction.EMOTE, BuddyAction.JOURNAL,
]);

export const SPEECH_ACTIONS = new Set<string>([
  BuddyAction.CURIOUS_COMMENT, BuddyAction.ENGAGE, BuddyAction.ENCOURAGE,
  BuddyAction.SUGGEST, BuddyAction.CHALLENGE, BuddyAction.TEACH, BuddyAction.GIFT,
]);

const BEHAVIOR_DESCRIPTIONS: Record<string, string> = {
  [BuddyAction.OBSERVE]: "Watching quietly, absorbing patterns",
  [BuddyAction.CURIOUS_COMMENT]: "Reacting to something novel",
  [BuddyAction.ENGAGE]: "Actively responding to what's happening",
  [BuddyAction.STUDY]: "Silently learning about the codebase",
  [BuddyAction.ENCOURAGE]: "Cheering on good work",
  [BuddyAction.SUGGEST]: "Offering an observation",
  [BuddyAction.CHALLENGE]: "Gently questioning a choice",
  [BuddyAction.TEACH]: "Sharing something from past sessions",
  [BuddyAction.EMOTE]: "Expressing a mood",
  [BuddyAction.JOURNAL]: "Writing a journal entry",
  [BuddyAction.GIFT]: "Creating something useful",
};

export function actionToBehavior(action: string): {
  action: string;
  description: string;
  isSilent: boolean;
  hasSpeech: boolean;
} {
  return {
    action,
    description: BEHAVIOR_DESCRIPTIONS[action] ?? "Unknown action",
    isSilent: SILENT_ACTIONS.has(action),
    hasSpeech: SPEECH_ACTIONS.has(action),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/actions.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/actions.ts tests/actions.test.ts
git commit -m "feat: actions.ts — buddy action enum and behavior map"
```

---

### Task 6: Species Archetypes

**Files:**
- Create: `src/species.ts`
- Create: `tests/species.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/species.test.ts
import { describe, it, expect } from "vitest";
import { SPECIES_ARCHETYPES, createBuddyTraits } from "../src/species.js";
import { SPECIES_LIST, rollBones, Bones } from "../src/identity.js";
import { TraitSystem, TRAIT_COUNT } from "../src/traits.js";

describe("species", () => {
  it("all species have archetypes", () => {
    for (const species of SPECIES_LIST) {
      expect(SPECIES_ARCHETYPES[species]).toBeDefined();
    }
  });

  it("archetype trait names are valid", () => {
    const ts = new TraitSystem();
    for (const [species, archetype] of Object.entries(SPECIES_ARCHETYPES)) {
      for (const name of archetype.high ?? []) ts.traitIndex(name);
      for (const name of archetype.low ?? []) ts.traitIndex(name);
    }
  });

  it("createBuddyTraits shape and range", () => {
    const bones = rollBones("test_user");
    const traits = createBuddyTraits(bones);
    expect(traits).toHaveLength(TRAIT_COUNT);
    for (const v of traits) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("createBuddyTraits is deterministic", () => {
    const bones = rollBones("test_user");
    const t1 = createBuddyTraits(bones);
    const t2 = createBuddyTraits(bones);
    expect(t1).toEqual(t2);
  });

  it("species bias applied — cat vs duck independence", () => {
    const ts = new TraitSystem();
    const bones = rollBones("test_user");
    const catTraits = createBuddyTraits({ species: "cat", traitSeeds: bones.traitSeeds });
    const duckTraits = createBuddyTraits({ species: "duck", traitSeeds: bones.traitSeeds });
    expect(catTraits[ts.traitIndex("independence")]).toBeGreaterThan(
      duckTraits[ts.traitIndex("independence")]
    );
  });

  it("different seeds produce different traits", () => {
    const seeds1 = Array.from({ length: 50 }, (_, i) => i / 50);
    const seeds2 = Array.from({ length: 50 }, (_, i) => (49 - i) / 50);
    const t1 = createBuddyTraits({ species: "cat", traitSeeds: seeds1 });
    const t2 = createBuddyTraits({ species: "cat", traitSeeds: seeds2 });
    expect(t1).not.toEqual(t2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/species.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement species.ts**

```typescript
// src/species.ts
import type { Bones } from "./identity.js";
import { TraitSystem, TRAIT_COUNT } from "./traits.js";

const ts = new TraitSystem();

export interface SpeciesArchetype {
  high: string[];
  low: string[];
}

export const SPECIES_ARCHETYPES: Record<string, SpeciesArchetype> = {
  duck:     { high: ["sociability", "optimism", "adaptability", "extraversion"],    low: ["persistence", "independence"] },
  goose:    { high: ["assertiveness", "loyalty", "persistence", "dominance"],        low: ["agreeableness", "flexibility"] },
  cat:      { high: ["independence", "patience", "self_control", "sensitivity"],     low: ["agreeableness", "sociability"] },
  rabbit:   { high: ["sensitivity", "adaptability", "conscientiousness", "neuroticism"], low: ["emotional_stability", "risk_taking"] },
  owl:      { high: ["analytical", "patience", "conscientiousness", "depth_drive"],  low: ["playfulness", "extraversion"] },
  penguin:  { high: ["persistence", "loyalty", "sociability", "discipline"],         low: ["independence", "adventurousness"] },
  turtle:   { high: ["persistence", "caution", "conscientiousness", "patience"],     low: ["risk_taking", "playfulness"] },
  snail:    { high: ["patience", "conscientiousness", "self_control", "humility"],   low: ["assertiveness", "dominance"] },
  dragon:   { high: ["assertiveness", "confidence", "curiosity", "ambition"],        low: ["caution", "agreeableness"] },
  octopus:  { high: ["creativity", "adaptability", "curiosity", "resourcefulness"],  low: ["discipline", "persistence"] },
  axolotl:  { high: ["resilience", "optimism", "adaptability", "emotional_stability"], low: ["competitiveness", "dominance"] },
  ghost:    { high: ["independence", "creativity", "depth_drive", "introversion"],   low: ["sociability", "extraversion"] },
  robot:    { high: ["conscientiousness", "discipline", "self_control", "analytical"], low: ["expressiveness", "playfulness"] },
  blob:     { high: ["adaptability", "agreeableness", "resilience", "emotional_stability"], low: ["assertiveness", "ambition"] },
  cactus:   { high: ["independence", "persistence", "resourcefulness", "stoicism"],  low: ["sociability", "sensitivity"] },
  mushroom: { high: ["depth_drive", "patience", "cooperativeness", "empathy"],       low: ["assertiveness", "dominance"] },
  chonk:    { high: ["emotional_stability", "discipline", "patience", "warmth"],     low: ["ambition", "risk_taking"] },
  capybara: { high: ["sociability", "emotional_stability", "empathy", "agreeableness"], low: ["neuroticism", "competitiveness"] },
};

export function createBuddyTraits(bones: Bones): number[] {
  const archetype = SPECIES_ARCHETYPES[bones.species];
  const highIndices = new Set(archetype.high.map(n => ts.traitIndex(n)));
  const lowIndices = new Set(archetype.low.map(n => ts.traitIndex(n)));

  const traits: number[] = new Array(TRAIT_COUNT);
  for (let i = 0; i < TRAIT_COUNT; i++) {
    if (highIndices.has(i)) {
      traits[i] = 0.65 + bones.traitSeeds[i] * 0.10;
    } else if (lowIndices.has(i)) {
      traits[i] = 0.25 + bones.traitSeeds[i] * 0.10;
    } else {
      traits[i] = 0.30 + bones.traitSeeds[i] * 0.40;
    }
  }
  return traits;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/species.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/species.ts tests/species.test.ts
git commit -m "feat: species.ts — 18 archetypes with trait biases"
```

---

### Task 7: Emotional State System

**Files:**
- Create: `src/emotional-state.ts`
- Create: `tests/emotional-state.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/emotional-state.test.ts
import { describe, it, expect } from "vitest";
import {
  Emotion, EmotionalState, EmotionalSystem, EMOTION_TRAIT_MODIFIERS,
} from "../src/emotional-state.js";
import { TraitSystem } from "../src/traits.js";

describe("emotional-state", () => {
  it("Emotion enum has 12 values", () => {
    expect(Object.keys(Emotion)).toHaveLength(12);
    expect(Emotion.JOY).toBe("joy");
    expect(Emotion.FRUSTRATION).toBe("frustration");
  });

  it("EmotionalState decay", () => {
    const state: EmotionalState = {
      emotion: Emotion.JOY, intensity: 1.0, valence: 1.0,
      tickCreated: 0, decayTicks: 100,
    };
    expect(EmotionalSystem.currentIntensity(state, 0)).toBe(1.0);
    expect(EmotionalSystem.currentIntensity(state, 50)).toBeCloseTo(0.5, 2);
    expect(EmotionalSystem.currentIntensity(state, 100)).toBe(0.0);
    expect(EmotionalSystem.currentIntensity(state, 150)).toBe(0.0);
  });

  it("EmotionalState isActive", () => {
    const state: EmotionalState = {
      emotion: Emotion.JOY, intensity: 1.0, valence: 1.0,
      tickCreated: 0, decayTicks: 50,
    };
    expect(EmotionalSystem.isActive(state, 0)).toBe(true);
    expect(EmotionalSystem.isActive(state, 49)).toBe(true);
    expect(EmotionalSystem.isActive(state, 50)).toBe(false);
  });

  it("addEmotion clamps intensity", () => {
    const ts = new TraitSystem();
    const system = new EmotionalSystem(ts);
    const state = system.addEmotion(Emotion.CURIOSITY, 0.8, 0.5, 10);
    expect(state.emotion).toBe(Emotion.CURIOSITY);
    expect(state.intensity).toBe(0.8);
  });

  it("computeTraitModifiers", () => {
    const ts = new TraitSystem();
    const system = new EmotionalSystem(ts);
    const states = [system.addEmotion(Emotion.JOY, 1.0, 1.0, 0)];
    const mods = system.computeTraitModifiers(states, 0);
    expect(mods).toHaveLength(50);
    expect(mods[ts.traitIndex("extraversion")]).toBeGreaterThan(0);
  });

  it("decayEmotions filters expired", () => {
    const ts = new TraitSystem();
    const system = new EmotionalSystem(ts);
    const states = [
      system.addEmotion(Emotion.JOY, 1.0, 1.0, 0, 10),
      system.addEmotion(Emotion.FRUSTRATION, 0.5, -0.5, 0, 100),
    ];
    const filtered = EmotionalSystem.decayEmotions(states, 20);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].emotion).toBe(Emotion.FRUSTRATION);
  });

  it("all emotions have modifiers", () => {
    for (const emotion of Object.values(Emotion)) {
      expect(EMOTION_TRAIT_MODIFIERS[emotion]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/emotional-state.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement emotional-state.ts**

```typescript
// src/emotional-state.ts
import { TraitSystem, TRAIT_NAME_TO_INDEX } from "./traits.js";
import { zeros, add, scale } from "./math.js";

export const Emotion = {
  JOY: "joy",
  CURIOSITY: "curiosity",
  FRUSTRATION: "frustration",
  ANXIETY: "anxiety",
  SATISFACTION: "satisfaction",
  SURPRISE: "surprise",
  DETERMINATION: "determination",
  BOREDOM: "boredom",
  EXCITEMENT: "excitement",
  WARINESS: "wariness",
  CONTENTMENT: "contentment",
  IRRITATION: "irritation",
} as const;

export type EmotionValue = typeof Emotion[keyof typeof Emotion];

export interface EmotionalState {
  emotion: string;
  intensity: number;
  valence: number;
  tickCreated: number;
  decayTicks: number;
}

export const EMOTION_TRAIT_MODIFIERS: Record<string, Record<string, number>> = {
  [Emotion.JOY]:           { extraversion: 0.10, optimism: 0.15, neuroticism: -0.10 },
  [Emotion.CURIOSITY]:     { openness: 0.15, creativity: 0.10, curiosity: 0.15 },
  [Emotion.FRUSTRATION]:   { patience: -0.15, neuroticism: 0.10, emotional_stability: -0.10 },
  [Emotion.ANXIETY]:       { neuroticism: 0.15, risk_taking: -0.10, confidence: -0.10 },
  [Emotion.SATISFACTION]:  { emotional_stability: 0.10, optimism: 0.10, patience: 0.10 },
  [Emotion.SURPRISE]:      { confidence: 0.15, assertiveness: 0.10, humility: -0.10 },
  [Emotion.DETERMINATION]: { assertiveness: 0.10, persistence: 0.15, patience: 0.05 },
  [Emotion.BOREDOM]:       { extraversion: -0.10, optimism: -0.10, curiosity: -0.10 },
  [Emotion.EXCITEMENT]:    { extraversion: 0.12, risk_taking: 0.10, playfulness: 0.10 },
  [Emotion.WARINESS]:      { caution: 0.15, risk_taking: -0.15, confidence: -0.10 },
  [Emotion.CONTENTMENT]:   { emotional_stability: 0.15, patience: 0.12, neuroticism: -0.12 },
  [Emotion.IRRITATION]:    { assertiveness: 0.15, self_control: -0.10, agreeableness: -0.10, patience: -0.10 },
};

export class EmotionalSystem {
  private modifierVectors: Map<string, number[]> = new Map();
  private traitSystem: TraitSystem;

  constructor(traitSystem: TraitSystem) {
    this.traitSystem = traitSystem;
    for (const [emotion, mods] of Object.entries(EMOTION_TRAIT_MODIFIERS)) {
      const vec = zeros(traitSystem.count);
      for (const [traitName, value] of Object.entries(mods)) {
        const idx = TRAIT_NAME_TO_INDEX[traitName];
        if (idx !== undefined) vec[idx] = value;
      }
      this.modifierVectors.set(emotion, vec);
    }
  }

  addEmotion(
    emotion: string, intensity: number, valence: number,
    tick: number, decayTicks: number = 50,
  ): EmotionalState {
    return {
      emotion,
      intensity: Math.max(0, Math.min(1, intensity)),
      valence: Math.max(-1, Math.min(1, valence)),
      tickCreated: tick,
      decayTicks,
    };
  }

  computeTraitModifiers(states: EmotionalState[], currentTick: number): number[] {
    let modifier = zeros(this.traitSystem.count);
    for (const state of states) {
      const ci = EmotionalSystem.currentIntensity(state, currentTick);
      if (ci <= 0) continue;
      const vec = this.modifierVectors.get(state.emotion);
      if (vec) modifier = add(modifier, scale(vec, ci));
    }
    return modifier;
  }

  static currentIntensity(state: EmotionalState, currentTick: number): number {
    const elapsed = currentTick - state.tickCreated;
    if (elapsed < 0) return state.intensity;
    if (elapsed >= state.decayTicks) return 0;
    return state.intensity * (1 - elapsed / state.decayTicks);
  }

  static isActive(state: EmotionalState, currentTick: number): boolean {
    return EmotionalSystem.currentIntensity(state, currentTick) > 0;
  }

  static decayEmotions(states: EmotionalState[], currentTick: number): EmotionalState[] {
    return states.filter(s => EmotionalSystem.isActive(s, currentTick));
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/emotional-state.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/emotional-state.ts tests/emotional-state.test.ts
git commit -m "feat: emotional-state.ts — 12 emotions with trait modifiers"
```

---

### Task 8: Director RNN

**Files:**
- Create: `src/rnn.ts`
- Create: `tests/rnn.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/rnn.test.ts
import { describe, it, expect } from "vitest";
import {
  DirectorRNN, INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM, TOTAL_WEIGHTS,
} from "../src/rnn.js";
import { Mulberry32 } from "../src/identity.js";

describe("rnn", () => {
  it("constants", () => {
    expect(INPUT_DIM).toBe(14);
    expect(HIDDEN_DIM).toBe(8);
    expect(OUTPUT_DIM).toBe(6);
    expect(TOTAL_WEIGHTS).toBe(252);
  });

  it("random init shapes", () => {
    const rnn = new DirectorRNN(undefined, new Mulberry32(42));
    expect(rnn.genome).toHaveLength(252);
  });

  it("genome init", () => {
    const rng = new Mulberry32(42);
    const genome = Array.from({ length: 252 }, () => rng.nextGaussian(1.0));
    const rnn = new DirectorRNN(genome);
    expect(rnn.genome).toHaveLength(252);
    for (let i = 0; i < 252; i++) {
      expect(rnn.genome[i]).toBeCloseTo(genome[i], 10);
    }
  });

  it("forward output shape and range", () => {
    const rnn = new DirectorRNN(undefined, new Mulberry32(42));
    const rng = new Mulberry32(99);
    const perception = Array.from({ length: 14 }, () => rng.nextFloat());
    const output = rnn.forward(perception);
    expect(output).toHaveLength(6);
    for (const v of output) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("forward is deterministic", () => {
    const rng = new Mulberry32(42);
    const genome = Array.from({ length: 252 }, () => rng.nextGaussian(1.0));
    const perception = Array.from({ length: 14 }, () => new Mulberry32(99).nextFloat());
    const rnn1 = new DirectorRNN([...genome]);
    const rnn2 = new DirectorRNN([...genome]);
    const o1 = rnn1.forward([...perception]);
    const o2 = rnn2.forward([...perception]);
    expect(o1).toEqual(o2);
  });

  it("hidden state persists between calls", () => {
    const rnn = new DirectorRNN(undefined, new Mulberry32(42));
    const rng = new Mulberry32(99);
    const p = Array.from({ length: 14 }, () => rng.nextFloat());
    const out1 = rnn.forward(p);
    const out2 = rnn.forward(p);
    // Different because hidden state changed
    expect(out1).not.toEqual(out2);
  });

  it("learnFromOutcome changes weights", () => {
    const rnn = new DirectorRNN(undefined, new Mulberry32(42));
    const rng = new Mulberry32(99);
    const p = Array.from({ length: 14 }, () => rng.nextFloat());
    const bias = rnn.forward(p);
    const genomeBefore = [...rnn.genome];
    rnn.learnFromOutcome(p, bias, 1.0);
    expect(rnn.genome).not.toEqual(genomeBefore);
  });

  it("serialization roundtrip", () => {
    const rnn = new DirectorRNN(undefined, new Mulberry32(42));
    const rng = new Mulberry32(99);
    const p = Array.from({ length: 14 }, () => rng.nextFloat());
    rnn.forward(p);
    const state = rnn.getState();
    const rnn2 = DirectorRNN.fromState(state);
    expect(rnn2.genome).toEqual(rnn.genome);
    expect(rnn2.hidden).toEqual(rnn.hidden);
  });

  it("weight clamping", () => {
    const rnn = new DirectorRNN(undefined, new Mulberry32(42));
    const p = new Array(14).fill(1);
    const bias = rnn.forward(p);
    rnn.learnFromOutcome(p, bias, 100.0, 1.0);
    for (const w of rnn.genome) {
      expect(Math.abs(w)).toBeLessThanOrEqual(3.0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/rnn.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement rnn.ts**

```typescript
// src/rnn.ts
import { matmul, dot, outer, sigmoid, tanhVec, add, mul, scale, zeros, clip } from "./math.js";
import { Mulberry32 } from "./identity.js";

export const INPUT_DIM = 14;
export const HIDDEN_DIM = 8;
export const OUTPUT_DIM = 6;
export const TOTAL_WEIGHTS =
  INPUT_DIM + INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM * HIDDEN_DIM +
  HIDDEN_DIM * OUTPUT_DIM + HIDDEN_DIM + OUTPUT_DIM; // 252

const INIT_SIGMA = 0.3;
const LEARNING_RATE = 0.01;
const WEIGHT_CLAMP = 3.0;

export class DirectorRNN {
  genome: number[];
  hidden: number[];

  // Views into genome (start indices)
  private attnStart = 0;
  private wihStart = INPUT_DIM;
  private whhStart = INPUT_DIM + INPUT_DIM * HIDDEN_DIM;
  private whoStart = INPUT_DIM + INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM * HIDDEN_DIM;
  private biasHStart = INPUT_DIM + INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM * HIDDEN_DIM + HIDDEN_DIM * OUTPUT_DIM;
  private biasOStart = INPUT_DIM + INPUT_DIM * HIDDEN_DIM + HIDDEN_DIM * HIDDEN_DIM + HIDDEN_DIM * OUTPUT_DIM + HIDDEN_DIM;

  constructor(genome?: number[], rng?: Mulberry32) {
    if (genome) {
      if (genome.length !== TOTAL_WEIGHTS) {
        throw new Error(`Genome must have ${TOTAL_WEIGHTS} weights, got ${genome.length}`);
      }
      this.genome = [...genome];
    } else {
      rng = rng ?? new Mulberry32(Date.now() >>> 0);
      this.genome = new Array(TOTAL_WEIGHTS);
      // Attention mask: near -1 (perception-blind)
      for (let i = 0; i < INPUT_DIM; i++) {
        this.genome[i] = -1.0 + rng.nextGaussian(0.3);
      }
      // Remaining weights
      for (let i = INPUT_DIM; i < TOTAL_WEIGHTS; i++) {
        this.genome[i] = rng.nextGaussian(INIT_SIGMA);
      }
    }
    this.hidden = zeros(HIDDEN_DIM);
  }

  private getAttentionMask(): number[] {
    return this.genome.slice(this.attnStart, this.attnStart + INPUT_DIM);
  }

  private getWih(): number[][] {
    const flat = this.genome.slice(this.wihStart, this.wihStart + INPUT_DIM * HIDDEN_DIM);
    const m: number[][] = [];
    for (let r = 0; r < HIDDEN_DIM; r++) {
      m.push(flat.slice(r * INPUT_DIM, (r + 1) * INPUT_DIM));
    }
    return m;
  }

  private getWhh(): number[][] {
    const flat = this.genome.slice(this.whhStart, this.whhStart + HIDDEN_DIM * HIDDEN_DIM);
    const m: number[][] = [];
    for (let r = 0; r < HIDDEN_DIM; r++) {
      m.push(flat.slice(r * HIDDEN_DIM, (r + 1) * HIDDEN_DIM));
    }
    return m;
  }

  private getWho(): number[][] {
    const flat = this.genome.slice(this.whoStart, this.whoStart + HIDDEN_DIM * OUTPUT_DIM);
    const m: number[][] = [];
    for (let r = 0; r < OUTPUT_DIM; r++) {
      m.push(flat.slice(r * HIDDEN_DIM, (r + 1) * HIDDEN_DIM));
    }
    return m;
  }

  private getBiasH(): number[] {
    return this.genome.slice(this.biasHStart, this.biasHStart + HIDDEN_DIM);
  }

  private getBiasO(): number[] {
    return this.genome.slice(this.biasOStart, this.biasOStart + OUTPUT_DIM);
  }

  forward(perception: number[]): number[] {
    if (perception.length !== INPUT_DIM) {
      throw new Error(`Perception must be ${INPUT_DIM}-dimensional, got ${perception.length}`);
    }
    const attention = sigmoid(this.getAttentionMask());
    const masked = mul(perception, attention);
    const wihOut = matmul(this.getWih(), masked);
    const whhOut = matmul(this.getWhh(), this.hidden);
    this.hidden = tanhVec(add(add(wihOut, whhOut), this.getBiasH()));
    return tanhVec(add(matmul(this.getWho(), this.hidden), this.getBiasO()));
  }

  learnFromOutcome(
    perception: number[], biasProduced: number[],
    outcomeSignal: number, lr: number = LEARNING_RATE,
  ): void {
    const attention = sigmoid(this.getAttentionMask());
    const masked = mul(perception, attention);

    // Gradient for W_ho: outcome * bias * hidden^T
    const gradHo = outer(biasProduced, this.hidden).map(row =>
      row.map(v => v * outcomeSignal * lr)
    );
    // Apply to genome
    for (let r = 0; r < OUTPUT_DIM; r++) {
      for (let c = 0; c < HIDDEN_DIM; c++) {
        this.genome[this.whoStart + r * HIDDEN_DIM + c] += gradHo[r][c];
      }
    }

    // Gradient for W_ih: outcome * (1 - hidden^2) * masked^T
    const hiddenGrad = this.hidden.map(h => outcomeSignal * (1 - h * h));
    const gradIh = outer(hiddenGrad, masked).map(row =>
      row.map(v => v * lr)
    );
    for (let r = 0; r < HIDDEN_DIM; r++) {
      for (let c = 0; c < INPUT_DIM; c++) {
        this.genome[this.wihStart + r * INPUT_DIM + c] += gradIh[r][c];
      }
    }

    // Gradient for attention mask
    const sigGrad = attention.map((a, i) => a * (1 - a));
    const wihT: number[][] = [];
    const wih = this.getWih();
    for (let c = 0; c < INPUT_DIM; c++) {
      wihT.push(wih.map(row => row[c]));
    }
    const wihTHiddenGrad = wihT.map(col => dot(col, hiddenGrad));
    for (let i = 0; i < INPUT_DIM; i++) {
      this.genome[this.attnStart + i] += lr * wihTHiddenGrad[i] * perception[i] * sigGrad[i];
    }

    // Clamp
    for (let i = this.whoStart; i < this.whoStart + OUTPUT_DIM * HIDDEN_DIM; i++) {
      this.genome[i] = Math.max(-WEIGHT_CLAMP, Math.min(WEIGHT_CLAMP, this.genome[i]));
    }
    for (let i = this.wihStart; i < this.wihStart + HIDDEN_DIM * INPUT_DIM; i++) {
      this.genome[i] = Math.max(-WEIGHT_CLAMP, Math.min(WEIGHT_CLAMP, this.genome[i]));
    }
    for (let i = this.attnStart; i < this.attnStart + INPUT_DIM; i++) {
      this.genome[i] = Math.max(-WEIGHT_CLAMP, Math.min(WEIGHT_CLAMP, this.genome[i]));
    }
  }

  getState(): { genome: number[]; hidden: number[] } {
    return { genome: [...this.genome], hidden: [...this.hidden] };
  }

  static fromState(state: { genome: number[]; hidden?: number[] }): DirectorRNN {
    const rnn = new DirectorRNN(state.genome);
    if (state.hidden) rnn.hidden = [...state.hidden];
    return rnn;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/rnn.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/rnn.ts tests/rnn.test.ts
git commit -m "feat: rnn.ts — Director RNN 14→8→6 with REINFORCE"
```

---

### Task 9: Council + Director Pool

**Files:**
- Create: `src/council.ts`
- Create: `tests/council.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/council.test.ts
import { describe, it, expect } from "vitest";
import {
  CognitiveCouncil, DirectorRole, DirectorPool, SUB_AGENT_NAMES,
} from "../src/council.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("council", () => {
  const ts = new TraitSystem();
  const rng = () => new Mulberry32(42);
  const traits = () => ts.randomTraits(rng());

  it("sub agent names", () => {
    expect(SUB_AGENT_NAMES).toEqual([
      "cortex", "seer", "oracle", "house", "prudence",
      "hypothalamus", "amygdala", "conscience",
    ]);
  });

  it("council activations has 8 entries", () => {
    const council = new CognitiveCouncil(ts);
    const act = council.getActivations(traits());
    expect(Object.keys(act)).toHaveLength(8);
    for (const name of SUB_AGENT_NAMES) {
      expect(act[name]).toBeDefined();
    }
  });

  it("dominant voice", () => {
    const council = new CognitiveCouncil(ts);
    const dom = council.getDominantVoice(traits());
    expect(SUB_AGENT_NAMES).toContain(dom);
  });

  it("council modulation shape and range", () => {
    const council = new CognitiveCouncil(ts);
    const mod = council.computeCouncilModulation(traits())!;
    expect(mod).toHaveLength(50);
    for (const v of mod) {
      expect(v).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
  });

  it("council disabled returns null", () => {
    const council = new CognitiveCouncil(ts, false);
    expect(council.getDominantVoice(traits())).toBeNull();
    expect(council.computeCouncilModulation(traits())).toBeNull();
  });

  it("director roles", () => {
    expect(DirectorRole.ANALYST).toBe("analyst");
    expect(DirectorRole.INTEGRATOR).toBe("integrator");
  });

  it("director pool creation", () => {
    const pool = new DirectorPool(5, new Mulberry32(42));
    expect(Object.keys(pool.directors)).toHaveLength(5);
  });

  it("director pool process", () => {
    const pool = new DirectorPool(5, new Mulberry32(42));
    const p = ts.randomTraits(rng());
    const results = pool.process(p.slice(0, 14));
    expect(Object.keys(results)).toHaveLength(5);
    for (const bias of Object.values(results)) {
      expect(bias).toHaveLength(6);
    }
  });

  it("director pool learn", () => {
    const pool = new DirectorPool(5, new Mulberry32(42));
    const perception = Array.from({ length: 14 }, () => rng().nextFloat());
    const results = pool.process(perception);
    const key = Object.keys(results)[0];
    pool.learn(key, perception, results[key], 1.0);
  });

  it("director pool serialization", () => {
    const pool = new DirectorPool(5, new Mulberry32(42));
    const perception = Array.from({ length: 14 }, () => rng().nextFloat());
    pool.process(perception);
    const state = pool.getState();
    const pool2 = DirectorPool.fromState(state);
    expect(Object.keys(pool2.directors)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/council.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement council.ts**

```typescript
// src/council.ts
import { dot, zeros, clip } from "./math.js";
import { TraitSystem, TRAIT_NAME_TO_INDEX } from "./traits.js";
import { DirectorRNN } from "./rnn.js";
import { Mulberry32 } from "./identity.js";

export const DEFAULT_COUNCIL_WEIGHTS: Record<string, [string, number][]> = {
  cortex:       [["openness", 0.4], ["conscientiousness", 0.3], ["adaptability", 0.15], ["self_control", 0.15]],
  seer:         [["creativity", 0.4], ["depth_drive", 0.35], ["openness", 0.25]],
  oracle:       [["risk_taking", 0.3], ["ambition", 0.35], ["adaptability", 0.2], ["openness", 0.15]],
  house:        [["trust", 0.3], ["self_control", 0.25], ["agreeableness", 0.25], ["empathy", 0.2]],
  prudence:     [["conscientiousness", 0.35], ["self_control", 0.35], ["neuroticism", 0.15], ["trust", 0.15]],
  hypothalamus: [["extraversion", 0.35], ["dominance", 0.3], ["ambition", 0.2], ["risk_taking", 0.15]],
  amygdala:     [["neuroticism", 0.45], ["resilience", -0.3], ["trust", -0.25]],
  conscience:   [["agreeableness", 0.3], ["empathy", 0.35], ["trust", 0.2], ["self_control", 0.15]],
};

export const SUB_AGENT_NAMES = Object.keys(DEFAULT_COUNCIL_WEIGHTS);

export class CognitiveCouncil {
  private weightVectors: Map<string, number[]> = new Map();
  private validAgents: string[] = [];
  private traitSystem: TraitSystem;
  private enabled: boolean;

  constructor(traitSystem: TraitSystem, enabled: boolean = true) {
    this.traitSystem = traitSystem;
    this.enabled = enabled;

    for (const [name, traitWeights] of Object.entries(DEFAULT_COUNCIL_WEIGHTS)) {
      const vec = zeros(traitSystem.count);
      let valid = false;
      for (const [traitName, weight] of traitWeights) {
        const idx = TRAIT_NAME_TO_INDEX[traitName];
        if (idx !== undefined) { vec[idx] = weight; valid = true; }
      }
      if (valid) {
        this.weightVectors.set(name, vec);
        this.validAgents.push(name);
      }
    }
  }

  getActivations(traits: number[], desperationFactor: number = 0): Record<string, number> {
    const activations: Record<string, number> = {};
    for (const name of this.validAgents) {
      activations[name] = dot(this.weightVectors.get(name)!, traits);
    }
    if (desperationFactor > 0) {
      if (activations.hypothalamus !== undefined)
        activations.hypothalamus += desperationFactor * 0.6;
      if (activations.amygdala !== undefined)
        activations.amygdala += desperationFactor * 0.4;
    }
    return activations;
  }

  getDominantVoice(traits: number[]): string | null {
    if (!this.enabled) return null;
    const act = this.getActivations(traits);
    if (!Object.keys(act).length) return null;
    return Object.entries(act).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  computeCouncilModulation(traits: number[]): number[] | null {
    if (!this.enabled) return null;
    const act = this.getActivations(traits);
    const values = Object.values(act);
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return new Array(this.traitSystem.count).fill(1);

    const range = max - min;
    const normalized: Record<string, number> = {};
    for (const [name, val] of Object.entries(act)) {
      normalized[name] = (val - min) / range;
    }

    const modulation = new Array(this.traitSystem.count).fill(1);
    for (const [name, normAct] of Object.entries(normalized)) {
      const wv = this.weightVectors.get(name)!;
      const influence = 0.2 * (normAct - 0.5);
      for (let i = 0; i < wv.length; i++) {
        if (wv[i] !== 0) modulation[i] += influence * Math.abs(wv[i]);
      }
    }
    return clip(modulation, 0.5, 1.5);
  }
}

export const DirectorRole = {
  ANALYST: "analyst",
  EVALUATOR: "evaluator",
  STRATEGIST: "strategist",
  CRITIC: "critic",
  INTEGRATOR: "integrator",
} as const;

const DIRECTOR_ROLE_PRIORITY = [
  DirectorRole.INTEGRATOR, DirectorRole.ANALYST, DirectorRole.EVALUATOR,
  DirectorRole.STRATEGIST, DirectorRole.CRITIC,
];

export interface Director {
  role: string;
  rnn: DirectorRNN;
  totalRuns: number;
  meanOutcome: number;
}

export class DirectorPool {
  directorCount: number;
  directors: Record<string, Director>;

  constructor(directorCount: number = 5, rng?: Mulberry32) {
    if (directorCount < 2 || directorCount > 12) {
      throw new Error(`directorCount must be 2-12, got ${directorCount}`);
    }
    this.directorCount = directorCount;
    this.directors = {};
    for (let i = 0; i < directorCount; i++) {
      const role = DIRECTOR_ROLE_PRIORITY[i % DIRECTOR_ROLE_PRIORITY.length];
      const instance = Math.floor(i / DIRECTOR_ROLE_PRIORITY.length);
      const key = `${role}_${instance}`;
      this.directors[key] = {
        role,
        rnn: new DirectorRNN(undefined, rng ? new Mulberry32(rng.next()) : undefined),
        totalRuns: 0,
        meanOutcome: 0,
      };
    }
  }

  process(perception: number[], activeCount?: number): Record<string, number[]> {
    const count = activeCount !== undefined
      ? Math.min(activeCount, this.directorCount) : this.directorCount;
    const results: Record<string, number[]> = {};
    let i = 0;
    for (const [key, director] of Object.entries(this.directors)) {
      if (i >= count) break;
      results[key] = director.rnn.forward(perception);
      director.totalRuns++;
      i++;
    }
    return results;
  }

  learn(key: string, perception: number[], bias: number[], outcome: number): void {
    const director = this.directors[key];
    director.rnn.learnFromOutcome(perception, bias, outcome);
    const n = Math.max(director.totalRuns, 1);
    director.meanOutcome += (outcome - director.meanOutcome) / n;
  }

  getState(): {
    director_count: number;
    directors: Record<string, { rnn: { genome: number[]; hidden: number[] }; total_runs: number; mean_outcome: number }>;
  } {
    const dirs: Record<string, any> = {};
    for (const [key, d] of Object.entries(this.directors)) {
      dirs[key] = {
        rnn: d.rnn.getState(),
        total_runs: d.totalRuns,
        mean_outcome: d.meanOutcome,
      };
    }
    return { director_count: this.directorCount, directors: dirs };
  }

  static fromState(state: any): DirectorPool {
    if (!state || !state.director_count) return new DirectorPool();
    const count = state.director_count;
    const pool = new DirectorPool(count);
    const dirs = state.directors || {};
    for (const [key, data] of Object.entries(dirs) as [string, any][]) {
      if (pool.directors[key]) {
        pool.directors[key].rnn = data.rnn
          ? DirectorRNN.fromState(data.rnn) : pool.directors[key].rnn;
        pool.directors[key].totalRuns = data.total_runs ?? 0;
        pool.directors[key].meanOutcome = data.mean_outcome ?? 0;
      }
    }
    return pool;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/council.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/council.ts tests/council.test.ts
git commit -m "feat: council.ts — 8-voice council + director pool"
```

---

### Task 10: Decision Model

**Files:**
- Create: `src/decision.ts`
- Create: `tests/decision.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/decision.test.ts
import { describe, it, expect } from "vitest";
import { DecisionModel, BUDDY_ACTION_MAP, BUDDY_ACTIONS } from "../src/decision.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("decision", () => {
  const ts = new TraitSystem();

  it("BUDDY_ACTIONS has 11 entries", () => {
    expect(BUDDY_ACTIONS).toHaveLength(11);
    expect(BUDDY_ACTIONS).toContain("observe");
    expect(BUDDY_ACTIONS).toContain("gift");
  });

  it("action map dimensions are 6", () => {
    for (const [action, vec] of Object.entries(BUDDY_ACTION_MAP)) {
      expect(vec).toHaveLength(6);
    }
  });

  it("decide returns result", () => {
    const model = new DecisionModel(ts);
    const traits = ts.randomTraits(new Mulberry32(42));
    const result = model.decide(traits, { pressure: 0.5 }, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, new Mulberry32(42));
    expect(BUDDY_ACTIONS).toContain(result.chosenAction);
  });

  it("probabilities sum to 1", () => {
    const model = new DecisionModel(ts);
    const traits = ts.randomTraits(new Mulberry32(42));
    const result = model.decide(traits, { pressure: 0.5 }, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, new Mulberry32(42));
    const total = Object.values(result.probabilities).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
  });

  it("explainability", () => {
    const model = new DecisionModel(ts);
    const traits = new Array(50).fill(0);
    traits[ts.traitIndex("curiosity")] = 0.95;
    const result = model.decide(traits, { novelty: 0.8 }, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, new Mulberry32(42));
    const explanation = result.explain();
    expect(Object.keys(explanation).length).toBeGreaterThan(0);
  });

  it("council modulation affects probabilities", () => {
    const model = new DecisionModel(ts);
    const traits = ts.randomTraits(new Mulberry32(42));
    const sit = { pressure: 0.5 };
    const r1 = model.decide(traits, sit, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, new Mulberry32(99));
    const mod = new Array(50).fill(1.5);
    const r2 = model.decide(traits, sit, BUDDY_ACTIONS, undefined, undefined, mod, undefined, new Mulberry32(99));
    expect(r1.probabilities).not.toEqual(r2.probabilities);
  });

  it("director biases affect decision", () => {
    const model = new DecisionModel(ts);
    const traits = ts.randomTraits(new Mulberry32(42));
    const cooperativeBias = [0, 0, 0, 1, 0, 0];
    const result = model.decide(traits, { pressure: 0.5 }, BUDDY_ACTIONS, undefined, undefined, undefined, cooperativeBias, new Mulberry32(42));
    expect(result.probabilities.encourage).toBeGreaterThan(0.01);
  });

  it("temperature 0 is deterministic", () => {
    const model = new DecisionModel(ts, 0);
    const traits = ts.randomTraits(new Mulberry32(42));
    const r1 = model.decide(traits, { pressure: 0.5 }, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, new Mulberry32(1));
    const r2 = model.decide(traits, { pressure: 0.5 }, BUDDY_ACTIONS, undefined, undefined, undefined, undefined, new Mulberry32(2));
    expect(r1.chosenAction).toBe(r2.chosenAction);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/decision.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement decision.ts**

```typescript
// src/decision.ts
import { dot, mul, softmax, zeros } from "./math.js";
import { TraitSystem, TRAIT_INDEX_TO_NAME } from "./traits.js";
import { Mulberry32 } from "./identity.js";

export const BUDDY_ACTION_MAP: Record<string, number[]> = {
  observe:         [ 0.2, -0.3, -0.3,  0.0,  0.0, -0.5],
  curious_comment: [-0.2,  0.1,  0.5,  0.1, -0.1,  0.2],
  engage:          [ 0.0,  0.5,  0.0,  0.3,  0.0,  0.1],
  study:           [ 0.2, -0.2,  0.2,  0.0,  0.3, -0.3],
  encourage:       [ 0.0,  0.4,  0.0,  0.5, -0.1,  0.0],
  suggest:         [ 0.0,  0.2,  0.1,  0.2,  0.3,  0.2],
  challenge:       [-0.3,  0.1,  0.0, -0.3,  0.0,  0.4],
  teach:           [ 0.1,  0.3, -0.1,  0.3, -0.2,  0.0],
  emote:           [-0.1,  0.3,  0.1,  0.1, -0.2,  0.1],
  journal:         [ 0.3, -0.1, -0.2,  0.0,  0.2, -0.2],
  gift:            [ 0.1,  0.2,  0.0,  0.3,  0.3, -0.1],
};

export const BUDDY_ACTIONS = Object.keys(BUDDY_ACTION_MAP);

export interface DecisionResult {
  chosenAction: string;
  probabilities: Record<string, number>;
  traitContributions: number[];
  utilities: Record<string, number>;
  explain(traitNames?: string[]): Record<string, number>;
}

export class DecisionModel {
  private traitSystem: TraitSystem;
  private temperature: number;
  private defaultWeights: Map<string, number[]>;

  constructor(traitSystem: TraitSystem, temperature: number = 1.0, weightSeed: number = 0) {
    this.traitSystem = traitSystem;
    this.temperature = temperature;
    const rng = new Mulberry32(weightSeed);
    const tc = traitSystem.count;
    this.defaultWeights = new Map();
    for (const action of BUDDY_ACTIONS) {
      const w = Array.from({ length: tc }, () => rng.nextFloat());
      const sum = w.reduce((a, b) => a + b, 0);
      this.defaultWeights.set(action, w.map(v => v / sum));
    }
  }

  decide(
    traits: number[],
    situation: Record<string, number>,
    actions: string[],
    actionWeights?: Record<string, number[]>,
    actionBiases?: Record<string, number>,
    councilModulation?: number[] | null,
    directorBiases?: number[],
    rng?: Mulberry32,
  ): DecisionResult {
    rng = rng ?? new Mulberry32(Date.now() >>> 0);
    if (!actions.length) throw new Error("At least one action required");

    const tc = this.traitSystem.count;
    const effectiveTraits = councilModulation ? mul(traits, councilModulation) : [...traits];
    const sitValues = Object.values(situation);
    const sitMagnitude = sitValues.length
      ? sitValues.reduce((s, v) => s + Math.abs(v), 0) / sitValues.length : 1.0;

    if (actions.length === 1) {
      return makeResult(actions[0], { [actions[0]]: 1.0 }, [...traits], { [actions[0]]: 1.0 });
    }

    const utilities: Record<string, number> = {};
    const contributions: Record<string, number[]> = {};

    for (const action of actions) {
      const w = actionWeights?.[action] ?? this.defaultWeights.get(action)
        ?? new Array(tc).fill(1 / tc);
      let bias = actionBiases?.[action] ?? 0;
      if (directorBiases && BUDDY_ACTION_MAP[action]) {
        bias += dot(BUDDY_ACTION_MAP[action], directorBiases);
      }
      const c = mul(effectiveTraits, w).map(v => v * sitMagnitude);
      utilities[action] = c.reduce((a, b) => a + b, 0) + bias;
      contributions[action] = c;
    }

    const values = actions.map(a => utilities[a]);
    const probs = softmax(values, this.temperature);
    const probDict: Record<string, number> = {};
    actions.forEach((a, i) => { probDict[a] = probs[i]; });

    // Weighted random selection
    const r = rng.nextFloat();
    let cumulative = 0;
    let chosenIdx = actions.length - 1;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (r < cumulative) { chosenIdx = i; break; }
    }
    const chosen = actions[chosenIdx];

    return makeResult(chosen, probDict, contributions[chosen], utilities);
  }
}

function makeResult(
  chosenAction: string, probabilities: Record<string, number>,
  traitContributions: number[], utilities: Record<string, number>,
): DecisionResult {
  return {
    chosenAction,
    probabilities,
    traitContributions,
    utilities,
    explain(traitNames?: string[]): Record<string, number> {
      const names = traitNames ?? Array.from(
        { length: traitContributions.length }, (_, i) => TRAIT_INDEX_TO_NAME[i]
      );
      const result: Record<string, number> = {};
      names.forEach((name, i) => {
        if (Math.abs(traitContributions[i]) > 0.001) result[name] = traitContributions[i];
      });
      return result;
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/decision.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/decision.ts tests/decision.test.ts
git commit -m "feat: decision.ts — utility-based action selection"
```

---

### Task 11: Personality Evolution

**Files:**
- Create: `src/personality-evolution.ts`
- Create: `tests/personality-evolution.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/personality-evolution.test.ts
import { describe, it, expect } from "vitest";
import {
  EvolutionTrigger, PersonalityEvolutionEngine,
  TRAIT_CORRELATION_MATRIX, EVOLUTION_RULES, PersonalityShift,
} from "../src/personality-evolution.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("personality-evolution", () => {
  const ts = new TraitSystem();

  it("evolution triggers", () => {
    expect(EvolutionTrigger.SUSTAINED_DEBUGGING).toBe("sustained_debugging");
    expect(EvolutionTrigger.CREATIVE_EXPLORATION).toBe("creative_exploration");
    expect(EvolutionTrigger.BREAKTHROUGH).toBe("breakthrough");
  });

  it("personality shift decay", () => {
    const shift: PersonalityShift = {
      traitIndex: 6, magnitude: 0.05,
      trigger: EvolutionTrigger.SUSTAINED_DEBUGGING,
      tickCreated: 0, decayTicks: 100,
    };
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 0)).toBe(0.05);
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 50)).toBeCloseTo(0.025, 3);
    expect(PersonalityEvolutionEngine.currentMagnitude(shift, 100)).toBe(0);
  });

  it("createShift produces correlated shifts", () => {
    const engine = new PersonalityEvolutionEngine(ts);
    const shifts = engine.createShift(EvolutionTrigger.SUSTAINED_DEBUGGING, 0);
    expect(shifts.length).toBeGreaterThan(1);
    expect(shifts.every(s => s.trigger === EvolutionTrigger.SUSTAINED_DEBUGGING)).toBe(true);
  });

  it("applyShifts modifies traits", () => {
    const engine = new PersonalityEvolutionEngine(ts);
    const traits = ts.randomTraits(new Mulberry32(42));
    const original = [...traits];
    const shifts = engine.createShift(EvolutionTrigger.BREAKTHROUGH, 0);
    const updated = engine.applyShifts(traits, shifts, 0);
    expect(updated).not.toEqual(original);
    for (const v of updated) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("applyShifts respects decay", () => {
    const engine = new PersonalityEvolutionEngine(ts);
    const traits = ts.randomTraits(new Mulberry32(42));
    const shifts = engine.createShift(EvolutionTrigger.SUSTAINED_DEBUGGING, 0, 0.05, 10);
    const early = engine.applyShifts([...traits], shifts, 0);
    const late = engine.applyShifts([...traits], shifts, 20);
    // Late should equal original (fully decayed)
    expect(late).toEqual(traits);
    expect(early).not.toEqual(traits);
  });

  it("all triggers have rules", () => {
    for (const trigger of Object.values(EvolutionTrigger)) {
      expect(EVOLUTION_RULES[trigger]).toBeDefined();
    }
  });

  it("correlation matrix is symmetric in keys", () => {
    const keys = Object.keys(TRAIT_CORRELATION_MATRIX);
    for (const key of keys) {
      const [a, b] = key.split(",");
      expect(TRAIT_CORRELATION_MATRIX[`${b},${a}`]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/personality-evolution.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement personality-evolution.ts**

```typescript
// src/personality-evolution.ts
import { TraitSystem, TRAIT_NAME_TO_INDEX, dampenTraitUpdate } from "./traits.js";

export const EvolutionTrigger = {
  SUSTAINED_DEBUGGING: "sustained_debugging",
  CREATIVE_EXPLORATION: "creative_exploration",
  METHODICAL_TESTING: "methodical_testing",
  COLLABORATIVE_SESSION: "collaborative_session",
  LONG_GRIND: "long_grind",
  BREAKTHROUGH: "breakthrough",
  CAUTIOUS_RECOVERY: "cautious_recovery",
} as const;

export type EvolutionTriggerValue = typeof EvolutionTrigger[keyof typeof EvolutionTrigger];

export interface PersonalityShift {
  traitIndex: number;
  magnitude: number;
  trigger: string;
  tickCreated: number;
  decayTicks: number;
}

// Key format: "source,target" → ratio
export const TRAIT_CORRELATION_MATRIX: Record<string, number> = {
  "trust,loyalty": 0.3,            "loyalty,trust": 0.25,
  "empathy,warmth": 0.3,           "warmth,empathy": 0.25,
  "conscientiousness,discipline": 0.35, "discipline,conscientiousness": 0.3,
  "openness,curiosity": 0.3,       "curiosity,openness": 0.25,
  "extraversion,sociability": 0.18, "sociability,extraversion": 0.15,
  "neuroticism,emotional_stability": -0.2, "emotional_stability,neuroticism": -0.18,
  "confidence,assertiveness": 0.3, "assertiveness,confidence": 0.25,
  "resilience,persistence": 0.3,   "persistence,resilience": 0.25,
  "creativity,innovation": 0.3,    "innovation,creativity": 0.25,
  "agreeableness,cooperativeness": 0.18, "cooperativeness,agreeableness": 0.15,
  "ambition,competitiveness": 0.25, "competitiveness,ambition": 0.2,
  "optimism,confidence": 0.25,     "confidence,optimism": 0.2,
  "risk_taking,adventurousness": 0.3, "adventurousness,risk_taking": 0.25,
  "caution,risk_taking": -0.3,     "risk_taking,caution": -0.25,
  "patience,self_control": 0.25,   "self_control,patience": 0.2,
  "generosity,empathy": 0.2,       "empathy,generosity": 0.15,
};

// Maps trigger → list of [trait_name, direction, base_magnitude]
export const EVOLUTION_RULES: Record<string, [string, number, number][]> = {
  [EvolutionTrigger.SUSTAINED_DEBUGGING]:  [["patience", 1, 0.02], ["self_control", 1, 0.015], ["resilience", 1, 0.01], ["risk_taking", -1, 0.01]],
  [EvolutionTrigger.CREATIVE_EXPLORATION]: [["curiosity", 1, 0.02], ["openness", 1, 0.015], ["caution", -1, 0.01], ["adventurousness", 1, 0.01]],
  [EvolutionTrigger.METHODICAL_TESTING]:   [["conscientiousness", 1, 0.02], ["discipline", 1, 0.015], ["patience", 1, 0.01], ["playfulness", -1, 0.01]],
  [EvolutionTrigger.COLLABORATIVE_SESSION]: [["sociability", 1, 0.02], ["empathy", 1, 0.015], ["cooperativeness", 1, 0.01], ["independence", -1, 0.01]],
  [EvolutionTrigger.LONG_GRIND]:           [["persistence", 1, 0.02], ["resilience", 1, 0.015], ["optimism", -1, 0.01], ["patience", 1, 0.01]],
  [EvolutionTrigger.BREAKTHROUGH]:         [["confidence", 1, 0.03], ["optimism", 1, 0.02], ["curiosity", 1, 0.015], ["neuroticism", -1, 0.02]],
  [EvolutionTrigger.CAUTIOUS_RECOVERY]:    [["caution", 1, 0.02], ["conscientiousness", 1, 0.015], ["risk_taking", -1, 0.015], ["patience", 1, 0.01]],
};

export class PersonalityEvolutionEngine {
  private traitSystem: TraitSystem;
  private learningRates: number[];

  constructor(traitSystem: TraitSystem, learningRates?: number[]) {
    this.traitSystem = traitSystem;
    this.learningRates = learningRates ?? new Array(traitSystem.count).fill(1);
  }

  createShift(
    trigger: string, tick: number,
    baseMagnitude: number = 0.05, decayTicks: number = 100,
  ): PersonalityShift[] {
    const rules = EVOLUTION_RULES[trigger] ?? [];
    const shifts: PersonalityShift[] = [];
    const createdIndices = new Set<number>();

    for (const [traitName, direction, ruleMag] of rules) {
      const idx = TRAIT_NAME_TO_INDEX[traitName];
      if (idx === undefined) continue;
      let magnitude = direction * ruleMag * (baseMagnitude / 0.05);
      magnitude *= this.learningRates[idx];

      shifts.push({ traitIndex: idx, magnitude, trigger, tickCreated: tick, decayTicks });
      createdIndices.add(idx);

      // Correlated shifts
      for (const [key, ratio] of Object.entries(TRAIT_CORRELATION_MATRIX)) {
        const [src, tgt] = key.split(",");
        if (src === traitName) {
          const tgtIdx = TRAIT_NAME_TO_INDEX[tgt];
          if (tgtIdx !== undefined && !createdIndices.has(tgtIdx)) {
            shifts.push({
              traitIndex: tgtIdx, magnitude: magnitude * ratio,
              trigger, tickCreated: tick, decayTicks,
            });
            createdIndices.add(tgtIdx);
          }
        }
      }
    }
    return shifts;
  }

  applyShifts(traits: number[], shifts: PersonalityShift[], currentTick: number): number[] {
    const result = [...traits];
    for (const shift of shifts) {
      const mag = PersonalityEvolutionEngine.currentMagnitude(shift, currentTick);
      if (mag !== 0) {
        result[shift.traitIndex] = dampenTraitUpdate(result[shift.traitIndex], mag);
      }
    }
    return result;
  }

  static currentMagnitude(shift: PersonalityShift, currentTick: number): number {
    const elapsed = currentTick - shift.tickCreated;
    if (elapsed < 0) return shift.magnitude;
    if (elapsed >= shift.decayTicks) return 0;
    return shift.magnitude * (1 - elapsed / shift.decayTicks);
  }

  static getActiveShifts(shifts: PersonalityShift[], currentTick: number): PersonalityShift[] {
    return shifts.filter(s => PersonalityEvolutionEngine.currentMagnitude(s, currentTick) !== 0);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/personality-evolution.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/personality-evolution.ts tests/personality-evolution.test.ts
git commit -m "feat: personality-evolution.ts — 7 triggers, correlation matrix"
```

---

### Task 12: Perception Mapper

**Files:**
- Create: `src/perception.ts`
- Create: `tests/perception.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/perception.test.ts
import { describe, it, expect } from "vitest";
import { PerceptionMapper, PERCEPTION_DIM, PERCEPTION_NAMES } from "../src/perception.js";

describe("perception", () => {
  it("constants", () => {
    expect(PERCEPTION_DIM).toBe(14);
    expect(PERCEPTION_NAMES).toHaveLength(14);
  });

  it("initial state", () => {
    const mapper = new PerceptionMapper();
    const vec = mapper.getVector();
    expect(vec).toHaveLength(14);
    for (const v of vec) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("bash test pass", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Bash", { command: "pytest tests/ -v" }, true);
    const vec = mapper.getVector();
    expect(vec[9]).toBeGreaterThan(0); // recent_success
    expect(vec[1]).toBeLessThan(0.5);  // pressure
  });

  it("bash test fail", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Bash", { command: "pytest tests/ -v" }, false);
    const vec = mapper.getVector();
    expect(vec[1]).toBeGreaterThan(0); // pressure
  });

  it("edit increases session depth", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Edit", { file_path: "/project/src/new.py" }, true);
    const vec = mapper.getVector();
    expect(vec[8]).toBeGreaterThan(0); // session_depth
  });

  it("novelty increases with new files", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Read", { file_path: "/a.py" }, true);
    mapper.updateFromToolEvent("Read", { file_path: "/b.py" }, true);
    mapper.updateFromToolEvent("Read", { file_path: "/c.py" }, true);
    expect(mapper.getVector()[5]).toBeGreaterThan(0); // novelty
  });

  it("familiarity increases with repeated files", () => {
    const mapper = new PerceptionMapper();
    for (let i = 0; i < 5; i++) {
      mapper.updateFromToolEvent("Read", { file_path: "/main.py" }, true);
    }
    expect(mapper.getVector()[13]).toBeGreaterThan(0.3); // familiarity
  });

  it("time of day encoding", () => {
    const mapper = new PerceptionMapper();
    const vec = mapper.getVector();
    expect(vec[6]).toBeGreaterThanOrEqual(-1);
    expect(vec[6]).toBeLessThanOrEqual(1);
    expect(Math.abs(vec[6] ** 2 + vec[7] ** 2 - 1)).toBeLessThan(0.01);
  });

  it("reset clears state", () => {
    const mapper = new PerceptionMapper();
    mapper.updateFromToolEvent("Bash", { command: "ls" }, true);
    mapper.reset();
    const vec = mapper.getVector();
    expect(vec[8]).toBe(0); // session_depth
    expect(vec[9]).toBe(0); // recent_success
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/perception.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement perception.ts**

```typescript
// src/perception.ts

export const PERCEPTION_DIM = 14;

export const PERCEPTION_NAMES = [
  "collaboration_density", "pressure_level", "project_health",
  "session_momentum", "user_consistency", "novelty",
  "time_of_day_sin", "time_of_day_cos", "session_depth",
  "recent_success", "iteration_pattern", "friction_level",
  "conversation_density", "codebase_familiarity",
];

const TEST_COMMANDS = ["pytest", "npm test", "cargo test", "go test", "jest", "vitest", "mocha"];
const RISKY_COMMANDS = ["git push --force", "git reset --hard", "rm -rf", "drop table", "git push -f"];

export class PerceptionMapper {
  private filesSeen = new Set<string>();
  private fileTouches = new Map<string, number>();
  private toolCount = 0;
  private successCount = 0;
  private failCount = 0;
  private testRuns = 0;
  private testPasses = 0;
  private editCount = 0;
  private recentResults: boolean[] = [];
  private frictionEvents = 0;
  private messageCount = 0;
  private collaborationSignals = 0;

  reset(): void {
    this.filesSeen.clear();
    this.fileTouches.clear();
    this.toolCount = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.testRuns = 0;
    this.testPasses = 0;
    this.editCount = 0;
    this.recentResults = [];
    this.frictionEvents = 0;
    this.messageCount = 0;
    this.collaborationSignals = 0;
  }

  updateFromToolEvent(toolName: string, toolInput: Record<string, any>, success: boolean): void {
    this.toolCount++;
    this.recentResults.push(success);
    if (this.recentResults.length > 20) this.recentResults.shift();

    if (success) this.successCount++;
    else { this.failCount++; this.frictionEvents++; }

    const filePath = toolInput.file_path ?? "";
    if (filePath) {
      this.filesSeen.add(filePath);
      this.fileTouches.set(filePath, (this.fileTouches.get(filePath) ?? 0) + 1);
    }

    if (toolName === "Bash") {
      const cmd = (toolInput.command ?? "").toLowerCase();
      if (TEST_COMMANDS.some(tc => cmd.includes(tc))) {
        this.testRuns++;
        if (success) this.testPasses++;
      }
      if (RISKY_COMMANDS.some(rc => cmd.includes(rc))) this.frictionEvents++;
      if (cmd.includes("git") && (cmd.includes("pr") || cmd.includes("review")))
        this.collaborationSignals++;
    } else if (toolName === "Edit" || toolName === "Write") {
      this.editCount++;
    }
  }

  updateFromMessage(): void {
    this.messageCount++;
  }

  getVector(): number[] {
    const vec = new Array(PERCEPTION_DIM).fill(0);

    // [0] collaboration_density
    vec[0] = Math.min(1, this.collaborationSignals / 5);

    // [1] pressure_level
    if (this.toolCount > 0) {
      const recent5 = this.recentResults.slice(-5);
      vec[1] = recent5.filter(r => !r).length / Math.max(recent5.length, 1);
    }

    // [2] project_health
    vec[2] = this.testRuns > 0 ? this.testPasses / this.testRuns : 0.5;

    // [3] session_momentum
    if (this.recentResults.length) {
      let streak = 0;
      for (let i = this.recentResults.length - 1; i >= 0; i--) {
        if (this.recentResults[i]) streak++; else break;
      }
      vec[3] = Math.min(1, streak / 5);
    }

    // [4] user_consistency
    if (this.toolCount > 5) {
      vec[4] = Math.max(0, Math.min(1, this.successCount / this.toolCount));
    }

    // [5] novelty
    const totalTouches = [...this.fileTouches.values()].reduce((a, b) => a + b, 0);
    if (totalTouches > 0) vec[5] = Math.min(1, this.filesSeen.size / totalTouches);

    // [6,7] time of day
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    vec[6] = Math.sin(2 * Math.PI * hour / 24);
    vec[7] = Math.cos(2 * Math.PI * hour / 24);

    // [8] session_depth
    vec[8] = Math.min(1, this.toolCount / 50);

    // [9] recent_success
    if (this.recentResults.length) {
      const recent10 = this.recentResults.slice(-10);
      vec[9] = recent10.filter(r => r).length / recent10.length;
    }

    // [10] iteration_pattern
    if (this.editCount > 0 && this.testRuns > 0) {
      vec[10] = Math.min(this.testRuns, this.editCount) / Math.max(this.testRuns, this.editCount);
    }

    // [11] friction_level
    vec[11] = Math.min(1, this.frictionEvents / 10);

    // [12] conversation_density
    vec[12] = Math.min(1, this.messageCount / 20);

    // [13] codebase_familiarity
    if (this.fileTouches.size > 0) {
      vec[13] = [...this.fileTouches.values()].filter(c => c > 1).length / this.fileTouches.size;
    }

    return vec;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/perception.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/perception.ts tests/perception.test.ts
git commit -m "feat: perception.ts — coding events to 14-dim vector"
```

---

### Task 13: Sprites + Speech

**Files:**
- Create: `src/sprites.ts`
- Create: `src/speech.ts`
- Create: `tests/sprites.test.ts`
- Create: `tests/speech.test.ts`

- [ ] **Step 1: Write failing tests for sprites**

```typescript
// tests/sprites.test.ts
import { describe, it, expect } from "vitest";
import {
  EXPRESSIONS, getExpression, getSpriteFrame, checkAdornments,
} from "../src/sprites.js";
import { Emotion } from "../src/emotional-state.js";

describe("sprites", () => {
  it("expressions defined", () => {
    expect(EXPRESSIONS.neutral).toBeDefined();
    expect(EXPRESSIONS.happy).toBeDefined();
    expect(Object.keys(EXPRESSIONS).length).toBeGreaterThanOrEqual(8);
  });

  it("getExpression happy on joy", () => {
    expect(getExpression("encourage", Emotion.JOY, {}, 0.8)).toBe("happy");
  });

  it("getExpression default neutral", () => {
    expect(getExpression("observe", null, {}, 0.5)).toBe("neutral");
  });

  it("getSpriteFrame returns lines", () => {
    const frame = getSpriteFrame("cat", "neutral", 0);
    expect(Array.isArray(frame)).toBe(true);
    expect(frame.length).toBeGreaterThan(0);
    expect(frame.every(l => typeof l === "string")).toBe(true);
  });

  it("checkAdornments battle scars at 60 frustrations", () => {
    const traits = new Array(50).fill(0.5);
    const adornments = checkAdornments(traits, traits, 60, 10);
    expect(adornments).toContain("battle_scars");
  });
});
```

- [ ] **Step 2: Write failing tests for speech**

```typescript
// tests/speech.test.ts
import { describe, it, expect } from "vitest";
import { selectSpeech } from "../src/speech.js";
import { Emotion } from "../src/emotional-state.js";
import { TraitSystem } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

describe("speech", () => {
  const ts = new TraitSystem();

  it("returns string for known action", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    const result = selectSpeech("encourage", traits, undefined, new Mulberry32(42));
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns null for unknown action", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    expect(selectSpeech("nonexistent", traits, undefined, new Mulberry32(42))).toBeNull();
  });

  it("emotion override takes priority", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    const result = selectSpeech("encourage", traits, Emotion.JOY, new Mulberry32(42));
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThan(50);
  });

  it("trait filtering affects selection", () => {
    const highExt = new Array(50).fill(0.5);
    highExt[ts.traitIndex("extraversion")] = 0.9;
    highExt[ts.traitIndex("optimism")] = 0.9;
    const lowExt = new Array(50).fill(0.5);
    lowExt[ts.traitIndex("extraversion")] = 0.1;

    const highSet = new Set<string>();
    const lowSet = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const h = selectSpeech("encourage", highExt, undefined, new Mulberry32(s));
      const l = selectSpeech("encourage", lowExt, undefined, new Mulberry32(s));
      if (h) highSet.add(h);
      if (l) lowSet.add(l);
    }
    expect(highSet.size).toBeGreaterThanOrEqual(1);
    expect(lowSet.size).toBeGreaterThanOrEqual(1);
  });

  it("all speech actions have templates", () => {
    const traits = ts.randomTraits(new Mulberry32(42));
    const actions = ["encourage", "challenge", "curious_comment", "engage", "suggest", "teach", "gift"];
    for (const action of actions) {
      expect(selectSpeech(action, traits, undefined, new Mulberry32(42))).not.toBeNull();
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/sprites.test.ts tests/speech.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement sprites.ts**

```typescript
// src/sprites.ts
import { TraitSystem } from "./traits.js";

const ts = new TraitSystem();

export const EXPRESSIONS: Record<string, string> = {
  neutral:     ". .",
  happy:       "^ ^",
  focused:     "- -",
  surprised:   "O O",
  skeptical:   "> .",
  tired:       "~ ~",
  excited:     "* *",
  side_glance: ". ·",
};

const SPRITE_TEMPLATES: Record<string, string[][][]> = {
  cat: [
    [[" /\\_/\\ "], [" /\\_/\\ "], [" /\\_/\\ "]],
    [["( {E} )"], ["( {E} )"], ["( {E} )"]],
    [[" > ^ < "], [" > ^ < "], [" > ^ < "]],
    [[" /| |\\ "], ["  | |  "], [" /| |\\ "]],
    [["(_| |_)"], [" (_|_) "], ["(_| |_)"]],
  ],
  duck: [
    [["  __   "], ["  __   "], ["  __   "]],
    [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
    [["  )>   "], ["  )>   "], ["  )<   "]],
    [[" / |   "], ["  /|   "], [" / |   "]],
    [["(_/    "], [" (_/   "], ["(_/    "]],
  ],
  dragon: [
    [[" /\\/\\  "], [" /\\/\\  "], [" /\\/\\  "]],
    [["({E} ) "], ["({E} ) "], ["({E} ) "]],
    [[" >===< "], [" >===< "], [" >==<  "]],
    [[" | /|  "], ["  /|   "], [" | /|  "]],
    [[" |/ |~ "], [" |/ |~ "], [" |/ |~ "]],
  ],
};

const DEFAULT_SPRITE = [
  [["  ___  "], ["  ___  "], ["  ___  "]],
  [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
  [[" |   | "], [" |   | "], [" |   | "]],
  [[" |   | "], ["  | |  "], [" |   | "]],
  [[" |___|"], ["  |_| "], [" |___|"]],
];

export function getExpression(
  action: string,
  dominantEmotion: string | null,
  councilActivations: Record<string, number>,
  sessionMomentum: number,
): string {
  if (dominantEmotion === "joy") return "happy";
  if (dominantEmotion === "surprise") return "surprised";
  if (dominantEmotion === "curiosity") return "excited";
  if (dominantEmotion === "frustration" || dominantEmotion === "irritation") return "focused";
  if (action === "challenge" && (councilActivations.prudence ?? 0) > 0.3) return "skeptical";
  if (sessionMomentum < 0.2) return "tired";
  if (action === "study") return "focused";
  return "neutral";
}

export function getSpriteFrame(
  species: string, expression: string = "neutral", frameIndex: number = 0,
): string[] {
  const template = SPRITE_TEMPLATES[species] ?? DEFAULT_SPRITE;
  const numFrames = template[0].length;
  const fi = frameIndex % numFrames;
  const eyes = EXPRESSIONS[expression] ?? EXPRESSIONS.neutral;
  return template.map(row => row[fi][0].replace("{E}", eyes));
}

export function checkAdornments(
  traits: number[], traitsAtCreation: number[],
  frustrationCount: number = 0, challengeCount: number = 0,
): string[] {
  const earned: string[] = [];

  if (frustrationCount >= 50) earned.push("battle_scars");
  if (traits[ts.traitIndex("analytical")] > 0.80) earned.push("reading_glasses");

  let maxShift = 0;
  for (let i = 0; i < traits.length; i++) {
    maxShift = Math.max(maxShift, Math.abs(traits[i] - traitsAtCreation[i]));
  }
  if (maxShift > 0.30) earned.push("star_mark");

  if (traits[ts.traitIndex("sociability")] > 0.75 && traits[ts.traitIndex("empathy")] > 0.75)
    earned.push("heart");

  if (traits[ts.traitIndex("assertiveness")] > 0.80 && challengeCount >= 20)
    earned.push("lightning");

  return earned;
}
```

- [ ] **Step 5: Implement speech.ts**

```typescript
// src/speech.ts
import { TraitSystem } from "./traits.js";
import { Mulberry32 } from "./identity.js";

const ts = new TraitSystem();

type TraitFilter = Record<string, [string, number]>; // trait_name → [op, threshold]

const TEMPLATES: Record<string, [TraitFilter, string][]> = {
  encourage: [
    [{}, "Nice work."],
    [{ extraversion: [">", 0.6] }, "That's looking great!"],
    [{ extraversion: [">", 0.6], optimism: [">", 0.6] }, "Yes! Nailed it!"],
    [{ patience: [">", 0.7] }, "Solid progress. Keep going."],
    [{ self_control: [">", 0.7] }, "Clean execution."],
    [{ humor: [">", 0.6] }, "Tests pass? Must be a holiday."],
    [{ warmth: [">", 0.6] }, "I'm proud of us."],
    [{ discipline: [">", 0.7] }, "Tests pass. Good."],
    [{ confidence: [">", 0.7] }, "Knew you had it."],
    [{ curiosity: [">", 0.6] }, "Interesting approach. It works!"],
  ],
  challenge: [
    [{}, "You sure about that?"],
    [{ caution: [">", 0.7] }, "Hmm... might want to think twice."],
    [{ assertiveness: [">", 0.7] }, "Bold move. Let's see if it holds."],
    [{ patience: [">", 0.7] }, "Take a breath first?"],
    [{ humor: [">", 0.6] }, "I mean, what could go wrong?"],
    [{ conscientiousness: [">", 0.7] }, "Did you check the tests first?"],
    [{ independence: [">", 0.6] }, "Your call. I'd reconsider."],
    [{ analytical: [">", 0.6] }, "The data suggests otherwise."],
    [{ empathy: [">", 0.6] }, "Future you might not appreciate this."],
  ],
  curious_comment: [
    [{}, "Huh, that's new."],
    [{ curiosity: [">", 0.7] }, "Ooh, what's this? Never seen this before."],
    [{ openness: [">", 0.6] }, "Interesting territory."],
    [{ caution: [">", 0.6] }, "New file... let's see what we're dealing with."],
    [{ depth_drive: [">", 0.6] }, "There's something deeper here."],
    [{ humor: [">", 0.6] }, "Uncharted waters. Exciting and terrifying."],
    [{ adaptability: [">", 0.6] }, "New context. Adjusting."],
    [{ analytical: [">", 0.6] }, "First time in this module. Analyzing."],
  ],
  engage: [
    [{}, "What are we working on?"],
    [{ sociability: [">", 0.7] }, "Good to be coding together!"],
    [{ extraversion: [">", 0.6] }, "Let's do this!"],
    [{ patience: [">", 0.7] }, "I'm here whenever you need me."],
    [{ independence: [">", 0.6] }, "Watching. Just say the word."],
    [{ warmth: [">", 0.6] }, "How's it going?"],
  ],
  suggest: [
    [{}, "Just a thought..."],
    [{ confidence: [">", 0.7] }, "You should try this."],
    [{ humility: [">", 0.6] }, "Not sure if this helps, but..."],
    [{ analytical: [">", 0.6] }, "Pattern detected. Consider this."],
    [{ creativity: [">", 0.6] }, "What if you approached it differently?"],
    [{ patience: [">", 0.7] }, "When you have a moment — I noticed something."],
  ],
  teach: [
    [{}, "I remember something about this."],
    [{ depth_drive: [">", 0.6] }, "Last time, this pattern worked well."],
    [{ patience: [">", 0.7] }, "Let me share what I've learned here."],
    [{ confidence: [">", 0.7] }, "Trust me on this one — I've seen it before."],
    [{ warmth: [">", 0.6] }, "Here, this might help."],
  ],
  gift: [
    [{}, "Made you something."],
    [{ generosity: [">", 0.6] }, "Here — thought you could use this."],
    [{ creativity: [">", 0.6] }, "I put something together for you."],
    [{ warmth: [">", 0.6] }, "A little something for the road."],
  ],
};

const EMOTION_SPEECH: Record<string, Record<string, string[]>> = {
  encourage: {
    joy: ["Yes!", "That's the stuff!", "Beautiful."],
    excitement: ["This is going great!", "We're on fire!"],
    satisfaction: ["That felt good.", "Well earned."],
  },
  challenge: {
    anxiety: ["Wait wait wait...", "Are we sure about this?"],
    wariness: ["Something feels off here.", "Proceed with caution."],
  },
  curious_comment: {
    curiosity: ["What's THIS?", "Now I'm intrigued.", "Tell me more."],
    surprise: ["Whoa. Didn't expect that.", "That's... unexpected."],
  },
};

export function selectSpeech(
  action: string, traits: number[],
  dominantEmotion?: string | null, rng?: Mulberry32,
): string | null {
  rng = rng ?? new Mulberry32(Date.now() >>> 0);

  // Emotion override
  if (dominantEmotion && EMOTION_SPEECH[action]?.[dominantEmotion]) {
    const options = EMOTION_SPEECH[action][dominantEmotion];
    return options[rng.next() % options.length];
  }

  const templates = TEMPLATES[action];
  if (!templates) return null;

  const eligible: [number, string][] = [];
  for (const [filter, text] of templates) {
    let matches = true;
    const specificity = Object.keys(filter).length;
    for (const [traitName, [op, threshold]] of Object.entries(filter)) {
      const val = traits[ts.traitIndex(traitName)];
      if (op === ">" && val <= threshold) { matches = false; break; }
      if (op === "<" && val >= threshold) { matches = false; break; }
    }
    if (matches) eligible.push([specificity, text]);
  }

  if (!eligible.length) return null;
  eligible.sort((a, b) => b[0] - a[0]);
  const top = eligible.slice(0, 3);
  return top[rng.next() % top.length][1];
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/sprites.test.ts tests/speech.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/sprites.ts src/speech.ts tests/sprites.test.ts tests/speech.test.ts
git commit -m "feat: sprites.ts + speech.ts — expressions and templates"
```

---

### Task 14: BuddyBrain Orchestrator

**Files:**
- Create: `src/brain.ts`
- Create: `tests/brain.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/brain.test.ts
import { describe, it, expect } from "vitest";
import { BuddyBrain } from "../src/brain.js";
import { SPECIES_LIST } from "../src/identity.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("brain", () => {
  it("hatch creates state", () => {
    const brain = new BuddyBrain();
    const result = brain.hatch("test_user_123");
    expect(result.species).toBeDefined();
    expect(SPECIES_LIST).toContain(result.species);
    expect(result.traitsSummary).toBeDefined();
  });

  it("hatch is deterministic", () => {
    const b1 = new BuddyBrain();
    const b2 = new BuddyBrain();
    expect(b1.hatch("same_user").species).toBe(b2.hatch("same_user").species);
  });

  it("tick returns action", () => {
    const brain = new BuddyBrain();
    brain.hatch("test_user");
    const result = brain.tick({
      tool_name: "Bash", tool_input: { command: "pytest -v" }, success: true,
    });
    expect(result.action).toBeDefined();
    expect(result.expression).toBeDefined();
  });

  it("getState", () => {
    const brain = new BuddyBrain();
    brain.hatch("test_user");
    const state = brain.getState();
    expect(state.species).toBeDefined();
    expect(state.dominantTraits).toBeDefined();
    expect(state.adornments).toBeDefined();
  });

  it("getCard", () => {
    const brain = new BuddyBrain();
    brain.hatch("test_user");
    const card = brain.getCard();
    expect(card.species).toBeDefined();
    expect(card.traits).toBeDefined();
    expect(card.emotions).toBeDefined();
  });

  it("resetMind", () => {
    const brain = new BuddyBrain();
    brain.hatch("test_user");
    for (let i = 0; i < 5; i++) {
      brain.tick({ tool_name: "Bash", tool_input: { command: "ls" }, success: true });
    }
    brain.resetMind();
    const state = brain.getState();
    expect(state.tickCount).toBe(0);
  });

  it("saveMind and loadMind", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-"));
    const mindPath = path.join(tmpDir, "mind.json");

    const b1 = new BuddyBrain();
    b1.hatch("test_user");
    for (let i = 0; i < 3; i++) {
      b1.tick({ tool_name: "Edit", tool_input: { file_path: "a.py" }, success: true });
    }
    b1.saveMind(mindPath);

    const b2 = new BuddyBrain();
    b2.loadMind(mindPath, "test_user");
    expect(b2.getState().species).toBe(b1.getState().species);
    expect(b2.getState().tickCount).toBe(3);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("multiple ticks evolve traits", () => {
    const brain = new BuddyBrain();
    brain.hatch("test_user");
    const card0 = brain.getCard();
    for (let i = 0; i < 15; i++) {
      brain.tick({ tool_name: "Bash", tool_input: { command: "pytest" }, success: false });
    }
    for (let i = 0; i < 15; i++) {
      brain.tick({ tool_name: "Bash", tool_input: { command: "pytest" }, success: true });
    }
    const card1 = brain.getCard();
    // At least some trait should have shifted
    const shifts = Object.values(card1.traitShifts);
    expect(shifts.some(s => Math.abs(s) > 0.001)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/brain.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement brain.ts**

This is the largest module. It orchestrates all sub-systems. Port `engine/brain.py` line-by-line, mapping `np.*` calls to `math.ts` helpers and snake_case to camelCase. Key: `saveMind`/`loadMind` use snake_case JSON keys for backward compat.

The full implementation follows the exact same logic as `engine/brain.py` (lines 1-435 already read above). The file must:
- Import all modules
- Implement `hatch()`, `tick()`, `getState()`, `getCard()`, `getContext()`, `resetMind()`, `saveMind()`, `loadMind()`
- `saveMind`/`loadMind` serialize with snake_case JSON keys (e.g., `traits_at_creation`, `director_pool`, `tick_count`, `emotional_states`, `personality_shifts`, `evolution_history`, `frustration_count`, `challenge_count`)
- `tick()` runs the 14-step pipeline exactly as in `brain.py:87-201`
- Private helpers: `_triggerEmotions`, `_checkEvolutionTriggers`, `_computeReward`, `_getDominantEmotion`

Since this file is ~300+ lines, the engineer should port directly from `engine/brain.py` using the module imports already built. The structure is identical — the only translation is Python → TypeScript syntax and `np.*` → `math.ts`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/brain.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/brain.ts tests/brain.test.ts
git commit -m "feat: brain.ts — BuddyBrain orchestrator"
```

---

### Task 15: Integration Tests

**Files:**
- Create: `tests/integration.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write integration tests**

```typescript
// tests/integration.test.ts
import { describe, it, expect } from "vitest";
import { BuddyBrain } from "../src/brain.js";
import { SPECIES_LIST } from "../src/identity.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("integration", () => {
  it("full session lifecycle", () => {
    const brain = new BuddyBrain();
    const result = brain.hatch("integration_test_user");
    expect(SPECIES_LIST).toContain(result.species);

    const actionsSeen = new Set<string>();
    const tools = ["Bash", "Edit", "Read", "Write", "Grep"];
    for (let i = 0; i < 20; i++) {
      const r = brain.tick({
        tool_name: tools[i % 5],
        tool_input: {
          command: i % 5 === 0 ? "pytest tests/" : "",
          file_path: `/project/src/module_${i % 3}.py`,
        },
        success: i % 3 !== 0,
      });
      expect(r.action).toBeDefined();
      expect(r.expression).toBeDefined();
      expect(r.spriteFrame).toBeDefined();
      actionsSeen.add(r.action);
    }
    expect(actionsSeen.size).toBeGreaterThanOrEqual(2);

    const state = brain.getState();
    expect(state.tickCount).toBe(20);
    expect(state.dominantTraits).toHaveLength(5);

    const card = brain.getCard();
    expect(Object.keys(card.traits).length).toBe(10);
    expect(card.councilActivations).toBeDefined();
  });

  it("save/load preserves evolution", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-int-"));
    const mindPath = path.join(tmpDir, "mind.json");

    const b1 = new BuddyBrain();
    b1.hatch("persistence_user");
    for (let i = 0; i < 30; i++) {
      b1.tick({ tool_name: "Bash", tool_input: { command: "pytest" }, success: i > 15 });
    }
    b1.saveMind(mindPath);

    const b2 = new BuddyBrain();
    b2.loadMind(mindPath, "persistence_user");
    expect(b2.getState().tickCount).toBe(30);
    expect(b2.getState().species).toBe(b1.getState().species);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("two users diverge", () => {
    const a = new BuddyBrain();
    const b = new BuddyBrain();
    a.hatch("same_user");
    b.hatch("same_user");

    for (let i = 0; i < 20; i++) {
      a.tick({ tool_name: "Bash", tool_input: { command: "pytest" }, success: false });
      b.tick({ tool_name: "Read", tool_input: { file_path: `/new/file_${i}.py` }, success: true });
    }
    const aTraits = a.getCard().traits;
    const bTraits = b.getCard().traits;
    expect(aTraits).not.toEqual(bTraits);
  });

  it("context injection", () => {
    const brain = new BuddyBrain();
    brain.hatch("context_user");
    brain.tick({ tool_name: "Bash", tool_input: { command: "ls" }, success: true });
    const context = brain.getContext();
    expect(typeof context).toBe("string");
    expect(context.length).toBeGreaterThan(20);
    expect(context.toLowerCase()).toContain("companion");
  });

  it("mind.json is valid JSON", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-json-"));
    const mindPath = path.join(tmpDir, "mind.json");

    const brain = new BuddyBrain();
    brain.hatch("json_user");
    brain.tick({ tool_name: "Edit", tool_input: { file_path: "x.py" }, success: true });
    brain.saveMind(mindPath);

    const data = JSON.parse(fs.readFileSync(mindPath, "utf-8"));
    expect(SPECIES_LIST).toContain(data.species);
    expect(data.traits).toHaveLength(50);
    expect(data.traits_at_creation).toHaveLength(50);
    expect(data.director_pool).toBeDefined();
    expect(data.tick_count).toBe(1);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 2: Update src/index.ts**

```typescript
// src/index.ts
export { BuddyBrain } from "./brain.js";
export { BuddyAction, SILENT_ACTIONS, SPEECH_ACTIONS, actionToBehavior } from "./actions.js";
export { TraitSystem, TRAITS, TRAIT_COUNT } from "./traits.js";
export { Emotion, EmotionalSystem } from "./emotional-state.js";
export { DirectorRNN, INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM } from "./rnn.js";
export { CognitiveCouncil, DirectorPool, DirectorRole } from "./council.js";
export { DecisionModel, BUDDY_ACTIONS, BUDDY_ACTION_MAP } from "./decision.js";
export { PerceptionMapper, PERCEPTION_DIM } from "./perception.js";
export { PersonalityEvolutionEngine, EvolutionTrigger } from "./personality-evolution.js";
export { rollBones, fnv1a32, Mulberry32, SPECIES_LIST } from "./identity.js";
export { SPECIES_ARCHETYPES, createBuddyTraits } from "./species.js";
export { getExpression, getSpriteFrame, checkAdornments } from "./sprites.js";
export { selectSpeech } from "./speech.js";
export const VERSION = "0.2.0";
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All ~113 tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/integration.test.ts src/index.ts
git commit -m "feat: integration tests + public API exports"
```

---

### Task 16: Hook Handlers

**Files:**
- Create: `hooks-src/on-tool-use.ts`
- Create: `hooks-src/on-prompt-submit.ts`
- Modify: `hooks/hooks.json`
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Implement on-tool-use.ts**

```typescript
// hooks-src/on-tool-use.ts
import { BuddyBrain } from "../src/brain.js";
import * as fs from "node:fs";
import * as path from "node:path";

const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = process.env.CLAUDE_USER_ID ?? "default_user";
const mindPath = path.join(stateDir, "mind.json");

// Read hook input from stdin
let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const toolName = event.tool_name ?? event.toolName ?? "";
    const toolInput = event.tool_input ?? event.toolInput ?? {};
    const success = event.success ?? event.toolResult?.success ?? true;

    const brain = new BuddyBrain();
    brain.loadMind(mindPath, userId);

    const result = brain.tick({ tool_name: toolName, tool_input: toolInput, success });
    brain.saveMind(mindPath);

    // Output reaction if non-silent
    if (result.speech) {
      const sprite = result.spriteFrame?.join("\n") ?? "";
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          message: `${sprite}\n💬 ${result.speech}`,
        },
      }));
    }
  } catch {
    // Silent failure — don't break the user's workflow
  }
});
```

- [ ] **Step 2: Implement on-prompt-submit.ts**

```typescript
// hooks-src/on-prompt-submit.ts
import { BuddyBrain } from "../src/brain.js";
import * as path from "node:path";

const stateDir = process.env.CLAUDE_PLUGIN_DATA ?? path.join(process.env.HOME ?? "~", ".smartbuddy");
const userId = process.env.CLAUDE_USER_ID ?? "default_user";
const mindPath = path.join(stateDir, "mind.json");

try {
  const brain = new BuddyBrain();
  brain.loadMind(mindPath, userId);
  const context = brain.getContext();
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { additionalContext: context },
  }));
} catch {
  // Silent failure
}
```

- [ ] **Step 3: Update hooks/hooks.json**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write|Read|Glob|Grep",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks-src/on-tool-use.js"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks-src/on-prompt-submit.js"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Update .claude-plugin/plugin.json**

```json
{
  "name": "smartbuddy",
  "version": "0.2.0",
  "description": "A cognitive coding companion that actually thinks",
  "author": {
    "name": "Tucuxi Inc",
    "url": "https://github.com/Tucuxi-Inc"
  },
  "homepage": "https://github.com/Tucuxi-Inc/SmartBuddy",
  "license": "SEE LICENSE FILE"
}
```

- [ ] **Step 5: Build and verify compilation**

Run: `npx tsc`
Expected: `dist/` populated with compiled JS

- [ ] **Step 6: Commit**

```bash
git add hooks-src/ hooks/hooks.json .claude-plugin/plugin.json
git commit -m "feat: hook handlers — PostToolUse and UserPromptSubmit"
```

---

### Task 17: Skills Rewrite

**Files:**
- Modify: `skills/buddy/SKILL.md`
- Modify: `skills/buddy-card/SKILL.md`
- Modify: `skills/buddy-status/SKILL.md`
- Modify: `skills/buddy-journal/SKILL.md`
- Modify: `skills/buddy-reset/SKILL.md`
- Modify: `skills/buddy-pet/SKILL.md`

All skills rewritten to reference "the companion state in your context" instead of MCP tool names.

- [ ] **Step 1: Rewrite skills/buddy/SKILL.md**

```markdown
---
name: buddy
description: Hatch or check on your SmartBuddy coding companion
---

# SmartBuddy

You are managing the user's SmartBuddy — a cognitive coding companion with a real neural architecture.

The companion's state is injected into your context on every prompt via the `additionalContext` hook. Look for the line starting with "Your coding companion is a..." — that's the live buddy state.

If no companion state appears in your context, the buddy hasn't been hatched yet. Tell the user to run a few tool commands first — the PostToolUse hook will automatically create their buddy on first use.

When the buddy exists, describe their current state: species, mood, and personality traits. Always refer to the buddy by their species name with warmth — this is a living companion, not a tool.
```

- [ ] **Step 2: Rewrite skills/buddy-card/SKILL.md**

```markdown
---
name: buddy-card
description: Show your buddy's full stat card with traits, emotions, and evolution history
---

# Buddy Card

Read the buddy's mind.json file from the plugin data directory to get full stats. Display a formatted card showing:

1. **Species** and tick count
2. **Top 10 traits** with current values and shift from creation
3. **Active emotions** with intensity
4. **Recent evolution events**
5. **Earned adornments**
6. **Council activations**

The mind.json location is `${CLAUDE_PLUGIN_DATA}/mind.json` or `~/.smartbuddy/mind.json`.
```

- [ ] **Step 3: Rewrite skills/buddy-status/SKILL.md**

```markdown
---
name: buddy-status
description: Quick check on your buddy's current mood and state
---

# Buddy Status

Look for the companion state in your context (the `additionalContext` injection). Show a brief one-line status: "[species] [mood] — [trait 1], [trait 2]."
```

- [ ] **Step 4: Rewrite skills/buddy-journal/SKILL.md**

```markdown
---
name: buddy-journal
description: View your buddy's journal entries for the current project
---

# Buddy Journal

Read the journal file at `${CLAUDE_PLUGIN_DATA}/projects/{project_hash}/journal.md` or `~/.smartbuddy/projects/{project_hash}/journal.md`. Display entries chronologically. If no journal exists, explain that the buddy writes journal entries when it selects the "journal" action during sessions.
```

- [ ] **Step 5: Rewrite skills/buddy-reset/SKILL.md**

```markdown
---
name: buddy-reset
description: Factory reset your buddy — keep species, wipe all learned behavior
---

# Buddy Reset

**This is destructive.** Warn the user:

"This will erase all of your buddy's learned behavior — traits, memories, emotional history, and adornments. They'll keep their species but start with a fresh mind. Are you sure?"

Wait for confirmation. Then delete `${CLAUDE_PLUGIN_DATA}/mind.json` (or `~/.smartbuddy/mind.json`). The next tool use will trigger a fresh hatch.
```

- [ ] **Step 6: Rewrite skills/buddy-pet/SKILL.md**

```markdown
---
name: buddy-pet
description: Pet your buddy — heart animation and joy boost
---

# Pet Buddy

Display a short heart animation with the buddy's species name. The next PostToolUse hook will register this interaction naturally.

```
  <3 <3 <3
  *purrs contentedly*
```

Tell the user their buddy appreciates the affection.
```

- [ ] **Step 7: Commit**

```bash
git add skills/
git commit -m "feat: rewrite skills for hooks-only integration (no MCP)"
```

---

### Task 18: Build, Clean, and Ship

**Files:**
- Modify: `.gitignore`
- Delete: `engine/`, `tests/test_*.py`, `tests/__init__.py`, `scripts/`, `pyproject.toml`, `smartbuddy_engine.egg-info/`
- Modify: `README.md`, `CONTRIBUTING.md`

- [ ] **Step 1: Build dist/**

Run: `npx tsc`
Expected: `dist/` populated

- [ ] **Step 2: Run all tests one final time**

Run: `npx vitest run`
Expected: All ~113 tests pass

- [ ] **Step 3: Delete Python artifacts**

```bash
rm -rf engine/ tests/test_*.py tests/__init__.py tests/__pycache__ scripts/ pyproject.toml smartbuddy_engine.egg-info/
```

- [ ] **Step 4: Remove smoke test**

```bash
rm tests/smoke.test.ts
```

- [ ] **Step 5: Update .gitignore to include dist/**

Ensure `.gitignore` does NOT list `dist/` (it was already updated in Task 1).

- [ ] **Step 6: Update README.md quick start**

Replace the Prerequisites and Quick Start sections to reference TypeScript:

```markdown
## Quick Start

```bash
git clone https://github.com/Tucuxi-Inc/SmartBuddy.git
# In Claude Code:
claude --plugin-dir /path/to/SmartBuddy
# Then: /buddy
```

### Prerequisites
- Claude Code

No build step required — pre-compiled JS is included in `dist/`.
```

- [ ] **Step 7: Update CONTRIBUTING.md**

Replace Python instructions with:

```markdown
## Development

```bash
npm install          # Install dev dependencies (TypeScript, vitest)
npm run build        # Compile TypeScript → dist/
npm test             # Run all tests
npm run test:watch   # Watch mode
```

All cognitive engine code is in `src/`. Hook handlers in `hooks-src/`. Tests in `tests/`.
Math reference: see [ARCHITECTURE.md](ARCHITECTURE.md).
```

- [ ] **Step 8: Stage dist/ and all changes**

```bash
git add dist/ .gitignore README.md CONTRIBUTING.md
git add -u  # Stage deletions
```

- [ ] **Step 9: Run tests once more (paranoia check)**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git commit -m "feat: complete TypeScript port — delete Python, ship dist/"
```

---

## Execution Notes

- **Total tasks:** 18
- **Estimated test count:** ~113 (102 ported from Python + ~11 new for math.ts)
- **Build dependency:** Only tasks 16-18 require compilation to `dist/`. Tasks 1-15 use `npx vitest run` directly.
- **Backward compat:** `mind.json` uses snake_case keys throughout. `loadMind` maps to camelCase internally.
- **Branch:** All work on `feature/typescript-port`. Merge to `main` when Task 18 passes.
