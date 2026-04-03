# Contributing to SmartBuddy

SmartBuddy is a Claude Code plugin that gives your coding companion a real cognitive engine -- 50-trait personality, RNN directors, 8-voice council, and emotions that decay naturally. We welcome contributions that make buddies more expressive and interesting.

## What's Open for Contribution

### Sprites and Expressions

Add new species-specific idle animations, expressions, or adornment visuals. The sprite system uses 5-line ASCII art with `{E}` as the eye placeholder.

Expressions are driven by cognitive state. To add a new expression to the `EXPRESSIONS` dict:

```python
EXPRESSIONS = {
    "neutral":    ". .",
    "happy":      "^ ^",
    "focused":    "- -",
    "surprised":  "O O",
    "skeptical":  "> .",
    "tired":      "- -",
    "excited":    "* *",
    "side_glance": ". ·",
    # Add yours here:
    "confused":   "? ?",
}
```

### Speech Templates

Templates are selected by action type, active emotions, and trait thresholds. To add a new template, follow this format:

```python
{
    "action": "encourage",
    "trait_filter": {"patience": ("high", 0.7), "expressiveness": ("low", 0.4)},
    "emotion_filter": ["satisfaction"],
    "text": "That took a while, but it's solid work."
}
```

- `action`: One of the 11 buddy actions (observe, curious_comment, engage, study, encourage, suggest, challenge, teach, emote, journal, gift)
- `trait_filter`: Dict of trait_name -> (direction, threshold). "high" means trait must be above threshold; "low" means below.
- `emotion_filter`: Optional list of emotions that should be active (or empty for any).
- `text`: The speech bubble text. Keep it short (under 60 characters).

Two buddies with the same action will say different things because different trait thresholds select different templates. The more templates you add with varied trait filters, the more personality-distinct buddy speech becomes.

### Perception Mappings

Map new coding signals to the 14-dim perception vector. If you identify a useful coding signal that isn't captured (e.g., language-specific patterns, CI/CD events), propose how it maps to an existing perception dimension or suggest a dimension reuse.

### Evolution Triggers

Add new coding patterns that trigger personality shifts. Follow the existing trigger format:

```python
EvolutionTrigger.YOUR_TRIGGER = "your_trigger"

# In EVOLUTION_RULES:
EvolutionTrigger.YOUR_TRIGGER: [
    ("trait_name", +1, 0.02),    # direction, base_magnitude
    ("other_trait", -1, 0.01),
]
```

Triggers should represent sustained coding patterns, not one-off events. The shift magnitudes are tiny by design (0.01-0.03 per trigger) -- personality change is slow and genuine.

### TypeScript Port

The full mathematical specification is documented in [ARCHITECTURE.md](ARCHITECTURE.md). It contains the decision model equations, RNN architecture and weight layout, council voice weights, trait taxonomy, perception dimensions, emotion decay formulas, and evolution rules. You do not need access to the Python source code -- the math is fully documented for reimplementation.

A TypeScript port would eliminate the Python/MCP sidecar and let SmartBuddy run natively in the Claude Code process.

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
