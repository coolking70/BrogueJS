# BrogueJS — Brogue CE 中文网页版

[Brogue: Community Edition](https://github.com/tmewett/BrogueCE) 的 TypeScript + Vue 3 网页移植，完整中文界面，支持桌面与手机触屏。

**[在线试玩](https://coolking70.github.io/BrogueJS/)**

规则、交互与内容按 CE C 源码逐项对齐：地牢生成、怪物 AI、战斗、物品与魔法、机关、深层与终局、存档与录像、自动探索与消息系统等，由约 240 个测试文件、4500 项断言守护。当前版本见 [RELEASE_NOTES.md](RELEASE_NOTES.md)。

## 快速开始

需要 Node.js 20+。

```bash
npm ci
npm run dev            # 本地开发服务器
npm run build          # 生产构建，产物在 dist/
```

## 测试

```bash
npm test               # 常规测试（不含重型生成普查/基线）；缺 CE 时对照用例显式跳过
npm run test:drift     # 浅层/深层地图生成回归基线
# 局部规则档/全量档的 CE 一致性检查
npm run ce:fetch       # 拉取 CE 参照源码到 .ce-reference/（git 忽略）
npm run test:full      # 常规组，强制要求 CE（不含普查/基线）
BROGUE_REQUIRE_CE=1 npm run test:gen  # 全量档另跑重型生成普查，强制要求 CE
```

`npm run ce:fetch` 默认拉取测试所依据的固定版本；加 `-- --source upstream` 可拉取官方最新 Brogue CE。普查单独可用 `npm run test:gen`；各类改动的门禁档位见 [docs/development.md §4](docs/development.md#4-门禁分档)。

## 操作

- 移动：方向键 / vi 键（hjklyubn）/ 小键盘；Shift+方向奔跑
- `x` 自动探索，`>` / `<` 前往楼梯，`s` 搜索，`z` 休息，`Z` 长休息，`i` 背包，`t` 投掷，`?` 帮助
- 鼠标：单击前往，右键查看
- 触屏：点击前往，长按查看，底部命令栏与虚拟方向键

## 文档

- [docs/HANDOFF.md](docs/HANDOFF.md)：项目状态、已定决策、如何继续（接手先读）
- [docs/README.md](docs/README.md)：全部文档索引（架构、开发流程、测试、CE 对齐、i18n、已知问题、发布）
- [AGENTS.md](AGENTS.md)：AI 协作者须知
- `docs/archive/`：历次开发记录（勘察报告、单元报告、任务书）

## 与 CE 的明确差异

- 不追求同种子逐骰一致（规则一致、地图可达可通关）
- 录像为网页命令日志 JSON，不兼容 CE `.broguerec`；开发阶段不做旧存档迁移
- 战斗文字按 CE 句式；显示设置中可开启"显示伤害数值"

## 许可

本项目衍生自 Brogue CE，按 **GNU Affero General Public License v3.0** 发布，见 [LICENSE](LICENSE)。Brogue 原作者 Brian Walker，Brogue CE 由社区维护。

## 当前扩展开发记录（2026-10-07）

5C1 未提交候选已实现默认关闭的生产营地模块、真实材料/储粮事务、施工存取休息撤营与UI相机接线，详见[执行报告](docs/ext/phase5c1.report.md)及[配置说明](docs/ext/settlement-config.md)。限定最终门禁：营地11文件118项、底座42文件963项（1项既有CE跳过）、drift5文件8项通过，boundary/types/build通过。后批仅修改三个自有测试夹具，另以不同输入hash重复通过营地专项和boundary/types/build；两批hash/命令/耗时分别列于报告。

指挥真实390原版普通浏览器布局/选格/面板开合部分通过，但抽屉打开时DPad输入被拦截、移动跟随未通过；自然双粮闭环、完整24行矩阵及实机/FPS尚未验收。当前停止实现，等待另起独立审查；完整npm test、全部test:ext、全组合/删除矩阵留5Z。未commit/push。


2026-10-08 更新：独立审查确认F1–F6并阻断，原结论保留；原执行会话按修复任务修完F1–F5，补正常开局seed28真实拾粮→天然D1营地闭环、D5明确首访准备的天然资格证据。最新源码/测试输入SHA `1b7565be78c172c9203061eded7698dcc928ed7b5046d3babfc828e6712b7681` 前后相同；boundary/types/build、营地13文件133pass、限定相关21文件569pass、drift5文件8pass均exit0，九个5G文件保持基线字节。固定新构建/公开自然路线/抽屉真实输入探针/矩阵副本已交指挥，尚未运行本轮浏览器；24矩阵/自然UI闭环/施工流畅度/实机仍待验，F6不能关闭。修复和准确批次见[报告§8](docs/ext/phase5c1.report.md#8-f1f6-审查修复交付2026-10-08)。原首次交付记录仅作历史，不代表最新验收。未commit/push，交付后停止，等指挥复核和必要独立定向复审。


2026-10-08 R1更新：F1–F5已独立关闭，最终fixed3的24场景与自然双粮闭环已有指挥成功证据。复审新增R1共享测试硬依赖已仅通过测试归属拆分修复：两模块实际输入用例各归自有目录，共享Canvas用classic底座。限定6文件57pass、boundary/types/build通过；外部真实删settlement后10pass、删crafting后11pass、删全部生产目录后共享3pass，归属发现通过，无skip。生产及入口513文件和Vite实际1153依赖字节不变，新53构建文件全部匹配fixed3，已有GUI证据可复用；原79目录的26个旧残留chunk单列，不混称整目录hash一致。详见[报告§9](docs/ext/phase5c1.report.md#9-r1p2-测试归属修复交付2026-10-08)。原审查结论不改，R1交指挥复核、F6残余由指挥收口；未commit/push，验证完成后停止。


2026-10-08 R2更新：独立审查确认原生背包关闭后营地computed长期disabled，原执行者只补commands的host.tick依赖；营地自有真实X/Esc/Confirm/ACK客户端回归先4红后4绿，最终8文件90pass、boundary/types/build全exit0，输入`72d1afadec5582146dbf5203f3bf3bc15710d3bc54c54e2c18c8afd1cb76ca64`前后相同。Game/InventoryOverlay/catalog和共享冻结9文件未变，R1测试归属保留。新固定build已交指挥，**旧24矩阵不能充当R2触发验收**，待新24矩阵及背包关闭→重开→六设施持续流程/另进程复审。见[报告§10](docs/ext/phase5c1.report.md#10-r2p2-原生背包关闭后入口恢复修复2026-10-08)。原审查结论不改，未commit/push，交付后停止。


2026-10-08维护者最终收口：5C1按本步范围验收通过，最终输入72d1afadec5582146dbf5203f3bf3bc15710d3bc54c54e2c18c8afd1cb76ca64；独立F1–F5/R1/R2关闭，final4新24矩阵及原生背包重开→六设施/12秒持续交互通过。长内容/满槽显示夹具通过；高级浏览器、真实手机和全量收尾留5Z。详见[维护者验收](docs/ext/phase5c1.acceptance.md)。5G原0fb2720仍隔离，未最终验收。
