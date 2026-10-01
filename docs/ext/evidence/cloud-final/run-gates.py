import datetime, hashlib, json, os, pathlib, subprocess, time
root=pathlib.Path.cwd()
evidence=root.parent/'cloud-extension-evidence'/'final'
evidence.mkdir(parents=True, exist_ok=True)

def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def fingerprint():
    names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z','--','src','scripts','public','package.json','package-lock.json','tsconfig.json','tsconfig.app.json','tsconfig.node.json','vite.config.ts','index.html'],cwd=root).decode().split('\0')
    files={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in sorted(set(names)) if name}
    return {'sha256':hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'files':files}

state={'baseline':'3c1407fcb0b074a7b4dd4879d15eb7c0be346749','handoff':'ed8d270db76e0960a2ec419cae06c3a9c0a1d2da','branch':'ext/foundation','started':utc(),'environment':{'NODE_OPTIONS':'--max-old-space-size=4096','VITEST_MAX_WORKERS':'4','TZ':'UTC','node':subprocess.check_output(['node','--version'],text=True).strip()},'sourceBefore':fingerprint(),'gates':[],'status':'running'}
env=os.environ.copy();env.update({key:value for key,value in state['environment'].items() if key!='node'})
def save():
    (evidence/'state.json').write_text(json.dumps(state,indent=2)+'\n')
save()
for command,output in [('npx vue-tsc -b','vue-tsc.txt'),('npm run build','build.txt'),('npm test','npm-test.txt'),('npm run test:drift','test-drift.txt')]:
    gate={'command':command,'output':output,'started':utc(),'status':'running'}
    state['gates'].append(gate);save();print('START',command,gate['started'],flush=True)
    start=time.monotonic()
    with (evidence/output).open('wb') as log:
        result=subprocess.run(command,shell=True,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
    gate.update(status='completed',exitCode=result.returncode,durationSeconds=round(time.monotonic()-start,2),finished=utc())
    save();print('END',command,'exit='+str(result.returncode),'duration='+str(gate['durationSeconds']),flush=True)
state['sourceAfter']=fingerprint();state['sourceUnchanged']=state['sourceAfter']==state['sourceBefore'];state['finished']=utc();state['status']='passed' if all(g['exitCode']==0 for g in state['gates']) and state['sourceUnchanged'] else 'failed';save()
print('FINAL',state['status'],'sourceUnchanged='+str(state['sourceUnchanged']),flush=True)
