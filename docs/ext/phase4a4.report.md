# 4a-4 执行报告：owned region / movementBounds 底座子里程碑

日期：2026-10-05。分支 `ext/phase4`，HEAD `c3bfc97d77f8b65eb8c01e55eddf891fdb6c9434`。未 commit、未暂存、未 push。

## 交付状态

**完整 4a-4 尚未完成，岩脊兽仍不能自然遇到。** 本轮依据 [任务书](phase4a4.task.md) 的“可在干净子里程碑停下并列剩余项”，交付可独立审查、专项和相关回归均通过的第一块底座能力：持久 owned region，以及原生方形与变形后单格生物共用的 movementBounds 硬边界。

没有创建 `src/ext/modules/giants/`、岩脊兽/场地 JSON、模块指纹、placements/bosses 收据、守场/追击/回归 AI 或 Boss 血条。没有将手工 fixture 冒充自然生成场景。完整剩余清单在文末。

选择本里程碑的边界：先完成守场不可越界和持久区域的公共合同，后续侧室生成和内容模块可以调用同一底座，而无需在模块中分别修补传送、击退、变形和读档。

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

## 已知限制、验收种子与剩余项

**没有可提供的自然岩脊兽验收种子/深度**：生产中尚无 giants 包或侧室生成。专项 seed `441004` 是手工底座 fixture，不能作为浏览器自然遇敌说明。

完整 4a-4 仍需完成：

1. `GenerationContribution` 的冻结有限声明、生成顺序接入及排序；基础地形后/陷阱机器前的侧室候选、挖掘和 mask 预留，楼梯/机器/autogen/populate 尊重预留，最终落点复核与有界 skip 收据；新增写集与完整对象图回滚保险。当前区域安装口没有挖图或预留能力。
2. 通用原生形态目录贡献、模块敌人创建适配器和未知/禁用形态的 snapshot/form 验证；polymorph 抽样候选在模块缺席时零变化。当前只处理原生 square→single 的边界保留，没有新增物种候选。
3. 正式 `giants` descriptor/module/schema/types/原创敌人和场地 JSON/state/validation/locales/ui/tests/test-suites/rules 指纹；默认不勾选；深度 3–8、每层≤1、50% 等可调内容值。
4. 12×10、入口≥3、出生离边≥2、2×2 锚点图可达、玩家绕行的真实场地验算；守场/追击/回归有限 AI。当前硬边界不会越界，但仍沿默认 native AI，没有回归出生点行为；带边界盟友暂留原层，没有离层原因文案/显式解除或重绑产品策略。
5. placements/bosses/subjects 的绑定、击败不再生、escaped/lost 与行政退休/后裔身份处理；可选奖励策略。目前只有通用坠落事实，没有巨人遇敌收据。
6. 仅取 `readDisplayFrame` 的目标优先/最近可见 Boss 血条、知识隐藏/历史帧、320/390 宽度与模块 locale；自然新局的 giants-only / +growth / +narrative / +combat(inert) 存读/回放/seek/续录、固定种子 trace、缺包拒绝及验收种子。收尾时再跑任务书规定的全套组合/removal。

本子里程碑没有待修失败门禁。后续从这些底座接口接入侧室纵切即可；不要把本报告的通过结果扩称为完整 4a-4 可玩交付。
