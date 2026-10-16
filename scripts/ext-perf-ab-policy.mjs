import assert from 'node:assert/strict';

export function parseOptions(args) {
 const options={rounds:3,cases:['classic','all'],limit:0};
 const seen=new Set();
 for(let i=0;i<args.length;i+=2){
  const key=args[i];assert.ok(['--base','--head','--out','--rounds','--case','--limit'].includes(key)&&!seen.has(key),`Unknown/duplicate option ${key}`);
  seen.add(key);assert.ok(args[i+1]&&!args[i+1].startsWith('--'),`Missing ${key}`);
  if(key==='--case'){assert.ok(['classic','all','both'].includes(args[i+1]));options.cases=args[i+1]==='both'?['classic','all']:[args[i+1]];}
  else options[key.slice(2)]=['--rounds','--limit'].includes(key)?Number(args[i+1]):args[i+1];
 }
 assert.ok(options.base&&options.head&&options.out,'Expected --base --head --out');
 assert.ok(Number.isSafeInteger(options.rounds)&&options.rounds>=1&&options.rounds<=3,'rounds must be 1..3; only 3 can pass D6');
 assert.ok(Number.isSafeInteger(options.limit)&&options.limit>=0&&options.limit<=1714,'limit must be 0..1714 (0 = complete)');
 return options;
}

export function counts(summary,metrics) {
 assert.ok(Object.keys(summary.segments).every(k=>metrics.includes(k)),'Unknown counter');
 return Object.fromEntries(metrics.map(k=>{
  const n=summary.segments[k]?.calls??0;assert.ok(Number.isSafeInteger(n)&&n>=0,`Invalid count ${k}`);return [k,n];
 }));
}

export function validateRun(s,{recordingHash,events,metrics,previous}) {
 assert.equal(s.mode,'wall');assert.equal(s.oos,0);assert.equal(s.recordingHash,recordingHash);assert.equal(s.events,events);
 assert.equal(s.command.n,events);assert.ok(s.semantic&&Object.keys(s.semantic).length>0);
 for(const v of [s.elapsed,...['p50','p95','max'].map(k=>s.command[k])])assert.ok(Number.isFinite(v)&&v>=0,'Invalid timing');
 const work=counts(s,metrics);
 if(previous){
  for(const k of ['node','machine','sourceHash','semantic','diagnostics'])assert.deepEqual(s[k],previous[k],`Unstable ${k}`);
  assert.deepEqual(work,counts(previous,metrics),'Unstable work counts');
 }
 return work;
}

// All values are milliseconds, including elapsed. Strict > retains the 1ms band.
export function compareTiming(a,b,{complete=true}={}) {
 const scenes=['command','round',...(complete?['depth.20','roundDepth.20']:[])];
 const values=[];
 for(const scene of scenes){
  const get=s=>scene.split('.').reduce((v,k)=>v?.[k],s);
  for(const [metric,fraction]of [['p95',.1],['max',.25]])values.push({metric:`${scene}.${metric}`,a:get(a)?.[metric],b:get(b)?.[metric],fraction});
 }
 values.push({metric:'elapsed',a:a.elapsed,b:b.elapsed,fraction:.1});
 return values.map(v=>{
  assert.ok(Number.isFinite(v.a)&&v.a>=0&&Number.isFinite(v.b)&&v.b>=0,`Missing/invalid ${v.metric}`);
  const threshold=v.a+Math.max(1,v.a*v.fraction);
  return {...v,delta:v.b-v.a,relative:v.a===0?null:v.b/v.a-1,threshold,exceeded:v.b>threshold};
 });
}

export function decide(pairs) {
 assert.ok(pairs.length>=1&&pairs.length<=3);
 const exceededRounds=pairs.filter(p=>p.some(v=>v.exceeded)).length;
 return {exceededRounds,status:exceededRounds>=2?'regression':pairs.length===3?'pass':'incomplete'};
}

export function canFreeze({options,gates,hard}) {
 return hard==='pass'&&options.rounds===3&&options.limit===0&&options.cases.join(',')==='classic,all'
  &&gates.length===3&&gates.every(g=>g.status==='pass');
}
