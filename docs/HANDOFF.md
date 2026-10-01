# 交接说明（接手先读）

本文件写给接手 BrogueJS 的开发者或 AI 会话：项目现在处于什么状态、之前定下了哪些不再重议的决策、怎样继续推进。

最后更新：2026-10-01（CAPTIVE-1 俘虏锁链修复完整验收通过，已按用户授权合并 main）。

## 1. 项目一句话

BrogueJS 是 [Brogue CE](https://github.com/tmewett/BrogueCE) 的 TypeScript + Vue 3 网页移植，带中文界面，支持桌面与手机触屏。**目标是规则、交互与内容与 CE 源码一致**；不是另起炉灶的"类 Brogue"游戏。

## 2. 当前状态（v0.2.0）

| 层面 | 状态 |
|---|---|
| 规则层（生成、AI、战斗、物品、机关、深层终局、存档录像） | 与 CE 对齐（v0.1.0 起，经 X-0/X-1/X-1b/X-2 四轮只读勘察） |
| 交互与自动行动层 | 与 CE 对齐（v0.2.0，X-3 勘察 47 条全部修复） |
| 内容完整性（目录、生成出现率、物品详情、文本） | 与 CE 对齐（v0.2.0，X-4 勘察 26 条全部修复） |
| 前端 | 响应式（桌面/平板/手机竖横屏）、触屏命令栏与手势（FE-1） |
| 测试 | 约 240 个测试文件、4500+ 项断言；两份生成基线、三份黄金 trace |
| 仓库布局 | 独立项目（BJS-1）：项目在仓库根，CE 参照源码按需 `npm run ce:fetch`，旧开发文档归档在 `docs/archive/` |

发布：GitHub `coolking70/BrogueJS`，tag/Release `v0.2.0`。公开试玩由 GitHub Pages 从 `main` 自动构建发布：<https://coolking70.github.io/BrogueJS/>（见 `docs/release.md`）。

历史来源：本项目从 `coolking70/BrogueCE-chs` 仓库的 `brogue-web/` 目录整理而来；那个仓库保留完整开发历史和全部验收证据（约 850 MB），本仓库只保留代码、测试与文档。

## UX-1 试玩整改（2026-09-29，已合并 main）

`codex/playtest-fixes` 独立工作树已实现桌面交互与缩放、背包字母优先级、消息确认/结算顺序、任意阶段保存录像与有效存档续录，以及保持路径次序的寻路优化。最终build、CE完整套件（246文件、4563项通过）与drift通过，生成基线/黄金trace未重录。本地 main 已含 UX-1 合并提交 6aaf968 和 Pages 发布配置 ee51a11。原自动化按用户要求停用。详细证据和唯一旧测试夹具前提修订见[UX-1报告](reports/ux-1.report.md)。原设备麻痹死亡与自然长局D4卡顿仍需复现，见[验证缺口](known-issues.md)。

## LAVA-1 / PERF-2（2026-09-30，已纳入 UI-LAB 合并结果）

codex/lava-connectivity 工作树已完成用户授权的熔岩干地连通、手动墙角规则、地形白字纹理 tint、自动行动/回放毫秒计时及 D4 NPC 查询内通行缓存。出生房间同条件实测 19.28→60 FPS，旧 D4 无路查询约 10.6→3.6 ms；命令/随机数与路径合同保持。两份录像的验证方法、基线重录和旧测试前提反事实分别见 [LAVA-1 报告](reports/lava-1.report.md)、[PERF-2 报告](reports/perf-2-spawn-stutter.report.md)。

LAVA 统一完整套件跑完：4573 项通过，2 项原 900000ms 超时；两份完整文件原门限串行 25 项全过，drift 过，实际完整退出 1 与复核退出 0 分开保留。性能阶段最终中档 build/53 文件987项/drift 全过，源码哈希一致。以上是合并前的阶段性证据；本轮UI-LAB整合结果另以一次完整全绿套件完成验收（见下节），没有用原串行复核替代最终完整门禁。

## UI-LAB 分支整合（2026-09-30，最终门禁通过）

用户已授权将远程 feat/ui-lab-visuals-performance 与本地 LAVA-1/PERF-2 评估整合后推送main。纳入主题/四种地图/保留几何/绘制合并；保留本地物理规则、毫秒节奏和地形tint。NPC采用同范围三态数组并保留两侧回归。差异取舍、诊断夹具精确计数反事实、浏览器/性能证据见 [合并报告](reports/ui-lab-integration.report.md)。最终Pages构建、ce:fetch、完整CE套件258文件/4633项、drift全部退出0；另8项历史skip/5项todo未改。生产/测试/脚本/资源前后散列一致，原两超时普查本轮直接通过。合并结果7877a38，按本次用户授权快进main并由已有Pages工作流部署；没有打新版本标签。

## CAPTIVE-1 俘虏锁链（2026-10-01，已合并 main）

用户试玩发现俘虏没有原版多方向锁链：spawnHordeAt漏掉CE链锚放置步骤，另有6种方向地形被错标为未使用装饰。已补齐八方向链锚，按CE四组斜向→竖向→横向回退；特殊地形俘虏例外、救出后地面锚点留下。选址保持纯函数，原Architect生成所有者落地，未改写入守卫白名单或消耗RNG。

独立工作树 /Users/coolking70/.codex/worktrees/playtest-fixes/BrogueJS，codex/captive-chains，基于main997872f。最终build/ce-fetch/full259文件4646项/drift全部exit0，8历史skip/5todo未改，前后代码散列一致；四种地图真实浏览器与键盘/鼠标救援验收通过。首轮三项失败的反事实及精确前提修订、生成基线/UR3逐叶归因见[修复报告](reports/captive-chains.report.md)。用户随后授权合并推送，修复提交fb79ace已快进main，沿用main推送自动发布Pages的流程；不对旧存档的已生成楼层迁移补链。开发预览5395保留，无需重新实施或启动重复门禁。

## 3. 已定决策（不要重新讨论，除非用户主动提出）

这些都是项目所有者明确做过的裁决，见 `docs/ce-alignment.md` §3 的完整列表与理由：

1. **CE 优先**：CE 源码是规格；任务书或旧测试与 CE 冲突时，以 CE 为准。
2. **不追求同种子逐骰一致**：只要求规则可观察结果与 CE 一致、生成的地图合理（可达、可通关）。
3. **不做旧存档迁移、不兼容 CE `.broguerec` 录像**：开发阶段存档格式可以直接改。
4. **不做无障碍**：游戏设计本身不提供。
5. **键位**：`x` 为 CE 自动探索；检视用长按（触屏）或右键（桌面）。
6. **战斗文字**：默认按 CE（分级动词、不显示数字、回合末合并）；显示设置里保留默认关闭的"显示伤害数值"开关，作为二次开发入口。
7. **验收截图与大体积原始证据不进仓库**：只留报告与小型汇总。
8. **地图/生成大面积变化不是阻碍**：只要单变量归因清楚、重录登记，就可以推进。

## 4. 如何继续开发

1. 读 `docs/development.md`（环境、工作流、门禁、验收规则）与 `docs/architecture.md`（代码地图）。
2. 首次克隆后：`npm ci` 即可开发与跑门禁（`npm test`、`npm run test:drift`）；改动按 CE 对齐的规则或同步新版 CE 时，再 `npm run ce:fetch && npm run test:full` 做 CE 一致性检查。
3. 需求来源优先级：
   - **用户试玩反馈**（最有效：X4a、X4b、X-3、X-4 都源自试玩发现）；
   - `docs/known-issues.md` 中的待办；
   - 需要时再做一轮只读勘察（方法见 `docs/development.md` §6）。
4. 每个改动按"任务书 → 执行 → 验收（CE 核对、反事实、门禁）→ 合并"的流程走，门禁档位见 `docs/development.md` §4。

## 5. 旧开发流程的执行环境（仅供参考，新环境可替换）

之前的开发由一个 Claude 会话担任"验收方"（写任务书、核对 CE、裁决、合并、推送），由 OpenAI Codex CLI 担任"执行方"（改代码、跑门禁、写报告），在两台机器上并行：

- 本机 Mac：`codex exec --worktree --approve-for-me -c model_reasoning_effort="xhigh" -o <last.txt> "<prompt>" < /dev/null`（注意 `< /dev/null`，否则 codex 可能卡在等待标准输入）。
- 一台 Windows 机器：通过一个私有的 SSH 队列脚本派发（未收入本仓库）。

这些只是当时的工具选择。流程本身（任务书、反事实、门禁分档、裁决规则）与工具无关，写在 `docs/development.md`。

## 6. 下一步候选

- 按用户试玩反馈修复（首选）。
- **同步最新官方 Brogue CE**（下一阶段目标）：步骤见 `docs/known-issues.md` §0。
- `docs/known-issues.md` 列出的非阻塞项：一般 AI/寻路/谱影合同逐项复核、自然长局深层录像、存储容量实测、两个稀有蓝图（CE46/CE50）自然零生成的原因确认、前端小问题。
- 可选：一轮全项目只读复核勘察，确认 X-3/X-4 大改没有带进新偏差。

## 7. 文档地图

| 文档 | 用途 |
|---|---|
| `docs/README.md` | 文档索引 |
| `docs/architecture.md` | 代码结构、数据流、命令边界、时间与随机数、存档与录像 |
| `docs/development.md` | 环境、CE 参照源码、工作流、门禁分档、验收与裁决规则、常见坑 |
| `docs/testing.md` | 测试组织、守卫类型、夹具、黄金 trace 与生成基线、重录方法 |
| `docs/ce-alignment.md` | 对齐原则、明确差异、用户决策记录 |
| `docs/i18n.md` | 翻译文件、命名空间、文本守卫 |
| `docs/known-issues.md` | 已知问题与待办 |
| `docs/release.md` | 版本、发布与试玩构建 |
| `docs/archive/dev-history/` | 旧开发文档归档（勘察报告、单元报告、任务书、进度日志），只读参考 |
