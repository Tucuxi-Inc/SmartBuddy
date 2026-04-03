export declare const BuddyAction: {
    readonly OBSERVE: "observe";
    readonly CURIOUS_COMMENT: "curious_comment";
    readonly ENGAGE: "engage";
    readonly STUDY: "study";
    readonly ENCOURAGE: "encourage";
    readonly SUGGEST: "suggest";
    readonly CHALLENGE: "challenge";
    readonly TEACH: "teach";
    readonly EMOTE: "emote";
    readonly JOURNAL: "journal";
    readonly GIFT: "gift";
};
export type BuddyActionValue = typeof BuddyAction[keyof typeof BuddyAction];
export declare const SILENT_ACTIONS: Set<string>;
export declare const SPEECH_ACTIONS: Set<string>;
export declare function actionToBehavior(action: string): {
    action: string;
    description: string;
    isSilent: boolean;
    hasSpeech: boolean;
};
