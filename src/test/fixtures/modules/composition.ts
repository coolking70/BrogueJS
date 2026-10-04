import type { ModuleDescriptor } from '../../../ext/descriptor';
import type { ExtensionContext, ExtensionModule, Json } from '../../../ext/types';

interface FixtureState {
    initialized: boolean;
    turns: number;
    commands: number;
    lastRoll: number;
}

function isState(value: unknown): value is FixtureState & Json {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const state = value as FixtureState;
    return Object.keys(state).sort().join(',') === 'commands,initialized,lastRoll,turns'
        && typeof state.initialized === 'boolean'
        && [state.turns, state.commands, state.lastRoll].every(number => Number.isSafeInteger(number) && number >= 0);
}

/** Foundation-owned synthetic modules. No gameplay package is a fixture dependency. */
export function compositionDescriptor(id: string, options: {
    initialize?: boolean;
    trace?: string[];
    version?: string;
} = {}): ModuleDescriptor {
    const version = options.version ?? '1.0.0';
    const rules = { schema: 1, version, fingerprint: `sha256:${id === 'alpha' ? 'a'.repeat(64) : 'b'.repeat(64)}` };
    const initialCommand = { action: 'initialize', payload: { revision: 1 } };
    const validInitial = (action: string, payload: Json): boolean => action === initialCommand.action
        && JSON.stringify(payload) === JSON.stringify(initialCommand.payload);
    const create = (): ExtensionModule => {
        const update = (context: ExtensionContext, kind: 'turns' | 'commands'): void => {
            const state = context.state as unknown as FixtureState;
            context.setState({ ...state, [kind]: state[kind] + 1, lastRoll: context.randomInt(1, 1000) });
            context.setComponent(context.playerId, 'counter', { value: state[kind] + 1 });
        };
        return {
            id, version, rules,
            initialState: () => ({ initialized: !options.initialize, turns: 0, commands: 0, lastRoll: 0 }),
            validateState: isState,
            onNewGame(context) {
                options.trace?.push(`new:${id}`);
                context.setComponent(context.playerId, 'counter', { value: 0 });
            },
            onLoad() { options.trace?.push(`load:${id}`); },
            onUnload() { options.trace?.push(`unload:${id}`); },
            hooks: { playerTurnEnded(_event, context) { update(context, 'turns'); } },
            ...(options.initialize ? { initialCommand, validateInitialCommand: validInitial } : {}),
            readyToSave: context => (context.state as unknown as FixtureState).initialized,
            // Another selected module may initialize first. Only ordinary play waits for this module.
            allowInput: (action, _data, context) => action === 'ext:command'
                || (context.state as unknown as FixtureState).initialized,
            commands: {
                initialize(payload, context) {
                    const state = context.state as unknown as FixtureState;
                    if (!options.initialize || state.initialized || !validInitial('initialize', payload)) throw new Error('Invalid fixture initialization');
                    context.setState({ ...state, initialized: true });
                    options.trace?.push(`initialize:${id}`);
                },
                pulse(payload, context) {
                    if (payload !== null) throw new Error('Invalid fixture payload');
                    update(context, 'commands');
                },
            },
        };
    };
    return { id, version, rules, foundation: 4, labelKey: `ext.${id}.name`, create,
        locales: { en: { [`ext.${id}.name`]: `${id} fixture` } } };
}
