#!/usr/bin/env node
// SmartBuddy statusline — shows your companion's mood and traits
// Reads mind.json and displays buddy state alongside model/context info.

const fs = require('fs');
const path = require('path');
const os = require('os');

const MIND_PATH = path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.smartbuddy'), 'mind.json');

// Trait index → name (subset needed for display)
const TRAIT_NAMES = [
  'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism',
  'creativity', 'curiosity', 'adaptability', 'resilience', 'ambition',
  'empathy', 'trust', 'assertiveness', 'self_control', 'optimism',
  'risk_taking', 'patience', 'humor', 'independence', 'sensitivity',
  'depth_drive', 'dominance', 'warmth', 'discipline', 'integrity',
  'loyalty', 'competitiveness', 'generosity', 'pragmatism', 'idealism',
  'sociability', 'introversion', 'analytical', 'intuitive', 'emotional_stability',
  'persistence', 'flexibility', 'confidence', 'humility', 'cooperativeness',
  'resourcefulness', 'adventurousness', 'caution', 'traditionalism', 'innovation',
  'tolerance', 'expressiveness', 'stoicism', 'spirituality', 'playfulness',
];

// Species → display character
const SPECIES_ICON = {
  axolotl: '\u{1F9EA}',     // test tube (closest to axolotl in common terminals)
  cat: '\u{1F431}',
  dog: '\u{1F436}',
  fox: '\u{1F98A}',
  owl: '\u{1F989}',
  cactus: '\u{1F335}',
  mushroom: '\u{1F344}',
  octopus: '\u{1F419}',
  penguin: '\u{1F427}',
  parrot: '\u{1F99C}',
  chameleon: '\u{1F98E}',
  turtle: '\u{1F422}',
  dolphin: '\u{1F42C}',
  butterfly: '\u{1F98B}',
  firefly: '\u{2728}',
  mantis: '\u{1FAB2}',
  raven: '\u{1F426}',
  wolf: '\u{1F43A}',
};

// Mood → icon
const MOOD_ICON = {
  curiosity: '\u{1F50D}',
  joy: '\u{2728}',
  contentment: '\u{1F33F}',
  excitement: '\u{26A1}',
  frustration: '\u{1F4A2}',
  boredom: '\u{1F971}',
  anxiety: '\u{1F4AD}',
  pride: '\u{1F451}',
  surprise: '\u{2757}',
  neutral: '\u{1F7E2}',
};

function getDominantEmotion(mind) {
  const states = mind.emotional_states || [];
  const tick = mind.tick_count || 0;
  // Filter active emotions
  const active = states.filter(s => (tick - s.tick_created) < s.decay_ticks);
  if (active.length === 0) return 'neutral';
  // Pick highest intensity
  active.sort((a, b) => b.intensity - a.intensity);
  return active[0].emotion;
}

function getTopTrait(traits) {
  if (!traits || traits.length === 0) return null;
  let maxIdx = 0;
  for (let i = 1; i < traits.length; i++) {
    if (traits[i] > traits[maxIdx]) maxIdx = i;
  }
  return { name: TRAIT_NAMES[maxIdx] || '?', value: traits[maxIdx] };
}

// Read stdin (Claude Code passes session data)
let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const remaining = data.context_window?.remaining_percentage;

    // Context bar (same logic as GSD statusline)
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
      if (used < 50) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m\u{1F480} ${bar} ${used}%\x1b[0m`;
      }
    }

    // Read buddy state
    let buddyStr = '';
    if (fs.existsSync(MIND_PATH)) {
      try {
        const mind = JSON.parse(fs.readFileSync(MIND_PATH, 'utf8'));
        const species = mind.species || 'buddy';
        const icon = SPECIES_ICON[species] || '\u{1F43E}';
        const mood = getDominantEmotion(mind);
        const moodIcon = MOOD_ICON[mood] || '\u{1F7E2}';
        const top = getTopTrait(mind.traits);
        // Only show top trait if it differs from mood
        const topStr = (top && top.name !== mood) ? ` \x1b[2m\u00b7 ${top.name}\x1b[0m` : '';

        const name = mind.name || species;
        buddyStr = `${icon} \x1b[1;35m${name}\x1b[0m \x1b[2mthe ${species}\x1b[0m ${moodIcon} ${mood}${topStr} \x1b[2m\u2502\x1b[0m `;
      } catch (e) {
        // Buddy not hatched yet
      }
    }

    process.stdout.write(`${buddyStr}\x1b[2m${model}\x1b[0m${ctx}`);
  } catch (e) {
    // Silent fail
  }
});
