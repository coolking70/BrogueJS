# 阶段 2 独立叙事模块设计

> 状态：维护者已确认 P2-D01/02/03/04 全 A；2a0 已验收，2a1 已验收，2b 已验收，本轮批准从 `5af90ce` 实施、独立验收 2c 剧情事件与可选奖励。2d–2e 尚未授权自动开工。设计原始事实基线为阶段 1 验收提交 `0f0dfc1`；2a0 实施基线为 `2c27ab1`，历史证据见 [2a0 报告](phase2a0.report.md)、[2a1 报告](phase2a1.report.md)。下文是完整阶段目标；2b 负责世界对象、放置、open/choose/close、输入 gate 与存读录像，全局剧情事实/奖励 flush 属本轮 2c；正式对话 UI 仍属后续步骤，实际实现及门禁见 2c 报告。总原则以 [路线](README.md) 与 [底座架构](architecture.md) 的新产品合同为准。

## 1 结论与范围

先做可单独验收的 **2a0 模块组合与物理可移除底座**，再做 `narrative`。不能在“扩展模式等于 growth”菜单上继续叠叙事，再把能关闭开关称为独立模块。2a0 已独立验收，2a1 纯内核已交付，2b 已验收，维护者现已另行授权 2c；本步交付后仍须等待维护者批准，不能自动进入 2d 或其它后续步骤。

阶段 2 的最小完整交付为：可交互的中立 NPC、条件与效果驱动的对话图、立绘占位展示、可重复验证的剧情事件、自己的存档块和录像输入版本。只硬依赖底座；独立启用时不安装、不初始化、不调用 growth 也能开局、游玩、存读、录像、seek 与续录。

新产品允许直接修改引擎与有意修改原规则；不再承担 classic CE 兼容、经典零调用或中性战斗对等义务。旧守卫需要调整时说明“原规则 → 新规则、理由、受影响测试及新断言”，不能用大面积删断言代替验证。仍保留命令边界、实质 RNG 确定性、精确版本和可复现录像。没有 CE fetch/full/gen 前置；具体门禁见第 12 节。

### 1.1 独立性硬合同

- 稳定模块 ID 为 `narrative`，实现、专属 UI、测试与数据归 `src/ext/modules/narrative/`；阶段 1、3、4、5 各有自己的 ID、目录、数据版本和状态，不预定后三者的名字
- 不导入 `modules/growth` 或其它阶段的实现、类型、数据、UI；不声明它们为 `dependencies`。真正通用的 JSON、事件、世界交互、时间、占位/多格、UI 容器等由底座所有，禁止把通用代码放进 narrative 再让别人借用
- 开局可选任意已安装模块子集，包括空集；本次不替维护者决定最终默认组合。一局内集合固定，不做运行时热启停；变更选择另开新局
- 单模块及所有已实现模块的任意子集均须开局、play/save/replay 成功。阶段 2 完成时实测 `{}`、`{growth}`、`{narrative}`、`{growth,narrative}`；阶段 1–5 全部存在时是 32 个子集，不以 pairwise 代替全集启动/存读/录像冒烟
- 同一模块集合、规则包、种子、命令序列得到相同机械结果。不同集合允许玩法与实质 RNG 轨迹不同，不要求含叙事与无叙事同骰
- 未启用 narrative 时无 NPC、触发器、对话状态、叙事命令/UI/资源加载或 RNG 消耗；未使用的软联动不改变其它模块状态/费用/消息。通用底座可以存在空能力入口，不继承旧“所有扩展零调用”测试义务
- 删除 narrative 或任何其它阶段的目录及其数据后，余下产品可编译并通过余下模块自己的测试。实际迁移与删除矩阵见第 3 节、2a0 与 2a1 报告，不将未执行的未来模块组合写成已通过

### 1.2 本阶段不默认加入

自由文本/LLM 对话、任意脚本、联网剧情、战斗中实时对话、关系好感大系统、商店/任务物品、可伤害/巡逻/跟随 NPC、复杂过场、地图重写、世界地图/部队、多格单位。后四类能力即使未来需要，也不能变成 narrative 的隐式底座。

## 2 已核对的实际接口与缺口

以下表格保留对原始设计基线代码的核对，并非 2b 当前候选的能力清单。2a0/2a1 已完成的发现、所有权和纯内核改造以各步报告为准；后文标为“拟新增”的接口不能当作现成功能。历史资料 [phase1e.report.md](phase1e.report.md)、[growth-config.md](growth-config.md) 描述阶段 1 实现与旧验收，不覆盖本次新原则。

| 实际位置 | 已有能力 | 阶段 2 要处理的缺口 |
|---|---|---|
| `src/ext/catalog.ts` | 注册 example/growth，`DEFAULT_EXTENSIONS=['growth']` | 静态导入具体模块；物理删除 growth 会断编译，默认值也不能代表新产品最终选择 |
| `src/ext/registry.ts` | ID/精确版本/指纹验证；ID 排序与硬依赖拓扑排序 | 没有自动发现/可选能力协商；模块注册顺序不能成为剧情顺序 |
| `MainMenu.vue` | extended 分支必走 growth 身份创建 | emit 尚无自由模块列表；没有 narrative-only 或空集的正式菜单开局 |
| `App.vue`、`ThemeHud.vue`、`src/ui/useGrowthCharacter.ts`、`components/growth/` | growth UI 与显示暂停 | 模块外静态导入 growth 类型/实现/面板；移除模块目录仍有悬空依赖 |
| `Game.startNewGame` / `ExtensionRuntime.validateInitialCommands` | 开局前纯校验完整初始命令批次；按模块顺序每个要求初始化的模块一条 | UI 必须按所选模块生成批次；narrative 不应伪造 create-character 或强迫 growth 初始化 |
| `ext/types.ts` / `runtime.ts` | 模块命令、私有 state、命名空间组件、同步生命周期、只读 DTO、引擎 RNG | 没有中立 NPC 创建/对话/世界交互端口；`CreatureView` 也没有可靠可交互/可见性事实 |
| `ext/definitions.ts` / `modules/example` | npc/dialogue 的早期数据形状与引用校验 | 只是样例，不生成 NPC、不解释剧情；旧 NPC 强制 enemyTemplateId，不可作为 narrative 对 growth/敌人模板的依赖 |
| `context.grantReward` → `rewardGranted` | 可信发行者 ID、奖励 ID/实例 ID，经命令/钩子发事件 | 没有返回领取状态、能力查询或降级结果 |
| `growth/module.ts` 的 `rewardGranted` | 根据自己的 story 报价入 pending，settle 写 storyReceipts/XP | 未知 rewardId 或无接收实体直接抛错；默认 `sources.story=false` 且 `rewards=[]`。无判断地广播不是安全软联动 |
| `runtime.settle` / `dispatch` | `simulationSettled` 按模块顺序同步派发，保存前结算 | growth 在 narrative 前时，后者结算内新发奖励会错过 growth 本轮处理；需要分阶段排空，不能等下一条输入补到账 |
| `runtime.command` | 回滚模块状态、组件与有限 HP/STR/gold 快照 | 不是任意地图、物品、实体、消息、RNG 的完整事务；不能把重世界效果塞进去后声称可全部回滚 |
| `runtime` 的 rulePolicies | 每个同名端口只准一个 provider | narrative 默认不占战斗策略端口；未来阶段与 growth 组合需底座组合协议，不靠移除冲突检查放行 |
| `Monster.ts`、`ext/birth.ts`、`runtime.actorFacts` | 现有怪物主要按 isAlly/敌对与俘虏例外解释 | 不能把 NPC 简单设为 isAlly=false 称中立，也不能伪装俘虏或套 growth 中性模板代替关系规则 |
| `App.vue: wireConfirmRequest`、`Input.ts`、`ui/modalKeyboard.ts` | 原生 `window.confirm`、优先级键盘拦截；角色页可暂停帧推进 | 当前无已验证的统一界面内弹窗服务；main 计划中的统一层只能作接口方向，实施前必须再查实际提交 |
| `tsconfig.app.json`、`scripts/test-suites.json` | TS 包含全部 src；测试清单仍有模块外 ext_growth 测试 | 只删生产目录会留下类型与测试导入；删除测试所有权/清单也必须设计，不能随手排除失败测试 |

进一步审计范围：Game 的扩展拒绝文案仍引用 `ext.growth.command.rejected`；公共 HUD 的 showCharacter/hasGrowthPoints 等字段以及全局 locale 中的 growth 文本也有历史耦合。底座应有自己的通用拒绝文案和 UI 插槽。所有这些只是已查到的迁移清单，不是已完成修复。

## 3 2a0 底座先决改造与可移除检查

### 3.1 发现与注册 不靠手写模块导入总表

拟采用“按约定目录发现纯 descriptor，再按选择创建模块”的方案。每个模块提供 `descriptor.ts`，包含自己的 moduleId、版本、rulesIdentity、可选 UI 槽位与工厂；不在顶层注册、创建游戏状态、耗 RNG 或发请求。通用 catalog 不再导入任何具体阶段目录。

可落地实现：Vite/Vitest 入口用受支持的 `import.meta.glob('./modules/*/descriptor.ts', { eager:true })` 收集 descriptor，由纯函数校验并按 moduleId 排序；UI descriptor 与业务模块同目录，通过通用 UI registry 映射插槽。eager 只允许加载纯声明，不等于创建未选模块实例。模块的数据可随 descriptor 纯导入，重资产由展示时加载；若体积需要再改 lazy，先在开局前全部 resolve 并锁定清单，不能让网络/Promise 到达顺序参与模拟。

普通 Node 脚本不直接解释 Vite glob：只枚举相同目录中的元数据或经 Vite/Vitest 加载 catalog。不要维护第二份手写模块名单。类型层只引用底座 `ModuleDescriptor` / `ModuleUiContribution` / DTO；不用将所有模块类型联合静态导回底座。

`dependencies` 不承载阶段间依赖。底座版本要求独立校验；可选能力声明是纯描述，不参与硬依赖拓扑。加载分三步：发现并校验已安装包 → 确认用户启用集合及精确版本 → 对该集合完成能力解析与稳定排序，再建局。缺失的展示图片走占位，不阻挡组合；已启用的坏规则包必须在退休旧局前拒绝。已安装包的语法/构建错误仍应报错，不承诺用禁用开关掩盖损坏的源码。

### 3.2 UI 与数据也归模块

建议目录合同，名称均为待实施方案：

```text
src/ext/
  catalog.ts                 # 仅通用发现入口
  registry.ts / runtime.ts    # 注册、同步执行、版本、能力协商
  foundation/                # 通用交互、只读事实、事件与提交能力
  ui/                        # 通用模块选择器、创建步骤、HUD/面板插槽
  modules/
    growth/
      descriptor.ts / ui/ / tests/ / data/ / locales/
    narrative/
      descriptor.ts / index.ts / module.ts
      schema.ts / types.ts / conditions.ts / effects.ts / triggers.ts
      state.ts / view.ts / ui/ / tests/
      data/definitions.json / data/portraits.json / locales/zh_CN.json
```

- 将现有 growth 面板、composable、专属测试/夹具/locale 迁入自己的所有权边界；原有与底座混合的测试拆出通用部分，通用测试用小型测试 descriptor，不导入真实 growth
- App/MainMenu/ThemeHud 只渲染通用 slot 与 creation step。没有 growth 时不出现其身份、属性、技能入口；启用 growth 才显示它提供的步骤。narrative 没有创建步骤时直接加入 manifest
- 模块私有数据放其 data 内。美术若需 public 静态路径，应从自己的 source assets 生成 dist，不遗留不可枚举的外部公共副本；manifest 记录所有权，删除目录后不再复制该资源
- i18n 通用壳只留底座文案，模块 locale 由模块 descriptor 注册。显示文案与逻辑 ID 分离；不为新增 NPC ID 写 switch/if
- 当前 `example` 视为开发样例，迁到测试 fixture 或明确非玩法展示目录，不进入正式模块选择器；其删除也不得破坏产品

### 3.3 测试发现与防漏

2a0 新增 `scripts/check-module-boundaries.mjs` 和 `scripts/check-module-removal.mjs`；以下是验收合同，具体真实执行结果见 2a0 报告，不把脚本存在当作已通过。

边界检查须解析 TS import/export、动态 import、Vue script、资源引用及测试清单，而非仅 grep：

1. 模块 A 不得直接引用模块 B（含 type-only、别名、相对路径与数据）；模块外不得引用具体模块实现。唯一发现入口允许目录 glob，不允许具体模块路径字面量
2. 所有模块专属文件与测试均有 owner；删除包不会遗留全局测试 import、locale、构建拷贝路径。跨模块测试在通用兼容测试目录以发现式 fixture 运行，对缺席组合标记“本构建不存在”，但必须运行余下适用组合
3. 生成“发现文件集合 vs 已登记测试集合”比对；未登记或重复登记直接失败。不得用 catch import error、skip、宽泛 exclude 把真实剩余测试藏掉
4. npm test、ext 专项与测试清单守卫共同使用一份发现结果；保留底座/非模块测试。静态 gen/drift 清单无需因删除模块大改，但不能残留模块路径

物理移除脚本必须在**独立临时副本**执行，复制当前候选树而不是只取旧 HEAD，排除 .git、dist、构建缓存；记录候选输入 hash。不得在工作树删目录。每个用例先实际移除所有权清单中的目录与数据，再清理 TS/Vite 缓存，随后重新发现，并运行 boundary、typecheck、build、全部剩余 ext 测试及全部剩余模块子集的新局/save/load/replay/seek/续录 smoke。**从 2b 起真实删除行不再重复完整 npm test；正常候选树仍必须完整跑一次。** node_modules 可复用只读依赖；不得复用旧 dist 或旧 tsbuildinfo，也不隐藏已有 CE 缓存。2a0/2a1 的旧完整删除门禁结果保留原样。

脚本 `--profile=auto` 默认枚举全部目录保留子集，对未删目录行用 full，对实际删除行用 removal；显式 `--profile=full` 或 `--profile=removal` 只选对应行，与 `--retain` 不匹配即报错。full 包含完整 `npm test`，与 CE `test:full` 无关。正常 full 已单独执行时运行 removal 档，不再在删除副本重复完整 npm test。`--plan` 与最终 evidence 按行列档位和真实门禁命令，并单列正常 full 的 required/是否包含/实际状态；没有运行的完整测试不能记为通过。`--prepare-only` 仍只算准备，`--engine-only` 仍保留浏览器未验证标记。

### 3.4 删除矩阵与预期

| 临时副本实际保留的阶段目录 | 对应正式新局 | 必须成功 | 必须拒绝 |
|---|---|---|---|
| growth、narrative 都保留 | 空集、growth-only、narrative-only、两者 | 正常 full 门禁一次，含完整 npm test；四种组合各自真实新局/save/load/replay/seek/续录 | 未选择模块的命令 |
| 删 growth 整目录与专属数据/测试 | 空集、narrative-only | removal 门禁；底座+narrative 全部 ext 测试与两种组合 smoke；无需 growth 初始化/资源 | manifest 明确要求 growth 的旧档/录像 |
| 删 narrative 整目录与专属数据/测试 | 空集、growth-only | removal 门禁；底座+growth 全部 ext 测试与两种组合 smoke；无叙事资产请求 | manifest 明确要求 narrative 的旧档/录像 |
| 两者全删 | 空集 | removal 门禁；底座全部 ext 测试与空模块真实新局/save/load/replay/seek/续录 | 要求任一缺失模块的输入 |
| 阶段 3–5 后续存在 | 已安装集合的任意子集 | 每删一个阶段的余下编译与自测；全保留时 32 种启动/存读/录像；发布候选扩展为所有目录保留子集 | 要求已删除模块的输入，及未实现的能力版本 |

当前只验证软件中启用/禁用的测试不算物理可移除证据。删除某模块后读取**要求该模块的旧存档**应明确不兼容；这与新建无该模块的合法局、叙事可选联动缺席正常是两个合同。不得静默剥除旧档块或把缺席模块重置后读入。

### 3.5 通用底座能力的归属

- 通用 UI modal 容器、输入 capture、显示暂停、世界交互对象、事实序号、受控提交、可选能力 registry 属底座
- 多格 footprint、寻路占位、目标面积、视野与大型单位序列化等若阶段 4/5 需要，也先成为底座能力，再由各模块使用；阶段 2 仅 1×1，不抢做多格实现
- narrative 专有部分只有 NPC 内容绑定、对话条件/效果解释、剧情触发/收据/日志、叙事 UI 读模型
- 无能力消费者时，相关通用能力自身不改变该组合的规则、状态或 RNG。独立获准的基础玩法重设计可以改变所有组合的共同基线，但须作为另一项明确变更验收；仅在报告写明不能豁免未使用能力的零影响合同

## 4 模块与软接口

### 4.1 narrative 独立入口

`narrative@1.0.0` 是建议的首个发布版本。自己的包具有 schema、moduleVersion、rulesVersion；自己的状态具有 state schema；自己的命令 payload 带 input version。注册使用现有精确 `rules: {schema,version,fingerprint}` 思路，版本升级不能借用 growth 版本。

2a1 基线 manifest/底座包络为 schema/foundation=1。2a0 只改发现/UI 未改变该版本；2b 按第 5 节新增通用交互对象或第 8 节新增持久字段时，须升级底座包络/读取器与对应 manifest 标识（建议新合同为 2），明确拒绝旧格式。不能在现有 validator 不接受时提前写成可读取；实施版本与验证结果在 2b 报告登记。模块自身仍用 `extensions.modules.narrative` 与 `narrative:*` 命名空间，不另造顶层 narrative 存档。

### 4.2 能力协商草图

以下为拟新增底座接口，不是当前 TypeScript API：

```ts
type CapabilityId = string;
type OptionalResult =
  | { status: 'applied'; receiptId: string }
  | { status: 'skipped'; reason: 'absent' | 'disabled' | 'unsupported-key' };
interface OptionalIntent {
  capability: CapabilityId;
  operation: string;
  key: string;
  instanceId: string;
  recipient: 'player';
}
type OptionalPreparation =
  | { status: 'ready'; planId: string }
  | { status: 'skipped'; reason: 'absent' | 'disabled' | 'unsupported-key' };
interface PublicPlayerCharacter {
  level: number; professionId: Id | null; lineageId: Id | null; faithId: Id | null;
}
type OptionalPlayerQuery =
  | { status: 'available'; value: Readonly<PublicPlayerCharacter> }
  | { status: 'unavailable'; reason: 'absent' | 'disabled' | 'unsupported-version' };
interface OptionalCapabilities {
  // 纯、冻结、来自本局启用集合，不查网络，不取 RNG。
  supports(capability: CapabilityId, operation: string, key: string): boolean;
  // 只查询当前玩家公开事实，返回深拷贝/深冻结DTO，不接受actorId。
  queryPlayer(capability: 'growth.public-character.v1'): OptionalPlayerQuery;
  // 纯预检；planId只在当前命令内有效，不暴露其他模块 state。
  prepare(intent: Readonly<OptionalIntent>): OptionalPreparation;
  // 真正入队/提交由底座内部完成；提交完成才产生 OptionalResult。
}
```

实际实现须区分 preflight 的“可以受理”与提交后“已应用”，不能入队后尚未结算便谎报 applied。预检返回固定 plan，底座原子提交后产生上列结果；plan不序列化，不能跨命令/会话复用。capability ID/version 是底座协议字符串；provider 用底座类型实现，consumer 不 import provider。每个能力 version 的输入/输出 schema、处理顺序和无 provider 语义均登记；本阶段每种能力最多一个 provider，重复供应在开局前拒绝。以后多提供者合成必须另有明确叠加规则。`queryPlayer`无provider/关闭/不支持版本返回unavailable，条件按显式onUnavailable求值；合法available中的null身份只是未选择身份，eq为false，不能冒充能力缺席。provider返回非有限等级、错类型、额外隐私字段等非法DTO是实现错误，应在前置校验拒绝，不降级成unavailable；query不写状态、不耗RNG。

### 4.3 全部预期联动点

| 联动 | consumer → provider | 缺席/关闭时 | 本阶段范围 |
|---|---|---|---|
| 剧情 XP | narrative → `growth.story-reward.v1` | skip，并记已处理的叙事收据；不补发、不报错 | 可选首版；growth 只有 story 开关开启且存在 rewardId 才声明 supports |
| 玩家身份/等级条件 | narrative → `growth.public-character.v1` | 每条条件显式 `onUnavailable`；推荐旁支 false，另有无 growth 可用的主线选项 | 可选首版；只公开玩家字段，不读 NPC 隐藏成长组件 |
| 叙事赠技/属性/资源 | narrative → 将来的成长授权能力 | 未支持就不显示为可领取，不用直接改组件替代 | 后延，非首版 effect 枚举 |
| 对话期间停模拟 | narrative → 底座 interaction gate | 底座必须有；没有属于安装不兼容 | 必需，不能依赖阶段 3 暂停机制 |
| NPC 与场景放置 | narrative → 底座 world-interactable | 底座必须有 | 必需；独立于 growth 怪物模板和多格模块 |
| 战斗结果触发剧情 | narrative ← 底座已提交死亡/入层/拾取事实 | 未启用其它阶段仍有基础事实；高级战斗事实无 provider 时不存在 | 只订阅声明的事实，不倒查其它模块私有 state |
| 阶段 3 战斗/篝火、阶段 4 Boss、阶段 5 世界事件 | narrative ↔ 将来的版本化可选事件/意图 | 没有该模块只禁用对应旁支；基础剧情仍能结束 | 只预留协议方向，不定义未实现具体 ID、不硬连接 |
| 立绘 | narrative → 自有资产 manifest / 底座媒体展示 | 缺图、加载失败都显示本地占位 | 首版不影响规则、录像或 RNG |

`growth` 当前默认 story 关闭且 rewards 为空。因此默认组合中的示例剧情不能许诺 XP；读模型根据实际 capability 显示“记录线索”等已实现结果，不显示虚假的“+20 XP”。演示 XP 时用独立测试/样例配置同步声明双方 rewardId 与 growth 自有 amount/reasonKey，叙事包不硬编码 XP 数额。growth 缺席和未报价均走明确 skip；支持声明与执行不一致是配置错误，不静默吞异常。

### 4.4 顺序与确定性

开局还有一个必须补齐的边界：当前首次enteredLevel可早于growth的create-character，不能直接在该钩子里发剧情XP。后续世界/事实接入拟提供统一的run-ready安全点（2a0/2a1尚未实现）：先创建原世界与录制起点，按既有顺序执行所有已选模块要求的初始化命令，最后由引擎执行且记录一次底座boot-complete提交，才排空初次入层剧情/放置事实并允许普通输入。无growth时初始化批次可为空，仍完成同一边界；不要求narrative造一个成长初始化命令。boot-complete是拟新增的受限引擎命令（具体名称实施时固定），只允许初始化阶段一次，不能被玩家任意重发；重放消费同一事件，load不重放。若采用等价自动边界，必须在录像起点/末初始化命令的checkpoint中明确归属并证明相同效果，不能留下未记录的开局尾变更。

所有模块先按稳定 ID 构建；能力解析在初始化之前完成，不按 UI 勾选顺序或文件枚举顺序。每条命令的安全边界拟明确为：

1. 接收已提交的引擎事实，分配单调 factId；按产生顺序保留，不凭回调时间排序
2. 各模块预处理事实，剧情触发按 `priority` 降序、triggerId 升序；同一 effect 列表按数据顺序
3. 形成自有状态补丁与可选意图；可选意图按 originating factId、moduleId、effect index 排队
4. 有界排空意图和其明确允许的新事实，提交 provider 的状态/资源计划；growth 奖励在此轮最终资源结算前到达
5. 原生资源与派生值结算，GC，再记录最终 checkpoint；队列必须为空

通用事实序号由底座持久 `extensions.foundation.nextFactId`（拟升版包络字段）分配，load/seek/续录从同一保存值恢复，只在成功提交时前进；被拒绝的预检和显示不分配，回滚恢复计数。每个原生事实只包装一次，重复读取/保存/checkpoint不能再发事实；这是拟新增底座合同与版本变更。

不以再次调用整个 `simulationSettled` 到“不变”为算法，否则可能重复 first-visit/奖励。后续2c须设计新的分阶段安全点或一次性队列 flush，并把现有 growth 的 pending 收口迁入；所有组合测试覆盖。descriptor发现、工厂、initialState、校验、显示查询、load/unload禁用 RNG；已授权的同步 onNewGame 等模拟钩子仍沿既有引擎RNG权限合同。narrative首版自身初始化与对话条件均不取 RNG。首版剧情效果和放置默认无随机项；以后若加随机分支，只能在已接受的命令/事实提交内调用 `context.randomInt`，持久保存选择结果，升规则版本并补抽取计数测试。

## 5 中立 NPC 与世界边界

### 5.1 推荐的首版实体合同

本节及以下示例采用维护者已确认的 P2-D03 A；世界实体的实际实施仍属 2b。推荐采用底座的 **单格固定驻点、可穿行、非战斗交互对象**。它是有稳定 entityId/ownerModuleId/位置/可见性规则的真实世界交互实体，由地图渲染与目标选择读取；不是 DOM 上贴一个永远可点的 NPC。它不进入 Monster 的 hostile/ally 二分，也不伪装 isCaged。

拟新增 `WorldInteractable` 保存于底座世界对象区，拥有 run-local entityId、owner module、archetypeId、depth、x/y、enabled。使用底座统一 ID 分配并保存计数，读档/缓存层/GC 均覆盖。NPC 的 narrative 绑定、对话入口和剧情状态仍放自己的模块区；底座只知道通用交互对象。初版不是 `Creature`，不自动获得 growth progression/attributes，也不需要怪物模板；以后若需要可战斗 NPC，再扩展通用 actor/relationship 能力，不把战斗模型塞入 narrative。

规则默认：

- 不移动、不攻击、不被攻击选中，不承受状态或环境伤害，不阻挡移动、视线或射线；玩家同格时仍可从附近列表点选。对象不替代地形，不盖住危险提示
- 开口距离为配置的 Chebyshev 距离 1，允许同格；要求当前层、已启用、玩家存活、位置可见且交互线可达。斜角不能隔双墙交谈，底座统一验证
- 同格有多个交互对象时先显示按优先级/ID 排序的选择器；不能用“数组第一个”当对话目标。自动探索/跑动不自动开对话，防止远距离泄漏与弹窗抢输入
- NPC 非战斗性必须在检查文字中说清。不允许默认配置把这类对象塞在唯一必经狭道后宣称能阻挡玩家
- 所有地图绘制、触摸、附近列表、检查详情使用公开可见 DTO；不向 UI 暴露未遇 NPC、完整剧情 flags、未公开触发条件或未来对白

如果维护者选择可伤害/巡逻 NPC，这一合同必须升级为底座统一关系、AI、碰撞、伤害、复活/掉落等能力，并先补通用测试；不能只给 Monster 加一个 neutral 布尔就交付。

### 5.2 放置合同

首版配置指定深度范围、每局/每层次数、候选规则与 no-space 策略，禁止代码中检查某个 NPC ID。推荐在首次入层的世界提交安全点，为“可见区域附近的安全落脚候选”按稳定顺序筛选，排序规则为入口距离、y、x；范围、离楼梯最小距离等来自数据。

- 先预检整个放置批次与 ID/对象预算，再提交；不在投机生成回调中直接创建对象。当前 `afterLevelGeneration` 本身不提供写世界权限，拟通过专门的底座放置 plan 接口完成
- 不覆写墙/门/陷阱/物品/机器、地图生成器结果或原生生物占位；不因没位置反复生成楼层。无候选时按包内 `onNoSpace` 明确 skip 或保留 deferred 待下一次合法入层，不通过 while 随机试到成功
- 每条 placement 用稳定 instanceKey 与收据去重；重访/load/seek 不重放置、不重复消耗 entityId。缓存层与移除对象保持生命周期一致
- 会改变世界对象、显示与交互结果，必须验真实引擎场景；如果实际改到地图生成逻辑或基线受影响，再加 drift 与按需重录。采用提交后非阻挡对象不等于已经证明地图/随机数零影响

## 6 数据合同与校验

所有下列形状是设计目标，不是已存在 TS。原 `ext/definitions.ts` 的演示 NPC/dialogue 不扩成与 growth 混用的巨大总包；叙事实现自己的 schema，仅引用底座通用类型/校验工具。

### 6.1 TS 形状

```ts
type Id = string;
type TextKey = string;
type Scalar = boolean | number | string;
type Cmp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
type Condition =
  | { op: 'true' }
  | { op: 'all' | 'any'; args: Condition[] }
  | { op: 'not'; arg: Condition }
  | { op: 'flag'; id: Id; equals: Scalar }
  | { op: 'counter'; id: Id; compare: Cmp; value: number }
  | { op: 'depth'; min: number; max: number }
  | { op: 'event-field'; field: 'firstVisit' | 'npcId' | 'choiceId'; equals: Scalar }
  | { op: 'optional-player'; capability: 'growth.public-character.v1';
      field: 'level' | 'professionId' | 'lineageId' | 'faithId';
      compare: 'eq' | 'gte'; value: number | string; onUnavailable: boolean };
type Effect =
  | { kind: 'set-flag'; id: Id; value: Scalar }
  | { kind: 'add-counter'; id: Id; amount: number }
  | { kind: 'journal'; entryId: Id }
  | { kind: 'message'; textKey: TextKey }
  | { kind: 'emit-story'; eventId: Id }
  | { kind: 'optional-reward'; capability: 'growth.story-reward.v1';
      rewardId: Id; receiptId: Id; onUnavailable: 'skip' };
interface Choice {
  id: Id; textKey: TextKey; condition: Condition;
  unavailable: 'hide' | 'disable'; unavailableKey: TextKey | null;
  effects: Effect[]; next: Id | null;
}
interface DialogueNode {
  id: Id; textKey: TextKey; portraitId: Id | null; choices: Choice[];
}
interface DialogueDefinition {
  id: Id; entry: Id; nodes: DialogueNode[];
}
interface NpcDefinition {
  id: Id; nameKey: TextKey; descriptionKey: TextKey;
  glyph: string; color: string; portraitId: Id | null; dialogueId: Id;
  presence: 'stationary-interactable'; interactionDistance: number;
  placements: { id: Id; minDepth: number; maxDepth: number;
    maxPerRun: number; maxPerDepth: number; minStairDistance: number;
    maxEntranceDistance: number; onNoSpace: 'skip' | 'defer' }[];
}
type TriggerEvent =
  | { kind: 'entered-level' }
  | { kind: 'npc-interacted'; npcId: Id }
  | { kind: 'dialogue-choice'; dialogueId: Id; choiceId: Id }
  | { kind: 'story'; eventId: Id };
interface Trigger {
  id: Id; on: TriggerEvent; priority: number; condition: Condition;
  repeat: { kind: 'once-per-run' } | { kind: 'once-per-depth' }
    | { kind: 'bounded'; maxFirings: number; cooldownTurns: number };
  effects: Effect[];
}
interface NarrativePack {
  schema: 1; moduleId: 'narrative'; moduleVersion: string; rulesVersion: string;
  stateVersion: 1; inputVersion: 1;
  config: {
    timePolicy: 'free-frozen'; closePolicy: 'close-session';
    limits: { conditionDepth: number; conditionOpsPerCommand: number;
      effectsPerCommand: number; eventsPerCommand: number;
      transitionsPerSession: number; maxActiveNpcs: number;
      maxJournalEntries: number; maxReceipts: number };
  };
  flags: { id: Id; type: 'boolean' | 'integer' | 'string'; initial: Scalar;
    // integer/string 必须声明范围/枚举，不是任意世界字段路径。
    min: number | null; max: number | null; values: string[] | null }[];
  counters: { id: Id; initial: number; min: number; max: number }[];
  npcs: NpcDefinition[]; dialogues: DialogueDefinition[];
  journal: { id: Id; titleKey: TextKey; textKey: TextKey }[];
  storyEvents: { id: Id }[]; triggers: Trigger[];
}
```

首版触发白名单刻意限定为入层、交互、选项与本模块事件；已有 kill/itemPickedUp 等引擎事实可后续增加强类型选择器，但未在本版联合中声明就不能在 JSON 偷用。`event-field` 的可用字段由事件类型再次收窄：不支持的字段是配置错误，不是 undefined 隐式比较。

### 6.2 可运行含义完整的 JSON 样例

所有名称与数值是原创演示，可换数据，不代表最终内容或强度。对应词条写入模块 locale，`portraits.json`必须声明下文的 `archive.keeper.neutral` 占位；该外部资产引用不是缺失容忍的任意ID。样例只有一位 NPC 和一个对话节点，能无 growth 独立完成；选择读取线索会写日志、标记与一次事件。第二次见面该项禁用，离开始终可用。

```json
{
  "schema": 1,
  "moduleId": "narrative",
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "stateVersion": 1,
  "inputVersion": 1,
  "config": {
    "timePolicy": "free-frozen",
    "closePolicy": "close-session",
    "limits": {
      "conditionDepth": 8,
      "conditionOpsPerCommand": 256,
      "effectsPerCommand": 64,
      "eventsPerCommand": 32,
      "transitionsPerSession": 128,
      "maxActiveNpcs": 32,
      "maxJournalEntries": 256,
      "maxReceipts": 4096
    }
  },
  "flags": [
    {"id":"archive.read","type":"boolean","initial":false,"min":null,"max":null,"values":null}
  ],
  "counters": [],
  "npcs": [{
    "id":"archive.keeper",
    "nameKey":"ext.narrative.npc.keeper.name",
    "descriptionKey":"ext.narrative.npc.keeper.description",
    "glyph":"人",
    "color":"#c3ad80",
    "portraitId":"archive.keeper.neutral",
    "dialogueId":"archive.greeting",
    "presence":"stationary-interactable",
    "interactionDistance":1,
    "placements":[{"id":"archive.first","minDepth":1,"maxDepth":1,"maxPerRun":1,"maxPerDepth":1,"minStairDistance":1,"maxEntranceDistance":8,"onNoSpace":"skip"}]
  }],
  "dialogues": [{
    "id":"archive.greeting",
    "entry":"hello",
    "nodes":[{
      "id":"hello",
      "textKey":"ext.narrative.dialogue.keeper.hello",
      "portraitId":null,
      "choices":[
        {"id":"read-note","textKey":"ext.narrative.choice.read",
         "condition":{"op":"flag","id":"archive.read","equals":false},
         "unavailable":"disable","unavailableKey":"ext.narrative.choice.already_read",
         "effects":[{"kind":"set-flag","id":"archive.read","value":true},{"kind":"journal","entryId":"archive.note"},{"kind":"emit-story","eventId":"archive.read-done"}],"next":null},
        {"id":"leave","textKey":"ext.narrative.choice.leave","condition":{"op":"true"},
         "unavailable":"disable","unavailableKey":null,"effects":[],"next":null}
      ]
    }]
  }],
  "journal":[{"id":"archive.note","titleKey":"ext.narrative.journal.note.title","textKey":"ext.narrative.journal.note.body"}],
  "storyEvents":[{"id":"archive.read-done"}],
  "triggers":[{
    "id":"archive.reward","on":{"kind":"story","eventId":"archive.read-done"},
    "priority":0,"condition":{"op":"true"},"repeat":{"kind":"once-per-run"},
    "effects":[{"kind":"optional-reward","capability":"growth.story-reward.v1","rewardId":"archive.read","receiptId":"archive.reward","onUnavailable":"skip"}]
  }]
}
```

growth 关闭时最后一项记录 skipped，故事照常完成；growth 开启但未声明 `archive.read` 奖励也同样处理。只有双方配置显式连通才发 XP；此样例不是新增 growth 数据的授权。

配套占位 manifest 示例（与上包分离版本，不包含真实素材）：

```json
{
  "schema": 1,
  "displayVersion": "1.0.0",
  "portraits": [{
    "id": "archive.keeper.neutral", "asset": null,
    "width": 240, "height": 320, "fit": "contain", "anchor": "bottom-center",
    "altKey": "ext.narrative.portrait.keeper", "fallbackGlyph": "人"
  }]
}
```

配套本地化最小样例：

```json
{
  "ext.narrative.npc.keeper.name": "档案守卫",
  "ext.narrative.npc.keeper.description": "一位守着残页的旅人。",
  "ext.narrative.dialogue.keeper.hello": "这张残页记着旧通道的位置。",
  "ext.narrative.choice.read": "阅读残页",
  "ext.narrative.choice.already_read": "已经读过这张残页",
  "ext.narrative.choice.leave": "我稍后再来",
  "ext.narrative.journal.note.title": "旧通道的线索",
  "ext.narrative.journal.note.body": "守卫让我读到一条旧通道的线索。",
  "ext.narrative.portrait.keeper": "档案守卫立绘占位"
}
```

### 6.3 校验 预算 与循环

必须在创建世界前纯校验并冻结规则；错误含路径/稳定 code/本地化解释。不允许 unknown key、危险原型键、非有限/非安全数、循环 JS 对象、函数、HTML、脚本字符串或 eval。建议技术硬上限及样例值分开：包可下调执行预算，不能超过底座固定上限；硬上限变化升实现/规则合同并记录。

- 标识与引用：全局 definition ID 唯一；nodeId 在对话内唯一；choiceId 在对话内唯一，便于 trigger 引用；NPC/dialogue/portrait/journal/storyEvent/flag/counter 引用必须存在且类型正确
- 文本与资产：词条键属 `ext.narrative.*` 且当前 locale 有非空文案；颜色有限格式，glyph 限单显示字符/受支持字形；资产 ID 必须在 portrait manifest 声明，文件缺失仅影响占位显示
- 数值：深度/距离/次数/计数均有整数范围；counter 加法事前检查安全整数和 min/max，越界整条选择拒绝，不钳制后偷偷继续；flags 的类型/枚举固定
- 条件：只读且可短路，但 short-circuit 顺序固定；树深样例 8、硬上限 16；每条命令总条件操作样例 256、硬上限 1024。包括 UI 可见选择预览的单次计算也有相同纯预算，不取 RNG
- 图：entry/next 必须存在；不可达节点作为配置错误报告。所有自动 story-event 发射图必须无环，禁止 A→B→A；按全部条件分支分析，不能凭“条件大概互斥”放过自动环
- 手动对话环允许（例如“再问一遍”），每一步必须等待一条显式选择命令，无自动 goto/无限 onEnter；session 最多 128 转移（硬上限 1024）。达到上限允许 close，拒绝继续选择，读模型给明确原因；重新开口不能绕过一次性奖励收据
- 总效果样例 64/命令、硬上限 256；派生事件样例 32、硬上限 128。预算沿整条因果链共享，不让每个新事件重置额度。UI 帧、消息和模块队列不各自偷偷多跑一轮
- `repeat` 限定一次/每层/显式 bounded；bounded 必须 maxFirings 有界、cooldownTurns 非负整数，零时间对话不能推进 cooldown。trigger 的同事实去重由 factId+triggerId，奖励由独立 receiptId，不以“同一回合”去重合法多个输入
- optional-reward 的 receiptId 在包内唯一，首版每个receiptId每局至多兑现一次；instanceId由模块ID/receiptId/固定run作用域规范拼接，只用合法ID字符，不用墙钟或RNG。允许repeat的trigger也不能重复兑付同收据；未来按层/按次奖励须新增显式scope字段及版本，不能自行拼不同sessionID刷奖励
- 日志/收据达到配置上限时新事务拒绝且给诊断，不静默丢弃旧收据导致可刷奖励。包加载要估算 once/per-depth 的最大数量；无限深度或未来世界地图要另定有界生命周期，不能许诺永久无限存储
- optional-player 的 level 只允许数值 gte/eq，身份只允许字符串 eq；onUnavailable 必填。至少保留每节点无可选模块需求的离开入口；主线完成必须在 narrative-only 自动遍历验收，不能只凭单一条件的语法检查宣称可通关

### 6.4 执行与失败原子性

接受命令前，基于冻结 facts 与 revision 纯生成整条效果计划，先执行所有语义/预算/引用/能力预检。只提交 narrative state、底座明确支持的交互补丁与已准备的 provider 补丁；消息在成功后发布。拒绝命令无状态、收据、时间、RNG 或录像条目变化。

受控事务必须明确写集和回滚范围。首版不加入地图、背包、战斗资源任意写入，所以不能靠 runtime.command 当前有限快照假装有完整事务。若可选奖励 provider 准备失败则选择整条拒绝；若能力事前声明 absent/disabled/unsupported-key，则提交 skip 收据与其它合法剧情效果。提交阶段出现实现异常必须中止录制来源并暴露诊断，不把部分成功写为正常完成。

## 7 输入命令 时间 与冻结

### 7.1 命令化边界

仍调用 `game.executeCommand('ext:command', JSON.stringify(...))`。拟新增 action 与 payload：

```ts
type NarrativeInput =
  | { module: 'narrative'; action: 'open'; payload: {
      v: 1; revision: number; targetEntityId: number } }
  | { module: 'narrative'; action: 'choose'; payload: {
      v: 1; revision: number; sessionId: number; nodeId: Id; choiceId: Id } }
  | { module: 'narrative'; action: 'close'; payload: {
      v: 1; revision: number; sessionId: number } };
```

不接受 actorId、effect 列表、文本、任意 reward amount、flag 值或下一节点作为客户端权威。引擎从 target 与当前数据求实际 NPC/入口；choose 按当前可选条件重验，不能由 UI 直接写 state。内部 `sessionId` 是持久单调数值；UI 另持不可序列化 session token，防重开/读档后的旧 DOM 草稿误投新局。

- open：确认模块启用、边界安全、NPC 可见/可达与玩家资格后，创建活动会话、分配 sessionId、revision+1，记录一条输入；可触发 npc-interacted，但不能无条件自动重复发奖
- choose：复核 session/revision/node/choice、预算与条件，原子应用效果并转移节点；next=null 关闭会话。成功 revision+1、记录一条；重复点击旧 revision 拒绝
- close：关闭活动会话，清会话而保留已经成功提交的 flags/log/reward；revision+1，记录一条。Escape、关闭按钮、允许的外点都走同一 close，不能仅隐藏 Vue 留引擎卡在会话
- 尚未 open 前的目标选择器取消、滚动、切立绘尺寸、查看日志、焦点移动是纯 UI，不耗时、不记命令。close 已记录的会话也不等于撤销已提交选项
- 录像中 open/choose/close 全部重放；快进/seek 不依赖图像完成加载、不等待用户再选择、不因 modal 打开暂停重放执行器。UI 可随 cursor 只读重建当前对话

### 7.2 推荐时间策略

推荐 `free-frozen`：open、choose、close 均 **0 tick、0 玩家回合**；NPC、怪物、环境、饥饿、成长恢复/CD 在会话期间全部不前进，不能靠谈话恢复资源。纯 story/可选奖励状态可因有效选择改变，所有变化体现在同命令 checkpoint 中。

活动会话时引擎 gate 只接受本会话的 choose/close 和纯显示操作，拒绝移动、等待、物品使用、成长分配/施技、自动推进。菜单可保存/读档/退出，不额外推进时钟；引擎 `isAdvancing` 中不能打开对话，先等当前动作安全落定，禁止 mid-turn freeze。

UI 的显示暂停与引擎 gate 双层保护：清 held input、停止自动步的发起、屏蔽地图点击；引擎也必须阻止直接命令/脚本绕过 UI。关闭后不自动续跑之前的自动探索/长休息，避免谈完马上走进危险；这属于明确命令规则，录像重放相同。NPC 的固定驻点策略与此全世界冻结是不同概念。

如果选“一次开口耗一行动”方案，费用必须先通过底座通用行动服务结算，世界反应后重验玩家存活/NPC可达再开会话；不能 open 后边显示边让敌人动。需新增输入版本与测试，不把 UI setTimeout 当模拟时钟。首版推荐不做该复杂化。

### 7.3 拒绝与打断

会话中切新局/load/seek 由原有边界整体替换会话，旧 UI token 失效；从保存恢复会话保留 node/revision/可见结果，不重触发 open/奖励。发生游戏终局或世界对象被授权系统移除时，底座在同一安全结算点生成确定性关闭事实；不从 onUnmount 或网络回调修改模拟。拒绝与错误文本可展示但不得改剧情收据。

## 8 独立持久状态与录像

建议 state 形状，所有上限沿规则包校验：

```ts
interface NarrativeState {
  schema: 1;
  revision: number;
  nextSessionId: number;
  flags: Record<Id, Scalar>;
  counters: Record<Id, number>;
  npcBindings: Record<string, { npcId: Id; placementId: Id; instanceKey: Id }>;
  placementReceipts: { instanceKey: Id; result: 'placed' | 'skipped' }[];
  pendingPlacements: { npcId: Id; placementId: Id; instanceKey: Id;
    attemptedDepths: number[] }[];
  triggerReceipts: { triggerId: Id; scopeKey: string; firings: number;
    lastTurn: number; lastFactId: number }[];
  rewardReceipts: { id: Id; instanceKey: Id;
    result: 'applied' | 'skipped'; reason: string | null }[];
  journal: { entryId: Id; order: number }[];
  active: null | { sessionId: number; targetEntityId: number;
    dialogueId: Id; nodeId: Id; transitions: number };
}
```

底座保存交互对象的位置、ID计数和世界生命周期；narrative 保存内容绑定与剧情，不复制一份可漂移的坐标/HP。字段 `npcBindings` 的键为稳定数字实体 ID 字符串，值只引用本包内容。日志按entryId去重，order为首次加入的稳定顺序；再次journal同entryId不增条目。placementReceipts区分成功放置与no-space最终skip；defer使用pendingPlacements保留策略及已尝试深度，每次合法首次入层最多试一次，超出maxDepth后写skipped终止；两者共享maxReceipts/包深度范围上限，不能只存在会话内。若需 NPC 私有字段，使用 `narrative:npc` 组件与明确校验，不塞 growth identity。外部事件 pending 队列不留在存档边界；若未来允许持久延迟剧情，应另定义 dueTurn 的有界队列并升 state 版本。

版本/兼容检查：

1. manifest 精确匹配启用集合及每个模块版本/规则指纹；state.schema 和每条输入 v 由 narrative 自己校验。不要用顶层录像 version 代替模块输入版本
2. 增删字段、条件/效果语义、NPC生成策略、耗时策略、规则值改变同步升级 narrative module/rules 版本；state/input 形状改变各自升版本。数据 fingerprint 防同版本换包
3. `extensions.modules.narrative`、基础对象 owner 与绑定必须互相一致；对象 ID 唯一且计数大于所有已分配 ID；dialogue/node/receipt 引用、预算和 active 状态也要验证
4. 不安装/不启用 growth 的 narrative 档没有 growth 块；安装 growth 但该档未选它仍按原 manifest 恢复，不自动追加
5. 要求 narrative 的档遇到 narrative 被删、版本不符或数据指纹错时，旧局退休前明确拒绝；不部分加载、不自动修档/迁移
6. load 只恢复，不重新执行 placement/open/trigger/reward，不耗 RNG；save/read view 不改变 revision/队列/收据
7. 每条命令 checkpoint 含完成后的 narrative/其它启用模块状态与 RNG；逐条重放、头尾 seek、save→load→续录最终世界与收据精确一致。UI locale/立绘故障不改变机械 checkpoint
8. 若新底座增加 Game 实例字段，登记 U03 合同；实体/世界对象 codec 的新增字段也登记对应状态清单。不能用 WeakMap 藏需要持久化的剧情状态

UI 专用焦点、滚动、绘图资源、opaque token、输入去重锁不入存档。自有 data 的机械指纹与立绘资产 manifest 的显示版本分开：换图尺寸或替 placeholder 不改剧情结果，但资源 manifest 自己升版本；对白/选项的 key/逻辑若在 rules 包变化仍遵循精确指纹合同。

## 9 刻符界面与立绘

### 9.1 容器与交互合同

读模型须新增只读公开叙事投影：当前会话的名字/正文/立绘ID、可见选项ID/文案/已知禁用原因、revision与只读状态，以及已公开日志。当前通用ExtensionViewDescriptor可把完整definitions暴露给UI，不能原样把叙事完整包、条件AST、未来节点或隐藏flags交过去；应由模块纯投影配合底座可见事实生成当前视图，不获得活Game/写能力。地图只取可见交互对象DTO。这里约束的是游戏内信息展示，不宣称前端打包内容可以防止玩家自行查看源码。

沿刻符现有深色石面、细金线、正文高对比风格，不另开浏览器窗口。目标为游戏界面内单一 overlay host；本分支尚未集成 main 的统一界面内弹窗层，不能把主线服务已完成写成本分支已复用。

维护者提供的 main 进展记录：`dc0b78b` 已含 D1–D4 的 DialogService/DialogHost、显式输入续体、presentation timeline 与 SFC harness。到 2d 获准实施前核对该准确提交与后续变化，按需复用通用 host/input capture/focus 契约并扩展 dialogue；若实际接口或范围不符，先询问维护者。禁止在本分支另造一套弹窗容器。本轮 2b 只登记依赖方向，不 merge/cherry-pick main、不提前实施 2d，也不把整个原生确认/所有背包菜单的改造塞入叙事。不得直接把同步 `onConfirmRequest` 改成返回 Promise；native confirm 迁移需要自己的显式命令续体、同命令决策与取消录像测试。

历史设计核对基于 main 固定提交 `1c9c337f3e430774b3f9555c6a238efd5fe19e25` 的[界面内弹窗层设计](https://github.com/coolking70/BrogueJS/blob/1c9c337f3e430774b3f9555c6a238efd5fe19e25/docs/design/in-app-dialogs.md)：当时显式命令续体、presentation timeline及死亡时“查看结算”尚待实施，dialogue仅为预留类型；该历史状态不覆盖上面的 `dc0b78b` 进展记录。该文头部已排除D5/D6扩展适配与合并；后文§7.3残留的合并、classic parity及CE门禁不成为本原型义务。按本分支需要选择性参考，不合并main或扩大本次实现范围。

三类流程只共享Host、输入capture、token/epoch、防重复/穿透、只读DTO与自动化选择器，状态所有权不能混用：

| 流程 | 状态与输入归属 | 保存、录像与暂停边界 |
|---|---|---|
| 普通规则confirm | 引擎持有原命令的显式续体，UI只回答 | 待决命令未提交时不能保存/导出其半完成状态；答案写同一命令的decisions，不能整命令重跑或让模块context跨等待存活。已有item分段流程仍按自己的命令合同 |
| 消息ACK / presentation timeline | 只改变显示游标，不记录游戏命令 | 模拟可已完成，ACK不能冒充世界冻结；已完成checkpoint可保存。死亡提供“查看结算”绕过显示backlog，未读日志不丢失 |
| narrative对话 | open/choose/close各为已提交模块命令，active会话属持久规则状态 | 会话可按第8节保存；免费冻结由引擎interaction gate保障。不能把剧情选项当ACK，也不能让显示等待阻塞replay/seek |

本阶段新叙事确认/关闭不用 native confirm，从而可在 UI 内实测取消。原食物确认等历史 native confirm 覆盖限制只有在单独批准迁移且真实验证后才算解决，不能引用阶段2弹窗截图冒称原流程已通过。

界面有名字、当前对白、可选项、已知禁用原因、关闭、剧情日志入口与会话状态。选择区固定可见、正文独立滚动；按钮最小触摸高度44px。键盘上下选项、Enter确认、Escape关闭，数字键只给当前可见选项；键盘事件由最上层 modal 消费，不能穿透到移动/等待。只有根层负责地图暂停，子窗口通过栈优先级竞争，不各自解除锁。

### 9.2 桌面 1440×900 文字线框

```text
┌──────────────────── 保留变暗的游戏画面 ────────────────────┐
│   ┌─ 刻符细边 对话框 max-width 920px ───────────────────┐   │
│   │ 档案守卫                         剧情记录   [关闭] │   │
│   ├──────────────────┬─────────────────────────────────┤   │
│   │                  │ “这张残页记着旧通道的位置。”    │   │
│   │    立绘占位      │                                 │   │
│   │   240×320框      │ 对白正文 可滚动                  │   │
│   │                  ├─────────────────────────────────┤   │
│   │   姓名/称谓      │ [1 阅读残页]                     │   │
│   │                  │ [2 我稍后再来]                   │   │
│   ├──────────────────┴─────────────────────────────────┤   │
│   │ 世界暂停 · 交谈不耗回合      ↑↓选择 Enter确认 Esc离开│   │
│   └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

两列仅在宽度足够时使用；立绘不挤占选项，长中文/英文不可撑开 grid。无图仍保留背景、人物字形与称谓，正文宽度不抖动。背包、主菜单或瞄准流程已经占 modal 时，不抢开新对话。

### 9.3 390×844 竖屏文字线框

```text
┌──────────── 390 CSS px ────────────┐
│ 顶部安全区                         │
│ ┌ 档案守卫 ─────────────── [×] ┐   │
│ │ [72×96占位]  守卫           │   │
│ │               世界暂停      │   │
│ ├─────────────────────────────┤   │
│ │ “这张残页记着旧通道的      │   │
│ │  位置。”                   │   │
│ │ 正文区域独立滚动            │   │
│ ├─────────────────────────────┤   │
│ │ [ 阅读残页                ] │   │
│ │ [ 我稍后再来              ] │   │
│ │ [ 剧情记录 ]  交谈不耗回合  │   │
│ └─────────────────────────────┘   │
│ 底部安全区 地图控件不接收输入       │
└───────────────────────────────────┘
```

面板左右12px，max-height 按动态视口及安全区计算；内容区 flex min-height:0，选择与关闭始终可达。触摸滚动不拖动地图、不触发选项；松手/第二次点击不能穿过刚关闭的面板落到地图。

### 9.4 320×844 竖屏文字线框

```text
┌─────────── 320 CSS px ───────────┐
│ 档案守卫                  [关闭]│
│ [48×64占位]  守卫 · 世界暂停    │
│ ─────────────────────────────── │
│ “这张残页记着旧通道的位置。” │
│                                 │
│ 正文可滚动 保持正常字号          │
│ ─────────────────────────────── │
│ [ 阅读残页                    ] │
│ [ 我稍后再来                  ] │
│ [ 剧情记录 ]    交谈不耗回合     │
└─────────────────────────────────┘
```

320不保留桌面双栏、不横向滚动、不靠缩小正文解决溢出；立绘缩为头像，点击可在同一 modal 栈查看大图，返回保留会话与滚动位置。长选项允许两行且整行点击，禁用说明就地换行。普通与沉浸模式使用同一对话组件，周围 HUD 可不同。

### 9.5 立绘资产合同

由维护者本地产线另行提供；当前只使用项目内占位，不生成、不下载、不复制外部素材，也不假定产线输出格式已经确认。

```ts
interface PortraitManifest {
  schema: 1;
  displayVersion: string;
  portraits: { id: Id; asset: string | null; width: number; height: number;
    fit: 'contain'; anchor: 'bottom-center'; altKey: TextKey;
    fallbackGlyph: string }[];
}
```

- `asset=null` 是合法 placeholder；提供素材后只允许包内相对 `.png`/`.webp` 路径，拒绝绝对 URL、路径穿越、data URL、动态脚本/SVG
- 建议以透明背景竖幅为输入，原始比例由 width/height 说明，不要求本次锁定像素生产尺寸；UI contain 不拉伸、不裁切脸，renderer 与 CSS 负责缩放
- 读取图片异步属于显示层，onload/onerror 不能提交剧情或推进 replay。缺图显示 fallback，不阻挡交谈、存档或回放
- manifest 校验 ID、尺寸合理上限、扩展名/路径与 altKey；实际文件存在性/大小/透明边缘由资产接入验收，不把存在性与规则包有效性混为一谈
- 表情切换由 node.portraitId 引用，null 回退 NPC 默认；不靠分析文本选图，不写 NPC ID 特判。占位与正式图都测320/390/桌面与失败回退

## 10 需要维护者决定的关键点

维护者已明确选择下表四项 A（2026-10-03）：先独立验收 2a0；未来对话全部 0tick 且全世界冻结；固定、可穿行、非战斗 NPC；自有 flags/log/事件与可选 growth XP，重联动后延。该决策不等于授权一次完成整个阶段 2。

| 决策 | 选项 | 推荐及影响 |
|---|---|---|
| P2-D01 先决底座 | A 先独立验收2a0；B 将2a0与首版叙事一起交付 | **A**：先证明任意组合与物理移除，避免把已有growth耦合带进第二模块；B仍须全部同等检查，不能省略 |
| P2-D02 对话耗时 | A 全部0tick且全世界冻结；B 开口消耗一次行动后冻结；C 每次有效选择消耗行动 | **A**：最清楚、不会读长文挨打，也不会刷恢复。B需要结算后重新验证目标；C需完整战斗中断设计，不建议首版 |
| P2-D03 中立NPC形态 | A 固定、可穿行、非战斗交互实体；B 可伤害的固定中立生物；C 可伤害且巡逻/跟随 | **A**：独立完成对话与剧情，不依赖growth/战斗。B/C先增加通用关系、伤害/AI/堵路/死亡合同，明显扩大范围 |
| P2-D04 剧情改世界强度 | A 自有flags/log/事件与可选XP；B 再加有限背包给予/消费和授权spawn/despawn；C 再改地形/门/阵营/传送/世界状态 | **A**：能完整交付故事闭环与录像；B/C须逐端口定义资格、失败补偿、事务写集与版本，另拆步骤，不能允许任意属性路径/eval |

即使选择 B/C 重联动，也仍只通过底座/可选能力执行，不能硬依赖其它阶段存在。阶段 3–5 的联动由届时模块设计逐项加入；没有决定的能力不默默加入 schema。最终默认模块组合由维护者将来决定，本表不抢定。

## 11 分步实施方案 每步验收后停止

2a1 历史范围：该步提供可安装包、纯条件/效果/触发计划与 state/input 校验。第 8 节的完整 state 是阶段 2 目标；2a1 仅有 schema/revision/lastFactId/flags/counters/triggerReceipts/rewardReceipts/journal，没有 NPC 绑定、活动会话或放置字段。第 7 节 open/choose/close 当时只定义并校验 v1 语法，不作为可执行的 Game 命令。本轮 2b 已获准接入世界，并须按实际字段与语义升级版本；初始放置的安全完成点与录像归属必须同时证明。第 4.4 节完整全局剧情事实/奖励意图 flush 不因纯 trigger planner 已存在就视为已实现，仍留 2c。

| 步骤 | 实现边界 | 必须交付的验收结果 |
|---|---|---|
| 2a0 组合与可移除底座 | 通用发现/descriptor/UI slots、growth旧耦合迁移、测试owner/清单生成、边界与物理删除脚本；明确软能力/安全点合同 | 空集与growth单独正式菜单开局、play/save/replay；真删除growth与example后剩余typecheck/build/ext/npm test通过；注册顺序置换等价；报告旧守卫调整原因。先不加入narrative玩法 |
| 2a1 叙事包与执行内核 | narrative目录/版本、纯schema/条件/效果计划/触发器、state/input校验、严格错误码；先无正式NPC UI | 增删NPC/节点/选项/flags只改数据；坏引用/环/预算/伪造输入负例；narrative-only可实例化；全禁用无状态与RNG副作用 |
| 2b 通用交互实体与开口 | 底座world-interactable、位置/可见性/缓存/codec/GC、数据放置、open/choose/close、引擎gate | 真实新局遇NPC、不同目标/遮挡/无空位、重复入层、取消/重复命令、NPC-only存读/回放；若改生成加drift。新增持久字段与底座版本全部登记 |
| 2c 剧情事件与可选奖励 | 分阶段事实/意图提交、receipt去重、日志、growth可选能力adapter；不引入其它重世界效果 | 无growth、growth关闭story、无报价、合法报价四种；不滞后一命令、不重复奖励；后续效果失败不半提交；反向注册顺序与重复checkpoint不改变结果 |
| 2d 刻符对话与立绘占位 | 获准后核对并复用 main `dc0b78b` 已有 D1–D4 通用能力，再扩展 dialogue；禁止另造容器；桌面/390/320、普通/沉浸、键鼠触控与焦点 | 三尺寸六布局真实像素；滚动/关闭/Escape/外点/快速重复点击；无穿透；录像只读展示不阻塞seek；图片加载失败不影响模拟。无真实手机时明确“触摸未实测” |
| 2e 收尾与独立性验收 | 四子集、四目录删除矩阵、真实持久/录像/续录、配置手册、报告 | 第12节清单全过；明确仍未提供素材/重联动；同一候选最终门禁后停交维护者，不自动进入阶段3/合main/部署 |

说明：2a0 若发现底座事务/事实队列改造无法安全与UI解耦，可拆 2a0-1（发现/所有权）与2a0-2（通用提交能力），每小步仍完整门禁并停止。不是允许把高风险改动隐藏进纯文档或通过中间绿灯跳过最终候选复验。

## 12 门禁与验收清单

### 12.1 每小步固定门禁

在同一最终正常候选树运行 full 档，保留输入 hash、退出码、文件/用例数、时长、已知skip/todo；统一 Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、测试命令 `--maxWorkers=2`：

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 全部扩展测试，包括底座、所有已安装阶段及适用组合；2a0 已提供 `npm run test:ext` 与共用防漏发现清单。实施报告必须给真实执行结果，不能把仅配置成功称作通过
5. 完整 `npm test` 一次
6. 全部已安装模块子集的真实新局/游玩/save/load/replay/seek/续录 smoke
7. 涉及地图生成的改动另跑 `npm run test:drift`；确认有意差异后可按原捕获方法重录，报告变化范围、原因与结果，不能把所有漂移称预期

2b 起每个**真实删除副本**按第 3 节 removal 档重新跑 boundary、typecheck、build、全部剩余 ext 与全部剩余子集 smoke，不再运行完整 npm test。正常 full 与 removal 结果独立记录，删除前后 hash、owner测试差集及准确命令必须保留；只有模块目录确实删除才能移除其自有测试，不能更改剩余测试清单/筛选来制造通过。单跑 removal 不能代替正常 full。

不要求 `ce:fetch`、`test:full` 或强制CE `test:gen`，不隐藏原有 CE 缓存。当前授权与门禁以 [README当前门禁](README.md#当前验收门禁) 为准，只推进 2c，不授权 2d 或后续叙事实施。本文不将待执行检查写成通过；不拿定向测试替代正常树完整 npm test、不用旧候选测试结果冒充新树绿灯。2a0/2a1 历史报告保留原命令与结果，不按当前 removal 政策改写。

### 12.2 核心逻辑与恶意输入

- 有效JSON与缺字段/多字段/原型键/空ID/错版本/错指纹/超大整数/深嵌套/假能力数据；错误在退休旧局前被拒绝
- 全条件比较、AND/OR/NOT、同一条件的UI与执行对等、未知事件字段、可选身份缺席分支；不通过只读投影泄漏隐藏NPC或未来剧情
- 每种effect单独与组合、counter边界、自动触发环、用户选择环、预算恰好到界/+1、双击旧revision、重复receipt与forked replay输入
- 消息/显示/条件/校验/资产不耗实质RNG；未来随机效果使用固定种子逐计数验证
- 无硬编码样例NPC/choice/rewardId分支；改名/增删合法数据后逻辑与UI跟随；无eval/new Function/字符串路径写Game

### 12.3 真实世界 输入 与时间

- NPC当前层可见可达、隔墙、离层、同格/邻格、多目标选择、无候选、重复入层、对象删除/新局/load后的旧UI令牌
- open/choice/close之前之后比较turn、tick、双RNG、HP、饥饿、敌人位置、growth焦点/CD；免费对话不恢复资源、不推进怪物
- 活动会话内直接调用move/wait/item/growth命令拒绝，UI held keys/鼠标双击/触摸松手都不穿透；自动探索不能因为close突然继续
- 日志、头像预览、目标选择前取消纯显示；已open的close确实记录并清active；重复close拒绝且无第二个输入

### 12.4 持久 录像 与模块矩阵

- 打开前、对话节点中、领取后、关闭后保存；load后不重触发；从中间档续录，最终state/世界对象/两条RNG/收据精确相同
- 从头到尾与逐条step、seek到0/节点/选择后/终点；自动播放不等图片、不再次问用户；重放UI只读关闭视图不修改录像机械会话
- 篡改 active target/node/session、缺NPC对象、孤儿owner、超收据、重复ID、输入版本旧、模块缺失与禁用的命令均拒绝
- 四种开局组合与第3节物理删除矩阵实际执行；未来每新增阶段扩充全子集启动矩阵及单模块删除，不以“另一个模块未完成”免除已有组合测试
- 可选provider的不存在/关闭/不支持key是正常skip；声明支持后非法响应为错误；自有剧情提交与奖励消费同一checkpoint且不靠下一命令修正

### 12.5 UI 与交付报告

桌面1440×900、390×844、320×844，普通/沉浸六布局；长正文、长选项、所有选项暂不可选、关图、缺图、窄高变化、键盘/鼠标、可得时真实触摸。覆盖返回与重复操作，不仅截图 happy path。实际浏览器与版本、静态包hash、真实触摸是否可用都写清；截图/大原始证据不提交仓库。

最终报告列：实际引擎与模块文件、数据与格式版本、已选P2-D01–P2-D04、测试调整理由、物理删除结果、所有组合结果、未完成能力/浏览器限制。无运行证据就写未验证。阶段结束停下验收，阶段2–5均可独立继续、替换或舍弃，不自动移植main或承诺保留未来内容。

## 13 2c 实际边界与 2d 交接

2b 已验收，本轮只推进剧情事实、收据、日志与可选 XP。2c 具体底座协议/版本/失败回滚见 [架构 §20](architecture.md#20-阶段-2c-剧情事实与可选奖励提交)，实际门禁见 [报告](phase2c.report.md)。上文“拟新增”和2a/2b状态保留历史设计背景，不替代本次实现证据。

2d 获准后必须核对 main `dc0b78b` 的 DialogService/DialogHost/DialogInput 以及 blur 修复 `26ad9c4`。当前 `Input.ts` 自定义物理释放屏障必须移除或统一进主线 DialogInput，不长期保留两套屏障；本次2c不开始输入/UI迁移、不合main。

## 14 2d 候选接线

维护者已授权2d与2c联合验收，并明确批准按main设计§4.5加入限定的纯数据受控命令准备接口。上节的“本次2c不开始”仅描述2c当时边界；现行范围以README当前工作为准。正式对话/占位立绘、统一DialogInput、只读回放与纯准备接口的实际实现、版本边界、独立审查及门禁分列于[2d报告](phase2d.report.md)与[架构§21](architecture.md#21-阶段-2d-共用对话层与受控命令准备)。报告尚未填写证据的项目不视为通过，不自动启动2e。
