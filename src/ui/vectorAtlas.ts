import type { Graphics } from 'pixi.js';
import type { TileSemantic } from './mapTileSemantics';

/** Small, hand-drawn silhouettes. The atlas consumes display semantics only;
 * no engine state, randomness, font glyphs, sprites, or hidden identity lookups.
 * Coordinates are authored on a 16 × 16 grid and scaled with the cell. */
export interface VectorIcon { group: 'terrain' | 'creature' | 'item' | 'special'; family: string; variant: string }

/** A visible-label whitelist is intentional. IDs such as SECRET_DOOR and
 * WALL_MONSTER_DORMANT must be indistinguishable from the displayed wall. */
export const VECTOR_TERRAIN_BY_HANZI: Readonly<Record<string, string>> = {
  '空':'blank', '墙':'wall', '地':'floor', '门':'door', '开':'openDoor',
  '水':'water', '深':'deepWater', '渊':'chasm', '熔':'lava', '草':'grass',
  '叶':'foliage', '泥':'mud', '上':'stairsUp', '下':'stairsDown', '灰':'ash',
  '牌':'sign', '板':'plate', '陷':'trap', '锁':'lockedDoor', '坛':'altar',
  '网':'web', '血':'blood', '岸':'bank', '岩':'rock', '桥':'bridge', '桩':'post',
  '硫':'brimstone', '火':'fire', '烬':'embers', '毒':'poison', '惑':'confusion',
  '汽':'steam', '沼':'methane', '麻':'paralysis', '爆':'explosion', '洞':'hole',
  '障':'forcefield', '晶':'crystal', '圣':'sacred', '毯':'carpet', '像':'statue',
  '座':'pedestal', '栅':'barricade', '纹':'circuit', '闸':'portcullis', '焰':'torch',
  '笼':'cage', '骨':'bones', '棺':'coffin', '铐':'manacles', '枯':'deadGrass',
  '秽':'waste', '菇':'fungus', '砾':'rubble', '花':'flower', '床':'bedroll',
  '杆':'lever', '迹':'ectoplasm', '电':'electric', '烟':'smoke', '藤':'vines',
  '归':'portal', '坠':'fallingBridge', '孔':'vent', '喷':'flamethrower', '管':'pipe',
  '光':'light', '暗':'darkness', '罐':'canister', '碎':'glass', '苔':'lichen',
  '腐':'rot', '愈':'healing', '禾':'hay', '酸':'acid',
};

/** Species share anatomy, never their defining equipment or silhouette. */
export const VECTOR_CREATURES: Readonly<Record<string, readonly [string, string]>> = {
  rat:['rodent','rat'], kobold:['smallHumanoid','kobold'], jackal:['quadruped','jackal'],
  eel:['serpent','eel'], monkey:['primate','monkey'], bloat:['balloon','gas'],
  pit_bloat:['balloon','pit'], goblin:['smallHumanoid','spear'],
  goblin_conjurer:['smallHumanoid','conjurer'], goblin_mystic:['smallHumanoid','mystic'],
  goblin_totem:['totem','goblin'], pink_jelly:['jelly','pink'], toad:['amphibian','toad'],
  vampire_bat:['winged','bat'], arrow_turret:['turret','arrow'], acid_mound:['jelly','mound'],
  centipede:['arthropod','centipede'], ogre:['giant','ogre'], bog_monster:['tentacles','bog'],
  ogre_totem:['totem','ogre'], spider:['arthropod','spider'], spark_turret:['turret','spark'],
  wisp:['spirit','wisp'], wraith:['spirit','wraith'], zombie:['undead','zombie'],
  troll:['giant','troll'], ogre_shaman:['giant','shaman'], naga:['serpent','naga'],
  salamander:['serpent','salamander'], explosive_bloat:['balloon','explosive'],
  dar_blademaster:['elf','blademaster'], dar_priestess:['elf','priestess'],
  dar_battlemage:['elf','battlemage'], acidic_jelly:['jelly','acidic'],
  centaur:['quadruped','centaur'], underworm:['worm','underworm'],
  sentinel:['construct','sentinel'], dart_turret:['turret','dart'], kraken:['tentacles','kraken'],
  lich:['undead','lich'], phylactery:['relic','phylactery'], pixie:['winged','pixie'],
  phantom:['spirit','phantom'], flame_turret:['turret','flame'], imp:['demon','imp'],
  fury:['winged','fury'], revenant:['undead','revenant'], tentacle_horror:['tentacles','horror'],
  golem:['construct','golem'], dragon:['dragon','dragon'],
  goblin_warlord:['smallHumanoid','warlord'], black_jelly:['jelly','black'],
  vampire:['undead','vampire'], flamedancer:['elemental','dancer'],
  spectral_blade:['weapon','blade'], spectral_sword:['weapon','sword'],
  stone_guardian:['construct','stone'], winged_guardian:['construct','winged'],
  guardian_spirit:['construct','spirit'], warden_of_yendor:['construct','warden'],
  eldritch_totem:['totem','eldritch'], mirrored_totem:['totem','mirrored'],
  unicorn:['quadruped','unicorn'], ifrit:['elemental','ifrit'], phoenix:['winged','phoenix'],
  phoenix_egg:['relic','egg'], mangrove_dryad:['plant','dryad'],
  player_clone:['adventurer','clone'], spectral_image:['adventurer','spectral'],
};
export const VECTOR_MONSTER_IDS = Object.keys(VECTOR_CREATURES);
export const VECTOR_ITEM_FAMILIES = [
  'weapon','armor','potion','scroll','food','gold','wand','staff','ring','charm','key','amulet','gem',
] as const;
export const VECTOR_TERRAIN_HANZI = Object.keys(VECTOR_TERRAIN_BY_HANZI);

const icon = (group: VectorIcon['group'], family: string, variant = ''): VectorIcon => ({ group, family, variant });
/** Pure resolver: useful for coverage and concealment tests. A glyph: identity
 * ALWAYS goes through the displayed-glyph branch before any species/category
 * lookup, including glyph:rat or a hallucinated letter that resembles a species. */
export function resolveVectorIcon(value: TileSemantic): VectorIcon {
  if (!value.hanzi.trim()) return icon('special','blank');
  if (value.id.startsWith('glyph:')) {
    const glyph = value.original.replace(/[\uFE0E\uFE0F]/g,'');
    if (glyph === '@') return icon('special','adventurer');
    if (glyph === '⧳') return icon('special','goodMagic');
    if (glyph === '⧲') return icon('special','badMagic');
    if (glyph === '♀') return icon('item','amulet');
    if (glyph === 'x') return icon('special','track');
    if (glyph === '!') return icon('special','alert');
    if (glyph === '?') return icon('special','uncertain');
    if (glyph === '*') return icon('special','projectile');
    if (glyph === '&') return icon('special','hallucination');
    // These are already exposed visible terrain marks, not reconstructed IDs.
    const visibleTerrain = VECTOR_TERRAIN_BY_HANZI[value.hanzi];
    if (visibleTerrain) return icon('terrain',visibleTerrain);
    if (value.kind === 'item') return icon('item','unknown');
    if (/^[A-Z]$/.test(glyph)) return icon('creature','unknown','large');
    if (/^[a-z]$/.test(glyph)) return icon('creature','unknown','small');
    if (value.kind === 'monster') return icon('creature','unknown','small');
    return icon('special','unknown');
  }
  if (value.kind === 'player') return icon('special','adventurer');
  if (value.kind === 'monster') {
    const spec = VECTOR_CREATURES[value.id.toLowerCase()];
    return spec ? icon('creature',spec[0],spec[1]) : icon('creature','unknown','large');
  }
  if (value.kind === 'item') return icon('item',VECTOR_ITEM_FAMILIES[Number(value.id)] ?? 'unknown');
  if (value.kind === 'marker') {
    return icon('special', value.hanzi === '吉' ? 'goodMagic' : value.hanzi === '凶' ? 'badMagic' : value.hanzi === '坠' ? 'amuletMagic' : 'track');
  }
  if (value.kind === 'effect') {
    const effect: Record<string,string> = { '弹':'projectile','警':'alert','疑':'uncertain','幻':'hallucination','伤':'impact','疗':'healing','吉':'goodMagic','凶':'badMagic' };
    return icon('special',effect[value.hanzi] ?? VECTOR_TERRAIN_BY_HANZI[value.hanzi] ?? 'unknown');
  }
  return icon('terrain',VECTOR_TERRAIN_BY_HANZI[value.hanzi] ?? 'unknown');
}

/** The painter uses filled masses for actors/items, quiet marks for floors, and
 * outlined architectural forms for terrain. All lit ink is the supplied color;
 * the only second ink is a dark, non-luminous eye/cutout. */
class Pen {
  constructor(readonly g: Graphics, readonly color: number, readonly ox: number, readonly oy: number, readonly s: number) {}
  p(points: number[], alpha = 1, dark = false): void {
    this.g.poly(points.map((v,i) => (i % 2 ? this.oy : this.ox) + v*this.s)).fill({color:dark ? 0x000000 : this.color,alpha});
  }
  l(points: number[], width = 1.25, alpha = 1, dark = false): void {
    this.g.moveTo(this.ox+points[0]!*this.s,this.oy+points[1]!*this.s);
    for(let i=2;i<points.length;i+=2) this.g.lineTo(this.ox+points[i]!*this.s,this.oy+points[i+1]!*this.s);
    this.g.stroke({color:dark ? 0x000000 : this.color,width:width*this.s,alpha,cap:'round',join:'round'});
  }
  r(x:number,y:number,w:number,h:number,alpha=1,dark=false): void {
    this.g.rect(this.ox+x*this.s,this.oy+y*this.s,w*this.s,h*this.s).fill({color:dark?0x000000:this.color,alpha});
  }
  c(x:number,y:number,r:number,alpha=1,dark=false): void {
    this.g.circle(this.ox+x*this.s,this.oy+y*this.s,r*this.s).fill({color:dark?0x000000:this.color,alpha});
  }
  e(x:number,y:number,rx:number,ry:number,alpha=1,dark=false): void {
    this.g.ellipse(this.ox+x*this.s,this.oy+y*this.s,rx*this.s,ry*this.s).fill({color:dark?0x000000:this.color,alpha});
  }
  ring(x:number,y:number,r:number,width=1.2,alpha=1): void {
    this.g.circle(this.ox+x*this.s,this.oy+y*this.s,r*this.s).stroke({color:this.color,width:width*this.s,alpha});
  }
  oval(x:number,y:number,rx:number,ry:number,width=1.2,alpha=1): void {
    this.g.ellipse(this.ox+x*this.s,this.oy+y*this.s,rx*this.s,ry*this.s).stroke({color:this.color,width:width*this.s,alpha});
  }
  box(x:number,y:number,w:number,h:number,width=1.2,alpha=1): void {
    this.l([x,y,x+w,y,x+w,y+h,x,y+h,x,y],width,alpha);
  }
  eyes(x=6.3,y=5.4,gap=3.1): void { this.r(x,y,1.15,1,0.95,true); this.r(x+gap,y,1.15,1,0.95,true); }
}

function star(p:Pen,x:number,y:number,r=3,alpha=1): void {
  p.p([x,y-r,x+.85,y-.8,x+r,y,x+.85,y+.8,x,y+r,x-.85,y+.8,x-r,y,x-.85,y-.8],alpha);
}
function flame(p:Pen,x=8,y=8,s=1,alpha=1): void {
  p.p([x-4*s,y+5*s,x-5*s,y+1*s,x-2*s,y-2*s,x-1*s,y+1*s,x+1*s,y-6*s,x+3*s,y-2*s,x+3*s,y+1*s,x+5*s,y-1*s,x+4*s,y+4*s,x+1*s,y+6*s],alpha);
  p.p([x-1.5*s,y+4*s,x,y,x+1.5*s,y+3*s,x+.4*s,y+5*s],.75,true);
}
function sword(p:Pen,x=8,y=8,scale=1,alpha=1): void {
  p.p([x-1.1*scale,y+2*scale,x-1*scale,y-4*scale,x,y-7*scale,x+1.2*scale,y-4*scale,x+1*scale,y+2*scale],alpha);
  p.l([x-3*scale,y+2*scale,x+3*scale,y+2*scale],1.25,alpha);
  p.l([x,y+2*scale,x,y+5*scale],1.6,alpha); p.c(x,y+5.5*scale,.85*scale,alpha);
}
function shield(p:Pen,x:number,y:number,s=1,alpha=1): void {
  p.p([x-3*s,y-3*s,x+3*s,y-3*s,x+2.6*s,y+1*s,x,y+3.5*s,x-2.6*s,y+1*s],alpha);
  p.l([x,y-1.8*s,x,y+1.5*s],.9,.8,true);
}
function wings(p:Pen,variant='bat',alpha=1): void {
  if (variant==='feather') {
    p.p([7,7,1,2,1,6,3,10,5,11,4,7,7,10],alpha);
    p.p([9,7,15,2,15,6,13,10,11,11,12,7,9,10],alpha);
  } else {
    p.p([7,7,3,3,1,2,1,10,3.5,8,5,11,7,10],alpha);
    p.p([9,7,13,3,15,2,15,10,12.5,8,11,11,9,10],alpha);
  }
}
function person(p:Pen,robe=false,alpha=1): void {
  p.c(8,4.3,2.25,alpha);
  if(robe) p.p([5.7,7,10.3,7,12.5,14,3.5,14],alpha);
  else { p.p([5.5,7,10.5,7,11,10.5,9.7,11.5,9.6,14.5,8.2,14.5,8,11.5,7,11.5,6.3,14.5,4.8,14.5,5.3,10.7],alpha); }
  p.eyes(6.65,4.1,1.8);
}
function skull(p:Pen,x=8,y=4.7,s=1):void {
  p.e(x,y,2.8*s,2.6*s);p.r(x-1.7*s,y+1.6*s,3.4*s,1.7*s);
  p.c(x-1*s,y,.75*s,.95,true);p.c(x+1*s,y,.75*s,.95,true);p.r(x-.35*s,y+1*s,.7*s,1*s,.8,true);
}
function gasCloud(p:Pen,kind:string):void {
  p.e(5,9,3.8,2.6,.21);p.e(10.2,7,4.2,3.3,.25);p.e(8,11,4.8,2,.18);
  if(kind==='poison') { skull(p,8,7.1,.73);p.l([4.5,12,11.5,12],.8,.65); }
  else if(kind==='confusion') {p.l([4,9,4,5,7,3,11,4,12,7,10,10,7,10,6,7,8,6,9,7],1.1,.9);}
  else if(kind==='paralysis') {p.l([5,5,5,10],1.8);p.l([8,3,8,11],1.8);p.l([11,5,11,10],1.8);p.l([4,13,12,13],.8,.6);}
  else if(kind==='methane') {p.ring(5,8,1.6,.9,.7);p.ring(10.5,5,2,1,.8);p.c(10,11,1,.6);}
  else if(kind==='rot') {p.l([3,6,5,7,4,10,7,11],1.2,.8);p.c(10,6,1.1);p.c(11,10,1.5,.7);p.c(6,4,.7,.65);}
  else if(kind==='healing') {p.r(7,4,2,8,.85);p.r(4,7,8,2,.85);}
  else {p.l([3,11,6,10,9,11,13,10],1,.65);p.l([3,7,6,6,9,7,13,6],1,.7);if(kind==='steam')p.l([6,5,5,3,6,1],.8,.55);}
}

function paintTerrain(p:Pen,f:string):void {
  switch(f) {
    case 'blank': return;
    case 'wall':
      p.r(.6,.6,14.8,14.8,.20); p.l([.7,15.3,.7,.7,15.3,.7],1.25,.7);
      p.l([1,7.8,15,7.8],.85,.48); p.l([8,.9,8,7.7],.85,.48);p.l([4.1,8,4.1,15],.85,.48);p.l([12,8,12,15],.85,.48); return;
    case 'floor':p.r(7.2,7.2,1.6,1.6,.46);return;
    case 'ash':p.r(4,9,2,1,.33);p.r(9,5,1.5,1.5,.4);p.r(10,11,2,1,.35);return;
    case 'door': case 'lockedDoor': case 'openDoor':
      p.l([2.5,14.6,2.5,2,13.5,2,13.5,14.6],1.7,.9);
      if(f==='openDoor') {p.p([4,3.5,7,5,7,14,4,13],.6);p.l([10,14,13.5,14],.8,.4);}
      else {p.r(4.5,3.8,7,10.5,.46);p.l([6.5,4,6.5,14],.7,.55);p.c(10,9,.75);if(f==='lockedDoor'){p.r(6.3,8,3.4,3.5);p.ring(8,7.5,1.3,1);p.c(8,9.4,.55,.9,true);}}return;
    case 'water':case 'deepWater':
      for(const yy of f==='deepWater'?[3.5,8,12.5]:[5,11])p.l([1,yy,4,yy-1,8,yy+1,12,yy-1,15,yy],1.1,f==='deepWater'?.78:.60);
      if(f==='deepWater')p.r(2,14,12,.5,.2);return;
    case 'chasm':case 'hole':
      if(f==='hole') {p.oval(8,8,6.3,4.3,1.1,.7);p.l([3,9,5,12,11,12,13,9],.8,.36);}
      else {p.l([.5,3,4,2,5,4,3,6,.5,7],1.1,.6);p.l([15.5,8,12,9,11,12,13,14,15.5,13],1.1,.6);p.l([4,4,6,4,5,7],.7,.25);}return;
    case 'bank':p.l([1,3,5,4,6,8,10,9,11,13,15,14],1.35,.68);p.l([1,6,3,7,4,10,8,12],.7,.28);return;
    case 'lava':p.p([1,4,5,3,9,5,14,3,15,12,11,14,7,12,2,14],.28);p.l([1,7,4,5,7,7,10,6,14,8],1.2,.85);p.l([3,12,6,10,10,12,14,11],1.3,.9);p.c(10,3,1,.7);return;
    case 'grass':case 'deadGrass':case 'hay':
      p.l([7,13,6,7,4,5],1,f==='deadGrass'?.52:.72);p.l([7,13,9,5,11,3],1,f==='deadGrass'?.55:.78);p.l([8,13,12,8],1,.6);
      if(f==='hay'){p.l([3,12,12,4],1,.7);p.l([4,14,13,7],.9,.6);p.l([3,9,13,12],1,.75);}return;
    case 'foliage':p.l([8,14,8,5],1.1,.65);p.p([8,9,3,8,2,4,6,5],.65);p.p([8,7,10,2,14,2,12,7],.7);p.p([8,12,11,8,14,9,11,12],.6);return;
    case 'vines':p.l([2,15,5,11,5,6,9,3,13,1],1.5,.8);p.p([5,9,1,7,2,4,5,6],.7);p.p([7,5,9,7,12,5,12,3],.75);p.p([4,12,8,11,10,13,7,14],.6);return;
    case 'lichen':p.c(4,6,1.5,.55);p.c(7,5,2,.55);p.c(10,7,1.8,.55);p.c(5,9,2,.5);p.c(10,11,1.5,.5);p.r(6,7,3,2,.45);return;
    case 'mud':case 'waste':case 'blood':case 'ectoplasm':case 'acid':
      p.e(8,10,5.7,2.3,f==='blood'?.66:.43);p.e(5.5,8,2.6,1.6,.44);p.c(12,6,1,.58);p.c(2.8,12.5,.7,.5);
      if(f==='acid'){p.ring(8,8,1.4,.8,.9);p.c(6,4,.9,.75);p.c(10,3,.6,.6);}
      if(f==='ectoplasm'){p.l([5,10,7,7,9,8,10,5],.9,.85);p.c(9,3,.6,.6);}return;
    case 'stairsUp':case 'stairsDown':
      for(let i=0;i<4;i++){const yy=f==='stairsUp'?12.8-i*3:3.2+i*3;p.r(3+i*2,yy,10-i*2,1.4,.95);}
      p.l(f==='stairsUp'?[1.5,9,1.5,2,3.5,4]:[1.5,7,1.5,14,3.5,12],1,.85);return;
    case 'sign':p.r(7.3,10,1.5,5,.9);p.p([2,3,11,3,14,6,11,9,2,9],.73);p.l([5,6,9,6],.9,.8,true);return;
    case 'plate':p.p([2,5,12,3,14,11,4,13],.3);p.l([2,5,12,3,14,11,4,13,2,5],1.1,.85);p.c(5,7,.7,.8);p.c(11,9,.7,.8);return;
    case 'trap':p.oval(8,10,5.9,3,1.25,.88);for(const xx of [4,8,12])p.p([xx-1.2,10,xx,6.1,xx+1.2,10],.86);p.l([3,4,5,3,11,3,13,4],.85,.6);return;
    case 'altar':p.r(2,5,12,2.7,.95);p.r(4.2,8,2,5,.74);p.r(9.8,8,2,5,.74);p.r(2,13,12,1.3,.65);p.c(8,3,1.1,.8);return;
    case 'web':p.l([1,1,15,15],.8,.58);p.l([1,15,15,1],.8,.58);p.l([8,1,8,15],.8,.58);p.l([1,8,15,8],.8,.58);p.l([8,3,13,8,8,13,3,8,8,3],.8,.64);return;
    case 'rock':p.p([1,11,3,5,8,2,14,5,15,12,9,14],.45);p.l([3,5,8,8,14,5],.85,.6);p.l([8,8,9,14],.85,.65);return;
    case 'bridge':case 'fallingBridge':
      p.l([2,1,2,15],1.1,.8);p.l([14,1,14,15],1.1,.8);
      for(let yy=3;yy<15;yy+=3){if(f==='fallingBridge'&&yy===9){p.l([3,9,7,11],1.5,.8);p.l([10,12,14,10],1.5,.8);}else p.l([2,yy,14,yy],1.4,.7);}return;
    case 'post':p.r(5.8,4,4.4,9,.75);p.oval(8,4,2.2,1,1,.95);p.l([2,8,13.5,8],1.2,.65);p.l([2,11,13.5,11],1.2,.65);return;
    case 'brimstone':p.p([2,10,5,4,8,6,11,2,14,8,12,13,5,14],.43);p.l([4,11,6,8,9,10,12,7],1,.7);p.c(5,4,.7,.9);return;
    case 'fire':flame(p,8,8,.92,.9);return;
    case 'torch':p.l([8,9,8,14],2,.85);p.l([5,10,11,10],1.2,.75);flame(p,8,5,.58,.94);return;
    case 'embers':p.p([3,12,4,8,6,11,5,13],.7);p.p([9,13,11,8,13,11,12,14],.8);p.c(8,5,.8,.6);p.c(12,3,.6,.5);return;
    case 'poison':case 'confusion':case 'steam':case 'methane':case 'paralysis':case 'smoke':case 'rot':case 'healing':gasCloud(p,f);return;
    case 'explosion':p.p([8,1,10,5,14,3,12,7,15,9,11,10,12,15,8,12,4,15,5,10,1,9,4,6,2,2,6,5],.87);p.ring(8,8,2,1,.75);return;
    case 'forcefield':p.l([2,3,2,13,8,15,14,13,14,3,8,1,2,3],1.2,.8);p.l([5,4,5,12],.8,.4);p.l([8,3,8,13],.8,.5);p.l([11,4,11,12],.8,.4);return;
    case 'crystal':case 'electric':
      p.p([4,11,4,6,8,1,12,6,12,11,8,15],.35);p.l([4,6,8,1,12,6,12,11,8,15,4,11,4,6],1,.85);p.l([8,1,8,15],.8,.5);
      if(f==='electric')p.p([10,2,5,8,8,8,6,14,12,7,9,7],.96);return;
    case 'sacred':p.ring(8,8,5,1,.7);star(p,8,8,4,.9);p.c(2,2,.7,.5);p.c(14,14,.7,.5);return;
    case 'carpet':p.r(3,2,10,12,.17);p.box(3,2,10,12,.85,.55);p.l([5,4,11,4,11,12,5,12,5,4],.7,.35);for(const xx of [4,7,10,12]){p.l([xx,1,xx,2],.7,.5);p.l([xx,14,xx,15],.7,.5);}return;
    case 'statue':p.c(8,4,2.2,.72);p.p([5,7,11,7,12,12,4,12],.63);p.r(2,13,12,2,.8);p.l([8,7,8,11],.9,.55,true);return;
    case 'pedestal':p.e(8,4,5,1.5,.8);p.r(5,5,6,7,.5);p.r(3,12,10,2,.85);p.l([6,6,6,11],.8,.6);return;
    case 'barricade':p.l([3,2,4,14],2,.8);p.l([8,1,8,14],2,.8);p.l([13,2,12,14],2,.8);p.l([1,6,15,6],1.6,.75);p.l([1,11,15,11],1.6,.75);return;
    case 'circuit':p.l([2,3,7,3,7,7,13,7,13,13,9,13,9,10,3,10,3,14],1,.8);p.c(2,3,1,.8);p.c(3,14,1,.8);p.c(12,2,1,.55);return;
    case 'portcullis':p.r(1,2,14,2,.9);for(const xx of [3,8,13]){p.l([xx,4,xx,13],1.5,.9);p.p([xx-1,12,xx,15,xx+1,12],.9);}p.l([2,8,14,8],1.2,.7);return;
    case 'cage':p.l([2,14,2,5,5,2,11,2,14,5,14,14,2,14],1.1,.83);for(const xx of [5,8,11])p.l([xx,3,xx,14],1,.75);p.l([2,7,14,7],.9,.75);return;
    case 'bones':p.l([4,5,12,12],2,.75);p.l([4,12,11,5],2,.75);for(const [xx,yy] of [[3,4],[5,4],[11,12],[13,12],[3,12],[11,4]])p.c(xx!,yy!,1.3,.8);return;
    case 'coffin':p.p([5,1,11,1,13,5,11,14,5,14,3,5],.42);p.l([5,1,11,1,13,5,11,14,5,14,3,5,5,1],1.15,.9);p.l([8,4,8,10],1,.85);p.l([6,6,10,6],1,.85);return;
    case 'manacles':p.ring(4.5,10,2.5,1.3,.8);p.ring(11.5,5,2.5,1.3,.8);p.l([6.5,8,9.5,7],1.3,.8);p.l([1,14,2.8,11.5],1,.65);return;
    case 'fungus':p.p([2,8,3,5,6,3,10,3,13,5,14,8],.76);p.r(7,8,2,6,.9);p.c(6,5.5,.8,.85,true);p.c(10,6,.75,.85,true);p.l([4,14,12,14],.8,.4);return;
    case 'rubble':p.p([2,11,3,7,6,6,8,11],.58);p.p([9,13,10,9,14,10,14,13],.63);p.p([8,5,10,2,12,5],.52);return;
    case 'glass':p.p([2,11,5,4,7,10],.68);p.p([9,14,10,7,14,12],.6);p.l([10,2,12,5,14,3],.9,.85);return;
    case 'flower':p.l([8,8,8,14],1.15,.85);p.p([8,12,3,8,6,8],.7);p.p([8,10,13,7,11,11],.65);for(const [xx,yy] of [[6,4],[9,3],[11,5],[9,7],[6,7]])p.c(xx!,yy!,1.8,.7);p.c(8.2,5,1.1,.9);return;
    case 'bedroll':p.r(3,5,10,9,.37);p.box(3,5,10,9,1,.8);p.e(8,4,5,2,.73);p.oval(8,4,2.4,1,.8,.55);p.l([4,12,12,12],.7,.6);return;
    case 'lever':p.p([3,10,11,10,14,14,1,14],.63);p.l([8,11,11,3],2,.9);p.c(11,3,1.7,.95);return;
    case 'portal':p.oval(8,8,5,6,1.6,.85);p.oval(8,8,2.7,4,.8,.55);p.c(8,8,1,.75);p.l([2,14,14,14],1,.6);return;
    case 'vent':p.oval(8,9,6,4,1.2,.8);for(const xx of [4,7,10,13])p.l([xx,7,xx-1,11],1,.7);p.l([6,4,5,2],.8,.45);p.l([10,4,11,2],.8,.45);return;
    case 'flamethrower':p.r(1,6,6,5,.65);p.box(4,5,4,7,1,.85);p.p([8,7,11,6,10,4,15,7,13,9,15,12,10,10,8,11],.8);return;
    case 'pipe':p.l([1,10,7,10,7,4,15,4],4,.32);p.l([1,8,5,8,5,2,15,2],.9,.75);p.l([1,12,9,12,9,6,15,6],.9,.75);p.l([12,1,12,7],1.6,.85);p.l([2,7,2,13],1.6,.85);return;
    case 'light':p.ring(8,8,3,1,.65);for(const [xx,yy,xx2,yy2] of [[8,1,8,3],[8,13,8,15],[1,8,3,8],[13,8,15,8],[3,3,4,4],[12,12,13,13]])p.l([xx!,yy!,xx2!,yy2!],1,.65);return;
    case 'darkness':p.l([11,2,6,2,3,6,3,10,6,14,11,14],1.4,.5);p.l([8,4,6,7,6,10,8,12],.9,.3);return;
    case 'canister':p.r(6,1,4,2,.85);p.p([4,4,6,3,10,3,12,4,12,13,10,15,6,15,4,13],.45);p.box(4,4,8,9,1,.85);p.l([5,9,11,9],1,.8);p.c(8,6,1,.8);return;
    default:p.l([3,10,5,6,9,5,12,8,11,11,7,12,3,10],1,.7);p.c(7,8,.9,.6);return;
  }
}

function paintCreature(p:Pen,f:string,v:string):void {
  switch(f) {
    case 'rodent':
      p.e(7,10,4.2,2.7);p.p([10,8,14,10,11,12,9,11]);p.c(10,7.3,1.7);p.c(10,7.3,.7,.7,true);
      p.l([3.5,10,1.3,9,1,6,3,5],1.1);p.l([5,12,4,13,6,13],1.15);p.c(12,9.4,.55,.95,true);return;
    case 'quadruped':
      p.p([3,8,10,7,12,9,10,12,4,12]);p.l([4,11,3,15],1.5);p.l([7,11,7,14],1.5);p.l([10,11,12,14],1.5);
      p.l([3,9,1,7,1,5],1.5);
      if(v==='jackal'){p.p([9,8,10,2,12,5,14,4,15,7,12,9]);p.p([10,4,10,1,12,4]);p.c(12.4,6,.65,.95,true);}
      else if(v==='unicorn'){p.p([9,8,10,3,13,4,15,6,13,8]);p.l([12,4,14,1],1.3);p.l([9,4,8,8],1.5,.6);p.c(12.5,5.5,.6,.95,true);}
      else {p.r(9,4.5,3,4.5);p.c(10.5,2.6,1.7);p.l([11,6,14,5],1.3);p.l([13.5,2,15,5,13.5,9],1.05);p.l([13.5,2,13.5,9],.75);p.l([12,5,15.5,5],.8);}return;
    case 'serpent':
      if(v==='eel') {p.l([2,12,5,13,8,11,7,8,4,7,5,4,10,3,13,5],2.8);p.p([11,2,15,4,13,7,10,5]);p.c(12.4,3.8,.6,.95,true);p.l([7,12,9,13,12,11],.8,.6);}
      else {p.l([4,14,10,14,13,12,12,10,8,10,6,8],2.5);p.p([5,9,5,4,7,2,10,3,10,7,8,10]);p.eyes(6,4.5,2.1);
        if(v==='naga'){p.l([5,7,2,9,2,5],1.3);p.l([10,7,12,6,13,3],1.3);p.p([12,3,13,1,14,3]);}
        else {p.l([10,7,14,6,14,2,11,1],1.25);p.p([4,6,1,5,3,2,4,4],.8);p.p([9,12,7,9,6,12],.6);}}return;
    case 'primate':
      p.c(5,5,1.6);p.c(10,5,1.6);p.e(7.5,5.5,3,2.7);p.e(7.5,10,2.5,3);p.eyes(5.8,5.1,2.1);
      p.l([5.4,9,3,11,3,14],1.6);p.l([9.2,8.7,11,10],1.6);p.l([9,12,12,14,14,12,14,7,12,6,11,7],1.2);p.l([6,12,6,15,8,15],1.4);return;
    case 'smallHumanoid': {
      const caster=v==='conjurer'||v==='mystic';
      p.p([4,5,2,3,5,3,7,2,10,3,13,3,11,6,9,7,5,7]);p.eyes(5.2,4.5,3.3);
      if(caster)p.p([5,8,10,8,12,14,3,14]);
      else{p.r(5,8,5,3);p.l([6,10,4,14],1.8);p.l([9,10,10,14],1.8);}
      if(v==='spear'){p.l([12.5,4,12.5,14],1.3);p.p([11,4,12.5,.6,14,4]);p.l([9,8,12,9],1.4);}
      else if(v==='kobold'){p.p([9,3,14,5,10,7]);p.c(11,4.2,.55,.9,true);p.l([5,11,2,12,1,9],1.5);p.l([11,9,14,11],1.3);p.p([12,9,14,7,14,11]);}
      else if(v==='conjurer'){p.l([12.5,6,12.5,14],1.2);p.ring(12.5,4,1.7,1);star(p,2.5,10,2,.8);}
      else if(v==='mystic'){shield(p,12.3,10.3,.68);p.l([2,8,2,4,3,2],1.1);p.c(2,3,1.2);}
      else {p.p([4,3,4,0.8,6,2,8,.5,10,2,12,.8,12,3]);p.l([12.8,6,12.8,14],1.4);p.p([12.8,6,10.7,5.5,10.7,9,12.8,8]);shield(p,2.7,10,.64);}
      return;
    }
    case 'balloon':
      p.e(8,6.3,5,5.1,.96);p.l([5,10,4,14],1);p.l([8,11,8,15],1);p.l([11,10,12,13],1);p.c(5.8,4.3,.9,.9,true);
      if(v==='gas'){p.c(9.7,6,1.5,.8,true);p.c(7,8,1,.8,true);}
      if(v==='pit'){p.oval(8,7.6,2.6,1.7,1.1,.95);p.l([5.6,7.8,10.4,7.8],1.3,.9,true);p.l([5,13,11,13],.8,.6);}
      if(v==='explosive'){p.l([8,2,7,5,10,6,7,9],1.15,.9,true);p.l([11,2,13,1,14,2],1);star(p,14,3,1.5);}return;
    case 'totem':
      if(v==='mirrored'){p.p([8,1,12,4,12,13,8,15,4,13,4,4],.38);p.l([8,1,12,4,12,13,8,15,4,13,4,4,8,1],1.15);p.l([8,1,8,15],1);p.l([5,6,7,4],1,.7);return;}
      p.r(6,3,4,11,.85);p.r(3,13,10,2,.85);
      if(v==='goblin'){p.p([2,3,5,4,8,2,11,4,14,3,12,8,4,8]);p.eyes(5,5.3,4.8);p.l([4,10,12,10],1.5);}
      else if(v==='ogre'){p.r(3,2,10,6);p.eyes(4.4,3.7,5.1);p.p([3,6,5,9,5,6],.9);p.p([13,6,11,9,11,6],.9);p.l([4,11,12,11],2);}
      else {p.oval(8,5,5.4,3,1.2);p.c(8,5,1.8);p.c(8,5,.7,.9,true);p.l([3,10,1,12,4,14],1);p.l([13,10,15,12,12,14],1);star(p,8,11,1.7,.7);}return;
    case 'jelly':
      p.p([1.5,12,2,8,4,5,7,4,10,5,13,7,14.5,12,12,14,9,13,6,14,3,13],v==='black'?.65:.87);
      if(v==='pink'){p.oval(7.5,9.5,3,2,1.2);p.c(5,6.5,.8,.85);}
      else if(v==='acidic'){p.p([9,3,8,0.8,6,4,7,5],.85);p.ring(7.5,9,1.6,.9);p.c(11,10,.8,.95,true);}
      else if(v==='mound'){p.e(8,12,6,1.8,.85);p.c(4,5,1,.8);p.c(10,3,1.3,.8);p.c(11,8,1,.8,true);}
      else {p.p([3,8,2,3,6,6,9,2,11,7,14,5,13,10],.85);p.c(6,9,1,.9,true);p.c(10,9,1,.9,true);}return;
    case 'amphibian':
      p.e(8,9,4.5,3.7);p.e(3,11,2.4,2.2);p.e(13,11,2.4,2.2);p.c(5.1,5.3,2.2);p.c(10.9,5.3,2.2);p.eyes(4.5,4.8,5.7);
      p.l([5,9,8,10,11,9],.9,.9,true);p.l([2,13,1,14,5,14],1.2);p.l([14,13,15,14,11,14],1.2);return;
    case 'arthropod':
      if(v==='spider'){for(const [a,b,c,d] of [[5,6,1,3],[5,8,1,7],[5,10,1,11],[5,11,2,15],[11,6,15,3],[11,8,15,7],[11,10,15,11],[11,11,14,15]])p.l([a!,b!,c!,d!],1.15);p.e(8,9,3.3,4);p.c(8,4.6,2.2);p.eyes(6.6,4,1.8);}
      else {for(let j=0;j<5;j++){const yy=3+j*2.3,xx=7+Math.sin(j)*1.2;p.c(xx,yy,2.1);p.l([xx-1,yy,xx-4,yy-1.5],1);p.l([xx+1,yy,xx+4,yy+1.5],1);}p.l([6,2,4,1],1);p.l([8,2,10,1],1);}return;
    case 'giant':
      p.p([4,5,6,3,10,3,12,6,14,7,14,11,11,11,10,14,7.7,14,7.7,11.5,6,11.5,5,14,2.8,14,4,10,2,10,2,7]);p.c(8,4,2.4);p.eyes(6.3,3.8,2.2);
      if(v==='ogre'){p.l([12,9,13,4],2);p.p([11,1,14,1,15,6,12,6]);p.l([5,7,4,11],1,.7,true);}
      else if(v==='troll'){p.p([4,5,2,2,5,3]);p.p([11,5,14,2,11,3]);p.p([4,10,1,12,1,14,4,13]);p.p([12,10,15,12,15,14,12,13]);p.c(5,7,.7,.8,true);p.c(10,9,.8,.8,true);}
      else {p.p([5,8,10,8,12,15,3,15]);p.l([13.5,5,13.5,15],1.4);p.p([11,3,13.5,1,15,3,13.5,5]);p.l([5,5,7,7,9,5],1.2,.85,true);}return;
    case 'tentacles': {
      const high=v!=='bog';
      if(high) p.p(v==='kraken'?[4,8,4,4,6,1,10,1,12,4,12,8]:[3,9,3,5,1,3,6,4,7,1,10,4,14,2,12,6,13,9]);
      else p.e(8,10,5,3);
      for(const [xx,dy] of [[4,0],[6,2],[10,2],[12,0]]){const out=xx!<8?-2:2;p.l([xx!,high?7:9,xx!+out,11+dy!,xx!+out*1.5,13+dy!,xx!+out*.5,14],1.5);}
      if(v==='bog'){p.l([3,9,1,7,2,5],1.4);p.l([13,9,15,6,13,5],1.4);p.eyes(5.5,9,3.8);}
      else {p.eyes(5.7,5.3,3.5);if(v==='horror'){p.l([3,7,1,9,1,12],1.4);p.l([13,7,15,9,15,12],1.4);p.c(8,8,1,.8,true);}}return;
    }
    case 'turret':
      p.p([3,10,13,10,15,14,1,14],.85);p.r(5,6,6,5,.9);p.l([2,14,14,14],1.2);
      if(v==='arrow'){p.l([2,5,4,3,12,3,14,5],1.6);p.l([2,5,14,5],.85);p.l([8,8,8,1],1.3);p.p([6.5,2,8,.3,9.5,2]);}
      else if(v==='dart'){p.box(3,3,10,5,1.2);for(const xx of [5,8,11])p.c(xx,5.5,.8);p.l([8,3,8,1],1);}
      else if(v==='spark'){p.p([9,1,4,6,8,6,6,10,12,4,8,4]);p.c(2,4,.7);p.c(14,2,.7);}
      else {p.r(4,5,8,3,.75);flame(p,8,3.8,.48);p.c(3,2,.65,.8);}return;
    case 'spirit':
      if(v==='wisp'){flame(p,8,7,.72,.82);p.oval(8,13,4.6,1,.8,.5);p.c(13,3,.75,.7);return;}
      if(v==='phantom'){p.l([3,13,4,6,6,2,10,2,12,6,13,13,10,11,8,14,6,11,3,13],1.3,.7);p.c(6,6,.85,.85);p.c(10,6,.85,.85);p.l([1,8,3,8],.8,.45);p.l([13,10,15,10],.8,.45);return;}
      p.p([3,14,4,6,6,2,10,2,12,6,13,14,10,12,8,15,6,12],.86);p.eyes(5.9,5.3,3.1);p.l([4,8,1,11,2,13],1.4);p.l([12,8,15,11,14,13],1.4);return;
    case 'undead':
      if(v==='zombie'){p.p([4,7,9,6,11,10,9,11,9,15,7,15,7,12,5,15,3,14,5,10]);p.p([4,2,9,1,11,5,8,7,4,6]);p.eyes(5,3.5,3);p.l([4,8,1,7,1,5],1.8);p.l([10,7,14,7,14,5],1.8);p.l([6,9,8,10],1,.7,true);}
      else if(v==='vampire'){p.p([7,7,2,4,3,10,1,14,6,13,8,15,10,13,15,14,13,10,14,4,9,7],.87);p.c(8,4.3,2.4);p.eyes(6.4,4.2,2.1);p.p([6.5,6,7,7.4,7.6,6],.9);p.p([8.5,6,9,7.4,9.6,6],.9);p.l([8,8,8,12],1,.8,true);}
      else {p.p([5,7,11,7,13,15,9,13,7,15,3,14],.88);skull(p,8,4.5,.92);
        if(v==='lich'){p.p([5,2,5,0,7,1,8,0,9,1,11,0,11,2]);p.l([13,4,13,15],1.3);p.c(13,3,1.5);p.c(3,10,1.3,.8);}
        else {p.l([4,7,1,10,3,12],1.6);p.l([12,7,15,10,13,12],1.6);p.l([6,8,9,12],1,.8,true);}}return;
    case 'elf':
      person(p,v!=='blademaster');p.p([5.8,3.5,3,2.5,5.8,6]);p.p([10.2,3.5,13,2.5,10.2,6]);
      if(v==='blademaster'){p.l([5,8,2,10],1.3);p.l([11,8,14,10],1.3);p.p([1.2,12,1,4,3,2,2.8,10]);p.p([13.2,10,13,2,15,4,14.8,12]);}
      else if(v==='priestess'){p.p([5.5,3,8,.5,10.5,3]);p.l([13,6,13,14],1.2);p.l([11,7,15,7],1.2);p.c(13,4,1.5);p.c(5,10,.85,.85,true);p.c(8,11,.85,.85,true);}
      else {star(p,2.4,8,2.4);star(p,13.6,8,2.4);p.l([4,8,6,9],1.2);p.l([12,8,10,9],1.2);p.p([7,8,9,8,8,11],.8,true);}return;
    case 'worm':
      p.l([13,12,12,14,8,13,5,11,4,7,5,4,8,3],4);p.c(10,3.7,3);p.c(10.3,3.7,1.65,.95,true);
      for(const [xx,yy] of [[7,4],[5,7],[6,10],[9,12]])p.l([xx!-1,yy!-1,xx!+1,yy!+1],.8,.8,true);
      p.p([9,2,9.5,3.5,10.3,2.2]);p.p([11.3,3,10.7,4,12,4.5]);return;
    case 'construct': {
      if(v==='winged')wings(p,'feather',.72);
      const ghost=v==='spirit',a=ghost?.63:1;
      if(v==='sentinel'){p.r(6,4,4,3,a);p.p([5,8,11,8,12,13,4,13],a);p.r(3,14,10,1,a);p.l([5,8,3,5,3,2],1.6);p.p([3,0.5,5,2,3,4,1,2]);p.l([11,8,13,5,13,2],1.6);return;}
      p.p([5,2,11,2,11,5,13,6,14,10,11,11,10,14,8.5,14,8,11,7,11,6.5,14,4,14,5,10,2,10,2,6,5,5],a);
      p.l([5.5,4.3,10.5,4.3],1.1,.9,true);p.l([6,7,10,7,10,10,6,10,6,7],.8,.65,true);
      if(v==='golem'){p.l([5,1,4,3,5,5],1.2);p.l([3,8,3,10],1,.8,true);p.l([11,12,12,14],1.5);}
      else if(v==='warden'){p.p([4,2,3,0.5,7,2,8,.5,9,2,13,.5,12,2]);p.l([13.5,3,13.5,15],1.4);p.p([11,4,15,4,15,7,11,7],.95);p.l([8,11,8,15],1,.6);}
      else if(v==='winged'){sword(p,13.5,8,.65);p.c(8,.6,.65,.8);}
      else {p.l([13.2,2,13.2,15],1.4,a);p.p([13,2,10.5,3,10.5,7,13,6,15,7,15,3],a);if(ghost)p.oval(8,14.5,5.8,.6,.8,.5);}return;
    }
    case 'relic':
      if(v==='egg'){p.p([3,10,3.5,6,6,2,9,1,12,5,13,9,12,12,9,14,5,13],.87);p.l([4,8,7,7,8,10,11,9],1,.85,true);p.l([1,14,5,15,12,15,15,13],1,.65);}
      else {p.p([8,1,13,5,11,12,8,15,5,12,3,5],.72);p.l([3,5,13,5,8,13,3,5],1.1);p.l([8,1,8,13],.9);p.r(6.5,6.5,3,3,.65,true);}return;
    case 'winged':
      if(v==='phoenix'){wings(p,'feather');p.p([7,3,9,3,11,5,9,6,9,11,12,15,8,13,4,15,7,10]);p.p([7,4,6,1,8,2,10,0.5,10,3]);p.c(8.5,4,.6,.9,true);p.l([4,8,2,12],1.2,.6);p.l([12,8,14,12],1.2,.6);}
      else if(v==='pixie'){p.e(4.4,6,2.7,4,.58);p.e(11.6,6,2.7,4,.58);p.c(8,4,1.5);p.l([8,6,8,11,5,14],1.4);p.l([8,11,11,14],1.1);p.l([5,8,11,8],1.2);star(p,14,2,1.6,.8);}
      else {wings(p,'bat');p.e(8,9,2.3,3.8);p.p([5.8,6,6,2,8,4,10,2,10.2,6]);p.eyes(6.2,5,2.3);if(v==='fury'){p.l([6,11,4,14,3,13],1.3);p.l([10,11,12,14,13,13],1.3);p.p([7,8,8,10,9,8],.8,true);}}return;
    case 'demon':
      person(p);p.p([5.8,3,4,1,6,1.5,7,3]);p.p([10.2,3,12,1,10,1.5,9,3]);p.l([10,11,13,13,15,10,14,7],1.15);p.p([12.7,8,15,6,15,9]);p.l([5,8,2,10],1.5);p.c(2,10,1.5);return;
    case 'dragon':
      p.p([6,7,3,1,2,7,1,10,4,9,6,12,10,12,12,9,11,6,11,3,14,3,15,6,12,7,10,10,7,9]);
      p.p([8,8,9,2,5,5,6,8],.76);p.l([6,11,3,14,1,13],1.7);p.l([8,11,8,15],1.7);p.l([11,11,13,14],1.7);p.p([11,3,11,0.5,13,3]);p.c(13,4.6,.7,.95,true);p.l([15,7,14,9],1,.65);return;
    case 'elemental':
      p.c(8,4,2.2);p.p([5.5,7,10.5,7,10,10,7,12,9,14,5,15,4,12,6,10]);p.eyes(6.4,3.8,2.1);
      if(v==='dancer'){p.l([5,8,2,5,3,3],1.7);p.l([11,8,14,5,13,3],1.7);flame(p,2.7,2.8,.27);flame(p,13.3,2.8,.27);p.p([7,3,6,0.5,9,2,10,0,11,4],.9);}
      else {p.l([5,8,2,8,1,5,2,2],1.4);p.l([11,8,14,8,15,5,14,2],1.4);p.p([1,5,1,1,3,1,2,5]);p.p([15,5,15,1,13,1,14,5]);p.l([4,13,8,14,12,12],.9,.7);}return;
    case 'weapon':
      if(v==='blade'){p.p([3,14,5,10,7,9,10,3,13,1,12,6,8,11,6,12,4,15],.95);p.l([4,8,9,13],1.3);p.l([2,5,4,4],.8,.6);}
      else {sword(p,8,8,.94,.9);p.l([3,5,2,8,3,11],.9,.5);p.l([13,5,14,8,13,11],.9,.5);}return;
    case 'plant':
      p.p([6,6,10,6,11,11,14,15,10,13,8,15,6,12,2,15,5,10]);p.c(8,4.6,2.1);p.eyes(6.6,4.3,1.8);
      p.l([5,8,2,6,2,3],1.6);p.l([11,8,14,6,14,3],1.6);p.p([2,5,0.5,2,4,3],.8);p.p([14,5,12,2,15.5,2],.8);p.p([7,3,4,1,7,1,8,.5,12,1,10,3],.9);return;
    case 'adventurer':person(p,false,v==='spectral'?.65:.82);p.l([12,4,12,14],1.2,.8);if(v==='clone'){p.l([2,3,2,13],.8,.45);p.l([4,1,11,1],.8,.45);}else {p.oval(8,14,5.6,.8,.9,.6);star(p,13,3,1.5,.65);}return;
    default:
      // An unidentified creature: an animal silhouette, never a guessed species.
      p.p(v==='small'?[3,11,4,7,6,6,7,3,9,5,12,6,14,9,12,12,8,12,6,14,4,13]:[2,12,2,7,4,4,7,3,11,4,14,7,14,12,11,14,9,11,6,11,4,14]);
      p.c(6,7,.8,.9,true);p.c(10,7,.8,.9,true);return;
  }
}

function paintItem(p:Pen,f:string):void {
  switch(f) {
    case 'weapon':p.p([3,14,5,10,11,2,14,1,13,4,7,12,5,15]);p.l([3,8,9,13],1.8);p.l([2,13,4,15],1.8);return;
    case 'armor':p.p([3,2,6,1,6,4,10,4,10,1,13,2,15,6,12,8,12,14,4,14,4,8,1,6],.85);p.l([8,6,8,12],1,.7,true);p.l([5,9,11,9],.8,.6,true);return;
    case 'potion':p.r(6,1,4,2);p.r(6.5,3,3,3,.85);p.p([6,5,10,5,13,9,12,14,4,14,3,9],.9);p.l([4.5,9,11.5,9],1,.7,true);p.r(5,10,1,2,.85,true);return;
    case 'scroll':p.p([4,2,12,2,12,11,10,14,3,14,4,11],.88);p.ring(4,3,2,1.3);p.l([6,6,10,6],1,.8,true);p.l([6,9,9,9],1,.8,true);p.l([3,12,9,12,10,14,12,13],1.2);return;
    case 'food':p.p([2,11,2,7,4,4,9,3,13,5,14,9,12,12,5,13],.9);p.l([5,6,4,9],1.1,.8,true);p.l([9,5,8,8],1.1,.8,true);p.l([12,6,11,9],1.1,.8,true);return;
    case 'gold':p.e(6,12,5,2);p.e(10,8.7,4.5,1.8,.9);p.e(6,5.3,4.5,1.8,.86);p.oval(6,4.5,4.5,1.8,1);p.l([2,6,2,8,7,9],1,.9);p.l([13,9,13,11],1.1);return;
    case 'wand':p.l([3,13,11,5],2.2);p.l([5,11,7,9],.8,.8,true);star(p,12,3,2.6);p.c(4,3,.65,.8);p.c(14,8,.65,.8);return;
    case 'staff':p.l([6,15,8,5],2);p.l([8,5,5,3,7,1,11,1,12,4,10,6],1.7);p.c(8.8,3.2,1);return;
    case 'ring':p.ring(8,10,4.2,1.9);p.p([8,1,11,4,8,7,5,4]);p.l([5,4,11,4],.8,.8,true);return;
    case 'charm':p.l([8,1,8,4],1.1);p.p([8,3,13,6,11,12,5,12,3,6],.9);p.c(8,7.5,1.7,.85,true);p.l([5,12,4,15],1);p.l([8,12,8,15],1);p.l([11,12,12,15],1);return;
    case 'key':p.ring(5,5,3,1.8);p.l([7.2,7.2,13,13],2);p.l([10,10,12,8],1.5);p.l([12,12,14,10],1.5);return;
    case 'amulet':p.l([2,1,5,6,8,8,11,6,14,1],1.1);p.ring(8,10.5,3.5,1.4);star(p,8,10.5,2.4);return;
    case 'gem':p.p([4,2,12,2,15,6,8,15,1,6],.82);p.l([1,6,15,6],1,.8,true);p.l([4,2,6,6,8,15,10,6,12,2],.9,.8,true);return;
    default:p.p([5,2,11,2,10,5,13,8,13,13,11,15,5,15,3,13,3,8,6,5],.85);p.l([5,6,11,6],1,.8,true);p.ring(8,10,1.4,1);return;
  }
}
function paintSpecial(p:Pen,f:string):void {
  switch(f){
    case 'blank':return;
    case 'adventurer':
      person(p);p.p([4,7,2.5,8,2,12,5,13],.8);sword(p,12.6,8,.64);p.l([5,15,10,15],.75,.5);return;
    case 'track':p.e(5.3,9.7,2.4,3.1,.92);p.e(11.7,6.5,2.2,3,.85);p.c(3.2,5.8,1);p.c(6,5.4,1);p.c(10,2.7,.9);p.c(12.9,2.3,.9);return;
    case 'goodMagic':p.ring(8,8,5,1.1,.65);star(p,8,8,4.8,.94);p.c(2,2,.75,.7);p.c(14,14,.75,.7);return;
    case 'badMagic':p.ring(8,8,5,1.1,.65);p.p([5,3,8,6,11,3,10,8,13,12,8,10,3,12,6,8],.94);return;
    case 'amuletMagic':paintItem(p,'amulet');return;
    case 'projectile':p.l([1,13,5,9],1.6,.4);p.l([3,14,7,10],1.4,.65);p.p([5,8,12,3,15,1,13,7,8,12,8,8],.95);return;
    case 'alert':p.l([8,2,2,13,14,13,8,2],1.5);p.l([8,6,8,9],1.5);p.c(8,11,.75);return;
    case 'uncertain':p.oval(8,8,6,4,1.2,.8);p.ring(8,8,2,1.1,.85);p.l([2,13,14,2],1,.65);return;
    case 'hallucination':p.ring(6,6,3.5,1.2,.8);p.ring(10,10,3.5,1.2,.8);star(p,11,3,1.7,.8);return;
    case 'impact':p.l([2,2,6,6],1.5);p.l([14,2,10,6],1.5);p.l([2,14,6,10],1.5);p.l([14,14,10,10],1.5);star(p,8,8,2.8);return;
    case 'healing':p.r(7,2,2,12,.9);p.r(2,7,12,2,.9);return;
    case 'unknown':p.oval(8,8,6,4,1.1,.7);p.p([8,4,10,8,8,12,6,8],.84);p.c(8,8,.9,.85,true);return;
    default:paintTerrain(p,f);return;
  }
}

/** Renderer target that retains already-authorized geometry across frames. */
export interface RetainedVectorTarget {
  readonly retainedVector: true;
  paintTile(value:TileSemantic,color:string|number,x:number,y:number,size:number):false;
}

/** Vector-only in every case. false means the caller must not add a label.
 * Unknown future identities still receive a graphical fallback, never text. */
export function paintVectorTile(g:Graphics|RetainedVectorTarget,value:TileSemantic,color:string|number,x:number,y:number,size:number):boolean {
  if ('retainedVector' in g && g.retainedVector === true) return g.paintTile(value,color,x,y,size);
  const resolved=resolveVectorIcon(value);
  const parsed=typeof color==='number'?color:parseInt(color.replace(/^#/,''),16);
  const c=Number.isFinite(parsed)?parsed:0;
  const p=new Pen(g as Graphics,c,x*size,y*size,size/16);
  // Quiet unframed occlusion halo: inherited floor/grass must not read through
  // the actor. Black only, so darkness and memory can never become brighter.
  if(resolved.group==='creature'||resolved.family==='adventurer')p.e(8,8,6.8,6.8,.60,true);
  if(resolved.group==='terrain')paintTerrain(p,resolved.family);
  else if(resolved.group==='creature')paintCreature(p,resolved.family,resolved.variant);
  else if(resolved.group==='item')paintItem(p,resolved.family);
  else paintSpecial(p,resolved.family);
  return false;
}
