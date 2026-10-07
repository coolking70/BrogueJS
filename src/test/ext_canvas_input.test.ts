import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {Game} from '../engine/Core/Game';
import {Direction} from '../types';
import {DialogService} from '../ui/dialogService';
import {installRecordingScene} from './support/recordingV4';
import {prepareCanvasInputScene} from './support/canvasInputScene';
afterEach(()=>{vi.restoreAllMocks();});
function setup() {
 installRecordingScene(prepareCanvasInputScene);
 const g=new Game();g.startNewGame({seed:51020001,mode:'normal',ruleSet:'classic'});g.animationEnabled=false;
 expect(g.extensionRuntime).toBeNull();return {g};
}
let input:typeof import('../engine/Input').inputManager;
let install:typeof import('../ui/canvasGameInput').installCanvasGameInput;
beforeAll(async()=>{
 vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});
 ({inputManager:input}=await import('../engine/Input'));
 ({installCanvasGameInput:install}=await import('../ui/canvasGameInput'));
});
it('foundation canvas keyboard/DPad records movement without any production module',()=>{
 const {g}=setup();install(g,()=>false);const at={...g.player.loc},events=g.recordedInputEvents.length,turn=g.absoluteTurnNumber;
 input.triggerAction('move',Direction.DOWN);
 expect(g.player.loc).toEqual({x:at.x,y:at.y+1});expect(g.recordedInputEvents.length).toBe(events+1);expect(g.absoluteTurnNumber).toBe(turn+1);
 (input as unknown as {handleKeyDown(e:KeyboardEvent):void}).handleKeyDown({key:'ArrowDown',code:'ArrowDown',preventDefault(){},stopImmediatePropagation(){}} as KeyboardEvent);
 expect(g.player.loc).toEqual({x:at.x,y:at.y+2});expect(g.recordedInputEvents.length).toBe(events+2);expect(g.absoluteTurnNumber).toBe(turn+2);
});
it('true display-modal and DialogInput busy owners retain native-input priority', async()=>{
 const {g}=setup();let modal=true;install(g,()=>modal);const at={...g.player.loc},events=g.recordedInputEvents.length,turn=g.absoluteTurnNumber;
 input.triggerAction('move',Direction.DOWN);expect(g.player.loc).toEqual(at);expect(g.recordedInputEvents.length).toBe(events);
 const {dialogInput}=await import('../ui/dialogInput');const service=new DialogService();
 let blocked=true;
 const detach=dialogInput.attach({service,contains:()=>false,hint(){},blocked:()=>blocked});modal=false;
 input.triggerAction('move',Direction.DOWN);expect(g.player.loc).toEqual(at);expect(g.recordedInputEvents.length).toBe(events);
 blocked=false;
 for(const kind of ['confirm','acknowledgment'] as const){
  const onAnswer=vi.fn();service.request({kind,text:'native input priority',owner:'foundation-input-test',onAnswer});
  input.triggerAction('move',Direction.DOWN);
  expect(g.player.loc).toEqual(at);expect(g.recordedInputEvents.length).toBe(events);expect(g.absoluteTurnNumber).toBe(turn);
  expect(onAnswer).not.toHaveBeenCalled();
  expect(service.answer(service.current!.token,kind==='confirm'?'no':'more')).toBe(true);
  expect(onAnswer).toHaveBeenCalledOnce();
 }
 input.triggerAction('move',Direction.DOWN);
 expect(g.player.loc).toEqual({x:at.x,y:at.y+1});expect(g.recordedInputEvents.length).toBe(events+1);expect(g.absoluteTurnNumber).toBe(turn+1);
 detach();service.dispose();
});
it('text/form keys stay in their DOM owner and canvas separates automatic pause from modal input',()=>{
 const {g}=setup();install(g,()=>false);const events=g.recordedInputEvents.length;
 (input as unknown as {handleKeyDown(e:KeyboardEvent):void}).handleKeyDown({key:'ArrowDown',target:{tagName:'INPUT'}} as unknown as KeyboardEvent);
 expect(g.recordedInputEvents.length).toBe(events);
 const app=readFileSync('src/App.vue','utf8'),canvas=readFileSync('src/components/GameCanvas.vue','utf8');
 expect(app).toContain(':display-modal-open="creationTransition" :pause-automatic-actions="modulePanelOpen"');
 expect(canvas).toContain('installCanvasGameInput(game, () => props.displayModalOpen)');
 expect(canvas).toContain('!props.pauseAutomaticActions');
});
