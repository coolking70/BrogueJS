# 5B 集成任务书（本地）

> 分支 `ext/phase5`，HEAD `95d0d03`（5A3 含审查修复 + dot 的 5B crafting `e770565` 已合入；foundation 9）。dot 交付报告：`docs/ext/phase5b.report.md`；配置手册 `docs/ext/crafting-config.md`。门禁按开发期政策，但本步需本地完整跑一次全部 `npm run test:ext` 用于归因。**不要 commit。**

## 1 适配与核对
- crafting 在 foundation 7 上开发，现基线为 9（5A2-S 属性管线、5A3 结构/cellProperties）。核对 crafting 在当前基线的全部自有测试、自然 trace（报告中的 seed2 264 条命令闭环）与组合 smoke（含 crafting 的全部子集）通过；必要的适配只改 crafting 目录或底座，适配理由写入报告。
- 5B 工位工作位置/交互线在 5A3 后逐格不变的回归（5A3 任务书要求）对真实 crafting 定义再跑一次。

## 2 SDK 缺口（dot 报告 §6 SDK-01..05）
逐条复现并在底座修复（worldSdk.ts 如需变更，按 SDK 1 内的兼容扩展处理并重新登记 SHA；不得破坏已交付 crafting）：
- SDK-01 模块栏命令 ID 格式；
- SDK-02 精确拒绝原因的只读 UI 出口；
- SDK-03 固定投影不含箱清单：扩充投影 DTO（容器来源预览）并定调用预算，crafting 侧随之接上“有箱可选”；
- SDK-04 combat 活跃 bundle 的输入前置门禁；
- SDK-05 非安全整数 payload 在 SDK 前分派错误。
每条补回归；crafting 侧对应的“缺口占位”改为真实实现。

## 3 test:ext 失败归因
dot 报告 test:ext 3819 通过 / 30 失败（15 超时、9 外部证据路径、4 旧图快照、2 world5 旧前提），drift 1 项超时。本地完整跑一次 `npm run test:ext`（--maxWorkers=2）与 `npm run test:drift`，逐项归因：环境慢导致的超时给出本地耗时证据；真实缺陷修复；过时前提按单变量反事实证明后最小调整，不放宽有效断言、不加 skip、不拉长超时掩盖问题。

## 4 界面
- 390/320 宽打开合成面板时地图被压成约 80px 的一条：调整面板在窄屏的布局（例如底部抽屉限高/可收起、或面板打开时地图区保留合理最小高度），桌面不回归。

## 5 交付
`docs/ext/phase5b-integration.report.md`：适配清单、SDK-01..05 处理、test:ext/drift 全量结果与逐项归因、界面改动、门禁命令与结果。
