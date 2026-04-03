# SmartBuddy Architecture

Mathematical specification for the SmartBuddy cognitive engine. This document contains everything needed to reimplement the engine in any language -- no source code access required.

## Decision Model

Every buddy decision flows through a single utility function:

```
U(a | P, x) = P^T * W_a * s + b_a
```

Where:
- **P** = 50-dimensional personality trait vector, values in [0, 1]
- **W_a** = per-action weight vector (50-dim), normalized to sum to 1
- **s** = situation magnitude = mean(|situation_values|), a scalar
- **b_a** = per-action bias term (from emotional state + director biases)
- **a** = one of 11 candidate actions

Council modulation amplifies traits before the dot product:

```
P_effective = P * M
```

Where **M** is the council modulation vector (50-dim, values in [0.5, 1.5]).

Director biases add to the action bias term via the action map:

```
b_a += dot(action_map[a], mean_director_output)
```

The action map is a 6-dim vector per action mapping director bias dimensions (caution, social, exploration, cooperation, resource, urgency) to action affinity.

Action selection uses softmax with temperature:

```
p(a) = exp(U(a) / T) / sum(exp(U(a_i) / T))
```

Temperature T controls stochasticity. T <= 0 produces deterministic argmax.

### Action Space

11 actions with their 6-dim action map vectors [caution, social, exploration, cooperation, resource, urgency]:

| Action | Map Vector |
|--------|-----------|
| observe | [0.2, -0.3, -0.3, 0.0, 0.0, -0.5] |
| curious_comment | [-0.2, 0.1, 0.5, 0.1, -0.1, 0.2] |
| engage | [0.0, 0.5, 0.0, 0.3, 0.0, 0.1] |
| study | [0.2, -0.2, 0.2, 0.0, 0.3, -0.3] |
| encourage | [0.0, 0.4, 0.0, 0.5, -0.1, 0.0] |
| suggest | [0.0, 0.2, 0.1, 0.2, 0.3, 0.2] |
| challenge | [-0.3, 0.1, 0.0, -0.3, 0.0, 0.4] |
| teach | [0.1, 0.3, -0.1, 0.3, -0.2, 0.0] |
| emote | [-0.1, 0.3, 0.1, 0.1, -0.2, 0.1] |
| journal | [0.3, -0.1, -0.2, 0.0, 0.2, -0.2] |
| gift | [0.1, 0.2, 0.0, 0.3, 0.3, -0.1] |

## RNN Architecture

Each director uses a recurrent neural network with architecture 14 -> 8 -> 6:

- **14 input dimensions**: perception vector (coding activity)
- **8 hidden dimensions**: persistent hidden state with tanh activation
- **6 output dimensions**: behavioral bias vector

### 252-Weight Genome Layout

| Segment | Size | Description |
|---------|------|-------------|
| attention_mask | 14 | Learned perceptual gating weights |
| W_ih | 112 (8 x 14) | Input-to-hidden weight matrix |
| W_hh | 64 (8 x 8) | Hidden-to-hidden recurrence matrix |
| W_ho | 48 (6 x 8) | Hidden-to-output weight matrix |
| bias_h | 8 | Hidden layer bias |
| bias_o | 6 | Output layer bias |
| **Total** | **252** | |

### Forward Pass

```
attention = sigmoid(attention_mask)
masked_perception = perception * attention

h_new = tanh(W_ih @ masked_perception + W_hh @ h_prev + bias_h)
output = tanh(W_ho @ h_new + bias_o)
```

The hidden state `h` persists between forward passes within a session.

### Attention Mask

The attention mask is a 14-dim vector of learned weights. Each element passes through sigmoid to produce a gate in [0, 1] that multiplies the corresponding perception dimension. Initialized near -1.0 (Gaussian with mean -1.0, sigma 0.3), so new directors start nearly perception-blind (sigmoid(-1) ~ 0.27 sensitivity) and must discover which inputs matter through learning.

### Initialization

- Attention mask: `N(-1.0, 0.3)` per element
- All other weights: `N(0.0, 0.3)` per element
- Hidden state: zeros

### Output Dimensions

| Index | Name | Interpretation |
|-------|------|---------------|
| 0 | CAUTION_BIAS | Cautious vs bold |
| 1 | SOCIAL_BIAS | Social vs solitary |
| 2 | EXPLORATION_BIAS | Explore vs exploit |
| 3 | COOPERATION_BIAS | Cooperative vs competitive |
| 4 | RESOURCE_BIAS | Gather/hoard vs share |
| 5 | URGENCY_BIAS | Act now vs wait |

## REINFORCE Learning

After each tick, directors update three weight groups from the outcome signal:

```
# W_ho gradient: reward * outer(bias_produced, hidden)
W_ho += lr * outcome * outer(bias, h)

# W_ih gradient: reward * outer((1 - h^2), masked_perception)
hidden_grad = outcome * (1 - h^2)
W_ih += lr * outer(hidden_grad, masked_perception)

# Attention mask gradient: chain rule through sigmoid and W_ih
sig_grad = attention * (1 - attention)
attn_grad = outcome * (W_ih^T @ hidden_grad) * perception * sig_grad
attention_mask += lr * attn_grad
```

Constants:
- Learning rate: 0.01
- Weight clamp: +/- 3.0 (applied after each update to W_ho, W_ih, attention_mask)

### Reward Signal

| Condition | Reward |
|-----------|--------|
| Tool call succeeded | +0.5 |
| Tool call failed | -0.3 |

## Council Voices

8 voices, each computing activation as a weighted dot product of trait values:

### Cortex (Analytical Reasoning)

| Trait | Weight |
|-------|--------|
| openness | 0.40 |
| conscientiousness | 0.30 |
| adaptability | 0.15 |
| self_control | 0.15 |

### Seer (Pattern Recognition)

| Trait | Weight |
|-------|--------|
| creativity | 0.40 |
| depth_drive | 0.35 |
| openness | 0.25 |

### Oracle (Prediction)

| Trait | Weight |
|-------|--------|
| risk_taking | 0.30 |
| ambition | 0.35 |
| adaptability | 0.20 |
| openness | 0.15 |

### House (Stability)

| Trait | Weight |
|-------|--------|
| trust | 0.30 |
| self_control | 0.25 |
| agreeableness | 0.25 |
| empathy | 0.20 |

### Prudence (Caution)

| Trait | Weight |
|-------|--------|
| conscientiousness | 0.35 |
| self_control | 0.35 |
| neuroticism | 0.15 |
| trust | 0.15 |

### Hypothalamus (Arousal)

| Trait | Weight |
|-------|--------|
| extraversion | 0.35 |
| dominance | 0.30 |
| ambition | 0.20 |
| risk_taking | 0.15 |

### Amygdala (Threat Response)

| Trait | Weight |
|-------|--------|
| neuroticism | 0.45 |
| resilience | -0.30 |
| trust | -0.25 |

Note: Amygdala uses negative weights -- high resilience and trust suppress threat response.

### Conscience (Ethics)

| Trait | Weight |
|-------|--------|
| agreeableness | 0.30 |
| empathy | 0.35 |
| trust | 0.20 |
| self_control | 0.15 |

### Council Modulation

Each voice's activation:

```
activation[voice] = dot(weight_vector[voice], traits)
```

Activations are normalized to [0, 1]:

```
norm_act = (act - act_min) / (act_max - act_min)
```

The modulation vector (50-dim, centered at 1.0) is computed:

```
For each voice:
  influence = 0.2 * (norm_act - 0.5)
  For each trait where weight != 0:
    modulation[trait] += influence * |weight|
```

Final modulation clamped to [0.5, 1.5]. Dominant voices amplify their associated traits; weak voices dampen them.

## Trait Taxonomy

50 traits organized into categories. All values in [0, 1].

### Big Five (indices 0-4)

| Index | Name | Description |
|-------|------|-------------|
| 0 | openness | Openness to experience |
| 1 | conscientiousness | Organization and discipline |
| 2 | extraversion | Social energy and outgoingness |
| 3 | agreeableness | Cooperation and trust in others |
| 4 | neuroticism | Emotional reactivity and sensitivity |

### Cognitive (indices 5-9, 28-29, 32-33, 44)

| Index | Name | Description |
|-------|------|-------------|
| 5 | creativity | Imaginative and inventive thinking |
| 6 | curiosity | Desire to explore and learn |
| 7 | adaptability | Ability to adjust to new situations |
| 8 | resilience | Recovery from setbacks |
| 9 | ambition | Drive for achievement |
| 28 | pragmatism | Practical problem-solving focus |
| 29 | idealism | Pursuit of abstract principles |
| 32 | analytical | Systematic logical reasoning |
| 33 | intuitive | Gut-feel pattern recognition |
| 44 | innovation | Drive to create new methods |

### Social (indices 10-14, 25-27, 30, 39, 45)

| Index | Name | Description |
|-------|------|-------------|
| 10 | empathy | Understanding others' feelings |
| 11 | trust | Willingness to rely on others |
| 12 | assertiveness | Directness in communication |
| 13 | self_control | Restraint and impulse regulation |
| 14 | optimism | Positive expectation of outcomes |
| 25 | loyalty | Faithfulness to commitments |
| 26 | competitiveness | Drive to outperform others |
| 27 | generosity | Willingness to share resources |
| 30 | sociability | Enjoyment of social interaction |
| 39 | cooperativeness | Tendency to work with others |
| 45 | tolerance | Acceptance of differing views |

### Emotional (indices 15-19, 31, 34, 37-38, 46-48)

| Index | Name | Description |
|-------|------|-------------|
| 15 | risk_taking | Willingness to accept uncertainty |
| 16 | patience | Tolerance for delay |
| 17 | humor | Appreciation of comedy and play |
| 18 | independence | Self-reliance and autonomy |
| 19 | sensitivity | Awareness of subtle stimuli |
| 31 | introversion | Preference for solitude and reflection |
| 34 | emotional_stability | Steadiness under pressure |
| 37 | confidence | Belief in own abilities |
| 38 | humility | Modesty and openness to correction |
| 46 | expressiveness | Outward display of inner states |
| 47 | stoicism | Endurance without complaint |
| 48 | spirituality | Sense of transcendent meaning |

### Behavioral (indices 20-24, 35-36, 40-43, 49)

| Index | Name | Description |
|-------|------|-------------|
| 20 | depth_drive | Compulsion toward deep processing |
| 21 | dominance | Desire to lead and control |
| 22 | warmth | Emotional approachability |
| 23 | discipline | Adherence to routine and structure |
| 24 | integrity | Consistency of values and actions |
| 35 | persistence | Tenacity in pursuing goals |
| 36 | flexibility | Willingness to change approach |
| 40 | resourcefulness | Ability to find creative solutions |
| 41 | adventurousness | Appetite for novel experiences |
| 42 | caution | Careful evaluation before acting |
| 43 | traditionalism | Respect for established ways |
| 49 | playfulness | Lighthearted engagement with the world |

## Perception Vector

14 dimensions mapping coding activity to cognitive input:

| Dim | Name | Range | Source |
|-----|------|-------|--------|
| 0 | collaboration_density | [0, 1] | PR and review activity (git signals) |
| 1 | pressure_level | [0, 1] | Recent failure rate (last 5 tool calls) |
| 2 | project_health | [0, 1] | Test pass rate (passes / total test runs) |
| 3 | session_momentum | [0, 1] | Current success streak / 5 |
| 4 | user_consistency | [0, 1] | Overall success rate across session |
| 5 | novelty | [0, 1] | Ratio of unique files to total file touches |
| 6 | time_of_day_sin | [-1, 1] | sin(2 * pi * hour / 24) |
| 7 | time_of_day_cos | [-1, 1] | cos(2 * pi * hour / 24) |
| 8 | session_depth | [0, 1] | Total tool calls / 50, capped at 1.0 |
| 9 | recent_success | [0, 1] | Success rate of last 10 tool calls |
| 10 | iteration_pattern | [0, 1] | Edit-to-test ratio balance (1.0 = perfect TDD) |
| 11 | friction_level | [0, 1] | Friction events / 10, capped at 1.0 |
| 12 | conversation_density | [0, 1] | User message count / 20, capped at 1.0 |
| 13 | codebase_familiarity | [0, 1] | Fraction of files visited more than once |

## Emotion Model

12 emotions, each with intensity [0, 1], valence [-1, 1], and linear decay.

### Decay Formula

```
current_intensity(tick) = intensity * max(0, 1 - (tick - tick_created) / decay_ticks)
```

Default decay_ticks = 50. An emotion is active when current_intensity > 0.

### Emotion-to-Trait Modifiers

Each active emotion adds a modifier vector to the base trait vector, scaled by current intensity:

```
trait_modifier = sum(modifier_vector[emotion] * current_intensity[emotion])
effective_traits = clip(base_traits + trait_modifier, 0, 1)
```

| Emotion | Trait Modifiers |
|---------|----------------|
| joy | extraversion +0.10, optimism +0.15, neuroticism -0.10 |
| curiosity | openness +0.15, creativity +0.10, curiosity +0.15 |
| frustration | patience -0.15, neuroticism +0.10, emotional_stability -0.10 |
| anxiety | neuroticism +0.15, risk_taking -0.10, confidence -0.10 |
| satisfaction | emotional_stability +0.10, optimism +0.10, patience +0.10 |
| surprise | confidence +0.15, assertiveness +0.10, humility -0.10 |
| determination | assertiveness +0.10, persistence +0.15, patience +0.05 |
| boredom | extraversion -0.10, optimism -0.10, curiosity -0.10 |
| excitement | extraversion +0.12, risk_taking +0.10, playfulness +0.10 |
| wariness | caution +0.15, risk_taking -0.15, confidence -0.10 |
| contentment | emotional_stability +0.15, patience +0.12, neuroticism -0.12 |
| irritation | assertiveness +0.15, self_control -0.10, agreeableness -0.10, patience -0.10 |

## Personality Evolution

### Evolution Triggers

7 triggers map coding patterns to trait shifts:

| Trigger | Primary Effects | Correlated Shifts |
|---------|----------------|-------------------|
| sustained_debugging | patience +0.02, self_control +0.015, resilience +0.01, risk_taking -0.01 | loyalty (via patience->self_control correlation) |
| creative_exploration | curiosity +0.02, openness +0.015, caution -0.01, adventurousness +0.01 | innovation (via creativity correlation) |
| methodical_testing | conscientiousness +0.02, discipline +0.015, patience +0.01, playfulness -0.01 | discipline (via conscientiousness correlation) |
| collaborative_session | sociability +0.02, empathy +0.015, cooperativeness +0.01, independence -0.01 | warmth (via empathy correlation) |
| long_grind | persistence +0.02, resilience +0.015, optimism -0.01, patience +0.01 | resilience (via persistence correlation) |
| breakthrough | confidence +0.03, optimism +0.02, curiosity +0.015, neuroticism -0.02 | assertiveness (via confidence correlation) |
| cautious_recovery | caution +0.02, conscientiousness +0.015, risk_taking -0.015, patience +0.01 | discipline (via conscientiousness correlation) |

### Trait Correlation Matrix

When a trait shifts, correlated traits co-shift at a fraction of the magnitude:

| Source | Target | Ratio |
|--------|--------|-------|
| trust | loyalty | 0.30 |
| loyalty | trust | 0.25 |
| empathy | warmth | 0.30 |
| warmth | empathy | 0.25 |
| conscientiousness | discipline | 0.35 |
| discipline | conscientiousness | 0.30 |
| openness | curiosity | 0.30 |
| curiosity | openness | 0.25 |
| extraversion | sociability | 0.18 |
| sociability | extraversion | 0.15 |
| neuroticism | emotional_stability | -0.20 |
| emotional_stability | neuroticism | -0.18 |
| confidence | assertiveness | 0.30 |
| assertiveness | confidence | 0.25 |
| resilience | persistence | 0.30 |
| persistence | resilience | 0.25 |
| creativity | innovation | 0.30 |
| innovation | creativity | 0.25 |
| agreeableness | cooperativeness | 0.18 |
| cooperativeness | agreeableness | 0.15 |
| ambition | competitiveness | 0.25 |
| competitiveness | ambition | 0.20 |
| optimism | confidence | 0.25 |
| confidence | optimism | 0.20 |
| risk_taking | adventurousness | 0.30 |
| adventurousness | risk_taking | 0.25 |
| caution | risk_taking | -0.30 |
| risk_taking | caution | -0.25 |
| patience | self_control | 0.25 |
| self_control | patience | 0.20 |
| generosity | empathy | 0.20 |
| empathy | generosity | 0.15 |

### Dampened Trait Updates

Trait updates use two-stage dampening to prevent saturation:

**Stage 1 -- Frequency-dependent halving.** When trait > 0.70 (positive delta) or < 0.30 (negative delta), delta is halved. Models diminishing returns.

**Stage 2 -- Boundary fade.** When trait > 0.75 (positive delta) or < 0.25 (negative delta), delta is further scaled by remaining headroom toward hard limits.

```
Hard limits: [0.10, 0.90]
Boundary fade threshold: 0.75
Frequency-dependent threshold: 0.70
```

Formula for boundary fade (positive delta, trait > 0.75):
```
headroom = max(0.90 - current, 0)
delta *= headroom / (0.90 - 0.75)
```

### Shift Decay

Each personality shift decays linearly over `decay_ticks` (default 100):

```
current_magnitude(tick) = magnitude * max(0, 1 - (tick - tick_created) / decay_ticks)
```

## Tick Pipeline

The full cognitive tick executes these steps in order:

1. **Perception update** -- Map tool event to incremental perception vector changes
2. **Emotion triggers** -- Generate emotions from coding events (test pass/fail, novelty, etc.)
3. **Emotion decay** -- Filter out fully-decayed emotional states
4. **Apply personality shifts** -- Apply all active (non-decayed) trait shifts with dampening
5. **Check evolution triggers** -- Fire new shifts based on accumulated session patterns
6. **Compute perception vector** -- Produce the final 14-dim vector
7. **Director pool forward pass** -- Run all 5 RNNs, average their 6-dim outputs
8. **Council modulation** -- Compute 50-dim modulation vector from trait-weighted activations
9. **Emotional trait modifiers** -- Compute additive modifier from active emotions
10. **Decision** -- Run utility model with effective traits, council modulation, and director biases
11. **REINFORCE learning** -- Update all director RNNs from outcome signal
12. **Expression** -- Determine sprite expression from dominant emotion and action
13. **Speech selection** -- Select trait-filtered speech template (for speech actions only)
14. **Sprite rendering** -- Compose sprite frame with species, expression, and tick count

## Director Pool

5 fixed directors with functional roles, each running its own RNN:

| Role | Function |
|------|----------|
| Integrator | Synthesizes signals across all dimensions |
| Analyst | Systematic evaluation of the current situation |
| Evaluator | Assesses quality and outcomes |
| Strategist | Plans ahead, weighs long-term patterns |
| Critic | Identifies problems, flags risks |

Each director produces a 6-dim bias vector. The mean across all directors feeds into the decision model as `director_biases`.

## Species Trait Seeding

Each species defines 4 high traits (seeded to [0.65, 0.75]) and 2 low traits (seeded to [0.25, 0.35]). Remaining traits are seeded to [0.30, 0.70]. The exact value within each range is determined by the user's PRNG-generated trait seeds:

```
high_trait = 0.65 + seed * 0.10
low_trait  = 0.25 + seed * 0.10
other_trait = 0.30 + seed * 0.40
```

Where `seed` is a per-trait value in [0, 1] from the deterministic PRNG.
