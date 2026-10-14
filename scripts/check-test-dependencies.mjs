/** Static test dependency contract. Parses syntax and follows local imports,
 * helper sources and complete JSON fixtures; never imports optional factories. */
import ts from 'typescript';
import {existsSync,readFileSync,statSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,extname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolveTestSuites,repositoryRoot} from './test-discovery.mjs';
const slash=p=>p.replaceAll('\\','/');
const ownerOf=p=>/^src\/ext\/modules\/([^/]+)\//.exec(p)?.[1];
export function analyzeTestDependencies(root=repositoryRoot, {declarations, discovery}={}) {
 root=realpathSync(root); discovery??=resolveTestSuites(root);
 declarations??=JSON.parse(readFileSync(resolve(root,'scripts/test-dependencies.json'),'utf8'));
 const known=new Set(declarations.modules), cache=new Map(), errors=[], results=[];
 const canonical=p=>{const tail=[];let parent=p;while(!existsSync(parent)&&dirname(parent)!==parent){tail.unshift(basename(parent));parent=dirname(parent);}return resolve(realpathSync(parent),...tail);};
 const locate=(from,s)=>{let base;if(s.startsWith('@/'))base=resolve(root,'src',s.slice(2));else if(s.startsWith('file:'))base=fileURLToPath(s);else if(s.startsWith('/'))base=resolve(s);else if(s.startsWith('.'))base=resolve(dirname(from),s);else return null;return canonical([base,base+'.ts',base+'.tsx',base+'.mjs',base+'.js',base+'.json',base+'/index.ts'].find(p=>existsSync(p)&&statSync(p).isFile())??base);};
 function parse(path){
  if(cache.has(path))return cache.get(path);
  const key=slash(relative(root,path)), out={key,imports:[],needs:[],availability:new Set(),helperCalls:[],parameterDefaults:new Map()};cache.set(path,out);
  if(!existsSync(path)||!statSync(path).isFile())return out;
  let text=readFileSync(path,'utf8');if(extname(path)==='.vue')text=[...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  const need=(id,kind,site)=>{if(known.has(id))out.needs.push({id,kind,source:key,site});};
  function json(value,where=''){
   if(!value||typeof value!=='object')return;
   if(typeof value.payload==='string'&&value.rawSha256&&value.rawBytes){try{const raw=gunzipSync(Buffer.from(value.payload,'base64'));if(raw.length!==value.rawBytes||createHash('sha256').update(raw).digest('hex')!==value.rawSha256)throw Error('raw length/SHA mismatch');json(JSON.parse(raw.toString()),where+'.payload');}catch(error){errors.push(`${key}: invalid complete compressed fixture: ${error.message}`);}}
   for(const [k,v]of Object.entries(value)){
    if(['modules','extensions'].includes(k)){
     if(Array.isArray(v))for(const x of v)need(typeof x==='string'?x:x?.id,'fixture',where+'.'+k);
     else if(v&&typeof v==='object')for(const id of Object.keys(v))need(id,'fixture',where+'.'+k);
    }
    json(v,where+'.'+k);
   }
  }
  if(extname(path)==='.json'){json(JSON.parse(text));return out;}
  if(!/\.[cm]?[jt]sx?$/.test(path)&&extname(path)!=='.vue')return out;
  const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true), vars=new Map(), imported=new Map(), functions=new Map();
  function bind(n){
   if(ts.isFunctionDeclaration(n)&&n.name&&n.body){functions.set(n.name.text,n.body);out.parameterDefaults.set(n.name.text,n.parameters.map(p=>({name:p.name.getText(ast),value:p.initializer?.kind===ts.SyntaxKind.FalseKeyword?false:p.initializer?.kind===ts.SyntaxKind.TrueKeyword?true:null})));}
   if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))functions.set(n.name.text,n.initializer.body);
   if((ts.isVariableDeclaration(n)||ts.isParameter(n))&&ts.isIdentifier(n.name)&&n.initializer)vars.set(n.name.text,n.initializer);
   if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)){
    const target=locate(path,n.moduleSpecifier.text);if(target)out.imports.push({path:target,static:true});
    if(ts.isImportDeclaration(n)&&n.importClause?.name)imported.set(n.importClause.name.text,{name:'default',target:locate(path,n.moduleSpecifier.text)});
    if(ts.isImportDeclaration(n)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings))for(const b of n.importClause.namedBindings.elements)imported.set(b.name.text,{name:b.propertyName?.text??b.name.text,target});
   }
   ts.forEachChild(n,bind);
  }bind(ast);
  function catalogFactory(n,seen=new Set()){
   if(ts.isIdentifier(n)&&vars.has(n.text)&&!seen.has(n.text))return catalogFactory(vars.get(n.text),new Set([...seen,n.text]));
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)){const b=imported.get(n.expression.text);return b?.name==='createExtensionRegistry'&&/src\/ext\/catalog\.ts$/.test(slash(b.target??''));}return false;
  }
  function values(n,seen=new Set()){
   if(!n)return [];
   if(ts.isStringLiteralLike(n))return [n.text];
   if(ts.isIdentifier(n)&&vars.has(n.text)&&!seen.has(path+':'+n.text))return values(vars.get(n.text),new Set([...seen,path+':'+n.text]));
   if(ts.isIdentifier(n)&&imported.has(n.text)&&!seen.has(path+':import:'+n.text)){
    const b=imported.get(n.text);if(b.target){const target=parse(b.target);return target.exportValues?.(b.name,new Set([...seen,path+':import:'+n.text]))??[];}
   }
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken)return values(n.left,seen).flatMap(a=>values(n.right,seen).map(b=>a+b));
   if(ts.isConditionalExpression(n))return [...values(n.whenTrue,seen),...values(n.whenFalse,seen)];
   if(ts.isArrayLiteralExpression(n))return n.elements.flatMap(x=>values(ts.isSpreadElement(x)?x.expression:x,seen));
   if(ts.isAsExpression(n)||ts.isSatisfiesExpression(n)||ts.isParenthesizedExpression(n))return values(n.expression,seen);
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='list'&&catalogFactory(n.expression.expression))return [...known];
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)){const b=imported.get(n.expression.text);if(b?.name==='getInstalledModuleDescriptors'&&/src\/ext\/catalog\.ts$/.test(slash(b.target??'')))return [...known];}
   if(ts.isCallExpression(n))return [...(ts.isPropertyAccessExpression(n.expression)&&['map','flatMap','filter','sort','flat'].includes(n.expression.name.text)?values(n.expression.expression,seen):[]),...n.arguments.flatMap(x=>values(x,seen))];
   return [];
  }
  out.exportValues=(name,seen)=>vars.has(name)?values(vars.get(name),seen):[];
  const requests=new Set();let growing=true;
  while(growing){growing=false;for(const[name,body]of functions){if(requests.has(name))continue;let found=false;
   function request(n){if(ts.isPropertyAssignment(n)&&['modules','extensions'].includes(n.name.getText(ast).replaceAll("'",'').replaceAll('"','')))found=true;
    if(ts.isCallExpression(n)){const b=ts.isIdentifier(n.expression)?imported.get(n.expression.text):null;if(ts.isPropertyAccessExpression(n.expression)&&['manifest','startNewGame'].includes(n.expression.name.text)||b&&b.target&&/\/(test|tests)\//.test(slash(b.target))||ts.isIdentifier(n.expression)&&requests.has(n.expression.text))found=true;}ts.forEachChild(n,request);
   }request(body);if(found){requests.add(name);growing=true;}}
  }
  function walk(n){
   if(ts.isCallExpression(n)){
    const callName=ts.isIdentifier(n.expression)?n.expression.text:ts.isPropertyAccessExpression(n.expression)?n.expression.name.text:'';
    const binding=imported.get(callName);
    if(binding?.target&&/\/(test|tests)\//.test(slash(binding.target)))out.helperCalls.push({target:binding.target,name:binding.name,args:n.arguments.map(a=>a.kind===ts.SyntaxKind.TrueKeyword?true:a.kind===ts.SyntaxKind.FalseKeyword?false:null)});
    if(ts.isPropertyAccessExpression(n.expression)&&callName==='list'&&catalogFactory(n.expression.expression))for(const id of known)out.availability.add(id);
    const helperCall=binding&&binding.target&&/\/(test|tests)\//.test(slash(binding.target));
    if(callName==='manifest'||helperCall||requests.has(callName))for(const id of n.arguments.flatMap(x=>values(x)))need(id,'request',n.getText(ast));
    if(binding&&binding.name==='getInstalledModuleDescriptors'&&/src\/ext\/catalog\.ts$/.test(slash(binding.target??'')))for(const id of known)out.availability.add(id);
    if(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require'){
     for(const specifier of values(n.arguments[0])){const target=locate(path,specifier);if(target)out.imports.push({path:target,static:false});}
    }
    // Availability is recognized only through the actual foundation helpers,
    // not through a matching spelling or a declaration's unsupported promise.
    if(ts.isIdentifier(n.expression)){
     const b=imported.get(n.expression.text);
     if(b&&/src\/test\/support\/(installedExtensions|optionalPackageLifecycle)\.ts$/.test(slash(b.target??''))&&['installedOptionalModules','installedModuleSubsets','missingPackages','installedRelatedCombinations','verifyInstalledPackageFallback'].includes(b.name)){
      for(const id of n.arguments.flatMap(x=>values(x)))if(known.has(id))out.availability.add(id);
     }
    }
    if(ts.isIdentifier(n.expression)&&['readFileSync','readTrace'].includes(n.expression.text)||ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='readFileSync'){
     for(const arg of n.arguments){if(ts.isStringLiteralLike(arg)&&arg.text.endsWith('.json')){const target=resolve(root,arg.text);if(existsSync(target))out.imports.push({path:target,static:false});}
     if(ts.isNewExpression(arg)&&ts.isIdentifier(arg.expression)&&arg.expression.text==='URL'&&arg.arguments?.[0]&&ts.isStringLiteralLike(arg.arguments[0])){
      const target=locate(path,arg.arguments[0].text);if(target)out.imports.push({path:target,static:false});
     }}
    }
   }
   if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteral(n.argument.literal)){const target=locate(path,n.argument.literal.text);if(target)out.imports.push({path:target,static:true});}
   if(ts.isPropertyAssignment(n)&&['extensions','modules'].includes(n.name.getText(ast).replaceAll("'",'').replaceAll('"','')))for(const id of values(n.initializer))need(id,'request',n.getText(ast));
   ts.forEachChild(n,walk);
  }
  // Production internals are traversed for imports, not interpreted as a test's
  // packet. Optional catalog discovery is not a hard dependency on all packs.
  const testSide=key.startsWith('src/test/')||/\/tests\//.test(key);
  if(testSide){
   walk(ast);
   for(const row of out.needs.filter(n=>n.kind==='request')){
    function locate(n){if(ts.isCallExpression(n)&&n.getText(ast)===row.site){let f=n.parent;while(f&&!ts.isFunctionDeclaration(f))f=f.parent;
      if(f?.name){const specs=out.parameterDefaults.get(f.name.text)??[];function conditional(x){if(ts.isConditionalExpression(x)&&ts.isIdentifier(x.condition)){
        const index=specs.findIndex(p=>p.name===x.condition.text),yes=values(x.whenTrue).includes(row.id),no=values(x.whenFalse).includes(row.id);
        if(index>=0&&yes!==no)row.activation={function:f.name.text,index,default:specs[index].value,expected:yes};
       }ts.forEachChild(x,conditional);}for(const a of n.arguments)conditional(a);}
     }ts.forEachChild(n,locate);
    }locate(ast);
   }
  }
  return out;
 }
 for(const file of discovery.files){
  const owner=ownerOf(file), seen=new Set(), needs=[], available=new Set(), importedPackages=new Set();
  function visit(path){if(seen.has(path))return;seen.add(path);const node=parse(path);
   const packageId=ownerOf(node.key);if(packageId&&packageId!==owner)importedPackages.add(packageId);
   needs.push(...node.needs.map(n=>({...n,sourcePath:path})));for(const id of node.availability)available.add(id);
   for(const edge of node.imports){const id=ownerOf(slash(relative(root,edge.path)));if(id&&id!==owner)needs.push({id,kind:edge.static?'static-import':'dynamic-import',source:node.key,site:slash(relative(root,edge.path))});visit(edge.path);}
  }visit(resolve(root,file));
  const helperCalls=[...seen].flatMap(p=>parse(p).helperCalls);
  const activeNeeds=needs.filter(n=>{
   if(!n.activation||n.source===file)return true;
   const callers=helperCalls.filter(c=>c.target===n.sourcePath&&c.name===n.activation.function);
   if(!callers.length)return false;
   return callers.some(c=>{const value=n.activation.index<c.args.length?c.args[n.activation.index]:n.activation.default;return value===null||value===n.activation.expected;});
  });
  needs.splice(0,needs.length,...activeNeeds);
  const inferred=[...new Set(needs.map(n=>n.id))].filter(id=>id!==owner).sort();
  const declared=declarations.tests[file]??{required:[],optional:[]};
  if(!Array.isArray(declared.required)||!Array.isArray(declared.optional))errors.push(`${file}: declaration must have required/optional arrays`);
  const required=declared.required??[],optional=declared.optional??[],all=[...required,...optional];
  if(new Set(all).size!==all.length||all.some(id=>!known.has(id)))errors.push(`${file}: duplicate or unknown module declaration`);
  for(const id of inferred){if(!all.includes(id))errors.push(`${file}: undeclared module ${id}; ${needs.find(n=>n.id===id)?.source}`);
   if(optional.includes(id)&&(needs.some(n=>n.id===id&&n.kind==='static-import')||!available.has(id)))errors.push(`${file}: ${id} needs required declaration (static import or no installed-package guard)`);
  }
  for(const id of all)if(!inferred.includes(id))errors.push(`${file}: stale declaration ${id} has no observed dependency`);
  const installed=new Set(discovery.modules.map(m=>m.id)),missing=required.filter(id=>!installed.has(id));
  results.push({file,owner:owner??null,inferred,required,optional,missing,needs,available:[...available].sort(),imports:[...seen].map(p=>slash(relative(root,p))).sort()});
 }
 for(const file of Object.keys(declarations.tests))if(!discovery.files.includes(file)&&(!ownerOf(file)||discovery.modules.some(m=>m.id===ownerOf(file))))errors.push(`Stale dependency declaration for ${file}`);
 return {root,files:results,errors,installed:discovery.modules.map(m=>m.id)};
}
/** All discovered files remain members. Missing required dependencies produce a
 * named file-level declaration-group skip before Vite resolves its imports.
 * Normal sources are returned untouched; installed-aware optional branches run. */
export function testDependencyPlugin(analysis) {
 const rows=new Map(analysis.files.map(row=>[resolve(analysis.root,row.file),row]));
 return {name:'declared-test-dependencies',enforce:'pre',load(id){
  const path=id.split('?')[0];const row=rows.get(existsSync(path)?realpathSync(path):resolve(path));if(!row?.missing.length)return null;
  const reason=`Declared test dependencies missing: ${row.missing.join(', ')} (${row.file})`;
  return {code:`import {it} from 'vitest'; console.warn(${JSON.stringify(reason)}); it.skip(${JSON.stringify(reason)},()=>{});`,map:null};
 }};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=analyzeTestDependencies(process.argv[2]??repositoryRoot);console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
}
