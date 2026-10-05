import assert from 'node:assert/strict';
/** Drives the public tick/command entry with actual swept movement. No world
 * edits, invulnerability, timer shortcuts or private simulation test hooks. */
export function missionPilot(session, grid, { optional = true, raycast, moveCircle, SpatialHash } = {}) {
    let stage = 0, orbit = 0, path = [], pathGoal = '', previousPose = null, stuck = 0;
    const objectives = ['scan-a','scan-b', ...(optional ? ['rescue','sample-a','sample-b'] : []), 'nest-a','nest-b','nest-c','uplink','extraction'];
    const key = (x,y) => y*grid.width+x;
    const pass = (x,y) => grid.getCell(x,y)?.isPassable;
    function route(from, to) {
        const sx=Math.floor(from.x/1024),sy=Math.floor(from.y/1024),tx=Math.floor(to.x/1024),ty=Math.floor(to.y/1024), queue=[[sx,sy]], prior=new Map([[key(sx,sy),null]]);
        for (let i=0;i<queue.length;i++) { const [x,y]=queue[i];if(x===tx&&y===ty)break;
            for(const [dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]) {const nx=x+dx,ny=y+dy,k=key(nx,ny);if(pass(nx,ny)&&!prior.has(k)){prior.set(k,[x,y]);queue.push([nx,ny]);}} }
        assert.ok(prior.has(key(tx,ty)), 'Mission site must have an actual route');
        const result=[];let at=[tx,ty];while(prior.get(key(...at))){result.push({x:(at[0]+.5)*1024,y:(at[1]+.5)*1024});at=prior.get(key(...at));}return result.reverse();
    }
    return state => {
        const tick=state.tick+1, p=state.actors[0], m=state.mission, commands=[];
        while(stage<objectives.length-1&&m.markers.find(m=>m.id===objectives[stage]).status==='complete'){stage++;pathGoal='';}
        let marker=m.markers.find(m=>m.id===objectives[stage]);
        if(state.damage.actors[0].hp>0&&state.damage.actors[0].hp<45){const supply=m.markers.filter(m=>m.kind==='supply'&&m.status==='ready').sort((a,b)=>Math.hypot(a.pose.x-p.pose.x,a.pose.y-p.pose.y)-Math.hypot(b.pose.x-p.pose.x,b.pose.y-p.pose.y))[0];if(supply)marker=supply;}
        const targetBody=state.actors.find(a=>a.kind==='objective'&&a.pose.x===marker.pose.x&&a.pose.y===marker.pose.y);
        const inside=(p.pose.x-marker.pose.x)**2+(p.pose.y-marker.pose.y)**2<=marker.radius**2;
        if (m.nearby===marker.id) commands.push({tick,kind:'interact'});
        let goal={...marker.pose};
        if(marker.kind==='nest')goal={x:marker.pose.x-1500,y:marker.pose.y};
        if(marker.status==='active'&&marker.kind!=='nest'&&marker.kind!=='extraction'){
            const radius=marker.kind==='uplink'?2048:marker.kind==='rescue'?2048:4096;
            const offsets=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
            const o=offsets[orbit%8];goal={x:marker.pose.x+o[0]*radius,y:marker.pose.y+o[1]*radius};
            if((p.pose.x-goal.x)**2+(p.pose.y-goal.y)**2<500**2){orbit++;pathGoal='';}
        }
        if(marker.kind==='extraction'&&inside){
            const o=[[1,0],[0,1],[-1,0],[0,-1]][orbit%4];goal={x:marker.pose.x+o[0]*2048,y:marker.pose.y+o[1]*2048};
            if((p.pose.x-goal.x)**2+(p.pose.y-goal.y)**2<500**2){orbit++;pathGoal='';}
        }
        if(marker.kind==='nest'&&state.ranged&&targetBody&&state.damage.actors[targetBody.id-1].hp>0){
            const o=[[1,0],[0,1],[-1,0],[0,-1]][orbit%4];goal={x:marker.pose.x+o[0]*3072,y:marker.pose.y+o[1]*3072};
            if((p.pose.x-goal.x)**2+(p.pose.y-goal.y)**2<500**2){orbit++;pathGoal='';}
        }
        const goalKey=key(Math.floor(goal.x/1024),Math.floor(goal.y/1024));
        if(pathGoal!==goalKey||stuck>15||path[0]&&Math.hypot(p.pose.x-path[0].x,p.pose.y-path[0].y)>2048){path=route(p.pose,goal);pathGoal=goalKey;stuck=0;}
        while(path.length&&(p.pose.x-path[0].x)**2+(p.pose.y-path[0].y)**2<300**2)path.shift();
        const next=path[0]??goal, dx=next.x-p.pose.x,dy=next.y-p.pose.y,longest=Math.max(1,Math.abs(dx),Math.abs(dy));
        let moveX=Math.abs(dx)+Math.abs(dy)<80?0:Math.trunc(dx*127/longest),moveY=Math.abs(dx)+Math.abs(dy)<80?0:Math.trunc(dy*127/longest);
        if(marker.kind==='nest'&&!state.ranged&&inside){moveX=0;moveY=0;}
        if(moveCircle&&SpatialHash&&state.population&&state.damage.actors[0].hp>0){
            const hash=new SpatialHash();state.actors.filter(a=>state.damage.actors[a.id-1].hp>0).forEach(a=>hash.upsert(a));
            const enemies=state.actors.filter(a=>!['player','objective'].includes(a.kind)&&state.damage.actors[a.id-1].hp>0);
            const desired={x:moveX,y:moveY},vectors=[[desired.x,desired.y],[127,0],[90,90],[0,127],[-90,90],[-127,0],[-90,-90],[0,-127],[90,-90]];
            const score=v=>{
                const length=Math.max(1,Math.hypot(...v)),q=moveCircle({grid,bodies:hash},p.pose,p.radius,{x:Math.round(v[0]/length*160),y:Math.round(v[1]/length*160)},1);
                if(Math.hypot(q.x-p.pose.x,q.y-p.pose.y)<60)return -1e6;
                let s=(v[0]*desired.x+v[1]*desired.y)/length/127*4;
                for(const a of enemies){const dist=Math.hypot(q.x-a.pose.x,q.y-a.pose.y)-p.radius-a.radius;if(dist<1800)s-=(1800-dist)/80;}
                for(const warning of state.population.telegraphs){const dist=Math.hypot(q.x-warning.center.x,q.y-warning.center.y)-p.radius;if(dist<warning.radius+300)s-=(warning.radius+300-dist)/10;}
                for(const warning of state.support?.deployments.filter(d=>d.slot===2&&d.phase==='inbound')??[]){const dist=Math.hypot(q.x-warning.pose.x,q.y-warning.pose.y)-p.radius;if(dist<warning.radius+500)s-=(warning.radius+500-dist)/10;}
                // Keep the capture/boarding circle when there is room to dodge.
                if(marker.status==='active'&&marker.kind!=='nest'&&Math.hypot(q.x-marker.pose.x,q.y-marker.pose.y)>marker.radius-200)s-=20;
                return s;
            };
            const scored=vectors.map(v=>({v,score:score(v)})).sort((a,b)=>b.score-a.score);[moveX,moveY]=scored[0].v;
        }
        const alive=state.actors.slice(1).filter(a=>state.damage.actors[a.id-1].hp>0&&(!raycast||!raycast({grid},p.pose,{x:a.pose.x-p.pose.x,y:a.pose.y-p.pose.y}))&&(a.kind!=='objective'||marker.kind==='nest'&&a===targetBody));
        alive.sort((a,b)=>(a.pose.x-p.pose.x)**2+(a.pose.y-p.pose.y)**2-((b.pose.x-p.pose.x)**2+(b.pose.y-p.pose.y)**2));
        const target=alive[0]&&alive[0].kind!=='objective'&&(alive[0].pose.x-p.pose.x)**2+(alive[0].pose.y-p.pose.y)**2<2000**2?alive[0]:marker.kind==='nest'&&targetBody&&state.damage.actors[targetBody.id-1].hp>0?targetBody:alive[0];
        const aimAngle=target?(Math.round(Math.atan2(target.pose.y-p.pose.y,target.pose.x-p.pose.x)*4096/(Math.PI*2))+4096)%4096:0;
        if(state.ranged){const rifle=state.ranged.weapons[1];if(!rifle.selected)commands.push({tick,kind:'equip',slot:1});if(rifle.ammo===0&&!state.ranged.reloadRemaining)commands.push({tick,kind:'reload'});}
        if(previousPose&&Math.abs(p.pose.x-previousPose.x)+Math.abs(p.pose.y-previousPose.y)<5&&(moveX||moveY))stuck++;else stuck=0;previousPose={...p.pose};
        return { frame:{tick,moveX,moveY,aimAngle,buttons:state.ranged&&target?1:0},commands };
    };
}
