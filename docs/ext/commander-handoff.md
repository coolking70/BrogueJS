# 临时指挥交接单（Claude → Codex 指挥进程）

> 2026-10-07。Claude 额度紧张，由 Codex 指挥进程临时接管“维护者侧”工作：写任务书、派发本地 Codex 执行进程、审查、合入、给维护者（用户）准备 dot 转贴文本。用户说中文，回复用中文。

> Codex接管更新（2026-10-08）：5C1代码5dbeb32已验收推送；5G原0fb2720按部分交付接收，共享修复已独立验收，新返工基线codex/phase5g-revision-base=db50a84511dde0b0196f8b182205b9ea70086ef3已发布，待用户转贴新§0。5G尚未合入ext/phase5；本地下一步5D1任务书/合同核对。详见[指挥状态](commander-status.md)。

## 1 工作方式（必须遵守）
- 先读根 `AGENTS.md`、`docs/HANDOFF.md`、`docs/ext/README.md`。扩展分支是独立新产品原型，不合 main；不改 main。
- **执行与审查分离**：每个开发步骤由一个本地 Codex 执行进程实现（不 commit）；完成后另起一个 Codex 进程做只读独立审查（发现写 `docs/ext/<step>.review-findings.md`）；再让原执行会话 `resume` 修复；指挥进程核对报告后 commit + push。
- 执行进程命令模板（detached，完成写 done 文件）：
  `nohup zsh -c "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex exec -c model_reasoning_effort=\"high\" -C <worktree> -s workspace-write --add-dir /Users/coolking70/Documents/同步空间/BrogueJS/node_modules --add-dir /private/tmp -o <report.md> '<提示>' < /dev/null > <log> 2>&1; echo exit=\$? > <done>" & disown`；续跑用 `... exec -C <wt> ... -o <report> resume <SESSION_ID> '<提示>'`（会话 id：`grep -m1 'session id:' <log>`）。遇 “Selected model is at capacity” 就 resume 同一会话。
- 环境：Node 24.19.0（`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 放 PATH 前），`NODE_OPTIONS=--max-old-space-size=3072`，vitest `--maxWorkers=2`。
- **门禁政策**：开发期每步只跑相关测试 + `node scripts/check-module-boundaries.mjs` + `npx vue-tsc -b` + `npm run build`（涉及生成/地形时加 `npm run test:drift`）；完整 `npm test`、全部 test:ext、删除矩阵只在阶段收尾（5Z）跑。不放宽断言、不加 skip、不拉长超时；旧前提过时要单变量反事实证明后最小调整。
- 提交信息末尾加：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`（沿用）。ext 分支可直接 push；`ext/foundation` 只接受已验收修复（fast-forward）。
- **dot（云端 Codex）**：用户手动转贴，往返成本高。只给大块、自包含、契约先行、决策预先给定的任务包（`docs/ext/*.dot-package.md`，含 §0 转贴块、§A 派发前核对清单）。dot 回来的摘要由用户贴给你，你负责验收（拉分支跑门禁、范围检查、必要时浏览器看界面可请用户帮看）。
- 遇到需要用户决定的事：按合同/推荐方案先推进并记入“待用户确认”清单；只有影响大且难回退时才停下来问。

## 2 工作树与分支
| 工作树 | 分支 | 用途 |
|---|---|---|
| `BrogueJS-p5` | `ext/phase5` | **阶段 5 主线**（含已验收5A1–5A4、5B集成、owner修复和5C1；生产5C1提交5dbeb32，后续可有指挥文档提交） |
| `BrogueJS-5gbase` | `ext/phase5g-base` | 5G foraging派发基线（7fdc249已发布，用户已交dot执行） |
| /private/tmp/brogue-commander-20261007/phase5g-revision-base-tree | codex/phase5g-revision-base | 新隔离返工基线（已发布db50a84，待用户转贴；不代表5G验收） |
| `BrogueJS-5bbase` | `ext/phase5b-base` | 5B 派发基线（已用完） |
| `BrogueJS-5b` | `ext/phase5b` | dot 的 5B（已合入 phase5） |
| `BrogueJS-lootcore` | `ext/phase6-loot-core` | loot 纯核心 v1.1 + 6B1-β UI 组件（已验收 `93523fc`，不接入游戏） |
| `BrogueJS-design` | `ext/phase5-design` | 阶段 5 设计/任务书 |
| `BrogueJS-loot` | `ext/phase6-loot-design` | loot 设计/数值 |
| `BrogueJS-ext` | `ext/fix-scheduler-due` | = `ext/foundation` `d389f90` |
版本（phase5 HEAD）：foundation 10、whole-run v6、recording 4、origin 2、worldSdk 1（SHA 见 5A2/5A4 报告，**不得改**）、growth 1.8.0、combat 1.6.0、crafting 1.0.0。

## 3 进行中
1. **i18n源码守卫修复**：52e2b90已完成并推送，启动核验已通过。
2. **5G底座阻断已解除**：owner查询修复由本地执行、另起独立审查无发现，相关242项及独立73项通过，5e97530已推送ext/phase5；SDK/格式未变。
3. **5G任务包已发布**：origin/ext/phase5g-base = 7fdc2491cc3014f2c1a3736e262c7ff8b5d39ce7。基线5e97530 + 原定稿两个文件 + 文档修订；独立审查F1/P2已交原会话resume修正并由指挥关闭。见[派发报告](phase5g-dispatch.report.md)与[审查](phase5g-dispatch.review-findings.md)。旧34bb6c7保留本地ext/phase5g-base-before-owner-20261007。
4. **5G集中返工包已发布**：原0fb2720四条署名提交/48白名单文件已核对；共享修复3f6e237和5C1已在独立分支整合并审查。代码基线6874dbb07a67c6873b30580d0c06af2a42507875，派发tipdb50a84511dde0b0196f8b182205b9ea70086ef3，treecd4a1fdf9a94538180a0a67a1feb174fdb8c3a3e。见[新返工包](https://github.com/coolking70/BrogueJS/blob/db50a84511dde0b0196f8b182205b9ea70086ef3/docs/ext/phase5g-revision.dot-package.md)。相关208与npm drift12通过；原组合11通过/1个已知模块失败保留。待用户转贴§0，dot新分支codex/phase5g-revision；旧ext/phase5g不动。SDK-03模块吞错等必修清单见包，5G未最终验收、未合主线。原§12.3推荐继续临时采纳，细项见指挥状态。
5. **5C1本地验收通过并推送5dbeb32（2026-10-08）**：final4新24矩阵与六设施持续交互通过，F1–F6/R1/R2按本步范围关闭，见[维护者验收](phase5c1.acceptance.md)。原开工记录：[phase5c1.task.md](phase5c1.task.md)，用户已授权派执行进程；优先gpt-6.1-sol/high。此前将§4误读为等待5G集成的串行排期已纠正，依据营地设计§14.2与采食设计§11。

## 4 接下来（dot集中返工，本地按依赖推进）

1. 5G新返工包已发布，用户转贴后由dot修订。收到新回执后隔离验收，合格再合入ext/phase5并做本地集成；当前不把原部分交付合入。
2. **5C1营地与建造已完成**：代码5dbeb32，报告与维护者验收记录齐全；窄屏合成地图跟随/输入所有权和背包关闭后营地重开已处理。可选5C2地表暂后置，不阻塞5D1。
3. **下一步5D1居民与需求**：先形成任务书和C5-1离线DTO修订合同，沿用营地设计§14.1/14.2与采食设计§10/12.4；日粮/短缺/离开、版本安排及5A4交接先核对，再派本地执行→独立审查→修复→提交。5D2工作/离线、5E防御随后按依赖；当前尚未开工。
4. **周期完整摘要卡顿**：每 256 条命令完整摘要在 D8 约 1.1–1.3 s。5A3 报告附有 Worker 异步摘要接口草案；建议在 5Z 前单列一步实现（待用户确认排期）。
5. 阶段 5 收尾 5Z：完整 npm test、全部 test:ext、全部组合 smoke、完整删除矩阵、浏览器全面验收。
6. loot：6A0/6A1（物品扩展底座）→ 6B1 接线/6B2 → 修 6B1-β 遗留 S2（比较行缺目标条件与符文名）。

## 5 待用户确认（已按推荐先执行）
## 5A4 任务书（子代理自定，已按推荐执行）
- E2 edibleSdk.ts 独立入口；E8 喂食/烤制耗时=movementSpeed；E9 未知蘑菇“不太饿”确认用同组最大饱腹；E10 心灵感应/幻觉/黑暗对怪物 notApplicable；E12 地面火接触 10 块冷却；E13 着火判定在 setBurningDuration 后 randRange(1,3)；E14 烤制命令烤爆燃菌在热源格爆炸；E17 热源由底座识别（篝火 + station.hearth 工位），不要求 combat/crafting 改动；E22 幻觉下蘑菇名不变；E25 同伴死亡删需求行；E26 离队同伴保留盟友标记但不跟随不攻击走向楼梯；E29 参与者出错只丢参与者写入
- 缺口：洞穴区域偏好首版不做（只认发光菌/菌林）；5A2-S more 槽下限 0 → 5G 同伴虚弱改用 increased 负值；揭示烤菌是否顺带揭示生菌（建议是）
## 6B1-α（dot）验收
- 复核：范围干净（只动 loot/narrative/docs + 设计合并带入的探针脚本）；boundary/vue-tsc/build 通过；loot+narrative 550 项通过；浏览器桌面与 390 宽立绘清晰、像素锐利、风格统一（dot 环境受限未做的浏览器矩阵由我补做）
- 统计偏差 46 项 + 数值表自身算术差异 19 处 → 子代理分析并出 v1.1 调参补丁，待用户确认
- dot 自定 23 条、待集成复核 15 条（见 phase6b1a.report.md）
- loot v1.1 调参（docs/ext/phase6-loot-tuning.md）：46 项中仅 8 项需改数据；19 处算术差异均为数值表四舍五入。补丁 4 字段：遭遇唯一权重 稀缺 30000→5000 / 标准 30000→10000 / 丰饶 60000→5000；warding 只限护甲。待裁：M1 Boss 唯一乘数改 ×0.5/×1/×0.5（推荐）；M2 戒指不再出 warding（推荐）；M3 丰饶保留 elite 1–3、接受 D26≈21 件/层（倾向）；M4 武器伤害代理高 30% 留到 6B2 用怪物倍率抗衡；批准数值表勘误
## 5A2
- 合入 ext/phase5。工作局每批新增 P95：D1 2.95 ms / D8 3.17 ms（门槛 10 ms）。
- 遗留：每 256 条命令的完整摘要边界在 D8 P95 约 1.13 s（随已访问层数增长）——会造成周期性卡顿，建议在 5Z 前改为增量/后台计算（待排期）
## 5A2-S
- 回血键合同冲突（旧速率非整数）：我裁定用精确分数，仅在回血消费边界转 number（Codex 推荐）
## 5B 基线
- 组合 smoke 脚本自 5A1（录像 v4）起失效，已在 ext/phase5b-base 修复（d56247f），需随后合入 ext/phase5
- 调度器崩溃（3a0 起既有）已在 foundation 修复（ext/foundation 前进到含修复的提交），待 5A2-S 完成后合入 ext/phase5；dot 分支集成时带上
## 5A3
- 审查 3 个 P1（结构层原生地形变化每格 ~39ms 重事务；有结构时每条推进时间的命令 +35ms；关门自锁）+5 P2 +8 P3，全部交 Codex 修
- 我定：结构墙阻挡火/血/蛛网等表面效果传播；遗留物容器满时溢出落地；生成期节点不阻止撤营
- 周期性完整摘要卡顿（D8 ~1.1–1.3 s/每 256 命令）：本步只做 SHA 热循环重写等低成本优化；Worker 异步摘要管线建议另立步骤（待确认排期）
## 5B（dot）验收
- 复核：范围干净；boundary/vue-tsc/build 通过；crafting 708 项通过；浏览器桌面合成矿镐成功、材料正确扣减
- 发现：390 宽打开合成面板时地图被压成一条（约 80px 高），需调整
- 待集成：合入 ext/phase5（5A3 之后，foundation 7→9）；SDK-01..05 由本地补底座；dot 报告的 test:ext 30 项失败需本地完整跑一次归因
- 5B 集成完成并合入 ext/phase5：SDK-01..05 补齐；dot 报的 15 个超时本地全部未复现（原门限内通过），其余旧前提经反事实修订；完整 ext 4100 通过
- 小问题：窄屏合成抽屉展开时地图视口不跟随玩家（收起后正常）——留到 5C UI 一并处理
## 5G 蘑菇 dot 包（草稿 ca5c63e，未派发）
- 待 5A4 修复合入后核对 §A 再派发
- 待签认：nonEaters 20 个模板；外观名池中“幻彩菌”含“幻”字可能暗示致幻（我建议替换为不暗示任何效果的名字）；禁用词表新增 12 词；烤菌/焦炭外观；揭示规则；烤制页不按种类过滤（未知爆燃菌也能烤，在热源处爆炸）
- 6B1-β 验收通过（）；遗留 S2：比较行遗漏目标条件与符文名称 → 6B2 接线时修

## 6 启动后第一件事
`git -C /Users/coolking70/Documents/同步空间/BrogueJS-p5 log --oneline -5`、检查 §3 两项的 done/报告文件与远端分支状态，然后向用户简短汇报并继续 §4。
