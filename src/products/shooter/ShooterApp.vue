<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import { SimulationHost } from '../../engine/Simulation/SimulationHost';
import { RealtimeSimulationDriver } from '../../engine/Simulation/RealtimeSimulationDriver';
import { InputFrameAssembler } from './input/InputFrameAssembler';
import type { InputFrame } from './input/InputFrame';
import { canonicalState, MAX_SHOOTER_TICKS, replayShooter, ShooterSession } from './ShooterSession';
import { SHOOTER_PROFILE } from './profile';
import { getRealtimeModules, getStrategicModules } from '../../ext/realtimeCatalog';
import { CampaignSession } from './CampaignSession';
import type { MissionTicket } from '../../engine/Simulation/StrategicRuntime';
import CommandCenter from './components/CommandCenter.vue';
import ShooterCanvas from './components/ShooterCanvas.vue';
import MovementStick from './components/MovementStick.vue';
import SupportPanel from './components/SupportPanel.vue';
import { angleVector } from '../../engine/Movement/QuantizedAngle';
import { createScenarioArena } from './ShooterArena';
import { KeyboardMovement, gamepadMovement } from './input/MovementAdapters';
import { gamepadAim, gamepadButton } from './input/AimAdapters';

const { t } = useTranslation();
const STORAGE_KEY = 'broguejs-shooter-s6-checkpoint-v7';
const CAMPAIGN_KEY='broguejs-shooter-s6-campaign-v1';
const strategic=getStrategicModules();
let campaign=new CampaignSession();
const campaignView=shallowRef(campaign.view()),commandMode=ref(strategic.length>0);
let sortieTicket:MissionTicket|null=null;
let persistedTick=-1;
const operations=strategic.find(d=>d.kind==='operation')??null,armory=strategic.find(d=>d.kind==='meta')??null;
const modules = getRealtimeModules(), selectedModules = ref(modules.map(d => d.id));
const input = new InputFrameAssembler(), keyboard = new KeyboardMovement();
let session = new ShooterSession();
const catalogWeapons=session.snapshot().ranged?.weapons??[],catalogAbilities=session.snapshot().support?.abilities??[];
const makeHost = () => new SimulationHost({ get tick() { return session.tick; },
    advanceTick: (frame: InputFrame) => session.advanceTick(frame, input.nextCommands(frame.tick)), snapshot: () => session.snapshot() });
let host = makeHost();
type Stick = { x: number; y: number; active: boolean; angle?: number | null };
let touch: Stick = { x: 0, y: 0, active: false }, touchAim: Stick = { x: 0, y: 0, active: false };
let aimDevice: 'mouse' | 'stick' = 'mouse';
let mouseFire = false, padReload = false, padEquip = false, padInteract = false, padSupport = false, padConfirm = false, padCancel = false;
const supportSlot = ref<number|null>(null), supportPoint = ref<{x:number;y:number}|null>(null);
let aimAngle = 0;
const padConnected = ref(false);
function clearInput(): void {
    input.clear(); keyboard.clear(); touch = { x: 0, y: 0, active: false }; touchAim = { x: 0, y: 0, active: false };
    mouseFire = false; padReload = false; padEquip = false; padInteract = false;
    padSupport=false; padConfirm=false; padCancel=false; supportSlot.value=null; supportPoint.value=null;
}
function sampleControls(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(p => p?.connected && p.mapping === 'standard');
    padConnected.value = !!pad;
    const keys = keyboard.sample(), movement = touch.active ? touch : keys.x || keys.y ? keys : gamepadMovement(pad);
    input.setMovement(movement.x, movement.y);
    const aim = touchAim.active ? touchAim.angle ?? null : gamepadAim(pad);
    if (aim !== null) { aimDevice = 'stick'; input.setAim(aim); aimAngle=aim; if(supportSlot.value!==null) pointAlongAim(); }
    if(supportSlot.value!==null)input.cancelFire();
    else input.setFire(mouseFire || (touchAim.active && !!(touchAim.x || touchAim.y)) || gamepadButton(pad, 7));
    const reload = gamepadButton(pad, 2), equip = gamepadButton(pad, 3), interact = gamepadButton(pad, 0);
    if (interact && !padInteract && (snapshots.value.current.mission || snapshots.value.current.support?.nearbySupply)) input.requestInteract();
    padInteract = interact;
    if (reload && !padReload && snapshots.value.current.ranged) input.requestReload();
    if (equip && !padEquip && snapshots.value.current.ranged) input.requestEquip(nextWeaponSlot());
    padReload = reload; padEquip = equip;
    const call=gamepadButton(pad,4),confirm=gamepadButton(pad,5),cancel=gamepadButton(pad,1);
    if(call && !padSupport && snapshots.value.current.support) cycleSupport();
    if(confirm && !padConfirm && supportSlot.value!==null) confirmSupport();
    if(cancel && !padCancel) {supportSlot.value=null;supportPoint.value=null;}
    padSupport=call;padConfirm=confirm;padCancel=cancel;
}
const makeDriver = () => new RealtimeSimulationDriver(SHOOTER_PROFILE.simulation, () => { sampleControls(); host.step(input.next(host.tick + 1)); }, 8, () => session.finished);
let driver = makeDriver(); driver.pause();
const snapshots = shallowRef(host.snapshots()), clock = shallowRef(driver.sample());
const message = ref(''), failed = ref(false), saved = ref(false), seed = ref(7301);
let frameId = 0;
const elapsed = computed(() => (snapshots.value.current.tick / 30).toFixed(2));
const combat = computed(() => snapshots.value.current.ranged);
const health = computed(() => snapshots.value.current.damage.actors[0]!);
const mission = computed(() => snapshots.value.current.mission);
const support = computed(() => snapshots.value.current.support);
const supplyNearby=computed(()=>support.value?.nearbySupply!==null && support.value?.nearbySupply!==undefined);
const arenaId=computed(()=>snapshots.value.current.arena);
const arenaGrid=computed(()=>{const descriptor=snapshots.value.current.mission ? modules.find(d=>d.kind==='mission' && (d.scenario.id===arenaId.value || !!snapshots.value.current.setup)) : undefined;
    const d=snapshots.value.current.mission ? modules.find(d=>d.kind==='mission') : undefined;
    const configured=d?.kind==='mission'&&snapshots.value.current.setup&&d.configure?d.configure(snapshots.value.current.setup):descriptor;
    return createScenarioArena(configured?.kind==='mission'?configured.scenario:undefined);});
const supportTarget=computed(()=>{
    const a=support.value?.abilities.find(a=>a.slot===supportSlot.value),p=supportPoint.value;
    if(!a||!p)return null;
    const player=snapshots.value.current.actors[0]!.pose;
    const valid=(p.x-player.x)**2+(p.y-player.y)**2<=a.range**2 && !!arenaGrid.value.getCell(Math.floor(p.x/1024),Math.floor(p.y/1024))?.isPassable;
    return {pose:p,radius:a.radius,range:a.range,dangerous:a.dangerous,valid};
});
function pointAlongAim():void {const p=snapshots.value.current.actors[0]!.pose,d=angleVector(aimAngle,4096);supportPoint.value={x:Math.max(0,p.x+d.x),y:Math.max(0,p.y+d.y)};}
function selectSupport(slot:number):void {if(disabled.value||!support.value||(support.value.abilities.find(a=>a.slot===slot)?.remaining??-1))return;supportSlot.value=slot;mouseFire=false;input.cancelFire();pointAlongAim();}
function cycleSupport():void {const start=supportSlot.value??-1;for(let n=1;n<=4;n++){const slot=(start+n)%4;if(support.value?.abilities.find(a=>a.slot===slot)?.remaining===0){selectSupport(slot);return;}}}
function confirmSupport():void {if(disabled.value||supportSlot.value===null||!supportTarget.value?.valid)return;input.requestSupport(supportSlot.value,supportPoint.value!.x,supportPoint.value!.y);supportSlot.value=null;supportPoint.value=null;}
const nearby = computed(() => mission.value?.markers.find(m => m.id === mission.value?.nearby));
const timer = (ticks: number) => { const seconds = Math.ceil(ticks / 30); return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'); };
const selected = computed(() => combat.value?.weapons.find(w => w.selected));
const disabled = computed(() => commandMode.value || clock.value.paused || failed.value || session.finished || host.tick >= MAX_SHOOTER_TICKS);
function publish(): void { snapshots.value = host.snapshots(); clock.value = driver.sample(); }
function fail(error: unknown): void {
    try { driver.pause(); } catch { /* Already stopped on a permanent clock fault. */ }
    failed.value = true; clearInput(); message.value = t('shooter.error', { reason: error instanceof Error ? error.message : String(error) });
    clock.value = { ...clock.value, paused: true };
}
function replace(next: ShooterSession): void {
    session = next; host = makeHost(); driver = makeDriver(); driver.pause(); clearInput(); failed.value = false; publish();
}
function toggle(): void { if (session.finished) return; if (driver.paused) driver.resume(); else driver.pause(); clearInput(); publish(); }
function step(): void { try { host.step(input.next(host.tick + 1)); publish(); } catch (error) { fail(error); } }
function restart(): void { if(sortieTicket) return; commandMode.value=false; try { replace(new ShooterSession(seed.value, { modules: selectedModules.value })); message.value = ''; } catch (error) { fail(error); } }
function save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session.snapshot())); persistCampaign(); saved.value = true; message.value = t('shooter.saved'); }
    catch (error) { message.value = t('shooter.error', { reason: String(error) }); }
}
function load(): void {
    try { if(sortieTicket)throw new Error('Use the operation continuation to restore this sortie'); replace(ShooterSession.fromSnapshot(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))); message.value = t('shooter.loaded'); }
    catch (error) { message.value = t('shooter.error', { reason: String(error) }); }
}
function verify(): void {
    driver.pause(); clearInput();
    try {
        if (canonicalState(replayShooter(session.exportReplay()).snapshot()) !== canonicalState(session.snapshot())) throw new Error('State mismatch');
        message.value = t('shooter.verified', { count: session.exportReplay().frames.length }); publish();
    } catch (error) { fail(error); }
}
function exportReplay(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(session.exportReplay())], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = 'broguejs-shooter-s6-replay.json'; link.click(); URL.revokeObjectURL(url);
}
async function importReplay(event: Event): Promise<void> {
    const element = event.target as HTMLInputElement, file = element.files?.[0]; if (!file) return;
    driver.pause(); clearInput(); publish();
    try {
        if (file.size > 20 * 1024 * 1024) throw new Error('Replay exceeds 20 MiB');
        const replay=replayShooter(JSON.parse(await file.text())); if(sortieTicket)throw new Error('Finish or abort the sortie before importing a replay'); commandMode.value=false;replace(replay); message.value = t('shooter.imported');
    } catch (error) { message.value = t('shooter.error', { reason: String(error) }); }
    element.value = '';
}
function aimMouse(angle: number, moved: boolean): void { if (moved) aimDevice = 'mouse'; if (aimDevice === 'mouse') {input.setAim(angle);aimAngle=angle;} }
function aimTouch(value: Stick): void { touchAim = value; if (value.angle != null) { aimDevice = 'stick'; input.setAim(value.angle);aimAngle=value.angle;if(supportSlot.value!==null)pointAlongAim(); } input.setFire(supportSlot.value===null && value.active && value.angle != null); }
function fire(held: boolean): void { mouseFire = !disabled.value && supportSlot.value===null && held; input.setFire(mouseFire); }
function keyEvent(event: KeyboardEvent): void {
    if (event.type === 'keyup') { keyboard.key(event.code, false); return; }
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable]') || disabled.value || event.metaKey || event.ctrlKey || event.altKey) return;
    if (keyboard.key(event.code, true)) event.preventDefault();
    if (!event.repeat && event.code === 'KeyE' && (snapshots.value.current.mission || supplyNearby.value)) { input.requestInteract(); event.preventDefault(); }
    if (!event.repeat && support.value) {
        if(/^Digit[5-8]$/.test(event.code)){selectSupport(Number(event.code.slice(-1))-5);event.preventDefault();}
        if(event.code==='KeyQ'){cycleSupport();event.preventDefault();}
        if(event.code==='KeyF' || event.code==='Enter'){confirmSupport();event.preventDefault();}
        if(event.code==='Escape'){supportSlot.value=null;supportPoint.value=null;event.preventDefault();}
    }
    if (!event.repeat && combat.value) {
        if (event.code === 'KeyR') { input.requestReload(); event.preventDefault(); }
        if (/^Digit[1-4]$/.test(event.code)) { input.requestEquip(Number(event.code.slice(-1)) - 1); event.preventDefault(); }
    }
}
function blur(): void { if (!failed.value) { driver.pause(); clearInput(); publish(); } }
function visibility(): void { if (document.hidden) blur(); }
function animate(timestampMs: number): void {
    if (!failed.value && !commandMode.value) try {
        if (host.tick >= MAX_SHOOTER_TICKS) { driver.pause(); clearInput(); message.value = t('shooter.limit'); }
        clock.value = driver.pump(Math.round(timestampMs * 1000), Math.min(driver.maxTicksPerPump, MAX_SHOOTER_TICKS - host.tick)); snapshots.value = host.snapshots();
        if(sortieTicket && host.tick!==persistedTick && (host.tick%300===0||session.finished))persistCampaign();
    } catch (error) { fail(error); }
    frameId = requestAnimationFrame(animate);
}

function nextWeaponSlot():number {const ws=combat.value?.weapons??[];const i=ws.findIndex(w=>w.selected);return ws[(i+1)%ws.length]?.slot??0;}
function persistCampaign():void {localStorage.setItem(CAMPAIGN_KEY,JSON.stringify({campaign:campaign.snapshot(),ticket:sortieTicket,battle:sortieTicket?session.snapshot():null}));persistedTick=session.tick;campaignView.value=campaign.view();}
function strategyAction(write:()=>void):void {try{write();persistCampaign();message.value='';}catch(error){message.value=t('shooter.error',{reason:String(error)});}}
function startOperation(region:number,difficulty:number):void {strategyAction(()=>campaign.execute({kind:'start',region,difficulty}));}
function purchase(type:'weapon'|'support',slot:number):void {strategyAction(()=>campaign.execute({kind:'purchase',type,slot}));}
function equip(slots:number[]):void {strategyAction(()=>campaign.execute({kind:'equip',slots}));}
function deploy():void {strategyAction(()=>{if(!selectedModules.value.some(id=>modules.find(d=>d.id===id)?.kind==='mission'))throw new Error('A mission module is required');
    if(sortieTicket){commandMode.value=false;return;}
    const before=campaign.snapshot();
    const {ticket,setup}=campaign.deploy();try{replace(new ShooterSession(ticket.seed,{modules:selectedModules.value,setup}));}catch(error){campaign=CampaignSession.fromSnapshot(before);throw error;}sortieTicket=ticket;commandMode.value=false;
});}
function returnToCommand():void {strategyAction(()=>{driver.pause();clearInput();if(sortieTicket){
    const m=session.snapshot().mission;if(!m||m.status==='active')throw new Error('Finish or abort this sortie first');
    campaign.settle(sortieTicket,m);sortieTicket=null;
}commandMode.value=true;});}
function training():void {if(sortieTicket){commandMode.value=false;return;}commandMode.value=false;restart();}
function restoreCampaign():void {
    const raw=localStorage.getItem(CAMPAIGN_KEY);if(!raw)return;
    const data=JSON.parse(raw),restored=CampaignSession.fromSnapshot(data.campaign),pending=restored.view().operation?.ticket??null;
    if(canonicalState(pending)!==canonicalState(data.ticket)||!!pending!==!!data.battle)throw new Error('Invalid sortie binding');
    const next=data.battle?ShooterSession.fromSnapshot(data.battle):null;
    if(next && (!next.snapshot().setup || next.snapshot().seed!==pending!.seed || next.snapshot().setup!.variant!==pending!.variant || next.snapshot().setup!.difficulty!==pending!.difficulty))throw new Error('Invalid sortie setup');
    campaign=restored;sortieTicket=pending;if(next)replace(next);persistedTick=next?.tick??-1;campaignView.value=campaign.view();commandMode.value=strategic.length>0;
}

onMounted(() => {
    try{restoreCampaign();}catch(error){message.value=t('shooter.error',{reason:String(error)});}
    try { saved.value = localStorage.getItem(STORAGE_KEY) !== null; } catch { /* Storage is optional. */ }
    document.addEventListener('visibilitychange', visibility); window.addEventListener('keydown', keyEvent);
    window.addEventListener('keyup', keyEvent); window.addEventListener('blur', blur); frameId = requestAnimationFrame(animate);
});
onBeforeUnmount(() => { cancelAnimationFrame(frameId); document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('keydown', keyEvent); window.removeEventListener('keyup', keyEvent); window.removeEventListener('blur', blur); });
</script>

<template>
  <main class="lab">
    <header><span class="eyebrow">{{ t('shooter.eyebrow') }}</span><span class="status" :class="{ paused: clock.paused }">{{ clock.paused ? t('shooter.paused') : t('shooter.running') }}</span></header>
    <h1>{{ t('shooter.title') }}<span>{{ t('shooter.stage') }}</span></h1>
    <p class="intro">{{ t('shooter.intro') }}</p>
    <CommandCenter v-if="commandMode" :operation="campaignView.operation" :meta="campaignView.meta" :operations="operations" :armory="armory" :weapons="catalogWeapons" :abilities="catalogAbilities" :can-deploy="selectedModules.some(id=>modules.find(d=>d.id===id)?.kind==='mission')"
      @start="startOperation" @deploy="deploy" @purchase="purchase" @equip="equip" @training="training" />
    <template v-else>
    <div class="strategy-toolbar" v-if="strategic.length"><span v-if="sortieTicket">{{ t('shooter.strategy.sortie',{index:(campaignView.operation?.index??0)+1}) }}</span>
      <button data-testid="command-return" :disabled="!!sortieTicket && !session.finished" @click="returnToCommand">{{ t('shooter.strategy.return') }}</button>
    </div>
    <section class="combat-hud">
      <div><label>{{ t('shooter.health') }}</label><strong data-testid="health">{{ health.hp }}<small>/ {{ health.maxHp }}</small></strong></div>
      <div><label>{{ t('shooter.ammo') }}</label><strong data-testid="ammo">{{ selected?.ammo ?? 0 }}<small>/ {{ selected?.capacity ?? 0 }}</small></strong></div>
      <div><label>{{ t('shooter.kills') }}</label><strong data-testid="kills">{{ snapshots.current.stats.kills }}</strong></div>
      <div><label>{{ t('shooter.shots') }}</label><strong data-testid="shots">{{ combat?.shots ?? 0 }}</strong></div>
    </section>
    <div class="battle-status" data-testid="battle-status">
      <span v-if="mission && mission.status !== 'active'">{{ t('shooter.result.' + mission.status) }}</span>
      <span v-else-if="health.hp === 0">{{ t('shooter.respawning') }}</span>
      <span v-else-if="combat?.reloadRemaining">{{ t('shooter.reloading', { seconds: (combat.reloadRemaining / 30).toFixed(1) }) }}</span>
      <span v-else-if="selected?.ammo === 0">{{ t('shooter.emptyMagazine') }}</span>
      <span v-else>{{ combat ? t('shooter.ready') : t('shooter.noModule') }}</span>
      <span>{{ t('shooter.deaths', { count: snapshots.current.stats.deaths }) }}</span>
    </div>
    <div v-if="snapshots.current.population" class="population-hud" data-testid="population">
      <span>{{ t('shooter.hordeCounts', { ...snapshots.current.population }) }}</span>
      <span v-if="mission">{{ mission.reinforcements.enabled ? t('shooter.waveActive') : t('shooter.waveQuiet') }}</span><span v-else>{{ t('shooter.reinforcements', { count: snapshots.current.population.pending }) }}</span>
    </div>
    <section v-if="mission" class="mission-panel" data-testid="mission">
      <div class="mission-heading"><div><span class="eyebrow">{{ t('shooter.missionLabel') }}</span><h2>{{ t(mission.titleKey) }}</h2></div>
        <div class="mission-clock"><strong data-testid="mission-time">{{ timer(mission.remaining) }}</strong><small>{{ t('shooter.lives', { count: mission.lives }) }}</small></div></div>
      <div v-if="mission.status !== 'active'" class="mission-result" :class="mission.status" data-testid="mission-result">
        <h2>{{ t('shooter.result.' + mission.status) }}</h2><p>{{ t('shooter.reason.' + mission.reason) }}</p>
        <p v-if="mission.reward" data-testid="mission-reward">{{ t('shooter.reward', { ...mission.reward }) }}</p><p v-else>{{ t('shooter.noReward') }}</p>
        <button v-if="sortieTicket" class="primary" data-testid="sortie-settle" @click="returnToCommand">{{ t('shooter.strategy.settle') }}</button>
        <button v-else class="primary" data-testid="mission-restart" @click="restart">{{ t('shooter.newMission') }}</button>
      </div>
      <template v-else>
        <details class="mission-objectives"><summary>{{ t('shooter.objectives') }}</summary><div class="objective-grid"><article v-for="site in mission.markers.filter(m => !['supply', 'sample'].includes(m.kind))" :key="site.id" :class="site.status" :data-testid="'objective-' + site.id">
          <div><strong>{{ mission.markers.indexOf(site) + 1 }} · {{ t(site.labelKey) }}</strong><span>{{ t('shooter.objectiveStatus.' + site.status) }}</span></div>
          <progress :value="site.progress" :max="site.total" /><small>{{ site.kind === 'nest' ? t('shooter.destroyHint') : t('shooter.holdProgress', { time: timer(site.total - site.progress) }) }}</small>
        </article></div></details>
        <p class="active-goal" data-testid="active-goal">{{ t('shooter.nextGoal') }} <span v-for="site in mission.markers.filter(m => ['ready', 'active'].includes(m.status) && !['rescue', 'sample', 'supply'].includes(m.kind))" :key="site.id">{{ mission.markers.indexOf(site) + 1 }} · {{ t(site.labelKey) }} <small>{{ Math.floor(site.pose.x / 1024) }},{{ Math.floor(site.pose.y / 1024) }}</small> </span></p>
        <p class="mission-extraction" data-testid="extraction-status">{{ t('shooter.extraction.' + mission.extraction, { time: timer(mission.extractionRemaining) }) }}</p>
        <div class="mission-actions"><button class="primary" data-testid="interact" :disabled="disabled || (!nearby && !supplyNearby)" @click="input.requestInteract()">{{ supplyNearby ? t('shooter.support.takeSupply') : nearby ? t('shooter.interactSite', { site: t(nearby.labelKey) }) : t('shooter.interact') }}</button>
          <span>{{ t('shooter.carriedSamples', { count: mission.samples }) }}</span></div>
        <p class="mission-help">{{ t('shooter.missionHelp') }} <span v-if="!combat">{{ t('shooter.demolitionHelp') }}</span></p>
      </template>
    </section>
    <ShooterCanvas :key="snapshots.current.arena" :previous="snapshots.previous" :current="snapshots.current" :alpha="clock.alpha" :disabled="disabled" :support-target="supportTarget"
      @aim="aimMouse" @fire="fire" @target="supportPoint=$event" />
    <SupportPanel v-if="support" :view="support" :disabled="disabled" :selected="supportSlot" :valid="supportTarget?.valid??false"
      @select="selectSupport" @confirm="confirmSupport" @cancel="supportSlot=null;supportPoint=null" />
    <section v-if="combat" class="weapons">
      <button v-for="weapon in combat.weapons" :key="weapon.id" :data-testid="'weapon-' + weapon.slot" :class="{ selected: weapon.selected }"
        :disabled="disabled" @click="input.requestEquip(weapon.slot)"><span>{{ weapon.slot + 1 }} · {{ t(weapon.labelKey) }}</span><small>{{ weapon.ammo }} / {{ weapon.capacity }}</small></button>
    </section>
    <section class="twin-controls">
      <MovementStick :disabled="disabled" @move="touch = $event" />
      <div class="combat-buttons"><button class="primary" data-testid="reload" :disabled="disabled || !combat" @click="input.requestReload()">{{ t('shooter.reload') }}</button>
        <button v-if="mission?.status === 'active' || supplyNearby" data-testid="interact-control" :disabled="disabled || (!nearby && !supplyNearby)" @click="input.requestInteract()">{{ supplyNearby?t('shooter.support.takeSupply'):t('shooter.interact') }}</button>
        <button data-testid="toggle" :disabled="failed || session.finished || host.tick >= MAX_SHOOTER_TICKS" @click="toggle">{{ clock.paused ? t('shooter.resume') : t('shooter.pause') }}</button></div>
      <MovementStick :disabled="disabled || (!combat && supportSlot===null)" aim @move="aimTouch" />
    </section>
    <p class="movement-help">{{ t('shooter.gunplayHelp') }}</p>
    <p class="legend">{{ padConnected ? t('shooter.gamepadConnected') : t('shooter.gamepadHint') }} {{ t('shooter.touchFireHelp') }}</p>
    <details class="diagnostics"><summary>{{ t('shooter.diagnostics') }}</summary>
      <section class="metrics">
        <div><label>{{ t('shooter.tick') }}</label><strong data-testid="tick">{{ snapshots.current.tick }}</strong></div>
        <div><label>{{ t('shooter.elapsed') }}</label><strong>{{ elapsed }}<small>{{ t('shooter.seconds') }}</small></strong></div>
        <div><label>{{ t('shooter.rate') }}</label><strong>30<small>{{ t('shooter.hz') }}</small></strong></div>
        <div><label>{{ t('shooter.backlog') }}</label><strong :class="{ warning: clock.backlogTicks > 0 }">{{ clock.backlogTicks }}</strong></div>
      </section>
      <p data-testid="position">{{ t('shooter.position', { x: snapshots.current.actors[0]!.pose.x, y: snapshots.current.actors[0]!.pose.y }) }}</p>
      <p data-testid="environment">{{ t('shooter.environment', snapshots.current.actors[0]!.contactTicks) }}</p>
      <button v-if="mission?.status === 'active'" data-testid="abort" :disabled="disabled" @click="input.requestAbort()">{{ t('shooter.abort') }}</button>
      <p>{{ t('shooter.moduleSelection') }}</p><label v-for="module in modules" :key="module.id" class="module-option"><input v-model="selectedModules" :data-testid="'module-' + module.id" type="checkbox" :value="module.id" /> {{ t(module.labelKey) }}</label>
      <div class="controls"><button data-testid="step" :disabled="!clock.paused || failed || session.finished || host.tick >= MAX_SHOOTER_TICKS" @click="step">{{ t('shooter.step') }}</button>
        <label class="seed">{{ t('shooter.seed') }}<input v-model.number="seed" type="number" min="1" max="4294967295" /></label><button data-testid="restart" :disabled="!!sortieTicket" @click="restart">{{ t('shooter.restart') }}</button></div>
    </details>
    <section class="persistence">
      <div><h2>{{ t('shooter.checkpointTitle') }}</h2><p>{{ t('shooter.checkpointHelp') }}</p></div>
      <div class="buttons"><button data-testid="save" :disabled="failed" @click="save">{{ t('shooter.save') }}</button><button data-testid="load" :disabled="!saved" @click="load">{{ t('shooter.load') }}</button>
        <button data-testid="verify" :disabled="failed" @click="verify">{{ t('shooter.verify') }}</button><button data-testid="export" :disabled="failed" @click="exportReplay">{{ t('shooter.export') }}</button>
        <label class="file-button">{{ t('shooter.import') }}<input type="file" accept=".json,application/json" @change="importReplay" /></label></div>
    </section>
    </template>
    <p v-if="message" class="notice" data-testid="message">{{ message }}</p><footer>{{ t('shooter.scope') }}</footer>
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

.combat-hud { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 24px 0 16px; }
.combat-hud label { display: block; font-size: 11px; color: #9aac9c; margin-bottom: 6px; }.combat-hud strong { white-space: nowrap; font: 30px ui-monospace, monospace; }.combat-hud small { font-size: 13px; color: #8aa08f; }
.population-hud { display: flex; justify-content: space-between; gap: 8px; color: #c6abc8; font-size: 11px; margin: 8px 2px; flex-wrap: wrap; }
.battle-status { display: flex; justify-content: space-between; font-size: 12px; color: #d2ef9b; margin: 12px 2px; min-height: 18px; }
.weapons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }.weapons button { text-align: left; padding: 12px; }.weapons small { display: block; margin-top: 6px; color: #9aac9c; }.weapons .selected { border-color: #d2ef9b; background: #2a3b27; }
.twin-controls { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 18px 0; }.combat-buttons { display: flex; gap: 10px; }.movement-help { font-size: 12px; line-height: 1.8; }.diagnostics { margin-top: 22px; color: #95a995; font-size: 12px; }.diagnostics summary { cursor: pointer; }.diagnostics .metrics strong { font-size: 24px; }
@media (max-width: 600px) { .lab { padding: 12px; }h1 { font-size: 26px; margin: 14px 0 12px; }h1 span { display: inline; font-size: 12px; margin-left: 10px; }.intro { display: none; }.combat-hud { margin: 12px 0; }.combat-hud small { font-size: 11px; }.battle-status { margin: 8px 2px; }.twin-controls { margin: 14px 0; }.combat-hud strong { font-size: 25px; }.weapons { grid-template-columns: repeat(2, 1fr); }.weapons button { padding: 9px 10px; }.combat-buttons { flex-direction: column; gap: 6px; }.combat-buttons button { padding: 10px 9px; }.twin-controls { gap: 4px; }.intro { font-size: 12px; } }
</style>

<style scoped>
.mission-panel { border: 1px solid #3b5143; background: #15241c; padding: 18px; border-radius: 12px; margin: 16px 0; }
.active-goal { font-size: 12px; color: #c8ddb9; line-height: 1.8; }.active-goal small { color: #829887; }.active-goal span { display: inline-block; margin-right: 12px; }.mission-objectives summary { font-size: 12px; cursor: pointer; color: #91aa99; margin-bottom: 8px; }
.mission-heading { display: flex; justify-content: space-between; gap: 12px; }.mission-heading h2 { font-size: 18px; margin: 8px 0 16px; }.mission-clock { text-align: right; }.mission-clock strong { font: 24px ui-monospace, monospace; }.mission-clock small { display: block; color: #9aac9c; margin-top: 5px; font-size: 11px; }
.objective-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }.objective-grid article { padding: 10px; background: #1c2e23; border-radius: 6px; min-width: 0; }.objective-grid article.locked { opacity: .45; }.objective-grid article.active { box-shadow: inset 0 0 0 1px #c2de88; }.objective-grid article.complete { color: #8ecbb0; }.objective-grid article div { display: flex; justify-content: space-between; gap: 4px; font-size: 11px; }.objective-grid article span, .objective-grid small { font-size: 10px; color: #9aac9c; }.objective-grid progress { width: 100%; height: 5px; accent-color: #c2de88; margin: 9px 0 5px; }
.mission-extraction { color: #d9d7a0; font-size: 12px; }.mission-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.mission-actions span, .mission-help { color: #9aac9c; font-size: 11px; line-height: 1.7; }.mission-help { margin-bottom: 0; }.mission-result h2 { font-size: 26px; color: #d2ef9b; }.mission-result.failed h2 { color: #e7a88c; }.mission-result p { font-size: 13px; color: #becbb9; }
@media (max-width: 600px) { .mission-panel { padding: 13px; }.objective-grid { grid-template-columns: repeat(2, 1fr); }.mission-heading h2 { font-size: 15px; }.mission-clock strong { font-size: 20px; } }
</style>
