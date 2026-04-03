// src/sprites.ts
import { TraitSystem } from "./traits.js";
const ts = new TraitSystem();
export const EXPRESSIONS = {
    neutral: ". .",
    happy: "^ ^",
    focused: "- -",
    surprised: "O O",
    skeptical: "> .",
    tired: "~ ~",
    excited: "* *",
    side_glance: ". ·",
};
const SPRITE_TEMPLATES = {
    cat: [
        [[" /\\_/\\ "], [" /\\_/\\ "], [" /\\_/\\ "]],
        [["( {E} )"], ["( {E} )"], ["( {E} )"]],
        [[" > ^ < "], [" > ^ < "], [" > ^ < "]],
        [[" /| |\\ "], ["  | |  "], [" /| |\\ "]],
        [["(_| |_)"], [" (_|_) "], ["(_| |_)"]],
    ],
    duck: [
        [["  __   "], ["  __   "], ["  __   "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [["  )>   "], ["  )>   "], ["  )<   "]],
        [[" / |   "], ["  /|   "], [" / |   "]],
        [["(_/    "], [" (_/   "], ["(_/    "]],
    ],
    dragon: [
        [[" /\\/\\  "], [" /\\/\\  "], [" /\\/\\  "]],
        [["({E} ) "], ["({E} ) "], ["({E} ) "]],
        [[" >===< "], [" >===< "], [" >==<  "]],
        [[" | /|  "], ["  /|   "], [" | /|  "]],
        [[" |/ |~ "], [" |/ |~ "], [" |/ |~ "]],
    ],
    axolotl: [
        [["\\~ ~/ "], ["\\~ ~/ "], ["\\~ ~/ "]],
        [["({E} )"], ["({E} )"], ["({E} )"]],
        [[" \\==/ "], [" \\==/ "], [" \\==/ "]],
        [[" /||\\  "], ["  ||   "], [" /||\\  "]],
        [["~ /\\ ~"], ["  /\\  "], ["~ /\\ ~"]],
    ],
    goose: [
        [["  __   "], ["  __   "], ["  __   "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [["  )>   "], ["  )>   "], ["  )<   "]],
        [[" // |  "], ["  /|   "], [" // |  "]],
        [["((_/   "], [" ((_/  "], ["((_/   "]],
    ],
    rabbit: [
        [[" |\\ /| "], [" |\\ /| "], [" |\\ /| "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [["  \\_/  "], ["  \\_/  "], ["  \\_/  "]],
        [["  | |  "], [" /| |  "], ["  | |\\ "]],
        [["  (_)  "], ["  (_)  "], ["  (_)  "]],
    ],
    owl: [
        [[" {===} "], [" {===} "], [" {===} "]],
        [["({E}  )"], ["({E}  )"], ["({E}  )"]],
        [[" |-v-| "], [" |-v-| "], [" |-v-| "]],
        [[" /| |\\ "], ["  | |  "], [" /| |\\ "]],
        [["/_| |_\\"], ["  |_|  "], ["/_| |_\\"]],
    ],
    penguin: [
        [["  ._,  "], ["  ._,  "], ["  ._,  "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [[" /|  |\\ "], [" /|  |\\ "], [" /|  |\\ "]],
        [["  |  |  "], ["  |  |  "], ["  |  |  "]],
        [["  <  >  "], [" <  >  "], ["  <  >  "]],
    ],
    turtle: [
        [["   __  "], ["   __  "], ["   __  "]],
        [["__({E})"], ["__({E})"], ["__({E})"]],
        [["/===== "], ["/===== "], ["/===== "]],
        [["|_.-._|"], ["|_.-._|"], ["|_.-._|"]],
        [[" _/ \\_ "], ["  / \\  "], [" _/ \\_ "]],
    ],
    snail: [
        [["   __  "], ["   __  "], ["   __  "]],
        [["  ({E})"], ["  ({E})"], ["  ({E})"]],
        [[" /@@@@\\"], [" /@@@@\\"], [" /@@@@\\"]],
        [["|@@@@@ "], ["|@@@@@ "], ["|@@@@@ "]],
        [["~~~~~~~"], [" ~~~~~~"], ["~~~~~~~"]],
    ],
    octopus: [
        [["  ___  "], ["  ___  "], ["  ___  "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [[" /| |\\ "], [" /| |\\ "], [" /| |\\ "]],
        [["/ | | \\"], ["\\ | | /"], ["/ | | \\"]],
        [["~^~^~^~"], ["^~^~^~^"], ["~^~^~^~"]],
    ],
    ghost: [
        [["  ___  "], ["  ___  "], ["  ___  "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [[" |   | "], [" |   | "], [" |   | "]],
        [[" |   | "], [" |   | "], [" |   | "]],
        [[" /\\/\\/\\"], [" \\/\\/\\/"], [" /\\/\\/\\"]],
    ],
    robot: [
        [["[=====]"], ["[=====]"], ["[=====]"]],
        [["[{E}  ]"], ["[{E}  ]"], ["[{E}  ]"]],
        [["  |-|  "], ["  |-|  "], ["  |-|  "]],
        [[" [===] "], [" [===] "], [" [===] "]],
        [[" _| |_ "], [" _| |_ "], [" _| |_ "]],
    ],
    blob: [
        [["       "], ["  ___  "], ["       "]],
        [["  ___  "], [" /   \\ "], ["  ___  "]],
        [[" ({E}) "], ["({E}  )"], [" ({E}) "]],
        [[" /   \\ "], ["|     |"], [" /   \\ "]],
        [["(_____) "], [" \\___/ "], ["(_____) "]],
    ],
    cactus: [
        [["  | |  "], ["  | |  "], ["  | |  "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [["-| | |-"], ["-| | |-"], ["-| | |-"]],
        [[" | | | "], [" | | | "], [" | | | "]],
        [[" \\___/ "], [" \\___/ "], [" \\___/ "]],
    ],
    mushroom: [
        [[" .oOo. "], [" .oOo. "], [" .oOo. "]],
        [["(oOoOo)"], ["(oOoOo)"], ["(oOoOo)"]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [["  | |  "], ["  | |  "], ["  | |  "]],
        [[" /___\\ "], [" /___\\ "], [" /___\\ "]],
    ],
    chonk: [
        [["  ___  "], ["  ___  "], ["  ___  "]],
        [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
        [["/=====\\"], ["/=====\\"], ["/=====\\"]],
        [["|=====|"], ["|=====|"], ["|=====|"]],
        [["(_____) "], [" (___) "], ["(_____) "]],
    ],
    capybara: [
        [["  ____  "], ["  ____  "], ["  ____  "]],
        [[" ({E} ) "], [" ({E} ) "], [" ({E} ) "]],
        [["  \\--/  "], ["  \\--/  "], ["  \\--/  "]],
        [[" /|  |\\ "], ["  |  |  "], [" /|  |\\ "]],
        [["(_|  |_)"], [" (_  _) "], ["(_|  |_)"]],
    ],
};
const DEFAULT_SPRITE = [
    [["  ___  "], ["  ___  "], ["  ___  "]],
    [[" ({E}) "], [" ({E}) "], [" ({E}) "]],
    [[" |   | "], [" |   | "], [" |   | "]],
    [[" |   | "], ["  | |  "], [" |   | "]],
    [[" |___|"], ["  |_| "], [" |___|"]],
];
export function getExpression(action, dominantEmotion, councilActivations, sessionMomentum) {
    if (dominantEmotion === "joy")
        return "happy";
    if (dominantEmotion === "surprise")
        return "surprised";
    if (dominantEmotion === "curiosity")
        return "excited";
    if (dominantEmotion === "frustration" || dominantEmotion === "irritation")
        return "focused";
    if (action === "challenge" && (councilActivations.prudence ?? 0) > 0.3)
        return "skeptical";
    if (sessionMomentum < 0.2)
        return "tired";
    if (action === "study")
        return "focused";
    return "neutral";
}
export function getSpriteFrame(species, expression = "neutral", frameIndex = 0) {
    const template = SPRITE_TEMPLATES[species] ?? DEFAULT_SPRITE;
    const numFrames = template[0].length;
    const fi = frameIndex % numFrames;
    const eyes = EXPRESSIONS[expression] ?? EXPRESSIONS.neutral;
    return template.map(row => row[fi][0].replace("{E}", eyes));
}
export function checkAdornments(traits, traitsAtCreation, frustrationCount = 0, challengeCount = 0) {
    const earned = [];
    if (frustrationCount >= 50)
        earned.push("battle_scars");
    if (traits[ts.traitIndex("analytical")] > 0.80)
        earned.push("reading_glasses");
    let maxShift = 0;
    for (let i = 0; i < traits.length; i++) {
        maxShift = Math.max(maxShift, Math.abs(traits[i] - traitsAtCreation[i]));
    }
    if (maxShift > 0.30)
        earned.push("star_mark");
    if (traits[ts.traitIndex("sociability")] > 0.75 && traits[ts.traitIndex("empathy")] > 0.75)
        earned.push("heart");
    if (traits[ts.traitIndex("assertiveness")] > 0.80 && challengeCount >= 20)
        earned.push("lightning");
    return earned;
}
//# sourceMappingURL=sprites.js.map