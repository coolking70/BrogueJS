# 4d-0 执行报告：复合体有界落脚规划底座

本轮执行 `docs/ext/phase4d.task.md`，基于 `ext/phase4` / `315fd8cb2e570d26f6cc23692f650e19b71005e7`。按任务书“可在干净子里程碑停下并列剩余项”，交付 **4d-0**。**不是完整4d，生产group能力仍关闭。** 未暂存、commit、push；用户原有未跟踪任务书保持原样。

## 范围与能力门

交付原生fixture的核心＋成员平移规划、树约束与连续轨迹验证、预算退化、一次性原子位置发布，以及已有entity/group/whole-run fixture codec的距离约束补强。八腿、多头、链形与17成员场景都不需要ExtensionRuntime或任何正式模块。

`CompositeMovement` 构造只接受 `SpatialCatalog.fixture`。Game的owned实体列表、原生动作/生产codec继续拒绝bodyMember；不能通过保存几何、实例化planner或提交伪造计划获得生产群体能力。没有给Game加字段、增加存档版本、规则随机调用、HP/冷却副本或新的群表。唯一机械群身份仍在 `CreatureSpatial.groups`；planner的WeakMap仅保存一次性计划凭据。

不开放成员退休/再生、身体旋转、局部伤害、实际NPC群调度或正式敌人。活动槽必须generation=0、life=active，尚不接受破坏墓碑。现有fixed-zone、nativeForm、经典/扩展战斗解算器、combat provider和giants内容均未改；另修复下述基线已有的经典射线适配器参数问题。

## 落脚与运动合同

1. 核心先确定一个邻步。按有根约束树、partId字典顺序求成员路径；父成员先于子成员，稳定性不依赖定义数组、群表数组或monsters数组顺序。
2. 成员在当前pose下枚举简单平移路径，最多两步；不穿墙到终点，也不借pose参数免费转身。保留旧落脚优先，然后按新核心＋preferredOffset的切比雪夫距离、路径长、终点y/x、完整路径y/x排序。每次递归最多32候选，整次核心移动尝试最多128个候选分支；可用更低诊断预算，不允许超过上限。
3. 所有路径共用最多两个单位子步；短路径之后驻留。每个子步的实际单位格方块使用相对线性运动的开放区间相交，拒绝腿互换、对角交叉及中途重叠，允许链段以相同速度跟进父段腾出的旧格。格边接触不等于占位重叠。
4. 每条父子约束以实际footprint的最近切比雪夫距离衡量。maxDistance要求每对格子许可时间区间的并集覆盖完整子步；minDistance要求没有格对进入禁止区间。这能捕获端点都合法、最近格对切换却造成中途过度拉伸的U形掩码反例。没有用动画采样代替生产验证。
5. 平移扫掠保守检查目的及两正交中间锚点，包含地图、全部身体格、区域和active-or-reserved外部占位。clearLink静态规则取稳定最近格对的supercover；运动期间要求可能连接的扫掠包围矩形全部无墙。此规则会过度拒绝一些弯道，但不会让连接隔墙穿过。
6. 无支撑资格、核心局部行动锁或移动失能返回immobile；地形/成员/约束无解或预算耗尽返回blocked。所有blocked结果都携正core movementSpeed成本，**调用者尚须在未来生产接线中提交该成本**；本轮不会自动写核心/成员ticksUntilTurn或推进状态/环境。
7. 提交只接受当前planner持有的一次性凭据。先复核群表、实体引用、HP/计时/局部资格、源位移revision、loc引用及可写性、地形/占位revision，重查全部轨迹；再同步发布最终锚点。没有任意环境或模块回调夹在半组位置之间。失败不写任何最终位置，重复提交、伪造克隆计划、离开再回原格、dispose旧会话都被拒绝。

## 共享文件函数级改动

| 文件/函数 | 本轮实改 |
|---|---|
| `Movement/BodyConstraints.ts`（新增） | `bodyConstraintOrder`稳定树序；`clearBodyLink`整数supercover；`bodyConstraintsSatisfied`按实际格对校验距离、父槽存在和clearLink。 |
| `Movement/BodyTrajectory.ts`（新增） | `trajectoriesCollide`连续单位格方块碰撞；`trajectoryConstraintSatisfied`连续牵引许可区间覆盖、最短距离禁止区间与保守连接扫掠。 |
| `Movement/CompositeMovement.ts`（新增） | fixture能力门、cohort/资格校验、最多32候选/128节点的确定回溯、正成本blocked、单次`planStep/commit`；没有Game/TimeCoordinator接线。 |
| `Movement/CreatureSpatial.ts::entityById` | 可信引擎/fixture的实体解析；不暴露给模块context。 |
| `Movement/CreatureSpatial.ts::restoreWorld` | 原有所有权/闭包验证后、发布群表前，增加实际footprint距离与clearLink验证；活孩子不能引用不存在的父槽。坏fixture图不替换旧机械群表。 |
| `Movement/CreatureSpatial.ts::dispose` | 解绑/释放派生服务后递增revision，旧位置计划不得继续发布。 |
| `Core/Game.ts::applyMonsterBoltHit` | 原BE_ATTACK的delivery标记只在有ExtensionRuntime时传递，经典路径恢复原选项对象，扩展射线仍绕过近战体力收费。命中/伤害/符文/状态公式及Combat.ts未改。 |
| `scripts/test-suites.json` | 新增复合体专项和独立射线参数回归的唯一归属；旧守卫/断言未改。 |
| `docs/ext/architecture.md`、`progress.md` | 登记本步边界和继续接线的责任。 |

## 与3a0/3b调度的边界

**没有接通生产actor-action。** `ActorActionScheduler`的核心owner、sourceEntityId/sourcePartId、≤4子动作、min边界/max耗时合同和TimeCoordinator原三处遍历保持原样。planner只给路径与正costTicks；运动的两个几何子步不引入另一份规则倒计时。

后续4d须把群核心映射为唯一decision/time owner，成员作为真实来源；成员generation还要进入来源验证/取消合同。即时攻击束或phased招式必须在可信actor-action会话内冻结来源、逐成员独立scope/冷却，收束后核心只提交一次max耗时。成员破坏、位移、变形或移层必须取消相应待段；不得从planner内调用成员takeTurn/endTurnWithAttack/playerTurnEnded或嵌套executeCommand。本轮只运行现有3a0/3b/3c相关回归，不把它们通过称为复合体组合已实现。

## 数据、验收入口与性能

fixture数据位于 `src/test/support/compositeScene.ts`：2×2核心＋8条1×1腿、3个头、1×1核心＋5段链、核心＋16外围成员。声明复用既有BodyDefinition/BodyGroupState/SpatialCatalog，不改原生怪物目录或giants规则指纹。首个八腿完整轨迹有显式坐标期望；链的连续四次动作逐实体断言向东一格；其余轨迹同时用独立密集时间采样验证连续碰撞/距离。单格几何另枚举2025组相对位置和单位速度，与独立33时点采样逐组对照。

没有新增正式敌人、场地、自然种子或自然复合体录像。旧seed7306/7309等仍是4a–4c内容的验收回归，不能充当本步自然复合体证明。

性能测的是17成员**fixture plan＋成功时commit**，不含建场/序列化/断言，不是executeCommand、NPC追击帧率或手机性能。20次定向尝试中15次成功、5次触及128预算后blocked，成员最多两步；这些blocked保留为有界算法的真实限制，没有改预算或把成功样本拼成全身可达结论。

最终同一冻结候选冷次 **1.803ms**，其余19次成功/blocked混合暖样本 **P50 1.569ms / P95 3.428ms**，最大分支128。Node24.19.0、两个worker的功能测试环境；只是这一小型诊断场景，不能替代真实Game17成员追击每命令测试。完整20次数据在 `/private/tmp/p4d-final-v4-performance.json`。

## 实际测试与结果

运行环境Node24.19.0（PATH前置任务指定runtime）、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。按本步开发期功能政策，不跑完整npm test / 全部test:ext / removal / CE full/gen。

开发首个候选 **3文件/83项全部通过**；新专项当时31项，覆盖上述几何、128节点退化、无机械随机/ID/时钟消耗、活动/休眠外部占位、腿隔墙、旧loc引用、单次计划、源离开再回、群共享、会话退休、引擎谓词变化、实体/群表fixture存读、whole-run坏牵引拒绝和生产能力门。首轮失败是新测试误用不存在的rng.getCallCounts、只读数组reverse类型、外部障碍布景落在旧腿格、以及误要求17成员有限回溯永不blocked；已修测试布景和记录真实算法限制，**没有修改任何旧测试、预算、断言容差或新增skip**。RNG的现有getState本就包含两流和两计数。

冻结复核时发现原地保留成员可能在非法地形/区域上仍得到planned、到commit才被拒绝；新增1项先红回归精确复现。补全起始整组fit检查后，新专项 **32/32项通过**，无位立即给正成本blocked。第一轮门禁在related期间主动中断，runner exit130，已完成的boundary/type/build各exit0；未运行后续smoke/drift，未把它算作相关集合通过。原证据 `/private/tmp/p4d-final-*` 与 `p4d-standing-terrain-{red,green}.log` 保留；最终候选改用独立 `p4d-final-v2-*` 全链重跑。

v2相关集合实际为 **71文件通过/1失败、1482项通过/2失败，450.12s，exit1**；后续smoke/drift未进入。两失败来自未改的 `w_4_bolt_reflection`：期待经典BE_ATTACK只有isWeaponAttack/grid，但合入的3c向所有调用追加了delivery=bolt。**只回退本轮原有唯一共享生产文件CreatureSpatial.ts**，新Movement模块随之不再被生产引用；原W4仍精确2失败/27通过，证明不是4d引入。证据 `p4d-w4-counterfactual.{json,log}`；回退在finally内恢复，无旧测试/断言修订。

按“撞上守卫改代码”修复Game适配器，仅ExtensionRuntime存在时交付扩展delivery标记。新增 `native_bolt_delivery.test.ts` 用真实Game经典/仅combat开局验证两类BE_ATTACK射线：旧生产2红；新生产保留经典原调用形状，扩展NPC体力已耗尽时仍有实际射线伤害、余额仍0，不误判成近战收费。没有去掉扩展分类，也没有删除/放宽旧W4断言。修复后 **4文件/81项全部通过**，含新两项、原W4的29项、3c原生体力18项和复合体32项；日志 `p4d-native-bolt-{red,green}.log`。最终候选使用独立 `p4d-final-v3-*` 重跑全部门禁。

v3在type阶段exit2：新射线夹具误用了不存在的Monster.damage字段，已改为原生damageString；生产字节未改。没有执行build/相关集合/smoke/drift，未算作通过。最终冻结候选为独立 `p4d-final-v4-*`。

**最终v4同一冻结候选全部exit0：**

| 门禁 | 实际结果 | runner耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 边界及唯一测试归属通过 | 1.537s |
| `npx vue-tsc -b` | 通过 | 6.706s |
| `npm run build` | 通过，保留既有大chunk提示 | 9.232s |
| 73文件相关Vitest集合 | **73/73文件、1486/1486项通过，0 skipped/todo**；含新增34项、4a0零影响完整图差分、4a–4c、giants、combat 3a0/3b/3c、UR2/3/4、U03、存档录像与源码守卫 | 410.549s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过，29项因名称筛选未执行；没有跑重型普查 | 1.637s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16组合通过**；真实新局、自然贡献、save/load/replay/seek/续录 | 65.585s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过**，普通两份生成基线与giants三份自然trace | 57.844s |

最终结束UTC **2026-10-05T09:34:00Z**。**883份**生产/测试/脚本/配置输入每项门禁后及最终均无变化；路径排序紧凑JSON散列集合SHA-256 **`1a548898b6219a572438a2077cfd415e2427155db9b2a9821d6c992b483da7bf`**。之后只补报告与progress。旧测试、生成基线和黄金trace均未改、未重录，不存在旧守卫前提修订。LF、git diff --check通过，截图/大体积原始证据未入库。

精确73文件清单 `/private/tmp/p4d-related-files.json`；最终runner `p4d-final-v4-gates.py`，命令/退出码/逐文件前后散列 `p4d-final-v4-gates.json`，原始日志 `p4d-final-v4-*.log`，组合结果 `p4d-final-v4-composition.json`。组合报告engine.status=passed、requestedScopePassed=true；browser=not-run、整体passed=false表示只完成任务指定engine-only范围，不能冒充浏览器产品验收。SSR HMR监听EPERM输出保留；engine-only实际exit0。

## 完整4d剩余项

1. 生产group声明/能力门及原生创建：成员原生数值、statusProfile/breakRule/attack闭包、群表全层codec/写集、批次出生与正式场地的整组路线验算。当前planner仍是fixture入口，移动候选不含旋转或等待后再迈步的路径；实际中间/终态驻留格的环境接触批处理及其异常窄写集也未接入。
2. TimeCoordinator三处核心过滤、真实soonestTurn递减成员冷却；核心移动与≤4即时/phased子段束的互斥选择、max耗时与无合法动作正耗时提交。补真实Game17成员追击每命令性能。
3. 原生受击按part路由、外围1:4截断传核心，不重复命中/RNG/符文/反伤/growth消费；两腿横扫/火球及整体精神scope的实际解算。
4. 唯一破坏收据、remove＋墓碑、抓持/leader/目标/计划入边清理、链子树退休、派生速度/失攻、全部支撑毁后immobile仍可攻击；将4c目前仅self/actorId=groupId的combat.part-break.v1校验扩展到可信成员身份，并一并验证provider或互斥fallback；核心死整体终结/XP一次。
5. 精神/关系群归属及局部毒火缠绕，环境/状态客观块各所有者一次；支配/纷争作用整组，坠落/潜水资格整组校验。
6. 被动polymorph单体↔复合体保核心ID、全组预检/回滚；clone全新ID/深拷贝/无奖励；整组换层/坠落/pending及实际save/load/replay/seek/续录。
7. 成员来源generation的3b招式组合、成员破坏取消待段及恢复时钟验证。
8. 公开核心/成员绘制、独立瞄准/检视、Boss核心HP与成员概况、部分可见裁切、历史帧隔离、320/390像素/触控；原创复合敌人和自然击败验收。

本轮没有新增显示功能，因此没有复合体像素证据，不宣称现有HUD能表达群体。4e主动换形/分裂/召唤、再生、残骸地形和镜像继续不在4d范围内。
