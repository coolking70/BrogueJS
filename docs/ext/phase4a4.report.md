# 4a-4 完整执行报告：giants、原创岩脊兽、侧室与 Boss 血条

日期：2026-10-05。分支 `ext/phase4`，基点/当前 HEAD `eef51e6768405f01bf833392e93955c40a981a95`。维护者已审阅并提交上一子里程碑；本次续轮未 commit、未暂存、未 push。依据 [任务书](phase4a4.task.md) 和设计 r3 §3.4/§9/§10/§11 执行。

## 当前交付

原报告剩余 1–6 已完成，最终开发期功能门禁全部通过，岩脊兽可自然遇到。前一子里程碑的 owned region/movementBounds、持久校验、位移守卫和回滚记录保留在文末历史附录。

| 原剩余项 | 本轮交付 |
|---|---|
| 1 GenerationContribution/侧室 | 冻结有限声明、稳定排序、候选净空、附接挖掘、预留 mask、原生放置排除、最终有界出生复核、skip 收据与完整对象图异常回滚。 |
| 2 原生形态/创建 | owner 限定目录、i18n 解析、经 createSquareMonster 的模块适配器、启用才追加 polymorph 候选、变形前找完整落点、未知/禁用/错形状档拒绝。 |
| 3 giants 包与数据 | 默认关闭、仅依赖 foundation 4；原创 2×2 岩脊兽、场地 JSON、schema/state/validation/locales/UI/tests/suite、机械 rules 指纹。 |
| 4 场地/AI | 实际方形锚点图与玩家绕行图验算；有限守场/追击/回归；支配保留硬边界，换层显示留场原因。 |
| 5 收据/关系/奖励 | placements/bosses/subjects 与原生主体绑定；死亡 defeated、行政退休 lost、坠落 escaped；重访不复生；后裔不新增 Boss；没有额外 XP。 |
| 6 HUD/自然验收 | 公开历史帧的目标优先/最近可见单 Boss 血条；隐藏与历史 HP 专项；自然新局组合、存读/录像/seek/续录、独立 giants trace 与验收种子。 |

## 底座与模块切分

底座只接有限数据，不 import giants。`GenerationContribution` 限制深度、概率、优先级、矩形净空、入口宽度、候选预算、owner 限定 formId 和 `return-to-spawn`；不接任意挖图回调或 AI 脚本。声明进 runtime 时验证/冻结，按 priority、owner、template ID 升序稳定排列。

只有启用贡献的深度会在 room attachment 阶段保留候选岩石净空。基础地形后、非机器 autogen/陷阱/机器前，由 Architect 在岩石中挖侧室和至少三格宽直廊附接既有地板；不把主路房间改成 Boss 房。最小净空 12×10、出生完整身体离四边至少两格；实际 2×2 锚点 flood 必须覆盖全部合法锚点，避开 Boss 的玩家图必须连通。入口、墙圈、走廊与连接邻域用当前尝试的 Grid mask 预留，楼梯、机器、autogen、DF、原生怪物/物品人口均尊重；机器外扩触碰预留则走原事务回滚。

每层全贡献最多一个成功场地，概率通过后才有 placement 尝试；候选耗尽记 no-space，预算耗尽记 budget。概率未命中不创建实例。最终在环境补算、玩家入口和楼层居民恢复后，再验地形并在最多 candidateLimit 个确定锚点内做完整足迹/占位预检；无位写 skip，不分配区域/敌人、不无限重生楼层。成功才在真实 generation token 中安装区域并自然出生，随后释放临时 mask。致命生成/发布异常恢复整个旧世界；贡献开启时还恢复实体和机器编号、双 RNG、账本与消息，重新绑定派生空间服务。

原生形态目录首版限定普通数值与 2/3 方形，血迹/DF 明确为零，不接受任意能力。`createModuleMonster` 纯解析启用目录的 locale，并经原生方形预检与发布；默认 scripted，原生侧室调用显式提供 natural 理由。Monster 自带的原生 HP、位置、状态、关系和 spawnLoc 是唯一机械真相。polymorph 启用时追加目录，抽到大形态后先找完整落点；无位保留已抽样的随机消耗，不改身份/身体/状态、不分配 ID；模块关闭时原 CE 候选范围、顺序与 RNG 保持。snapshot 在旧局退休前拒绝禁用/未知形态、typeId/form.id 不一致及形状不匹配。

守场从区域有限声明和原生 spawnLoc 派生：玩家场内则用原生追击/合法近战，玩家场外则回归出生点，空行动仍花移动耗时。原生混乱、恐惧、关系和资格规则优先；不增加 boss/size 的支配、复制或变形免疫。受支配盟友在石室内沿原生盟友 AI 活动，硬边界不自动解除；楼梯不预约离层，通用阻断事实由 giants 用 locale 显示原因。生存坠落清旧边界并记 escaped，下层沿原生 pending/缓存放置，不造新场地。

`src/ext/modules/giants/` 自有 descriptor/module/schema/types/definitions/state/validation/locales/ui/tests/test-suites。GiantsState 只记场地与 Boss 身份/存活收据，不复制 HP/坐标。首版 subjects 为一个原生主体；克隆是普通后裔，不增加 Boss marker/遇敌/场地收据；原主体变形保原遇敌身份。实际死亡只记一次 defeated，行政退休/失去主体记 lost，击败重访不复生。giants 不注册额外奖励，不硬编码 growth XP，也不依赖成长、叙事或 combat；启用 growth 时，其既有击杀资格与奖励仍自行决定。

公开 `DisplayFrame.actorTags` 只在有声明模块时出现，只投影已公开的实体行并随历史帧冻结。HUD 只取 `ModuleUiHost.readDisplayFrame`，当前 focus/瞄准目标优先，随后最近直接可见 Boss、ID 平局，最多一条；未见、失去直接知识、幻觉或终局隐藏，不回读实时怪物/模块 state。显示不改状态或消费 RNG。流式宽度、名称省略、HP 固定列和 presentationHidden 已实现；实际 320/390 视口由维护者浏览器验收。

没有新增 Game 实例机械字段，U03 契约不用增项；whole-run v3 / foundation 4 包络保持，不做旧档迁移。WeakMap 仅存派生目录绑定、Grid 预留与查询服务，不藏机械收据。底座 fixture 自建 arena-fixture/region-fixture，不导入正式模块；本轮没跑物理 removal，不能将 boundary/禁用组合等同物理删除验收。

## 共享文件函数级改动（续轮）

| 文件 | 函数/接口与目的 |
|---|---|
| `src/ext/generation.ts`、`nativeForms.ts`（新增） | 有限声明/schema、i18n 原生数据解析、派生会话目录绑定。 |
| `src/ext/types.ts` | 模块 nativeForms/generationContributions/publicActorTags；generationPlacement/follow-blocked 事实；ActorFacts 可选 region ID。 |
| `src/ext/runtime.ts` | constructor 校验冻结；nativeForms/generationContributions 查询、排序；reserveGenerationAllocator；attach/dispose/rollback 目录绑定；公开标签与留场事实。 |
| `src/ext/regions.ts` | region 可选 guard 声明；严格空值/非法输入拒绝修正，旧断言未改。 |
| `src/engine/Generator/SideChamber.ts`、`GenerationReservation.ts`（新增） | 纯有限候选、完整锚点/玩家图验算、当前生成尝试 mask。 |
| `src/engine/Generator/Architect.ts` | carveDungeon/attachRooms 候选净空；planSideChambers 的受控写地形、预算、验算；generateTerrain 接入；trap/secret door 排除预留。 |
| `src/engine/Generator/Stairs.ts`、`GenerationPlacement.ts` | 原生楼梯/随从放置资格排除预留。 |
| `src/engine/Generator/BlueprintEngine.ts` | 机器 room/gate 排除、applyBlueprint 外扩触及预留则恢复原地形/实体事务；无 entity runtime 时也恢复预留保护。 |
| `src/engine/Map/AutoGenerator.ts`、`DungeonFeature.ts` | autogen 选址排除；DF 原点/扩散产物排除预留。 |
| `src/engine/Items/ItemSpawnHeatMap.ts` | 热图 blocked 加当前预留。 |
| `src/engine/Core/GenerationCoordinator.ts` | 贡献交给 Architect、保存成功尝试 drafts；楼梯/人口尊重 mask；最终居民恢复后发布；释放 mask；留场通知转接。 |
| `src/engine/Core/Game.ts` | makeGenerationPorts 声明/收据发布；generateDepth 贡献 allocator 回滚；canCreateSquareMonster/createModuleMonster/createSquareMonster 预检、spawnLoc 与出生理由；polymorphBoltTarget 模块形态候选；loadSnapshot 启用目录/身体校验和 runtime 安装后 resolver 重绑。 |
| `src/entities/Creature.ts` | takeDamage 明确区分单格原位与多格接触血迹，保留原 DF 守卫及真实身体接触语义。 |
| `src/engine/Combat/Polymorph.ts`、`src/entities/Monster.ts` | 可选目录候选、原生有界转换；takeRegionGuardTurn 的有限 AI。 |
| `src/engine/Core/EntitySnapshot.ts` | 拒绝 namespaced type/form 身份不一致。 |
| `src/engine/Movement/LevelTravel.ts` | scheduleLevelFollowers 可选留场通知，未使用边界时旧路径不变。 |
| `src/ui/displayProjection.ts` | 仅启用声明时附公开历史 actorTags，不从未来实时 state 重建 HUD。 |
| `scripts/check-module-composition-smoke.mjs` | 动态发现 16 子集；从通用贡献元数据确定自然深度/目录，实际命令走自然楼梯路线，无 giants 生产导入。 |
| 测试/文档 | 常规 suite 登记底座贡献专项；模块拥有自己的 suite/trace；架构 §24 与 progress 更新。 |

前一子里程碑的函数表见历史附录。原 monsters.json/horde/CE 内容、战斗解算器和既有生成基线/黄金 trace 未改。

## 内容数据与可调字段

机械数据：`src/ext/modules/giants/data/definitions.json`，module/rules 1.0.0、pack/state schema 1、foundation 4；整个 pack 的 canonical 指纹进 manifest。修改机械数据会使旧指纹档精确拒绝，不自动迁移。显示文字在 `locales/zh_CN.json`，HUD 在 `ui/BossHud.vue`。

- 敌人：id/nameKey/descriptionKey/size/char/color；HP 120、命中 90、防御 40、伤害 4–9、移动/攻击速度 100。原创地下厚甲兽，背脊如碎岩，字形 R、土岩色 `#b6935c`。普通原生资格，没有特殊能力，bloodType/DFChance/DFType 显式为零。
- 场地：id/priority/minDepth/maxDepth/chance/width/height/entranceWidth/candidateLimit/formId/guard。当前 D3–8、50% 尝试率、每层≤1、12×10 净空、三格宽入口、最多16候选、return-to-spawn。实际成功还须满足空间与最终占位合同；50% 不是无条件成功率。
- 首版通用预算：每模块≤16形态/模板；候选≤16，矩形宽12–32/高10–24，直廊长度≤12；owned regions 总预算128。临时数值可改但不得放宽底座守卫。正式 3×3 内容不在本步。

## 自然验收种子与 trace

维护者可新建**普通 extended 局，只勾选 giants，种子 `7306`**，从 D1 正常走到 **D3**。侧室净空位于 `(18,2)`、12×10，原创 Boss 锚点 `(23,6)`（坐标从0起）；看到岩脊兽即应出现一条名称/120血量条，移出可见知识后隐藏。

新增 `tests/naturalFixture.ts` 仅只读选取楼梯路线，所有状态变更由真实 move/search/stairs 命令完成。giants-only 自然路线共 **152 条命令**，到达 D3 时玩家 **HP26**、Boss **HP120**，region ID54、Boss ID55。没有揭图、搬玩家、改血量、注入怪物或跳楼层来产生 trace。行为/死亡/坠落专项的诊断布景另有显式注释，不作为自然来源。

独立 trace 在 `src/ext/modules/giants/data/natural-trace.json`：命令哈希、当前/缓存地图与原生实体图哈希、扩展收据/区域哈希、Boss 原生属性、双流完整状态与调用数。原捕获入口为 `BROGUE_CAPTURE_GIANTS_TRACE=1 ...giants_trace.test.ts`；这是新增模块的首份 trace，不重录既有基线。最终 drift 在不设置捕获变量下严格比较。

## 最终开发期门禁

环境：Node 24.19.0，PATH 前置 Codex runtime；`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。采用任务书开发期功能测试政策，浏览器由维护者执行。

| 命令/集合 | 最终结果与本地证据 |
|---|---|
| `npx vue-tsc -b` | **exit0**；`/private/tmp/p4a4-completion-type-final.log` / `.exit`。 |
| `npm run build` | **exit0**，Vite 2.32s；`/private/tmp/p4a4-completion-build-final.log` / `.exit`；已有 >500 KB chunk 提示保留。 |
| `node scripts/check-module-boundaries.mjs` | **exit0**；`/private/tmp/p4a4-completion-boundary-final.log`。 |
| 49 文件直接相关回归 | **49/49 文件、816/816 项通过**，440.19s、exit0；`/private/tmp/p4a4-completion-related-final.log` / `.exit`；文件清单 `...-related-files.json`，可复现 runner `/private/tmp/p4a4-completion-gates.py`。 |
| `c_4a_terrain_catalog -t 白名单` | **1项通过、29项由 -t 过滤**，exit0；`/private/tmp/p4a4-completion-terrain-final.log` / `.exit`。 |
| `check-module-composition-smoke.mjs --engine-only` | **16/16 子集通过、exit0**；含 giants 的8组合全部自然到D3并游玩/存读/回放/seek/续录；`/private/tmp/p4a4-completion-composition-final.json` / `.log` / `.exit`。requestedScopePassed=true；browser=not-run，所以整体 passed=false 不代表 engine-only 失败。 |
| `npm run test:drift -- --maxWorkers=2` | **3/3 文件、3/3 项通过**，48.58s、exit0；`/private/tmp/p4a4-completion-drift-final.log` / `.exit`。两份旧基线零漂移、无重录；新增 giants 自然 trace 严格复现。 |
| 未启用组合对 HEAD 的独立对照 | **8/8 子集完全相等**，每组自然D1/D2/D3/再wait共4检查点；比较命令数、全部当前/缓存地图与原生实体图哈希、实体/机器编号、扩展状态哈希及双RNG状态/计数；`/private/tmp/p4a4-completion-zero-final.json`、`...-zero-{head,working}.json`；复现探针 `/private/tmp/p4a4-zero-impact-probe.mjs`，独立HEAD副本 `/private/tmp/p4a4-head-zero-impact`。Vite输出沙箱 WebSocket EPERM 警告，SSR捕获仍实际完成并exit0，结果逐项相等。 |
| 固定交付 | **838个生产/测试/脚本/数据输入在最终门禁前后SHA-256一致**，变化路径为空；窗口11:06:44–11:16:17，记录 `/private/tmp/p4a4-completion-gates.json`。最终补充HEAD对照后再次核对一致；git diff --check、UTF-8/LF、HEAD未变、暂存区为空。 |

相关集合覆盖前一16项 region 守卫、4a0 全对象图零影响差分、4a-1/2/3 功能与性能保险、U01/U03/生命周期/原生位移变形/录像与 UR2/3/4、生成事务/显式写集独立完整对象图差分、直接受影响的 DF/autogen/blueprint/物品/horde/AI，以及 i18n/源码/套件卫生。

新底座12项覆盖严格有限数据、纯锚点/绕行图、预留楼梯/DF、未启用目录范围、冻结声明、两个独立回滚实现、候选耗尽/预算/最终出生无位的 skip、机器外扩回滚和失败出生零 ID/RNG。giants 的3项合同、10项运行、3项公开 HUD 及1项 drift 覆盖自然出生、四种指定组合、存读/录像/seek/续录、坏档/缺包、守场/支配/复制/双向形态资格与无位拒绝、真实坠落 pending 存读、击败重访不复生、行政退休事实与历史血条。

16 子集 smoke 包含所有8个含 giants 的组合；它们自然到D3后继续真实游玩/save-load/replay/seek/续录，其他8组合保留原测试新局；另在独立HEAD/工作树副本中用自然D1–3路线和继续等待做逐项零影响对照。4a0 差分另保留空、growth、narrative、growth+narrative 的完整原生机械对象图/引用/消息/双流零影响证明；旧 drift 严格比较浅层与深层基线，不排除地图/实体/随机数差异。

依任务书未运行完整 npm test、全部 test:ext、removal、CE full/gen 或浏览器；原始日志/截图不入仓。当前交付没有把 engine-only 的整体 browser=not-run 声称为浏览器通过。

## 开发归因与限制

旧测试、守卫、断言、夹具和基线/黄金 trace 均未修改；没有旧前提修订或旧基线重录。首轮49文件814/816项通过，i18n静态调用和DF源码断言两项失败；失败记录独立保留，不充当最终通过证据。

- 自然探针证明原后地形搜索缺少12×10岩石净空，因此仅启用贡献时在 room attachment 留候选空间，再按原定生成阶段验证/挖掘；不开模块不改变生成。
- 新专项发现新方形出生 spawnLoc 默认(0,0)，以及 loadSnapshot 在 runtime 安装前绑定查询导致读档后守场 Missing movement region。修生产出生锚点/安装后重绑，保留全部旧 region 断言与原生转换资格。
- 新异常回滚完整快照揭示 nextMachineNumber 未恢复；仅贡献开启的致命外层失败补机器编号恢复，并用显式写集/独立全图 oracle 验旧引用与机械世界，普通 CE retry/分配器约定保留。
- 静态 i18n 守卫拒绝共享通用函数的动态 t(form.nameKey)；改为顺当前语言/回退语言读取 i18n 资源，精确键仍由安装模块 JSON 的语义文本字段扫描，不扩大 ext 命名空间或改扫描器。DF 旧守卫要求单格原位血迹调用；仅将 Creature 回退 HEAD 时该项仍红（exit1，/private/tmp/p4a4-completion-creature-counterfactual.log），证明来自此前已提交的接触位置接线。生产 takeDamage 明确分原位/接触分支，后者仍使用真实接触；旧守卫保留。修复后两文件57项通过，随后重新冻结并跑最终门禁。
- 新测试初轮因最小 i18n harness 使用 en、墙钟 savedAt、clone 参数和 Grid 尺寸前提错误失败，只修新增夹具；格式化后 HUD 样式文字断言失败，改新增断言为相同 CSS 语义的空白兼容表达。开发失败日志保留 /private/tmp，不冒充最终验收。

已知范围：正式内容只有一个2×2、单主体收据、普通即时近战；3×3正式内容、任意/复合身体、特殊能力、额外奖励及可解除区域的楼梯跟随产品扩展都不在本步。盟友目前保留硬边界并有留场原因。候选预算有限，可能留空侧室并写 skipped，不承诺每次概率命中都放成。HUD 响应式约束与公开帧行为已测，320/390实机/模拟视口、美术观感和浏览器完整验收由维护者执行。物理删除与收尾统一门禁仍按项目安排执行。

## 历史附录：维护者已提交的 region/movementBounds 子里程碑

以下保留前次已完成范围、函数表、验证与归因记录；其中“本轮/当前/后续”均指基点 `c3bfc97` 的原子里程碑，不代表本次续轮。其实现已由维护者提交至 `eef51e6`。旧剩余1–6已由上文完整交付覆盖。

## 已实现范围与底座/模块切分

1. **底座 owned region**：新增严格矩形区域 schema，包括共享实体 ID、owner、depth、instanceKey、bounds；几何仅保存于可选 `extensions.foundation.world.regions`，生物仅保存 `spatial.movementRegionId`。无区域时省略字段，不写空数组或 undefined。原可穿行叙事 `WorldInteractable` 类型与语义保留。
2. **受控安装口**：模块须声明 `ownedRegions: true`；原生生成所有者持真实栈顶 generation token 才能调用 `installOwnedRegions`。普通模块 hook/command context 没有安装能力。整批校验尺寸、owner、预算、重复实例/重叠后才分配 ID；返回 DTO 深冻结。空请求无写入、无 ID 分配、无随机调用。
3. **位移硬边界**：公共完整身体 fit、方形落点搜索和路径图逐身体格检查区域。行走、闪现、随机传送、拉拽、踉跄击退、力场符文、克隆沿既有原生入口共用检查；锚点在内而尾格在外仍拒绝。路径缓存键增加 region ID，防止同形状不同区域共用错误地形图。
4. **转换与离层**：方形被动变形为原生单格时保留绑定，使用带 region ID 的 `builtin:single/r0`。无区域的显式 single、任意 mask/zone/group/lock 和 spatial 玩家继续拒绝。生存坠落者转层前清旧边界并发 `movementRegionExited`（reason=fell）；单格恢复 spatial 属性缺席。带硬边界的生物暂不调度楼梯跟随，关系转换本身没有新增免疫。
5. **持久化与拒绝**：读档在退休旧局前校验区域真实缓存层、地图尺寸、ID/allocator 冲突、未知 owner 和生物完整身体绑定；pending 坠落者不能保留旧 region。解码使用脱离 live Grid 的 ledger resolver，存读/验证不取骰。whole-run v3 / foundation 4 包络保留，不做旧档迁移。
6. **生成失败恢复**：region ledger 纳入已有 runtime generation frame 的 world 检查点；内层提交后外层回滚仍撤销区域和新增区域 ID 分配。Game 的显式 `restoreSession` 在启用区域能力时清多格派生缓存，完整回滚恢复深度和账本后再重绑旧层 resolver。原生生成既有“不回退原生构造分配器”的约定没有改；不能把这里的区域分配回退表述成尚未实现的整个侧室/出生计划分配器合同。

区域 resolver 的 WeakMap 只保存 Grid→只读查询函数，不保存几何/收据/机械状态。新局、换层、读档和回滚重建关联，同一 Grid 的临时 world ports 也能读到边界。没有新增 Game 实例字段，U03 契约文件无需增项。

所有新增生产逻辑均在底座，不 import 正式模块。专项自建 `region-fixture` 注册表、复用原生老鼠，不依赖 growth/narrative/combat/未来 giants。未执行物理删除门禁，不能宣称 removal 验收已经完成。

## 共享文件函数级改动

| 文件 | 函数/接口与目的 |
|---|---|
| `src/ext/regions.ts`（新增） | `OwnedRegionPlacement` / `OwnedRegion`；`validRegionPlacement`、`validOwnedRegions`、`regionContains`、`regionsOverlap`：纯 schema 与几何。 |
| `src/ext/world.ts` | `WorldInteractionSnapshot` / `WorldInteractionValidation` 增可选 regions；`validWorldSnapshot` 验区域与交互对象 ID 冲突，普通包络保留。 |
| `src/ext/types.ts` | `ExtensionModule.ownedRegions` 声明；`HookEvents.movementRegionExited` 底座离场事实。 |
| `src/ext/runtime.ts` | constructor 校验声明；`installOwnedRegions` 事务安装；`ownedRegion` / `containsOwnedRegion` 只读查询；`releaseFallenMovementRegion` 清绑定并发事实；`validateSnapshot` 验声明 owner；`validateWorld` 仅在存在区域时传冻结区域 DTO。 |
| `src/engine/Movement/MovementRegions.ts`（新增） | `bindMovementRegions` / `inMovementRegion`：派生 Grid 会话关联，无机械根。 |
| `src/engine/Movement/CreatureSpatial.ts` | `squareMovementSize` 开放带边界的 square / bounded single；`clearMovementRegion` 清绑定；`replaceWorld` 拒绝悬空/越界引用；class 与函数版 fit 共用边界。 |
| `src/engine/Movement/SquarePlacement.ts` | `squarePlacementCandidates`：路径遍历和回退候选都限制在区域内。 |
| `src/engine/Map/FootprintPathing.ts` | `planStep`：缓存键包含 region ID；无 region 时旧 key 不变。 |
| `src/entities/Monster.ts` | `polymorph`：成功的原生单格转换保留 region ID，失败仍不先修改机械形态。 |
| `src/engine/Movement/LevelTravel.ts` | `scheduleLevelFollowers`：带硬边界的生物不预约离层跟随。 |
| `src/engine/Core/WholeRunSnapshot.ts` | `decodeWholeRunWorld`：纯区域/层/实体绑定验证；构建空间服务时供应独立解码 resolver。 |
| `src/engine/Core/Game.ts` | `generateDepth` 的 restoreSession 清派生缓存/重绑；`polymorphBoltTarget` 的 value candidate 保留单格边界；`monstersFall` 清旧边界；`createSquareMonster` 可接 region ID；`bindDormantAwakener` / `bindMovementRegionSession` 管理关联。 |
| 测试/文档 | 新增 `phase4a4_movement_regions.test.ts`，登记常规 suite；`docs/ext/architecture.md` §23 记录能力和未实施部分；`progress.md` 记录进度。 |

没有改 classic/extension 战斗解算器、UI 组件、命令边界、CE 目录、现有怪物/horde 数据、locale、黄金 trace 或生成基线。新增生产错误是内部校验错误，没有新增玩家文案。

## 数据与可调字段

正式内容数据尚未交付，当前没有可调整岩脊兽 HP/防御/伤害/生成率的生产 JSON。

已交付底座参数：`OwnedRegionPlacement.bounds` 的 x/y/width/height 和实例标识；`src/ext/regions.ts` 的 `OWNED_REGION_LIMIT = 128`。坐标/宽高 schema 上限 1024，实际安装/读档还按当前地图尺寸约束，depth 1–40。它们是通用能力约束，**不代替 12×10 净空、≥3 宽入口、出生缓冲和锚点图/绕行验算**。

本轮没有奖励协议接线；既有 growth 行为未改，也没有硬编码额外 XP。

## 实际门禁与结果

环境：Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。

| 命令/集合 | 最终结果与本地证据 |
|---|---|
| 37 文件直接相关回归 | **37/37 文件、596/596 项通过**，136.26s，shell exit=0；`/private/tmp/p4a4-related-final.log` / `.exit`，可复现命令 `/private/tmp/p4a4-related-final.sh`，清单 `/private/tmp/p4a4-related-files.json`。包含本轮 16 项专项。 |
| `node scripts/check-module-boundaries.mjs` | **exit=0**；`/private/tmp/p4a4-boundary-final.log`。 |
| `npx vue-tsc -b` | **exit=0**；`/private/tmp/p4a4-type-final.log` / `.exit`。 |
| `npm run build` | **exit=0**，Vite 2.44s；`/private/tmp/p4a4-build-final.log` / `.exit`。已有 >500 KB chunk 提示保留。 |
| `check-module-composition-smoke.mjs --engine-only` | **exit=0，8/8 现有子集通过**；installed=`combat,growth,narrative`。`/private/tmp/p4a4-composition-final.json` / `.log` / `.exit`。`requestedScopePassed=true`；browser=not-run，因此脚本整体 `passed=false` 是报告口径，不是本次 engine-only 失败。**没有含 giants 的组合。** |
| `c_4a_terrain_catalog -t 白名单` | **1 项通过，29 项由 -t 过滤**，exit=0；`/private/tmp/p4a4-terrain-guard-final.log` / `.exit`。未跑整份重型普查。 |
| `npm run test:drift -- --maxWorkers=2` | **2/2 文件、2/2 项通过，exit=0**，45.33s；`/private/tmp/p4a4-drift-final.log` / `.exit`。两份旧基线零漂移，无重录。 |
| 固定交付检查 | **14 个生产/测试/清单文件在最终门禁前后 SHA-256 一致**；`/private/tmp/p4a4-delivery-hashes.json`。`git diff --check` 通过，交付文本 LF，HEAD 不变、暂存区为空。 |

16 项专项覆盖：严格 schema/owner/碰撞/空字段拒绝；真实 token、批次全拒绝及嵌套事务回退；2×2/3×3 尾格越界出生和移动零 ID/RNG；不同 region 的路径缓存隔离、真实 executeCommand 推进 NPC 与楼梯边界；闪现/拉拽/击退/力场/随机传送；克隆失败零 ID；单格变形保边界及存读；坏层/尺寸/allocator/owner/引用/尾格档拒绝且旧局不退休；坠落清边界及单格属性缺席；生成异常恢复 ledger/旧对象/双 RNG；普通局 regions 缺席及普通回放。

37 文件集合还包含 4a0 全对象图零影响差分、4a-1/4a-2/4a-3 专项及性能保险、生成事务/显式写集完整对象图差分、出生、世界交互、模块组合/UI/边界、U01/U03/换层/生命周期、近邻位移/变形、UR2/3/4、录像和源码/i18n/卫生/套件清单守卫。

4a0 差分精确复现原夹具的空、growth、narrative、growth+narrative 组合，包括真实新局/命令/战斗/位移/召唤/机关/换层/存读/回放/seek、完整对象图和双流。8 子集 engine smoke 另覆盖现有模块的真实 Game 新局/游玩/save-load/replay/seek/续录和缺模块拒绝。它们不能替代未来启用 giants 后的自然生成 trace 和组合测试。

依任务书没有运行完整 `npm test`、全部 `test:ext`、removal、CE full/gen 或浏览器验收。原始日志和截图没有进入仓库。

## 开发失败记录与旧守卫

没有修改旧测试、断言、夹具或守卫，没有基线/黄金 trace 重录，因此没有旧前提修订或反事实重录。

- 第一轮新增专项因新测试的 EntitySnapshot 依赖路径误写而未收集；类型检查同时指出新 fixture 对 readonly 字段的写法问题。只修新增测试导入/布景表达和新代码的类型收窄。
- 第二轮新增专项 **12/15 通过、3 失败**，`/private/tmp/p4a4-regions-dev2.log`。公共空间服务仍无条件拒绝 region，导致路径服务和读档失败：改生产 `replaceWorld` 为查可信 resolver 和完整身体，不改旧守卫。随机传送正例的全开放视野违反既有 CE 落点资格：只给新夹具增加遮挡墙和可通行的两格门洞，不改变 CE 传送规则或断言。
- 第三轮专项加 4a0 零影响差分 **19/19 通过**，`/private/tmp/p4a4-regions-dev3.log`。随后增加单格变形读档和坠落属性缺席保险，最终全部固定后纳入 37 文件集合。前述开发轮次不冒充最终交付验收。
- 首轮相关集合 37 文件/596 项、build 和 drift 通过后，交付复查发现回滚 resolver 在深度恢复前绑定的时序问题：新增同一 fixture 的“回滚后场内合法移动仍成功”正例，只回退 Game 中本次重绑时序修正时 **1 项失败、15 项由 -t 过滤，exit=1**，`/private/tmp/p4a4-rebind-counterfactual.log` / `.exit`；其余断言此前通过。恢复修正，将重绑移至深度及 runtime 账本完整回退后，从头补跑最终相关集合、type/build、smoke/boundary 和 drift。修改的只是本轮生产代码和新增专项，没有旧测试前提修订。此前通过的日志保留为 `/private/tmp/p4a4-{related,build,drift}-before-rebind-review.log`，不充当最终固定交付证据。
