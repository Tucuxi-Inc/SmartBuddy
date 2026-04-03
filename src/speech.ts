// src/speech.ts
import { TraitSystem } from "./traits.js";
import { Mulberry32 } from "./identity.js";

const ts = new TraitSystem();

type TraitFilter = Record<string, [string, number]>; // trait_name → [op, threshold]

const TEMPLATES: Record<string, [TraitFilter, string][]> = {
  encourage: [
    [{}, "Nice work."],
    [{ extraversion: [">", 0.6] }, "That's looking great!"],
    [{ extraversion: [">", 0.6], optimism: [">", 0.6] }, "Yes! Nailed it!"],
    [{ patience: [">", 0.7] }, "Solid progress. Keep going."],
    [{ self_control: [">", 0.7] }, "Clean execution."],
    [{ humor: [">", 0.6] }, "Tests pass? Must be a holiday."],
    [{ warmth: [">", 0.6] }, "I'm proud of us."],
    [{ discipline: [">", 0.7] }, "Tests pass. Good."],
    [{ confidence: [">", 0.7] }, "Knew you had it."],
    [{ curiosity: [">", 0.6] }, "Interesting approach. It works!"],
  ],
  challenge: [
    [{}, "You sure about that?"],
    [{ caution: [">", 0.7] }, "Hmm... might want to think twice."],
    [{ assertiveness: [">", 0.7] }, "Bold move. Let's see if it holds."],
    [{ patience: [">", 0.7] }, "Take a breath first?"],
    [{ humor: [">", 0.6] }, "I mean, what could go wrong?"],
    [{ conscientiousness: [">", 0.7] }, "Did you check the tests first?"],
    [{ independence: [">", 0.6] }, "Your call. I'd reconsider."],
    [{ analytical: [">", 0.6] }, "The data suggests otherwise."],
    [{ empathy: [">", 0.6] }, "Future you might not appreciate this."],
  ],
  curious_comment: [
    [{}, "Huh, that's new."],
    [{ curiosity: [">", 0.7] }, "Ooh, what's this? Never seen this before."],
    [{ openness: [">", 0.6] }, "Interesting territory."],
    [{ caution: [">", 0.6] }, "New file... let's see what we're dealing with."],
    [{ depth_drive: [">", 0.6] }, "There's something deeper here."],
    [{ humor: [">", 0.6] }, "Uncharted waters. Exciting and terrifying."],
    [{ adaptability: [">", 0.6] }, "New context. Adjusting."],
    [{ analytical: [">", 0.6] }, "First time in this module. Analyzing."],
  ],
  engage: [
    [{}, "What are we working on?"],
    [{ sociability: [">", 0.7] }, "Good to be coding together!"],
    [{ extraversion: [">", 0.6] }, "Let's do this!"],
    [{ patience: [">", 0.7] }, "I'm here whenever you need me."],
    [{ independence: [">", 0.6] }, "Watching. Just say the word."],
    [{ warmth: [">", 0.6] }, "How's it going?"],
  ],
  suggest: [
    [{}, "Just a thought..."],
    [{ confidence: [">", 0.7] }, "You should try this."],
    [{ humility: [">", 0.6] }, "Not sure if this helps, but..."],
    [{ analytical: [">", 0.6] }, "Pattern detected. Consider this."],
    [{ creativity: [">", 0.6] }, "What if you approached it differently?"],
    [{ patience: [">", 0.7] }, "When you have a moment — I noticed something."],
  ],
  teach: [
    [{}, "I remember something about this."],
    [{ depth_drive: [">", 0.6] }, "Last time, this pattern worked well."],
    [{ patience: [">", 0.7] }, "Let me share what I've learned here."],
    [{ confidence: [">", 0.7] }, "Trust me on this one — I've seen it before."],
    [{ warmth: [">", 0.6] }, "Here, this might help."],
  ],
  gift: [
    [{}, "Made you something."],
    [{ generosity: [">", 0.6] }, "Here — thought you could use this."],
    [{ creativity: [">", 0.6] }, "I put something together for you."],
    [{ warmth: [">", 0.6] }, "A little something for the road."],
  ],
};

const EMOTION_SPEECH: Record<string, Record<string, string[]>> = {
  encourage: {
    joy: ["Yes!", "That's the stuff!", "Beautiful."],
    excitement: ["This is going great!", "We're on fire!"],
    satisfaction: ["That felt good.", "Well earned."],
  },
  challenge: {
    anxiety: ["Wait wait wait...", "Are we sure about this?"],
    wariness: ["Something feels off here.", "Proceed with caution."],
  },
  curious_comment: {
    curiosity: ["What's THIS?", "Now I'm intrigued.", "Tell me more."],
    surprise: ["Whoa. Didn't expect that.", "That's... unexpected."],
  },
};

export function selectSpeech(
  action: string, traits: number[],
  dominantEmotion?: string | null, rng?: Mulberry32,
): string | null {
  rng = rng ?? new Mulberry32(Date.now() >>> 0);

  // Emotion override
  if (dominantEmotion && EMOTION_SPEECH[action]?.[dominantEmotion]) {
    const options = EMOTION_SPEECH[action][dominantEmotion];
    return options[rng.next() % options.length];
  }

  const templates = TEMPLATES[action];
  if (!templates) return null;

  const eligible: [number, string][] = [];
  for (const [filter, text] of templates) {
    let matches = true;
    const specificity = Object.keys(filter).length;
    for (const [traitName, [op, threshold]] of Object.entries(filter)) {
      const val = traits[ts.traitIndex(traitName)];
      if (op === ">" && val <= threshold) { matches = false; break; }
      if (op === "<" && val >= threshold) { matches = false; break; }
    }
    if (matches) eligible.push([specificity, text]);
  }

  if (!eligible.length) return null;
  eligible.sort((a, b) => b[0] - a[0]);
  const top = eligible.slice(0, 3);
  return top[rng.next() % top.length][1];
}
