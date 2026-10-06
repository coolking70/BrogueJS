import { installRecordingScene } from '../../../../test/support/recordingV4';
import { installedOptionalModules } from '../../../../test/support/installedExtensions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startGiants, json } from './naturalFixture';
import { loadGiantsDefinitionPack } from '../definitions';
import { createGiantsModuleFromPack } from '../module';
import { extensionDataFingerprint } from '../../../fingerprint';
import * as catalog from '../../../catalog';
import { validateProductionActorAttackState } from '../../../actorActionValidation';
import { registryFromDescriptors } from '../../../descriptor';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { withBodyContact, withBodyAttackContact, withWholeBodyDamage } from '../../../../engine/Combat/BodyCombat';
import { ActorCombatResolutionAuthority } from '../../../../engine/Combat/ActorCombatResolution';
import { withActorActionScope } from '../../../../engine/Core/ActorActionScope';
import { preparePhasedAttackCommand, commitPhasedAttackCommand } from '../../../../engine/Core/PhasedAttackProduction';
import { sourceFootprintVersion } from '../../../../engine/Movement/AttackShape';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { withSquareContactScope } from '../../../../engine/Movement/SpatialContactScope';
import { fixedZoneBreaks, fixedZoneDamageMultiplier } from '../../../../engine/Combat/FixedZoneHealth';
import { publicMonsterZones, publicZoneAt } from '../../../../engine/UI/MonsterZones';
import { TerrainType as T, DungeonLayer as L } from '../../../../engine/Map/Grid';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import { Game } from '../../../../engine/Core/Game';
import species from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { selectBossHud } from '../ui/view';
import { targetingState } from '../../../../ui/targeting';

/** Production authority, with a second local zone only in this explicit
 * diagnostic pack. The formal shell/head content remains separately tested. */
function configure(twoZones = false, provider?: import('../../../partBreak').PartBreakProvider, sourceProfile = false, square = false, nativeOnly = false) {
    const pack = loadGiantsDefinitionPack();
    if (square) Object.assign(pack.forms[2]!.footprint!, { geometry: { kind: 'rect', width: 2, height: 2 },
        zoneCells: [{ x: 0, y: 0, zoneId: 'head' }, { x: 1, y: 0, zoneId: 'shell' }, { x: 1, y: 1, zoneId: 'shell' }] });
    if (nativeOnly) Object.assign(pack.forms[2]!.footprint!.zones![0]!, { health: { kind: 'native' }, breakRuleId: 'foundation:keep-zone' });
    if (twoZones) {
        const f = pack.forms[2]!;
        (f.footprint!.zones as import('../../../../engine/Movement/SpatialSchema').HitZoneDefinition[]).push({ id: 'tail', nameKey: 'ext.giants.spine_crawler.shell', health: { kind: 'local', maxHp: 10,
            ownerTransfer: { numerator: 1, denominator: 1 } }, armor: 0, damageMultiplier: { numerator: 1, denominator: 1 }, breakRuleId: 'foundation:keep-zone' });
        (f.footprint!.zoneCells as {x:number;y:number;zoneId:string}[]).push({ x: 3, y: 0, zoneId: 'tail' });
    }
    if (sourceProfile) {
        (pack.forms[2]!.breakRules![0]!.modifiers as import('../../../../engine/Movement/SpatialSchema').PartBreakRule['modifiers'][number][])
            .push({ kind: 'disable-attack', attackId: 'fixture.stomp' });
    }
    const module = () => ({ ...createGiantsModuleFromPack(pack), ...(provider ? { optionalPartBreaks: { 'combat.part-break.v1': provider } } : {}) });
    const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(d => {
        if (d.id === 'giants') return { ...d, create: module, rules: module().rules };
        if (d.id !== 'combat') return d;
        // An explicit fixture provider replaces the installed combat provider,
        // never registers a competing second owner.
        if (!sourceProfile) return provider ? { ...d, create: () => ({ ...d.create(), optionalPartBreaks: undefined }) } : d;
        // Use the foundation's installed declaration rather than importing
        // another module's implementation. The existing attack/profile stays
        // unchanged; only this diagnostic source binding is added.
        const original = d.create(), base = provider ? { ...original, optionalPartBreaks: undefined } : original, definitions = json(base.actorActions!.definitions) as unknown as import('../../../actorActions').ActorAttackDefinitions;
        (definitions.nativeProfiles as { monsterId: string; profileId: string }[]).push({ monsterId: 'giants.spine-crawler', profileId: 'combat.shock-ring' });
        const rules = { ...base.rules!, fingerprint: extensionDataFingerprint(definitions) };
        return { ...d, rules, create: () => ({ ...base, rules, actorActions: { ...base.actorActions!, definitions: definitions as unknown as import('../../../types').Json } }) };
    }));
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
}
function arena(game: Game) {
    game.animationEnabled = false; game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let y = 0; y < game.grid.height; y++) for (let x = 0; x < game.grid.width; x++) {
        game.grid.setTerrain(x, y, x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR);
        for (const layer of [L.LIQUID, L.SURFACE, L.GAS]) game.grid.setTerrainLayer(x, y, layer, T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    commitCreatureAnchor(game.player, { x: 22, y: 11 });
    const boss = game.createModuleMonster('giants.spine-crawler', { x: 20, y: 12 })!;
    boss.state = MonsterState.HUNTING; boss.ticksUntilTurn = 10000; boss.defense = -1000;
    (game as any).updateVision(); return boss;
}
function scene(ids = ['giants']) { const game = startGiants(ids, 44006, 'wizard'), boss = arena(game); return { game, boss }; }
function hit(game: Game, boss: Monster, damage: number, zone = 'shell') {
    const contact = footprintOf(boss).find(p => p.zoneId === zone)!;
    const origin = game.extensionRuntime!.causality.create('melee', game.player.id);
    return game.extensionRuntime!.causality.withOrigin(origin, () => withBodyContact(boss, contact,
        () => boss.takeDamage(damage, true, game.grid, undefined, 'physical')));
}
const state = (g: Game) => g.extensionRuntime!.actorActionBinding()!.state;
const command = JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId: 'fixture.slash', facing: 's' } });
const world = (game: Game) => { const s = json(game.toSnapshot()); s.savedAt = 0;   return s; };
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; targetingState.aim = null; });

describe('4c production fixed zones', () => {
    it('installed rectangular square zones use the same movement, health and trusted save closure', () => {
        configure(false, undefined, false, true); const { game, boss } = scene();
        expect(footprintOf(boss)).toHaveLength(4); expect(() => game.spatialOf(boss)).not.toThrow();
        hit(game, boss, 60); expect(boss.hp).toBe(120); expect(boss.movementSpeed).toBe(150);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
        expect(game.monsters.find(m => m.id === boss.id)!.spatial!.zoneState![0]!.broken).toBe(true);
    });
    it('native-only zone labels publish public HP and receive distinct area contacts without a local ledger', () => {
        configure(false, undefined, false, false, true); const { game, boss } = scene();
        expect(boss.spatial!.zoneState).toBeUndefined();
        const frame = observeDisplayFrame(game, logger);
        expect(frame.rows.find(r => r.id === boss.id)).toMatchObject({ zones: [{ id: 'shell', hp: 150 }, { id: 'head', hp: 150 }] });
        for (const p of footprintOf(boss).filter(p => p.zoneId !== 'body')) game.grid.setTerrainLayer(p.x, p.y, L.SURFACE, T.GAS_EXPLOSION);
        const damage = vi.spyOn(boss.extensionHooks!, 'damage');
        withSquareContactScope(game.grid, new Set(), () => (game as any).resolveExplosionDamage(boss));
        expect(damage).toHaveBeenCalledTimes(2); expect(boss.hp).toBe(0);
    });
    it.each([[], ...installedOptionalModules(['growth', 'combat']).map(id => [id])].map(optional => ({ ids: ['giants', ...optional] })))('native melee in %j uses one roll, one transfer/event and no local kill', ({ids}) => {
        const { game, boss } = scene(ids);
        const source = new Monster(22, 11, species.find(m => m.id === 'ogre')! as MonsterData);
        source.damageString = '60-60'; source.accuracy = 1000; source.isAlly = true; source.state = MonsterState.HUNTING;
        game.monsters.push(source);
        const damage = vi.spyOn(boss.extensionHooks!, 'damage'), death = vi.spyOn(game as any, 'triggerDeathFeatures');
        const transfer = vi.spyOn(CombatSystem, 'transferMonsterHealth'), roll = vi.spyOn(CombatSystem, 'parseDamageString');
        const effects = vi.spyOn(source.extensionHooks!, 'afterAttack');
        const shell = footprintOf(boss).find(p => p.zoneId === 'shell')!;
        const result = withBodyAttackContact(source, boss, { from: { ...source.loc, zoneId: 'body' }, to: shell, distance: 1 },
            () => CombatSystem.attack(source, boss, { grid: game.grid }));
        expect(result.hit).toBe(true); expect(boss.hp).toBe(120);
        expect(boss.spatial!.zoneState).toEqual([{ zoneId: 'shell', hp: 0, broken: true, generation: 0 }]);
        expect(damage).toHaveBeenCalledTimes(1); expect(damage.mock.calls[0]!.slice(1, 3)).toEqual([30, 150]);
        expect(transfer).toHaveBeenCalledTimes(1); expect(transfer.mock.calls[0]![2]).toBe(30);
        expect(effects).toHaveBeenCalledTimes(1); expect(roll).toHaveBeenCalledTimes(1); expect(death).not.toHaveBeenCalled();
        expect(boss.deathProcessed).toBe(false); expect(game.stats.kills).toBe(0);
        expect(boss.movementSpeed).toBe(150); expect(boss.spatial!.actionLockInTicks).toBe(ids.includes('combat') ? undefined : 50);
        const before = boss.hp; hit(game, boss, 60); expect(boss.hp).toBe(before); expect(fixedZoneBreaks(boss, game.extensionRuntime!.spatialCatalog)).toHaveLength(1);
        hit(game, boss, 6, 'head'); expect(boss.hp).toBe(108); expect(boss.spatial!.zoneState![0]!.hp).toBe(0);
    });
    it('a real thrown weapon keeps its actual cell and capped transfer', () => {
        const { game, boss } = scene(); const item = ItemLoader.spawnWeapon('dagger', 0, 0, 1)!;
        item.damage = '60-60'; item.enchantment = 20;
        const contact = footprintOf(boss).find(p => p.zoneId === 'shell')!, transfer = vi.spyOn(CombatSystem, 'transferMonsterHealth');
        const result = withBodyContact(boss, contact, () => CombatSystem.resolveThrownWeapon(game.player, boss, item, game.grid));
        expect(result.hit).toBe(true); expect(result.killed).toBe(false); expect(boss.hp).toBe(120);
        expect(transfer).toHaveBeenCalledTimes(1); expect(transfer.mock.calls[0]![2]).toBe(30);
    });
    it('a piercing monster bolt hits each contacted zone once, with actual transference', () => {
        const { game, boss } = scene();
        const caster = new Monster(18, 12, species.find(m => m.id === 'lich')! as MonsterData); caster.isAlly = true; game.monsters.push(caster);
        const event = vi.spyOn(boss.extensionHooks!, 'damage'), transfer = vi.spyOn(CombatSystem, 'transferMonsterHealth');
        game.castMonsterBolt(caster, boss, 'SPARK');
        expect(event.mock.calls.length).toBeGreaterThan(0);
        expect(event.mock.calls.length).toBeLessThanOrEqual(3);
        expect(transfer.mock.calls.filter(c => c[1] === boss).map(c => c[2])).toEqual(event.mock.calls.map(c => c[1]));
        expect(boss.spatial!.zoneState![0]!.hp).toBeLessThan(30);
    });
    it('native sweep remembers distinct shell/tail contacts rather than reducing both to nearest cell', () => {
        configure(true); const { game, boss } = scene();
        commitCreatureAnchor(game.player, { x: 22, y: 11 });
        const weapon = ItemLoader.spawnWeapon('axe', 0, 0, 1)!; weapon.damage = '8-8'; weapon.enchantment = 20; weapon.flags = ['ITEM_ATTACKS_ALL_ADJACENT']; game.player.equippedWeapon = weapon;
        const event = vi.spyOn(boss.extensionHooks!, 'damage'); game.executeCommand('move', { x: 0, y: 1 });
        expect(event).toHaveBeenCalledTimes(2); expect(boss.spatial!.zoneState!.every(z => z.hp < (z.zoneId === 'shell' ? 30 : 10))).toBe(true);
    });
    it('a single explosive area wave damages two local zones once each and does not reapply on repeat contacts', () => {
        configure(true); const { game, boss } = scene();
        // Existing CE explosive terrain contact; this is a real environment exit.
        for (const p of footprintOf(boss).filter(p => p.zoneId !== 'head')) game.grid.setTerrainLayer(p.x, p.y, L.SURFACE, T.GAS_EXPLOSION);
        const damage = vi.spyOn(boss.extensionHooks!, 'damage'), scope = new Set<string>();
        withSquareContactScope(game.grid, scope, () => {
            (game as any).resolveExplosionDamage(boss); (game as any).resolveExplosionDamage(boss);
        });
        expect(damage).toHaveBeenCalledTimes(2); expect(boss.hp).toBe(110);
        expect(boss.spatial!.zoneState!.every(z => z.broken)).toBe(true); expect(boss.deathProcessed).toBe(false);
    });
    it('identity slaying still kills the owner once without a spurious zone break', () => {
        const { game, boss } = scene();
        withBodyContact(boss, footprintOf(boss)[1]!, () => withWholeBodyDamage(boss, () => boss.takeDamage(9999, true, game.grid)));
        expect(boss.hp).toBe(0); expect(boss.spatial!.zoneState![0]!.broken).toBe(false);
    });
    it.each(['handled', 'unsupported', 'throw'] as const)('production break provider %s is exclusive/atomic', mode => {
        const commit = vi.fn((_request, _plan, context: import('../../../partBreak').PartBreakCommitContext) => {
            context.message('fixture break'); if (mode === 'throw') throw new Error('fixture provider failure');
        });
        configure(false, { prepare: () => mode === 'unsupported' ? { status: 'unsupported', reason: 'unsupported-target' } : { status: 'ready', plan: {} }, commit });
        const { game, boss } = scene(); const before = world(game), random = rng.getState(), messages = logger.messages.slice();
        if (mode === 'throw') {
            expect(() => hit(game, boss, 60)).toThrow('fixture provider failure');
            expect(boss.hp).toBe(150); expect(boss.spatial!.zoneState![0]!.hp).toBe(30); expect(boss.spatial!.actionLockInTicks).toBeUndefined();
            expect(world(game).extensions?.modules).toEqual(before.extensions?.modules); expect(logger.messages).toEqual(messages);
            // The already-issued attack origin is outside the break transaction.
            expect(rng.getState()).toEqual(random);
        } else {
            hit(game, boss, 60); expect(boss.spatial!.actionLockInTicks).toBe(mode === 'handled' ? undefined : 50);
            expect(commit).toHaveBeenCalledTimes(mode === 'handled' ? 1 : 0);
        }
    });
    it.each(installedOptionalModules(['combat']))('prepared 3b native plans cancel only the broken target zone; sibling native zones remain hittable', () => {
        const { game, boss } = scene(['giants', 'combat']);
        const authority = new ActorCombatResolutionAuthority(game, { schema: 1, nextResolutionId: 1, actors: [] }, { production: true });
        const plan = authority.prepareNativeMelee({ kind: 'native-melee', depth: game.depth, sourceEntityId: game.player.id,
            targetEntityId: boss.id, dodgeable: true, parryable: true })!;
        const head = footprintOf(boss).find(p => p.zoneId === 'head')!;
        const siblings = authority.prepareLockedBodySegment({ kind: 'locked-body-segment', depth: game.depth, sourceEntityId: game.player.id,
            sourceFootprintVersion: sourceFootprintVersion(game.spatialOf(game.player)), shape: { schema: 1, kind: 'footprint-offset-union',
                offsets: [{ x: head.x - game.player.x, y: head.y - game.player.y }], selfExclusion: 'source-member' },
            lockedCells: [{ x: head.x, y: head.y }], approvedRisks: [], dodgeable: true, parryable: true });
        expect(siblings).toHaveLength(1);
        expect(plan).toBeTruthy(); hit(game, boss, 60);
        expect(withActorActionScope(game, 'player-command', game.player.id, scope => authority.commitNativeMelee(scope, plan))).toBeNull();
        expect(withActorActionScope(game, 'player-command', game.player.id, scope => authority.commitNativeMelee(scope, siblings[0]!))).not.toBeNull();
    });
    it.each(installedOptionalModules(['combat']))('pending native windup targeting a broken zone enters 3b break recovery and clears telegraph', () => {
        const { game, boss } = scene(['giants', 'combat']);
        const plan = preparePhasedAttackCommand(game, command)!; expect(plan).toBeTruthy();
        expect(commitPhasedAttackCommand(game, plan)).toBe(true);
        expect(game.actorActions!.bundles).toHaveLength(1); hit(game, boss, 60);
        const child = game.actorActions!.bundles[0]!.subactions[0]!;
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');
        expect(state(game).actions[0]!.subactions[0]!.lockedCells).toEqual([]);
        const binding = game.extensionRuntime!.actorActionBinding()!; validateProductionActorAttackState(binding.state, binding.definition);
        const saved = json(game.toSaveSnapshot()); expect(game.loadSnapshot(saved, message => { throw new Error(message); })).toBe(true);
        expect(game.actorActions!.bundles[0]!.subactions[0]!.phases[0]!.kind).toBe('break-recovery');
    });
    it.each(installedOptionalModules(['combat']))('prepared phased confirmation becomes stale on zone changes before payment', () => {
        const { game, boss } = scene(['giants', 'combat']); const plan = preparePhasedAttackCommand(game, command)!;
        hit(game, boss, 60); expect(() => commitPhasedAttackCommand(game, plan)).toThrow('Stale');
        expect(state(game).actors.filter(actor => actor.actorId === game.player.id)).toEqual([]);
        expect(state(game).actors.find(actor => actor.actorId === boss.id)).toMatchObject({ stamina: 24, poise: 6 });
        expect(game.actorActions!.bundles).toEqual([]);
    });
    it.each(installedOptionalModules(['combat']))('a broken source cancels its pending native windup and disables its declared attack after fallback ends', () => {
        configure(false, undefined, true); const { game, boss } = scene(['giants', 'combat']);
        boss.ticksUntilTurn = 50; game.executeCommand('wait');
        expect(game.actorActions!.bundles.some(b => b.decisionOwnerId === boss.id)).toBe(true);
        hit(game, boss, 60);
        const child = game.actorActions!.bundles.find(b => b.decisionOwnerId === boss.id)!.subactions[0]!;
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');
        const next = game.actorActions!.nextActionId;
        for (let i = 0; i < 5; i++) game.executeCommand('wait');
        expect(boss.spatial!.actionLockInTicks).toBeUndefined();
        expect(game.actorActions!.nextActionId).toBe(next);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it.each(installedOptionalModules(['combat']))('provider failure preserves shielding, corpse absorption and the pending native plan', () => {
        configure(false, { prepare: () => ({ status: 'ready', plan: {} }), commit: () => { throw new Error('provider rollback'); } });
        const { game, boss } = scene(['giants', 'combat']);
        commitPhasedAttackCommand(game, preparePhasedAttackCommand(game, command)!);
        boss.applyShield(100); boss.isAbsorbing = true;
        const pending = json(state(game)), zones = json(boss.spatial), hp = boss.hp, random = rng.getState();
        const cell = footprintOf(boss).find(p => p.zoneId === 'shell')!;
        expect(() => withBodyContact(boss, cell, () => boss.takeDamage(60, false, game.grid, undefined, 'physical'))).toThrow('provider rollback');
        expect(boss.getStatusDuration('shielded')).toBe(100); expect(boss.maxShield).toBe(100); expect(boss.isAbsorbing).toBe(true);
        expect(boss.hp).toBe(hp); expect(boss.spatial).toEqual(zones); expect(state(game)).toEqual(pending); expect(rng.getState()).toEqual(random);
    });
    it('a zoned reflected self-hit preserves native pre-loss transference ordering and consumes capped damage once', () => {
        const { game, boss } = scene(); const before = boss.hp, callback = vi.fn((actual: number) => { expect(boss.hp).toBe(before); boss.heal(actual * 100 / boss.maxHp); });
        withBodyContact(boss, footprintOf(boss).find(p => p.zoneId === 'shell')!, () => boss.takeDamage(60, true, game.grid, callback, 'physical'));
        expect(callback).toHaveBeenCalledExactlyOnceWith(30); expect(boss.hp).toBe(before - 30);
    });
    it('a real native attack provider failure rolls back the shield consumed before takeDamage', () => {
        configure(false, { prepare: () => ({ status: 'ready', plan: {} }), commit: () => { throw new Error('native break rollback'); } });
        const { game, boss } = scene(), source = new Monster(22, 11, species.find(m => m.id === 'ogre')! as MonsterData);
        source.damageString = '60-60'; source.accuracy = 1000; source.isAlly = true; game.monsters.push(source);
        boss.applyShield(100); boss.isAbsorbing = true; const spatial = json(boss.spatial);
        expect(() => withBodyAttackContact(source, boss, { from: { ...source.loc, zoneId: 'body' }, to: footprintOf(boss).find(p => p.zoneId === 'shell')!, distance: 1 },
            () => CombatSystem.attack(source, boss, { grid: game.grid }))).toThrow('native break rollback');
        expect(boss.hp).toBe(150); expect(boss.spatial).toEqual(spatial); expect(boss.getStatusDuration('shielded')).toBe(100);
        expect(boss.maxShield).toBe(100); expect(boss.isAbsorbing).toBe(true);
    });
    it.each(installedOptionalModules(['combat']))('3b locked area uses one native hit per distinct zone, never per cell', () => {
        configure(true); const { game, boss } = scene(['giants', 'combat']);
        const authority = new ActorCombatResolutionAuthority(game, { schema: 1, nextResolutionId: 1, actors: [] }, { production: true });
        const view = game.spatialOf(game.player), shape = { schema: 1 as const, kind: 'footprint-offset-union' as const,
            offsets: [{ x: -2, y: 1 }, { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }], selfExclusion: 'source-member' as const };
        const plans = authority.prepareLockedBodySegment({ kind: 'locked-body-segment', depth: game.depth, sourceEntityId: game.player.id,
            sourceFootprintVersion: sourceFootprintVersion(view), shape, lockedCells: footprintOf(boss).map(p => ({ x: p.x, y: p.y })),
            approvedRisks: [], dodgeable: true, parryable: true });
        expect(plans).toHaveLength(3);
        const native = vi.spyOn(CombatSystem, 'attack');
        withActorActionScope(game, 'player-command', game.player.id, scope => plans.forEach(plan => authority.commitNativeMelee(scope, plan)));
        expect(native).toHaveBeenCalledTimes(3);
    });
    it('public zone aim/inspection and historical frames publish no hidden sibling HP or future weakpoint', () => {
        const { game, boss } = scene();
        const shell = footprintOf(boss).find(p => p.zoneId === 'shell')!;
        game.updateHover(shell.x, shell.y); game.handleInspectAt(shell.x, shell.y);
        targetingState.aim = { x: shell.x, y: shell.y };
        expect(game.hoveredText).toContain('棘甲'); expect(game.inspectTarget!.sections[0]!.lines[0]!.text).toContain('30');
        const before = { ...observeDisplayFrame(game, logger), actorTags: { [boss.id]: ['giants.boss'] } }, random = rng.getState();
        expect(before.rows.find(r => r.kind === 'monster' && r.id === boss.id)).toMatchObject({ zones: [{ id: 'shell', hp: 30 }, { id: 'head', weak: false }] });
        hit(game, boss, 60); expect(game.hoveredCell).toBeNull();
        expect(before.targetZone).toContain('30'); expect(observeDisplayFrame(game, logger).targetZone).toBeUndefined();
        expect(observeDisplayFrame(game, logger).throwAim).toBeNull();
        expect(selectBossHud(before)?.zone?.hp).toBe(30);
        const after = { ...observeDisplayFrame(game, logger), actorTags: { [boss.id]: ['giants.boss'] } }; expect(selectBossHud(after)?.zone).toMatchObject({ id: 'shell', hp: 0, broken: true });
        expect(publicZoneAt(game.player, game.grid, boss, boss.loc)?.weak).toBe(true);
        for (const p of footprintOf(boss).filter(p => p.zoneId === 'head')) game.grid.getCell(p.x, p.y)!.isVisible = false;
        expect(publicMonsterZones(game.player, game.grid, boss).some(z => z.id === 'head')).toBe(false);
        game.player.applyStatus('hallucinating', 10); expect(publicMonsterZones(game.player, game.grid, boss)).toEqual([]);
        expect(rng.getState()).toEqual(random);
    });
    it('breaking an aimed public zone resets the native arcana cursor without changing the old frame', () => {
        const { game, boss } = scene(); const staff = ItemLoader.spawnStaff('staff_of_lightning', -1, -1)!;
        staff.charges = 5; game.player.inventory.addItem(staff); game.executeItemCommand('use', staff);
        expect(game.pendingArcana).toBeTruthy(); const shell = footprintOf(boss).find(p => p.zoneId === 'shell')!;
        for (let i = 0; i < 10 && (game.pendingArcana!.cursor.x !== shell.x || game.pendingArcana!.cursor.y !== shell.y); i++)
            game.executeCommand('move', { x: Math.sign(shell.x - game.pendingArcana!.cursor.x), y: Math.sign(shell.y - game.pendingArcana!.cursor.y) });
        expect(game.pendingArcana!.cursor).toEqual({ x: shell.x, y: shell.y });
        const frame = observeDisplayFrame(game, logger), commands = game.recordedInputEvents.length;
        hit(game, boss, 60);
        expect(game.pendingArcana!.cursor).toEqual(game.player.loc); expect(staff.charges).toBe(5);
        expect(frame.arcana!.cursor).toEqual({ x: shell.x, y: shell.y }); expect(frame.targetZone).toContain('30');
        expect(game.recordedInputEvents).toHaveLength(commands);
    });
    it('broken state and derived movement survive repeated save/load; corrupt HP/labels/regen/definitions reject atomically', () => {
        const { game, boss } = scene(); hit(game, boss, 60); const saved = json(game.toSaveSnapshot());
        for (let i = 0; i < 3; i++) {
            expect(game.loadSnapshot(saved)).toBe(true); const m = game.monsters.find(m => m.id === boss.id)!;
            m.refreshSpeeds(); expect(m.movementSpeed).toBe(150); expect(m.spatial!.zoneState).toEqual(boss.spatial!.zoneState);
            expect(fixedZoneDamageMultiplier(m, 'head', game.extensionRuntime!.spatialCatalog)).toEqual({ numerator: 2, denominator: 1 });
        }
        for (const mutate of [
            (s: typeof saved) => { s.monsters.find(m => m.id === boss.id)!.spatial!.zoneState![0]!.hp = 31; },
            (s: typeof saved) => { s.monsters.find(m => m.id === boss.id)!.spatial!.zoneState![0]!.zoneId = 'head'; },
            (s: typeof saved) => { s.monsters.find(m => m.id === boss.id)!.spatial!.zoneState![0]!.regenerateInTicks = 0; },
            (s: typeof saved) => { s.run.spatialWorld!.definitions.breakRules!.find(r => r.id === 'giants.spine-shell-break')!.modifiers = []; }
        ]) {
            const bad = json(saved); mutate(bad); const before = world(game), random = rng.getState();
            expect(game.loadSnapshot(bad)).toBe(false); expect(world(game)).toEqual(before); expect(rng.getState()).toEqual(random);
        }
    });
    it('real zone-breaking input survives save/load, every replay event, seek and continued recording', () => {
        installRecordingScene((game) => {
            if (!game.extensionRuntime?.nativeForms().some(f => f.id === 'giants.spine-crawler')) return;
            arena(game);
            const weapon = ItemLoader.spawnWeapon('sword', game.player.x, game.player.y, 1)!;
            weapon.damage = '20-20'; weapon.enchantment = 5; weapon.flags = []; weapon.strengthRequired = 1;
            game.player.inventory.addItem(weapon); game.player.equippedWeapon = weapon;
        });
        const game = startGiants(['giants'], 44006, 'wizard'), states: ReturnType<typeof world>[] = [];
        let checkpoint: ReturnType<Game['toSaveSnapshot']> | undefined;
        const commands = [{ x: 0, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 1 }];
        for (let i = 0; i < commands.length; i++) {
            game.executeCommand('move', commands[i]); states.push(world(game));
            if (i === 1) checkpoint = json(game.toSaveSnapshot());
        }
        expect(checkpoint!.monsters.find(m => m.typeId === 'giants.spine-crawler')!.spatial!.zoneState![0]!.broken).toBe(true);
        const recording = json(game.exportRecording());
        expect(game.loadSnapshot(checkpoint!)).toBe(true); game.animationEnabled = false;
        for (let i = 2; i < commands.length; i++) { game.executeCommand('move', commands[i]); expect(world(game)).toEqual(states[i]); }
        expect(game.exportRecording().events).toEqual(recording.events);
        expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
        for (let i = 0; i < commands.length; i++) { game.replayStep(true); expect(game.replayError).toBeNull(); expect(world(game)).toEqual(states[i]); }
        for (const i of [2, 6, 1, 5]) { game.replaySeek(i); expect(game.replayError).toBeNull(); expect(world(game)).toEqual(states[i - 1]); }
    }, 60000);
});
