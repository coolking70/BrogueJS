import { afterEach, describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { c5Canonical } from '../engine/Core/WorldCanonical';
import {
  merkleDomain,
  digestRoot,
  hashJson,
  recordingChain,
  mechanicalDigest,
  eventDigest,
  inventoryStamp,
  recordingStart
} from '../engine/Core/RecordingDigest';
import { DIGEST_DOMAINS, EVENT_DOMAINS } from '../engine/Core/RecordingV4';
import { recordingHeader, validateRecordingV4 } from '../engine/Core/RecordingFormat';
import { createHeadlessGame } from './harness';
import { rechain } from './support/recordingV4';
import * as catalog from '../ext/catalog';
import { createWorld5Module, fixtureRulesIdentity } from './fixtures/world5-module';
import { Logger, logger } from '../engine/Systems/Logger';
import { Item, ItemCategory } from '../engine/Items/Item';
import i18next from 'i18next';
import zhCN from '../locales/zh_CN.json';
import {
  auditFullObjectGraph,
  fullGenerationRoots
} from './support/fullGenerationCheckpointOracle';
afterEach(() => vi.restoreAllMocks());
const independent = (v: unknown) =>
  createHash('sha256').update(c5Canonical(v, true), 'utf8').digest('hex');
const input = {
  inventoryOpen: false,
  inventoryAction: null,
  referenceScreen: null,
  arcana: null,
  throwItemId: null,
  pendingUseConfirmId: null
};
describe('C5 recording v4 digest contract', () => {
  it('review M1: inventory CAS uses a stable entity identity even when an item has no kind ID', () => {
    const item = new Item('English label', '!', 0xffffff, ItemCategory.FOOD);
    const expected = independent(['c5-inventory-v1', [['', item.id, item.category, 'entity.' + item.id, item.quantity, null, null]]]).slice(0, 16);
    expect(inventoryStamp([item])).toBe(expected);
    item.name = '中文译名'; expect(inventoryStamp([item])).toBe(expected);
  });
  it('review M1: translated duplicates and display repeat caps do not change bounded message evidence', () => {
    const g = createHeadlessGame(517), a = new Logger(), b = new Logger();
    for (let n = 0; n < 1400; n++) { a.log('repeated', '#ffffff'); b.log(n % 2 ? '甲' : '乙', '#ffffff'); }
    expect(a.messages.length).not.toBe(b.messages.length);
    expect(a.peekState().mechanical).toEqual(b.peekState().mechanical);
    expect(a.peekState().mechanical.messages).toHaveLength(1360);
    expect(a.peekState().mechanical.nextId).toBe(1400);
    const s = g.toSnapshot(), t = structuredClone(s); s.run.logger = a.peekState(); t.run.logger = b.peekState();
    expect(mechanicalDigest(s, input)).toEqual(mechanicalDigest(t, input));
    t.run.logger.mechanical.messages[0]!.color = '#ff0000';
    expect(mechanicalDigest(s, input).domains.knowledge).not.toBe(mechanicalDigest(t, input).domains.knowledge);
  });
  it('review M1: missing stable flavor identities and malformed message evidence are rejected before retiring the run', () => {
    const g = createHeadlessGame(517), snapshot = g.toSnapshot();
    for (const mutate of [
      (s: typeof snapshot) => { s.flavors.identities.kinds = []; },
      (s: typeof snapshot) => { s.run.logger.mechanical.nextId = -1; },
    ]) { const bad = structuredClone(snapshot), player = g.player, notify = vi.fn(); mutate(bad);
      expect(g.loadSnapshot(bad, notify)).toBe(false); expect(g.player).toBe(player); expect(notify).toHaveBeenCalledOnce(); }
  });
  it.each([{ modules: [] as string[] }, { modules: ['growth', 'narrative', 'combat', 'giants'] }])('review M1: all six initial domains ignore locale with modules %j', ({ modules }) => {
    createHeadlessGame(1); i18next.addResourceBundle('zh_CN', 'translation', zhCN, true, true);
    const start = () => { const g = createHeadlessGame(27028); g.startNewGame({ seed: 27028, mode: 'wizard',
      ruleSet: modules.length ? 'extended' : 'classic', extensions: modules }); return g.toSnapshot(); };
    i18next.changeLanguage('en'); const a = start();
    i18next.changeLanguage('zh_CN'); const b = start();
    expect(mechanicalDigest(a, input)).toEqual(mechanicalDigest(b, input));
    expect(a.rngState).toEqual(b.rngState);
    i18next.changeLanguage('en');
  });
  it('review M1: rendered text changes leave digests unchanged while message emission evidence remains covered', () => {
    const g = createHeadlessGame(517), s = g.toSnapshot(), original = mechanicalDigest(s, input);
    for (const item of [...s.items, ...s.player.inventory, ...s.entityGraph.items]) { item.name = '译文修订'; item.description = '译文修订'; }
    for (const m of [...s.monsters, ...s.entityGraph.monsters]) { m.name = m.form.name = '译文修订'; m.description = m.form.description = '译文修订'; }
    for (const row of s.run.logger.messages) row.text = '译文修订';
    s.flavors.potions = s.flavors.potions.map(([id, value]) => [id, { ...value, name: '译文修订' }] as const);
    s.flavors.arcana = s.flavors.arcana.map(([id]) => [id, '译文修订']);
    s.flavors.scrolls = s.flavors.scrolls.map(([id]) => [id, '译文修订']);
    s.flavors.staffSlots = s.flavors.staffSlots.map(() => '译文修订');
    s.wandFlavors = Object.fromEntries(Object.keys(s.wandFlavors!).map(id => [id, '译文修订']));
    s.staffFlavors = Object.fromEntries(Object.keys(s.staffFlavors!).map(id => [id, '译文修订']));
    expect(mechanicalDigest(s, input)).toEqual(original);
    logger.log('an emitted message');
    expect(mechanicalDigest(g.toSnapshot(), input).domains.knowledge).not.toBe(original.domains.knowledge);
  });
  it.each([{ modules: [] as string[] }, { modules: ['growth', 'narrative', 'combat', 'giants'] }])('review M1: English recordings replay in Chinese and switch locale between commands with %j', ({ modules }) => {
    createHeadlessGame(1); i18next.addResourceBundle('zh_CN', 'translation', zhCN, true, true);
    i18next.changeLanguage('en');
    const g = createHeadlessGame(27028);
    if (modules.length) {
      const registry = catalog.createExtensionRegistry(), initialCommands = registry.create(registry.manifest(modules))
        .flatMap(m => m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
      g.startNewGame({ seed: 27028, mode: 'normal', ruleSet: 'extended', extensions: modules, initialCommands });
    }
    for (let i = 0; i < 3; i++) g.executeCommand('wait');
    i18next.changeLanguage('zh_CN');
    for (let i = 0; i < 256; i++) g.executeCommand('escape');
    const r = g.exportRecording();
    expect(g.loadReplay(r)).toBe(true);
    g.replaySeek(r.events.length); expect(g.replayError).toBeNull();
    i18next.changeLanguage('en');
    expect(g.loadReplay(r)).toBe(true);
    g.replaySeek(r.events.length); expect(g.replayError).toBeNull();
  });
  it('binds every U03 run field once and excludes every session/derived/reset field; unknown run fields fail', () => {
    const state = JSON.parse(readFileSync('scripts/u03-state-contract.json', 'utf8'));
    const contract = JSON.parse(readFileSync('scripts/recording-digest-contract.json', 'utf8'));
    const check = (states: typeof state) => {
      expect(Object.keys(contract.run).sort()).toEqual(
        Object.keys(states)
          .filter((k) => states[k].kind === 'run')
          .sort()
      );
      expect(Object.keys(contract.excluded).sort()).toEqual(
        Object.keys(states)
          .filter((k) => states[k].kind !== 'run')
          .sort()
      );
      for (const [name, kind] of Object.entries(contract.excluded))
        expect(kind).toBe(states[name].kind);
      for (const domain of Object.values(contract.run)) expect(DIGEST_DOMAINS).toContain(domain);
    };
    check(state);
    expect(() => check({ ...state, unregisteredWorldField: { kind: 'run' } })).toThrow();
  });
  it('freezes tagged empty domains, Unicode/finite native leaves and independent Merkle/chain vectors', () => {
    const leaf = independent([
      'c5-leaf-v1',
      'native',
      'a',
      { unicode: '营地\n', finite: 1.5, zero: -0 }
    ]);
    expect(leaf).toBe('3df17ec102166384578849849cc2bb28c512b47cc7569e09d3113895b7bdc28b');
    const domain = independent(['c5-domain-v1', 'native', [leaf]]);
    expect(domain).toBe('d0da6196612c1675fbf6db04da79b83fd58d001a47d3af60104a36d7905b07bf');
    expect(merkleDomain('native', { a: { unicode: '营地\n', finite: 1.5, zero: -0 } })).toBe(
      domain
    );
    const empty = Object.fromEntries(
      DIGEST_DOMAINS.map((d) => [d, merkleDomain(d, { root: null })])
    );
    expect(new Set(Object.values(empty)).size).toBe(6);
    expect(empty).toEqual({
      native: '323a572cbdc04b1211bc4c0198ba8209325c6fb699120b1d18cbaa99ae2a16ca',
      extensions: '45d52001ca271816b0e09831cbec73e18c38871c0dfe26b42f93ec734a3b64cd',
      world5: '12d261a5676b74aaf5d71e57bff0dbfe3473d4c4120551927d1d70245ca63449',
      actorActions: '9f1c9dc4d52ec4c60fe72bcc1de71b66536be51dcd27556f1fa4142b0ddf0306',
      knowledge: 'a4a5b045927c5f0c3d22ce749a91a99a89f96f32df4a66f12a4a046cb6962880',
      random: '1b5cd72d6624ed3521924c3549e9dac21fc7fd8e7885d22d556496da3fb9e8d7'
    });
    expect(digestRoot(empty, null, DIGEST_DOMAINS)).toBe(
      independent([
        'c5-root-v1',
        ['brogue-web-whole-run-v4', 4, 6, 2],
        independent(null),
        DIGEST_DOMAINS.map((d) => empty[d])
      ])
    );
    expect(digestRoot(empty, null, DIGEST_DOMAINS)).toBe(
      '9340b03717008847988083eff73fb1da39481a1a9349e16d2859972158e97900'
    );
    expect(merkleDomain('native', { '\u{10000}': 1, '\ue000': 2 })).toBe(
      independent([
        'c5-domain-v1',
        'native',
        [
          independent(['c5-leaf-v1', 'native', '\ue000', 2]),
          independent(['c5-leaf-v1', 'native', '\u{10000}', 1])
        ]
      ])
    );
    const vectorHeader = {
      version: 4,
      seed: '1',
      mode: 'normal',
      initialLevel: { kind: 'dungeon', depth: 1 },
      extensions: null,
      codec: { wholeRun: 4, foundation: 6, origin: 2 },
      digestAlgorithm: 'sha256-c5-merkle-v1',
      digestChunk: 256,
      checkpointPeriod: 2048,
      recordedAt: 0,
      initialDigest: {
        root: '9340b03717008847988083eff73fb1da39481a1a9349e16d2859972158e97900',
        domains: {
          native: '323a572cbdc04b1211bc4c0198ba8209325c6fb699120b1d18cbaa99ae2a16ca',
          extensions: '45d52001ca271816b0e09831cbec73e18c38871c0dfe26b42f93ec734a3b64cd',
          world5: '12d261a5676b74aaf5d71e57bff0dbfe3473d4c4120551927d1d70245ca63449',
          actorActions: '9f1c9dc4d52ec4c60fe72bcc1de71b66536be51dcd27556f1fa4142b0ddf0306',
          knowledge: 'a4a5b045927c5f0c3d22ce749a91a99a89f96f32df4a66f12a4a046cb6962880',
          random: '1b5cd72d6624ed3521924c3549e9dac21fc7fd8e7885d22d556496da3fb9e8d7'
        }
      }
    } as const;
    expect(recordingStart(vectorHeader)).toBe(
      '85a1325d2f64b5dd822f2f52aa790267b7b9ca016057086fd5784b1d9cffcc78'
    );
    expect(recordingChain(recordingStart(vectorHeader), { index: 0, action: 'wait' } as any)).toBe(
      'b226560b8ebdd3b70c2751e05260ba926d1865e8bce2f019015de6b4bc763196'
    );
    const game = createHeadlessGame(517);
    game.executeCommand('escape');
    const recording = game.exportRecording(),
      header = recordingHeader(recording);
    const { recordedAt: _date, initialDigest, ...identity } = header;
    expect(recordingStart(header)).toBe(
      independent(['c5-recording-start-v1', identity, initialDigest])
    );
    expect(recordingStart({ ...header, recordedAt: header.recordedAt + 999 })).toBe(
      recordingStart(header)
    );
    const { chainDigest: _chain, ...payload } = recording.events[0]!;
    expect(recording.events[0]!.chainDigest).toBe(
      independent(['c5-recording-event-v1', recordingStart(header), payload])
    );
    expect(hashJson(-0)).toBe(hashJson(0));
    expect(() => hashJson(Infinity)).toThrow();
    expect(() => hashJson('\ud800')).toThrow();
  });
  it('hashes persistent knowledge separately and ignores reproducible display/path caches without RNG or world writes', () => {
    const g = createHeadlessGame(517),
      s = g.toSnapshot(),
      before = structuredClone(s),
      d = mechanicalDigest(s, input);
    const cell = s.grid[0]!;
    cell.isExplored = !cell.isExplored;
    const knowledge = mechanicalDigest(s, input);
    expect(knowledge.domains.knowledge).not.toBe(d.domains.knowledge);
    expect(knowledge.domains.native).toBe(d.domains.native);
    cell.isExplored = !cell.isExplored;
    cell.isVisible = !cell.isVisible;
    s.run.monsterPathCache = { safeTerrain: null, allySafety: null };
    expect(mechanicalDigest(s, input)).toEqual(d);
    expect(before.rngState).toEqual(s.rngState);
    s.player.hp--;
    expect(mechanicalDigest(s, input).domains.native).not.toBe(d.domains.native);
    expect(inventoryStamp(g.player.inventory.items)).toHaveLength(16);
    expect(inventoryStamp(g.player.inventory.items)).toBe(recordingInventory(before));
    g.player.inventory.items[0]!.quantity++;
    expect(inventoryStamp(g.player.inventory.items)).not.toBe(recordingInventory(before));
    expect(eventDigest(null, null, null)).toBeNull();
    expect(merkleDomain('actorActions', { root: null })).toBe(d.domains.actorActions);
  });
  it.each(DIGEST_DOMAINS)(
    'reports exact dirty-domain commands or bounded hidden-domain evidence for a valid-chain %s alteration',
    (domain) => {
      const registry = catalog.createExtensionRegistry();
      registry.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
      vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
      const g = createHeadlessGame(517);
      g.startNewGame({
        seed: 517,
        mode: 'test',
        ruleSet: 'extended',
        extensions: ['world5-fixture']
      });
      g.animationEnabled = false;
      g.executeCommand('world5:fixture');
      g.executeCommand('escape');
      const r = g.exportRecording(),
        e = r.events[0]!;
      // Dirty domains have a comparison at command 1; the other domains at the last full checkpoint.
      const at = EVENT_DOMAINS.includes(domain as any) ? e : r.events[1]!;
      if (at.checkpoint && EVENT_DOMAINS.includes(domain as any)) {
        (at.checkpoint.domains as any)[domain] = '0'.repeat(64);
        at.checkpoint.root = digestRoot(at.checkpoint.domains, r.extensions, EVENT_DOMAINS);
      }
      if (at.fullCheckpoint) {
        at.fullCheckpoint.domains[domain] = '0'.repeat(64);
        at.fullCheckpoint.root = digestRoot(
          at.fullCheckpoint.domains,
          r.extensions,
          DIGEST_DOMAINS
        );
      }
      rechain(r);
      expect(g.loadReplay(r)).toBe(true);
      while (g.replayCursor < r.events.length && !g.replayError) g.replayStep(true);
      expect(g.replayError).toContain('command ' + (at.index + 1));
      expect(g.replayError).toContain('domain ' + domain);
      expect(g.replayError).toContain(
        'tick ' + at.tick + ' position ' + at.player.x + ',' + at.player.y
      );
      const bounded = domain === 'native' || domain === 'knowledge';
      expect(g.replayDiagnostic).toEqual({
        command: at.index + 1, domain, tick: at.tick, player: at.player,
        precision: bounded ? 'interval' : 'exact', previousVerifiedBoundary: 0,
        interval: { fromCommand: bounded ? 1 : at.index + 1, toCommand: at.index + 1 }
      });
      expect(Object.isFrozen(g.replayDiagnostic)).toBe(true);
      expect(Object.isFrozen(g.replayDiagnostic!.interval)).toBe(true);
      expect(Object.isFrozen(g.replayDiagnostic!.player)).toBe(true);
      if (bounded) {
        expect(g.replayError).toContain('first verifiable divergence');
        expect(g.replayError).toContain('previous verified boundary 0');
        expect(g.replayError).toContain('possible divergence commands 1..2');
      } else expect(g.replayError).not.toContain('possible divergence');
    }
  );
  it('rejects a valid-chain forged initial world before changing any live object or process service', () => {
    const g = createHeadlessGame(517);
    g.executeCommand('wait');
    const r = g.exportRecording();
    r.initialDigest.domains.native = '0'.repeat(64);
    r.initialDigest.root = digestRoot(r.initialDigest.domains, r.extensions, DIGEST_DOMAINS);
    rechain(r);
    const audit = auditFullObjectGraph(fullGenerationRoots(g), []),
      player = g.player,
      archive = logger.peekState();
    expect(g.loadReplay(r)).toBe(false);
    expect(g.player).toBe(player);
    expect(logger.peekState()).toEqual(archive);
    expect(audit.differences()).toEqual([]);
  });
  it('keeps rejected module and file feedback outside persistent knowledge and RNG', () => {
    const g = createHeadlessGame(517);
    const archive = logger.peekState(),
      r = g.exportRecording();
    expect(g.loadReplay({ ...r, version: 3 })).toBe(false);
    expect(logger.peekState()).toEqual(archive);
    expect(logger.displayMessages[logger.displayMessages.length - 1]!.id).toBe(-1);
    g.executeCommand('escape');
    expect(g.loadReplay(g.exportRecording())).toBe(true);
    g.replayStep(true);
    expect(g.replayError).toBeNull();
  });
  it('rejects broken chains before retirement, distinguishes valid-chain semantic OOS, and rejects old formats', () => {
    const g = createHeadlessGame(517);
    g.executeCommand('wait');
    const r = g.exportRecording(),
      player = g.player;
    const damaged = structuredClone(r);
    damaged.events[0]!.hp--;
    expect(g.loadReplay(damaged)).toBe(false);
    expect(g.player).toBe(player);
    rechain(damaged);
    expect(g.loadReplay(damaged)).toBe(true);
    g.replayStep(true);
    expect(g.replayError).toContain('command 1');
    for (const version of [1, 2, 3]) {
      expect(g.loadReplay({ ...r, version })).toBe(false);
    }
    const malformed = structuredClone(r);
    (malformed.events[0] as any).unknown = 1;
    expect(validateRecordingV4(malformed, () => {})).toBe(false);
    expect(EVENT_DOMAINS).toEqual(['extensions', 'world5', 'actorActions']);
  });
});
function recordingInventory(
  s: ReturnType<ReturnType<typeof createHeadlessGame>['toSnapshot']>
): string {
  const rows = s.player.inventory
    .slice()
    .sort((a, b) => (a.inventoryLetter ?? '').localeCompare(b.inventoryLetter ?? ''))
    .map((i) => [
      i.inventoryLetter ?? '',
      i.id,
      i.category,
      i.consumableId ?? i.identityId ?? 'entity.' + i.id,
      i.quantity,
      null,
      null
    ]);
  return independent(['c5-inventory-v1', rows]).slice(0, 16);
}
