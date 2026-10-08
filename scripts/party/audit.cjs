const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=process.cwd(), out='/private/tmp/party-p0';
const ts=require(path.join(root,'node_modules/typescript'));
const files=cp.execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n').sort();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=files.map(file=>({file,sha256:hash(fs.readFileSync(file))}));
fs.writeFileSync(out+'/source-before.json',JSON.stringify(manifest,null,2)+'\n');
const states=JSON.parse(fs.readFileSync('scripts/u03-state-contract.json','utf8'));
const specific=new Set(['autoPath','autoAction','autoFight','isAutoExploring','isMouseTraveling','travelTargetItem','playerFalling','poisonedDuringTurn','searchingCharge','justRested','justSearched','disturbed','lastDamageSource','isGameOver','gameOverWon','gameOverScore','gameOverInventory','gameOverReason','gameOverSuperVictory','pendingIdentify','pendingEnchantmentScrollWasKnown','pendingUseConfirm','pendingThrowItem','pendingArcana','receivedLevitationWarning','everSeenMonsters','everSeenItems','examinedEntityIds','seenBodyCoreIds','identifiedItems','magicPolarityRevealed','callTitles','scent','fov','lightMap','inventoryAction','isInventoryOpen','nutrition','hungerState','regenCarry','temporaryImmunities','equippedWeapon','equippedArmor','ringLeft','ringRight']);
for(const name of ['minersLight','minersLightBaseFixpt','pendingArcana','throwItemTarget','pendingEnchantment','inAutoTravelStep','isThrowing','pendingDiscoveryMessages','visibleMonsters','visibleItems','safetyMap','updatedSafetyMapThisTurn','stats'])specific.add(name);
const implicitMethods=new Map();
const gameSource=ts.createSourceFile('Game.ts',fs.readFileSync('src/engine/Core/Game.ts','utf8'),ts.ScriptTarget.Latest,true);
function discover(n){if(ts.isMethodDeclaration(n)&&n.name&&n.body&&/\bthis\.player\b/.test(n.body.getText(gameSource)))implicitMethods.set(n.name.getText(gameSource),{file:'src/engine/Core/Game.ts',line:gameSource.getLineAndCharacterOfPosition(n.getStart(gameSource)).line+1});ts.forEachChild(n,discover);}discover(gameSource);
const rows=[],raw=[],parsed=[];
function category(file,context,text){
 if(file==='src/engine/Combat/Combat.ts')return ['C','reviewed-actor-combat-capability'];
 if(file==='src/entities/Monster.ts')return ['B','reviewed-faction-target-selection'];
 if(/gameOver|isGameOver|HighScores|Endgame|recording|replay|Snapshot|Digest|startNewGame|constructor|loadGame|saveGame|loadSnapshot/i.test(context+' '+text+' '+file))return ['D','terminal-codec-lifecycle'];
 if(/isPlayer|instanceof Player|faction|isAlly|isHostile|enemy|enemyOf|areTeammates|areEnemies/i.test(text+' '+context))return ['B','identity-faction'];
 if(/everSeen|examinedEntityIds|seenBodyCoreIds|identifiedItems|callTitles|magicPolarity|updateVision|updateFOV|updateLighting|scent|canSee|canDirectlySee|visibleMonster|discovered/i.test(text+' '+context))return ['B','shared-knowledge-perception'];
 if(/(components\/|src\/ui\/|\/ui\/|\/UI\/|App.vue|view.ts$|diagnostics.ts$)/.test(file)||/hover|inspect|flavorText|appearance|sidebar|display|render|get.*Detail|preview|describe/i.test(context))return ['A','presentation-context'];
 if(/GenerationCoordinator|Generator\/|Placement|CreatureSpatial|actorQuery|WorldItemRoots|KindKnowledge/.test(file)||/generateDepth|changeLevel|descend|ascend|enterLevel|transitionLevel|actorActionWorld|spatialWorld|canPlace|visibility/i.test(context))return ['B','world-ownership'];
 return ['C','actor-mechanic-or-port'];
}
function contextOf(n,sf){let a=n;while(a){if((ts.isFunctionLike(a)||ts.isClassDeclaration(a)||ts.isInterfaceDeclaration(a))&&a.name)return a.name.getText(sf);a=a.parent;}return '<module>';}
for(const file of files){
 const src=fs.readFileSync(file,'utf8'), lines=src.split('\n');
 const scope=/\/(?:test|tests|testing)\/|\.test\.|\/fixtures\//.test(file)?'test':/\.(ts|tsx|vue|js)$/.test(file)?'production':'asset';
 for(const m of src.matchAll(/\b(?:this|game)\s*\.\s*player\b/g)){const p=m.index,line=src.slice(0,p).split('\n').length;raw.push({file,line,column:p-src.lastIndexOf('\n',p-1),offset:p,scope,expression:m[0]});}
 if(!/\.(ts|tsx|vue|js)$/.test(file)){
  for(let i=0;i<lines.length;i++)if(/player|isPlayer|玩家|主角/.test(lines[i])){let [c,r]=category(file,'asset',lines[i]);rows.push({file,line:i+1,column:1,offset:src.indexOf(lines[i]),scope,kind:'asset-text',symbol:'player-text',context:'asset',category:c,rule:r,review:'lexical-candidate',text:lines[i].trim().slice(0,260)});}continue;
 }
 let input=src;if(file.endsWith('.vue')) input=src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g,m=>m).split('').map((c,i)=>c==='\n'?'\n':' ').join('');
 if(file.endsWith('.vue'))for(const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){let start=m.index+m[0].indexOf('>')+1;input=input.slice(0,start)+m[1]+input.slice(start+m[1].length);}
 const sf=ts.createSourceFile(file,input,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS), aliases=new Map();
 const host={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>root,getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?input:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=>'\n'};
 const program=ts.createProgram([file],{noResolve:true,noLib:true,allowNonTsExtensions:true},host), checker=program.getTypeChecker();
 const ids=[],decls=[];
 function visit(n){if(ts.isIdentifier(n)||ts.isStringLiteral(n))ids.push(n);if(ts.isVariableDeclaration(n)||ts.isParameter(n)||ts.isBindingElement(n))decls.push(n);ts.forEachChild(n,visit);}visit(sf);
 function depends(n){if(!n||ts.isFunctionLike(n))return false;if(ts.isElementAccessExpression(n)&&ts.isStringLiteral(n.argumentExpression)&&n.argumentExpression.text==='player')return true;if(ts.isIdentifier(n)&&(n.text==='player'||n.text==='Player'||aliases.has(checker.getSymbolAtLocation(n))))return true;let yes=false;ts.forEachChild(n,c=>{if(depends(c))yes=true;});return yes;}
 let change=true;while(change){change=false;for(const n of decls){
  if(!ts.isIdentifier(n.name))continue;const sym=checker.getSymbolAtLocation(n.name);if(!sym||aliases.has(sym))continue;
  const typed=n.type&&/\bPlayer\b|\[['"]player['"]\]/.test(n.type.getText(sf));
  const binding=ts.isBindingElement(n)&&((n.propertyName?.getText(sf)??n.name.text)==='player'||(ts.isVariableDeclaration(n.parent.parent)&&depends(n.parent.parent.initializer)));
  if(typed||binding||depends(n.initializer)){aliases.set(sym,{line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,initializer:(n.initializer?.getText(sf)??n.type?.getText(sf)??'destructured player').slice(0,200)});change=true;}
 }}
 const occupied=new Set();
 for(const n of ids){const symbol=n.text,ctx=contextOf(n,sf),alias=aliases.get(checker.getSymbolAtLocation(n));let kind;
 if(/player/i.test(symbol))kind=ts.isStringLiteral(n)?'player-literal':'player-symbol';
 else if(specific.has(symbol))kind='singleton-state';
 else if(alias)kind='alias';
 else if(implicitMethods.has(symbol)&&ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n&&ts.isCallExpression(n.parent.parent))kind='implicit-player-call';
 else if(file==='src/entities/Player.ts'&&ts.isIdentifier(n)&&n.parent&&ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n&&n.parent.expression.kind===ts.SyntaxKind.ThisKeyword)kind='player-instance-member';
 else continue;
 const p=n.getStart(sf),pos=sf.getLineAndCharacterOfPosition(p),line=lines[pos.line].trim(), [c,r]=category(file,ctx,line);
 rows.push({file,line:pos.line+1,column:pos.character+1,offset:p,scope,kind,symbol,context:ctx,category:c,rule:r,review:kind==='alias'?'conservative-alias':'rule-classified',...(alias?{alias}:{}),...(kind==='implicit-player-call'?{dependency:implicitMethods.get(symbol)}:{}),text:line.slice(0,340)});occupied.add(p);
 }
 // Retain template, comments and strings in a separate non-executable census.
 const codeOffsets=new Set(ids.map(n=>n.getStart(sf)));
 for(const m of src.matchAll(/\b(?:[A-Za-z_$][\w$]*[Pp]layer[\w$]*|player[\w$]*|Player[\w$]*|isPlayer)\b/g)){
  if(occupied.has(m.index))continue;const line=src.slice(0,m.index).split('\n').length,[c,r]=category(file,'text',lines[line-1]);
  rows.push({file,line,column:m.index-src.lastIndexOf('\n',m.index-1),offset:m.index,scope:scope==='test'?'test':'text',kind:file.endsWith('.vue')?'template-or-text':'comment-or-string',symbol:m[0],context:'text',category:c,rule:r,review:'lexical-candidate',text:lines[line-1].trim().slice(0,340)});
 }
 parsed.push({file,diagnostics:sf.parseDiagnostics.length});
}
rows.sort((a,b)=>a.file.localeCompare(b.file)||a.offset-b.offset);rows.forEach((r,i)=>r.id='P0-'+String(i+1).padStart(6,'0'));
for(const d of raw){const candidates=rows.filter(r=>r.file===d.file&&r.line===d.line&&r.symbol==='player');d.entries=candidates.map(r=>r.id);}
const subs=f=>f.startsWith('src/ext/modules/')?f.split('/').slice(0,4).join('/'):f.startsWith('src/engine/')?f.split('/').slice(0,3).join('/'):f.split('/').slice(0,2).join('/');
const totals={},byFile={},bySub={};
for(const r of rows){totals[r.scope]=(totals[r.scope]||0)+1;if(r.scope!=='production')continue;for(const [obj,key]of[[byFile,r.file],[bySub,subs(r.file)]]){obj[key]??={A:0,B:0,C:0,D:0,total:0};obj[key][r.category]++;obj[key].total++;}}
const fieldGroups={
 A:'onCommandConfirmRequest activeFlares animationAccumulatorMs animationEnabled animationLockDeadline boltAnimStartTime currentBoltFrameIndex flareElapsedMs flareLightMap floatingTexts hoveredCell flavorText hoveredText inspectTarget isExamining isInventoryOpen needsRender onConfirmRequest onRenderRequested pendingBoltFrames pendingPauseMs referenceScreen replayFrameAccumulator replayFramesPerStep terrainFlashes replayOmniscientDetails',
 C:'autoPath inAutoTravelStep isAutoExploring isMouseTraveling isThrowing justRested justSearched lastDamageSource minersLight minersLightBaseFixpt pendingArcana pendingEnchantment pendingEnchantmentScrollWasKnown pendingIdentify pendingUseConfirm playerFalling poisonedDuringTurn searchingCharge throwItemTarget travelTargetItem disturbed autoFight autoAction inventoryAction receivedLevitationWarning',
 D:'advancementIter currentSeed gameOverInventory gameOverReason gameOverScore gameOverWon isAdvancing isGameOver lastAdvancementError mode player recordedInputEvents recordedInputIndex recordingStartAt replayCursor replayEvents replayRecording replayStatus executingRecordedCommand',
};
const stateRows=Object.entries(states).map(([name,v])=>{const c=Object.entries(fieldGroups).find(([k,names])=>names.split(' ').includes(name))?.[0]??'B';return {name,...v,category:c,rule:'reviewed-state-ledger',selectedByScanner:specific.has(name)||/player/i.test(name),migration:c==='A'?'session focus/view; preserve persisted command context separately':c==='B'?'party/world shared; actor-aware enumeration at callers':c==='C'?'per-member state/command context':'run terminal/codec lifecycle; player remains primary alias'};});
const result={schema:1,head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,sourceFiles:files.length,method:'AST identifiers, literals, conservative symbol-resolved local alias closure, selected singleton fields; lexical text supplement; automatic primary categories, semantic representative review in report',limitations:['Not a whole-program semantic proof','local alias propagation excludes function bodies and string constants; interprocedural generic arguments require representative call-path review','Generic Creature consumers covered by caller/interface audit, not every generic field read'],totals,bySubsystem:bySub,byFile,rawDirectCount:raw.length,rawDirectByScope:raw.reduce((o,r)=>(o[r.scope]=(o[r.scope]||0)+1,o),{}),unmatchedRawDirect:raw.filter(x=>!x.entries.length),parseDiagnostics:parsed.filter(x=>x.diagnostics),entries:rows,rawDirect:raw,stateFields:stateRows,implicitMethods:Object.fromEntries(implicitMethods)};
fs.writeFileSync(out+'/inventory.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(out+'/summary.json',JSON.stringify({...result,entries:undefined,rawDirect:undefined,stateFields:undefined},null,2)+'\n');
console.log(JSON.stringify({totals,productionFiles:Object.keys(byFile).length,bySub,rawDirectCount:raw.length,rawDirectByScope:result.rawDirectByScope,unmatched:result.unmatchedRawDirect.length,parseDiagnostics:result.parseDiagnostics}));
