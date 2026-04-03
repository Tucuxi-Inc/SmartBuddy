# Contributing to SmartBuddy

SmartBuddy is a Claude Code plugin with a real cognitive engine -- 50-trait personality, 5 RNN directors, 8-voice council, and emotions that decay naturally. We welcome contributions that make buddies more expressive, more reactive, and more alive.

This guide covers everything you need to know to contribute effectively. For the full mathematical specification, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Table of Contents

- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [How the Cognitive Tick Works](#how-the-cognitive-tick-works)
- [Hook System](#hook-system)
- [State Persistence](#state-persistence)
- [Contribution Walkthroughs](#contribution-walkthroughs)
  - [Adding a Speech Template](#adding-a-speech-template)
  - [Adding a Sprite Expression](#adding-a-sprite-expression)
  - [Adding an Evolution Trigger](#adding-an-evolution-trigger)
  - [Adding a Perception Mapping](#adding-a-perception-mapping)
- [Debugging](#debugging)
- [Test Strategy](#test-strategy)
- [Future Directions](#future-directions)
- [Maintained by Tucuxi](#maintained-by-tucuxi)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

---

## Development Setup

```bash
git clone -b feature/typescript-port https://github.com/Tucuxi-Inc/SmartBuddy.git
cd SmartBuddy
npm install          # Install dev dependencies (TypeScript, Vitest)
npm run build        # Compile TypeScript to dist/
npm test             # Run all tests (~122 tests, <1 second)
```

**Prerequisites**: Node.js 18+ and [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview). No runtime dependencies to install -- TypeScript and Vitest are the only dev dependencies.

## Development Workflow

The tight loop for development:

```bash
# Terminal 1: Watch mode -- reruns tests on every file change
npm run test:watch

# Terminal 2: After you're happy with tests, rebuild for Claude Code
npm run build
```

**Important**: The pre-compiled `dist/` directory is committed so end users need zero build steps. After making any source changes:

1. Run `npm run build` to recompile
2. Commit the updated `dist/` alongside your source changes
3. Claude Code reads from `dist/`, so your changes won't take effect until you rebuild

### Running Specific Tests

```bash
# Single test file
npx vitest run tests/speech.test.ts

# Tests matching a name pattern
npx vitest run -t "selects template"

# Watch a single file
npx vitest watch tests/sprites.test.ts
```

## Project Structure

```
SmartBuddy/
  src/                        # Core cognitive engine (TypeScript)
    brain.ts                  #   Orchestrator -- ties all systems together
    traits.ts                 #   50-trait personality system
    council.ts                #   8-voice cognitive council + director pool
    rnn.ts                    #   Director RNN (14->8->6, REINFORCE learning)
    decision.ts               #   Utility-based action selection
    emotional-state.ts        #   12 emotions with linear decay
    personality-evolution.ts  #   7 triggers, trait correlations, shift decay
    perception.ts             #   Tool events -> 14-dim perception vector
    speech.ts                 #   Trait-filtered speech template selection
    sprites.ts                #   ASCII art expressions + adornments
    species.ts                #   18 species archetypes with trait biases
    identity.ts               #   FNV-1a hash, Mulberry32 PRNG, name gen
    actions.ts                #   11 actions (speech vs silent)
    math.ts                   #   Pure array math (no external libs)
  hooks-src/                  # Claude Code hook handlers
    on-prompt-submit.ts       #   Injects buddy state into every prompt
    on-tool-use.ts            #   Runs cognitive tick on each tool event
  hooks/
    hooks.json                # Hook registration (which events, timeouts)
  tests/                      # Vitest test suite (mirrors src/ 1:1)
  skills/                     # /buddy* slash commands (SKILL.md files)
  dist/                       # Pre-compiled JS (committed for end users)
  docs/
    specs/                    # Design documents
```

### Module Dependencies

```
BuddyBrain (brain.ts) -- orchestrator
  |-- TraitSystem (traits.ts) -- 50-dim personality vector
  |-- CognitiveCouncil (council.ts) -- 8 voices modulating traits
  |     \-- DirectorPool -> DirectorRNN (rnn.ts) -- 5 RNNs learning from experience
  |-- DecisionModel (decision.ts) -- utility model selecting actions
  |-- EmotionalSystem (emotional-state.ts) -- 12 emotions, linear decay
  |-- PersonalityEvolutionEngine (personality-evolution.ts) -- trait shifts from patterns
  |-- PerceptionMapper (perception.ts) -- tool events -> 14-dim input
  |-- Identity (identity.ts) -- deterministic hashing for species/name
  |-- Species (species.ts) -- 18 archetypes
  |-- Speech (speech.ts) -- personality-filtered speech
  |-- Sprites (sprites.ts) -- ASCII art + adornments
  \-- Actions (actions.ts) -- action enum + metadata
```

`math.ts` is a leaf dependency used by most modules -- pure functions for matmul, dot, outer, sigmoid, tanh, softmax, clip.

## How the Cognitive Tick Works

Every time you use a tool in Claude Code (Bash, Edit, Write, Read, Glob, Grep), SmartBuddy runs a full cognitive tick. Here's what happens, step by step, with concrete examples:

### 1. Perception (perception.ts)

The tool event is mapped to incremental updates on a 14-dimensional perception vector. For example, if you run `npm test` and it passes:

- `pressure_level` decreases (fewer recent failures)
- `project_health` increases (test pass rate goes up)
- `session_momentum` increases (success streak grows)
- `iteration_pattern` increases if you've been editing too (TDD signal)

Each dimension is normalized to [0, 1] (except time-of-day which uses sin/cos in [-1, 1]). The full 14 dimensions are documented in [ARCHITECTURE.md](ARCHITECTURE.md#perception-vector).

### 2. Emotion Triggers (emotional-state.ts, brain.ts)

Coding events trigger emotions with an intensity, valence, and decay rate:

- Test passes -> **joy** (intensity 0.6, positive valence)
- Test failures -> **frustration** (intensity 0.5, negative valence)
- Any tool failure -> **wariness** (intensity 0.3, mild negative)
- High novelty (many new files) -> **curiosity** (intensity 0.5, positive)

Each emotion decays linearly over 50 ticks by default. A buddy accumulates up to 20 concurrent emotions.

### 3. Emotion Decay

Fully-decayed emotions (intensity reached 0) are removed. The formula:

```
current_intensity = initial_intensity * max(0, 1 - elapsed_ticks / decay_ticks)
```

### 4. Personality Shifts (personality-evolution.ts)

Any active trait shifts from prior evolution triggers are applied to the base personality vector. Shifts use two-stage dampening (see [ARCHITECTURE.md](ARCHITECTURE.md#dampened-trait-updates)) to prevent traits from saturating at the extremes.

### 5. Evolution Trigger Check (brain.ts)

The engine checks whether accumulated session patterns meet trigger thresholds. For example:

- **sustained_debugging**: `pressure_level > 0.5` AND `test_fails > 10` AND `tick_count > 10`
- **creative_exploration**: `novelty > 0.6` AND `tick_count > 5`
- **breakthrough**: `session_momentum` jumped by more than 0.5 since last tick
- **methodical_testing**: `iteration_pattern > 0.5` (balanced edit/test ratio) AND `tick_count > 8`

When a trigger fires, it creates primary shifts (e.g., patience +0.02) plus correlated secondary shifts (e.g., patience shifts self_control by +0.005 via the correlation matrix). These shifts decay over 100 ticks.

### 6. Director RNNs (rnn.ts, council.ts)

Five RNNs (architecture: 14 input -> 8 hidden -> 6 output) each process the perception vector through learned attention masks and produce a 6-dimensional behavioral bias vector:

```
[caution_bias, social_bias, exploration_bias, cooperation_bias, resource_bias, urgency_bias]
```

The five outputs are averaged into a single `mean_bias` vector that feeds the decision model.

### 7. Council Modulation (council.ts)

Eight cognitive voices (Cortex, Seer, Oracle, House, Prudence, Hypothalamus, Amygdala, Conscience) each compute an activation level from weighted trait combinations. Their activations produce a 50-dimensional modulation vector centered at 1.0:

- Dominant voices amplify their associated traits (modulation > 1.0)
- Weak voices dampen their traits (modulation < 1.0)
- Modulation is clamped to [0.5, 1.5]

### 8. Emotional Trait Modifiers (emotional-state.ts)

Active emotions temporarily shift traits. For example, active **curiosity** at intensity 0.5 adds:

```
openness:   +0.075  (0.15 * 0.5)
creativity: +0.050  (0.10 * 0.5)
curiosity:  +0.075  (0.15 * 0.5)
```

These are additive, stacking across all active emotions. The result is `effective_traits`, clamped to [0, 1].

### 9. Decision (decision.ts)

The utility model scores each of 11 possible actions:

```
U(action) = effective_traits^T * W_action * situation_magnitude + bias_action
```

Where `bias_action` includes both emotional biases and director biases (mapped through per-action affinity vectors). Action selection uses softmax with temperature.

### 10. REINFORCE Learning (rnn.ts)

Each director RNN updates its weights based on the tool event outcome:
- Success -> reward = +0.5
- Failure -> reward = -0.3

This trains the attention masks, input-to-hidden weights, and hidden-to-output weights via policy gradient. Over time, directors learn which perception dimensions matter for producing useful behavioral biases.

### 11. Expression + Speech (sprites.ts, speech.ts)

The selected action, dominant emotion, and council state determine:

- **Expression**: Which eyes the sprite shows (e.g., `* *` for excited, `^ ^` for happy)
- **Speech**: A personality-filtered template (only for speech actions like encourage, suggest, challenge)

## Hook System

SmartBuddy integrates with Claude Code through two hooks registered in `hooks/hooks.json`:

### on-prompt-submit (UserPromptSubmit)

**When**: Every time the user submits a prompt.

**What it does**:
1. Reads `mind.json` from the state directory
2. Calls `brain.getContext()` to build a one-line summary (name, species, mood, top traits)
3. Calls `brain.getCard()` to build the full state block (all traits, emotions, adornments, council activations)
4. Reads `last_tick.json` for the most recent sprite frame and speech
5. Outputs JSON to stdout with `hookSpecificOutput.additionalContext`

**Output contract** (stdout, JSON):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "[SMARTBUDDY_MARKER_XYZZY] Your coding companion is..."
  }
}
```

Claude Code injects `additionalContext` into the prompt as a system reminder, making the buddy state visible to the LLM.

### on-tool-use (PostToolUse)

**When**: After any Bash, Edit, Write, Read, Glob, or Grep tool call completes.

**What it does**:
1. Reads the tool event from stdin (JSON)
2. Loads `mind.json`
3. Calls `brain.tick()` with the parsed event
4. Saves updated `mind.json`
5. Writes `last_tick.json` with the tick result (action, expression, speech, sprite frame)

**Input contract** (stdin, JSON):
```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" },
  "success": true
}
```

**Output**: None (writes to files only, no stdout).

### Silent Failure Pattern

Both hooks wrap their entire body in `try/catch` with empty catch blocks. This is intentional -- if a hook writes to stderr or exits non-zero, Claude Code's hook parser can break. SmartBuddy must never interfere with the coding session, even if its own state is corrupted.

### Timeouts

Both hooks have a 5-second timeout configured in `hooks.json`. The entire tick pipeline (including file I/O) must complete within this window.

## State Persistence

All buddy state lives in a single JSON file:

- **Location**: `~/.smartbuddy/mind.json` (or `$CLAUDE_PLUGIN_DATA/mind.json`)
- **Written by**: `on-tool-use` hook after each tick
- **Read by**: Both hooks at the start of each invocation

### mind.json Schema

```json
{
  "name": "Solar",
  "species": "cat",
  "traits": [0.52, 0.61, ...],                    // 50-element array, current values
  "traits_at_creation": [0.52, 0.61, ...],         // 50-element array, original values (for shift calculation)
  "director_pool": {
    "director_count": 5,
    "directors": {
      "integrator_0": {
        "rnn": {
          "genome": [/* 252 floats */],
          "hidden": [/* 8 floats */]
        },
        "total_runs": 42,
        "mean_outcome": 0.31
      }
      // ... 4 more directors
    }
  },
  "emotional_states": [
    {
      "emotion": "curiosity",
      "intensity": 0.5,
      "valence": 0.4,
      "tick_created": 15,
      "decay_ticks": 50
    }
  ],
  "personality_shifts": [
    {
      "trait_index": 6,
      "magnitude": 0.02,
      "trigger": "creative_exploration",
      "tick_created": 20,
      "decay_ticks": 100
    }
  ],
  "evolution_history": [
    { "trigger": "breakthrough", "tick": 35 }
  ],
  "tick_count": 42,
  "frustration_count": 3,
  "challenge_count": 7
}
```

**Key conventions**:
- All JSON keys are **snake_case** for backward compatibility with the original Python version
- TypeScript code uses camelCase internally; serialization/deserialization happens in `brain.ts` (`saveMind`/`loadMind`)
- `mind.json` files written by the Python version load without migration
- Traits are stored as raw floats in index order (see [ARCHITECTURE.md](ARCHITECTURE.md#trait-taxonomy) for the index-to-name mapping)

### last_tick.json

A secondary file written by `on-tool-use` and read by `on-prompt-submit`:

```json
{
  "action": "encourage",
  "expression": "happy",
  "speech": "That's looking great!",
  "spriteFrame": [" /\\_/\\ ", "( ^ ^ )", " > ^ < ", " /| |\\", "(_| |_)"],
  "councilDominant": "cortex"
}
```

This file bridges the two hooks -- `on-tool-use` produces the tick result, and `on-prompt-submit` surfaces it as the buddy's visible appearance and speech.

---

## Contribution Walkthroughs

### Adding a Speech Template

Speech templates give your buddy personality-appropriate things to say. Each template is gated by trait thresholds, so a high-humor buddy says different things than a high-patience buddy.

**File**: `src/speech.ts`

**Step 1**: Choose an action. Templates are organized by the action that triggers them. The 7 speech actions are: `encourage`, `challenge`, `curious_comment`, `engage`, `suggest`, `teach`, `gift`.

**Step 2**: Write the template. Add an entry to the `TEMPLATES` object:

```typescript
// In the "encourage" array:
[{ discipline: [">", 0.7], humor: [">", 0.5] }, "Structured AND fun. Rare combo."],
```

The trait filter format is: `{ trait_name: [operator, threshold] }`. Operators are `">"` (trait must be above threshold) and `"<"` (below). Multiple traits in one filter are AND-ed together.

**Step 3**: Consider specificity. Templates with more trait filters are preferred over generic ones. The selection algorithm:
1. Filters templates to those whose trait conditions are all met
2. Ranks by specificity (number of trait conditions)
3. Randomly picks from the top 3 most-specific matches

A template with `{}` (empty filter) is a fallback -- it always matches but loses to any more specific template.

**Step 4**: For emotion-driven speech, add to `EMOTION_SPEECH` instead:

```typescript
// In the "encourage" section:
determination: ["Keep pushing.", "Almost there."],
```

Emotion speech overrides trait-based templates when the buddy has a matching dominant emotion.

**Rules**:
- Keep text under 60 characters
- The template must be reachable by at least one plausible trait/emotion combination
- Keep language appropriate for professional coding environments
- Test: `npx vitest run tests/speech.test.ts`

### Adding a Sprite Expression

Expressions control the buddy's eyes and are driven by cognitive state (emotions, actions, council activations).

**File**: `src/sprites.ts`

**Step 1**: Add the eye pattern to `EXPRESSIONS`:

```typescript
export const EXPRESSIONS: Record<string, string> = {
  // ... existing expressions ...
  confused:   "? ?",
  sleepy:     "_ _",
};
```

Eye patterns are exactly 3 characters: left eye, space, right eye. They replace the `{E}` placeholder in sprite templates.

**Step 2**: Wire the expression to cognitive state in `getExpression()`:

```typescript
export function getExpression(
  action: string,
  dominantEmotion: string | null,
  councilActivations: Record<string, number>,
  sessionMomentum: number,
): string {
  // Emotion-driven expressions (highest priority)
  if (dominantEmotion === "joy") return "happy";
  if (dominantEmotion === "anxiety") return "confused";  // <-- new

  // Action + council driven
  if (action === "study") return "focused";

  // Fallback based on session state
  if (sessionMomentum < 0.2) return "tired";

  return "neutral";
}
```

Priority order: dominant emotion > action + council state > session momentum > neutral fallback.

**Step 3**: Test that the expression renders correctly with at least one species:

```bash
npx vitest run tests/sprites.test.ts
```

### Adding an Evolution Trigger

Evolution triggers are the mechanism by which coding patterns permanently shape personality. This is the most impactful contribution area -- you're defining how the buddy grows.

**File**: `src/personality-evolution.ts` (trigger rules) and `src/brain.ts` (threshold checks)

**Step 1**: Define the trigger rules in `EVOLUTION_RULES`:

```typescript
// In personality-evolution.ts
[EvolutionTrigger.PAIR_PROGRAMMING, [
  ["sociability",      +1, 0.02],   // primary: sociability increases
  ["cooperativeness",  +1, 0.015],  // secondary: cooperation increases
  ["independence",     -1, 0.01],   // counterweight: independence decreases
  ["empathy",          +1, 0.01],   // minor: empathy increases
] as const],
```

Each rule is `[trait_name, direction, base_magnitude]`. Magnitudes are intentionally tiny (0.01-0.03) -- personality change should be slow and earned through sustained patterns, not one-off events.

Correlated shifts happen automatically via `TRAIT_CORRELATION_MATRIX`. For example, if sociability shifts, extraversion will co-shift at 15% of the magnitude.

**Step 2**: Add the trigger constant:

```typescript
export const EvolutionTrigger = {
  // ... existing triggers ...
  PAIR_PROGRAMMING: "pair_programming",
} as const;
```

**Step 3**: Add the threshold check in `brain.ts` `_checkEvolutionTriggers()`:

```typescript
// Pair programming: high collaboration density over time
if (vec[0] > 0.5 && vec[12] > 0.4 && this._tickCount > 15) {
  const shifts = this._evolutionEngine.createShift(
    EvolutionTrigger.PAIR_PROGRAMMING,
    this._tickCount,
    0.02,     // baseMagnitude -- keep small
  );
  this._personalityShifts.push(...shifts);
  this._evolutionHistory.push({
    trigger: "pair_programming",
    tick: this._tickCount,
  });
}
```

Thresholds should require **sustained** patterns, not single events. Use perception dimensions (see [ARCHITECTURE.md](ARCHITECTURE.md#perception-vector)) and session counters.

**Step 4**: Add tests:

```bash
npx vitest run tests/personality-evolution.test.ts
npx vitest run tests/brain.test.ts
```

### Adding a Perception Mapping

Perception dimensions translate raw coding signals into the 14-dim input vector that feeds the director RNNs. If you identify a useful coding signal that isn't captured, you can improve an existing dimension's calculation.

**File**: `src/perception.ts`

**Adding a new signal source to an existing dimension**: The most common contribution. For example, to make `friction_level` (dim 11) also detect permission denials:

```typescript
// In updateFromToolEvent():
if (toolName === "Bash" && !success) {
  const cmd = ((toolInput.command as string) ?? "").toLowerCase();
  if (cmd.includes("permission denied")) {
    this.frictionEvents += 2;  // weight permission denials higher
  }
}
```

**Note**: We don't add new perception dimensions lightly -- the RNN architecture is fixed at 14 inputs, and changing it would invalidate all learned director weights across existing buddies. If you believe a new dimension is needed, open an issue to discuss the design.

**Rules**:
- All perception values must be normalized to [0, 1] (except time-of-day: [-1, 1])
- Normalization should use a reasonable cap (e.g., `Math.min(1.0, count / 10.0)`)
- New signals should map to existing dimensions where possible
- Test: `npx vitest run tests/perception.test.ts`

---

## Debugging

### Inspecting Brain State

The fastest way to see what's happening inside the cognitive engine:

```typescript
// In a test or debug script:
import { BuddyBrain } from "../src/brain.js";

const brain = new BuddyBrain();
brain.hatch("test_user");

// Simulate a tool event
const result = brain.tick({
  tool_name: "Bash",
  tool_input: { command: "npm test" },
  success: true,
});

console.log("Action:", result.action);
console.log("Expression:", result.expression);
console.log("Speech:", result.speech);
console.log("Council dominant:", result.councilDominant);

// Get full state
const card = brain.getCard();
console.log("Top traits:", card.traits);
console.log("Emotions:", card.emotions);
console.log("Council:", card.councilActivations);
console.log("Evolution:", card.evolutionHistory);
```

### Inspecting a Live Buddy

Read the state files directly:

```bash
# Full cognitive state
cat ~/.smartbuddy/mind.json | python3 -m json.tool

# Last tick result (expression, speech, sprite)
cat ~/.smartbuddy/last_tick.json | python3 -m json.tool

# Watch state changes in real time
watch -n 1 'cat ~/.smartbuddy/last_tick.json | python3 -m json.tool'
```

### Debugging Evolution

To verify that a trigger fires and shifts the right traits:

```typescript
import { PersonalityEvolutionEngine, EvolutionTrigger } from "../src/personality-evolution.js";
import { TraitSystem, TRAIT_INDEX_TO_NAME } from "../src/traits.js";

const ts = new TraitSystem();
const engine = new PersonalityEvolutionEngine(ts);

const shifts = engine.createShift(EvolutionTrigger.BREAKTHROUGH, 100);

for (const shift of shifts) {
  const name = TRAIT_INDEX_TO_NAME.get(shift.traitIndex);
  console.log(`${name}: ${shift.magnitude > 0 ? "+" : ""}${shift.magnitude.toFixed(4)} (${shift.trigger})`);
}
```

### Common Gotchas

- **Changes not appearing in Claude Code?** Did you run `npm run build`? Claude Code reads from `dist/`, not `src/`.
- **Hook seems to do nothing?** Hooks fail silently by design. Add a temporary `fs.writeFileSync("/tmp/smartbuddy-debug.log", ...)` inside the try block to see what's happening.
- **Traits stuck at 0.90 or 0.10?** Those are the hard limits. The dampening system progressively slows trait movement as it approaches boundaries (see [ARCHITECTURE.md](ARCHITECTURE.md#dampened-trait-updates)).
- **Emotion not showing up?** Emotions decay linearly over 50 ticks. If many ticks have elapsed, the emotion may have already decayed to zero.
- **RNN outputs all near zero?** Directors start nearly perception-blind (attention mask initialized near -1.0, so sigmoid gives ~0.27). They need many ticks of REINFORCE learning to develop meaningful outputs.

---

## Test Strategy

Tests are organized to mirror the source files 1:1:

| Source File | Test File | What It Covers |
|-------------|-----------|----------------|
| `brain.ts` | `brain.test.ts` | Hatch, tick pipeline, save/load, reset, context generation |
| `traits.ts` | `traits.test.ts` | Trait lookups, distance, dominant traits, dampening |
| `council.ts` | `council.test.ts` | Activations, modulation, dominant voice, director pool |
| `decision.ts` | `decision.test.ts` | Utility computation, softmax, action selection |
| `emotional-state.ts` | `emotional-state.test.ts` | Emotion creation, decay, trait modifiers |
| `personality-evolution.ts` | `personality-evolution.test.ts` | Shift creation, correlation, decay, application |
| `perception.ts` | `perception.test.ts` | Tool event mapping, vector normalization |
| `rnn.ts` | `rnn.test.ts` | Forward pass, REINFORCE learning, state save/load |
| `speech.ts` | `speech.test.ts` | Template filtering, specificity ranking, emotion override |
| `sprites.ts` | `sprites.test.ts` | Expression selection, frame rendering, adornments |
| `species.ts` | `species.test.ts` | Archetype validation, trait seeding ranges |
| `identity.ts` | `identity.test.ts` | Hash determinism, PRNG distribution, name/species gen |
| `math.ts` | `math.test.ts` | Vector ops, matrix ops, softmax, clip |
| `actions.ts` | `actions.test.ts` | Action metadata, speech/silent classification |
| -- | `integration.test.ts` | Multi-tick sessions, evolution over time |

### Writing Tests for Contributions

**Speech templates**: Verify your template is reachable:

```typescript
import { selectSpeech } from "../src/speech.js";
import { TraitSystem, TRAIT_COUNT } from "../src/traits.js";
import { Mulberry32 } from "../src/identity.js";

it("selects my new template when traits match", () => {
  const ts = new TraitSystem();
  const traits = new Array(TRAIT_COUNT).fill(0.5);
  traits[ts.traitIndex("discipline")] = 0.8;  // above threshold
  traits[ts.traitIndex("humor")] = 0.7;       // above threshold

  // Run many times to account for randomness
  const results = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const speech = selectSpeech("encourage", traits, null, new Mulberry32(i));
    if (speech) results.add(speech);
  }

  expect(results.has("Structured AND fun. Rare combo.")).toBe(true);
});
```

**Evolution triggers**: Verify shifts are created with correct traits and magnitudes:

```typescript
it("creates pair_programming shifts with correct traits", () => {
  const shifts = engine.createShift(EvolutionTrigger.PAIR_PROGRAMMING, 0);
  const shiftMap = new Map(shifts.map(s => [TRAIT_INDEX_TO_NAME.get(s.traitIndex), s]));

  expect(shiftMap.get("sociability")!.magnitude).toBeGreaterThan(0);
  expect(shiftMap.get("independence")!.magnitude).toBeLessThan(0);
});
```

**Sprite expressions**: Verify rendering and expression selection:

```typescript
it("shows confused eyes when anxious", () => {
  const expr = getExpression("observe", "anxiety", {}, 0.5);
  expect(expr).toBe("confused");

  const frame = getSpriteFrame("cat", "confused");
  expect(frame.some(line => line.includes("? ?"))).toBe(true);
});
```

---

## Future Directions

These are areas we're actively thinking about and welcome contributions toward:

### Evolutionary Paths

Right now, evolution is purely accumulative -- traits shift based on coding patterns, but there's no concept of "stages" or "forms." We'd like to add:

- **Evolution milestones**: After enough trait drift, the buddy could visually evolve (new sprite, new adornment, new expression set)
- **Branching paths**: A buddy that develops high analytical + high patience might evolve differently than one with high creativity + high risk_taking
- **Evolution ceremonies**: Special animations or speech when the buddy reaches a milestone

### More Animations and Expressions

The sprite system currently supports 3 frames per species and 8 expressions. We'd like:

- **More expression variety**: Expressions for each of the 12 emotions (currently only a few emotions map to unique expressions)
- **Idle animations**: Multi-frame idle loops that play between ticks
- **Reaction animations**: Brief multi-frame sequences for significant events (test pass, breakthrough, evolution)
- **Species-specific expressions**: Different species could have unique eye patterns

### Richer Emotional Expression

- **Mood transitions**: Smooth blending between emotional states rather than discrete jumps
- **Compound emotions**: Combinations like "frustrated but determined" or "curious and anxious"
- **Emotional memory**: Buddies could remember emotionally significant sessions and reference them

### Adornment System

The adornment system (`sprites.ts:checkAdornments`) is minimal. We'd like:

- **More adornments**: Visual markers earned through specific achievements
- **Adornment rendering**: Actually compositing adornments onto the sprite (currently they're tracked but not visually rendered)
- **Rare adornments**: Achievements that require very specific trait + behavior combinations

### New Species

The identity system supports arbitrary species. New species need:
- A `SpeciesArchetype` entry in `species.ts` (4 high traits, 2 low traits)
- A sprite template in `sprites.ts` (5 lines, 3 frames, `{E}` placeholder)
- A personality description in the README species table

---

## Maintained by Tucuxi

The following areas are maintained by Tucuxi Inc and not open for external contribution:

- Core cognitive engine architecture (trait system, RNN, council, decision model)
- Species archetype definitions and trait biases
- Identity and hashing system (bones/soul)
- Plugin manifest and hook architecture

If you have ideas for changes in these areas, open an issue -- we're happy to discuss the design.

## Code Conventions

- **File naming**: kebab-case (e.g., `emotional-state.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BUDDY_ACTION_MAP`)
- **Types/Interfaces**: PascalCase (e.g., `PersonalityShift`)
- **Variables/functions**: camelCase internally, snake_case in JSON persistence
- **Trait values**: always in [0, 1]; hard limits [0.10, 0.90] for evolution
- **Shift magnitudes**: tiny by design (0.01-0.03). If your shift magnitude is above 0.05, it's probably too aggressive.
- **Speech templates**: under 60 characters
- **Sprite expressions**: exactly 3 characters (`eye space eye`), placed in 5-line ASCII art via `{E}` placeholder

## Code of Conduct

- Be kind. Be constructive.
- When proposing changes, explain what cognitive effect you expect (e.g., "this template makes high-curiosity buddies more talkative during exploration").
- Test your additions. Speech templates should be reachable by at least one plausible trait/emotion combination.
- Keep speech templates appropriate for professional coding environments.

## License

SmartBuddy is licensed under the [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) license. By contributing, you agree that your contributions will be licensed under the same terms. Contact kevin@tucuxi.ai for commercial licensing questions.
