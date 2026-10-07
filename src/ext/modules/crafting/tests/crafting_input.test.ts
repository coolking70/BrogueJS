import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {effectScope,ref} from 'vue';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {installRecordingScene} from '../../../../test/support/recordingV4';
import {prepareCanvasInputScene} from '../../../../test/support/canvasInputScene';
import {Direction} from '../../../../types';
import {computeMapCamera} from '../../../../ui/mapCamera';
const live:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>{live.splice(0).forEach(h=>h.dispose());vi.restoreAllMocks();});
import {useCraftingUi as useOwnedUi} from '../ui/useCraftingUi';
function setup(quiet=false) {
 installRecordingScene(g=>{
  prepareCanvasInputScene(g,quiet);
  // Constructor also captures a classic origin, with no work entities.
  // The selected owner's extended origin is captured after its actual startup.
  for(const e of g.extensionRuntime?.worldWorkEntities()??[]){
   Object.assign(e,{x:4+e.id%6,y:4});const n=g.world5?.nodes.find(n=>n.interactableId===e.id);if(n)n.at={x:e.x,y:e.y};
  }
 });
 const h=createWorldHarness({seed:51020001,modules:['crafting']});live.push(h);return {h,g:worldHarnessGame(h)};
}
let input:typeof import('../../../../engine/Input').inputManager;
let install:typeof import('../../../../ui/canvasGameInput').installCanvasGameInput;
beforeAll(async()=>{
 vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
 ({inputManager:input}=await import('../../../../engine/Input'));
 ({installCanvasGameInput:install}=await import('../../../../ui/canvasGameInput'));
});
it('canvas native keyboard/DPad route advances with the crafting drawer open',async()=>{
 const {g}=setup();
 const scope=effectScope();
 const host={game:()=>g,tick:ref(0),immersive:ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},
  registerKeyHandler:(fn:(e:KeyboardEvent)=>boolean,p:number)=>input.registerModalKeyHandler(fn,p)};
 const s=scope.run(()=>useOwnedUi(host))!;
 s.commands.value[0]!.invoke();for(let k=0;k<100&&!s.panelOpen.value;k++)await new Promise(r=>setTimeout(r,10));

 install(g,()=>false);
 const initial={...g.player.loc},events=g.recordedInputEvents.length,turn=g.absoluteTurnNumber;
 input.triggerAction('move',Direction.DOWN);s.refresh();
 expect(g.player.loc).toEqual({x:initial.x,y:initial.y+1});expect(g.recordedInputEvents.length).toBe(events+1);expect(g.absoluteTurnNumber).toBe(turn+1);
 // Invoke the actual InputManager key route, including the module key owner.
 (input as unknown as {handleKeyDown(e:KeyboardEvent):void}).handleKeyDown({key:'ArrowDown',code:'ArrowDown',preventDefault(){},stopImmediatePropagation(){}} as KeyboardEvent);
 s.refresh();expect(g.player.loc).toEqual({x:initial.x,y:initial.y+2});expect(g.recordedInputEvents.length).toBe(events+2);expect(g.absoluteTurnNumber).toBe(turn+2);
 expect(s.panelOpen.value).toBe(true);
 const cam=computeMapCamera(390,200,{scaleX:.25,scaleY:.25,offsetX:0,offsetY:0},79,29,16,g.player.loc,1,{x:0,y:0},true,{fillViewport:true,edgePaddingTiles:2});
 const screen={x:cam.offsetX+(g.player.x+.5)*16*cam.scaleX,y:cam.offsetY+(g.player.y+.5)*16*cam.scaleY};
 expect(screen.x).toBeGreaterThanOrEqual(0);expect(screen.x).toBeLessThanOrEqual(390);
 expect(screen.y).toBeGreaterThanOrEqual(0);expect(screen.y).toBeLessThanOrEqual(200);
 expect(Math.floor((screen.x-cam.offsetX)/(16*cam.scaleX))).toBe(g.player.x);
 expect(Math.floor((screen.y-cam.offsetY)/(16*cam.scaleY))).toBe(g.player.y);
 scope.stop();
});
