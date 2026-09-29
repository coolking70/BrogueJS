# BrogueJS — Brogue CE 中文网页版

[Brogue: Community Edition](https://github.com/tmewett/BrogueCE) 的 TypeScript / Vue 3 网页移植，带完整中文界面，支持桌面与手机触屏。

规则层、交互层与内容按 CE C 源码逐项对齐：地牢生成、怪物 AI、战斗、物品与魔法、机关、深层与终局、存档与录像、自动探索与消息系统等，并由约 240 个测试文件、4500 项断言守护。当前版本见 [brogue-web/RELEASE_NOTES.md](brogue-web/RELEASE_NOTES.md)。

## 目录

| 路径 | 内容 |
|---|---|
| `brogue-web/` | 网页版源码（`src/`）、测试（`src/test/`）、开发脚本（`scripts/`）与开发文档（`ai_docs/`：勘察报告、各单元报告、任务书） |
| `BrogueCE-master/src/` | 作为对照基准的 Brogue CE C 源码（含本项目早期中文化改动）；不少测试直接读取它做 CE 对照，请保持与 `brogue-web/` 同级 |

## 运行

需要 Node.js 20+。

```bash
cd brogue-web
npm ci
npm run dev          # 本地开发服务器
npm run build        # 生产构建，产物在 dist/
npm test             # 全量测试（约 30 分钟）
npm run test:drift   # 地图生成回归基线
```

## 操作

- 移动：方向键 / vi 键（hjklyubn）/ 小键盘；Shift+方向奔跑
- `x` 自动探索，`>` / `<` 前往楼梯，`s` 搜索，`z` 休息，`Z` 长休息，`i` 背包，`t` 投掷
- 鼠标：单击前往，右键查看；触屏：点击前往，长按查看，底部命令栏与虚拟方向键
- `?` 查看完整帮助

## 与 CE 的明确差异

- 不追求同种子逐骰一致（规则一致、地图可达可通关）
- 录像为网页命令日志 JSON，不兼容 CE `.broguerec`；开发阶段不做旧存档迁移
- 战斗文字按 CE 句式；显示设置中可开启"显示伤害数值"

## 许可

本项目衍生自 Brogue CE，按 **GNU Affero General Public License v3.0** 发布，见 [LICENSE](LICENSE)。Brogue 原作者 Brian Walker，Brogue CE 由社区维护。
