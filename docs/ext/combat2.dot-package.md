# combat2 dot 任务包：第二批原创招式与预警形态（整包一次派发）

> 2026-10-11。代码基线 `59b9ba691daf66819eeea0299a0539f3641ad208`，起草时 `ext/combat2-base` 与 `origin/ext/phase5` 相同；派发分支只追加本文件。交付 **5 种新招式、5 种预警节奏、5 个原生物种绑定、玩家八招选择及现有弹反的手动反击衔接**。只扩充 combat 内容和自有 UI，复用冻结接口。
>
> §12 的取舍是预先给定、待维护者签认的决定，尚非逐条获批。维护者转贴 §0 即按此执行，dot 不再逐项询问。格式参考 narrative2/giants2；不继承旧包的基线、workers或“以后5Z兜底”口径。5Z已结束，本次未运行的集成项交维护者另排。

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型的 combat2 执行者。按 docs/ext/combat2.dot-package.md 一次长块独立完成第二批五种原创招式、预警/招式栏、自有测试、自然 trace、配置手册与报告。期间不要向维护者提问；未定细节按 §12 裁决并记录。

git fetch origin
git switch -c ext/combat2 origin/ext/combat2-base
开工确认工作树干净，git diff --name-only 59b9ba691daf66819eeea0299a0539f3641ad208 HEAD 只列 docs/ext/combat2.dot-package.md，记录实际派发 tip。已有工作分支先核对祖先和未提交改动，不重置或覆盖。

先读 AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、docs/ext/README.md，再完整读本包、phase3-combat.md、combat-config.md 与 combat 源码。实际冻结执行路径优先于旧设计提案；§A只是派发前预检，不替代最终验收。

硬规则：
1. 只写 src/ext/modules/combat/**、docs/ext/combat-config.md、docs/ext/combat2.report.md；本任务包、共享文件、其他模块及协议不可改。
2. 按 §3 原表和装配器精确追加五招，保留旧三招/四profile/三绑定。玩家改用八招新profile；五个新NPC各单招。数值固定，不为过测调参。
3. 突进型采用原地逐段延伸，远程型采用远格原生物理；不位移、不发弹、不耗弹药。弹反沿既有窗口，反击另发付费招式，无自动反击/新姿态状态。UI必须说明这些边界。
4. combat module/rules1.6.0、pack1/state4、foundation13、whole-run6/recording4/origin2及所有SDK保持；机械内容由现有fingerprint换身份，旧输入拒绝、不迁移。
5. 自有单元、真实Game、五招自然命中与新NPC自然出招、存读/回放/非单调seek/续录、九相关组合按 §7–9完成。只删combat执行精确--plan，实际删除及全量集成交维护者另排。
6. Node24.19.0放PATH前，NODE_OPTIONS=--max-old-space-size=3072，Vitest --maxWorkers=1；串行执行，不触碰 BrogueJS-p5，不跑完整npm test/全部test:ext/128组合/实际删除矩阵。
7. 越白名单才能解决的子项留最小复现，继续其他工作并报部分完成；不削弱守卫、改共享基线、加skip/todo或伪造自然证据。最多两轮审查→修复，不自动发起第三轮。

按 §10交付；先确认门禁结果，再显式提交白名单并只 git push -u origin ext/combat2。不得推base/phase5/foundation/main，不merge/rebase/tag。每次提交信息末尾加 Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>。推送失败如实报告，不用其他方式写远端。最终回 §10.3 的≤30行中文回执。
```

## A 派发前核对与实测（起草方执行；dot 作背景阅读）

### A.1 基线、环境与方法

起始工作树干净；HEAD与本地origin/ext/phase5均为上述基线。Node目录 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实测v24.19.0；3GiB堆、单worker。未进入或操作 BrogueJS-p5。临时副本 `/private/tmp/combat2-dispatch/tree` 来自本树HEAD的git archive，依赖逐包链接、Vite缓存独立；只在该副本装配内容并登记临时probe。原仓库源码、数据、测试、脚本不变，本次只提交本文。

原树`git add`实际exit128：公共Git目录位于兄弟工作树，沙箱拒绝创建index.lock。发布使用 `/private/tmp/combat2-dispatch/publish` 的独立Git副本、同名ext/combat2-base与同基线，仅提交本文；不修改原Git元数据。只执行原origin URL的 `git push -u origin HEAD`，结果以本次最终回执为准，推送失败不改用API或网页。

从本文 `combat2-content` 与 `combat2-compiler` 标记块直接提取并执行，所得完整包送入真实 `loadCombatPack`、正式工厂及真实Game新局。禁止用手抄缩减JSON或另写宽松校验器代替。

### A.2 真实接口审计

| 入口 | 当前事实与本包约束 |
| --- | --- |
| `combat/schema.ts`、`types.ts` | 严格schema1、module/rules精确1.6.0，唯一shape为footprint-offset-union，唯一damageProfile为native-melee；无伤害倍率/投射物/位移/姿态字段。 |
| `module.ts`、`production.ts` | data-only actorActions声明；正式state4 ledger，时钟与ID高水位在run.actorActions。早期planner/components/state的schema1是fixture，不能用来增设生产状态。 |
| `PhasedAttackProduction.ts` | 玩家profile；NPC先body声明profile，再nativeProfiles；按attackIds次序选首个可付且首段覆盖目标的招式。生存、施法、尸体学习等优先级保持；不是随机选技，也不能配置权重。 |
| 预警 | 每段开始冻结world cells，后一段单独正delay；作用线/预算/排除自身由底座。显示帧有来源、阶段、parryable、remainingTicks，无公开attackId/dodgeable字段。HUD不能猜招式名、读取秘密动作补字段。 |
| 资源/防御 | 现有统一付款、定点恢复、一次确定弹反与硬直；一格dodge仍有限形状白名单。没有“防御成功自动放技”。 |
| giants | 当前9 forms/6 templates/2 bodies；织体核心/腿声明旧shock-ring/fan-edge；新铜须成员未声明combat专属profile。不能修改giants让其凭空学新招。 |
| growth | 当前Stat管线和原生动作双资源事务；旧growth.combat-stats.v1 helper不是当前生产provider。 |
| 测试/删除 | 自有test-suites登记；现有combat_combinations发现64个含combat子集，本任务不整文件执行该重矩阵；只删combat的共享plan实际展开剩余全开/全关两个端点。 |
| 身份 | foundation13、whole-run6、recording4、origin2、world5 schema4；七模块已安装。combat version1.6.0/state4；本次均保持。 |

### A.3 本轮实际结果

<!-- combat2-dispatch-results -->
本轮窄预检实际完成（2026-10-11），没有继承历史报告的通过数：

| 项目 / 命令 | 实际结果 |
| --- | --- |
| 从本文提取§3.3/3.4，`node /private/tmp/combat2-dispatch/audit-document.mjs` | exit0；编译完整包、旧前缀与资源/篝火/防御深等；8 attacks/10 profiles/8 nativeProfiles。内容块SHA-256=`5664b7c036c4084b2d6f46ae925b02a7f8733b698ee9cf239dc2aa71a8805c20`；编译器块=`4f15ddec00980102cf7eafedd63b2135cc44959d68b5bc7b03b62e4a9b7ebc2e`。 |
| 副本 `npx vitest run src/ext/modules/combat/tests/combat2_dispatch_probe.test.ts --maxWorkers=1` | exit0，1文件3项通过，0失败/skip/todo；21.11s（测试19.27s）。仅临时probe在副本登记，无生产代码修改。 |
| 真实schema/工厂/生产身份 | loadCombatPack、loadCombatDefinitionPack、createCombatModuleFromPack接受完整包，初始state通过正式验证，descriptor.rules=工厂.rules；8个物种ID均在原生目录。加未支持damage字段的负例被拒。 |
| 最终机械身份 | schema1/version1.6.0；fingerprint=`sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae`。 |
| 真实新局 combat-only | seed8201/wizard；公开模块view有10动作。依§3顺序向e各发一次新招；5事件，nextActionId=6；录像JSON字符串长度6924 UTF-16单元。save/load完整规范机械末态及双RNG相同。 |
| 真实新局 七模块全开 | 同seed/mode，通过catalog取得各initialCommand；6事件（含1初始命令）、nextActionId=6，录像JSON字符串长度8956 UTF-16单元；10动作、五新招命令全部接受，save/load完整末态及双RNG相同。 |
| 两新局回放与seek | 逐事件replay，每个新招结束与原捕获完整规范快照精确相等；末→0→第2招后→第1招后→末非单调seek，检查游标/error和已捕获切点；0点只核游标/error，不冒称初始完整快照对等。全部0 OOS。 |
| 两新局存档续录 | 真save加载后公开wait，分别6/7事件；续录导出从原新局逐条重放，完整规范末态相同、0 OOS。未手改manifest或recordingOrigin。 |
| 原树 `node scripts/check-module-boundaries.mjs` | exit0，Module boundaries and test ownership verified。 |
| 原树§8.4精确removal --plan | exit0；安装7模块，恰1删除计划，只删combat/其余六保留；展开smoke为`--combinations endpoints`，normal full required/not-run。未实际删除或执行两个端点。 |

文档静态检查：§0/§A/§1–12齐全、JSON可解析、两个标记块散列复核一致、回执19行、LF；删除plan精确一行核对通过。

两新局未布景、未改HP/位置/资源/RNG；新招可挥空，本probe没有断言自然命中、NPC选招或平衡。快照只归一化savedAt=0，未删其他世界字段；replay比较的是toSnapshot完整机械投影，不是录像buffer自身。副本无CE缓存，Vitest提示CE依赖用例会skip；本probe无CE用例，实际skip=0，未下载CE。没有失败重跑或换seed消错。临时输入/编译器/期望/probe/结果/日志位于 `/private/tmp/combat2-dispatch/`，不提交。
<!-- /combat2-dispatch-results -->

### A.4 证据界限

§A只证明内嵌数据可安装和所列公开命令真实运行，不代替dot的自然战斗、五NPC出招、全部相位持久化、UI与组合验收。没有实现本包UI，没有跑完整npm/test:ext、128组合或实际删除，不引用旧5Z通过数。本次临时probe/日志不提交，远端只需本文与已存在的测试入口即可重建。

## 1 目标与范围

五招以“蓄力压迫、前后扫荡、逐格推进、远格压制、短促反击”为读招主题，名称与说明原创。新技能依然使用当前武器/生物的原生命中和伤害，区别由预警形状、费用、韧性冲击、阶段节奏构成。

本批恰5个新AttackDefinition，不将旧弹反计为第六招；“重击”指高韧性冲击，没有额外HP倍率。“突进型”是危险格延伸，施法者不移动；“远程型”是隔一格的物理落点，非投掷物。反击是可独立使用的短前摇招式，可在弹反恢复后手动选，不保证敌人仍硬直或一定命中。需要真正冲锋、投掷物、格挡姿态或自动反击时另开底座任务；本包不允许dot临时补协议。

无新美术、地图层、怪物种类、物品/弹药、解锁技能树、额外XP/掉落、篝火规则、主动AI策略或临时效果。玩家开局可用全部八招，NPC同资源同规则，保留原生特殊效果。

## 2 基线、白名单、版本与兼容

- 派发 `ext/combat2-base`；实施/唯一远端目标 `ext/combat2`。确认派发tip只比代码基线多本文，不合并正在推进的phase5或其他内容分支。
- 写入只限 `src/ext/modules/combat/**`、`docs/ext/combat-config.md`、`docs/ext/combat2.report.md`。新测试/helper/紧凑trace/UI静态文案表必须在combat目录；本文只读，不改README/HANDOFF/共享测试登记。
- module/rules/COMBAT_VERSION=1.6.0、pack.schema1、production state4、全部底座/SDK/录像协议与其他模块版本不变。新增内容自然改变canonical fingerprint；descriptor身份和模块工厂身份严格相等。
- 原三招、四profile、三nativeProfiles及资源/dodge/parry/篝火整个对象原值原序保留；追加五招、六profile、五nativeProfiles，只有playerProfileId从fixture.profile改为combat.second-profile。旧fixture.profile仍为原三招，不能顺手重命名。
- 改指纹后旧combat存档/录像直接拒绝，不迁移，不假造manifest或指纹。实施前用真实旧包捕获一份save/recording作负例；拒绝发生在退休live Game前。无combat存档按自身manifest读入，不受combat内容身份变化牵连。

## 3 权威数值、形状与内嵌装配

### 3.1 完整数值表

单位为引擎tick，非毫秒。释放时刻相对招式开始。HP每个真实接触均由native-melee求值，无自设固定伤害/倍率；每段按part/zone去重，不按格子重复打同一part。

| ID后缀 / 名称 | 体力 | 前摇 | 各段delay | 各段释放时刻 | 恢复 / 总长 | 每段poise | parryable / dodgeable | 形状 |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| anchor-break / 沉锚击 | 8 | 140 | 0 | 140 | 90 / 230 | 8 | false / true | 前扇3格＋正前2格处1格 |
| returning-sweep / 回潮扫 | 7 | 100 | 0,80 | 100,180 | 70 / 250 | 3,3 | true,true / true,true | 前扇3格→后扇3格 |
| advancing-point / 逐隙刺 | 6 | 80 | 0,60,60 | 80,140,200 | 60 / 260 | 2,2,3 | true,true,true / true,true,true | 正前1格→2格→3格，每段仅一格 |
| cast-echo / 掷影击 | 5 | 120 | 0 | 120 | 80 / 200 | 2 | false / true | 正前2、3格，同时；1格处为空 |
| answering-edge / 应隙斩 | 3 | 30 | 0 | 30 | 50 / 80 | 3 | true / true | 正前1格 |

每招 `interruptPolicy=cancel-pending`；每段 `locationPolicy=locked-world,targetPolicy=part,damageProfile=native-melee,friendlyFire=false`；每shape `kind=footprint-offset-union,selfExclusion=whole-group,occlusion=line-of-effect`。这些列是完整规则，不另设hidden cooldown、crit、knockback、stun、invulnerability或方向追踪。

全部沿用fixture.resources：体力容量/初始24/24，恢复1/20tick、延迟40、相位idle/recovery/break-recovery；nativeAttackCost2；poise容量12、恢复1/30tick、延迟40、破防结束12、nativePoiseDamage2、immune=false；breakRecovery50。dodge为cost4/window40/recovery80；parry为cost3/window60/recovery100/poiseDamage12/contactRange1。新招不修改这些值。付款仅一次，恢复阶段可回体，不能用末态体力差冒充付款量；如无其他影响，五招单次从满池结束依次20/20/21/23/23。

### 3.2 可用性、NPC和形状边界

| 新profile | attackIds | NPC绑定 | 玩家 |
| --- | --- | --- | --- |
| combat.anchor-break-profile | combat.anchor-break | zombie（原生minDepth5） | 可用 |
| combat.returning-sweep-profile | combat.returning-sweep | goblin（minDepth3） | 可用 |
| combat.advancing-point-profile | combat.advancing-point | jackal（minDepth2） | 可用 |
| combat.cast-echo-profile | combat.cast-echo | monkey（minDepth2） | 可用 |
| combat.answering-edge-profile | combat.answering-edge | toad（minDepth3） | 可用 |
| combat.second-profile | 原三招，再按上表追加五招 | 不另绑定NPC | 新playerProfileId |

全部resourcePolicyId=fixture.resources。minDepth只是原目录信息，实际horde/机器/自然生成以原入口为准，不承诺指定层必出。五个ID已用原生目录核对，未用带下划线的不合法combat绑定ID。旧rat/kobold/ogre绑定保持。非绑定怪沿原生行为且仍受统一原生费用；含bolts/召唤/尸体学习/逃跑等优先路径不被新招夺权。猴子偷窃、蟾蜍致幻、哥布林原生状态等接触效果不能被UI描述为不存在，测试核对实际native语义。

单招profile消除AI首项永久遮蔽。逐隙刺只在**首段1格覆盖目标**时起手，不能因第三段在3格就宣称NPC能从3格发起；掷影击只有2/3格目标可起手，相邻时原生fallback；应隙斩无需先弹反，NPC不会因其名字获得自动反击。回潮扫第二段朝向仍按起手facing取反，先出现后扇预警、再等80tick，不能把两段同时涂成当前危险。

大身体以每个源格+offset求并集/排除whole-group/作用线裁切；近身空带只在单格源理想空地成立，不向巨兽承诺一格安全环。远格攻击可能经过其他生物所在格，但该生物只有处于声明落点才被选；不是“第一碰撞即停止”的射线。墙后、图外、未合法接触不得命中。所有新形状≤4偏移/方向、≤3段，不改1024锁定格/4并行/128总定义等硬预算。

### 3.3 内嵌内容原表

此JSON是完整新增内容的转录源；shape token只由下节离线装配展开，不进生产schema。hint是固定i18n文本，进模块locale。数值/ID/名称/顺序固定；后续可在definitions.json改数值重新验证/换指纹，本轮dot不自行平衡。

<!-- combat2-content -->
```json
[
  {"id":"anchor-break","name":"沉锚击","monster":"zombie","cost":8,"windup":140,"recovery":90,"segments":[{"delay":0,"shape":"heavy","poise":8,"parry":false}],"hint":"蓄力后打击前方扇面与中线远格，造成较高韧性冲击。不可弹反，可闪避；生命伤害沿用原生攻击。"},
  {"id":"returning-sweep","name":"回潮扫","monster":"goblin","cost":7,"windup":100,"recovery":70,"segments":[{"delay":0,"shape":"front","poise":3,"parry":true},{"delay":80,"shape":"back","poise":3,"parry":true}],"hint":"先扫前方，再预警后方并扫回。每段分别锁定地面，两段均可弹反、可闪避；后段不会追踪目标。"},
  {"id":"advancing-point","name":"逐隙刺","monster":"jackal","cost":6,"windup":80,"recovery":60,"segments":[{"delay":0,"shape":"tip1","poise":2,"parry":true},{"delay":60,"shape":"tip2","poise":2,"parry":true},{"delay":60,"shape":"tip3","poise":3,"parry":true}],"hint":"危险格沿起手方向逐段延伸到一、二、三格，使用者留在原地。每段重新预警，均可弹反、可闪避。"},
  {"id":"cast-echo","name":"掷影击","monster":"monkey","cost":5,"windup":120,"recovery":80,"segments":[{"delay":0,"shape":"far","poise":2,"parry":false}],"hint":"打击朝向上的第二、第三格，沿用原生物理接触规则。没有弹体，不消耗弹药，不在第一处生物碰撞停止；不可弹反，可闪避。"},
  {"id":"answering-edge","name":"应隙斩","monster":"toad","cost":3,"windup":30,"recovery":50,"segments":[{"delay":0,"shape":"tip1","poise":3,"parry":true}],"hint":"短前摇打击正前一格，可独立使用，也可在弹反恢复后手动衔接。另付体力，不自动反击，不保证命中；可弹反、可闪避。"}
]
```
<!-- /combat2-content -->

### 3.4 确定装配器（构建时转录，不注册运行时解释器）

输入为基线原JSON、原locale和§3.3数组；输出写回自有definitions/locale。所有八向都是显式整数向量，禁止浮点旋转和四舍五入。保留数组前缀，禁止多次重复追加；dot可保存此工具于combat自有目录，也可仅将输出提交，但最终数据必须与该算法深等。`ui.attack_details`给对话框显示静态时长，值由权威数据求出。

<!-- combat2-compiler -->
```js
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
```
<!-- /combat2-compiler -->

结果应为：1资源策略、8招式、10profile、8nativeProfiles、1篝火，总定义数20；玩家8招＋dodge/parry共10动作按钮，篝火另计。新增机械字段完全落于既有schema；静态hint不塞进AttackDefinition。任何校验失败先核对转录与算法，不放宽校验。

## 4 冻结执行合同与软联动

### 4.1 命令、付款、阶段与中断

沿 `game.executeCommand('ext:command', JSON.stringify({module:'combat',action:'attack',payload:{attackId:'combat.anchor-break',facing:'e'}}))`；dodge/parry沿既有action与仅facing payload。NPC用既有actor scope，不嵌套玩家命令，不新增actorId/targetId/姿态输入。所有确认由Game决策记录，No/陈旧/资源不足不付款、不推进、不分ID、不取RNG。

准备只读；commit一次付全招费用；各段复用native解析，资源和成长效果按既有逐次事件消费。每个段只警告其当前冻结区域，目标离开可挥空；后段的正delay必须真的经过。来源位移/旋转/转换/失能/退休/离层取消待段；已造成伤害不回滚、费用不退。核心死/反伤致死不继续幽灵出招。相位镜像、同tick顺序、环境优先与缓存层冻结均沿底座，不添加模块第二时钟或onTick补偿。

### 4.2 giants 可选组合

仅通过底座足迹、zone/member、body profile声明、真实part-break请求及stat/event入口联动，不import giants源码/JSON/tests。静态表不含giants专名ID。无giants时所有新招可对普通单格目标；有giants时新招可由玩家命中其真实身体，native部位去重、fixed-zone 1:1及外围1:4传导保持。传导不重复普通命中/盾/韧性/growth消费。

原织体的核心/腿仍用已声明的旧profile，不改其内容来使新招“看起来联动”；新铜须成员仍走其已有原生/声明路径。本次生产不承诺巨兽学习新招。新招**作为群成员来源**的合同用combat自有fixture借用底座 `productionComposite` 支撑，合法声明providerProfileId映射到新profile；标诊断，不伪称生产巨兽配置。验证至多4并行、核心唯一决策/计时、每来源付款、束耗时max、局部取消只撤来源、核心破防取消全束。不能把早期设计的“全群共享一池”搬回来。

真实部位破坏继续 `combat.part-break.v1`，handled与fallback互斥，balance loss/core stagger只一次；缺combat保留底座fallback。至少自然对一种现有巨兽用新招造成真实有效命中，群体多部位与破坏另外真实Game诊断精确覆盖。失去成员/形态转换后不展示旧预警，不从旧对象引用追查当前状态。

### 4.3 growth 可选组合

使用已注册combat Stat五键及growth现行statSources；没有growth时基础24/12资源规则完整。含growth时当前容量钳制遵循 `newCurrent=min(oldCurrent,newCapacity)`，提高容量不补满；恢复与nativeAttackCost走既有查询，招式cost仍按本表，不臆造成长折扣。

固定使用 `growth.skill.measured-strike`（专注费2，原生近战，cooldown6按growth现有时钟）。自然联动开局选择skirmisher/human/unaffiliated，human第0选择将agility加1，职业赠予该技能；使用growth原有create-character初始命令替换其默认初始命令，其他模块initialCommands仍由catalog取得。随后公开equip-skills（active仅该ID/passive=[]）、use-skill（target={kind:'creature',id:当前相邻可见敌人ID}），每次从通用readModuleView('growth')取得最新revision，不import growth/view.ts或直接写其state。精确payload可沿已有combat_native_stamina.test.ts的生产命令构造，不用其中fixture-focus或故障注入伪造自然专注。专注与combat原生体力同事务各一次；专注不足、体力不足、No、失效目标都无单边扣费。该技能仍走自身受控native动作，不升级成某个新phased招式。新招触发已有合法逐击/physicalResolved与概率消费语义，不额外发XP；弹反/闪避拦截不伪造positivePhysicalDamage。只通过通用catalog/initialCommand和公开命令建立角色，不import growth实现或硬编码另一模块状态写入。

无narrative消费者时不制造事实队列，有消费者则沿现有combat.event.v1单次事实；不改订阅内容。crafting/foraging/settlement组合只检查自身正常初始化和既有资源/岗位不会被combat破坏，不实现新配方、食物或居民技能。

## 5 i18n、预警HUD与招式栏

- 仅在combat自有locale新增 `ext.combat.*`。五个名称/hint逐字使用§3，说明当前招式可弹反/可闪避与特殊限制；全部新UI字符串包括单位/空值进i18n。名称和hint用模块静态表显式映射，不用未经校验的任意路径读取。
- `CombatAttackBar`继续唯一模块栏，按profile顺序呈现八招＋两防御；桌面和320px手机全部可达。允许横滚/自有折叠分组，默认保留横滚与44px控件，不给共享CommandBar重复塞按钮，不新增全局热键。
- `CombatAttackDialog`选择/确认页显示新招hint、费用与静态前摇/段间隔/恢复/总长；从本包加载后的自有定义取得配置数值，不能复制魔数。允许新增自有纯UI helper；不改共享DTO或world/action协议，不持久化UI选择。原三招也可显示同样时间表，旧弹反/dodge原说明保留。
- `CombatTelegraphHud`用当前公开DisplayFrame的source可见名称/phase/parryable/remainingTicks；保持未知值明确未知。无公开attackId时只显示现有信息，不通过live state补招名、未来段、未见部位或dodgeable。图上新形状自然复用共享绘制器，不改 `src/ui/combatDrawing.ts` 等共享文件。不同预警重叠分别列出，hover无命中时仍有总览。
- 弹反页面增加§3的手动反击提示，不提供“一键弹反并应隙斩”、无免费快捷连招。窗口60tick到0即失效，恢复100tick；成功不等于轮到玩家马上攻击。
- 模态/方向返回/确认/No/双击/长按/held键/失焦/卸载沿DialogHost/DialogInput；onClick只构造已有命令。busy/历史ACK/replay只读与陈旧session/revision拒绝保持，打开/取消/hover/滚动不改tick/任何RNG/ID/资源。

UI验收：1440×900、390×844、320×844 × 普通/沉浸，四种地图模式；至少一组真实当前构建逐个检查10动作可达、长hint不溢出、预警重叠/未知/倒计时/旧ACK和seek。其余组合可组件/截图补充但逐格标验证类别，不以SFC测试冒称浏览器。触摸模拟与真设备分列；工具不可用报缺口，不让引擎功能因此无限停工。截图仓库外，禁止>1MB原始证据入库。

## 6 实施顺序、导入边界与自行裁决

M1转录数据/locale、精确性/schema/身份和工厂测试；M2真实Game/资源/相位/防御/群体/growth/持久化；M3自然trace/相关组合/UI/配置手册/报告。可一段长期独立完成，不等维护者逐步批准，不自动扩到新共享接口。可以重构combat自有显示代码，保持既有状态和输入schema。

生产只导入本模块、现有共享类型/actorActions/validation/fingerprint/stats/partBreak/worldRest与已用UI服务/公开显示类型，第三方Vue/i18next沿现有依赖。不得新建直写引擎世界的生产helper，亦不得动态路径、glob或require绕过另一模块导入禁令。测试可用共享Game/harness/catalog/recordingV4/productionComposite；新增本模块边界测试扫描自身TS/Vue/JSON导入，禁止 `../giants` 等及模块私有路径字符串加载。共享scanner通过并不等于这一契约已经覆盖。

测试选择、文件拆分、纯helper命名、补充UI文案可自定。实际接口与本包冲突时记录条款/预期/实际/最小复现；只能改共享代码才可解决的子项停止实施，继续无依赖部分并报部分完成。不改本包把失败改成成功条件。

## 7 测试合同（全部新增文件登记combat/test-suites.json）

下表为必须覆盖的行为，可合并文件但不能只跑早期纯planner便称生产通过。新增建议 `combat2_content/runtime/persistence/ui/natural/combinations.test.ts`，按真实文件登记；不改共享scripts/test-suites.json。

| 编号 | 自有用例与预言 |
| --- | --- |
| C2-DATA | 原表+装配器与生产JSON精确深等；旧前缀/资源/防御/篝火保持；8/10/8计数、所有八向、20定义、locale完整、真实loader和工厂/descriptor identity一致。负例覆盖未知shape/damageProfile/位移/姿态字段、缺键、重复偏移/ID、坏引用、总时长/预算与非法整数，拒绝不改输入。 |
| C2-SHAPE | 五招×八向，墙/图界/拐角/多格源与目标、whole-group排除、远格近身空带和路径中间生物；独立预期坐标对比当前段lockedCells及真实接触，不拿同一投影函数自比。二/三段未到不得提前命中或展示。 |
| C2-ACT | 每招玩家实际executeCommand与每新NPC实际自由决策/正式prelude；至少一真实命中与一挥空。每源一次费用、下一actionId、各释放时刻、恢复结束、原生HP/盾/状态/消息/RNG；Npc不能同tick另走native双击。明确NPC首段门和远格fallback。 |
| C2-RESOURCE | 五招从满池的预定余额；中途测commit费用一次并区分恢复。余额恰cost/少1、regen余数、零tick菜单、忙态、No/陈旧plan、增长/降低容量；失败全世界/双RNG/ID不变。 |
| C2-DEFENSE | 可/不可弹反段、正确/错误方向、contactRange、窗口剩1与归0、同tick一次消费、成功不取普通命中骰、无免费反击；闪避可躲直接物理但不挡环境。远处逐隙刺虽parryable仍需接触范围，不夸称3格弹反有效。 |
| C2-CANCEL | 前摇/段间来源死亡、被迫位移/旋转/换形、部位退休、失能、离层；取消未命中段/旧预警，已发生损失保留、不退款；目标离开只挥空，反伤致死中止后续接触。 |
| C2-BODY | 真实多格/zone/member接触按part去重与传导一次；新招作为来源的合法fixture最多4子动作/来源付款/核心max时钟，局部破坏与核心破防；provider失败回滚、不转fallback再提交。生产巨兽自然目标另见§8。 |
| C2-GROWTH | 无growth完整可玩；有growth当前Stat映射和容量余额；公开学得/选择原生攻击技能的双资源与效果消费，两侧不足及No均回滚；不额外XP/重复消费。 |
| C2-PERSIST | 正式state4＋run.actorActions的各阶段存读、完整回放/seek/续录；坏锁格/镜像/段索引/profile/旧指纹/缺模块/预算超限拒绝且live不退休。不伪造recordingOrigin。 |
| C2-UI | 10按钮及实际命令、方向/取消/确认、费用/数值/i18n、历史ACK不补未来数据、重叠/未知预警、read-only、无额外键盘监听；所有显示动作零机械变化。 |
| C2-NAT/COMBO | §8自然证据与九行相关组合；任何持久化断言失败不能捕获后换seed消错。 |
| C2-IMPORT | 自有导入白名单与禁另一模块实现、协议版本/源码范围不变；自有fixture不冒充生产声明。 |

诊断布景允许明确标识的arena/HP/计时控制，但不得冒充自然trace或真实新局路径。重放这种布景须使用既有 `installRecordingScene` 同一场景重建入口，并单列为diagnostic；不能删recordingOrigin后宣称续录成功。无布景自然trace必须来自原startNewGame，玩家build仅initialCommands。

自有旧测试只依赖已改变的旧playerProfileId/动作数量或新指纹时，先在临时副本只回退本次生产变更，原测试应通过；恢复后原测试失败，再只修前提并保断言语义/容差/超时，逐条记账。不更改仍有效守卫、不删除/skip整文件。共享失败只能归因报告；共享黄金/trace不重录。自有trace变化按原捕获方法重采，逐字段登记，禁止手改录制manifest/checkpoint。

## 8 自然trace、组合与只删combat计划

### 8.1 自然捕获目标与有界路线

用原生产地图、原目录、真实自然出生，不注入怪、不传送、不改HP/体力/韧性/装备/RNG/AI/计时。mode=wizard可用于深层路线，但它是正式开局模式，不称普通难度平衡通过；另做normal短局，至少一次新招实际命中。动画可关闭，不关闭机械时钟。相同路线录制全部action/data/decisions，确认和ACK分开处理。

交付至少三类紧凑trace，可复用同一条输入的不同检查点，不重复累计：

1. combat-only：五招各至少一次对自然活敌有效物理命中；双段回潮扫和三段逐隙刺须记录每段释放，单格目标不要求站遍不同落点，但不能只挥空冒称全部自然命中。至少一次新招预警被玩家走位躲开；成功弹反一次、恢复后手动应隙斩一次，两次独立付费命令；若对手提前死亡另找自然目标。
2. 五个新物种分别自然出现并由真实NPC选择器发出对应新招，记录birth/typeId/profile/源ID、首次windup/释放与玩家应对。可分五条短trace，至少一条含段间可保存边界；短前摇无安全边界的相位用诊断精确补齐，不强造自然保存点。
3. combat+giants+growth：自然遇到至少一种现有巨兽，玩家新招有效接触；完成一次公开growth原生攻击技能命令并验证资源语义。真实群体至少另有部位破坏/handled；难以在自然同线完成可另用明确诊断，不将单格出生称为群体。

固定搜索顺序seed1…32，必要时33…128一次扩展；到D8为止，每seed最多2500公开命令、单场战斗最多300命令、同位置/深度且无进展64次终止；上限内主动吃食物/装备/安全恢复也必须通过正式命令。按当前可见/已知信息BFS，方向顺序n,e,s,w,ne,se,sw,nw，平局y/x/实体ID稳定；不得看未见怪来预瞄。自然fixture只读完整地图寻楼梯若沿用旧helper，报告明确“引擎路线器可知地形”，不得称玩家可见信息策略。不得读取/写入另一模块私有state作为控制器。

每seed记到达层、目标出生/未遇、命令数、死亡/无路/饥饿/超限等路线原因；遇到load/replay/seek/断言或引擎异常立即保留失败，不能作为普通换seed条件吞掉。穷尽上限仍缺闭环，报部分完成及最接近候选，不改数值/种子表/上限反复挑绿。可以分别找每个NPC和玩家招式种子，不要求一局完成五NPC。

紧凑fixture放combat/data或tests/fixtures，每文件≤1MB；包含seed/mode/modules/initialCommands、真实inputs、关键索引/预警格/命中摘要/机械fingerprint。完整录像、搜索日志和截图仓库外，报告写字节数/总tick/事件数/最终双流/出生证据，不拆大JSON规避上限。

### 8.2 存读、replay、seek与续录

- 切点：0、首次新招前后、可安全保存的NPC windup/inter-segment/recovery、弹反成功后/应隙斩后、巨兽破坏前后、最后事件。每种招式至少一存读切点；缺自然安全边界的阶段另做诊断，不在玩家同步长动作中强行保存。
- 捕获完整规范 `toSnapshot`/机械对象、消息、state4、actorActions、当前与缓存层、nextEntityId、双RNG全状态与调用计数。只按既有约定归一化savedAt等非机械元数据，不删HP/可见性/缓存层/摘要叶掩盖差异。
- 真实 `toSaveSnapshot` → 新Game.loadSnapshot → 继续原后缀，与原末态/原事件前缀精确一致；再执行一新命令，导出带合法recordingOrigin的续录，从原新局完整重放，0 OOS。load不再次付款/释放/给XP。
- `loadReplay`后逐事件 `replayStep(true)`，每条检查error/游标/检查点；末态完整对等。按“末→0→段间或弹反后→早期→末”非单调seek，每点与原捕获相等；事件0不擅自删除initialCommands。
- 至少一真实离层/重访，资源缓存冻结、来源取消/恢复镜像合法、不补离线攻击。保存只在命令/确认/ACK结算安全点。
- 旧指纹输入用实施前真实录制，缺combat负例用真实含新招输入；拒绝保持live player/runtime身份、世界、ID、双流与已有机械消息归档，允许原拒绝反馈显示。不可伪造manifest替代这些输入。

### 8.3 九行相关组合

精确为 `[]`、`[combat]`、combat分别配crafting/foraging/giants/growth/narrative/settlement六行、七模块全开一行。通过通用catalog生成各模块initialCommands；含growth的技能场景按§4.3替换其合法创建选项，其余保持。每行真实新局→公开游玩→save/load→继续→完整replay→seek0/中/末→续录；8个含combat行都执行五新招且至少一新招命中自然敌人，允许共用固定seed，各行如实验证，空挥不代替命中。

无combat行无自有state/view/招式；含giants验证真实几何和部位provider，含growth完成技能双资源，全开同时覆盖。每行记录seed/mode/事件数/身份/结果。另从当前 `combat_combinations.test.ts` 选1个combat-only旧自然场景定向复核，不跑该文件64行全部；新九行不声称128全覆盖。

### 8.4 只删combat：仅计划，精确一行

```bash
node scripts/check-module-removal.mjs --plan --profile=removal --retain=crafting,foraging,giants,growth,narrative,settlement --engine-only --maxWorkers=1
```

计划恰1行，removed=[combat]，retained其余六；normal full=required/not-run。当前脚本删除行smoke显式 `--combinations endpoints`，即剩余全开/全关两端，**不是64子集**。报告核对boundary/types/build/全部剩余test:ext/两端真实Game与缺包档录像拒绝的计划条目，不执行prepare-only或物理删除，不宣称删除通过。

维护者另排实际执行时去掉--plan，追加唯一 `--output=/private/tmp/combat2-removal-<唯一目录>`；需要浏览器去掉--engine-only。副本整个删combat目录、清缓存、不留空壳/宽泛exclude；用本批真实含新招的save/recording验证拒绝，并测无combat的giants原生攻击/part-break fallback、growth技能仍可用。通用缺包样例不替代这两份实际输入。另跑余下子集需额外明确授权，不自动扩矩阵。

## 9 开发期与最终门禁

统一Node24.19.0前置PATH、`NODE_OPTIONS=--max-old-space-size=3072`、单worker；远端可按安装位置定位同版Node，不照抄本机绝对路径。命令在候选根运行，串行，保留首次exit/通过失败skip/todo/耗时；推送与测试分开。不要启动BrogueJS-p5或占用其端口/缓存/日志。

M1：本次C2-DATA/导入测试＋boundary/types；M2：本次核心测试与直接受影响旧测试＋boundary/types/build；M3：自然/九组合/UI与文档。按里程碑执行，不每改一行重复整套。

最终同一候选树一次：

```bash
node scripts/check-module-boundaries.mjs
npx vue-tsc -b
npm run build
# 逐文件列明本次新增测试和下面直接受影响集合；每次均 --maxWorkers=1
# 不用“vitest run src/ext/modules/combat/tests”夹带旧64组合重矩阵
npm run test:drift -- --maxWorkers=1
node scripts/check-module-removal.mjs --plan --profile=removal --retain=crafting,foraging,giants,growth,narrative,settlement --engine-only --maxWorkers=1
git diff --check
```

定向集合最低包括自有 `combat_schema/runtime/display/ui/warning_map/native_stamina/defense_state/parry/parry_ui/parry_advisory/scheduler_due/part_break_runtime/phase4d_body_actions/phase4d_declarations/square_replay` 实际文件，加本次C2全部测试；按阶段已测但候选未受后续更改影响可引用同源结果，记录源身份，不无故再跑。共享直接依赖选现存actorActions/调度/Stat/存读/显示源守卫，至少i18n、hardcoded_text、repo_hygiene、test_suite_membership，用 `rg --files src/test` 定位准确路径再运行，报告逐文件命令。禁止凭通配符未匹配或过滤到0用例称通过。

实际drift一次是新机械指纹/原生战斗路线的兜底；共享基线失败单变量归因交维护者，不改共享黄金文件。生成布局无新增贡献，不运行CE fetch/full/gen，不能隐藏已有CE缓存制造跳过。

**本步不跑**完整npm test、全部test:ext、旧64含combat组合全枚举、128子集、实际删除、全项目性能体积；交维护者另排本次集成门禁，已完成5Z不是未来自动兜底。可记录本次新招实际单命令耗时与最大预警格/目标数（不声称FPS），不得另起并行大批基准。本任务包起草只做§A窄预检，不声称本节实施门禁已完成。

## 10 交付、报告与≤30行回执

### 10.1 `docs/ext/combat2.report.md`

报告必须自包含：完成/部分完成结论；起始代码基线/派发tip/最终提交和环境；相对tip白名单diff；内容8/10/8计数、五招完整数值/八向/可用性与新fingerprint；冻结版本/共享字节未改；C2覆盖对应文件/证据；自然种子搜索摘要/失败及最终trace；存读/replay/seek/续录的完整比对口径；九行组合与删除plan；UI矩阵与真/模拟/未验区分；命令/exit/数量/耗时与首次失败；自有旧前提/trace修改的单变量反事实逐项表；SDK问题最小复现；§12签认与dot新增自行决定；功能缺陷和证据缺口分列；本地接续建议。无证据不写“全绿/全部完成”。

### 10.2 手册与提交

更新combat-config当前八招/十profile/八绑定、完整默认值、八向形状/先后/原生HP语义、玩家/怪物可用性、原地延伸/远格非弹体/手动反击限制、AI首段门、UI、组合、指纹不兼容和测试入口。保留原字段边界/篝火/资源说明，不把未来SDK写成已经可配。

显式git add白名单文件，最终diff/LF检查；可按内容/UI/测试/文档逻辑提交。每次提交末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。先核实门禁，再独立 `git push -u origin ext/combat2`；失败如实说明，不改用API/网页写远端。不推base/phase5/foundation/main，不merge/rebase/tag/deploy。部分完成可交付可复现成果，保留阻断，不称验收通过。

### 10.3 回执模板（19行，不超过30行）

```text
combat2：<完成/部分完成>；五招与预警 <闭环结果>
分支 ext/combat2；最终commit <sha>；报告 docs/ext/combat2.report.md
起始tip <sha>；代码基线 59b9ba691daf66819eeea0299a0539f3641ad208
范围 <仅白名单/异常>；共享/协议 <未改/异常>；fingerprint <值>
内容：8 attacks / 10 profiles / 8 nativeProfiles <核对结果>
五招玩家命中 <结果>；五NPC自然出招 <逐项结果>
原地延伸/远格/手动反击限制 <已说明/缺项>
资源/阶段/弹反/硬直 <结果>；giants群体/growth技能 <结果>
boundary <结果>；types <结果>；build <结果>；diff-check <结果>
本次自有测试 <通过/失败/skip/todo>；直接回归 <数量/结果>；drift <结果>
自然trace <seed/mode/事件数/tick/字节，详见报告>
存读/续录/replay/非单调seek <结果及OOS数>
九相关组合 <通过/9>；只删combat <plan恰1行，未实际删除>
UI <视口/模式结果>；真设备 <有/无>；截图仓库外 <路径>
旧前提/trace修订 <N项及反事实位置>；首次失败 <保留情况>
SDK问题 <N条，最严重一句话>；功能阻断 <列表/无>
待签认 C2-D01…D06 <按包/差异>；dot自行决定 <N条>
未运行 <全量/全部ext/128组合/实际删除及其他证据缺口>
推送 <成功/失败原因>；维护者下一步 <建议>
```

## 11 失败处理与审查上限

仅自有文件可修复；任何共享bug、版本升级、缺SDK、跨模块数据绑定必须报告本地维护者。不要以“旧扩展政策允许调整测试”为由宽化仍有效守卫。首次失败exit1和后续定向exit0分别报告，不累加重叠数，不将重跑替代完整套件状态。

独立审查由维护者另会话或远端既有评审安排，未实际发生就写未执行，不把作者自检称独立审查，也不为等待第三轮无限停工。最多两轮“审查→修复”：R1审查当前交付，作者修复并跑受影响定向；R2只审修复与残余，作者最多再修一轮。第二轮后停止自动审查循环，不发R3；余项按确证功能缺陷/证据形式/集成待验分别登记。最后作者复测不冒称独立审查关闭；维护者裁定合并或另立窄修。没有自然命中、新NPC真实出招或持久化正确性证据时，只能报部分完成，不能一律挪“集成待验”而称功能交付。

## 12 预先给定决定与待维护者签认

| 编号 | 本包已选方案 | 理由与界限 |
| --- | --- | --- |
| C2-D01 | 恰5新招：沉锚击、回潮扫、逐隙刺、掷影击、应隙斩；§3数值/形状固定 | 在现有1–3段动作内覆盖五种读招；重击提高韧性冲击、不加HP倍率。 |
| C2-D02 | 突进型只延伸危险格；远程型为远格native-melee；现有弹反＋另付费手动反击 | 冻结接口没有位移/弹体/自动反击。这是范围取舍，不能宣传成真正冲锋或投掷系统。 |
| C2-D03 | 玩家新八招profile，五NPC各单招，旧三招/四profile/三绑定不变；共享24/12资源 | 不加解锁和AI权重，旧巨兽声明profile保持，NPC可到达性靠自然trace验。 |
| C2-D04 | giants生产联动是作为新招目标和既有provider；群成员发新招用合法自有fixture证明；growth走Stat及原生技能双费用 | 不改别家数据/协议，不承诺新巨兽专属技或growth选择combat招式。 |
| C2-D05 | combat module/rules1.6.0与所有schema/协议不升；用现有canonical fingerprint换身份拒旧输入 | 本次内容扩充遵守冻结协议边界，无迁移；自有hint/UI不进机械状态。 |
| C2-D06 | wizard自然长trace＋normal新招命中、五NPC自然出招、九相关组合；单worker定向门禁，删除仅plan | 与当前串行完整测试隔离；剩余全量/128/真实删除交维护者另排，不假称5Z将自动兜底。 |

这些尚待派发前统一签认，起草与窄实测/文档提交已获授权，不为常规可逆选择停工。未写明细节按“用户范围→真实冻结执行路径→本包固定内容→自有可逆实现选择”裁决。涉及改变上表、共享接口或数值才能完成者记录阻断并继续其余工作；不可自行把五招变成三招或换掉绑定来降低验收难度。
