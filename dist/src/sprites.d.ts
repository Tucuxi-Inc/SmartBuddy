export declare const EXPRESSIONS: Record<string, string>;
export declare function getExpression(action: string, dominantEmotion: string | null, councilActivations: Record<string, number>, sessionMomentum: number): string;
export declare function getSpriteFrame(species: string, expression?: string, frameIndex?: number): string[];
export declare function checkAdornments(traits: number[], traitsAtCreation: number[], frustrationCount?: number, challengeCount?: number): string[];
