import {createVitest} from 'vitest/node';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const candidates=fs.globSync('src/**/*.test.ts',{cwd:root}).filter(file=>/\b(?:describe|it|test)\.(?:skip|skipIf|runIf|todo)/.test(fs.readFileSync(path.join(root,file),'utf8')));
const runner=await createVitest('test',{root,watch:false,maxWorkers:4,reporters:[]});
try {
  const result=await runner.collect(candidates);
  if(result.unhandledErrors.length) throw new Error(JSON.stringify(result.unhandledErrors));
  const skipped=[],todo=[];
  function walk(task,file,names=[],inheritedSkip=false) {
    const lineage=[...names,task.name],skip=inheritedSkip||task.mode==='skip';
    if(task.type==='test') {
      const row={file,name:lineage.join(' > '),reason:lineage.some(name=>name.includes('CE reference source not found'))?'missing CE source':'historical explicit skip'};
      if(task.mode==='todo')todo.push({...row,reason:'historical todo'});
      else if(skip)skipped.push(row);
    } else for(const child of task.tasks??[])walk(child,file,lineage,skip);
  }
  for(const file of runner.state.getFiles())for(const task of file.tasks)walk(task,path.relative(root,file.filepath));
  const inventory={method:'Vitest collect only: test bodies were not executed; current unchanged source and absent CE reference',collectedAt:new Date().toISOString(),selectedFiles:candidates,counts:{skipped:skipped.length,missingCe:skipped.filter(x=>x.reason==='missing CE source').length,historicalSkip:skipped.filter(x=>x.reason==='historical explicit skip').length,todo:todo.length},skipped,todo};
  fs.writeFileSync(path.join(root,'docs/ext/evidence/cloud-final/skip-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
  console.log(JSON.stringify(inventory.counts));
} finally {await runner.close();}
