# SmartBuddy

**Your buddy doesn't pretend to have personality. It thinks.**

SmartBuddy replaces static personality stats with a real cognitive engine. Instead of five hardcoded numbers and canned reactions, your coding companion has a 50-trait personality, neural network directors that learn from your coding patterns, an 8-voice deliberative council, and 12 emotions with natural decay. Two developers with the same species will have completely different buddies after a month of real use -- because personality is earned through experience, not assigned at random.

## Original Buddy vs SmartBuddy

| Feature | Original Buddy | SmartBuddy |
|---------|---------------|------------|
| Personality | 5 static stats (wit, sass, etc.) | 50-trait vector, continuously evolving |
| Learning | None | RNN directors learn from your coding via REINFORCE |
| Reactions | Random from pool | 8-voice council deliberates before every action |
| Emotions | None | 12 emotions with linear decay and trait modifiers |
| Evolution | Static forever | Personality shifts through genuine coding experience |
| Divergence | Same species = same buddy | Same species, different developer = different buddy |
| Decisions | Scripted rules | Utility model: `U(a|P,x) = P^T * W * x + b` |
| Adornments | Random rarity rolls | Earned from real cognitive milestones |

## Quick Start

```bash
git clone https://github.com/Tucuxi-Inc/SmartBuddy.git
cd SmartBuddy && pip install -e .
# In Claude Code: /buddy
```

## Meet the Species

Every developer gets one of 18 species, determined by your user ID. Each species starts with different trait biases, but all are equally capable -- differentiation comes from cognition, not rarity.

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

## Your Buddy's Brain

Your buddy runs a genuine cognitive architecture on every tick. A 50-trait personality vector feeds into five neural network directors that each learn from your coding patterns through reinforcement learning. Before every reaction, an 8-voice council -- analytical reasoning, pattern recognition, prediction, stability preference, caution, arousal, threat response, and ethical balance -- deliberates by amplifying or dampening trait contributions based on the current situation. The result flows through a utility-based decision model that weighs personality against perception to select one of 11 possible actions. Real emotions (joy, frustration, curiosity, anxiety, and eight others) arise from coding events, decay naturally over time, and temporarily shift trait expression while they're active. Personality itself evolves through genuine experience: weeks of debugging builds patience, creative exploration deepens curiosity, and breakthroughs boost confidence. Correlated traits shift together -- patience pulls self-control along with it. The buddy you have after six months is a genuine product of the code it watched you write.

## Evolution Stories

**The Debugger's Companion.** A Cat buddy starts aloof and independent. After three months of late-night debugging sessions -- test failures, patient fixes, methodical retries -- its patience climbs from 0.68 to 0.82. Self-control follows through trait correlation. It stops commenting on novelty and starts quietly studying error patterns. Its Prudence voice dominates the council now. When tests finally pass, it offers a single understated "Tests pass. Good."

**The Explorer's Sidekick.** A Dragon buddy begins bold and confident, challenging risky git operations. But its developer works on greenfield projects -- new directories every day, unfamiliar languages, constant exploration. Curiosity overtakes assertiveness. The Seer voice strengthens. After four months, the dragon that once questioned force-pushes now says "First time in this directory. What lives here?" Its adventurousness trait has drifted +0.25 from its starting point.

**The Team Player.** An Octopus starts as a creative loner, high in independence. But its developer does pair programming, PR reviews, and collaborative sessions daily. Sociability creeps up tick by tick. Empathy and cooperativeness follow through correlation. Six months in, it celebrates merged PRs, notices when collaboration density drops, and its Conscience voice has overtaken the Cortex. Same species as the solo developer's Octopus -- completely different buddy.

## Earned, Not Ground

Adornments are visual markers that your buddy earns through real cognitive milestones. They cannot be bought, rolled, or assigned -- only lived.

| Adornment | How It's Earned | Visual |
|-----------|----------------|--------|
| Battle Scars | Frustration triggered 50+ times (you've been through it together) | Small `x` on sprite body |
| Reading Glasses | Analytical trait rises above 0.80 (deep thinker) | `o-o` eye override |
| Star Mark | Any single trait has shifted more than 0.30 from its starting value | `*` near sprite |
| Heart | Both sociability and empathy exceed 0.75 (genuine warmth) | `<3` floats occasionally |
| Lightning Bolt | Assertiveness above 0.80 with frequent challenge actions (bold spirit) | `!` near sprite |

## Commands

| Command | Description |
|---------|-------------|
| `/buddy` | First run: hatch your buddy. After: toggle visibility |
| `/buddy card` | Full stat card -- species, dominant traits, emotions, evolution log, adornments |
| `/buddy status` | Quick view -- name, current mood, what it's doing |
| `/buddy journal` | View journal entries for the current project |
| `/buddy reset` | Factory reset with confirmation (keeps species, wipes learned state) |
| `/buddy pet` | Heart animation + joy emotion boost |

## Requirements

- Python 3.11+
- NumPy >= 1.26
- No other external dependencies

## License

Free for personal and non-commercial use under the [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) license. Contact kevin@tucuxi.ai for commercial licensing.

## Credits

Built by [Tucuxi Inc](https://github.com/Tucuxi-Inc). Cognitive engine extracted from Living Worlds.
