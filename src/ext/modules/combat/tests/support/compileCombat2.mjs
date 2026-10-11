export function compileCombat2(base, baseLocale, rows) {
  const pack = structuredClone(base), locale = structuredClone(baseLocale);
  const dirs = {n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1]};
  const fans = {
    n:[[-1,-1],[0,-1],[1,-1]], ne:[[0,-1],[1,-1],[1,0]],
    e:[[1,-1],[1,0],[1,1]], se:[[1,0],[1,1],[0,1]],
    s:[[1,1],[0,1],[-1,1]], sw:[[0,1],[-1,1],[-1,0]],
    w:[[-1,1],[-1,0],[-1,-1]], nw:[[-1,0],[-1,-1],[0,-1]]
  };
  const opposite = {n:'s',ne:'sw',e:'w',se:'nw',s:'n',sw:'ne',w:'e',nw:'se'};
  if (pack.attacks.length !== 3 || pack.profiles.length !== 4 || pack.nativeProfiles.length !== 3
      || pack.playerProfileId !== 'fixture.profile' || rows.length !== 5) throw Error('Unexpected combat2 base');
  for (const row of rows) {
    const id = `combat.${row.id}`, nameKey = `ext.combat.attack.${row.id}.name`;
    locale[nameKey] = row.name;
    locale[`ext.combat.attack.${row.id}.hint`] = row.hint;
    const segments = row.segments.map(segment => {
      const offsets = Object.fromEntries(Object.entries(dirs).map(([f,[x,y]]) => {
        const times = n => [n*x,n*y];
        let pairs;
        switch (segment.shape) {
          case 'heavy': pairs = [...fans[f],times(2)]; break;
          case 'front': pairs = fans[f]; break;
          case 'back': pairs = fans[opposite[f]]; break;
          case 'tip1': pairs = [times(1)]; break;
          case 'tip2': pairs = [times(2)]; break;
          case 'tip3': pairs = [times(3)]; break;
          case 'far': pairs = [times(2),times(3)]; break;
          default: throw Error('Unknown combat2 shape');
        }
        return [f,pairs.map(([x,y]) => ({x,y}))];
      }));
      return {delayTicks:segment.delay,shape:{kind:'footprint-offset-union',offsets,
        selfExclusion:'whole-group',occlusion:'line-of-effect'},locationPolicy:'locked-world',
        targetPolicy:'part',damageProfile:'native-melee',poiseDamage:segment.poise,
        parryable:segment.parry,dodgeable:true,friendlyFire:false};
    });
    pack.attacks.push({id,nameKey,cost:row.cost,windupTicks:row.windup,recoveryTicks:row.recovery,
      interruptPolicy:'cancel-pending',segments});
    const profileId = `${id}-profile`;
    pack.profiles.push({id:profileId,resourcePolicyId:'fixture.resources',attackIds:[id]});
    pack.nativeProfiles.push({monsterId:row.monster,profileId});
  }
  pack.profiles.push({id:'combat.second-profile',resourcePolicyId:'fixture.resources',
    attackIds:[...base.profiles.find(p => p.id === 'fixture.profile').attackIds,...rows.map(r => `combat.${r.id}`)]});
  pack.playerProfileId = 'combat.second-profile';
  locale['ext.combat.ui.attack_details'] = '前摇 {{windup}} 时间刻 · 段间隔 {{delays}} · 恢复 {{recovery}} 时间刻 · 共 {{total}} 时间刻';
  locale['ext.combat.ui.manual_counter_hint'] = '弹反成功只消耗一次窗口并冲击对方韧性。恢复后可手动选择应隙斩，仍须另付体力。';
  return {pack,locale};
}
