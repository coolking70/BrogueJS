/** Offline, one-shot transcription of narrative2.dot-package.md §3.3.
 * Never imported by a descriptor, module, view, or any runtime entry.
 * Call with the clean 1.4.0 definitions/portraits/locale and the document's
 * narrative2-content rows; it returns detached JSON without writing files.
 */
const NEW_IDS = ['cord.mender', 'cistern.listener', 'bone.clerk', 'salt.warden', 'letter.carrier'];
function assertCleanBase(base, portraits, locale, rows) {
  if (base.moduleVersion !== '1.4.0' || base.rulesVersion !== '1.4.0'
      || base.schema !== 1 || base.stateVersion !== 4 || base.inputVersion !== 2)
    throw new Error('narrative2 requires the unassembled 1.4.0 base');
  if (!Array.isArray(rows) || rows.length !== NEW_IDS.length
      || rows.some((row, index) => row.id !== NEW_IDS[index]))
    throw new Error('narrative2 requires the five document rows in their fixed order');
  const ids = new Set(base.npcs.map(npc => npc.id));
  if (NEW_IDS.some(id => ids.has(id)) || portraits.portraits.some(p => NEW_IDS.some(id => p.id.startsWith(`${id}.`)))
      || Object.keys(locale).some(key => key.startsWith('ext.narrative.n2.')))
    throw new Error('narrative2 has already been assembled or its identifiers collide');
  for (const key of ['flags', 'counters', 'npcs', 'dialogues', 'journal', 'storyEvents', 'triggers']) {
    if (base[key].some(row => NEW_IDS.some(id => row.id === id || row.id.startsWith(`${id}.`))))
      throw new Error(`narrative2 identifier collision in ${key}`);
  }
}

export function compileNarrative2(base, basePortraits, baseLocale, rows) {
  assertCleanBase(base, basePortraits, baseLocale, rows);
  const definitions = structuredClone(base), portraits = structuredClone(basePortraits);
  const locale = { ...baseLocale }, recruitment = { schema: 1, targetPhase: '5D3', npcs: [] };
  definitions.moduleVersion = definitions.rulesVersion = '1.5.0';
  portraits.displayVersion = '1.3.0';
  for (const p of portraits.portraits) { p.width = 48; p.height = 64; }
  for (const r of rows) {
    const p = r.id, key = s => `ext.narrative.n2.${p}.${s}`;
    const put = (s, text) => { locale[key(s)] = text; return key(s); };
    const flag = value => ({ op: 'flag', id: `${p}.verdict`, equals: value });
    const pending = flag('unresolved');
    const settledKey = put('settled', '这件事已经作出选择');
    const laterKey = put('later', '尚未作出选择');
    const choice = (id, textKey, condition, next, effects = [], unavailableKey = null, unavailable = 'disable') =>
      ({ id, textKey, condition, unavailable, unavailableKey, effects, next });
    const leave = node => choice(`leave-${node}`, 'ext.narrative.choice.leave', { op: 'true' }, null);
    const node = (id, choices) => ({ id, textKey: put(`text.${id}`, r.text[id]), portraitId: null, choices: [...choices, leave(id)] });
    const a = r.outcomes[0], b = r.outcomes[1];
    const endEffects = verdict => [
      { kind: 'set-flag', id: `${p}.verdict`, value: verdict },
      { kind: 'journal', entryId: `${p}.${verdict}.note` },
      { kind: 'emit-story', eventId: `${p}.settled` }
    ];
    definitions.flags.push({ id: `${p}.verdict`, type: 'string', initial: 'unresolved', min: null, max: null, values: ['unresolved', a, b] });
    definitions.npcs.push({ id: p, nameKey: put('name', r.name), descriptionKey: put('description', r.description),
      glyph: r.glyph, color: r.color, portraitId: `${p}.neutral`, dialogueId: `${p}.greeting`,
      presence: 'stationary-interactable', interactionDistance: 1,
      placements: [{ id: `${p}.first`, minDepth: r.depth[0], maxDepth: r.depth[1], maxPerRun: 1, maxPerDepth: 1,
        minStairDistance: 1, maxEntranceDistance: 8, onNoSpace: 'defer' }] });
    definitions.dialogues.push({ id: `${p}.greeting`, entry: 'hello', nodes: [
      node('hello', [choice('ask', put('choice.ask', r.ask), pending, 'account', [], settledKey),
        choice('recall-a', put('choice.recall', '谈谈上次的选择'), flag(a), 'recall-a', [], laterKey, 'hide'),
        choice('recall-b', key('choice.recall'), flag(b), 'recall-b', [], laterKey, 'hide')]),
      node('account', [choice('detail', put('choice.detail', r.detailChoice), { op: 'true' }, 'detail'),
        choice('clue', put('choice.clue', r.clueChoice), { op: 'flag', id: r.clueFlag, equals: r.clueValue }, 'clue', [], put('clueLocked', r.clueLocked)),
        choice('consider', put('choice.consider', '听听还没作出的决定'), pending, 'decision', [], settledKey)]),
      node('detail', [choice('back-detail', put('choice.back', '回到刚才的话题'), { op: 'true' }, 'account')]),
      node('clue', [choice('back-clue', key('choice.back'), { op: 'true' }, 'account')]),
      node('decision', [choice('choose-a', put('choice.a', r.aChoice), pending, 'a', endEffects(a), settledKey),
        choice('choose-b', put('choice.b', r.bChoice), pending, 'b', endEffects(b), settledKey)]),
      node('a', []), node('b', []), node('recall-a', []), node('recall-b', [])
    ] });
    for (const [i, verdict] of r.outcomes.entries()) definitions.journal.push({ id: `${p}.${verdict}.note`,
      titleKey: put(`journal.${verdict}.title`, r.journalTitles[i]), textKey: put(`journal.${verdict}.body`, r.journalBodies[i]) });
    definitions.storyEvents.push({ id: `${p}.settled` });
    definitions.triggers.push({ id: `${p}.reward`, on: { kind: 'story', eventId: `${p}.settled` }, priority: 0,
      condition: { op: 'not', arg: pending }, repeat: { kind: 'once-per-run' },
      effects: [{ kind: 'optional-reward', capability: 'growth.story-reward.v1', rewardId: r.rewardId,
        receiptId: `${p}.reward.receipt`, onUnavailable: 'skip' }] });
    portraits.portraits.push({ id: `${p}.neutral`, asset: r.asset, width: 48, height: 64, fit: 'contain',
      anchor: 'bottom-center', altKey: put('portrait', `${r.name}像素立绘`), fallbackGlyph: r.glyph });
    recruitment.npcs.push({ npcId: p, recruitable: r.recruitable,
      eligibility: r.recruitable ? { flagId: `${p}.verdict`, anyOf: r.eligibleVerdicts } : null });
  }
  return { definitions, portraits, locale, recruitment };
}
