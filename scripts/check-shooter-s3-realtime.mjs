#!/usr/bin/env node
/** Ten WALL-CLOCK minutes at the production 30 Hz rate. Every one of the 209
 * enemies stays alive; the player moves and respawns normally, without firing.
 * Timers below are exclusively the external wall-clock driver, never mechanics. */
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const args = process.argv.slice(2), directory = resolve(args.includes('--output') ? args[args.indexOf('--output') + 1] : '../shooter-s3-realtime');
mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
    const { ShooterSession } = await server.ssrLoadModule('/src/products/shooter/ShooterSession.ts');
    const { RealtimeSimulationDriver } = await server.ssrLoadModule('/src/engine/Simulation/RealtimeSimulationDriver.ts');
    const session = new ShooterSession(7301, { modules: ['firearms', 'hordes'] }), durations = []; let snapshot = session.snapshot();
    assert.deepEqual([snapshot.population.swarm, snapshot.population.elites, snapshot.population.bosses], [200, 8, 1]);
    let pumps = 0, peakBacklog = 0, latePumps = 0, minimum = 209;
    const driver = new RealtimeSimulationDriver({ id: 'shooter-realtime-30', ticksPerSecond: 30 }, () => {
        const tick = session.tick + 1, [moveX, moveY] = [[127,0],[0,127],[-127,0],[0,-127]][Math.floor((tick - 1) % 480 / 120)];
        const begin = performance.now();
        session.advanceTick({ tick, moveX, moveY, aimAngle: tick * 7 % 4096, buttons: 0 }); snapshot = session.snapshot();
        durations.push(performance.now() - begin);
        minimum = Math.min(minimum, snapshot.population.swarm + snapshot.population.elites + snapshot.population.bosses);
    });
    const start = performance.now(); driver.pump(0);
    while (session.tick < 18000) {
        const state = driver.pump(Math.round((performance.now() - start) * 1000), Math.min(driver.maxTicksPerPump, 18000 - session.tick));
        pumps++; peakBacklog = Math.max(peakBacklog, state.backlogTicks); if (state.backlogTicks) latePumps++;
        if (session.tick < 18000) await new Promise(r => setTimeout(r, 5));
    }
    durations.sort((a,b) => a-b);
    const result = { schema:1, status: peakBacklog === 0 && minimum === 209 ? 'passed' : 'failed', node:process.version,
        wallSeconds:(performance.now()-start)/1000, ticks:session.tick, ticksPerSecond:30, minimumLiveEnemies:minimum,
        population:snapshot.population, fullActorCount:snapshot.moduleStates.hordes.full.length,
        pumps, peakBacklog, latePumps, tickCpuMs:Object.fromEntries([50,95,99].map(p => ['p'+p,durations[Math.floor(durations.length*p/100)]])),
        stats:snapshot.stats };
    writeFileSync(join(directory,'report.json'),JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
    assert.equal(minimum,209); assert.equal(peakBacklog,0); assert.ok(result.wallSeconds>=600);
} finally { await server.close(); }
