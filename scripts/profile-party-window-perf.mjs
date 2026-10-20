/** P1b observer identity. Original party-v1 tools and 2049-input route stay intact. */
import assert from 'node:assert/strict';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { cpus, platform, arch, tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import { boot, write, hash, stats, drain } from './ext-perf-common.mjs';
import { readCrossformatTarget, crossformatFrame, CROSSFORMAT_ID, CROSSFORMAT_DELTAS } from './party-perf-crossformat.mjs';
import { hashCandidate } from './check-module-removal.mjs';
const [output, mode, countText, stepsText = '2049', scene = 'windows'] = process.argv.slice(2),
  actors = Number(countText),
  steps = Number(stepsText);
assert.ok(
  output &&
    ['party-only', 'party-all'].includes(mode) &&
    [1, 2, 4].includes(actors) &&
    ['single', 'windows', 'fixed-ticks', 'ai'].includes(scene)
);
assert.ok(Number.isSafeInteger(steps) && steps > 0 && steps <= 2049);
const sourceHash = hashCandidate(process.cwd()).sha256;
const { server, Game, logger, load } = await boot(),
  live = [],
  dir = mkdtempSync(join(tmpdir(), 'party-window-worker-'));
const quantile = (a) => ({
  ...stats(a),
  p99: a.toSorted((a, b) => a - b)[Math.ceil(a.length * 0.99) - 1] ?? null
});
let gcObserver;
try {
  const { createExtensionRegistry, getInstalledModuleDescriptors } = await load('ext/catalog.ts'),
    { rng } = await load('engine/Random.ts'),
    { timeSystem } = await load('engine/Systems/Time.ts');
  const { mechanicalDigest, hashJson } = await load('engine/Core/RecordingDigest.ts'),
    { WorkerRecordingBackend } = await load('engine/Core/RecordingBackend.ts');
  const registry = createExtensionRegistry(),
    ids = mode === 'party-all' ? getInstalledModuleDescriptors().map((m) => m.id) : ['party'],
    configuration = { party: { schema: 1, members: actors } },
    manifest = registry.manifest(ids, configuration),
    initialCommands = registry
      .create(manifest)
      .flatMap((m) =>
        m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []
      );
  const workerEntry = join(dir, 'worker.mjs');
  await build({
    entryPoints: [resolve('src/engine/Core/RecordingCheckpoint.worker.ts')],
    outfile: workerEntry,
    bundle: true,
    platform: 'node',
    format: 'esm',
    banner: {
      js: "import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);"
    },
    footer: { js: 'parentPort.on("message",data=>globalThis.onmessage({data}));' }
  });
  const g = new Game({ seed: 1 });
  live.push(g);
  g.configureRecordingBackend(
    () =>
      new WorkerRecordingBackend(60000, () => {
        const worker = new Worker(workerEntry),
          adapter = {
            onmessage: null,
            onerror: null,
            onmessageerror: null,
            postMessage: (job, transfer) => worker.postMessage(job, transfer),
            terminate: () => void worker.terminate()
          };
        worker.on('message', (data) => adapter.onmessage?.({ data }));
        worker.on('error', (error) => adapter.onerror?.(error));
        return adapter;
      })
  );
  g.startNewGame({
    seed: 42,
    mode: 'wizard',
    ruleSet: 'extended',
    extensions: ids,
    extensionConfigurations: configuration,
    initialCommands
  });
  g.animationEnabled = false;
  if(scene==='ai'){
    for(const m of g.party.state.members){
      g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party.state.revision,change:{kind:'controller',actorId:m.actorId,expectedEpoch:m.controlEpoch,controller:{kind:'ai',policyId:'party-ai-v1'}}});
      g.executeCommand('party:policy',{kind:'party:policy',schema:2,issuerSlot:'local:0',expectedRevision:g.party.state.revision,actorId:m.actorId,change:{kind:'reactions',emptyPlan:'wait',values:Object.fromEntries(['new-hostile','damage','negative-status','low-hp','telegraph'].map(k=>[k,'continue']))}});
    }
    g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party.state.revision,change:{kind:'order',actorIds:[g.party.state.members[0].actorId],order:{kind:'explore',level:g.depth}}});
    await g.flushRecording();
  }
  const layers = {
    aiViewAndDecision:[], aiPolicyQuery:[],
    stats: [],
    capture: [],
    restore: [],
    vision: [],
    scheduler: [],
    environment: [],
    npc: [],
    recordMain: [],
    validation: []
  };
  const aiCounters={calls:0,acceptedDecisions:0,nodes:0,budgetFallbacks:0,cacheHits:0};let measuringAi=false;
  if(scene==='ai'){
    const port=g.partyWindowPort;g.partyWindowPort=function(){const p=port.call(this),decide=p.decide;p.decide=id=>{const begin=performance.now();try{return decide(id);}finally{layers.aiViewAndDecision.push(performance.now()-begin);}};return p;};
    const query=g.extensionRuntime.queryOptional;g.extensionRuntime.queryOptional=function(capability,input){const begin=performance.now();const result=query.call(this,capability,input);if(measuringAi&&capability==='party.ai.v1'){layers.aiPolicyQuery.push(performance.now()-begin);aiCounters.calls++;aiCounters.nodes+=result.value.nodes;aiCounters.budgetFallbacks+=Number(result.value.diagnostic==='budget');}return result;};
  }
  const { StatPipeline } = await load('engine/Stats/StatPipeline.ts');
  const statInstances = new Map();
  let statClears = 0,
    measureStats = true;
  for (const method of ['value', 'rational', 'evaluatePair', 'clear']) {
    const original = StatPipeline.prototype[method];
    StatPipeline.prototype[method] = function (...args) {
      if (!measureStats) return original.apply(this, args);
      if (!statInstances.has(this)) statInstances.set(this, { ...this.diagnostics });
      if (method === 'clear') statClears++;
      const start = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        layers.stats.push(performance.now() - start);
      }
    };
  }
  for (const [method, layer] of [
    ['checkpointCombatFactWorld', 'capture'],
    ['updateVision', 'vision'],
    ['updateRecordedCheckpoint', 'recordMain'],
    ['preparePartyInput', 'validation'],
    ['objectiveTimeBlock', 'environment']
  ]) {
    const original = g[method];
    g[method] = function (...args) {
      const begin = performance.now();
      const value = original.apply(this, args);
      layers[layer].push(performance.now() - begin);
      if (method === 'checkpointCombatFactWorld')
        return () => {
          const begin = performance.now();
          value();
          layers.restore.push(performance.now() - begin);
        };
      return value;
    };
  }
  const advance = g.advancementLoop;
  g.advancementLoop = function* (...args) {
    const iter = advance.apply(this, args);
    for (;;) {
      const begin = performance.now(),
        next = iter.next();
      layers.scheduler.push(performance.now() - begin);
      if (next.done) return;
      yield next.value;
    }
  };
  const npcCounts = { actions: 0 },
    takeTurn = g.timePorts;
  g.timePorts = function () {
    const p = takeTurn.call(this),
      turn = p.effects.monsterTakeTurn;
    p.effects.monsterTakeTurn = (...args) => {
      npcCounts.actions++;
      const begin = performance.now();
      try {
        return turn(...args);
      } finally {
        layers.npc.push(performance.now() - begin);
      }
    };
    return p;
  };
  const mechanicalCauses = [];
  let currentInput = -1;
  const combatEvent = g.extensionRuntime.commitCombatEvent;
  g.extensionRuntime.commitCombatEvent = function (actor, payload) {
    const result = combatEvent.call(this, actor, payload);
    if (
      measureStats &&
      payload.eventKind === 'staggered' &&
      g.controlledActors.some((a) => a.id === actor.id)
    )
      mechanicalCauses.push({
        index: currentInput,
        tick: timeSystem.currentTick,
        actorId: actor.id,
        event: structuredClone(payload),
        timers: g.controlledActors.map((a) => ({
          id: a.id,
          timer: a.ticksUntilTurn,
          speed: a.movementSpeed,
          statuses: { ...a.statusDurations }
        })),
        resources: structuredClone(
          this.actorActionBinding()?.state.actors.filter((a) =>
            g.controlledActors.some((m) => m.id === a.actorId)
          ) ?? []
        )
      });
    return result;
  };
  const gcEvents = [];
  const collectGc = (entries) => gcEvents.push(...entries.map((e) => ({
    startTime: e.startTime, duration: e.duration, kind: e.detail.kind, flags: e.detail.flags
  })));
  gcObserver = new PerformanceObserver((list) => collectGc(list.getEntries()));
  gcObserver.observe({ entryTypes: ['gc'] });
  const crossTarget = readCrossformatTarget(process.env.PARTY_PERF_CROSSFORMAT_TARGET),
    crossFrames = [], crossProofMs = [];
  const observeCross = index => {
    if (!crossTarget) return;
    const begin = performance.now();
    crossFrames.push(crossformatFrame(g.projectWholeRun(), g.recordingInputState(), crossTarget.manifests[`${actors}/${mode}`], mechanicalDigest, hashJson, index));
    crossProofMs.push(performance.now() - begin);
  };
  observeCross(0);
  const samples = [],
    rows = [],
    inputs = [],
    flush = [],
    full = [],
    projection = [],
    encoding = [],
    preview = [],
    focus = [],
    saveSizes = [],
    initialRecordLength = g.recordedInputEvents.length,
    memoryAtStart = process.memoryUsage(),
    measurementCpuStart = process.cpuUsage(),
    started = performance.now();
  let nonemptyFlush = 0,
    previewPollution = 0;
  for (let index = 0; index < steps; index++) {
    currentInput = index;
    const boundary = [255, 256, 257, 2047, 2048, 2049].includes(
      g.recordedInputEvents.length + 1
    );
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    const inputStart = performance.now(),
      wasBlocked = g.recordingInputBlocked;
    if (wasBlocked) {
      const f = performance.now();
      await g.flushRecording();
      flush.push(performance.now() - f);
      nonemptyFlush++;
    }
    const layerOffsets = Object.fromEntries(Object.entries(layers).map(([key, values]) => [key, values.length]));
    const cpuStart = process.cpuUsage(),
      acceptedAt = performance.now(),
      before = timeSystem.currentTick,
      turns = g.absoluteTurnNumber,
      npc = npcCounts.actions,
      revision = g.party.state.revision;
    let action = 'party:actor-step',
      data,
      label = 'single',
      actorId = g.readyPartyActorId;
    if (
      scene !== 'single' &&
      (g.party.state.window.decision ||
        g.readyPartyActorId === null ||
        scene === 'fixed-ticks' || scene==='ai' ||
        (index === 129 && mode === 'party-all') ||
        boundary ||
        index % 64 === 0 ||
        [254, 255, 256, 2046, 2047, 2048].includes(index))
    ) {
      const d = g.party.state.window.decision;
      if (d) {
        action = 'party:decision';
        data = {
          kind: action,
          schema: 1,
          expectedRevision: revision,
          issuerSlot: 'local:0',
          actorId: d.actorId,
          decisionId: d.id,
          choiceId: d.allowedChoiceIds.includes('no')
            ? 'no'
            : d.allowedChoiceIds.includes('cancel')
              ? 'cancel'
              : d.allowedChoiceIds[0]
        };
        label = 'decision';
      } else {
        action = 'party:window';
        const modes = ['fine', 100, 300, 1000, 'auto'],
          length = scene === 'fixed-ticks'||scene==='ai' ? 100 : modes[Math.floor(index / 64) % 5];
        data = {
          kind: action,
          schema: g.party.state.schema>=3?2:1,
          seq: g.party.state.window.seq + 1,
          expectedRevision: revision,
          issuerSlot: 'local:0',
          startTick: before,
          length:
            length === 'fine'
              ? { kind: 'fine' }
              : { kind: 'ticks', ticks: length === 'auto' ? 100 : length },
          fineActorId: length === 'fine' ? g.activeControlledActors[0].id : null,
          automatic: length === 'auto',
          trigger: 'manual',
          plans:
            index === 0 && scene === 'windows'
              ? g.activeControlledActors.map((a) => ({
                  actorId: a.id,
                  controllerSlot: 'local:0',
                  update: 'replace',
                  plan: {
                    kind: 'queue',
                    actions: Array.from({ length: 32 }, () => ({ kind: 'wait' }))
                  }
                }))
              : []
        };
        label = String(length);
      }
      if (action === 'party:window' && scene === 'windows' && index === 64) {
        const a = g.activeControlledActors.at(-1),
          food = a.inventory.items.find((i) => i.consumableId === 'ration_of_food');
        if (food)
          data.plans = [
            {
              actorId: a.id,
              controllerSlot: 'local:0',
              update: 'replace',
              plan: {
                kind: 'queue',
                actions: [{ kind: 'item', operation: 'use', itemId: food.id, target: null }]
              }
            }
          ];
        label = 'confirmation';
      }
      if (
        action === 'party:window' &&
        scene === 'windows' &&
        index === 128 &&
        mode === 'party-all'
      ) {
        const a = g.activeControlledActors[0];
        data.plans = [
          {
            actorId: a.id,
            controllerSlot: 'local:0',
            update: 'replace',
            plan: {
              kind: 'queue',
              actions: [
                {
                  kind: 'module',
                  owner: 'combat',
                  commandId: 'attack',
                  payload: { attackId: 'fixture.double-thrust', facing: 's' }
                }
              ]
            }
          }
        ];
        data.length = { kind: 'ticks', ticks: 100 };
        label = 'phased';
      }
      if (action === 'party:window' && scene === 'windows' && index === 129 && mode === 'party-all') {
        data.length = { kind: 'ticks', ticks: 100 };
        label = 'phased-resume';
      }
    } else
      data = {
        kind: action,
        schema: 1,
        expectedRevision: revision,
        issuerSlot: 'local:0',
        actorId,
        intent: { kind: 'wait' }
      };
    if (
      scene !== 'single' &&
      action === 'party:actor-step' &&
      g.party.state.window.members.some(
        (m) =>
          m.plan?.kind === 'travel' ||
          (m.plan?.kind === 'queue' && m.cursor < m.plan.actions.length)
      )
    ) {
      action = 'party:policy';
      data = {
        kind: action,
        schema: g.party.state.schema>=3?2:1,
        expectedRevision: revision,
        issuerSlot: 'local:0',
        actorId: g.activeControlledActors[0].id,
        change: { kind: 'single-step' }
      };
      label = 'explicit-clear';
    }
    const memberState = g.controlledActors.map((a) => ({
      id: a.id,
      hp: a.hp,
      speed: a.movementSpeed,
      timer: a.ticksUntilTurn,
      paralyzed: a.hasStatus('paralyzed'),
      slumber: a.hasStatus('slumber'),
      entranced: a.hasStatus('entranced'),
      busy: g.actorActions?.bundles.some((b) => b.decisionOwnerId === a.id) ?? false
    }));
    if(scene==='ai'&&!g.party.state.window.decision){
      const member=g.party.state.members[index%actors],phase=index%32;
      if([8,16,24].includes(phase)){
        action='party:ai';label='ai-settings';data={kind:action,schema:1,issuerSlot:'local:0',expectedRevision:revision,change:{kind:'settings',actorId:member.actorId,expectedEpoch:member.controlEpoch,settings:{...member.ai.settings,tactic:['follow','attack','distance','defend','still'][Math.floor(index/8)%5]}}};
        if(data.change.settings.tactic===member.ai.settings.tactic)data.change.settings.avoidDanger=!member.ai.settings.avoidDanger;
      }else if(phase===12){
        action='party:ai';label='ai-order';const m=g.party.state.members[0];data={kind:action,schema:1,issuerSlot:'local:0',expectedRevision:revision,change:{kind:'order',actorIds:[m.actorId],order:Math.floor(index/32)%2===0?null:{kind:'explore',level:g.depth}}};
      }else if(phase===20||phase===22){
        const m=g.party.state.members[0];action='party:ai';label=phase===20?'ai-human-switch':'ai-return';data={kind:action,schema:1,issuerSlot:'local:0',expectedRevision:revision,change:{kind:'controller',actorId:m.actorId,expectedEpoch:m.controlEpoch,controller:phase===20?{kind:'human',slot:'local:0'}:{kind:'ai',policyId:'party-ai-v1'}}};
      }else if(phase===21&&g.party.state.members[0].controller.kind==='human'){
        data.plans=[{actorId:g.party.state.members[0].actorId,controllerSlot:'local:0',update:'replace',plan:{kind:'ai-this-window'}}];label='ai-temporary';
      }
    }
    const ordinals=g.party.state.members.reduce((n,m)=>n+(m.ai?.ordinal??0),0);
    measuringAi=scene==='ai';
    try{g.executeCommand(action, data);drain(g);}finally{measuringAi=false;}
    if(scene==='ai')aiCounters.acceptedDecisions+=g.party.state.members.reduce((n,m)=>n+m.ai.ordinal,0)-ordinals;
    const simulated = performance.now(),
      processCpu = process.cpuUsage(cpuStart);
    inputs.push({ action, data });
    const awaiting = g.recordingInputBlocked;
    if (awaiting) {
      const f = performance.now();
      await g.flushRecording();
      flush.push(performance.now() - f);
      nonemptyFlush++;
    }
    assert.equal(g.recordedInputEvents.length, initialRecordLength + index + 1, `Input ${index} (${label}) was not recorded exactly once`);
    const end = performance.now(),
      tick = timeSystem.currentTick,
      receipt = ['party:window', 'party:decision'].includes(action)
        ? g.party.state.window.receipt
        : null;
    samples.push({
      index,
      startedMs: acceptedAt - started,
      finishedMs: end - started,
      action,
      label,
      processCpuMs: (processCpu.user + processCpu.system) / 1000,
      waitMs: acceptedAt - inputStart,
      synchronousMs: simulated - acceptedAt,
      layers: Object.fromEntries(Object.entries(layers).map(([key, values]) => [key,
        stats(values.slice(layerOffsets[key]))])),
      inputToReadyMs: end - inputStart,
      ticks: tick - before,
      blocks: g.absoluteTurnNumber - turns,
      npcActions: npcCounts.actions - npc,
      memberActions:
        receipt?.trace.filter((t) => t.outcome === 'accepted').length ??
        (action === 'party:actor-step' ? 1 : 0),
      reason: receipt?.reason ?? 'single',
      actors: memberState,
      depth: g.depth,
      entities: g.monsters.length + g.controlledActors.length,
      recordLength: g.recordedInputEvents.length
    });
    rows.push({
      actorId,
      revision: g.party.state.revision,
      tick,
      hp: g.controlledActors.map((a) => [a.id, a.hp, a.nutrition]),
      rng: rng.getState()
    });
    observeCross(index + 1);
    if (boundary || index === 0 || [254, 255, 256, 2046, 2047, 2048, steps - 1].includes(index)) {
      const p = performance.now(),
        world = g.projectWholeRun();
      projection.push(performance.now() - p);
      const input = g.recordingInputState();
      const f = performance.now();
      mechanicalDigest(world, input);
      full.push(performance.now() - f);
      const e = performance.now();
      new TextEncoder().encode(JSON.stringify(world));
      encoding.push(performance.now() - e);
      if (g.partyPlanner) {
        const beforePreview = mechanicalDigest(world, input),
          random = rng.getState(),
          pr = performance.now(),
          planner = g.partyPlanner(),
          request = planner.batch(timeSystem.currentTick, { kind: 'ticks', ticks: 100 }, null);
        await planner.rehearse(g.knownPartyWorld(), request,scene==='ai'?view=>g.decideKnownPartyAi(view):undefined);
        preview.push(performance.now() - pr);
        g.partyPlanner(false);
        if (
          hash(mechanicalDigest(g.projectWholeRun(), g.recordingInputState())) !==
            hash(beforePreview) ||
          hash(random) !== hash(rng.getState())
        )
          previewPollution++;
      }
      const ft = performance.now();
      g.focusPartyMember(g.controlledActors[(index + 1) % actors].id);
      focus.push(performance.now() - ft);
      saveSizes.push({
        index,
        afterCommand: g.recordedInputEvents.length,
        bytes: Buffer.byteLength(JSON.stringify(await g.toSaveSnapshotAsync()))
      });
    }
  }
  await g.flushRecording();
  const save = await g.toSaveSnapshotAsync(),
    recording = g.exportRecording(),
    input = g.recordingInputState(),
    world = g.projectWholeRun(),
    digest = mechanicalDigest(world, input),
    random = rng.getState(),
    metrics = g.recordingMetrics;
  measureStats = false;
  const statDiagnostics = { instances: statInstances.size, clears: statClears, hits: 0, misses: 0 };
  for (const [instance, before] of statInstances) {
    statDiagnostics.hits += instance.diagnostics.hits - before.hits;
    statDiagnostics.misses += instance.diagnostics.misses - before.misses;
  }
  // Deliver observer entries before verification starts; GC is observational.
  await new Promise(setImmediate);
  collectGc(gcObserver.takeRecords());
  gcObserver.disconnect();
  const memoryAtEnd = process.memoryUsage(),
    measuredGc = gcEvents.filter((e) => e.startTime >= started),
    measurementWallMs = performance.now() - started,
    measurementCpu = process.cpuUsage(measurementCpuStart),
    totalProcessCpuMs = (measurementCpu.user + measurementCpu.system) / 1000,
    verificationStart = performance.now();
  const h = new Game({ seed: 1 });
  live.push(h);
  assert.ok(h.loadSnapshot(JSON.parse(JSON.stringify(save))), 'Save rejected');
  assert.deepEqual(mechanicalDigest(h.projectWholeRun(), h.recordingInputState()), digest);
  assert.deepEqual(rng.getState(), random);
  assert.ok(h.loadReplay(recording), 'Replay rejected');
  assert.equal(recording.events.length, initialRecordLength + steps);
  while (h.replayCursor < recording.events.length && !h.replayError) {
    const cursor = h.replayCursor;
    h.replayStep(true);
    assert.ok(h.replayError || h.replayCursor > cursor, `Replay stalled at ${cursor}`);
  }
  assert.equal(h.replayError, null);
  assert.deepEqual(rng.getState(), random);
  assert.deepEqual(mechanicalDigest(h.projectWholeRun(), h.recordingInputState()), digest);
  if (crossTarget) {
    h.replaySeek(0); assert.equal(h.replayCursor, 0); assert.equal(h.replayError, null);
    h.replaySeek(recording.events.length); assert.equal(h.replayCursor, recording.events.length); assert.equal(h.replayError, null);
    assert.deepEqual(mechanicalDigest(h.projectWholeRun(), h.recordingInputState()), digest);
    assert.deepEqual(rng.getState(), random);
  }
  assert.equal(previewPollution, 0);
  const positive = samples.filter((s) => s.ticks > 0),
    zero = samples.filter((s) => s.ticks === 0),
    ticks = samples.reduce((n, s) => n + s.ticks, 0),
    cpu = samples.reduce((n, s) => n + s.processCpuMs, 0),
    bytes = (v) => Buffer.byteLength(JSON.stringify(v));
  const segmentEvents = recording.events.filter((e) =>
    ['party:window', 'party:decision'].includes(e.action)
  );
  const segmentBytes = segmentEvents.reduce((n, e) => n + bytes(e), 0),
    acceptedIntents = segmentEvents.reduce(
      (n, e) => n + (e.partyReceipt?.trace.filter((t) => t.outcome === 'accepted').length ?? 0),
      0
    );
  write(resolve(output), {
    identity: scene==='ai'?'party-ai-v1':'party-window-v1',
    ...(crossTarget ? {crossformat:{identity:CROSSFORMAT_ID,allowedDeltas:CROSSFORMAT_DELTAS,target:crossTarget,nativeCodec:{foundation:recording.codec.foundation,wholeRun:recording.codec.wholeRun,recording:recording.version,origin:recording.codec.origin,state:save.party.state.schema},frames:crossFrames,lifecycle:{saveLoad:true,seedReplay:true,seek:true},proofTiming:quantile(crossProofMs),timingScope:'Proof outside input-to-ready; included in measurement wall and process CPU'}} : {}),
    ...(scene==='ai'?{aiCounters}:{} ),
    status: 'measurement-only',
    mode,
    actors,
    steps,
    scene,
    sourceHash,
    node: process.version,
    machine: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
    input: {
      seed: 42,
      manifest,
      hash: hash(inputs),
      route: scene === 'ai' ? 'party-ai-managed-v1' : scene === 'single' ? 'ready-actor-wait-v1' : 'window-mixed-v1'
    },
    rowsHash: hash(rows),
    rngHash: hash(random),
    fullDigest: digest.root,
    fullDomains: digest.domains,
    oos: 0,
    previewPollution,
    initialRecordLength,
    finalRecordLength: recording.events.length,
    ticks,
    zeroTicks: zero.length,
    positiveTicks: positive.length,
    positive: quantile(positive.map((s) => s.synchronousMs)),
    zero: quantile(zero.map((s) => s.synchronousMs)),
    inputToReady: quantile(samples.map((s) => s.inputToReadyMs)),
    acceptWait: quantile(samples.map((s) => s.waitMs)),
    cold: samples[0],
    warm: quantile(samples.slice(1).map((s) => s.inputToReadyMs)),
    cpuPerTick: ticks ? cpu / ticks : null,
    totalProcessCpuMs,
    totalCpuPerTick: ticks ? totalProcessCpuMs / ticks : null,
    totalCpuScope:
      'measurement loop, diagnostics and final save/export/flush; all process threads; excludes setup and replay verification',
    gc: {
      scope: 'measurement only; durations overlap layer/input wall timers; never add twice',
      stats: quantile(measuredGc.map((e) => e.duration)),
      events: measuredGc.map((e) => ({...e, startTime: e.startTime - started})),
      byKind: Object.fromEntries([...new Set(measuredGc.map((e) => e.kind))].map((kind) => [
        kind, quantile(measuredGc.filter((e) => e.kind === kind).map((e) => e.duration))
      ]))
    },
    measurementMemory: {start: memoryAtStart, end: memoryAtEnd, scope: 'endpoints, not peak'},
    cpuScope:
      'process CPU during synchronous input; includes concurrent Worker threads; layer timers are wall time',
    buckets: Object.fromEntries(
      [...new Set(samples.map((s) => s.label + ':' + s.reason))].map((key) => [
        key,
        quantile(
          samples.filter((s) => s.label + ':' + s.reason === key).map((s) => s.inputToReadyMs)
        )
      ])
    ),
    wallMs: performance.now() - started,
    measurementWallMs,
    verificationWallMs: performance.now() - verificationStart,
    wallMsScope:
      'measurement plus save/load/replay verification; input-to-ready is reported separately',
    layers: Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, quantile(v)])),
    projection: quantile(projection),
    full: quantile(full),
    encoding: quantile(encoding),
    flush: quantile(flush),
    nonemptyFlush,
    preview: quantile(preview),
    focus: quantile(focus),
    workerMetrics: metrics,
    artifactDigests: { save: hash(save), recording: hash(recording) },
    statDiagnostics,
    mechanicalCauses,
    bytes: {
      save: bytes(save),
      recording: bytes(recording),
      partyControl: bytes(save.party.state),
      extraActors: bytes(save.party.actors),
      averageWholeRecordingPerEvent: bytes(recording) / recording.events.length,
      segments: {
        events: segmentEvents.length,
        acceptedIntents,
        bytes: segmentBytes,
        perSegment: segmentEvents.length ? segmentBytes / segmentEvents.length : null,
        perIntent: acceptedIntents ? segmentBytes / acceptedIntents : null
      },
      accelerationSnapshots: bytes(recording.snapshots)
    },
    memory: {
      kind: 'process endpoint after verification with two live games, not peak or per-member net cost',
      ...process.memoryUsage()
    },
    saveSizes,
    samples
  });
  write(resolve(output + '.save.json'), save);
  write(resolve(output + '.recording.json'), recording);
} finally {
  gcObserver?.disconnect();
  for (const g of live) g.disposeRecording();
  await server.close();
  rmSync(dir, { recursive: true, force: true });
}
