import { describe, expect, it } from 'vitest';
import { Graphics, Texture } from 'pixi.js';
import { RetainedBackgroundLayer, RetainedVectorLayer, VectorGeometryCache } from '../ui/retainedMapDrawing';
import { paintVectorTile, resolveVectorIcon } from '../ui/vectorAtlas';
import { mapText, monsterSemantic, glyphSemantic, playerSemantic, type TileSemantic } from '../ui/mapTileSemantics';
import monsters from '../data/monsters.json';
import { RenderRequests } from '../ui/renderRequests';
const terrain=(id:string,hanzi:string):TileSemantic=>({id,hanzi,kind:'terrain',original:'#'});
const entries=[...Object.entries(mapText.terrain).map(([id,h])=>terrain(id,h)),...Object.entries(mapText.items).map(([id,hanzi])=>({id,hanzi,kind:'item' as const,original:'!'})),...monsters.map(m=>monsterSemantic({typeId:m.id,char:m.char},m.char)),playerSemantic('@'),glyphSemantic('x'),glyphSemantic('🙂')];
describe('Retained vector map geometry',()=>{
 it('retains exact paths, ink and cutout alpha for the whole atlas',()=>{
  const cache=new VectorGeometryCache();
  for(const value of entries){
   const old=new Graphics();paintVectorTile(old,value,0x7b9ac2,0,0,16);
   const context=cache.get(value);
   if(resolveVectorIcon(value).family==='blank'){expect(context).toBeNull();old.destroy();continue;}
   expect(context!.batchMode,value.id).toBe('batch');
   expect(context!.instructions.length,value.id).toBe(old.context.instructions.length);
   for(let i=0;i<old.context.instructions.length;i++){
    const a=old.context.instructions[i]!,b=context!.instructions[i]!;
    expect(a.action,value.id).toBe(b.action);
    if(a.action!=='fill'&&a.action!=='stroke')continue;
    if(b.action!=='fill'&&b.action!=='stroke')throw new Error('action mismatch');
    expect(a.data.path.instructions,value.id).toEqual(b.data.path.instructions);
    expect(a.data.style.alpha,value.id).toBe(b.data.style.alpha);
    expect(a.data.style.color,value.id).toBe(b.data.style.color===0 ? 0 : 0x7b9ac2);
   }
   old.destroy();
  }
  cache.destroy();expect(cache.size).toBe(0);
 });
 it('shares only visible silhouettes, including secrets, memory and hallucinated identities',()=>{
  const cache=new VectorGeometryCache();
  expect(cache.get(terrain('SECRET_DOOR','墙'))).toBe(cache.get(terrain('WALL','墙')));
  expect(cache.get(terrain('LAVA','地'))).toBe(cache.get(terrain('FLOOR','地')));
  expect(cache.get(monsterSemantic({typeId:'dragon',char:'d'},'k',true))).toBe(cache.get(monsterSemantic({typeId:'rat',char:'r'},'k',true)));
  expect(cache.get(monsterSemantic({typeId:'dragon',char:'d'},'x',false,true))).toBe(cache.get(glyphSemantic('x','marker')));
  cache.destroy();
 });
 it('does not cache lighting, theme or size; colors and geometry update without stale sprites',()=>{
  const cache=new VectorGeometryCache(),layer=new RetainedVectorLayer(cache);
  const floor=terrain('FLOOR','地'),wall=terrain('WALL','墙');
  for(let i=0;i<2000;i++){layer.clear();paintVectorTile(layer,floor,i,2,3,i%2?16:32);layer.finish();}
  const sprite=layer.children[0] as Graphics;
  expect(cache.size).toBe(1);expect(layer.children).toHaveLength(1);expect(sprite.tint).toBe(1999);
  expect(sprite.position.x).toBe(32);expect(sprite.position.y).toBe(48);expect(sprite.scale.x).toBe(1);
  layer.clear();paintVectorTile(layer,wall,0x0a0b0c,5,6,32);layer.finish();
  expect(sprite.context).toBe(cache.get(wall));expect(sprite.tint).toBe(0x0a0b0c);expect(sprite.scale.x).toBe(2);
  layer.clear();layer.finish();expect(sprite.visible).toBe(false);
  layer.clear();paintVectorTile(layer,floor,0xffffff,0,0,16);layer.finish();expect(sprite.visible).toBe(true);
  layer.destroy({children:true,context:false});cache.destroy();
 });
 it('hides absent actors and bolts and keeps the finite geometry cache bounded',()=>{
  const cache=new VectorGeometryCache(),layer=new RetainedVectorLayer(cache);
  for(const value of entries)paintVectorTile(layer,value,0xaabbcc,1,2,16);
  layer.finish();const count=cache.size;
  for(let repeat=0;repeat<5;repeat++){layer.clear();for(const value of entries)paintVectorTile(layer,value,repeat,3,4,24);layer.finish();}
  expect(cache.size).toBe(count);expect(count).toBeLessThan(180);
  layer.clear();paintVectorTile(layer,playerSemantic('@'),0xffffff,0,0,16);layer.finish();
  expect(layer.children.filter(c=>c.visible)).toHaveLength(1);
  layer.destroy({children:true,context:false});cache.destroy();
 });
 it('preserves the original interleaved paint order at tile boundaries',()=>{
  const cache=new VectorGeometryCache(),background=new RetainedBackgroundLayer(),layer=new RetainedVectorLayer(cache,background);
  for(const [x,y] of [[1,2],[1,3],[2,1]]){
   background.paint(0x112233,x!,y!,16);paintVectorTile(layer,terrain('WALL','墙'),0xffffff,x!,y!,16);
  }
  background.finish();layer.finish();background.sortChildren();
  expect(background.children.map(c=>c.renderPipeId)).toEqual(['sprite','graphics','sprite','graphics','sprite','graphics']);
  background.clear();layer.clear();background.paint(0,2,1,16);paintVectorTile(layer,terrain('FLOOR','地'),0x111111,2,1,16);background.finish();layer.finish();background.sortChildren();
  expect(background.children.filter(c=>c.visible).map(c=>c.renderPipeId)).toEqual(['sprite','graphics']);
  background.destroy({children:true,texture:false,context:false});layer.destroy();cache.destroy();
 });
 it('reuses flat backgrounds and never destroys the global white texture',()=>{
  const layer=new RetainedBackgroundLayer();layer.paint(0x112233,1,2,16);layer.finish();
  const sprite=layer.children[0]!;layer.clear();layer.paint(0x445566,3,4,24);layer.finish();expect(layer.children[0]).toBe(sprite);
  layer.clear();layer.finish();expect(sprite.visible).toBe(false);
  layer.destroy({children:true,texture:false});expect(Texture.WHITE.destroyed).toBe(false);
 });
});
describe('Frame render request coalescing',()=>{
 it('draws only once per flush, including requests made while paused',()=>{
  const requests=new RenderRequests();let draws=0;const draw=()=>draws++;
  requests.flush(draw);expect(draws).toBe(0);
  requests.request();requests.request();requests.request();requests.flush(draw);expect(draws).toBe(1);
  requests.flush(draw);expect(draws).toBe(1);requests.request();requests.flush(draw);expect(draws).toBe(2);
 });
});
