/** Fixed C3 scene, three count repetitions. Controlled setup; production commands/clock. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { boot, write, stats } from './ext-perf-common.mjs';
const output = process.argv[2];
assert.ok(output);
const { server, load } = await boot();
try {
  const { createWorldHarness, worldHarnessGame } = await load('ext/testing/worldHarness.ts');
  const { TerrainType } = await load('engine/Map/Grid.ts');
  const { assembleWorldItem } = await load('engine/Items/WorldItems.ts');
  const { assembleDropItem } = await load('engine/Items/FixedItemAssembly.ts');
  const { itemDefinition, readWorkContext, clearWorldCell } = await load(
    'engine/Core/WorldWorkWorld.ts'
  );
  const { workItemStamp } = await load('engine/Core/WorldWorkItems.ts');
  const {
    prepareWorldWorkCommand,
    commitWorldWork,
    withWorldActorScope,
    settleWorldWork,
    cancelWorldWork
  } = await load('engine/Core/WorldWork.ts');
  const { productionActorActionScheduler } = await load('engine/Core/ActorActionProduction.ts');
  const { readLootGameView } = await load('ext/modules/loot/gameView.ts');
  const { rng } = await load('engine/Random.ts');
  const { auditFullObjectGraph } = await load('test/support/fullGenerationCheckpointOracle.ts');
  const { timeSystem } = await load('engine/Systems/Time.ts');
  const { getNextEntityId } = await load('entities/Creature.ts');
  const runs = [];
  for (let round = 1; round <= 3; round++) {
    let h = createWorldHarness({ seed: 51020001, mode: 'easy', modules: ['loot', 'crafting'] }),
      g = worldHarnessGame(h),
      r = g.extensionRuntime;
    for (const m of g.monsters) m.ticksUntilTurn = 1000000;
    g.monsterSpawnFuse = 1000000;
    for (let y = g.player.y - 3; y <= g.player.y + 3; y++)
      for (let x = g.player.x - 3; x <= g.player.x + 3; x++)
        if (x > 0 && y > 0 && x < g.grid.width - 1 && y < g.grid.height - 1) {
          g.grid.setTerrain(x, y, TerrainType.FLOOR);
          const cell = g.grid.getCell(x, y);
          cell.hasMemory = true;
          cell.isVisible = true;
          cell.machineNumber = 0;
          g.grid.impregnableCells.delete(y * g.grid.width + x);
        }
    const read = () => {
      const v = readWorkContext(g, 'loot', { kind: 'inventory' });
      assert.ok(v.ok);
      return v.value;
    };
    const add = (id, n) => {
      assert.ok(g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, id), n)));
    };
    add('crafting.stone', 6);
    add('crafting.metal', 72);
    add('crafting.wood', 17);
    add('loot.shard', 80);
    const at = [];
    for (let y = g.player.y - 1; y <= g.player.y + 1; y++)
      for (let x = g.player.x - 1; x <= g.player.x + 1; x++)
        if (clearWorldCell(g, { x, y })) at.push({ x, y });
    assert.equal(
      h.ext('crafting', 'place-station', {
        v: 1,
        definitionId: 'crafting.forge',
        ...at[0],
        inventoryStamp: read().inventoryStamp
      }).error,
      null
    );
    let station = read().stations.find((s) => s.tags.includes('station.forge'));
    assert.ok(station);
    const equipment = () => {
      const data = {
        v: 5,
        baseId: 'leather_armor',
        ilvl: 20,
        rarity: 'normal',
        uniqueId: null,
        setId: null,
        pieceId: null,
        identityKnown: false,
        affixes: [],
        corrupted: false,
        enhancement: 0,
        sockets: 4,
        socketed: Array(4).fill('loot.rune.ka'),
        nameParts: null,
        origin: { source: 'floor', depth: 14 }
      };
      const item = assembleDropItem({
        native: {
          kind: 'leather_armor',
          category: 'armor',
          enchantment: 0,
          runicType: null,
          isCursed: false,
          identified: false,
          familiarityRemaining: 999
        },
        moduleData: { loot: data }
      });
      assert.ok(g.player.inventory.addItem(item));
      r.bindItemData(item);
      return item;
    };
    const target = equipment();
    let transactions = 0;
    const original = r.worldWorkTransaction;
    r.worldWorkTransaction = function (...args) {
      transactions++;
      return original.apply(this, args);
    };
    const t = performance.now();
    readLootGameView(g, target.id, []);
    const coldMs = performance.now() - t,
      before = auditFullObjectGraph([g, rng]),
      allocator = getNextEntityId(),
      tx = transactions,
      hot = [];
    for (let n = 0; n < 100; n++) {
      const t = performance.now();
      readLootGameView(g, target.id, []);
      hot.push(performance.now() - t);
    }
    assert.deepEqual(before.differences(), []);
    assert.equal(getNextEntityId(), allocator);
    assert.equal(transactions, tx);
    const queryTransactions = transactions - tx;
    const p = () => ({
      operationId: 'loot.work.unsocket-all',
      itemId: target.id,
      itemRevision: workItemStamp(target),
      stationId: station.interactableId,
      stationRevision: station.revision,
      inventoryStamp: read().inventoryStamp
    });
    const start = timeSystem.currentTick;
    assert.equal(h.ext('loot', 'item-operation', p()).error, null);
    assert.equal(timeSystem.currentTick - start, 400);
    assert.ok(g.player.inventory.items.includes(target));
    const amount = (id) =>
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === id)
        .reduce((n, i) => n + i.quantity, 0);
    assert.equal(amount('loot.shard'), 40);
    assert.equal(amount('loot.rune.ka'), 4);
    const second = equipment(),
      input = { ...p(), itemId: second.id, itemRevision: workItemStamp(second) };
    g.player.inventory.capacity = 1;
    assert.equal(h.ext('loot', 'item-operation', input).error, 'C5_CAPACITY');
    g.player.inventory.capacity = 26;
    const accept = () => {
      const plan = prepareWorldWorkCommand(g, {
        module: 'loot',
        action: 'item-operation',
        payload: input
      });
      assert.ok(plan.outcome.ok);
      assert.ok(
        withWorldActorScope(g, 'loot', g.player.id, 'trusted-world', (scope) =>
          commitWorldWork(g, plan.outcome.value, scope)
        ).ok
      );
    };
    accept();
    productionActorActionScheduler(g).advanceActionTime(100);
    cancelWorldWork(g, g.world5.tickets[0].ticketId, 'cancelled');
    assert.ok(g.player.inventory.items.includes(second));
    assert.equal(amount('loot.shard'), 40);
    input.inventoryStamp = read().inventoryStamp;
    input.itemRevision = workItemStamp(second);
    accept();
    productionActorActionScheduler(g).advanceActionTime(100);
    g.depth++;
    settleWorldWork(g, false);
    g.depth--;
    assert.ok(g.player.inventory.items.includes(second));
    assert.equal(amount('loot.shard'), 40);
    const conserved={shards:amount('loot.shard'),runes:amount('loot.rune.ka')};
    h.dispose();
    h=createWorldHarness({seed:51020001,mode:'easy',modules:['loot','crafting']});g=worldHarnessGame(h);r=g.extensionRuntime;
    for(const m of g.monsters)m.ticksUntilTurn=1000000;g.monsterSpawnFuse=1000000;
    for(let y=g.player.y-3;y<=g.player.y+3;y++)for(let x=g.player.x-3;x<=g.player.x+3;x++)if(x>0&&y>0&&x<g.grid.width-1&&y<g.grid.height-1){g.grid.setTerrain(x,y,TerrainType.FLOOR);const cell=g.grid.getCell(x,y);cell.hasMemory=true;cell.isVisible=true;cell.machineNumber=0;g.grid.impregnableCells.delete(y*g.grid.width+x);}
    add('crafting.stone',6);add('crafting.metal',68);add('crafting.wood',16);
    assert.equal(h.ext('crafting','place-station',{v:1,definitionId:'crafting.forge',...at[0],inventoryStamp:read().inventoryStamp}).error,null);
    station=read().stations.find(s=>s.tags.includes('station.forge'));
    const craftTx=r.worldWorkTransaction;r.worldWorkTransaction=function(...args){transactions++;return craftTx.apply(this,args);};
    const craft = (batches) => ({
      v: 1,
      recipeId: 'crafting.forge-dagger',
      batchCount: batches,
      stationId: station.interactableId,
      stationRevision: station.revision,
      sourceContainerId: null,
      sourceRevision: null,
      inventoryStamp: read().inventoryStamp
    });
    const beforeIds = new Set(g.player.inventory.items.map((i) => i.id)),
      tick = timeSystem.currentTick;
    assert.equal(h.ext('crafting', 'craft', craft(16)).error, null);
    for (let n = 1; n < 16; n++) h.command('auto_step');
    assert.equal(timeSystem.currentTick - tick, 16000);
    const outputs = g.player.inventory.items.filter(
      (i) => !beforeIds.has(i.id) && i.identityId === 'dagger'
    );
    assert.equal(outputs.length, 16);
    assert.ok(
      outputs.every(
        (i) =>
          i.identified &&
          i.enchantment === 0 &&
          ['normal', 'magic'].includes(i.moduleData.loot.rarity)
      )
    );
    add('crafting.metal',4);add('crafting.wood',1);
    const commit = r.commitWorkItem;
    r.commitWorkItem = () => {
      throw Error('C3 completion fault');
    };
    const paid = timeSystem.currentTick;
    h.ext('crafting', 'craft', craft(1));
    r.commitWorkItem = commit;
    assert.equal(timeSystem.currentTick - paid, 1000);
    assert.equal(g.world5.terminalTickets.at(-1).status, 'cancelled');
    const result = {
      round,
      coldMs,
      hot: stats(hot),
      counts: {
        transactions,
        queryTransactions,
        hotQueries: 100,
        unsocketTicks: 400,
        cancelPaidTicks: 100,
        exitPaidTicks: 100,
        craftBatches: 16,
        craftTicks: 16000,
        failedCraftTicks: 1000,
        shards: conserved.shards,
        runes: conserved.runes,
        outputs: outputs.length
      },
      rng: rng.getState()
    };
    if (runs.length) {
      assert.deepEqual(result.counts, runs[0].counts);
      assert.deepEqual(result.rng, runs[0].rng);
    }
    runs.push(result);
    h.dispose();
  }
  write(output, { status: 'pass', kind: 'controlled C3 supplement', runs });
} finally {
  await server.close();
}
