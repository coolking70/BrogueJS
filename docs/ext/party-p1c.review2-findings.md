# Party P1c 第2轮独立复审（最后一轮）

结论：**可合入**。第1轮 P1c-R1-N1、N2、N3 均已修复并经本轮独立复验关闭；在本轮定向范围内未发现修复引入的新阻断或重要问题。无 party 的原五配置字节与行为观测保持。本结论不扩展为全量门禁、性能、浏览器或发布验收。

## 审查身份与范围

- 日期：2026-10-20。基线 HEAD `075b7eb10c87394fa5497fca3ff98e4ff63ac3c6`，分支 `ext/party-p1a`；对象为工作区相对该 HEAD 的 P1c 实现及修复未提交差量。
- 已先读第1轮独立 findings、实施报告“审查发现处理”，并读项目 HANDOFF、development、architecture。此次为最后一轮定向复审，不把历史内部 R2 或作者回归结论当作独立通过。
- 实测源码 SHA-256 为 `65d56f6f50e9d2677b8ff0150449e5b89a0cc2ea58eb59b67cd18a373b21dbc1`，与作者修复后身份一致。范围为 src/**、scripts/**、.github/**、package.json、package-lock.json、vite.config.ts；相对路径排序，以 path+NUL+sha+LF 汇总。运行前后复核一致，清单在 `/private/tmp/p1crev2/source-manifest.json`。
- 对首轮 `8b64f05a3f807d4caa42f8728e312b30695d4cc604c39e65890c03b869bf3ee8` 独立比较，恰好变化8文件：Game、Core/PartyAi、Monster、ext/partyAi 四生产文件，两新增回归文件，两测试登记文件。对四生产文件在仓外逆向移除本轮修复，分别精确匹配首轮逐文件 SHA-256，确认没有其它生产差量。证据为 `source-delta.json`、`production-fix.diff`、`reconstruction-proof.json`；逆向文件仅用于静态归因，没有替换仓库生产文件或作为测试候选。

## 第1轮问题裁决

| 问题 | 本轮核实 | 裁决 |
| --- | --- | --- |
| P1c-R1-N1 原生待选切 AI 导致失权 | `Core/PartyAi.ts:50` 将 native.modal 纳入非空闲；`Game.ts:4726–4730` 在重算 modal 后结算待切控制。原探针中 escape 不再抛 NOT_CONTROLLER。新增整文件覆盖主/非主成员 wand 待选与游标、飞镖取消/完成、鉴定/附魔回答、有害物品确认取消；零耗时回答生效，未放宽忙碌/长动作/状态闸。原生单步 modal 保存仍按原合同拒绝，回答后存读、seed replay 和中间/末尾 seek 通过。 | **关闭** |
| P1c-R1-N2 同伴指令绕过不可移动能力 | `Core/PartyAi.ts:334` 使用既有 hasCEBehavior 展开 TURRET 的 IMMOBILE 语义，返回原 native remainder，保留同一次 prelude 和特殊能力；`Game.ts:14621`、`Monster.ts:1773` 保留直接适配入口防线。原凤凰蛋探针不再位移。新增整文件验证真实凤凰蛋/箭塔、party-only/combat 调度、square/composite 两种不可动标记、移动/近战直调、射击与计时、单次 prelude、双流和存读回放/seek。可动同伴及身体动作相关回归也通过。 | **关闭** |
| P1c-R1-N3 临时 AI 待决重复 human 非 no-op | `Core/PartyAi.ts:132–134` 只有无 pending 时才把首次 human 取消临时覆盖视作变更；已有同值 pending 直接 no-op。原探针通过。新增自然食物确认回归覆盖 human→同值→AI→同值→human→同值，比较完整摘要、双流、allocator、事件列表及 epoch；待决不提前清 temporaryAiSeq，存读后重复请求、回答及下一空闲边界、续录与双向 seek 通过。 | **关闭** |

N2 同时核对本机 CE 执行源码 `/Users/coolking70/Documents/同步空间/BrogueJS/.ce-reference/BrogueCE-master/src/brogue/Monsters.c:3385–3393`：IMMOBILE 只尝试特殊能力并返回。修复没有把下指令当成移动/近战能力授权，也没有改全局原生决策路径。三项新语义已进入 `PARTY_AI_RULES`，仅改变 party 模块规则指纹。

## 无 party 不变性

- 本轮实际运行 `src/test/ext_party_inert.test.ts`，原五配置全部匹配：classic、extended-empty、growth、loot、固定八模块（不含 party）。seed42、四次真实 wait，固定 Date.now，比较完整序列化 save/recording 的 SHA-256、Game 自有键集合、双 RNG 完整状态、消息字节摘要。未删字段、未重录夹具。
- `src/test/fixtures/party-phase6-inert.json` 与 HEAD 原字节相同；测试相对 HEAD 仅将相同八模块列表提为显式配置供依赖扫描识别，输入及断言语义不变。
- 静态复核 Game/Monster 新行为均位于 party 分支或专属入口；本轮修复不改普通 takeTurn/prelude/native remainder。有效 codec 的无 party 分支仍为 F20/S7/R4/O2；新增规则指纹仅由 party descriptor 消费，无新增 Game 机械字段。
- 因此本轮覆盖的无 party 字节及行为观测保持，未发现无 party 行为变更路径；这不冒称穷举全部种子、对象图与随机执行路径。

## 本轮实际执行

环境：Node v25.2.1、Vitest 4.1.11、heap3072MB、单 worker、no-file-parallelism。证据目录 `/private/tmp/p1crev2/`。

1. **首轮原始三个探针原样运行：3/3 通过，3.40s**，日志 `original-probes.log`。未改探针前提、断言或生产文件。

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run \
  --config /private/tmp/p1crev1/findings.config.ts --maxWorkers=1 --no-file-parallelism
```

2. **相关整文件：19 文件 / 173 项全部通过，exit0，204.54s**，日志 `related.log`。包含全部12个 party_ai* 文件（含两新增文件16项）、actions/window/window_decisions/lifecycle、两个 combat body 整文件、原无 party 字节夹具。不同批次的重叠覆盖不累计为独立场景数。

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run \
  src/ext/modules/party/tests/party_ai \
  src/ext/modules/party/tests/party_actions.test.ts \
  src/ext/modules/party/tests/party_window.test.ts \
  src/ext/modules/party/tests/party_window_decisions.test.ts \
  src/ext/modules/party/tests/party_lifecycle.test.ts \
  src/test/ext_party_inert.test.ts \
  src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts \
  src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts \
  --maxWorkers=1 --no-file-parallelism
```

3. **boundary：exit0**，日志 `boundary.log`；**测试依赖检查：exit0，707文件、errors=[]**，日志 `dependencies.log`。两个检查脚本与 HEAD 原字节相同，未修改守卫。

```sh
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
```

仅运行上述相关测试与两项检查；未运行全量、drift、types/build、删除矩阵、Worker长链、性能、云端、浏览器或真机。作者列明的跨格式比较工具、正式云端及人工验证留项不因本次结论自动关闭。本轮未修改实现、测试、守卫或其它仓库文档，未 commit/push；仓库内仅按要求写入本复审报告。原同名历史报告已备份至 `/private/tmp/p1crev2/previous-review2-findings.md`。
