# SmartBuddy TypeScript Port Design Spec

**Date**: 2026-04-02
**Status**: Draft
**Repo**: https://github.com/Tucuxi-Inc/SmartBuddy
**Branch**: `feature/typescript-port` → merges to `main`
**Predecessor**: Tag `v0.1.0-python` preserves the Python implementation

## Overview

Port the SmartBuddy cognitive engine from Python/NumPy to pure TypeScript. The result is a zero-dependency Claude Code plugin that runs natively in-process — no Python, no MCP sidecar, no external libraries. Users install by pointing Claude Code at the directory. Existing `mind.json` state files load without migration.

## Goals

1. **Zero runtime dependencies** — no numpy, no mcp, no math libraries. Just compiled TypeScript.
2. **Backward-compatible state** — existing `mind.json` files from the Python version load directly.
3. **Simpler install** — drop the Python 3.11+ prerequisite. Only need Claude Code.
4. **Same behavior** — identical cognitive architecture, same 102 test behaviors ported to TS.
5. **Same plugin interface** — skills, commands, and user experience unchanged.

## Architecture

### Branch Strategy

1. Tag current `main` as `v0.1.0-python`
2. Create `feature/typescript-port` from `main`
3. Build TS implementation on the branch
4. Delete Python files (`engine/`, `tests/`, `scripts/`, `pyproject.toml`)
5. Merge to `main` when all tests pass

### File Structure

```
SmartBuddy/
├── .claude-plugin/
│   └── plugin.json              # Updated: no mcpServers section
├── hooks/
│   └── hooks.json               # Updated: references dist/hooks/*.js
├── src/
│   ├── math.ts                  # Array math utilities (~50 lines)
│   ├── traits.ts                # 50-trait system
│   ├── rnn.ts                   # Director RNN 14→8→6
│   ├── council.ts               # 8-voice council + director pool
│   ├── decision.ts              # Utility model with buddy actions
│   ├── emotional-state.ts       # 12 emotions with decay
│   ├── personality-evolution.ts # 7 triggers, correlation matrix
│   ├── perception.ts            # Coding events → 14-dim vector
│   ├── actions.ts               # Action enum + behavior map
│   ├── sprites.ts               # ASCII art + expressions
│   ├── speech.ts                # Trait-filtered templates
│   ├── identity.ts              # FNV-1a + Mulberry32
│   ├── species.ts               # 18 archetypes
│   ├── brain.ts                 # BuddyBrain orchestrator
│   └── index.ts                 # Public API exports
├── hooks-src/
│   ├── on-tool-use.ts           # PostToolUse → cognitive tick
│   └── on-prompt-submit.ts      # UserPromptSubmit → inject context
├── tests/
│   ├── math.test.ts
│   ├── traits.test.ts
│   ├── rnn.test.ts
│   ├── council.test.ts
│   ├── decision.test.ts
│   ├── emotional-state.test.ts
│   ├── personality-evolution.test.ts
│   ├── perception.test.ts
│   ├── brain.test.ts
│   └── integration.test.ts
├── dist/                        # Pre-compiled JS (committed, users skip build)
│   ├── src/
│   └── hooks/
├── skills/                      # Unchanged from Python version
│   ├── buddy/SKILL.md
│   ├── buddy-card/SKILL.md
│   ├── buddy-status/SKILL.md
│   ├── buddy-journal/SKILL.md
│   ├── buddy-reset/SKILL.md
│   └── buddy-pet/SKILL.md
├── docs/                        # Unchanged
│   └── architecture-viz.html
├── package.json
├── tsconfig.json
├── README.md                    # Updated install instructions
├── ARCHITECTURE.md              # Unchanged
├── CONTRIBUTING.md              # Updated for TS
├── LICENSE                      # Unchanged
└── .gitignore                   # Updated for node_modules, etc.
```

### What Gets Deleted

All Python artifacts removed from the repo:
- `engine/*.py` (14 files)
- `tests/test_*.py` (14 files)
- `tests/__init__.py`
- `scripts/*.sh` (4 files)
- `pyproject.toml`
- `smartbuddy_engine.egg-info/`

These are preserved in git history under the `v0.1.0-python` tag.

## Math Layer

### src/math.ts (~50 lines)

Pure TypeScript array math replacing all NumPy operations. Vectors are `number[]`, matrices are `number[][]` (row-major).

Functions:

```typescript
matmul(A: number[][], x: number[]): number[]       // matrix × vector
dot(a: number[], b: number[]): number               // dot product
outer(a: number[], b: number[]): number[][]          // outer product (REINFORCE)
sigmoid(x: number[]): number[]                       // element-wise 1/(1+e^-x)
tanhVec(x: number[]): number[]                       // element-wise tanh
softmax(x: number[], temperature: number): number[]  // numerically stable
clip(x: number[], min: number, max: number): number[] // element-wise clamp
add(a: number[], b: number[]): number[]              // element-wise sum
mul(a: number[], b: number[]): number[]              // element-wise product (Hadamard)
scale(a: number[], s: number): number[]              // scalar multiply
zeros(n: number): number[]                           // zero vector
randn(n: number, rng: Mulberry32, sigma: number): number[] // normal via Box-Muller
```

Largest operation: `matmul` on 14x8 matrix = 112 multiply-adds. No performance concern.

### Random Number Generation

`Mulberry32` from `identity.ts` extended with:
- `nextFloat(): number` — uniform [0, 1)
- `nextGaussian(sigma: number): number` — Box-Muller transform for RNN initialization

No external RNG library needed.

## Module Port Mapping

Each Python module maps 1:1 to a TypeScript module with identical logic:

| Python Module | TS Module | Key Types | Port Notes |
|--------------|-----------|-----------|------------|
| traits.py (288 lines) | traits.ts | `TraitDefinition`, `TraitSystem`, `TRAITS` | Data definitions, straightforward |
| rnn.py (245 lines) | rnn.ts | `DirectorRNN` | Matrix math via math.ts helpers |
| council.py (468 lines) | council.ts | `CognitiveCouncil`, `DirectorPool`, `Director` | Dot products, serialization |
| decision.py (285 lines) | decision.ts | `DecisionModel`, `DecisionResult`, `BUDDY_ACTION_MAP` | Softmax, utility computation |
| emotional_state.py (290 lines) | emotional-state.ts | `Emotion`, `EmotionalState`, `EmotionalSystem` | Enums, decay math |
| personality_evolution.py (339 lines) | personality-evolution.ts | `EvolutionTrigger`, `PersonalityShift`, `PersonalityEvolutionEngine` | Correlation matrix, shifts |
| perception.py (172 lines) | perception.ts | `PerceptionMapper` | Accumulator, simple math |
| actions.py (53 lines) | actions.ts | `BuddyAction`, `SILENT_ACTIONS`, `SPEECH_ACTIONS` | Enum + sets |
| sprites.py (147 lines) | sprites.ts | `getExpression()`, `getSpriteFrame()`, `checkAdornments()` | String manipulation |
| speech.py (149 lines) | speech.ts | `selectSpeech()` | Template selection |
| identity.py (48 lines) | identity.ts | `fnv1a32()`, `Mulberry32`, `Bones`, `rollBones()` | Already near-JS (original Buddy was TS) |
| species.py (44 lines) | species.ts | `SPECIES_ARCHETYPES`, `createBuddyTraits()` | Data definitions |
| brain.py (435 lines) | brain.ts | `BuddyBrain` | Orchestration, state management |
| server.py (119 lines) | *(deleted)* | — | Not needed: engine runs in-process |

### Naming Conventions

Python snake_case → TypeScript camelCase:
- `trait_index()` → `traitIndex()`
- `roll_bones()` → `rollBones()`
- `get_activations()` → `getActivations()`
- `learn_from_outcome()` → `learnFromOutcome()`
- `BUDDY_ACTION_MAP` → `BUDDY_ACTION_MAP` (constants stay UPPER_SNAKE)
- `emotional_state.py` → `emotional-state.ts` (file names use kebab-case)

## Plugin Integration

### hooks/hooks.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write|Read|Glob|Grep",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/on-tool-use.js"
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
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/on-prompt-submit.js"
          }
        ]
      }
    ]
  }
}
```

### .claude-plugin/plugin.json

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

No `mcpServers` section. The hooks reference compiled JS directly.

### Hook Handlers

**on-tool-use.ts**:
1. Read hook event from stdin (tool name, input, success)
2. Load `mind.json` from state directory
3. Instantiate `BuddyBrain`, load state
4. Call `brain.tick()` with the tool event
5. Save updated `mind.json`
6. Output reaction (expression, speech) if non-silent

**on-prompt-submit.ts**:
1. Load `mind.json`
2. Generate `additionalContext` string from current buddy state
3. Output JSON with `hookSpecificOutput.additionalContext`

### State Directory

Same as Python version: `${CLAUDE_PLUGIN_DATA}/` or fallback `~/.smartbuddy/`.

Files:
- `mind.json` — full cognitive state (backward compatible with Python format)
- `soul.json` — LLM-generated name + personality description
- `projects/{hash}/knowledge.json` — per-project memory
- `projects/{hash}/journal.md` — session journal entries

### Skills

All 6 skill files unchanged — they reference MCP tools by name, but since we're removing the MCP server, skills will need minor updates to describe the buddy's capabilities without referencing specific MCP tool names. The skill instructions tell Claude how to interact with the buddy; Claude reads buddy state through the context injection from hooks.

Updated skill approach: The `UserPromptSubmit` hook injects the full buddy state (species, traits, emotions, adornments, card data) into `additionalContext` on every prompt. Skills then instruct Claude to format and display specific views of that injected state. For example, `/buddy card` tells Claude "format the buddy's full stat card from the companion state in your context." No MCP tool calls needed — Claude already has the data. Skills are rewritten to reference "the companion state in your context" instead of MCP tool names.

## State Compatibility

### mind.json Schema (unchanged)

```typescript
interface MindState {
  species: string;
  traits: number[];                    // length 50
  traits_at_creation: number[];        // length 50
  director_pool: {
    director_count: number;
    directors: Record<string, {
      role: string;
      genome: number[];                // length 252
      hidden: number[];                // length 8
      total_runs: number;
      mean_outcome: number;
    }>;
  };
  emotional_states: Array<{
    emotion: string;
    intensity: number;
    valence: number;
    tick_created: number;
    decay_ticks: number;
  }>;
  personality_shifts: Array<{
    trait_index: number;
    magnitude: number;
    trigger: string;
    tick_created: number;
    decay_ticks: number;
  }>;
  evolution_history: Array<{
    trigger: string;
    tick: number;
  }>;
  tick_count: number;
  frustration_count: number;
  challenge_count: number;
}
```

Field names stay snake_case in JSON (matching Python output) even though TypeScript code uses camelCase internally. Serialization/deserialization handles the mapping.

## Build & Distribution

### package.json

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

**Zero runtime dependencies.** Only dev dependencies for building and testing.

### tsconfig.json

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

### Distribution

Pre-compiled JS committed to `dist/` so users don't need a build step. Contributors run `npm run build` after changes.

Users install:
```bash
git clone https://github.com/Tucuxi-Inc/SmartBuddy.git
claude --plugin-dir /path/to/SmartBuddy
```

No `npm install` needed for end users (no runtime deps). Only contributors need `npm install` for TypeScript compiler and vitest.

## Testing

### Framework

Vitest — fast, TypeScript-native, compatible with Jest syntax. Dev dependency only.

### Test Mapping

Each Python test file maps 1:1:

| Python Test | TS Test | Tests |
|------------|---------|-------|
| test_traits.py | traits.test.ts | 10 |
| test_rnn.py | rnn.test.ts | 9 |
| test_council.py | council.test.ts | 11 |
| test_decision.py | decision.test.ts | 8 |
| test_emotional_state.py | emotional-state.test.ts | 7 |
| test_personality_evolution.py | personality-evolution.test.ts | 7 |
| test_perception.py | perception.test.ts | 9 |
| test_actions.py | actions.test.ts | 4 |
| test_sprites.py | sprites.test.ts | 5 |
| test_speech.py | speech.test.ts | 5 |
| test_identity.py | identity.test.ts | 9 |
| test_species.py | species.test.ts | 6 |
| test_brain.py | brain.test.ts | 8 |
| test_integration.py | integration.test.ts | 5 |
| *(new)* | math.test.ts | ~10 |

Plus ~10 new tests for `math.ts`. Target: **~113 tests**.

### Behavioral Equivalence

Key behavioral tests that must produce identical results to the Python version:
- Same userId → same species (FNV-1a + Mulberry32 must match)
- Same trait seeds → same initial traits
- Same perception sequence → same trait evolution direction
- `mind.json` written by Python can be read by TypeScript and produce valid ticks

## README Updates

Quick Start changes to:

```bash
git clone https://github.com/Tucuxi-Inc/SmartBuddy.git
# In Claude Code:
claude --plugin-dir /path/to/SmartBuddy
# Then: /buddy
```

Prerequisites drops Python 3.11+ — only lists Claude Code.

## CONTRIBUTING.md Updates

- Build instructions change to `npm run build` / `npx vitest`
- "TypeScript port" section removed (it's done)
- Contributing new modules is now TypeScript
- Math reference still points to ARCHITECTURE.md
