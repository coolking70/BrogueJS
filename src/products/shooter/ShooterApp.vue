<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import { SimulationHost } from '../../engine/Simulation/SimulationHost';
import { RealtimeSimulationDriver } from '../../engine/Simulation/RealtimeSimulationDriver';
import { InputFrameAssembler } from './input/InputFrameAssembler';
import { canonicalState, MAX_SHOOTER_TICKS, replayShooter, ShooterSession } from './ShooterSession';
import { SHOOTER_PROFILE } from './profile';
import ShooterCanvas from './components/ShooterCanvas.vue';
import MovementStick from './components/MovementStick.vue';
import { KeyboardMovement, gamepadMovement } from './input/MovementAdapters';

const { t } = useTranslation();
const STORAGE_KEY = 'broguejs-shooter-s1-checkpoint-v2';
let session = new ShooterSession();
let host = new SimulationHost(session);
const input = new InputFrameAssembler();
const keyboard = new KeyboardMovement();
let touch = { x: 0, y: 0, active: false };
const padConnected = ref(false);
function clearInput(): void { input.clear(); keyboard.clear(); touch = { x: 0, y: 0, active: false }; }
function sampleMovement(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(value => value?.connected && value.mapping === 'standard');
    padConnected.value = !!pad;
    const keys = keyboard.sample();
    const sample = touch.active ? touch : keys.x || keys.y ? keys : gamepadMovement(pad);
    input.setMovement(sample.x, sample.y);
}
const makeDriver = () => new RealtimeSimulationDriver(SHOOTER_PROFILE.simulation, () => { sampleMovement(); host.step(input.next(host.tick + 1)); });
let driver = makeDriver();
const snapshots = shallowRef(host.snapshots());
const clock = shallowRef(driver.sample());
const message = ref('');
const failed = ref(false);
const saved = ref(false);
const seed = ref(7301);
let frameId = 0;
const elapsed = computed(() => (snapshots.value.current.tick / 30).toFixed(2));
const phases = computed(() => snapshots.value.current.actors.map(actor => {
    const child = snapshots.value.current.actions.bundles.find(bundle => bundle.decisionOwnerId === actor.id)?.subactions[0];
    return child?.phases[child.phaseIndex]?.kind ?? 'idle';
}));
function phaseLabel(phase: string | undefined): string {
    switch (phase) {
        case 'windup': return t('shooter.phase.windup');
        case 'inter-segment': return t('shooter.phase.inter-segment');
        case 'recovery': return t('shooter.phase.recovery');
        case 'break-recovery': return t('shooter.phase.break-recovery');
        default: return t('shooter.phase.idle');
    }
}
function publish(): void { snapshots.value = host.snapshots(); clock.value = driver.sample(); }
function fail(error: unknown): void {
    try { driver.pause(); } catch { /* A faulted driver is already permanently stopped. */ }
    failed.value = true;
    message.value = t('shooter.error', { reason: error instanceof Error ? error.message : String(error) });
    clock.value = { ...clock.value, paused: true };
}
function replace(next: ShooterSession): void {
    session = next; host = new SimulationHost(session); driver = makeDriver(); driver.pause();
    clearInput(); failed.value = false; publish();
}
function toggle(): void {
    if (driver.paused) driver.resume(); else driver.pause();
    clearInput(); publish();
}
function step(): void {
    try { host.step(input.next(host.tick + 1)); publish(); } catch (error) { fail(error); }
}
function restart(): void {
    try { replace(new ShooterSession(seed.value)); message.value = ''; } catch (error) { fail(error); }
}
function save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session.snapshot())); saved.value = true; message.value = t('shooter.saved'); }
    catch (error) { message.value = t('shooter.error', { reason: String(error) }); }
}
function load(): void {
    try { replace(ShooterSession.fromSnapshot(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))); message.value = t('shooter.loaded'); }
    catch (error) { message.value = t('shooter.error', { reason: String(error) }); }
}
function verify(): void {
    driver.pause(); clearInput();
    try {
        const replayed = replayShooter(session.exportReplay());
        if (canonicalState(replayed.snapshot()) !== canonicalState(session.snapshot())) throw new Error('State mismatch');
        message.value = t('shooter.verified', { count: session.exportReplay().frames.length }); publish();
    } catch (error) { fail(error); }
}
function exportReplay(): void {
    const blob = new Blob([JSON.stringify(session.exportReplay())], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'broguejs-shooter-s1-replay.json'; link.click(); URL.revokeObjectURL(url);
}
async function importReplay(event: Event): Promise<void> {
    const element = event.target as HTMLInputElement, file = element.files?.[0];
    if (!file) return;
    driver.pause(); clearInput(); publish();
    try {
        if (file.size > 20 * 1024 * 1024) throw new Error('Replay exceeds 20 MiB');
        replace(replayShooter(JSON.parse(await file.text()))); message.value = t('shooter.imported');
    } catch (error) { message.value = t('shooter.error', { reason: String(error) }); }
    element.value = '';
}
function keyEvent(event: KeyboardEvent): void {
    if (event.type === 'keyup') { keyboard.key(event.code, false); return; }
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    if (event.type === 'keydown' && (driver.paused || failed.value || event.metaKey || event.ctrlKey || event.altKey)) return;
    if (keyboard.key(event.code, event.type === 'keydown')) event.preventDefault();
}
function blur(): void { if (!failed.value) { driver.pause(); clearInput(); publish(); } }
function visibility(): void { if (document.hidden && !failed.value) { driver.pause(); clearInput(); publish(); } }
function animate(timestampMs: number): void {
    if (!failed.value) {
        try {
            if (host.tick >= MAX_SHOOTER_TICKS) { driver.pause(); message.value = t('shooter.limit'); }
            clock.value = driver.pump(Math.round(timestampMs * 1000)); snapshots.value = host.snapshots();
        } catch (error) { fail(error); }
    }
    frameId = requestAnimationFrame(animate);
}
onMounted(() => {
    try { saved.value = localStorage.getItem(STORAGE_KEY) !== null; } catch { /* Storage is optional. */ }
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', keyEvent); window.addEventListener('keyup', keyEvent); window.addEventListener('blur', blur);
    frameId = requestAnimationFrame(animate);
});
onBeforeUnmount(() => { cancelAnimationFrame(frameId); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('keydown', keyEvent); window.removeEventListener('keyup', keyEvent); window.removeEventListener('blur', blur); });
</script>

<template>
  <main class="lab">
    <header><span class="eyebrow">{{ t('shooter.eyebrow') }}</span><span class="status" :class="{ paused: clock.paused }">{{ clock.paused ? t('shooter.paused') : t('shooter.running') }}</span></header>
    <h1>{{ t('shooter.title') }}<span>{{ t('shooter.stage') }}</span></h1>
    <p class="intro">{{ t('shooter.intro') }}</p>
    <section class="metrics">
      <div><label>{{ t('shooter.tick') }}</label><strong data-testid="tick">{{ snapshots.current.tick }}</strong></div>
      <div><label>{{ t('shooter.elapsed') }}</label><strong>{{ elapsed }}<small>{{ t('shooter.seconds') }}</small></strong></div>
      <div><label>{{ t('shooter.rate') }}</label><strong>30<small>{{ t('shooter.hz') }}</small></strong></div>
      <div><label>{{ t('shooter.backlog') }}</label><strong :class="{ warning: clock.backlogTicks > 0 }">{{ clock.backlogTicks }}</strong></div>
    </section>
    <ShooterCanvas :previous="snapshots.previous" :current="snapshots.current" :alpha="clock.alpha" />
    <section class="movement-panel">
      <MovementStick :disabled="clock.paused || failed" @move="touch = $event" />
      <div class="movement-readout">
        <p class="movement-help">{{ t('shooter.movementHelp') }}</p>
        <p>{{ padConnected ? t('shooter.gamepadConnected') : t('shooter.gamepadHint') }}</p>
        <p data-testid="position">{{ t('shooter.position', { x: snapshots.current.actors[0]!.pose.x, y: snapshots.current.actors[0]!.pose.y }) }}</p>
        <p data-testid="environment">{{ t('shooter.environment', snapshots.current.actors[0]!.contactTicks) }}</p>
      </div>
    </section>
    <p class="legend">{{ t('shooter.legend') }}</p>
    <section class="actors">
      <article v-for="(actor, index) in snapshots.current.actors" :key="actor.id">
        <h2>{{ index === 0 ? t('shooter.manualActor') : t('shooter.autoActor') }}<span>{{ phaseLabel(phases[index]) }}</span></h2>
        <p>{{ t('shooter.actorStats', { remaining: actor.ticksUntilTurn, count: actor.resolved }) }}</p>
      </article>
    </section>
    <section class="controls">
      <button class="primary" data-testid="toggle" :disabled="failed" @click="toggle">{{ clock.paused ? t('shooter.resume') : t('shooter.pause') }}</button>
      <button data-testid="step" :disabled="!clock.paused || failed" @click="step">{{ t('shooter.step') }}</button>
      <button data-testid="pulse" :disabled="failed" @click="input.requestPulse()">{{ t('shooter.pulse') }}</button>
      <label class="seed">{{ t('shooter.seed') }}<input v-model.number="seed" type="number" min="1" max="4294967295" /></label>
      <button @click="restart">{{ t('shooter.restart') }}</button>
    </section>
    <section class="persistence">
      <div><h2>{{ t('shooter.checkpointTitle') }}</h2><p>{{ t('shooter.checkpointHelp') }}</p></div>
      <div class="buttons">
        <button :disabled="failed" @click="save">{{ t('shooter.save') }}</button><button :disabled="!saved" @click="load">{{ t('shooter.load') }}</button>
        <button data-testid="verify" :disabled="failed" @click="verify">{{ t('shooter.verify') }}</button>
        <button :disabled="failed" @click="exportReplay">{{ t('shooter.export') }}</button>
        <label class="file-button">{{ t('shooter.import') }}<input type="file" accept=".json,application/json" @change="importReplay" /></label>
      </div>
    </section>
    <p v-if="message" class="notice" data-testid="message">{{ message }}</p>
    <footer>{{ t('shooter.scope') }}</footer>
  </main>
</template>

<style>
:root { color-scheme: dark; font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #e0e9dd; background: #0e1512; }
* { box-sizing: border-box; } body { margin: 0; } button, input { font: inherit; }
.lab { max-width: 1020px; margin: 0 auto; padding: 44px 42px 28px; }
header { display: flex; justify-content: space-between; align-items: center; }
.eyebrow { color: #9aac9c; font-size: 12px; letter-spacing: .14em; }
.status { font-size: 12px; color: #d2ef9b; border: 1px solid #526345; padding: 6px 11px; border-radius: 20px; }
.status.paused { color: #e4c797; border-color: #796542; }
h1 { font-size: clamp(26px, 5vw, 40px); font-weight: 500; letter-spacing: -.04em; margin: 26px 0 12px; }
h1 span { color: #91a586; font-size: 15px; letter-spacing: 0; display: inline-block; margin-left: 20px; }
.intro { color: #9bac9e; font-size: 14px; line-height: 1.8; max-width: 740px; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); margin: 28px 0 25px; gap: 16px; }
.metrics div { border-left: 1px solid #3a4b3e; padding-left: 16px; }.metrics label { font-size: 12px; color: #9aac9c; display: block; margin-bottom: 8px; }
.metrics strong { font: 32px ui-monospace, monospace; } .metrics small { font: 12px sans-serif; margin-left: 8px; color: #91a586; }.warning { color: #eaa573; }
.movement-panel { display: flex; align-items: center; gap: 24px; margin: 16px 0 8px; }.movement-readout { min-width: 0; color: #9aac9c; font-size: 12px; line-height: 1.6; }.movement-readout p { margin: 5px 0; }.movement-help { color: #d2e5c4; }.legend { color: #879b8d; font-size: 12px; }
.actors { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 14px 6px 12px; }
h2 { font-size: 14px; font-weight: 500; margin: 10px 0; } .actors h2 span { color: #9dac90; float: right; font-size: 12px; }
.actors article:nth-child(2) h2 { color: #8dc6e0; }.actors p, .persistence p { color: #879b8d; font-size: 12px; line-height: 1.7; }
.controls, .buttons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
button, .file-button { background: #1b291f; border: 1px solid #3c5140; color: #e0e9dd; padding: 10px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; }
button:hover, .file-button:hover { background: #293b2c; }button.primary { color: #182115; background: #d2ef9b; border-color: #d2ef9b; }button:disabled { opacity: .38; cursor: default; }
.seed { font-size: 12px; color: #9aac9c; display: flex; align-items: center; gap: 8px; margin-left: auto; }
.seed input { width: 100px; background: #0e1512; color: #c6d9bc; border: 1px solid #3c5140; padding: 9px; border-radius: 5px; }
.persistence { margin-top: 26px; border-top: 1px solid #304134; padding: 15px 0 5px; }.file-button input { display: none; }
.notice { border-left: 2px solid #d2ef9b; background: #1a271d; color: #cce3b7; padding: 12px; font-size: 13px; overflow-wrap: anywhere; }
footer { color: #748c7b; font-size: 11px; line-height: 1.8; margin-top: 26px; }
@media (max-width: 600px) { .lab { padding: 24px 18px; }.movement-panel { gap: 14px; }.movement-readout { font-size: 11px; }.metrics { gap: 8px; }.metrics div { padding-left: 9px; }.metrics strong { font-size: 24px; }h1 span { display: block; margin: 10px 0 0; }.actors { gap: 18px; }.actors h2 span { float: none; display: block; margin-top: 8px; }.seed { margin-left: 0; } }
</style>
