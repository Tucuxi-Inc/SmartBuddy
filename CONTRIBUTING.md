# Contributing to SmartBuddy

SmartBuddy is a Claude Code plugin that gives your coding companion a real cognitive engine -- 50-trait personality, RNN directors, 8-voice council, and emotions that decay naturally. We welcome contributions that make buddies more expressive and interesting.

## Development Setup

```bash
npm install          # Install dev dependencies
npm run build        # Compile TypeScript to dist/
npm test             # Run all tests
npm run test:watch   # Watch mode for development
```

Source code is in `src/`, hook handlers in `hooks-src/`, tests in `tests/`.

The pre-compiled `dist/` directory is committed so end users need zero build steps. After making any changes to `src/` or `hooks-src/`, run `npm run build` to recompile before committing.

## Math Reference

The full mathematical specification is documented in [ARCHITECTURE.md](ARCHITECTURE.md). It contains the decision model equations, RNN architecture and weight layout, council voice weights, trait taxonomy, perception dimensions, emotion decay formulas, and evolution rules.

## What's Open for Contribution

### Sprites and Expressions

Add new species-specific idle animations, expressions, or adornment visuals. The sprite system uses 5-line ASCII art with `{E}` as the eye placeholder.

Expressions are driven by cognitive state. To add a new expression to the `EXPRESSIONS` map in `src/sprites.ts`:

```typescript
export const EXPRESSIONS: Record<string, string> = {
  neutral:    ". .",
  happy:      "^ ^",
  focused:    "- -",
  surprised:  "O O",
  // Add yours here:
  confused:   "? ?",
};
```

### Speech Templates

Templates are selected by action type, active emotions, and trait thresholds. To add a new template in `src/speech.ts`:

```typescript
{
  action: "encourage",
  traitFilter: { patience: { dir: "high", threshold: 0.7 }, expressiveness: { dir: "low", threshold: 0.4 } },
  emotionFilter: ["satisfaction"],
  text: "That took a while, but it's solid work."
}
```

- `action`: One of the 11 buddy actions (observe, curious_comment, engage, study, encourage, suggest, challenge, teach, emote, journal, gift)
- `traitFilter`: Dict of trait_name -> { dir, threshold }. "high" means trait must be above threshold; "low" means below.
- `emotionFilter`: Optional list of emotions that should be active (or empty for any).
- `text`: The speech bubble text. Keep it short (under 60 characters).

### Perception Mappings

Map new coding signals to the 14-dim perception vector in `src/perception.ts`. If you identify a useful coding signal that isn't captured, propose how it maps to an existing dimension or suggest a dimension reuse.

### Evolution Triggers

Add new coding patterns that trigger personality shifts in `src/personality-evolution.ts`. Triggers should represent sustained coding patterns, not one-off events. Shift magnitudes are tiny by design (0.01-0.03 per trigger) -- personality change is slow and genuine.

## Maintained by Tucuxi

The following areas are maintained by Tucuxi Inc and not open for external contribution:

- Core cognitive engine architecture (trait system, RNN, council, decision model)
- Species archetype definitions and trait biases
- Identity and hashing system (bones/soul)
- Plugin manifest and hook architecture

## Code of Conduct

- Be kind. Be constructive.
- When proposing changes, explain what cognitive effect you expect (e.g., "this template makes high-curiosity buddies more talkative during exploration").
- Test your additions. Speech templates should be reachable by at least one plausible trait/emotion combination.
- Keep speech templates appropriate for professional coding environments.

## License

SmartBuddy is licensed under the [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) license. By contributing, you agree that your contributions will be licensed under the same terms. Contact kevin@tucuxi.ai for commercial licensing questions.
