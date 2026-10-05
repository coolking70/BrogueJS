/** Pure, module-independent codecs for the trusted phased attack executor.
 * The scheduler is the only clock. Metadata may describe its current geometry,
 * but cannot carry an additional countdown or change the declared attack. */
import { actorActionArray, actorActionRecord } from '../engine/Core/ActorActionData';
import {
    MAX_ACTOR_ACTION_BUNDLES, MAX_ACTOR_ACTION_PHASES, MAX_ACTOR_ACTION_TICKS,
    MAX_PARALLEL_ACTOR_ACTIONS, validateActorActionSchedulerState,
    type ActorSubaction,
} from '../engine/Core/ActorActionScheduler';
import { validateAttackShapeRequest, type AttackShapeRequest } from '../engine/Movement/AttackShape';
import type { ActorAttackDefinition, ActorAttackDefinitions, ActorAttackFacing, ProductionActorAttackState } from './actorActions';

const FACINGS: readonly ActorAttackFacing[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const MAX_DEFINITIONS = 128;
const MAX_RESOURCE = 1_000_000;
const MAX_CELLS = 1024;
const MAX_COORDINATE = 32767;
const MAX_JSON_VALUES = 1_000_000;
const MAX_JSON_STRING_UNITS = 8_000_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function fail(message: string): never { throw new Error(`Actor attack state: ${message}`); }
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail('invalid integer');
    return value;
}
function id(value: unknown): string {
    if (typeof value !== 'string' || value.length > 128 || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value)
        || FORBIDDEN_KEYS.has(value)) fail('invalid stable ID');
    return value;
}
/** Reject accessors, prototypes, symbols, sparse/decorated arrays and cycles
 * before reading nested DTO fields. Aliases cost their full serialized size. */
function plainJson(value: unknown): void {
    let values = 0, stringUnits = 0;
    const visiting = new Set<object>();
    const text = (part: string): void => {
        stringUnits += part.length;
        if (part.length > 65536 || stringUnits > MAX_JSON_STRING_UNITS) fail('JSON text budget exceeded');
    };
    const visit = (part: unknown, depth: number): void => {
        if (++values > MAX_JSON_VALUES || depth > 24) fail('JSON budget exceeded');
        if (part === null || typeof part === 'boolean') return;
        if (typeof part === 'string') { text(part); return; }
        if (typeof part === 'number') { integer(part, Number.MIN_SAFE_INTEGER); return; }
        if (typeof part !== 'object' || visiting.has(part)) fail('invalid JSON');
        const array = Array.isArray(part), prototype = Object.getPrototypeOf(part);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('invalid JSON prototype');
        const keys = Reflect.ownKeys(part);
        if (array && (part.length > MAX_JSON_VALUES || keys.length !== part.length + 1)) fail('invalid JSON array');
        if (keys.length > MAX_JSON_VALUES - values + (array ? 1 : 0)) fail('JSON budget exceeded');
        visiting.add(part);
        for (const key of keys) {
            if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) fail('invalid JSON key');
            if (array && key === 'length') continue;
            text(key);
            if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= part.length)) fail('invalid JSON array index');
            const descriptor = Object.getOwnPropertyDescriptor(part, key)!;
            if (!descriptor.enumerable || !('value' in descriptor)) fail('invalid JSON descriptor');
            visit(descriptor.value, depth + 1);
        }
        visiting.delete(part);
    };
    visit(value, 0);
}
function cells(value: unknown, minimum: number, maximum: number, coordinate: number, ordered: boolean): void {
    actorActionArray(value, minimum, maximum);
    const seen = new Set<string>();
    let previous: { x: number; y: number } | undefined;
    for (const cell of value) {
        actorActionRecord(cell, ['x', 'y']);
        const x = integer(cell.x, -coordinate, coordinate), y = integer(cell.y, -coordinate, coordinate);
        const key = `${x},${y}`;
        if (seen.has(key) || (ordered && previous && (previous.y > y || (previous.y === y && previous.x >= x))))
            fail('duplicate or noncanonical cells');
        seen.add(key); previous = { x, y };
    }
}

export function validateActorAttackDefinitions(value: unknown): asserts value is ActorAttackDefinitions {
    plainJson(value);
    actorActionRecord(value, ['attacks', 'profiles', 'resourcePolicies', 'nativeProfiles', 'playerProfileId', 'breakRecoveryTicks']);
    actorActionArray(value.attacks, 1, MAX_DEFINITIONS);
    actorActionArray(value.profiles, 1, MAX_DEFINITIONS);
    actorActionArray(value.resourcePolicies, 1, MAX_DEFINITIONS);
    actorActionArray(value.nativeProfiles, 0, MAX_DEFINITIONS);
    integer(value.breakRecoveryTicks, 1, MAX_ACTOR_ACTION_TICKS);
    const policies = new Map<string, number>(), attacks = new Map<string, number>(), profiles = new Set<string>();
    const allIds = new Set<string>();
    const define = (candidate: unknown): string => {
        const key = id(candidate);
        if (allIds.has(key)) fail('duplicate definition ID');
        allIds.add(key); return key;
    };
    for (const policy of value.resourcePolicies) {
        actorActionRecord(policy, ['id', 'initialStamina', 'staminaCapacity']);
        const key = define(policy.id), capacity = integer(policy.staminaCapacity, 1, MAX_RESOURCE);
        integer(policy.initialStamina, 0, capacity); policies.set(key, capacity);
    }
    for (const attack of value.attacks) {
        actorActionRecord(attack, ['id', 'nameKey', 'cost', 'windupTicks', 'recoveryTicks', 'segments']);
        const key = define(attack.id), cost = integer(attack.cost, 0, MAX_RESOURCE);
        if (typeof attack.nameKey !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,255}$/.test(attack.nameKey)) fail('invalid attack text key');
        let duration = integer(attack.windupTicks, 1, MAX_ACTOR_ACTION_TICKS)
            + integer(attack.recoveryTicks, 1, MAX_ACTOR_ACTION_TICKS);
        actorActionArray(attack.segments, 1, MAX_ACTOR_ACTION_PHASES - 1);
        for (const [index, segment] of attack.segments.entries()) {
            actorActionRecord(segment, ['delayTicks', 'shape', 'locationPolicy', 'targetPolicy', 'damageProfile', 'dodgeable', 'parryable']);
            duration += integer(segment.delayTicks, index === 0 ? 0 : 1, index === 0 ? 0 : MAX_ACTOR_ACTION_TICKS);
            if (segment.locationPolicy !== 'locked-world' || segment.targetPolicy !== 'part' || segment.damageProfile !== 'native-melee'
                || typeof segment.dodgeable !== 'boolean' || typeof segment.parryable !== 'boolean') fail('invalid segment policy');
            actorActionRecord(segment.shape, ['kind', 'offsets', 'selfExclusion', 'occlusion']);
            const shape = segment.shape;
            if (shape.kind !== 'footprint-offset-union' || !['source-member', 'whole-group'].includes(shape.selfExclusion as string)
                || shape.occlusion !== 'line-of-effect') fail('invalid segment shape');
            actorActionRecord(shape.offsets, FACINGS);
            for (const facing of FACINGS) cells(shape.offsets[facing], 1, 256, 32, false);
        }
        integer(duration, 1, MAX_ACTOR_ACTION_TICKS); attacks.set(key, cost);
    }
    for (const profile of value.profiles) {
        actorActionRecord(profile, ['id', 'resourcePolicyId', 'attackIds']);
        const key = define(profile.id), capacity = policies.get(id(profile.resourcePolicyId));
        if (capacity === undefined) fail('unknown resource policy');
        actorActionArray(profile.attackIds, 1, MAX_DEFINITIONS);
        const references = new Set<string>();
        for (const attackId of profile.attackIds) {
            const reference = id(attackId), cost = attacks.get(reference);
            if (references.has(reference) || cost === undefined || cost > capacity) fail('invalid profile attack reference or cost');
            references.add(reference);
        }
        profiles.add(key);
    }
    if (!profiles.has(id(value.playerProfileId))) fail('unknown player profile');
    const monsters = new Set<string>();
    for (const binding of value.nativeProfiles) {
        actorActionRecord(binding, ['monsterId', 'profileId']);
        const monster = id(binding.monsterId);
        if (monsters.has(monster) || !profiles.has(id(binding.profileId))) fail('duplicate or unknown native profile');
        monsters.add(monster);
    }
}

function sameShape(actual: AttackShapeRequest, attack: ActorAttackDefinition, facing: ActorAttackFacing, segment: number): boolean {
    const expected = attack.segments[segment]!.shape, offsets = expected.offsets[facing];
    return actual.selfExclusion === expected.selfExclusion && actual.offsets.length === offsets.length
        && actual.offsets.every((offset, index) => offset.x === offsets[index]!.x && offset.y === offsets[index]!.y);
}
/** A break keeps completed release phases, replaces the current tail and embeds
 * time already spent in its duration. It does not add an interruption clock. */
function validatePhases(child: ActorSubaction, attack: ActorAttackDefinition, breakTicks: number): boolean {
    const tail = child.phases[child.phases.length - 1]!;
    const broken = tail.kind === 'break-recovery';
    const releases = broken ? child.phases.length - 1 : attack.segments.length;
    if (releases > attack.segments.length || (!broken && child.phases.length !== releases + 1)) fail('attack phase count mismatch');
    for (let index = 0; index < releases; index++) {
        const phase = child.phases[index]!;
        const duration = index === 0 ? attack.windupTicks + attack.segments[0]!.delayTicks : attack.segments[index]!.delayTicks;
        if (phase.kind !== (index === 0 ? 'windup' : 'inter-segment') || phase.durationTicks !== duration
            || phase.segmentIndex !== index) fail('attack phase timing mismatch');
    }
    if (!broken) {
        if (tail.kind !== 'recovery' || tail.durationTicks !== attack.recoveryTicks) fail('attack recovery timing mismatch');
    } else {
        const interruptedDuration = releases === attack.segments.length ? attack.recoveryTicks
            : releases === 0 ? attack.windupTicks + attack.segments[0]!.delayTicks : attack.segments[releases]!.delayTicks;
        const minimum = releases === attack.segments.length ? Math.max(attack.recoveryTicks, breakTicks) : breakTicks;
        if (tail.durationTicks < minimum || tail.durationTicks > interruptedDuration + breakTicks
            || child.phaseIndex < releases) fail('invalid break recovery tail');
    }
    return broken;
}
function risks(value: unknown): void {
    actorActionArray(value, 0, MAX_CELLS);
    const targets = new Set<number>();
    for (const approval of value) {
        actorActionRecord(approval, ['targetId', 'risks']);
        const target = integer(approval.targetId, 1);
        if (targets.has(target)) fail('duplicate risk target');
        targets.add(target);
        actorActionArray(approval.risks, 0, 2);
        const kinds = new Set<unknown>();
        for (const risk of approval.risks) {
            actorActionRecord(risk, ['kind', 'target', 'message']);
            if (!['acid', 'ally'].includes(risk.kind as string) || kinds.has(risk.kind)
                || typeof risk.message !== 'string' || !risk.message.trim() || risk.message.length > 4096) fail('invalid attack risk');
            actorActionRecord(risk.target, ['kind', 'id']);
            if (risk.target.kind !== 'creature' || risk.target.id !== target) fail('risk target mismatch');
            kinds.add(risk.kind);
        }
    }
}

export function validateProductionActorAttackState(value: unknown, definitions: ActorAttackDefinitions): asserts value is ProductionActorAttackState {
    validateActorAttackDefinitions(definitions);
    plainJson(value);
    actorActionRecord(value, ['schema', 'revision', 'nextActionId', 'scheduler', 'actions', 'actors']);
    if (value.schema !== 1) fail('invalid schema');
    integer(value.revision, 0); const nextActionId = integer(value.nextActionId, 1);
    validateActorActionSchedulerState(value.scheduler);
    actorActionArray(value.actions, 0, MAX_ACTOR_ACTION_BUNDLES);
    actorActionArray(value.actors, 0, MAX_ACTOR_ACTION_BUNDLES);
    if (value.actions.length !== value.scheduler.bundles.length) fail('metadata and scheduler bundle mismatch');
    const bundles = new Map(value.scheduler.bundles.map(bundle => [bundle.actionId, bundle]));
    const attacks = new Map(definitions.attacks.map(attack => [attack.id, attack]));
    const profiles = new Map(definitions.profiles.map(profile => [profile.id, profile]));
    const policies = new Map(definitions.resourcePolicies.map(policy => [policy.id, policy]));
    const actors = new Map<number, string>();
    for (const actor of value.actors) {
        actorActionRecord(actor, ['actorId', 'profileId', 'stamina']);
        const actorId = integer(actor.actorId, 1), profile = profiles.get(id(actor.profileId));
        if (actors.has(actorId) || !profile) fail('duplicate actor or unknown profile');
        integer(actor.stamina, 0, policies.get(profile.resourcePolicyId)!.staminaCapacity);
        actors.set(actorId, profile.id);
    }
    const seenActions = new Set<number>(), seenSources = new Set<number>();
    for (const action of value.actions) {
        actorActionRecord(action, ['actionId', 'profileId', 'paidCost', 'subactions', ...(Object.prototype.hasOwnProperty.call(action, 'suppressTerminalSweep') ? ['suppressTerminalSweep'] : [])]);
        if (Object.prototype.hasOwnProperty.call(action, 'suppressTerminalSweep') && action.suppressTerminalSweep !== true) fail('invalid terminal sweep marker');
        const actionId = integer(action.actionId, 1), bundle = bundles.get(actionId), profile = profiles.get(id(action.profileId));
        if (seenActions.has(actionId) || actionId >= nextActionId || !bundle || !profile
            || actors.get(bundle.decisionOwnerId) !== profile.id) fail('invalid action identity or owner profile');
        seenActions.add(actionId);
        actorActionArray(action.subactions, 1, MAX_PARALLEL_ACTOR_ACTIONS);
        if (action.subactions.length !== bundle.subactions.length) fail('metadata and scheduler subaction mismatch');
        let paid = 0;
        for (const [index, subaction] of action.subactions.entries()) {
            actorActionRecord(subaction, ['sourceSubactionId', 'attackId', 'facing', 'lockedCells', 'shape', 'approvedRisks']);
            const child = bundle.subactions[index]!, attack = attacks.get(id(subaction.attackId));
            if (subaction.sourceSubactionId !== child.sourceSubactionId || seenSources.has(child.sourceEntityId)
                || !attack || !profile.attackIds.includes(attack.id) || !FACINGS.includes(subaction.facing as ActorAttackFacing))
                fail('invalid subaction identity, attack or facing');
            seenSources.add(child.sourceEntityId); paid += attack.cost;
            const broken = validatePhases(child, attack, definitions.breakRecoveryTicks);
            cells(subaction.lockedCells, 0, MAX_CELLS, MAX_COORDINATE, true);
            validateAttackShapeRequest(subaction.shape);
            const facing = subaction.facing as ActorAttackFacing;
            const phase = child.phases[child.phaseIndex];
            const segment = phase?.segmentIndex ?? attack.segments.length - 1;
            if (broken || child.cancelled) {
                if (!attack.segments.some((_segment, i) => sameShape(subaction.shape as AttackShapeRequest, attack, facing, i)))
                    fail('invalid retained attack shape');
            } else if (!sameShape(subaction.shape, attack, facing, segment)) fail('current attack shape mismatch');
            if (!child.cancelled && (broken || !phase || phase.segmentIndex === null) && (subaction.lockedCells as unknown[]).length)
                fail('recovery cannot retain preview cells');
            risks(subaction.approvedRisks);
        }
        if (action.paidCost !== paid || paid > policies.get(profile.resourcePolicyId)!.staminaCapacity) fail('incorrect paid action cost');
    }
}
