<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { computeMapCamera } from '../../../ui/mapCamera';
import { TerrainType } from '../../../engine/Map/Grid';
import { createScenarioArena } from '../ShooterArena';
import type { ShooterSnapshot } from '../ShooterSession';
import { getRealtimeModules } from '../../../ext/realtimeCatalog';
import { mouseAim } from '../input/AimAdapters';
import PlayerProgress from './PlayerProgress.vue';
import { useTranslation } from 'i18next-vue';

const props = defineProps<{ previous: ShooterSnapshot; current: ShooterSnapshot; alpha: number; disabled: boolean;
    supportTarget: {pose:{x:number;y:number};radius:number;range:number;dangerous:boolean;valid:boolean}|null }>();
const emit = defineEmits<{ aim: [angle: number, moved: boolean]; fire: [held: boolean];target:[pose:{x:number;y:number}] }>();
const {t}=useTranslation();
const supportTags=ref<{id:number;x:number;y:number;text:string;danger:boolean}[]>([]);
let cleared=new Set<string>();
let pointer: number | null = null, mouse: { x: number; y: number } | null = null;
const surface = ref<HTMLDivElement>();
const progressDisplay = ref<HTMLDivElement>();
const progressAnchor = ref({ x: 0, y: 0 });
let app: Application | null = null, world: Container | null = null, actors: Graphics | null = null, overview: Graphics | null = null;
const labels = new Map<string, Text>();
let resize: ResizeObserver | null = null, disposed = false;
const scenario = getRealtimeModules().find(d => d.kind === 'mission' && d.scenario.id === props.current.arena);
const TILE = 1024, grid = createScenarioArena(scenario?.kind === 'mission' ? scenario.scenario : undefined);
const ARENA_WIDTH = grid.width, ARENA_HEIGHT = grid.height;
function terrainColor(x: number, y: number): number {
    const cell = grid.getCell(x, y)!;
    if (!cell.isPassable) return 0x4e6256;
    if (!cleared.has(`${x},${y}`) && cell.layers.includes(TerrainType.PLAIN_FIRE)) return 0x783b28;
    if (!cleared.has(`${x},${y}`) && cell.layers.includes(TerrainType.POISON_GAS)) return 0x465d31;
    if (cell.layers.includes(TerrainType.WATER_SHALLOW)) return 0x234c60;
    if (cell.layers.includes(TerrainType.OPEN_DOOR)) return 0x778057;
    return (x + y) % 2 ? 0x17271f : 0x192b22;
}
function interpolated(index: number) {
    const current = props.current.actors[index]!.pose, previous = props.previous.actors[index]!.pose;
    if (Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y) > 2048) return { ...current };
    return { x: previous.x + (current.x - previous.x) * props.alpha, y: previous.y + (current.y - previous.y) * props.alpha };
}
function draw(): void {
    if (!actors || !app || !world || !overview) return;
    const focus = interpolated(0);
    // Existing camera math, fed fractional cell focus instead of Creature.loc.
    const camera = computeMapCamera(app.screen.width, app.screen.height,
        { scaleX: 16 / TILE, scaleY: 16 / TILE, offsetX: 0, offsetY: 0 },
        ARENA_WIDTH, ARENA_HEIGHT, TILE, { x: focus.x / TILE - .5, y: focus.y / TILE - .5 }, 2, { x: 0, y: 0 }, false);
    world.scale.set(camera.scaleX, camera.scaleY); world.position.set(camera.offsetX, camera.offsetY);
    // Fixed screen size, anchored to the same interpolated body as the canvas.
    progressAnchor.value = {
        x: Math.max(96, Math.min(app.screen.width - 96, focus.x * camera.scaleX + camera.offsetX)),
        y: Math.max((progressDisplay.value?.offsetHeight ?? 0) + 8,
            (focus.y - props.current.actors[0]!.radius - 245) * camera.scaleY + camera.offsetY - 8),
    };
    actors.clear();
    cleared=new Set(props.current.clearedHazards.map(p=>`${p.x},${p.y}`));
    for(const p of props.current.clearedHazards) actors.rect(p.x*TILE,p.y*TILE,TILE,TILE).fill(terrainColor(p.x,p.y));
    const support=props.current.support;
    if(props.supportTarget){const target=props.supportTarget,color=!target.valid?0xee615a:target.dangerous?0xff986e:0x8bddd0;
        actors.circle(target.pose.x,target.pose.y,target.radius).fill({color,alpha:.08}).stroke({color,width:36,alpha:.8});
        actors.moveTo(focus.x,focus.y).lineTo(target.pose.x,target.pose.y).stroke({color,width:24,alpha:.5});
        actors.circle(target.pose.x,target.pose.y,180).stroke({color,width:48});
    }
    const tags=(support?.deployments??[]).map(d=>{
        const color=d.slot===2?0xff715f:d.slot===3?0x92b8f2:0x8bddd0,p=d.pose;
        if(d.phase==='inbound'){
            actors!.circle(p.x,p.y,d.slot===2?d.radius:650).fill({color,alpha:.1}).stroke({color,width:38,alpha:.8});
            actors!.circle(p.x,p.y,(d.slot===2?d.radius:650)*Math.max(.05,1-d.remaining/d.total)).stroke({color,width:28,alpha:.7});
        }else if(d.slot===0){actors!.rect(p.x-250,p.y-250,500,500).fill({color,alpha:.4}).stroke({color,width:40});
            actors!.moveTo(p.x-150,p.y).lineTo(p.x+150,p.y).moveTo(p.x,p.y-150).lineTo(p.x,p.y+150).stroke({color,width:60});
            actors!.circle(p.x,p.y,1200).stroke({color,width:20,alpha:.3});
        }else if(d.slot===1){actors!.circle(p.x,p.y,300).fill({color,alpha:.5}).stroke({color,width:40});
            actors!.moveTo(p.x,p.y).lineTo(p.x+450,p.y).stroke({color,width:80});
        }else if(d.slot===3){actors!.circle(p.x,p.y,450).stroke({color,width:35}).circle(p.x,p.y,d.radius).stroke({color,width:25,alpha:.25});}
        const a=support!.abilities[d.slot]!;
        return{id:d.id,x:p.x*camera.scaleX+camera.offsetX,y:(p.y-850)*camera.scaleY+camera.offsetY,danger:d.slot===2,
            text:d.phase==='inbound'?t('shooter.support.inbound',{name:t(a.labelKey),seconds:Math.ceil(d.remaining/30)}):d.slot===0?t('shooter.support.charges',{count:d.charges}):d.slot===1?t('shooter.support.rounds',{count:d.charges}):t('shooter.support.scanned',{count:support!.revealed.length})};
    }).filter(d=>d.x>=0&&d.x<=app!.screen.width&&d.y>=-120&&d.y<=app!.screen.height);
    const progressRows=props.current.damage.actors[0]!.hp>0?Number(!!props.current.ranged?.reloadRemaining)+Number(!!props.current.mission?.activity):0;
    const progressHeight=Math.max(progressDisplay.value?.offsetHeight??0,progressRows*38+Math.max(0,progressRows-1)*4);
    const placed:typeof tags=[];
    for(const tag of tags){
        tag.x=Math.max(90,Math.min(app.screen.width-90,tag.x));
        if(progressRows && Math.abs(tag.x-progressAnchor.value.x)<180 && tag.y>progressAnchor.value.y-progressHeight-6 && tag.y<progressAnchor.value.y+24)
            tag.y=progressAnchor.value.y-progressHeight-6;
        while(placed.some(other=>Math.abs(other.x-tag.x)<160 && Math.abs(other.y-tag.y)<24))tag.y-=24;
        if(tag.y<24){tag.y=Math.max(progressAnchor.value.y+26,focus.y*camera.scaleY+camera.offsetY+50);while(placed.some(other=>Math.abs(other.x-tag.x)<160 && Math.abs(other.y-tag.y)<24))tag.y+=24;}
        placed.push(tag);
    }
    supportTags.value=placed;
    for (const label of labels.values()) label.visible = false;
    for (const marker of props.current.mission?.markers ?? []) {
        const label = labels.get(marker.id); if (label) { label.visible = marker.status !== 'complete'; label.alpha = marker.status === 'locked' ? .3 : .85; }

        if (marker.status === 'complete') continue;
        const color = marker.kind === 'nest' ? 0xf69b83 : marker.kind === 'extraction' ? 0xebd38e : marker.kind === 'supply' ? 0x8bddd0 : marker.kind === 'sample' ? 0xc1a2ef : marker.kind === 'rescue' ? 0xe7b5dc : 0x9dbce8;
        const alpha = marker.status === 'locked' ? .2 : .7, p = marker.pose;
        actors.circle(p.x, p.y, marker.radius).stroke({ color, width: 22, alpha: alpha * .35 });
        if (marker.kind === 'supply') actors.rect(p.x - 110, p.y - 350, 220, 700).fill({ color, alpha }).rect(p.x - 350, p.y - 110, 700, 220).fill({ color, alpha });
        else if (marker.kind === 'nest') actors.poly([p.x - 550, p.y, p.x - 280, p.y - 480, p.x + 280, p.y - 480, p.x + 550, p.y, p.x + 280, p.y + 480, p.x - 280, p.y + 480]).stroke({ color, width: 70, alpha });
        else actors.poly([p.x, p.y - 420, p.x + 420, p.y, p.x, p.y + 420, p.x - 420, p.y]).fill({ color, alpha: alpha * .3 }).stroke({ color, width: 60, alpha });
    }
    const displayTick = props.previous.tick + (props.current.tick - props.previous.tick) * props.alpha;
    for (const e of props.current.effects) {
        const age = Math.max(0, displayTick - e.tick), color = e.hit ? 0xffefb2 : 0xc9d39a;
        if (e.kind === 'tracer' && age < 3) actors.moveTo(e.from.x, e.from.y).lineTo(e.to.x, e.to.y).stroke({ color, width: 30, alpha: 1 - age / 3 });
        if (e.kind === 'impact' && age < 6) actors.circle(e.to.x, e.to.y, 80 + age * 20).stroke({ color, width: 30, alpha: 1 - age / 6 });
        if (e.kind === 'explosion' && age < 12) actors.circle(e.to.x, e.to.y, e.radius * (.5 + age / 24)).fill({ color: 0xf7a653, alpha: .18 * (1 - age / 12) }).stroke({ color: 0xffc579, width: 50, alpha: 1 - age / 12 });
    }
    for (const warning of props.current.population?.telegraphs ?? []) {
        actors.circle(warning.center.x, warning.center.y, warning.radius).fill({ color: 0xff615c, alpha: .12 })
            .stroke({ color: 0xff9686, width: 40, alpha: .8 });
        actors.circle(warning.center.x, warning.center.y, warning.radius * Math.max(.12, 1 - warning.remaining / 42))
            .stroke({ color: 0xffc0a7, width: 22, alpha: .65 });
    }
    const viewLeft = -camera.offsetX / camera.scaleX, viewTop = -camera.offsetY / camera.scaleY;
    const viewRight = viewLeft + app.screen.width / camera.scaleX, viewBottom = viewTop + app.screen.height / camera.scaleY;
    for (const [index, actor] of props.current.actors.entries()) {
        const p = interpolated(index), health = props.current.damage.actors[index]!, alive = health.hp > 0;
        if (p.x + actor.radius < viewLeft || p.x - actor.radius > viewRight || p.y + actor.radius < viewTop || p.y - actor.radius > viewBottom) continue;
        const color = actor.lastHitTick > 0 && displayTick - actor.lastHitTick < 5 ? 0xffffff : index === 0 ? 0xd2ef9b : actor.kind === 'boss' ? 0xc48df2 : actor.kind === 'elite' ? 0xf5bd64 : 0xeb8e73;
        actors.circle(p.x, p.y, actor.radius).fill({ color, alpha: alive ? .3 : .05 }).stroke({ color, width: 45, alpha: alive ? 1 : .2 });
        if (!alive) continue;
        actors.circle(p.x, p.y, 80).fill(color);
        const angle = actor.pose.facing / 4096 * Math.PI * 2;
        if (index === 0) {
            actors.moveTo(p.x, p.y).lineTo(p.x + Math.cos(angle) * 530, p.y + Math.sin(angle) * 530).stroke({ color, width: 70 });
            const spread = (props.current.ranged?.recoil ?? 0) / 4096 * Math.PI * 2;
            for (const side of [-1, 1]) actors.moveTo(p.x + Math.cos(angle + side * spread) * 750, p.y + Math.sin(angle + side * spread) * 750)
                .lineTo(p.x + Math.cos(angle + side * spread) * 1450, p.y + Math.sin(angle + side * spread) * 1450).stroke({ color, width: 20, alpha: .4 });
        }
        if(support?.revealed.includes(actor.id))actors.circle(p.x,p.y,actor.radius+150).stroke({color:0x92b8f2,width:30,alpha:.85});
        if (actor.kind !== 'swarm' || health.hp < health.maxHp || support?.revealed.includes(actor.id)) {
            const width = Math.max(600, actor.radius * 2), y = p.y - actor.radius - 180;
            actors.rect(p.x - width / 2, y, width, 65).fill(0x14231a);
            actors.rect(p.x - width / 2, y, width * health.hp / health.maxHp, 65).fill(color);
        }
    }
    for (const p of props.current.ranged?.projectiles ?? []) actors.circle(p.pose.x, p.pose.y, 95).fill(0xffc579).stroke({ color: 0xffedbf, width: 30 });
    overview.clear();
    const scale = 2.4, left = app.screen.width - ARENA_WIDTH * scale - 12, top = 12;
    overview.rect(left - 4, top - 4, ARENA_WIDTH * scale + 8, ARENA_HEIGHT * scale + 8).fill({ color: 0x08100c, alpha: .8 });
    for (let y = 0; y < ARENA_HEIGHT; y++) for (let x = 0; x < ARENA_WIDTH; x++)
        overview.rect(left + x * scale, top + y * scale, scale, scale).fill(terrainColor(x, y));
    for (const [i, a] of props.current.actors.entries()) if (i && props.current.damage.actors[i]!.hp
        && (!support || a.kind==='objective' || (a.pose.x-focus.x)**2+(a.pose.y-focus.y)**2<=4096**2 || support.revealed.includes(a.id))) {
        overview.circle(left + a.pose.x / TILE * scale, top + a.pose.y / TILE * scale, a.kind === 'boss' ? 2.8 : a.kind === 'elite' ? 1.8 : .8)
            .fill(a.kind === 'boss' ? 0xc48df2 : a.kind === 'elite' ? 0xf5bd64 : 0xc77c65);
    }
    for (const marker of props.current.mission?.markers ?? []) if (marker.status !== 'complete') {
        const color = marker.kind === 'nest' ? 0xf69b83 : marker.kind === 'extraction' ? 0xebd38e : marker.kind === 'supply' ? 0x8bddd0 : marker.kind === 'sample' ? 0xc1a2ef : 0x9dbce8;
        overview.rect(left + marker.pose.x / TILE * scale - 2, top + marker.pose.y / TILE * scale - 2, 4, 4).fill({ color, alpha: marker.status === 'locked' ? .4 : 1 });
    }
    overview.circle(left + focus.x / TILE * scale, top + focus.y / TILE * scale, 2.8).fill(0xd2ef9b);
    const viewX = -camera.offsetX / camera.scaleX / TILE, viewY = -camera.offsetY / camera.scaleY / TILE;
    overview.rect(left + viewX * scale, top + viewY * scale, app.screen.width / camera.scaleX / TILE * scale,
        app.screen.height / camera.scaleY / TILE * scale).stroke({ color: 0xb9c8b0, width: .6 });
    surface.value!.dataset.cameraX = String(camera.offsetX); surface.value!.dataset.cameraY = String(camera.offsetY);
    surface.value!.dataset.cameraScaleX=String(camera.scaleX);surface.value!.dataset.cameraScaleY=String(camera.scaleY);
}
function updateAim(moved = false): void {
    if (!mouse || props.disabled || !surface.value || !world) return;
    const rect = surface.value.getBoundingClientRect(), focus = interpolated(0);
    const angle = mouseAim(mouse.x - rect.left - world.x - focus.x * world.scale.x,
        mouse.y - rect.top - world.y - focus.y * world.scale.y);
    if (angle !== null) emit('aim', angle, moved);
}
function pointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    mouse = { x: event.clientX, y: event.clientY }; updateAim(true);
}
function pointerDown(event: PointerEvent): void {
    if(props.supportTarget && !props.disabled && surface.value && world){
        const rect=surface.value.getBoundingClientRect();
        emit('target',{x:Math.max(0,Math.round((event.clientX-rect.left-world.x)/world.scale.x)),y:Math.max(0,Math.round((event.clientY-rect.top-world.y)/world.scale.y))});
        event.preventDefault();return;
    }
    if (event.pointerType !== 'mouse' || event.button !== 0 || props.disabled) return;
    pointer = event.pointerId; surface.value!.setPointerCapture(pointer); pointerMove(event); emit('fire', true);
}
function release(): void {
    const old = pointer; pointer = null;
    if (old !== null && surface.value?.hasPointerCapture(old)) surface.value.releasePointerCapture(old);
    emit('fire', false);
}
function render(): void { draw(); updateAim(); app?.render(); }
watch(() => props.disabled, disabled => { if (disabled) { mouse = null; release(); } });
onMounted(async () => {
    const candidate = new Application();
    await candidate.init({ width: 880, height: 400, background: '#101b17', antialias: true, autoStart: false });
    if (disposed) { candidate.destroy(true); return; }
    app = candidate; surface.value!.appendChild(app.canvas);
    world = new Container(); app.stage.addChild(world);
    const terrain = new Graphics();
    for (let y = 0; y < ARENA_HEIGHT; y++) for (let x = 0; x < ARENA_WIDTH; x++) {
        terrain.rect(x * TILE, y * TILE, TILE, TILE).fill(terrainColor(x, y));
        if (!grid.getCell(x, y)!.isPassable) terrain.rect(x * TILE + 80, y * TILE + 80, TILE - 160, 70).fill(0x6c8070);
    }
    world.addChild(terrain); actors = new Graphics(); world.addChild(actors);
    for (const [i, marker] of (props.current.mission?.markers ?? []).entries()) {
        const label = new Text({ text: String(i + 1), style: { fontFamily: 'sans-serif', fontSize: 500, fill: 0xe4ead6 } });
        label.anchor.set(.5); label.position.set(marker.pose.x, marker.pose.y - 850); labels.set(marker.id, label); world.addChild(label);
    }
    overview = new Graphics(); app.stage.addChild(overview);
    resize = new ResizeObserver(() => { if (app && surface.value) { app.renderer.resize(surface.value.clientWidth, surface.value.clientHeight); render(); } });
    resize.observe(surface.value!); render();
});
watch(() => [props.current, props.alpha, props.supportTarget], render);
onBeforeUnmount(() => { disposed = true; resize?.disconnect(); app?.destroy(true, { children: true }); });
</script>

<template><div ref="surface" class="scope-canvas" data-testid="movement-canvas"
  @pointermove="pointerMove" @pointerdown="pointerDown" @pointerup="release" @pointercancel="release" @lostpointercapture="release" @contextmenu.prevent>
  <div ref="progressDisplay" class="progress-anchor" :style="{ left: progressAnchor.x + 'px', top: progressAnchor.y + 'px' }">
    <PlayerProgress v-if="current.damage.actors[0]!.hp > 0" :reload-remaining="current.ranged?.reloadRemaining ?? 0"
      :reload-total="current.ranged?.reloadTotal ?? 0" :activity="current.mission?.activity ?? null" :paused="disabled" />
  </div>
  <div v-for="tag in supportTags" :key="tag.id" class="support-tag" :class="{danger:tag.danger}" :style="{left:tag.x+'px',top:tag.y+'px'}" :data-testid="'support-world-'+tag.id">{{tag.text}}</div>
</div></template>
<style scoped>
.scope-canvas { position: relative; width: 100%; height: 440px; cursor: crosshair; touch-action: none; overflow: hidden; border: 1px solid #34443a; border-radius: 12px; }
.progress-anchor { position: absolute; z-index: 1; transform: translate(-50%, -100%); pointer-events: none; }
.support-tag{position:absolute;z-index:1;transform:translate(-50%,-100%);font-size:11px;color:#b9ecdc;padding:3px 5px;background:#071912df;border:1px solid #517d69;border-radius:4px;pointer-events:none;white-space:nowrap}.support-tag.danger{color:#ffd1bf;border-color:#a35d4a;background:#321811ed}
.scope-canvas :deep(canvas) { display: block; }
@media (max-width: 600px) { .scope-canvas { height: min(36vh, 300px); } }
</style>
