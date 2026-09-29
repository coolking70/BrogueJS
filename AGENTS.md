# AGENTS.md — AI 协作者须知

本仓库是 Brogue CE 的 TypeScript + Vue 3 网页移植（中文界面）。开始任何工作前先读：

1. `docs/HANDOFF.md`：项目状态、已定决策、下一步
2. `docs/development.md`：环境、工作流、门禁分档、验收裁决规则
3. `docs/architecture.md`：代码地图与高风险区

## 必须遵守

- **CE 源码是规格**：规则、交互、内容以 CE 执行路径为准（`npm run ce:fetch` 拉取到 `.ce-reference/`）。任务书或旧测试与 CE 冲突时以 CE 为准并说明。
- **撞上守卫改代码，不改守卫**。旧测试只依赖被修掉的旧行为时，先做单变量反事实（只回退本次生产文件，旧测试应通过），再只修前提、不改断言语义，并在报告中列出。
- **所有改状态的输入经 `game.executeCommand` / `executeItemCommand`**；纯显示代码不得消耗实质随机流；给 `Game` 加字段要登记 `scripts/u03-state-contract.json`。
- **生成基线 / 黄金 trace 变化**：先单变量归因，再用原捕获方法重录并逐字段登记（`docs/testing.md` §3）。
- 所有玩家可见文本走 i18n（`docs/i18n.md`）。
- 日常验收门禁用 `npm test` + `npm run test:drift`（不需要 CE 源码）。改动按 CE 对齐的规则代码、或同步新版 CE 时，另跑 CE 一致性检查 `npm run ce:fetch && npm run test:full`（见 `docs/development.md` §4）。
- 不追求同种子逐骰一致；不做旧存档迁移；不做无障碍（项目决策，见 `docs/ce-alignment.md` §3）。
- 截图与 >1 MB 的原始证据不提交；不产生 CRLF；推送与测试分开执行，先确认测试结果。
