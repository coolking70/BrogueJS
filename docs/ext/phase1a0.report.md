# EXT-1a0：成长技术底座与数据合同

工作分支：`ext/foundation`。基线 `99f64bce00309179ae0cd593acebfe0ebf07b0c2`，已用远端精确引用核对。本步没有再次合并 main，没有修改/推送 main、打标签或启用 1a 玩法。

状态：实现完成；完整/CE 门禁受云端 exec-server 反复断开及 HTTP 503 服务故障阻塞，尚无完整套件终态。当前保存 WIP，不作为验收通过；最终门禁完成前不推送交付。交付后停在 **1a0**，等待维护者确认后才进入 **1a**。

## 主要验收材料

1. [24 项表达能力检查表](growth-expression-audit.md)：12 技能、4 职业、4 血统、4 信仰逐项列实际 ID、效果词汇、动作、叠加预算/槽、结果条件/消费/中断；P01–P07 列出相对阶段 0 缺少的通用执行原语、语义和后续归属。合同可表达不等于运行器已实现。
2. [growth-config 初版](growth-config.md)：完整实际 schema 字段目录，类型/范围/样例/跨字段校验/运行归属，以及 schema、moduleVersion、rulesVersion、内容指纹的升级/拒绝规则。
3. [更新后的分步设计](phase1-growth.md)：技术 D02/D04/D16/D17/D18/D19/D20/D22 固定 A，其余 A 是数据样例；取消固定种子奖励分布/目标曲线校准；更新 1a0→1a→1b→1c→1d→1e 和分档门禁。
4. [底座当前合同](architecture.md)：重点见第 3、4、5、6、9 节。

## 实际实现

### 来源、死亡与回收

- `EffectCausality` 保存强类型、纯 JSON 的 effect/root/parent、actor/creditActor/creditParty、类型；嵌套同步作用域显式 null 屏蔽外层，异常清理，不用 RNG/墙钟分配 ID。
- 覆盖真实近战、独立投掷/符文后处理、玩家/怪物法术、反射、反伤/分摊、负转移自伤、否定/寿命、毒/燃烧、位移落地与延期坠层。反射只改责任者，不改 CE 机械 caster。
- 毒/燃烧最后有效刷新者归属；免疫/清除/变形/复活清理相应记录。来源生物死亡/离层不影响 ID 证据。自然环境、地火/气体后续扩散、饥饿没有伪造责任者。
- 终结来源在递归死亡 DF 前捕获；死亡 DF 的同步即时爆炸来自死者，不继承杀死它的人。掘地/粉碎的直接镶墙生物致死叶子带真实施法/反射来源，后续地形/DF 仍无归属。
- 怪物保留原 `kill` 事件顺序并附 origin；玩家另有 exact-once `playerDied`。奖励尚未实现，不能把该事实当成“已发经验”。
- 组件/来源/终结资料在命令、动画最终 checkpoint、回放校验的共同安全边界回收。保留当前/缓存/休眠/携带/待坠层/炼狱及机械引用；不让 everSeen 历史强留组件。独立模块奖励收据不跟尸体一起删。

### 生成事务

- 蓝图实际 checkpoint、楼梯重试与外层楼层进入有真实 begin/commit/rollback 接线。模块事件和出生统一暂存；失败机器/尝试不调用模块、不产生投机模块 RNG/消息。
- 外层提交先按稳定 ID 初始化出生，再按事实产生次序发布缓冲事件；嵌套提交不能提前发布，开放事务拒绝 snapshot。回滚诊断 context 只读。
- 扩展楼层进入失败保留原 Game/runtime/实体对象身份并恢复原世界、RNG、日志/战斗缓冲/确认队列、已知物品、奖励配额、死亡标志和原格图回调/描述记录。内部 CE 重试不倒带引擎随机，实体 ID 不回退复用。
- 楼层外 `buildHordeMachine` 同样有事务。发布钩子写组件、取 RNG、发消息后异常会撤销这些扩展结果及 `disturbed`；渲染只在模拟成功提交后通知。
- 新局纯工厂/数据/状态预检在退休旧局前执行；这不是对任意 Game 命令或任意外部回调提供通用回滚。

### 数据合同与录像版本

- `src/ext/modules/growth/` 有严格类型、惰性 schema、校验/加载器、只读端口/动作结果 DTO、样例 JSON 和 i18n。没有 `eval`、字符串脚本或按样例技能 ID 的生产分支。
- 实际样例正好 24 条定义；另含 67 个原怪物报价及全部配置目录。属性列表可增删，disabled training 可无属性引用；技能/身份/标签/模板/前置均静态校验。
- 校验未知/缺失字段、有限范围、安全整数溢出、重复（不受 JSON 键次序影响）、引用/种类、循环前置、预算/槽/模板、消费条件、真实怪物/物品目录与本地化键。错误带本地化原因和字段路径。
- foundation manifest/snapshot 精确版本为 1；旧缺字段输入拒绝，不迁移。数据模块记录 `{schema,version,fingerprint}`；SHA-256 基于规范键序完整 JSON，连“同版本偷偷改数值”也拒绝旧录像/存档。
- growth 样例：moduleVersion/rulesVersion `1.0.0`，内容指纹 `sha256:28473a0980b7a9d3f01b236038c4aaf0dfab34d803b81854e05e81d25a3a01cd`。
- 默认扩展仍为 example。显式 growth 是仅空状态的数据合同探针，无 XP/角色创建/属性求值/技能/身份 hook 或 command。D22 的实际 create-character 首动作守卫归 1a，未提前开放角色成长玩法。

## 隔离、范围与已知边界

- 经典 `extensionRuntime===null`，不构造来源表/事务/组件，不调用 growth 工厂、加载校验、指纹、规则求值或模块。已有原版 RNG/trace/生成基线的断言未改。
- 本步因果接线在已有/新增生命周期点做扩展 hook 判空；这是额外判空，不声称字面零 CPU 指令。1b 的新增规则策略端口仍须按 D16 在模式组装处选择，经典命中/伤害原算法不做扩展策略求值或附加间接层。
- Game 只新增方法，没有新增实例字段，因此 `scripts/u03-state-contract.json` 无需新增登记。没有增加实体序列化字段，沿现有 WeakMap 挂接。
- creditPartyId 只是施加时证据；实际当前队伍资格/关系版本、creationReason/rewardId、XP 收据及分配归 1a。不能因可靠 source 非空便直接发奖励。
- 纯求值器/真实策略接点归 1b，UI 归 1c，受控动作/资源消费/技能运行器归 1d，身份/怪物模板应用归 1e。没有平衡校准或自然局强弱结论。
- 本步无可见 UI 改动，未做浏览器/手机截图验收；未提交截图、缓存、全量散列或原始日志。原始日志留本地 `tmp-phase1a0-raw/`（执行 checkout 内、已被仓库忽略的本地目录），仓库只保留最终摘要。

## 实际引擎文件与门禁选择

1a0 指定完整/CE档，且本步实际修改对齐 CE 的规则/生成路径，采用：`npx vue-tsc -b`、`npm run build`、`npm run ce:fetch`、完整 `npm run test:full`、`npm run test:drift`。**test:full 替代 npm test，没有重复跑两个全量套件。**

实际变更的引擎/实体文件：

- `src/engine/Combat/Combat.ts`：近战/投掷/转移来源包装
- `src/engine/Core/Game.ts`：实际来源叶子、死亡锁存/回收、事务边界和数据预检
- `src/engine/Core/GenerationCoordinator.ts`：蓝图/楼梯事务及旧世界原位恢复
- `src/engine/Generator/BlueprintEngine.ts`：实际成功/失败 commit/rollback 出口
- `src/engine/Map/DungeonFeature.ts`：会话回调/描述去重的无副作用 checkpoint
- `src/engine/Systems/Logger.ts`：日志/战斗/确认/打断的无副作用 checkpoint
- `src/entities/Creature.ts`：状态来源和实际伤害通知
- `src/entities/Monster.ts`：毒/火清理、寿命终结、on-hit 真实来源
- `src/entities/Player.ts`：物伤类别与无来源饥饿伤害

新增测试五份：`ext_causality`、`ext_bolt_causality`、`ext_generation_transactions`、`ext_growth_config`、`ext_growth_foundation_contracts`；共 116 项本步断言用例。既有测试文件、黄金 trace 和生成基线未修改。独立只读复核提出的两项问题（直接掘地/粉碎来源、楼层外蓝图发布后的打断泄漏）均已修复并新增回归。

## 运行环境中断说明

首轮冻结代码门禁的类型检查/构建/CE参照复核通过后，完整 test:full 尚未结束时云端执行环境被替换。旧进程会话已不存在，/tmp 原始日志丢失，没有取得完整套件退出状态；该轮不计完整验收通过。恢复后生产/测试树散列与冻结值一致，重新从类型检查开始跑完整一轮；日志改存已忽略的工作区目录以保留后续证据。没有以定向复跑或中断前的输出拼接成全量通过。

## 最终门禁原文摘要

尚无完整/CE与drift终态，不得将此前定向测试当成本轮全量结果。最近一轮原文摘要：

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=17 2026-10-02T03:04:50Z
END build EXIT_CODE=0 DURATION_SECONDS=22 2026-10-02T03:05:12Z
✓ 968 modules transformed.
✓ built in 5.41s
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T03:05:12Z
START test-full 2026-10-02T03:05:12Z
```

完整 test:full：未取得退出状态；CE 对照用例未取得完整执行结果，不能视为通过。test:drift：本步尚未执行。原有构建 >500kB 提示保留。

冻结的生产/测试/脚本/资源树聚合 SHA-256：`b2260b4931d88bcb6a7306a6810d432a25248382ca991296693ed80930f20ee4`。各次服务恢复后核对相同；完整门禁后仍须再次核对。散列清单不提交。

合入 main 前，维护方仍须按用户要求在本地另行完整运行 `test:full`。本步不会执行该合并。

补充环境事实：后续完整套件在4/2/1 worker与4096/1536/1024MiB配置下均遇exec-server断开；前三轮旧会话明确不存在，第四轮最近日志仅RUN、未见具体测试结果。出现过明确 HTTP 503 Service Unavailable，不能认定OOM或测试断言失败。没有改测试超时/断言/集合，也没有以定向结果拼接全量。
