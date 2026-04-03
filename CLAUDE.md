# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

SmartBuddy is a Claude Code plugin — a cognitive coding companion with a real neural architecture (50-trait personality, 5 RNN directors, 8-voice council, 12 emotions). Zero runtime dependencies, pure TypeScript. Runs entirely locally via Claude Code hooks.

## Build & Test Commands

```bash
npm install          # Install dev deps (TypeScript, Vitest) — only needed for contributors
npm run build        # tsc: compiles src/ and hooks-src/ to dist/
npm test             # vitest run (~120 tests, <1 second)
npm run test:watch   # vitest in watch mode

# Run a single test file
npx vitest run tests/brain.test.ts

# Run tests matching a pattern
npx vitest run -t "full session lifecycle"
```

After any source changes, run `npm run build` — the pre-compiled `dist/` is committed so end users skip the build step.

## Architecture

### Cognitive Tick Pipeline

Every tool event (Bash, Edit, Write, Read, Glob, Grep) triggers this sequence in `BuddyBrain.tick()`:

1. **Perception** — Map tool event to 14-dim vector (perception.ts)
2. **Emotion triggers** — Generate emotions from coding events (emotional-state.ts)
3. **Emotion decay** — Remove fully-decayed emotions
4. **Personality shifts** — Apply active trait shifts with dampening (personality-evolution.ts)
5. **Evolution triggers** — Fire new shifts from accumulated session patterns
6. **Director RNNs** — 5 RNNs (14→8→6) produce 6-dim behavioral bias (rnn.ts, council.ts)
7. **Council modulation** — 8 voices amplify/dampen traits based on activations (council.ts)
8. **Emotional modifiers** — Active emotions temporarily shift traits
9. **Decision** — Utility model: `U(a) = P_eff^T * W_a * s + b_a`, softmax selection (decision.ts)
10. **REINFORCE learning** — Update RNN weights from outcome signal (+0.5 success, -0.3 failure)
11. **Expression + Speech** — Sprite frame + trait-filtered speech template

### Module Dependency Graph

```
BuddyBrain (brain.ts) — orchestrator, state management, save/load
├── TraitSystem (traits.ts) — 50 traits in [0,1], categories, queries
├── CognitiveCouncil (council.ts) — 8 voices + DirectorPool of 5 RNNs
│   └── DirectorRNN (rnn.ts) — 252-weight genome, tanh activations
├── DecisionModel (decision.ts) — utility computation, 11 actions, softmax
├── EmotionalSystem (emotional-state.ts) — 12 emotions with linear decay
├── PersonalityEvolutionEngine (personality-evolution.ts) — 7 triggers, trait correlations
├── PerceptionMapper (perception.ts) — tool events → 14-dim coding state vector
├── Identity (identity.ts) — FNV-1a hash, Mulberry32 PRNG, species/name generation
├── Species (species.ts) — 18 archetypes with trait biases
├── Speech (speech.ts) — trait-filtered template selection
├── Sprites (sprites.ts) — ASCII art expressions + adornments
└── Actions (actions.ts) — 11 action enum, speech vs silent sets
```

`math.ts` provides pure array math (matmul, dot, outer, sigmoid, tanh, softmax, clip) — no external libraries.

### Claude Code Integration (hooks-src/)

Two hooks registered in `hooks/hooks.json`:

- **on-prompt-submit.ts** (UserPromptSubmit) — Loads mind.json, calls `brain.getContext()`, injects buddy state as `additionalContext` into every prompt
- **on-tool-use.ts** (PostToolUse, matches Bash|Edit|Write|Read|Glob|Grep) — Parses tool event from stdin, calls `brain.tick()`, saves updated mind.json

Both hooks fail silently (no stderr) to avoid breaking Claude Code's hook parsing. Timeout: 5 seconds each.

### State Persistence

- Directory: `~/.smartbuddy/` (or `CLAUDE_PLUGIN_DATA` env var)
- `mind.json` — full cognitive state (traits, RNN weights, emotions, shifts, evolution history)
- JSON keys are **snake_case** for backward compatibility with the Python version, even though TS code uses camelCase internally
- `mind.json` written by the old Python version loads without migration

### Skills (skills/)

Six `/buddy*` commands defined as SKILL.md files. Skills don't call MCP tools — they instruct Claude to format/display buddy state already injected via the `UserPromptSubmit` hook's `additionalContext`.

## Key Conventions

- **File naming**: kebab-case for TS files (e.g., `emotional-state.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BUDDY_ACTION_MAP`, `TRAIT_CORRELATIONS`)
- **Trait values**: always in [0, 1]; hard limits [0.10, 0.90] for evolution
- **RNN genome**: flat 252-element array with fixed layout (see ARCHITECTURE.md § RNN Architecture)
- **Shift magnitudes**: intentionally tiny (0.01–0.03) — personality change is slow
- **Speech templates**: under 60 characters, require at least one plausible trait/emotion combo to trigger
- **Sprite expressions**: 5-line ASCII art, `{E}` marks eye placeholder, driven by cognitive state

## Contribution Boundaries

Open for contribution: sprites/expressions, speech templates, perception mappings, evolution triggers.

Maintained by Tucuxi (not open for external changes): core cognitive engine architecture, species archetypes, identity/hashing system, plugin manifest/hook architecture.

## Reference

- [ARCHITECTURE.md](ARCHITECTURE.md) — full mathematical specification (decision model equations, RNN weight layout, council voice weights, trait taxonomy, perception dimensions, emotion decay, evolution rules)
- [docs/specs/2026-04-02-typescript-port-design.md](docs/specs/2026-04-02-typescript-port-design.md) — TypeScript port design decisions and module mapping
