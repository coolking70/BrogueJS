import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import type { ExtensionContext, ExtensionModule, Json } from '../ext/types';
import { validWorldSnapshot, type WorldInteractablePlacement } from '../ext/world';
import { interactablePlacementCells, hasInteractionLine } from '../ext/worldSpatial';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { getNextEntityId } from '../entities/Creature';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { createHeadlessGame } from './harness';
import * as catalog from '../ext/catalog';

const request: WorldInteractablePlacement = { instanceKey:'fixture.first',contentId:'fixture.actor',nameKey:'ext.probe.name',descriptionKey:'ext.probe.description',glyph:'?',color:'#bbccdd',interactionDistance:1,priority:0,minStairDistance:1,maxEntranceDistance:8 };
function fixture(options: { fail?: boolean; placement?: WorldInteractablePlacement[] } = {}): ExtensionModule {
    const place = options.placement ?? [request];
    return { id:'probe',version:'1.0.0',worldInteractables:true,initialState:()=>({target:0,session:0}),validateState:(value):value is Json=>!!value&&typeof value==='object',
        hooks:{enteredLevel:(_event,context)=>{
            if ((context.state as {target:number}).target) return;
            const results=context.placeInteractables(place);
            context.setState({target:results[0]?.entity?.id ?? 0,session:0});
            if(options.fail)throw new Error('after placement');
        }, interactionClosed:(_event,context)=>{const state=context.state as {target:number;session:number};context.setState({...state,session:0});}},
        interactionCommands:['refresh','close'],commands:{
            open:(_payload,context)=>{const state=context.state as {target:number;session:number};context.interactionGate({targetEntityId:state.target,sessionId:1});context.setState({...state,session:1});},
            refresh:(_payload,context)=>{const state=context.state as {target:number;session:number};context.interactionGate({targetEntityId:state.target,sessionId:state.session});},
            close:(_payload,context)=>context.interactionGate(null),
            fail:(_payload,context)=>{context.interactionGate(null);context.setState({target:999,session:0});throw new Error('failed command');},
        }};
}
function runtime(module=fixture(), extra:Partial<ExtensionPorts>={}) {
    const registry=new ExtensionRegistry();registry.register(module.id,module.version,()=>module);
    return new ExtensionRuntime(registry,registry.manifest([module.id]),{depth:()=>1,playerId:()=>1,randomInt:vi.fn(()=>0),message:vi.fn(),
        interactableCandidates:()=>[{x:2,y:2},{x:3,y:2}],isInteractableVisible:()=>true,canInteractWith:()=>true,...extra});
}
function enter(runtime:ExtensionRuntime,depth=1) {const token=runtime.beginGeneration('floor');runtime.emit('enteredLevel',{depth,firstVisit:true});try{runtime.commitGeneration(token);}catch(error){runtime.rollbackGeneration(token);throw error;}}
const command=(action:string)=>JSON.stringify({module:'probe',action,payload:null});
afterEach(()=>vi.restoreAllMocks());

describe('foundation stationary world capability',()=>{
    it('places atomically only in a committed level-entry hook with stable global IDs and no dice',()=>{
        const before=getNextEntityId(),random=rng.getState(), rt=runtime(fixture({placement:[request,{...request,instanceKey:'fixture.second'}]}));
        enter(rt);const entities=rt.snapshot().foundation.world.entities;
        expect(entities.map(entity=>[entity.id,entity.x,entity.y])).toEqual([[before,2,2],[before+1,3,2]]);
        expect(getNextEntityId()).toBe(before+2);expect(rng.getState()).toEqual(random);
        expect(rt.visibleInteractables()[0]).not.toHaveProperty('instanceKey');expect(rt.visibleInteractables()[0]).not.toHaveProperty('contentId');
        expect(Object.isFrozen(rt.visibleInteractables()[0])).toBe(true);
        enter(rt);expect(getNextEntityId()).toBe(before+2);
        const outside=runtime();expect(()=>outside.emit('enteredLevel',{depth:1,firstVisit:true})).toThrow('outside');
    });
    it('restores entity IDs, world and module state when the completed placement batch fails',()=>{
        const rt=runtime(fixture({fail:true})),before=rt.snapshot(),next=getNextEntityId();
        expect(()=>enter(rt)).toThrow('after placement');expect(rt.snapshot()).toEqual(before);expect(getNextEntityId()).toBe(next);
    });
    it('empty candidates allocate no entity; whole malformed batch rejected before allocating',()=>{
        const rt=runtime(fixture(),{interactableCandidates:()=>[]}),next=getNextEntityId();enter(rt);
        expect(rt.snapshot().foundation.world.entities).toEqual([]);expect(getNextEntityId()).toBe(next);
        const bad=runtime(fixture({placement:[request,{...request,instanceKey:'fixture.bad',interactionDistance:999}]}));
        expect(()=>enter(bad)).toThrow('batch');expect(getNextEntityId()).toBe(next);
    });
    it('gates every action at the engine runtime boundary and permits only current owner declared continuation commands',()=>{
        const rt=runtime();enter(rt);rt.command(command('open'));expect(rt.interactionActive).toBe(true);
        for(const action of ['wait','move','item:command','auto_step'])expect(rt.allowsInput(action)).toBe(false);
        expect(rt.allowsInput('ext:command',command('open'))).toBe(false);
        expect(()=>rt.command(command('open'))).toThrow('gate');
        expect(rt.allowsInput('ext:command',command('refresh'))).toBe(true);rt.command(command('refresh'));
        rt.command(command('close'));expect(rt.interactionActive).toBe(false);
    });
    it('retains cached-floor objects, closes terminal gate without dropping inspection roots, and collects only absent depths',()=>{
        const rt=runtime();enter(rt);rt.command(command('open'));const world=rt.snapshot().foundation.world;
        rt.collectWorld([1,2],false);expect(rt.snapshot().foundation.world).toEqual(world);
        rt.collectWorld([1,2],true);expect(rt.interactionActive).toBe(false);expect(rt.snapshot().foundation.world.entities).toEqual(world.entities);
        rt.collectWorld([2],false);expect(rt.snapshot().foundation.world.entities).toEqual([]);
    });
    it('strict codec rejects duplicate IDs, unknown owners, invalid coordinates, dangling gates and extra fields',()=>{
        const rt=runtime();enter(rt);const world=rt.snapshot().foundation.world;
        expect(validWorldSnapshot(world,['probe'])).toBe(true);
        const cases=[{...world,extra:true},{...world,entities:[...world.entities,...world.entities]},
            {...world,entities:[{...world.entities[0],owner:'absent'}]}, {...world,entities:[{...world.entities[0],x:-1}]},
            {...world,gate:{owner:'probe',targetEntityId:999999,sessionId:1}}];
        for(const bad of cases)expect(validWorldSnapshot(bad,['probe'])).toBe(false);
    });
    it('retired contexts cannot place, gate, or mutate a replacement runtime',()=>{
        let context:ExtensionContext|undefined;
        const rt=runtime({...fixture(),onNewGame:value=>{context=value;}});rt.newGame();rt.unload();
        expect(()=>context!.interactionGate(null)).toThrow('outside');expect(()=>context!.placeInteractables([request])).toThrow('outside');
        expect(rt.visibleInteractables()).toEqual([]);expect(rt.allowsInput('wait')).toBe(false);
    });
});

describe('world placement and line-of-interaction',()=>{
    function grid(){const result=new Grid(12,10);for(let y=0;y<10;y++)for(let x=0;x<12;x++){result.setTerrain(x,y,TerrainType.FLOOR);result.getCell(x,y)!.isVisible=true;}return result;}
    it('sorts nearby safe floor cells by distance,y,x while excluding native occupancy, stairs, machines, danger and invisibility',()=>{
        const map=grid();map.setTerrain(5,5,TerrainType.STAIRS_UP);map.setTerrain(4,4,TerrainType.LAVA);
        map.getCell(5,4)!.machineNumber=1;map.getCell(6,4)!.isVisible=false;
        const cells=interactablePlacementCells(map,{x:5,y:5},[{x:4,y:5}],{...request,maxEntranceDistance:1});
        expect(cells).toEqual([{x:6,y:5},{x:4,y:6},{x:5,y:6},{x:6,y:6}]);
        map.getCell(6,5)!.isOpaque=true;
        expect(interactablePlacementCells(map,{x:5,y:5},[],{...request,maxEntranceDistance:1})).not.toContainEqual({x:6,y:5});
    });
    it('permits same-cell interaction, refuses solid target and double-wall diagonal even with stale visibility',()=>{
        const map=grid();expect(hasInteractionLine(map,{x:5,y:5},{x:5,y:5})).toBe(true);
        map.getCell(5,5)!.isOpaque=true;expect(hasInteractionLine(map,{x:5,y:5},{x:5,y:5})).toBe(true);map.getCell(5,5)!.isOpaque=false;
        map.setTerrain(6,5,TerrainType.WALL);map.setTerrain(5,6,TerrainType.WALL);
        expect(hasInteractionLine(map,{x:5,y:5},{x:6,y:6})).toBe(false);
        map.setTerrain(5,6,TerrainType.FLOOR);expect(hasInteractionLine(map,{x:5,y:5},{x:6,y:6})).toBe(true);
        expect(hasInteractionLine(map,{x:5,y:5},{x:6,y:5})).toBe(false);
    });
    it('real Game rejects frozen movement/items/wait, direct time advancement and automation without advancing clocks or RNG',()=>{
        const registry=new ExtensionRegistry();registry.register('probe','1.0.0',()=>fixture());vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
        const game=createHeadlessGame(901,'test');game.startNewGame({seed:901,mode:'test',ruleSet:'extended',extensions:['probe']});
        const entities=game.extensionRuntime!.snapshot().foundation.world.entities;expect(entities.length).toBe(1);
        const target=entities[0]!;game.player.loc={x:target.x,y:target.y};game.grid.getCell(target.x,target.y)!.isVisible=true;
        // A frame-only flare must not pass open preflight and then lose its
        // target when applyCommand clears transient visibility.
        const light=vi.spyOn(game.lightMap,'lightSumAt').mockReturnValue(0);
        (game as any).flareLightMap={};
        const unopened=game.recordedInputEvents.length;
        expect((game as any).canInteractWith(target)).toBe(false);
        expect(game.recordedInputEvents).toHaveLength(unopened);
        (game as any).flareLightMap=null;light.mockRestore();
        game.executeCommand('ext:command',command('open'));expect(game.interactionActive).toBe(true);
        const before={tick:timeSystem.currentTick,food:game.player.inventory.items.map(item=>[item.id,item.quantity]),rng:rng.getState(),turn:game.absoluteTurnNumber,events:game.recordedInputEvents.length,pos:{...game.player.loc},snapshot:game.extensionRuntime!.snapshot()};
        game.executeCommand('wait');game.executeCommand('move',{x:1,y:0});game.executeItemCommand('eat',game.player.inventory.items[0]);
        const food=game.player.inventory.items[0]!; game.eatItem(food);game.dropItem(food);game.equipItem(food);
        game.enterThrowMode(food);game.throwItemAt(food,target.x+1,target.y);game.handleMouseTravel(target.x+2,target.y);game.setAutoPath(target.x+2,target.y);
        (game as any).objectiveTimeBlock();(game as any).updateEnvironment();(game as any).playerTurnEnded();game.stepAutoPath();
        expect({tick:timeSystem.currentTick,food:game.player.inventory.items.map(item=>[item.id,item.quantity]),rng:rng.getState(),turn:game.absoluteTurnNumber,events:game.recordedInputEvents.length,pos:{...game.player.loc},snapshot:game.extensionRuntime!.snapshot()}).toEqual(before);
        game.executeCommand('ext:command',command('close'));expect(game.interactionActive).toBe(false);
    });
});
