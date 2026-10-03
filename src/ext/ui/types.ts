import type { Component, Ref } from 'vue';
import type { Game } from '../../engine/Core/Game';

/** Display-only services supplied by the shell; simulation changes use commands. */
export interface ModuleUiHost {
    readonly game: () => Game;
    readonly tick: Readonly<Ref<number>>;
    readonly immersive: Readonly<Ref<boolean>>;
    canOpenPanel(): boolean;
    beforeOpenPanel(): void;
    afterClosePanel(): void;
}
export interface ModuleUiSlot {
    readonly component: Component;
    readonly props: Record<string, unknown>;
}
export interface ModuleUiCommand {
    readonly id: string;
    readonly label: string;
    readonly glyph?: string;
    readonly disabled?: boolean;
    invoke(): void;
}
export interface ModuleUiSession {
    readonly hud: Readonly<Ref<ModuleUiSlot | null>>;
    readonly bar: Readonly<Ref<ModuleUiSlot | null>>;
    readonly panel: Readonly<Ref<ModuleUiSlot | null>>;
    readonly commands: Readonly<Ref<readonly ModuleUiCommand[]>>;
    readonly panelOpen: Readonly<Ref<boolean>>;
    refresh(): void;
    close(): void;
}
/** Pure declarations only. Session factories run solely for enabled modules. */
export interface ModuleUiContribution {
    readonly moduleId: string;
    readonly useSession?: (host: ModuleUiHost) => ModuleUiSession;
    /** Receives submitting/error props; emits complete(commands) or cancel. */
    readonly creationStep?: Component;
    /** Optional owned chunk loader. The menu resolves this before becoming inert. */
    readonly loadCreationStep?: () => Promise<Component>;
}
