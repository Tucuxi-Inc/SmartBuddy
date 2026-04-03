# SmartBuddy

**A cognitive coding companion that actually thinks.**

SmartBuddy is a Claude Code plugin with a real cognitive engine -- 50 traits, RNN directors, 8-voice council, personality evolution. Not a gimmick, not a chatbot wrapper. A living companion that develops its own personality through your coding sessions.

Two developers with the same species will have completely different buddies after a month of real use -- because personality is earned through experience, not assigned at random.

## Quick Start

```bash
# 1. Clone the repo (use the TypeScript branch until it merges to main)
git clone -b feature/typescript-port https://github.com/Tucuxi-Inc/SmartBuddy.git

# 2. Launch Claude Code with SmartBuddy loaded
claude --plugin-dir /path/to/SmartBuddy

# 3. Hatch your buddy
> /buddy
```

That's it. No build step required -- pre-compiled JavaScript is included in `dist/`.

### Prerequisites

Just [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview). Nothing else to install.

### State & Data

Your buddy's cognitive state (personality, learned RNN weights, emotions, evolution history) is saved to `~/.smartbuddy/mind.json`. This file persists across sessions -- your buddy picks up where it left off. If the `CLAUDE_PLUGIN_DATA` environment variable is set, state is stored there instead.

## Privacy

SmartBuddy runs **entirely on your machine**. No exceptions.

- **No network calls.** Zero. The cognitive engine is pure math running locally. No API calls, no telemetry, no phoning home.
- **No LLM in the loop.** Your buddy's brain is a lightweight neural network (~50KB), not an LLM. Decisions come from math, not inference calls.
- **No code access.** SmartBuddy never reads your source files. It only sees tool names (e.g., "Bash", "Edit"), file paths, and success/fail signals from Claude Code hooks. It has no access to file contents, terminal output, or conversation text.
- **No data collection.** All state lives in your local plugin data directory (`~/.claude/plugins/data/smartbuddy/`). Nothing leaves your machine.

## How It Works

```
  Coding Events (tool use)
    -> Perception Mapper (14-dim vector)
      -> 5 Director RNNs (14->8->6, learn via REINFORCE)
        -> 8-Voice Council (deliberates)
          -> Decision Model (U = P^T * W * x + b)
            -> Action + Expression + Speech

  50-Trait Personality (feeds everything)
  12 Emotions (decay, modify traits)
  7 Evolution Triggers (permanent shifts)
```

Your buddy runs a genuine cognitive architecture on every tick. A 50-trait personality vector feeds into five neural network directors that each learn from your coding patterns through reinforcement learning. Before every reaction, an 8-voice council deliberates by amplifying or dampening trait contributions based on the current situation. The result flows through a utility-based decision model that weighs personality against perception to select one of 11 possible actions.

Real emotions arise from coding events, decay naturally over time, and temporarily shift trait expression while active. Personality itself evolves through genuine experience: weeks of debugging builds patience, creative exploration deepens curiosity, and breakthroughs boost confidence.

## Species

Every developer gets one of 18 species, determined by your user ID. Each starts with different trait biases, but all are equally capable -- differentiation comes from cognition, not rarity.

| Species | Archetype | Personality |
|---------|-----------|-------------|
| Duck | Cheerful Generalist | Social, optimistic, adaptable |
| Goose | Assertive Guardian | Bold, loyal, determined |
| Cat | Aloof Perfectionist | Independent, patient, discerning |
| Rabbit | Anxious Speedster | Alert, sensitive, diligent |
| Owl | Wise Observer | Analytical, patient, thorough |
| Penguin | Steadfast Collaborator | Persistent, loyal, disciplined |
| Turtle | Methodical Thinker | Persistent, cautious, patient |
| Snail | Patient Perfectionist | Meticulous, patient, humble |
| Dragon | Bold Challenger | Assertive, confident, ambitious |
| Octopus | Creative Polymath | Creative, adaptable, resourceful |
| Axolotl | Resilient Optimist | Resilient, optimistic, composed |
| Ghost | Mysterious Introvert | Independent, creative, perceptive |
| Robot | Systematic Executor | Conscientious, precise, disciplined |
| Blob | Easygoing Adapter | Adaptable, agreeable, resilient |
| Cactus | Tough Minimalist | Independent, persistent, stoic |
| Mushroom | Quiet Networker | Perceptive, patient, cooperative |
| Chonk | Comfortable Pragmatist | Composed, disciplined, warm |
| Capybara | Chill Collaborator | Social, composed, empathetic |

## Commands

| Command | Description |
|---------|-------------|
| `/buddy` | First run: hatch your buddy. After: toggle visibility |
| `/buddy-card` | Full stat card -- species, dominant traits, emotions, evolution log, adornments |
| `/buddy-status` | Quick view -- name, current mood, what it's doing |
| `/buddy-journal` | View journal entries for the current project |
| `/buddy-pet` | Heart animation + joy emotion boost |
| `/buddy-reset` | Factory reset with confirmation (keeps species, wipes learned state) |

## For Contributors

```bash
npm install          # Install dev dependencies (TypeScript, Vitest)
npm run build        # Compile src/ and hooks-src/ to dist/
npm test             # Run all tests (~122 tests, <1 second)
npm run test:watch   # Watch mode for development

# Run a single test file
npx vitest run tests/brain.test.ts

# Run tests matching a name pattern
npx vitest run -t "full session lifecycle"
```

Code lives in `src/`, hooks in `hooks-src/`, tests in `tests/`. The pre-compiled `dist/` directory is committed so end users need zero build steps. Run `npm run build` after any source changes before committing.

**Important**: This is a zero-dependency project. There are no runtime dependencies -- only dev dependencies (TypeScript compiler and Vitest). The cognitive engine is pure math implemented in TypeScript.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full mathematical specification -- decision model equations, RNN weight layout, council voice weights, trait taxonomy, perception dimensions, emotion decay formulas, and evolution rules.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

Free for personal and non-commercial use under the [PolyForm Noncommercial 1.0.0](LICENSE) license. Contact kevin@tucuxi.ai for commercial licensing.

## Credits

Built by [Tucuxi Inc](https://github.com/Tucuxi-Inc). Cognitive engine extracted from [Living Worlds](https://github.com/Tucuxi-Inc/LivingWorlds).
