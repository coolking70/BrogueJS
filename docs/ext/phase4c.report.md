# 4c-0 执行报告：固定 zone 健康与破坏软接口底座

本轮执行 `docs/ext/phase4c.task.md`，基于 `ext/phase4` / `2eb3181e67c9e7650b538b08af76ba2759c75710`。按任务书“可在干净子里程碑停下并列剩余项”，交付 **4c-0**，不是完整 4c。未 commit、暂存、push；未修改 combat 模块代码。

## 已交付能力和关闭边界

底座 fixture 上的独立刚体可以声明固定 local/native zone、逐格标签、local HP 与 keep-zone 破坏表。新增健康出口接收调用方已经完成的单次实体级命中/防护伤量，额外仅计算一次 zone 防护（物理 armor 按伤害点扣除，再乘倍率向下取整）；local HP 损失为 `min(防护后伤量, 命中前 local HP)`，原生 HP 只接收这一份 1:1 传伤并截到剩余 HP。直接 body/native zone 只扣原生 HP，没有自传。破坏后的 local zone 再接触不再传伤；keep-zone 不移动/删除身体格。

使用既有 `CreatureSpatial.collectBodyTargets` 的同步 scope：同 zone 多格一次，两个 local zone 的 geometry/area-damage 各一次；mental/identity/healing/death 保持 group 一次。健康出口不执行随机取骰、`takeDamage`、原生攻击、physicalResolved、普通死亡/掉落/XP。这是 fixture 的已解析伤量出口，不声称已经接到近战、投掷、射线或火球的完整生产解算器。

`zoneState.broken/generation` 就是唯一破坏收据集合，不另存第二份 applied ledger。单体键为 `(actor.id, self, zoneId, 0)`。破坏一次发布收据；重入、实体/世界 fixture 读档与克隆读派生修正时不会重发。失攻是禁用 ID 集合查询；速度由原生基数乘当前有效破坏规则并向上取整，不改写持久 movementSpeed；弱点暴露取目标原倍率与所有暴露声明的最大有理数，不重复相乘。局部状态坏 HP/标签、缺失/重复记录、矛盾 broken、再生字段、非零 generation 被拒绝。再生 schema 的预留类型仍存在，但未开放。

**生产能力仍关闭**：`NativeFormDefinition` 仍不能声明 zone；`assertNativeSpatial` / rigid 编译 / 生产 codec 仍拒绝 local HP 与 actionLock。`FixedZoneHealth` 的入口要求 `catalog.fixture`，不能把保存的定义当安装许可。普通 1×1、现有方形、任意 mask 与 giants 内容没有新增持久字段、额外 RNG、规则时钟或正式 zone。未增加 Game 字段，不需要更改 U03 合同或格式版本。

## 共享文件函数级改动

| 文件 | 实改 |
|---|---|
| `engine/Movement/SpatialSchema.ts` | `PartBreakRule.expose-zone` 补充明确 `damageMultiplier`；新增 fixture-only `SpatialCatalog.registerBreakRule`，仅允许 keep-zone 与 move-ticks-multiplier/disable-attack/expose-zone/balance-loss，检查预算、比例、重复修正和未开放字段；`registerFootprint` 核验 exposure 的 self/zone 引用；`validateSpatialComponent` 明确固定 zone generation 必须为 0。 |
| `engine/Combat/FixedZoneHealth.ts`（新增） | `initialLocalZoneState`、`resolveFixedZoneHit`、`fixedZoneBreaks`、三类修正查询与 `advanceFixedZoneLock`。限制 1:1、自有刚体、真实当前 part 接触；HP/zone/lock 原子写入和幂等回滚。时钟函数只供 fixture，未接 TimeCoordinator。 |
| `ext/partBreak.ts`（新增） | 底座拥有的版本化 receipt/request/provider/原生事务类型及严格输入验证；没有导入任何模块。 |
| `ext/types.ts` | `ExtensionModule.optionalPartBreaks` 可选声明，仅支持 `combat.part-break.v1`。 |
| `ext/runtime.ts` | 构造时拒绝错误版本/形状与多个 provider；新增引擎内部 `commitPartBreak`。provider 绑定为派生 WeakMap，不新增既有 runtime 自有字段。prepare/commit 与原生 apply 共用现有扩展事务，异常恢复扩展状态/组件/消息/资源/RNG，并调用原生 rollback。 |
| `scripts/test-suites.json` | 登记两份底座测试，保持唯一归属。 |

其他新增文件是两份测试和 `src/test/fixtures/fixedZones.ts`；进度写在 `progress.md`。未修改 `Combat.ts`、`Bolt.ts`、Game/TimeCoordinator、准备/计划系统、显示组件、giants 定义/locale、任何旧测试/守卫、基线或黄金 trace。

## `combat.part-break.v1` 本轮最终签名（供 dot 接 provider）

类型以 `src/ext/partBreak.ts` 为准，注册位置：

```ts
const PART_BREAK_CAPABILITY = 'combat.part-break.v1';
ExtensionModule.optionalPartBreaks?: {
  readonly 'combat.part-break.v1'?: PartBreakProvider;
};

interface PartBreakRequest {
  readonly schema: 1;
  readonly resolutionId: number;
  readonly actorId: number;
  readonly sourceId: number | null;
  readonly groupId: number; // 本步必须等于 actorId
  readonly partId: 'self';
  readonly zoneId: string;
  readonly generation: 0;
  readonly balanceLoss: number;
  readonly fallbackStunTicks: number;
}

type PartBreakPreparation =
  | { status: 'ready'; plan: Json }
  | { status: 'unsupported'; reason: 'disabled' | 'unsupported-target' };

interface PartBreakProvider {
  prepare(request: Readonly<PartBreakRequest>,
          context: PartBreakPrepareContext): PartBreakPreparation;
  commit(request: Readonly<PartBreakRequest>, plan: ReadonlyJson,
         context: PartBreakCommitContext): void;
}

interface PartBreakNativeCommit<T> {
  apply(choice: PartBreakChoice): T;
  rollback(): void;
}
ExtensionRuntime.commitPartBreak<T>(request: PartBreakRequest,
                                   native: PartBreakNativeCommit<T>): T;
```

prepare context 是只读 `ExtensionRuleContext` 加命中前冻结 `actor: ActorFacts`，只查询 provider 自有 namespace 的 state/component；没有引擎实体或随机/写端口。request、计划和 actor 均脱离 live 对象并冻结；prepare 的 getComponent 在该阶段结束后失效。

commit context 仅有 `state/setState`、`getComponent/setComponent/removeComponent` 与缓冲 `message`，供 provider 在自有组件里处理韧性/硬直。没有 HP/resource、行动、奖励、世界写入或随机端口；写函数离开同步生命周期即失效。计划留在本次调用内，不导出 token、不保存、不允许 Promise 或非 void commit 返回值。

调用顺序：同一扩展事务内 prepare → 原生 apply → ready provider commit。ready 选择 `{status:'handled'}`；absent/disabled/unsupported-target 选择 `{status:'fallback', reason}`。底座 fallback 将声明的短 actionLock 与原锁取 max；handled 不新增 fallback、保留已有其他锁。两者互斥。provider 抛异常/输出坏协议时整个本次破坏失败，**不会悄悄切换 fallback**。

底座健康事务的 rollback 恢复 HP、原 zoneState 数组和记录、原锁值/属性缺席，保留对象身份，重复调用幂等。未来接原生计划取消时，caller 还必须把取消写集加入 `native.rollback`；目前没有计划取消接线，不能只接 provider 后声称已满足 3b 取消合同。4d 的 member/generation 将需要另行扩充当前仅 self/0 的协议边界。

## 数据位置、可调项和验收入口

正式 giants 数据本轮未改，没有新增带 zone 的自然敌人，因而**没有本步自然 zone 验收种子**。既有 giants 的自然生成仍由原专项和组合 smoke 回归，不把旧种子 7306/7309 当作本步 zone 内容证据。

诊断声明仅位于 `src/test/fixtures/fixedZones.ts`：3×2 刚体，shell 两格/local HP12/armor2，leg 两格/local HP10，core 一格/native，余格 body。shell 破坏示范 3/2 移动 tick 倍率、禁 smash、暴露 core 为 2 倍、balanceLoss6/fallback25 ticks；leg 破坏示范 2 倍移动 ticks、core3倍。可调字段为 zones 的 maxHp/armor/damageMultiplier、zoneCells、breakRuleId 及上述有限 modifiers。ownerTransfer 本步固定 1:1；无镜像/成员/再生/换形/残骸。

两份新增测试分别覆盖空间 scope/健康/schema/fixture codec 与真实 ExtensionRuntime 中的 fixture provider/互斥/完整失败回滚。明确不把 fixture 原生 HP 写入看成已实现生产攻击，也不把 codec round-trip 看成已实现 zone 的真实 Game replay/seek/续录。

## 实际门禁

统一 Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。同一冻结候选最终七项全部 exit0：

| 门禁 | 实际结果 | 耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 边界和唯一测试归属通过 | 1.60s |
| `npx vue-tsc -b` | 通过 | 6.97s |
| `npm run build` | 通过；原有 >500KB chunk 提示保留 | 9.86s |
| 50文件相关 Vitest 集合 | **50/50 文件，983/983 项通过，0 skipped/todo**；含新增78项、4a0零影响、4a/4b、全部giants/combat、3b、两份战斗对等、UR2/3/4、存档录像、生成回滚和源码守卫 | 299.70s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过，29项由选择表达式未选；没有跑重型普查 | 1.63s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16 子集通过**；真实 Game 新局、游玩、save/load、逐事件 replay、seek、续录 | 69.93s |
| `npm run test:drift -- --maxWorkers=2` | **4/4 文件、5/5 项通过**；两份普通生成基线与三份 giants 自然 trace，原字节保持 | 56.94s |

相关集合精确清单：`/private/tmp/p4c0-related-files.json`。Node/命令/耗时/退出码/逐文件输入散列登记：`/private/tmp/p4c0-final-gates.json`；runner 为 `p4c0-final-gates.py`；各项原始日志为 `/private/tmp/p4c0-final-*.log`。

866份 src/scripts/构建配置输入在每项门禁后及最终均与冻结前一致，变化列表为空；路径排序紧凑 JSON 的散列集合 SHA-256 **`f78fc11e522b496c97492b6a355eff65b30c16daa3bcd7cd5de1f06efe4f334c`**。门禁结束 UTC `2026-10-05T06:36:04Z`，随后只更新文档。

composition 安装集合为 combat/giants/growth/narrative，`engine.status=passed`、`requestedScopePassed=true`。脚本的 browser=not-run、整体 passed=false 表示浏览器未验，不能冒充完整 browser smoke；SSR HMR WebSocket 的既有监听 EPERM 日志保留，engine-only 实际 exit0。

开发第一轮新增两文件为75通过/1失败（stale-contact 新测试选中了旋转后仍合法的原点格，已将新布景改为真实离开身体的非原点接触，保持拒绝断言）；下一轮5文件121项通过，随后增加两个新边界后进入上述最终完整相关集合。最初类型检查只发现新测试误用了不存在的 XP 字段，已删掉该错误字段观察，真实 reward/death/physical hooks 与因果账本验证保留。没有修订任何旧守卫/旧测试前提，没有反事实或重录的需要。

依任务书未跑完整 npm test、全部 test:ext、removal 或 CE full/gen；没有新增 skip/todo。

浏览器尝试：原技能客户端 `web_game_playwright_client.js` 使用参考 action payload 执行，实际 exit1；Vite `127.0.0.1:5411` 监听 exit1/EPERM，Chromium 被 MachPort `Permission denied` 拒绝，未取得截图。日志在 `/private/tmp/p4c0-browser-{vite,client}.log`。本轮没有 UI 改动，仍明确不声称320/390、触控、GPU或公开历史帧像素通过；这些属于完整4c后续项。

## 完整 4c 剩余项

1. 生产能力门与数据驱动 owned zone/breakRule 贡献：方形或 mask 的创建、移动/旋转、复制/变形、跨层/离图/pending/携带状态和全部生产 codec；fallback 接客观时钟与实际行动禁用。
2. 原生命中/伤害路由：classic/extended 近战、投掷、射线、几何和范围效果接统一健康出口，正确维护符文/反伤/吸血/growth/阶段3逐击出口与传导归属；用真实生产路径验证 D08，不以 fixture 去重代替。
3. 以被破坏 zone 为来源或目标的 prepared/蓄力计划取消，包括 3b 原生计划；取消写集和 provider 故障在同一事务恢复。combat 模块 provider 的实际韧性/硬直接入按任务书仍交 dot，本轮未改该模块。
4. 公开瞄准/检视/HUD、当前或最近公开 zone HP/已破坏、选中清理、公开弱点与历史帧隔离；320/390 实际布局与触摸模拟验收。
5. 一个正式原创 zone 敌人（可选沉渊巨像或岩脊兽）、自然生成与无 growth/combat 的击败种子；真实 Game save/load/replay/seek/续录及 zone 坏档。内容指纹/trace 若改变，先单变量归因，再用原入口重录登记。

本轮停点是关闭生产能力的完整 fixture/软接口底座；完整4c仍需以上接线和内容，不发布只有占位而不能战斗/保存的半成品敌人。
