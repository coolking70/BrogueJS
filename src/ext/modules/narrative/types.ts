/** Version 1 mechanical data. Display assets/locales are deliberately separate. */
export type Id = string;
export type TextKey = string;
export type Scalar = boolean | number | string;
export type Cmp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
export type Condition =
    | { readonly op: 'true' }
    | { readonly op: 'all' | 'any'; readonly args: readonly Condition[] }
    | { readonly op: 'not'; readonly arg: Condition }
    | { readonly op: 'flag'; readonly id: Id; readonly equals: Scalar }
    | { readonly op: 'counter'; readonly id: Id; readonly compare: Cmp; readonly value: number }
    | { readonly op: 'depth'; readonly min: number; readonly max: number }
    | { readonly op: 'event-field'; readonly field: 'firstVisit' | 'npcId' | 'choiceId'; readonly equals: Scalar }
    | { readonly op: 'optional-player'; readonly capability: 'growth.public-character.v1';
        readonly field: 'level' | 'professionId' | 'lineageId' | 'faithId';
        readonly compare: 'eq' | 'gte'; readonly value: number | string; readonly onUnavailable: boolean };
export type Effect =
    | { readonly kind: 'set-flag'; readonly id: Id; readonly value: Scalar }
    | { readonly kind: 'add-counter'; readonly id: Id; readonly amount: number }
    | { readonly kind: 'journal'; readonly entryId: Id }
    | { readonly kind: 'message'; readonly textKey: TextKey }
    | { readonly kind: 'emit-story'; readonly eventId: Id }
    | { readonly kind: 'optional-reward'; readonly capability: 'growth.story-reward.v1';
        readonly rewardId: Id; readonly receiptId: Id; readonly onUnavailable: 'skip' };
export interface Choice {
    readonly id: Id; readonly textKey: TextKey; readonly condition: Condition;
    readonly unavailable: 'hide' | 'disable'; readonly unavailableKey: TextKey | null;
    readonly effects: readonly Effect[]; readonly next: Id | null;
}
export interface DialogueNode {
    readonly id: Id; readonly textKey: TextKey; readonly portraitId: Id | null; readonly choices: readonly Choice[];
}
export interface DialogueDefinition {
    readonly id: Id; readonly entry: Id; readonly nodes: readonly DialogueNode[];
}
export interface NpcPlacement {
    readonly id: Id; readonly minDepth: number; readonly maxDepth: number;
    readonly maxPerRun: number; readonly maxPerDepth: number; readonly minStairDistance: number;
    readonly maxEntranceDistance: number; readonly onNoSpace: 'skip' | 'defer';
}
/** Content binding for a stationary, passable foundation interactable. */
export interface NpcDefinition {
    readonly id: Id; readonly nameKey: TextKey; readonly descriptionKey: TextKey;
    readonly glyph: string; readonly color: string; readonly portraitId: Id | null; readonly dialogueId: Id;
    readonly presence: 'stationary-interactable'; readonly interactionDistance: number;
    readonly placements: readonly NpcPlacement[];
}
export type TriggerEvent =
    | { readonly kind: 'entered-level' }
    | { readonly kind: 'npc-interacted'; readonly npcId: Id }
    | { readonly kind: 'dialogue-choice'; readonly dialogueId: Id; readonly choiceId: Id }
    | { readonly kind: 'story'; readonly eventId: Id };
export interface Trigger {
    readonly id: Id; readonly on: TriggerEvent; readonly priority: number; readonly condition: Condition;
    readonly repeat: { readonly kind: 'once-per-run' } | { readonly kind: 'once-per-depth' }
        | { readonly kind: 'bounded'; readonly maxFirings: number; readonly cooldownTurns: number };
    readonly effects: readonly Effect[];
}
export interface FlagDefinition {
    readonly id: Id; readonly type: 'boolean' | 'integer' | 'string'; readonly initial: Scalar;
    readonly min: number | null; readonly max: number | null; readonly values: readonly string[] | null;
}
export interface CounterDefinition {
    readonly id: Id; readonly initial: number; readonly min: number; readonly max: number;
}
export interface NarrativeLimits {
    readonly conditionDepth: number; readonly conditionOpsPerCommand: number;
    readonly effectsPerCommand: number; readonly eventsPerCommand: number;
    readonly transitionsPerSession: number; readonly maxActiveNpcs: number;
    readonly maxJournalEntries: number; readonly maxReceipts: number;
}
export interface NarrativePack {
    readonly schema: 1; readonly moduleId: 'narrative'; readonly moduleVersion: '1.3.0'; readonly rulesVersion: '1.3.0';
    readonly stateVersion: 3; readonly inputVersion: 2;
    readonly config: { readonly timePolicy: 'free-frozen'; readonly closePolicy: 'close-session'; readonly limits: NarrativeLimits };
    readonly flags: readonly FlagDefinition[]; readonly counters: readonly CounterDefinition[];
    readonly npcs: readonly NpcDefinition[]; readonly dialogues: readonly DialogueDefinition[];
    readonly journal: readonly { readonly id: Id; readonly titleKey: TextKey; readonly textKey: TextKey }[];
    readonly storyEvents: readonly { readonly id: Id }[]; readonly triggers: readonly Trigger[];
}
export interface PortraitManifest {
    readonly schema: 1; readonly displayVersion: string;
    readonly portraits: readonly { readonly id: Id; readonly asset: string | null; readonly width: number; readonly height: number;
        readonly fit: 'contain'; readonly anchor: 'bottom-center'; readonly altKey: TextKey; readonly fallbackGlyph: string }[];
}
export type NarrativeLocales = Readonly<Record<TextKey, string>>;
