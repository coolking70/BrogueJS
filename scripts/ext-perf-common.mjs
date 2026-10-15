import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export const hash = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
export const write = (path, value) => { mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, JSON.stringify(value,null,2)+'\n'); };
export const stats = values => { const a=values.toSorted((a,b)=>a-b); return {n:a.length,p50:a[Math.floor(a.length/2)]??null,p95:a[Math.ceil(a.length*.95)-1]??null,max:a.at(-1)??null,total:a.reduce((a,b)=>a+b,0)}; };
export async function boot() {
 const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 await server.ssrLoadModule('/src/i18n.ts');
 const {Game}=await server.ssrLoadModule('/src/engine/Core/Game.ts');
 const {logger}=await server.ssrLoadModule('/src/engine/Systems/Logger.ts');
 return {server,Game,logger,load:p=>server.ssrLoadModule('/src/'+p)};
}
export function drain(game) { let n=0; while(game.isAdvancing) { game.tickAdvancement(1000); if(++n>100000) throw Error('Advancement did not settle'); } if(game.lastAdvancementError) throw Error(String(game.lastAdvancementError)); }
