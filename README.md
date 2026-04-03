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
- **No data collection.** All state lives in your local plugin data directory. Nothing leaves your machine.

## How It Works

Every time you use a tool in Claude Code, SmartBuddy runs a full cognitive tick through a genuine neural architecture:

```
  Coding Event (Bash, Edit, Read, ...)
    |
    v
  Perception Mapper -----------> 14-dim vector (novelty, pressure, momentum, ...)
    |
    v
  5 Director RNNs (14->8->6) --> 6-dim behavioral bias (learned via REINFORCE)
    |
    v
  8-Voice Council --------------> 50-dim trait modulation (amplify/dampen)
    |
    v
  Decision Model (U = P^T * W * s + b) --> 1 of 11 actions
    |
    v
  Expression + Speech ----------> ASCII sprite + personality-filtered words
```

**Personality** is a 50-dimensional trait vector that feeds everything. Traits like patience, curiosity, and assertiveness sit in [0, 1] and influence every decision your buddy makes.

**Emotions** arise from coding events -- test passes trigger joy, failures trigger frustration, exploring new files triggers curiosity. Each emotion decays linearly over time and temporarily shifts trait expression while active.

**Evolution** happens through sustained coding patterns. Weeks of debugging builds patience. Creative exploration deepens curiosity. Breakthroughs boost confidence. Trait shifts are tiny by design (0.01-0.03 per trigger) so personality change is slow and genuine.

**Directors** are five small RNNs that learn your coding patterns through reinforcement learning. They start nearly perception-blind and gradually discover which signals matter, producing behavioral biases that tilt decision-making toward actions that suit the current situation.

**The Council** is an 8-voice deliberation layer (Cortex, Seer, Oracle, House, Prudence, Hypothalamus, Amygdala, Conscience) where each voice's strength depends on the buddy's current personality. Dominant voices amplify their associated traits; weak voices dampen them.

For the complete mathematical specification -- every equation, every weight matrix, every constant -- see [ARCHITECTURE.md](ARCHITECTURE.md).

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
```

Code lives in `src/`, hooks in `hooks-src/`, tests in `tests/`. The pre-compiled `dist/` directory is committed so end users need zero build steps. Run `npm run build` after any source changes before committing.

**Important**: This is a zero-dependency project. There are no runtime dependencies -- only dev dependencies (TypeScript compiler and Vitest). The cognitive engine is pure math implemented in TypeScript.

**Open for contribution**: sprite expressions, speech templates, perception mappings, evolution triggers, adornments, and animations. See [CONTRIBUTING.md](CONTRIBUTING.md) for complete walkthroughs with code examples for each contribution type.

**Reference docs**:
- [ARCHITECTURE.md](ARCHITECTURE.md) -- full mathematical specification (decision model equations, RNN weight layout, council voice weights, trait taxonomy, perception dimensions, emotion decay, evolution rules)
- [CONTRIBUTING.md](CONTRIBUTING.md) -- development workflow, project structure, hook system docs, state format, debugging guide, first contribution walkthroughs, test strategy, and future directions

## License

Free for personal and non-commercial use under the [PolyForm Noncommercial 1.0.0](LICENSE) license. Contact kevin@tucuxi.ai for commercial licensing.

## Credits

Built by [Tucuxi Inc](https://github.com/Tucuxi-Inc). Cognitive engine extracted from [Living Worlds](https://github.com/Tucuxi-Inc/LivingWorlds).
