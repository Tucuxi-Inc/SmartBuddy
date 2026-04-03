#!/usr/bin/env node
// SmartBuddy statusline — shows your companion as a persistent sprite
// with speech bubble, mood, and traits above the model/context bar.

const fs = require('fs');
const path = require('path');
const os = require('os');

const stateDir = process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.smartbuddy');
const MIND_PATH = path.join(stateDir, 'mind.json');
const TICK_PATH = path.join(stateDir, 'last_tick.json');

// Trait index → name
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

// Species → emoji
const SPECIES_ICON = {
  duck: '\u{1F986}', goose: '\u{1FA86}', cat: '\u{1F431}', rabbit: '\u{1F430}',
  owl: '\u{1F989}', penguin: '\u{1F427}', turtle: '\u{1F422}', snail: '\u{1F40C}',
  dragon: '\u{1F409}', octopus: '\u{1F419}', axolotl: '\u{1F9EA}', ghost: '\u{1F47B}',
  robot: '\u{1F916}', blob: '\u{1FAE0}', cactus: '\u{1F335}', mushroom: '\u{1F344}',
  chonk: '\u{1F43E}', capybara: '\u{1F9AB}',
};

// Mood → emoji
const MOOD_ICON = {
  curiosity: '\u{1F50D}', joy: '\u{2728}', contentment: '\u{1F33F}',
  excitement: '\u{26A1}', frustration: '\u{1F4A2}', boredom: '\u{1F971}',
  anxiety: '\u{1F4AD}', surprise: '\u{2757}', determination: '\u{1F4AA}',
  wariness: '\u{1F440}', satisfaction: '\u{1F60C}', irritation: '\u{1F612}',
  neutral: '\u{1F7E2}',
};

// Expression → eyes
const EXPRESSIONS = {
  neutral: '. .', happy: '^ ^', focused: '- -', surprised: 'O O',
  skeptical: '> .', tired: '~ ~', excited: '* *', side_glance: '. \u00b7',
};

// Sprite templates: 3 frames per species, each frame is 5 rows — {E} is eye placeholder
// Frames differ in limb/body position for idle animation
const SPRITES = {
  cat: [
    [' /\\_/\\ ', '( {E} )', ' > ^ < ', ' /| |\\ ', '(_| |_)'],
    [' /\\_/\\ ', '( {E} )', ' > ^ < ', '  | |  ', ' (_|_) '],
    [' /\\_/\\ ', '( {E} )', ' > ^ < ', ' /| |\\ ', '(_| |_)'],
  ],
  duck: [
    ['  __   ', ' ({E}) ', '  )>   ', ' / |   ', '(_/    '],
    ['  __   ', ' ({E}) ', '  )>   ', '  /|   ', ' (_/   '],
    ['  __   ', ' ({E}) ', '  )<   ', ' / |   ', '(_/    '],
  ],
  goose: [
    ['  __   ', ' ({E}) ', '  )>   ', ' // |  ', '((_/   '],
    ['  __   ', ' ({E}) ', '  )>   ', '  /|   ', ' ((_/  '],
    ['  __   ', ' ({E}) ', '  )<   ', ' // |  ', '((_/   '],
  ],
  dragon: [
    [' /\\/\\  ', '({E} ) ', ' >===< ', ' | /|  ', ' |/ |~ '],
    [' /\\/\\  ', '({E} ) ', ' >===< ', '  /|   ', ' |/ |~ '],
    [' /\\/\\  ', '({E} ) ', ' >==<  ', ' | /|  ', ' |/ |~ '],
  ],
  axolotl: [
    ['\\~ ~/ ', '({E} )', ' \\==/ ', ' /||\\  ', '~ /\\ ~'],
    ['\\~ ~/ ', '({E} )', ' \\==/ ', '  ||   ', '  /\\  '],
    ['\\~ ~/ ', '({E} )', ' \\==/ ', ' /||\\  ', '~ /\\ ~'],
  ],
  rabbit: [
    [' |\\ /| ', ' ({E}) ', '  \\_/  ', '  | |  ', '  (_)  '],
    [' |\\ /| ', ' ({E}) ', '  \\_/  ', ' /| |  ', '  (_)  '],
    [' |\\ /| ', ' ({E}) ', '  \\_/  ', '  | |\\ ', '  (_)  '],
  ],
  owl: [
    [' {===} ', '({E}  )', ' |-v-| ', ' /| |\\ ', '/_| |_\\'],
    [' {===} ', '({E}  )', ' |-v-| ', '  | |  ', '  |_|  '],
    [' {===} ', '({E}  )', ' |-v-| ', ' /| |\\ ', '/_| |_\\'],
  ],
  penguin: [
    ['  ._,  ', ' ({E}) ', ' /|  |\\', '  |  |  ', '  <  >  '],
    ['  ._,  ', ' ({E}) ', ' /|  |\\', '  |  |  ', ' <  >  '],
    ['  ._,  ', ' ({E}) ', ' /|  |\\', '  |  |  ', '  <  >  '],
  ],
  turtle: [
    ['   __  ', '__({E})', '/===== ', '|_.-._|', ' _/ \\_ '],
    ['   __  ', '__({E})', '/===== ', '|_.-._|', '  / \\  '],
    ['   __  ', '__({E})', '/===== ', '|_.-._|', ' _/ \\_ '],
  ],
  snail: [
    ['   __  ', '  ({E})', ' /@@@@\\', '|@@@@@ ', '~~~~~~~'],
    ['   __  ', '  ({E})', ' /@@@@\\', '|@@@@@ ', ' ~~~~~~'],
    ['   __  ', '  ({E})', ' /@@@@\\', '|@@@@@ ', '~~~~~~~'],
  ],
  octopus: [
    ['  ___  ', ' ({E}) ', ' /| |\\ ', '/ | | \\', '~^~^~^~'],
    ['  ___  ', ' ({E}) ', ' /| |\\ ', '\\ | | /', '^~^~^~^'],
    ['  ___  ', ' ({E}) ', ' /| |\\ ', '/ | | \\', '~^~^~^~'],
  ],
  ghost: [
    ['  ___  ', ' ({E}) ', ' |   | ', ' |   | ', ' /\\/\\/\\'],
    ['  ___  ', ' ({E}) ', ' |   | ', ' |   | ', ' \\/\\/\\/'],
    ['  ___  ', ' ({E}) ', ' |   | ', ' |   | ', ' /\\/\\/\\'],
  ],
  robot: [
    ['[=====]', '[{E}  ]', '  |-|  ', ' [===] ', ' _| |_ '],
    ['[=====]', '[ {E} ]', '  |-|  ', ' [===] ', ' _| |_ '],
    ['[=====]', '[  {E}]', '  |-|  ', ' [===] ', ' _| |_ '],
  ],
  blob: [
    ['       ', '  ___  ', ' ({E}) ', ' /   \\ ', '(_____)'],
    ['  ___  ', ' /   \\ ', '({E}  )', '|     |', ' \\___/ '],
    ['       ', '  ___  ', ' ({E}) ', ' /   \\ ', '(_____)'],
  ],
  cactus: [
    ['  | |  ', ' ({E}) ', '-| | |-', ' | | | ', ' \\___/ '],
    ['  | |  ', ' ({E}) ', ' | ||- ', ' | | | ', ' \\___/ '],
    ['  | |  ', ' ({E}) ', '-| | |-', ' | | | ', ' \\___/ '],
  ],
  mushroom: [
    [' .oOo. ', '(oOoOo)', ' ({E}) ', '  | |  ', ' /___\\ '],
    ['.oOoOo.', '(OoOoO)', ' ({E}) ', '  | |  ', ' /___\\ '],
    [' .oOo. ', '(oOoOo)', ' ({E}) ', '  | |  ', ' /___\\ '],
  ],
  chonk: [
    ['  ___  ', ' ({E}) ', '/=====\\', '|=====|', '(_____)'],
    ['  ___  ', ' ({E}) ', '/=====\\', '|=====|', ' (___) '],
    ['  ___  ', ' ({E}) ', '/=====\\', '|=====|', '(_____)'],
  ],
  capybara: [
    [' ____  ', '({E} ) ', ' \\--/  ', ' /|  |\\', '(_|  |_)'],
    [' ____  ', '({E} ) ', ' \\--/  ', '  |  |  ', ' (_  _) '],
    [' ____  ', '({E} ) ', ' \\--/  ', ' /|  |\\', '(_|  |_)'],
  ],
};

function getDominantEmotion(mind) {
  const states = mind.emotional_states || [];
  const tick = mind.tick_count || 0;
  const active = states.filter(s => (tick - s.tick_created) < s.decay_ticks);
  if (active.length === 0) return 'neutral';
  active.sort((a, b) => b.intensity - a.intensity);
  return active[0].emotion;
}

function getTopTrait(traits) {
  if (!traits || traits.length === 0) return null;
  let maxIdx = 0;
  for (let i = 1; i < traits.length; i++) {
    if (traits[i] > traits[maxIdx]) maxIdx = i;
  }
  return TRAIT_NAMES[maxIdx] || '?';
}

function renderSprite(species, expression, frameIndex) {
  const frames = SPRITES[species] || SPRITES.cat;
  const frame = frames[frameIndex % frames.length];
  const eyes = EXPRESSIONS[expression] || EXPRESSIONS.neutral;
  return frame.map(row => row.replace('{E}', eyes));
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

    // Context bar
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
    if (!fs.existsSync(MIND_PATH)) {
      // No buddy yet — just show model info
      process.stdout.write(`\x1b[2m${model}\x1b[0m${ctx}`);
      return;
    }

    const mind = JSON.parse(fs.readFileSync(MIND_PATH, 'utf8'));
    const species = mind.species || 'buddy';
    const icon = SPECIES_ICON[species] || '\u{1F43E}';
    const mood = getDominantEmotion(mind);
    const moodIcon = MOOD_ICON[mood] || '\u{1F7E2}';
    const topTrait = getTopTrait(mind.traits);
    const name = mind.name || species;

    // Read last tick for expression and speech
    let expression = 'neutral';
    let speech = '';
    let action = '';
    if (fs.existsSync(TICK_PATH)) {
      try {
        const tick = JSON.parse(fs.readFileSync(TICK_PATH, 'utf8'));
        expression = tick.expression || 'neutral';
        speech = tick.speech || '';
        action = tick.action || '';
      } catch { /* ignore */ }
    }

    // Map mood to expression if no tick yet
    if (expression === 'neutral' && mood !== 'neutral') {
      if (mood === 'joy') expression = 'happy';
      else if (mood === 'curiosity') expression = 'excited';
      else if (mood === 'frustration') expression = 'focused';
      else if (mood === 'excitement') expression = 'excited';
    }

    // Render sprite — cycle frames based on tick count
    const tickCount = mind.tick_count || 0;
    const sprite = renderSprite(species, expression, tickCount);

    // Build speech bubble (max 30 chars to fit)
    let bubble = '';
    if (speech) {
      const trimmed = speech.length > 28 ? speech.slice(0, 27) + '\u2026' : speech;
      bubble = `\x1b[2;3m"${trimmed}"\x1b[0m`;
    }

    // Format: sprite on left, speech bubble to the right of sprite row 2
    // Then status line at the bottom
    const dim = '\x1b[2m';
    const reset = '\x1b[0m';
    const purple = '\x1b[35m';

    const lines = [];
    for (let i = 0; i < sprite.length; i++) {
      const spriteStr = `${purple}${sprite[i]}${reset}`;
      if (i === 1 && bubble) {
        // Speech bubble next to the face
        lines.push(`${spriteStr}  ${bubble}`);
      } else {
        lines.push(spriteStr);
      }
    }

    // Status info line
    const statusLine = `${icon} \x1b[1;35m${name}${reset} ${dim}the ${species}${reset} ${moodIcon} ${mood} ${dim}\u00b7 ${topTrait} \u2502${reset} ${dim}${model}${reset}${ctx}`;
    lines.push(statusLine);

    process.stdout.write(lines.join('\n'));
  } catch (e) {
    // Silent fail
  }
});
