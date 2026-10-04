import i18next from 'i18next';
import type { ExtensionModule, Json } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import { initialNarrativeState, isNarrativeState, validateNarrativeState, type NarrativeState } from './state';
import type { NarrativePack } from './types';
import { assertLoadedNarrativePack } from './schema';
import { enterNarrativeLevel } from './placement';
import { narrativeCommandInput, narrativeNextRevision, planNarrativeCommand } from './sessions';
import { projectNarrativeView } from './view';
import { narrativeActiveWorldValid, validateNarrativeRecording, validateNarrativeWorldBindings } from './validation';

/** 2b installs world placement and zero-tick sessions. Global fact/reward adapters are intentionally absent. */
export function createNarrativeModuleFromPack(pack: NarrativePack): ExtensionModule {
    assertLoadedNarrativePack(pack);
    const command = (action: 'open' | 'choose' | 'close'): NonNullable<ExtensionModule['commands']>[string] => (payload, context) => {
        const plan = planNarrativeCommand(pack, narrativeCommandInput(action, payload), context);
        context.setState(plan.nextState as unknown as Json);
        context.interactionGate(plan.nextState.active ? { targetEntityId: plan.nextState.active.targetEntityId, sessionId: plan.nextState.active.sessionId } : null);
        for (const message of plan.messages) context.message(i18next.t(message.textKey));
    };
    return {
        id: 'narrative', version: pack.moduleVersion,
        rules: { schema: pack.schema, version: pack.rulesVersion, fingerprint: extensionDataFingerprint(pack) },
        initialState: () => initialNarrativeState(pack) as unknown as Json,
        validateState: (value): value is Json => isNarrativeState(value, pack),
        worldInteractables: true,
        interactionCommands: ['choose', 'close'],
        projectView: context => projectNarrativeView(pack, context),
        validateComponents(state, _components, foundation) { return validateNarrativeWorldBindings(pack, state, foundation.world); },
        validateWorld(state, _components, _actors, world) {
            return validateNarrativeWorldBindings(pack, state, world) && narrativeActiveWorldValid(state as unknown as NarrativeState, world.entities, world.depth, world.isGameOver);
        },
        validateRecording: events => validateNarrativeRecording(pack, events),
        allowInput(action, data, context) {
            if (action !== 'ext:command') return true;
            try {
                if (typeof data !== 'string') return false;
                const input = JSON.parse(data);
                if (input?.module !== 'narrative') return true;
                planNarrativeCommand(pack, input, context);
                return true;
            } catch { return false; }
        },
        hooks: {
            enteredLevel: (event, context) => enterNarrativeLevel(pack, event, context),
            interactionClosed(event, context) {
                if (event.owner !== 'narrative') return;
                const state = validateNarrativeState(context.state, pack);
                if (!state.active || state.active.sessionId !== event.sessionId || state.active.targetEntityId !== event.targetEntityId) return;
                state.active = null; narrativeNextRevision(state); context.setState(state as unknown as Json);
            },
            interactablesRemoved(event, context) {
                if (event.owner !== 'narrative') return;
                const state = validateNarrativeState(context.state, pack);
                let changed = false;
                for (const id of event.entityIds) if (state.npcBindings[id]) { delete state.npcBindings[id]; changed = true; }
                if (changed) { narrativeNextRevision(state); context.setState(validateNarrativeState(state, pack) as unknown as Json); }
            },
        },
        commands: { open: command('open'), choose: command('choose'), close: command('close') },
    };
}
