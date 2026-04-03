export const BuddyAction = {
  OBSERVE: "observe",
  CURIOUS_COMMENT: "curious_comment",
  ENGAGE: "engage",
  STUDY: "study",
  ENCOURAGE: "encourage",
  SUGGEST: "suggest",
  CHALLENGE: "challenge",
  TEACH: "teach",
  EMOTE: "emote",
  JOURNAL: "journal",
  GIFT: "gift",
} as const;

export type BuddyActionValue = typeof BuddyAction[keyof typeof BuddyAction];

export const SILENT_ACTIONS = new Set<string>([
  BuddyAction.OBSERVE, BuddyAction.STUDY, BuddyAction.EMOTE, BuddyAction.JOURNAL,
]);

export const SPEECH_ACTIONS = new Set<string>([
  BuddyAction.CURIOUS_COMMENT, BuddyAction.ENGAGE, BuddyAction.ENCOURAGE,
  BuddyAction.SUGGEST, BuddyAction.CHALLENGE, BuddyAction.TEACH, BuddyAction.GIFT,
]);

const BEHAVIOR_DESCRIPTIONS: Record<string, string> = {
  [BuddyAction.OBSERVE]: "Watching quietly, absorbing patterns",
  [BuddyAction.CURIOUS_COMMENT]: "Reacting to something novel",
  [BuddyAction.ENGAGE]: "Actively responding to what's happening",
  [BuddyAction.STUDY]: "Silently learning about the codebase",
  [BuddyAction.ENCOURAGE]: "Cheering on good work",
  [BuddyAction.SUGGEST]: "Offering an observation",
  [BuddyAction.CHALLENGE]: "Gently questioning a choice",
  [BuddyAction.TEACH]: "Sharing something from past sessions",
  [BuddyAction.EMOTE]: "Expressing a mood",
  [BuddyAction.JOURNAL]: "Writing a journal entry",
  [BuddyAction.GIFT]: "Creating something useful",
};

export function actionToBehavior(action: string): {
  action: string; description: string; isSilent: boolean; hasSpeech: boolean;
} {
  return {
    action,
    description: BEHAVIOR_DESCRIPTIONS[action] ?? "Unknown action",
    isSilent: SILENT_ACTIONS.has(action),
    hasSpeech: SPEECH_ACTIONS.has(action),
  };
}
