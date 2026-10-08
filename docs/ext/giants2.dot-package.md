# giants2 dot 任务包：第二批原创巨兽（整包一次派发）

> 状态：数据预检完成、待发布；推送受当前环境限制，维护者完成发布及签认后整包转贴。2026-10-09。代码基线 `e0fa39a225428d36e6e342f6585f57f45960e6ba`（当时 `ext/phase5` 最新提交）；派发分支 `ext/giants2-base` 仅追加本任务包。范围是 **2 种新巨兽、4 个形态定义**，复用阶段 4 已交付接口，不实施底座功能。§12 的内容选择为本包预先给定的可逆决定，待维护者签认，不能称已获逐条批准。维护者转贴 §0 即表示按本包执行；dot 不再逐项征询。
>
> 读法：§0 是操作指令，§A 是派发实测，§3–6 是内容与实现契约，§7–9 是验收，§10–12 是交付与裁决。设计稿中的拟议能力不等于正式许可；实际校验器与执行路径优先。当前扩展政策见 [README](README.md) 和 [指挥交接单](commander-handoff.md)，本包的写入白名单始终有效。

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型的 giants2 执行者。任务：按 docs/ext/giants2.dot-package.md 一次长块独立完成第二批两种原创巨兽、测试、自然 trace 与配置手册，期间不要向维护者提问；未定细节按 §12 裁决并记入报告。

git fetch origin
git switch -c ext/giants2 origin/ext/giants2-base
开工确认工作树干净，git diff --name-only e0fa39a225428d36e6e342f6585f57f45960e6ba HEAD 只列 docs/ext/giants2.dot-package.md；记录实际起始 tip。已存在工作分支时先核对其祖先与未提交改动，不重置或覆盖。

先读 AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、docs/ext/README.md，再完整读任务包、docs/ext/phase4-giants.md、docs/ext/giants-config.md 与 giants 源码。任务包是本次唯一执行契约；§A 为维护者派发前实测，不代替你的最终验收。

硬规则：
1. 只写 src/ext/modules/giants/**、docs/ext/giants-config.md、docs/ext/giants2.report.md；本任务包、共享源码/脚本/测试/配置、其他模块均不可改。
2. 按 §3 的精确算法把内嵌 JSON 追加到既有包，保留首批巨兽；只用已冻结身体/部位/区域/转换/生成贡献接口。生产导入遵守 §6.1，测试也不得导入其他模块实现。
3. foundation、whole-run、recording、origin、world/SDK 及 giants 的 module/rules/schema 版本均不变；机械数据身份由现有 canonical fingerprint 更新。不能写第二套 AI、时钟、RNG、状态或奖励系统。
4. 两种新巨兽必须有真实自然生成与公开命令 trace；布景诊断与自然证据分列。掉落明确为 0，不绕过 nativeFormData 加奖励。UI 沿用巨兽 HUD/侧栏，所有新增文字进 giants 自有 i18n。
5. 开发期跑 §9.1，最后同一候选树跑 §9.2；组合用模块自有真实 Game 测试。只删 giants 执行 --plan，不作删除通过声明；完整 npm test、全部 test:ext、128 子集与实际删除留 5Z。Node 24.19.0 放 PATH 前，NODE_OPTIONS=--max-old-space-size=3072，vitest --maxWorkers=2。
6. SDK 缺陷或越白名单才能完成的部分：留最小复现与影响，不打补丁、不弱化断言、不加 skip/todo；继续其余工作，最终如实报部分完成。最多两轮审查→修复，剩余问题记报告交本地处理。

按 §10 交付报告、手册、模块自有测试与小型 trace；先确认门禁结果，再提交并只推 ext/giants2，不推 base/phase5/foundation/main，不 merge/rebase/tag。每个提交信息末尾加 Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>。最终按 §10.3 回一段不超过30行的中文回执。
```

## A 派发前核对与实测（维护者执行；dot 作背景阅读）

### A.1 基线、环境与界限

- 核对树：`ext/giants2-base`，起始 HEAD `e0fa39a225428d36e6e342f6585f57f45960e6ba`，起始工作树干净，原 upstream 为 `origin/ext/phase5`。发布仅提交本文件并推送 `origin/ext/giants2-base`；本节不提前声称远端实施分支已存在。
- 发布环境限制：原工作树Git元数据位于另一工作树的公共 `.git/worktrees/`，沙箱拒绝创建index.lock；因此使用 `/private/tmp/giants2-dispatch-20261009/publish` 独立克隆同一基线，以同名 `ext/giants2-base` 分支只提交本文件。CLI `git push -u origin ext/giants2-base` 因无法解析github.com失败，随后尝试已连接GitHub的Git数据API，但create_tree要求审批而当前审批策略为never，工具拒绝写入；本轮未发布远端。最终单文件提交保存在上述publish副本，可在有权限的终端执行 `git -C /private/tmp/giants2-dispatch-20261009/publish push -u origin ext/giants2-base` 完成发布。原工作树HEAD/upstream无法在此沙箱同步，文件内容仍保留供查看；不修改或替换原Git元数据。
- Node 可执行目录：`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实测 `v24.19.0`；全部 Node 命令前置该 PATH，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest 至多 2 workers。
- 副本：`/private/tmp/giants2-dispatch-20261009/tree`，由上述 HEAD 的 `git archive` 解包；只在副本追加 §3 数据/§5 文案和临时验证测试。依赖逐包链接、缓存独立。仓库源码未改；不是另建产品实现。
- 实测脚本从本任务包标记代码块直接解析 additions 与 locale，并断言副本合并结果精确相等；不是验证另一份手抄缩减数据。

### A.2 真实接口核对

| 项目 | 当前可用执行合同 / 本包处理 |
| --- | --- |
| 形态与验证 | `nativeForms.ts:validNativeForm/nativeFormData/nativeFormSpatial`；`giants/schema.ts:assertGiantsPack`；`SpatialCatalog(false, ['giants'])`；模块工厂及真实 Runtime 安装仍需另过引用闭包。 |
| 身体 | `SpatialSchema.ts` 的 `BodyDefinition/PartBreakRule`，外围固定 1:4 传伤、remove + retire-subtree；无成员再生或残骸接口。 |
| 掩码与 zone | 连通、含原点、≤16 格；1 或 4 个旋转 pose；local 固定 1:1 传伤，破坏 keep-zone 不删格。 |
| 主动转换 | `bodyTransitions.ts:validActiveBodyTransitions`；hp-at-most、正 ticks、phase 单结果；源 ID 与 encounter 保留，spent 收据归底座。 |
| 生成 | `generation.ts:validGenerationContribution`；可绕行侧室、return-to-spawn；每层最多一个成功场地，chance 是尝试率。新增 priority=10，在既有优先级 0/1/2 后；不承诺真实出生率等于 chance。 |
| 奖励 | `nativeFormData` 明确 `goldDropChance:0,itemDropChance:0`；NativeFormDefinition 无掉落/XP字段。两种本次固定零专属奖励，不虚构掉落 schema，不依赖 crafting/loot。 |
| UI | `ui/view.ts:selectBossHud(DisplayFrame)`、`BossHud.vue`、现有侧栏/部位投影；只读历史帧，不能用实时实体补隐蔽部位。 |
| 测试发现 | 模块自有 `test-suites.json` 加文件；`vite.config.ts` 直接 Vitest 同样走发现器，临时测试也需在副本登记。 |
| 导入边界 | 共享脚本严格 SDK 列表只针对 crafting/foraging；它不自动强制 giants 的逐入口白名单。§6.1 由 giants 自有导入测试补强，不能改共享脚本。 |
| 版本事实 | foundation=11，whole-run=6，recording=4，origin=2，world5 schema=2；worldSdk/edibleSdk=1；giants module/rules=1.0.0，pack/state/spatial schema=1。手册旧 foundation4/whole-run3 是历史口径，应按本包更新。 |
| 现有测试影响 | `giants_contract.test.ts` 有 5 forms/4 templates/5 nameKey 计数，应精确改为 9/6/9；先做仅回退本次生产数据的反事实。旧 trace 指纹/生成路线也须归因和原入口重采，不改共享基线。 |

### A.3 实测结果

<!-- giants2-dispatch-results -->
已完成（2026-10-09），内嵌数据不作数值修订即获当前正式校验器及真实新局接受。以下是**本次实际运行**，不沿用阶段4报告的历史通过数。

| 命令 / 实测项 | 实际结果 |
| --- | --- |
| 副本 `npx vitest run src/ext/modules/giants/tests/giants2_dispatch_probe.test.ts --maxWorkers=2` | 最终exit0，1文件4项通过、0失败/skip/todo，40.75s（测试38.88s）；Node v24.19.0、3GiB。临时测试只在副本，不提交。 |
| 文档原文提取 / 正式校验 | §3.3子包 `assertGiantsPack` 与模块工厂通过；追加后的完整生产包精确等于文档合并结果，真实schema与Runtime安装通过；§5所有文案精确一致，无未解析nameKey。 |
| 计数 / 指纹 | 9 forms、6 templates、2 bodies、2 member break rules、2 transitions、原2 attack profiles。合并包 `sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8`。 |
| 真实D1新局 | seed1/wizard：仅giants、七模块全开均安装成功；各执行3条wait，实际录像事件数分别3/4（全开含初始命令），save/load与逐条replay末态精确一致。 |
| 盲灯自然出生 | 仅giants，seed从1起：**seed1、D2、actor70、region69**，`giants.lantern-chamber.depth-2` placed；真实birth=natural、7格，100事件公开路线；save/load、完整逐条replay、seek0→100均零OOS且规范完整末态相同。 |
| 伏螯自然出生 | 仅giants，seed1走到D8未命中；**seed2、D7、core163、region162**，`giants.copper-chamber.depth-7` placed；birth=natural、核心4格、5活成员，732事件公开路线；save/load、完整逐条replay、seek0→732均零OOS且规范完整末态相同。 |
| 转换诊断 | 另从seed1自然走到D2，**仅此诊断**设置HP42/HUNTING/ready0后公开wait；真实NPC选择器转为blind-lantern-open，仍HP42、5格，ID/区域保留，spent含lantern-uncoil，旧local zone缺席，转换后save/load通过。不是自然战斗trace。 |
| 掉落数据 | 四个新form的真实 `nativeFormData` 均goldDropChance=0/itemDropChance=0；未实测击杀掉落，交dot覆盖。 |
| 原树 `node scripts/check-module-boundaries.mjs` | exit0，Module boundaries and test ownership verified；本轮原树只新增文档。 |
| 原树 §8.4 精确removal `--plan` 命令 | exit0，安装7模块、计划恰1行，removed=[giants]、其余6保留，profile=removal；normal full status=not-run。未实际删除、未运行剩余64子集或浏览器。 |

初轮保留：同名probe原先3项中2过1失败、exit1、35.84s；失败发生在**已经load/replay退休的旧actor引用**上调用footprintOf来填写摘要，报Unknown footprint or pose，堆栈落临时probe第66行。改为load前捕获格数，生产数据与源码未改；上表为修正探针后的完整4项结果，不把初轮算作产品缺陷或与后轮累计。最初准备命令在无.git副本错误调用git show而失败，随后从原树只读复制基线JSON并登记临时测试；该次未运行功能测试。

本机无CE缓存，Vitest启动提示CE-dependent tests would skip；本probe没有CE用例，实际skip=0，未取CE源码。摘要与临时脚本/日志在 `/private/tmp/giants2-dispatch-20261009/`（probe-results.json、probe.log、probe-first.log、removal-plan.json）；远端无需访问该目录，重验入口与数据均已写入本包。只在本文件保存结果摘要，不提交原始证据。

<!-- /giants2-dispatch-results -->

### A.4 实测边界

本轮是任务包起草与数据可执行性验证，不是 giants2 实现验收。自然战斗、部位破坏/阶段转换、全 trace、UI、最终 drift 和 5Z 门禁由 dot/维护者依 §7–9 完成；只记录已运行结果。§A 的诊断探针不得充当自然 trace。失败/未运行不得写成通过，历史报告的通过数不计入本轮。

## 1 目标、范围与非目标

交付两种可绕开的敌对巨兽：**盲灯蜷兽**（7 格非矩形刚体，破灯褶露弱点，半血展为 5 格钩形）和 **铜须伏螯**（2×2 核心 + 4 条独立节须，失去至少 3 条支撑后不能移动）。展躯形态和节须不是额外 species，数量记 2 种 / 4 forms。名称、描述为本包原创，不取其他游戏的专名或设定文本。

- 保留首批全部 forms/templates/bodies/profiles/transitions 的字段值和数组前缀顺序；新内容只追加。本次不平衡旧巨兽。
- 只依赖 foundation，无 growth/combat 等也能自然生成、攻击、断部位、转换、终结与保存。开启其他模块沿既有通用规则，无硬依赖。
- 不增公共命令、Game 字段、协议、属性源、奖励 provider、worldDefinitions、世界物品、原生种类目录、地图绘制或图片资产。
- 不造新区域类型、“竞技场模式”入口或主路封门。这里的竞技场就是现有生成贡献建立的宽阔可绕行侧室。
- 无自定义远程技、冲锋、召唤、再生、镜像、物理断格、AI 回调、周期阶段或战利品。非目标不能以“内容丰富”为由加入。

## 2 基线、分支与版本

| 项目 | 执行定值 |
| --- | --- |
| 代码基线 | `e0fa39a225428d36e6e342f6585f57f45960e6ba` |
| 派发 tip | `origin/ext/giants2-base` = 基线 + 仅本任务包文档提交 |
| 工作分支 / 唯一推送目标 | `ext/giants2` |
| 写入白名单 | `src/ext/modules/giants/**`、`docs/ext/giants-config.md`、`docs/ext/giants2.report.md` |
| 巨兽身份 | id=giants、defaultEnabled=false、GIANTS_VERSION/moduleVersion/rulesVersion=1.0.0、rules.schema/pack.schema/state.schema/spatial.schema=1 |
| 其余版本 | foundation11 / whole-run6 / recording4 / origin2 / world5 schema2 / worldSdk1 / edibleSdk1，全部保持 |
| 现有模块 | combat1.6.0、crafting1.0.0、foraging1.0.0、growth1.8.0、narrative1.4.0、settlement1.1.0；不改版本或内容 |

只改变数据，用现有 `extensionDataFingerprint(pack)` 自然产生新 rules fingerprint；`getGiantsPackIdentity` 与 `createGiantsModuleFromPack` 的身份必须一致。旧 fingerprint 档/录像应拒绝，不迁移、不接受旧指纹、不伪装兼容；locale 不计入 pack 指纹，但实体名称进入快照，需同步复验 trace。手册要解释“本次数据换指纹，版本协议不变”，不可照其旧文升级 whole-run。

开工记录 `git status --short --branch`、实际 tip、上述基线差异；若出现非本包文件差异，不擅自合入新 phase5。能核定本基线时在其上工作；无法核定则报告基线阻断，不以其他树冒充。维护者负责后续与并行 phase5 的合并、共享改动及重跑。

## 3 权威机械数据与装配

### 3.1 合并算法（唯一生产数据入口）

§3.3 是**完整且可独立校验的新内容子包**。生产不能用它覆盖首批：读取基线 `data/definitions.json`；保持根 schema/moduleVersion/rulesVersion；按代码块次序在 forms、templates、transitions 末尾追加对应数组；在 bodies.definitions、bodies.breakRules 末尾追加；保留原 bodies.attackProfiles，未提供的 statusProfiles 等保持缺席。不把“additions”包装键写入生产包。结果应为 **9 forms、6 templates、2 bodies、2 member break rules、2 transitions、原 2 attack profiles**，各类别 ID 唯一。

原包前缀对比、合并包真实校验及 Runtime 安装须写成模块自有测试。§3.3 和 §5 作为只读输入；测试可从文档提取，或保存新增条目精确期望，不能只比较实现与自身返回值。

### 3.2 人读数值表与行为解释

| form | HP | accuracy / defense | damage | move / attack ticks | 形状 / 出生 |
| --- | ---: | --- | --- | --- | --- |
| blind-lantern | 84 | 75 / 12 | 3–6 | 150 / 180 | 7格非矩形、四向旋转；D2–4 自然 |
| blind-lantern-open | 84 | 80 / 8 | 4–7 | 100 / 140 | 5格钩形、四向旋转；只作转换目标，不设模板 |
| copper-tendril | 108 | 80 / 18 | 3–6 | 160 / 180 | 2×2 core；D5–8 自然 |
| copper-tendril-limb | 18 | 70 / 6 | 1–3 | 160 / 220 | 1×1，仅 body 外围；不得独立自然生成 |

坐标均为相对锚点；r90 为 `(x,y)→(-y,x)`，不得按包围盒重新对齐。下图 `@` 是 (0,0)，字母仅示意（C为核心占格），`.` 不占位：

```text
蜷伏（7格）   展躯（5格）    伏螯出生偏好（8格，5实体）
@MM          @###           aCCb   ← core左上为(0,0)，图在x=-1起
##M          ...#           .CC.
.#.                         c..d
```

- 灯褶：local HP18、armor1、1:1 传实体伤量；标签 (1,0)/(2,0)/(2,1)。芯首：(0,0) native HP、armor0；其余保留 body。灯褶破坏不腾空格，移动 ticks ×4/3（150→200），芯首倍率由1变2，balance loss5；缺 provider 时 fallback lock40ticks，不能再叠 combat 硬直。
- 展躯：在下一次合资格 NPC 决策，HP≤42 时主动 phase，200ticks、0HP费用、hp=ratio；最大HP同为84，因此转换本身不回血。保留身份、关系、状态、区域；旧灯褶局部区退出，新形态仅 native 芯首，芯首初始倍率1、移动100ticks。此为新形态数据，**不是恢复被毁灯褶/叠加旧倍率**。触发不要求先破甲，每来源只试一次；无落点仍消耗200ticks并记spent，不同 tick 重试。
- 伏螯：core不提供支撑；limb00/01/02/03 各提供1支撑，四条都是直接连 core 的 tether，距离1…3、每行动最多2步、clear link；偏好位不等于刚性占格。单次命中外围先扣其HP，正HP限额的1/4向下取整传 core。断一条释放占位，槽墓碑保留，移动 ticks ×5/4，balance loss4或fallback30ticks；重复读档/重访不重复乘。minSupportParts=2，剩1或0不能移动，仍可用合资格存活来源近身攻击。核心真死时其余成员无死亡退休，只终结一次。
- AI：完全沿原生睡眠/感知/追击/最近合法接触/旋转寻路、复合体核心唯一调度与有界落脚，无新脚本策略。出边界回出生区域；不隔墙攻击，不用矩形填满凹角。所有新 part 的 attackProfileIds=[]，无新 combat profile 绑定；开启 combat 不承诺为新种类添加专属预警招式，通用防御/破坏 provider 仍工作。
- 场地：两个模板净空16×12、入口5、候选16、priority10、guard=return-to-spawn；盲灯 D2–4/chance50，伏螯 D5–8/chance45。最多每层1成功，其他场地先占预算可使本次 skipped。空间失败保持完整跳过，不缩形，不改深度/概率来凑 trace。
- 掉落：两种、所有形态/部位 **金币0%、物品0%、专属奖励0**；无自带携带物。部位无kill/XP，真正核心终结走既有事实一次。growth 对这些新type无报价时为0XP；不改其表，不额外颁发XP，未来战利品另立任务。
- 本表为首发默认值，后续由 `definitions.json` 调整允许的数字并重新验收/换指纹；不加设置界面。对本次 dot，值固定，不能为了降低测试难度自行改。

### 3.3 新内容子包（完整 JSON）

<!-- giants2-additions -->
```json
{
  "schema": 1,
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "forms": [
    {
      "id": "giants.blind-lantern",
      "nameKey": "ext.giants.blind-lantern.name",
      "descriptionKey": "ext.giants.blind-lantern.description",
      "char": "L",
      "color": 13153674,
      "hp": 84,
      "accuracy": 75,
      "defense": 12,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 180,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "mask",
          "cells": [
            {
              "x": 0,
              "y": 0
            },
            {
              "x": 1,
              "y": 0
            },
            {
              "x": 2,
              "y": 0
            },
            {
              "x": 0,
              "y": 1
            },
            {
              "x": 1,
              "y": 1
            },
            {
              "x": 2,
              "y": 1
            },
            {
              "x": 1,
              "y": 2
            }
          ]
        },
        "poses": [
          "r0",
          "r90",
          "r180",
          "r270"
        ],
        "zones": [
          {
            "id": "mantle",
            "nameKey": "ext.giants.blind-lantern.mantle",
            "health": {
              "kind": "local",
              "maxHp": 18,
              "ownerTransfer": {
                "numerator": 1,
                "denominator": 1
              }
            },
            "armor": 1,
            "damageMultiplier": {
              "numerator": 1,
              "denominator": 1
            },
            "breakRuleId": "giants.lantern-mantle-break"
          },
          {
            "id": "wick",
            "nameKey": "ext.giants.blind-lantern.wick",
            "health": {
              "kind": "native"
            },
            "armor": 0,
            "damageMultiplier": {
              "numerator": 1,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone"
          }
        ],
        "zoneCells": [
          {
            "x": 0,
            "y": 0,
            "zoneId": "wick"
          },
          {
            "x": 1,
            "y": 0,
            "zoneId": "mantle"
          },
          {
            "x": 2,
            "y": 0,
            "zoneId": "mantle"
          },
          {
            "x": 2,
            "y": 1,
            "zoneId": "mantle"
          }
        ]
      },
      "breakRules": [
        {
          "id": "giants.lantern-mantle-break",
          "owner": "giants",
          "trigger": "hp-zero",
          "disposition": "keep-zone",
          "modifiers": [
            {
              "kind": "move-ticks-multiplier",
              "numerator": 4,
              "denominator": 3
            },
            {
              "kind": "expose-zone",
              "partId": "self",
              "zoneId": "wick",
              "damageMultiplier": {
                "numerator": 2,
                "denominator": 1
              }
            },
            {
              "kind": "balance-loss",
              "amount": 5,
              "fallbackStunTicks": 40
            }
          ]
        }
      ]
    },
    {
      "id": "giants.blind-lantern-open",
      "nameKey": "ext.giants.blind-lantern-open.name",
      "descriptionKey": "ext.giants.blind-lantern-open.description",
      "char": "l",
      "color": 14862475,
      "hp": 84,
      "accuracy": 80,
      "defense": 8,
      "damage": "4-7",
      "moveSpeed": 100,
      "attackSpeed": 140,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "mask",
          "cells": [
            {
              "x": 0,
              "y": 0
            },
            {
              "x": 1,
              "y": 0
            },
            {
              "x": 2,
              "y": 0
            },
            {
              "x": 3,
              "y": 0
            },
            {
              "x": 3,
              "y": 1
            }
          ]
        },
        "poses": [
          "r0",
          "r90",
          "r180",
          "r270"
        ],
        "zones": [
          {
            "id": "wick",
            "nameKey": "ext.giants.blind-lantern.wick",
            "health": {
              "kind": "native"
            },
            "armor": 0,
            "damageMultiplier": {
              "numerator": 1,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone"
          }
        ],
        "zoneCells": [
          {
            "x": 0,
            "y": 0,
            "zoneId": "wick"
          }
        ]
      }
    },
    {
      "id": "giants.copper-tendril",
      "nameKey": "ext.giants.copper-tendril.name",
      "descriptionKey": "ext.giants.copper-tendril.description",
      "char": "T",
      "color": 11239516,
      "hp": 108,
      "accuracy": 80,
      "defense": 18,
      "damage": "3-6",
      "moveSpeed": 160,
      "attackSpeed": 180,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "size": 2
    },
    {
      "id": "giants.copper-tendril-limb",
      "nameKey": "ext.giants.copper-tendril-limb.name",
      "descriptionKey": "ext.giants.copper-tendril-limb.description",
      "char": "t",
      "color": 13212523,
      "hp": 18,
      "accuracy": 70,
      "defense": 6,
      "damage": "1-3",
      "moveSpeed": 160,
      "attackSpeed": 220,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "rect",
          "width": 1,
          "height": 1
        },
        "poses": [
          "r0"
        ]
      }
    }
  ],
  "templates": [
    {
      "id": "giants.lantern-chamber",
      "priority": 10,
      "minDepth": 2,
      "maxDepth": 4,
      "chance": 50,
      "width": 16,
      "height": 12,
      "entranceWidth": 5,
      "candidateLimit": 16,
      "formId": "giants.blind-lantern",
      "guard": "return-to-spawn"
    },
    {
      "id": "giants.copper-chamber",
      "priority": 10,
      "minDepth": 5,
      "maxDepth": 8,
      "chance": 45,
      "width": 16,
      "height": 12,
      "entranceWidth": 5,
      "candidateLimit": 16,
      "formId": "giants.copper-tendril",
      "guard": "return-to-spawn",
      "bodyId": "giants.copper-tendril-body"
    }
  ],
  "bodies": {
    "definitions": [
      {
        "id": "giants.copper-tendril-body",
        "owner": "giants",
        "parts": [
          {
            "partId": "core",
            "role": "core",
            "providesSupport": false,
            "formId": "giants.copper-tendril",
            "preferredOffset": {
              "x": 0,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 0,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb00",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": -1,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb01",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": 2,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb02",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": -1,
              "y": 2
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb03",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": 2,
              "y": 2
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          }
        ],
        "constraints": [
          {
            "childPartId": "limb00",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          },
          {
            "childPartId": "limb01",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          },
          {
            "childPartId": "limb02",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          },
          {
            "childPartId": "limb03",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          }
        ],
        "minSupportParts": 2,
        "noSupport": "immobile",
        "coreDeath": "remove-members",
        "statusProfileId": "foundation:native"
      }
    ],
    "breakRules": [
      {
        "id": "giants.copper-limb-retire",
        "owner": "giants",
        "trigger": "hp-zero",
        "disposition": "remove",
        "childrenOnBreak": "retire-subtree",
        "modifiers": [
          {
            "kind": "move-ticks-multiplier",
            "numerator": 5,
            "denominator": 4
          },
          {
            "kind": "balance-loss",
            "amount": 4,
            "fallbackStunTicks": 30
          }
        ]
      }
    ]
  },
  "transitions": [
    {
      "id": "giants.lantern-uncoil",
      "sourceFormId": "giants.blind-lantern",
      "condition": {
        "kind": "hp-at-most",
        "numerator": 1,
        "denominator": 2
      },
      "ticks": 200,
      "hpCost": 0,
      "transition": {
        "reason": "phase",
        "results": [
          {
            "formId": "giants.blind-lantern-open",
            "memberMap": []
          }
        ],
        "hp": "ratio",
        "statuses": "preserve",
        "relationships": "preserve",
        "placement": "nearest"
      }
    }
  ]
}
```

## 4 数据与运行时硬规则

1. 复用现有 schema、module、state、validation、descriptor 及生成 hook。预计生产仅需 definitions.json 与 locale；如 giants 自有通用投影确有新数据适配需要可最小修改，但不可特判 typeId 驱动世界写入。
2. 不放宽表长、坐标、比例、zone 或 body 校验；不把字段藏入任意 JSON state 绕过冻结接口。pack之外无第二份可变平衡表、HP或部位状态。
3. 所有玩家输入经 `game.executeCommand` / `executeItemCommand`；NPC AI、破坏与转换均由真实调度器触发。production 除既有UI通过host.game()/extensionRuntime做会话身份与退休校验外，禁止 Game/Monster 机械实例读写、monkeypatch、WeakMap调度根、自行 RNG、Date/Math.random 规则分支。
4. 全局预算沿底座：单体≤16格、群≤17成员/64格、攻击束≤4、候选≤32/成员、回溯≤128、区域及整局收据限额不改。超过预算返回既有失败，不截肢出生。
5. 支配/变形/复制按既有通用资格，不能因Boss身份添加免疫。转换失败、旧目标、坏存档须保持已有原子性，不吞异常或重建新局来掩盖不一致。

## 5 i18n 与沿用 UI

将以下键合并到 `locales/zh_CN.json`；只替换已有 module.description，其余新加，首批名称不改。描述中的“灯”仅外形比喻，**不配置发光/照明能力**；“铜”不产生矿物掉落。

<!-- giants2-locale -->
```json
{
  "ext.giants.blind-lantern.name": "盲灯蜷兽",
  "ext.giants.blind-lantern.description": "蜷起的肉躯顶着一层干硬的灯褶，头端苍白如熄灭的灯芯。击破灯褶能拖慢它并暴露芯首；伤势过半时，它会舒展成长钩般的躯体，随后加快追击。它只在侧室内活动。",
  "ext.giants.blind-lantern-open.name": "展躯盲灯兽",
  "ext.giants.blind-lantern-open.description": "灯褶已经收尽，苍白的长躯弯出一个钩角。它转身需要整段空地，步伐比蜷伏时更快；此前的伤势不会因展躯而痊愈。",
  "ext.giants.blind-lantern.mantle": "灯褶",
  "ext.giants.blind-lantern.wick": "芯首",
  "ext.giants.copper-tendril.name": "铜须伏螯",
  "ext.giants.copper-tendril.description": "四条铜色节须撑起扁阔的躯干，须尖贴着地面寻找落脚处。每条节须都能独立受击和近身抽打；击断三条后，它便只能停在原地，用剩余部位迎击。它不会越过侧室边界。",
  "ext.giants.copper-tendril-limb.name": "伏螯节须",
  "ext.giants.copper-tendril-limb.description": "铜须伏螯的一条支撑节须。折断会伤及核心并拖慢整体移动，不会独立掉落物品；失去的节须不再长回。",
  "ext.giants.module.description": "在可绕开的地下侧室中遭遇岩脊兽、沉渊巨像、棘脊爬兽、页岩织兽、盲灯蜷兽与铜须伏螯。"
}
```

沿用 `BossHud.vue` / `selectBossHud` 及共享侧栏、检视、目标系统。不新增面板/按钮/输入层；点实际部位而非包围盒，破坏区与剩余成员沿既有DTO显示；转换后从当前form取名字，不靠spawnDefinitionId固定旧名。继续使用现有通用转换消息（含失败消息），不在hook硬编码名字。只见节须时不得显示未见核心HP、完整肢数或墙后轮廓；ACK历史帧不得读取下一帧状态。

测试实际渲染与文字：1440×900、390×844、320×844，普通/沉浸、四种地图模式。至少蜷伏/破甲/展躯和完整/断须各有检视与HUD证据；检查凹角地形、目标接触、窄屏截断、无额外条目、切回放/seek后的正确名字。SFC 使用共享 harness 只读导入；真实浏览器基于本次build，环境做不到的逐格标未运行，由维护者补验，不用组件截图冒充真实游戏。

## 6 路径与导入白名单

### 6.1 生产入口（穷举）

模块自有文件、`vue`、`i18next`；以下相对/别名路径解析后同一规则。既有代码无需无谓改写。

| 允许外部路径 | 限定用途 |
| --- | --- |
| `src/ext/descriptor.ts` | FOUNDATION_PROTOCOL值；ModuleDescriptor类型 |
| `src/ext/types.ts` | **仅import type**：ExtensionModule/Context/Json/Snapshot/ActorFacts等 |
| `src/ext/fingerprint.ts` | extensionDataFingerprint |
| `src/ext/json.ts` | isJson/validId等纯校验 |
| `src/ext/nativeForms.ts` | 现有形态验证、空间声明转换与i18n数据适配 |
| `src/ext/generation.ts` | 生成贡献验证与类型 |
| `src/ext/bodyTransitions.ts` | 转换验证与类型 |
| `src/ext/world.ts` | **仅import type**：既有验证/投影DTO |
| `src/engine/Movement/SpatialSchema.ts` | SpatialCatalog用于定义校验；身体/部位/profile类型；不操作活动Game |
| `src/engine/UI/MonsterZones.ts` | 既有zoneStatusText与PublicMonsterZone，纯显示 |
| `src/ext/ui/types.ts` | **仅import type**：模块UI贡献/会话 |
| `src/ui/displayProjection.ts` | **仅import type**：DisplayFrame |

不新增表外生产导入；不笼统开放 `src/engine/**` 或 `src/ui/**`。不得直接或间接引用其他模块源码/数据/测试/资源；已有通用协议字符串不等于硬导入。模块自有 `giants2_imports.test.ts` 用 TypeScript AST 覆盖 import/export-from/import()/require、别名与type/value区别；共享 boundary 同时运行，不更改它。

### 6.2 测试与文档

自有测试可用 vitest、node内置、仓库现有依赖、`src/test/harness.ts`、`src/test/support/**`、`src/ext/testing/**`、共享catalog/registry/runtime/codec/spatial/Combat/Game/Random/UI纯接口。测试可布景、读底层状态作断言，但必须标诊断；自然trace不能布景。组合只经catalog发现和模块ID选择，不 import 其他模块内部。不能把测试辅助文件被production反向引用。

新增测试均放 `src/ext/modules/giants/tests/`，在自有 `test-suites.json` 精确登记（常规test或drift，不能漏或双登记）；trace在自有data。可读基线/任务包作契约，不能修改共享测试、其他模块 trace、scripts 清单、tsconfig/vite/package/lock、公共locale。文档仅配置手册与新报告可写；不改本任务包、README、HANDOFF、设计稿或5Z清单。

## 7 验收用例（自有单元 + 真实 Game）

推荐文件名如下；可按耗时拆分，但覆盖不能删，报告逐项映射到实际测试。使用正式安装/验证器，不用 `SpatialCatalog(true)` 冒充生产许可。

| ID / 建议文件 | 必须证明 |
| --- | --- |
| G2-DATA / giants2_contract.test.ts | 精确新增数据、旧前缀不变、9/6/2/2/2/2计数、翻译齐全、两species计数；完整/子包schema与Runtime安装；坏mask/断链/未知form/额外drop字段拒绝；独立、组合安装；新指纹匹配且不同旧指纹。 |
| G2-IMP / giants2_imports.test.ts | §6白名单，无跨模块引用、生产无测试入口/世界写入。 |
| G2-MASK / giants2_geometry.test.ts | 每pose实占7/5格，凹角空格可走/不受击；尾格索引与zone旋转、墙角及sweep阻挡；真实区域边界对完整掩码有效，不缩小落点。 |
| G2-ZONE / giants2_parts.test.ts | 真实Game/Combat命中灯褶、过量伤不多传、1:1、破坏唯一、150→200、芯首×2、破区仍占格；通用provider缺席lock与combat存在韧性路径各验，不能双叠；读档/重访不累乘。 |
| G2-BODY / 同上 | 真Game创建5实体/8格/4父边；合法移动与受阻正耗时；成员单独HP、正HP限额1/4传core、断须空位/墓碑/一次收据、支撑2仍可走/1不可走仍能攻、核心死全体退休无额外掉落/kill；成员不各自调度。 |
| G2-PHASE / giants2_phase.test.ts | hp43不触发/42与1触发、由真实NPC决策提交；ticks200/hpCost0、ratio不回血、姿态兼容、保留id/encounter/region/status/relationship；新形态无旧灯褶、不二次尝试。无落点与预算失败仍正耗时/spent，存读后不重试；测试失败可用诊断封墙但不能作为自然证据。 |
| G2-GEN / giants2_generation.test.ts | 两模板边界D1/2/4/5/8/9候选列表与自然实际placed；chance关闭/空间不足/预算占用的诊断负例；区域、guard、完整身体/部位落点、上下楼梯可达且可绕行；不能靠直接create证明自然出生。 |
| G2-REWARD / parts或phase | nativeFormData两率皆0、新生无携带物；部位破坏/phase无额外物品与奖励、核心终结一次；growth存在/缺席均可玩，不虚构正XP预言。 |
| G2-PERSIST / giants2_persistence.test.ts | 自然trace关键切点的save/load继续、逐条replay零OOS、seek与续录；诊断坏区域/zoneHP/群成员/规则指纹、缺模块拒绝且不退休旧局，不修改旧输入绕manifest。 |
| G2-UI / giants2_ui.test.ts | 真实DisplayFrame接SFC/HUD/侧栏；完整、破坏、转换、只见部分、幻觉/隐蔽、ACK旧帧、回放与seek；重复投影不改世界/双RNG。 |
| G2-COMBO / giants2_combinations.test.ts | §8.3九行相关组合真实闭环；combat软能力实际触发，growth零报价不影响终结。 |
| G2-TRACE / giants2_trace.test.ts（drift） | §8两条新自然trace，逐条真实命令重建；只在重采脚本里搜索，常规回归直接固定选定seed/commands。 |

用诊断fixture设置HP/地形的测试可以证明边界，但不能导出为“默认新局自然录像”。真实攻击的期望从表与独立算式给出，不由同一生产计算器反算自身。失败路径禁止仅断言未抛异常，须比较身份/时间/双RNG/收据和未生效字段。保存/回放事件必须来自正式命令，不能人工编checkpoint或伪造recordingOrigin。

## 8 自然 trace、持久化、组合与删除计划

### 8.1 选种子与采集（有界且可复现）

交付 `data/giants2-lantern-trace.json`、`data/giants2-copper-trace.json` 及模块自有只读路线/采集helper。固定 `modules:['giants']`，**mode:'wizard'** 用于稳定验收（沿既有自然trace惯例）；“自然”仅指正式生产生成与命令，不把wizard生存能力当普通难度平衡证明。额外 normal 模式短局新生/接触至少一种，报告实际成败，不要求normal击杀。

对每种目标分别从 seed=1 开始递增至64；使用最终合并包原样生产概率/深度。D1正式startNewGame，从2开始逐层走公开移动/search/stairs_down至目标最大深度（盲灯4、伏螯8），按depth递增选本seed首个有该form且placement=placed的自然场地，校验 `readCreatureBirth.creationReason==='natural'`、template/region/encounter/body匹配。路线可只读全图/实体规划，但不reveal、不teleport、不改HP/物品/怪物/地形/种子/RNG/概率或跳层；报告注明这是测试路线的全图只读规划，不冒充玩家探索策略。

每seed最多3000条下楼/装备/吃/等待/search命令，战斗再限800条；超过上限、死局、无安全路线、未生成、战斗未完成，记录具体原因并换下一seed。路线方向固定上、下、左、右、左上、左下、右上、右下，平局y/x/ID；可沿 `naturalFixture.ts` 与 `giants_composite_natural.test.ts` 的有界BFS方法，禁止无限改路线挑一次成功。若1…64均失败，再顺序65…256一次扩展并写原因，不改产品数据；仍无完整闭环则报告阻断和最接近候选，不注入Boss冒充成功。相同seed重复失败不删记录，也不累计重叠测试通过数。

盲灯：优先逼近灯褶真实格，以公开近战/投掷攻击到首次破甲，保存；转攻芯首直到下一NPC决策自然展躯，再保存；继续至encounter defeated。蜷伏未破甲即意外转阶段则该seed未满足本trace要求，记原因换seed。伏螯：按距离、partId稳定选须，公开攻击至至少3条折断、核心仍活，保存不能移动的状态；再公开命令击杀核心并验退休/终结。适时装备/卸鞭、食物与恢复只能经原生命令；不可发测试专用战斗技能。

记录种子搜索表（seed、到达depth、placed/skip及原因、事件数、失败原因），最终固定seed、mode、modules、commands（真实action/data/decisions）、关键事件索引、末态摘要/双流、总tick、录像字节数与出生证据。回归优先沿当前自有 `data/*natural-trace.json` / `giants_*trace.test.ts` 的小型输入结构，允许加本次检查点字段；不改 recording v4 格式。单文件≤1MB，完整录制/截图放仓库外，提交紧凑commands与摘要即可；不把大JSON拆碎绕限制。

### 8.2 存读、回放与 seek（两条trace都执行）

关键切点：新局0、出生到达、破甲/第1与第3断须的前后、转换前后、终结前后、最终事件。保存只能在命令与ACK/确认结算后；pending确认答案记实际 `events[i].decisions`，ACK沿现有机制处理，不把确认与ACK混同。

1. 捕获每关键点的规范机械快照及消息、时间、实体ID/群槽/zone/区域/encounter/转换history、nextEntityId、两RNG状态/调用计数；只归一化现有测试约定的savedAt等非机械元数据，不删HP/位置/状态或摘要叶掩盖差异。
2. 从破坏与转换后的 `toSaveSnapshot` 用新Game载入，公开命令重放后缀，比较完整规范末态、事件前缀/后缀及合法recordingOrigin续录。重新导出并从原始新局重放零OOS。
3. 原始录像 `loadReplay` → 每条 `replayStep(true)` 到底，逐条检查error/游标；与原末态精确相同。按“终点→0→转换/断须→到达→终点”非单调seek，每点与原捕获真相相同；0包含真实初始命令语义，不擅自丢事件。
4. 离开楼层再重访（至少每种一次）验证缓存部位/转换spent不复活、不重生、不重发奖励；无法纳入同条自然路线可另做明确标识的真实Game测试。
5. 改旧fingerprint、缺giants或坏空间闭包的输入在退休现存player/runtime前拒绝；拒绝不改其世界和双RNG。不得拿改manifest的假存档替代真实旧输入兼容测试。

### 8.3 相关组合（九行，不称128全覆盖）

按catalog当前七模块，执行 `[]`、`['giants']`、giants分别配combat/growth/narrative/crafting/foraging/settlement六行、七模块全开一行。每行实际startNewGame→原生命令游玩→save/load→继续→逐条replay→seek0/中段/末端→存档续录。无giants行断言没有巨兽声明/自有state/owned region；八个含giants行均须自然遇到至少一种**新**巨兽并有一次真实接触攻击，不准只遇旧岩脊兽凑数。可按同一搜索顺序为不同组合各选seed并记录；战斗边界fixture与自然出生都必须明确分列。

含combat至少实际破坏一个新部位验证provider路径；不含combat实际fallback；含growth验证核心/部位终结不复制奖励，其他模块验证自身初始状态/资源仍合法。最终全开还验证伏螯完整body的区域/占位不会覆盖世界节点或结构预留，沿 `giants_c5_placement.test.ts` 已有共享放置合同，不读取别家私有state作控制。

### 8.4 只删 giants 的删除计划

本包按最新5Z政策仅执行并报告 **plan**，不执行物理删除/prepare-only。当前精确命令（其余六模块保留）：

```bash
node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,growth,narrative,settlement --engine-only --maxWorkers=2
```

断言计划恰1行、removed只有giants、retained六个，正常full是外部未验证门禁；报告按原脚本列boundary/types/build/全部剩余test:ext/剩余64子集真实Game及缺模块档/录像拒绝。`--engine-only` 明确未验浏览器。

交5Z的实际执行命令为同参数移除 `--plan`，追加 `--output=/private/tmp/giants2-removal-<新的唯一目录>`；5Z需浏览器时再去掉`--engine-only`。脚本在副本整目录删除giants，清TS/Vite缓存，不留空壳，不改其余测试或用exclude/skip隐藏依赖。真实捕获的含新巨兽save/recording还须在删除副本验证拒绝（通用脚本的缺模块负例不冒充这两份实际输入）；原树保持不动。dot本步写出计划、输入存放方式及待5Z核对项即可，不宣称删模块已通过。

## 9 开发期与收尾门禁

统一 Node24.19.0、3GiB、maxWorkers2；所有命令在候选根执行，长任务保存日志摘要/exit/数量/耗时，不混入推送命令。模块内容扩充沿最新开发政策；“giants2收尾”不是整个5Z。

### 9.1 开发期（按里程碑完成，不逐文件重跑）

- M1：精确追加数据/i18n、真实schema与Runtime安装、G2-DATA/IMP；boundary、`npx vue-tsc -b`。
- M2：G2-MASK/ZONE/BODY/PHASE/GEN/REWARD/PERSIST 与直接受影响既有giants测试；boundary、types、`npm run build`。
- M3：新自然trace、相关组合、UI与配置手册；自有测试、直接受影响回归及build；探索搜索与最终固定trace回归分开计数。

每步最多两轮审查→修复；失败必须保留原exit与归因。无新的改动/失败/疑点不反复扩大验证。

### 9.2 最终候选一次收尾

```bash
node scripts/check-module-boundaries.mjs
npx vue-tsc -b
npm run build
npx vitest run src/ext/modules/giants/tests --maxWorkers=2
npm run test:drift -- --maxWorkers=2
node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,growth,narrative,settlement --engine-only --maxWorkers=2
git diff --check
```

另定向跑直接受影响的底座空间/部位/转换/生成回滚/持久化/显示/i18n与源守卫，按真实依赖逐文件列出，不用跑全部ext替代选取：先从 `src/test/phase4a0_spatial.test.ts`、`phase4a2_body_combat.test.ts`、`phase4d_production_body.test.ts`、`phase4d_body_lifecycle.test.ts`、`phase4e_body_transition.test.ts`、`ext_combat_transition_facts.test.ts`、`ext_generation_checkpoint_differential.test.ts`、`p1_30_i18n_gate.test.ts`、`u24_hardcoded_text.test.ts`、`repo_hygiene.test.ts`、`test_suite_membership.test.ts` 的实际存在文件定位；文件名以 `rg --files` 为准，不把通配符不匹配当通过。§8九行组合由G2-COMBO执行，不调用默认枚举128子集的共享composition脚本冒充定向。

UI按§5能执行的真实构建矩阵做完，未覆盖明确登记。生成变化必跑实际drift：旧giants trace如仅指纹或新增场地影响，可在**自有目录**单变量回退生产数据证明原因，再用原公开捕获方法重采，报告逐字段/事件变化。旧giants测试计数仅改前提，不改断言语义。共享或其他模块基线需要变更时只能报告并留本地，不擅自重录/skip；保留失败退出码，不称全绿。

**留5Z，不在dot执行**：完整npm test、全部test:ext、128组合、实际删除矩阵/只删giants、全项目性能/体积。也不跑ce:fetch/test:full/test:gen；不隐藏已有CE缓存制造跳过。此任务包起草只执行§A窄验证，不伪造已完成此节实施门禁。

## 10 交付、报告与回执

### 10.1 `docs/ext/giants2.report.md` 模板

1. 结论：完成/部分完成；两species/四forms，非矩形/部位/转换的实际闭环。
2. 基线与环境：代码基线、实际派发tip、工作分支、最终提交（避免把旧提交写成最终）、Node/options/workers、起始范围检查。
3. 写入清单：相对派发tip的diff文件，确认只在白名单；共享文件/版本零改动，旧内容前缀保持情况。
4. 数据与身份：§3合并精确性、locale、最终fingerprint、旧fingerprint拒绝；两种的数值/掩码/AI/深度/场地/零掉落。
5. SDK问题：编号、条款、预期/实际、最小复现、影响、建议本地修订、是否阻断；没有写无。已有失败与新增失败分列。
6. 用例覆盖表：G2各项对应测试/真实场景；诊断/自然/浏览器分类。
7. 门禁表：命令、exit、passed/failed/skipped/todo、耗时、首次失败与后续受影响复核分别保留，未运行写原因。
8. 自然trace：选种子全过程摘要、固定seed/mode/modules、出生depth/ID/template/region、命令/录像字节/tick、破坏/转换/终结索引、存读/replay/seek/续录一致性。
9. 组合九行与删除计划：实际结果，不称128或删除通过；真实含新种类档/录像的仓库外路径与5Z拒绝验证计划。
10. UI：viewport×布局×模式结果与真实/模拟/组件分类，未见信息及旧帧测试；截图仅仓库外。
11. 既有测试/trace改动：单变量反事实方法/结果、精确前提修改、原捕获命令与逐字段归因；共享失败交本地，不修改共享守卫。
12. 自行决定与维护者签认：§12固定决定状态、实施时新增的可逆选择、未授权能力不实施。
13. 遗留：玩法/状态正确性阻断与证据/5Z延后项分列，建议本地接续步骤。不能自行把功能缺陷标成无影响。

### 10.2 配置手册与提交

更新 `giants-config.md` 当前版本口径、两个新species索引、完整默认表/形状/部位/转换/生成/掉落与可配置限制、测试入口和指纹兼容说明；保留原三个 `giants-config-example` 标记与可执行JSON。新例子另用新标记，不让旧测试把第四段误当原三例。手册应可独立用于后续调数值，不只链接回任务包，不宣称有尚未实现的可配置掉落/再生/招式。

提交只用显式白名单路径，按data/i18n、tests/trace、docs等逻辑组织；最终相对起始tip检查范围与CRLF。提交信息前缀 `feat(giants):` / `test(giants):` / `docs(ext):`，末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。确认实际门禁结果后单独 `git push -u origin ext/giants2`；部分完成可提交可复现交付，但必须清楚报告阻断，不能称验收通过。不得推base/phase5/foundation/main、merge/rebase/tag或改任务包。

### 10.3 ≤30行中文回执模板

```text
giants2：<完成/部分完成>；两种新巨兽 <闭环结果>
分支 ext/giants2；最终commit <sha>；报告 docs/ext/giants2.report.md
起始tip <sha>；代码基线 e0fa39a225428d36e6e342f6585f57f45960e6ba
范围：<仅白名单/差异>；协议/版本 <未改/异常>；新fingerprint <值>
数据：9 forms / 6 templates / 2 bodies / 2 transitions <核对结果>
盲灯：非矩形/破甲/展躯 <结果>；伏螯：断须/支撑/终结 <结果>
门禁：boundary <结果>；types <结果>；build <结果>；diff-check <结果>
giants自有 <通过/失败/skip/todo>；受影响回归 <数量/结果>；drift <数量/结果>
自然盲灯：seed <n> mode <值> D<n>；<事件数/tick/字节>；破甲/展躯/终结 <索引>
自然伏螯：seed <n> mode <值> D<n>；<事件数/tick/字节>；断须/停步/终结 <索引>
存读/续录/replay/seek：<结果，OOS数>；normal补充新局 <结果>
相关组合：<通过/9>；只删giants：<plan一行结果，未实际删除>
UI：<矩阵结果>；真设备 <有/无>；截图仓库外 <路径>
旧测试/trace前提调整：<N项，报告位置>
SDK问题：<N条，最严重一句话>；功能阻断 <列表/无>
待维护者签认：G2-D01…D06 <按包执行/差异>；dot自行决定 <N条>
5Z未运行：完整npm test/全部test:ext/128组合/实际删除/性能体积
其他未覆盖：<列表/无>；推送 <成功/失败原因>
```

## 11 禁止改动与失败处理

白名单之外全部禁止，包括 `src/engine/**`、`src/entities/**`、`src/ext/*.ts`、`src/ext/testing/**`、`src/ext/ui/**`、`src/ui/**`、`src/components/**`、`src/test/**`、共享locale/data、其他模块、scripts、构建依赖、版本合同、共享基线/trace、本文及其他文档。即使只加一条白名单或修一行共享bug也需交维护者本地完成。

本次首批数据不调参；schema不放宽；失败不加skip/todo/延长旧超时，不把期望改成实际错误行为。自有旧前提确需修订时执行单变量反事实，只动前提并逐项记账。发现底座缺陷，保留失败结果与自有最小复现（需要时用仓库外独立probe，报告附可复制命令/输入）；不能通过移出发现清单制造绿灯。继续独立可做工作，交付部分完成与缺陷清单。维护者后续修共享代码，不要求dot跨白名单抢修。

## 12 预先决定、自行裁决与待签认

### 12.1 维护者待签认清单（本包按推荐起草，转贴即按此执行）

| 编号 | 本包已选方案 | 理由 / 可逆范围 |
| --- | --- | --- |
| G2-D01 | 本批恰2种：盲灯蜷兽、铜须伏螯；4 forms，名称/描述用§5 | 覆盖非矩形、固定区、独立部位与阶段行为，规模可控；不把变体算第三种。 |
| G2-D02 | §3所有数值、D2–4/50%与D5–8/45%、priority10、16×12入口5 | 用现有侧室预算与守场；后续可配表调整，不保证尝试率就是实际出生率。 |
| G2-D03 | 盲灯半血一次展躯、0HP/200ticks、ratio；四须至少2支撑、无新combat招式 | 只用冻结声明，不添加自定义AI或肢体再生；破坏/转换行为已有明确预言。 |
| G2-D04 | 零金币/物品/专属奖励，不新增growth报价 | 真实形态接口不提供掉落配置；若希望有战利品，需维护者另开底座任务，不能由dot暗加。 |
| G2-D05 | module/rules保持1.0.0、全部协议/schema不变；用现有新fingerprint拒绝旧输入 | 满足“内容扩充不改版本协议”；无需兼容或迁移旧giants录像。 |
| G2-D06 | 两条wizard自然战斗trace + normal短局；九相关组合；只删giants计划，实际删除/全量留5Z | 延续现有确定性测试及最新门禁政策；明确普通难度平衡、全覆盖与浏览器缺口不冒充完成。 |

上述不是“已逐条获用户批准”的事实；维护者可在派发前统一签认或修改本包。当前起草、实测、文档提交/推送已由用户明确授权，无须为这些可逆决定停工。

### 12.2 dot 未写明细节的裁决顺序

1. 用户本次范围与白名单优先；真实冻结接口优先于设计稿的拟议功能。本文若与执行代码冲突，记录条款/实测，不擅自改接口或数据蒙混。
2. 代码组织、测试拆分、只读路线helper、非名称类的补充UI/i18n文案可自行决定，保持数值/ID/顺序/命名/版本，报告逐条列出；不因常规选择向维护者往返。
3. 无空间、预算、先占场地、原生确认、AI等待按既有合同接收；不能为容易过测提高chance、改深度、删其他species或给玩家无敌字段。
4. 新指纹使旧giants输入拒绝是预期；自然路径变化须从正式入口重采。不能手改录制manifest/摘要，不能把共享守卫失败定为可忽略。
5. 只能越白名单/新增协议/引入持久根才能解决的项目，停止该子项并报告最小复现，其余继续；不得将完整目标偷偷缩成只有schema能通过。
6. 审查最多两轮；第二轮后的未解决问题分功能缺陷与证据缺口登记报告，由维护者归入5Z或专门修复。没有自然命中、真正部位破坏或转换闭环时必须标部分完成，不能只写“待5Z”后声称玩法交付。
