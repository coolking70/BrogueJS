import type { Component, Ref } from 'vue';
import type { Game } from '../../engine/Core/Game';
import type { ModalKeyHandler } from '../../ui/modalKeyboard';
import type { DialogService } from '../../ui/dialogService';

/** Display-only services supplied by the shell; simulation changes use commands. */
export interface ModuleUiHost {
    readonly game: () => Game;
    readonly tick: Readonly<Ref<number>>;
    readonly immersive: Readonly<Ref<boolean>>;
    /** The shell owns the sole modal host; modules contribute display-only content. */
    readonly dialogs?: DialogService;
    /** Optional display input ports; descriptor discovery must not initialize a
     * browser singleton. The application supplies its existing input owner. */
    registerKeyHandler?(handler: ModalKeyHandler, priority?: number): () => void;
    cancelHeldKeys?(): void;
    /** Live display lag only; replay/seek must keep their read-only module UI. */
    isPresentationBusy?(): boolean;
    canOpenPanel(): boolean;
    /** Additional shell-only modal competition guard for world interactions. */
    canOpenInteraction?(): boolean;
    /** Suppress a persisted interaction view during shell/lifecycle transitions. */
    canPresentInteraction?(): boolean;
    beforeOpenPanel(): void;
    afterClosePanel(): void;
}
/** Slots stay mounted during display lag. Teleported/multi-root components must
 * honor the reserved presentationHidden prop on their actual presentation root. */
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
