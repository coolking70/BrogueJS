# BrogueJS — Brogue CE 中文网页版

> `product/shooter-prototype` 分支包含 Shooter S1 连续移动训练场。运行开发服务器后打开 `/shooter.html`；WASD、手柄左摇杆或触屏摇杆移动。实现范围、验收与后续边界见 [S1 开发说明](docs/shooter/S1.md)。下方公开试玩仍是既有 Brogue 产品。

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
