import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=process.argv[2];if(!out)throw Error('Output JSON path required');
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{const {measureLootBalance}=await server.ssrLoadModule('/src/ext/modules/loot/tests/balanceMeasure.ts');const data=await measureLootBalance();await writeFile(path.resolve(out),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({samples:data.samples.length,routes:data.routes,optional:data.optional.map(s=>({modules:s.modules,kill:s.actualKill}))}));}finally{await server.close();}
