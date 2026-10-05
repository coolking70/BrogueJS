# 4f 任务书（第一部分）：配置手册、收尾补漏与独立性准备

> 分支 `ext/phase4`（= ext/foundation `97988d5`：4a–4e 全部完成）。设计：`docs/ext/phase4-giants.md` r3 §14.2 表 4f 行与 §14.1（收尾统一门禁定义）。dot 的 3g（底座协议 4→5）尚未合入；**完整 npm test / 全部 test:ext / 16 组合 / 物理删除矩阵 / 浏览器全面验收在 3g 合入后由维护者通知统一执行，本部分不跑**。

## 本部分范围

1. **作者配置手册** `docs/ext/giants-config.md`（中文）：底座空间能力（形状 mask/pose/zone、复合体群/成员/约束/修正、转换声明、生成贡献与场地模板、预算上限）与 giants 模块数据（敌人、场地、部位、复合体、主动转换）的全部字段、合法范围、默认值、校验规则；“新增一个大型敌人 / 一个复合体 / 一个转换招式”的完整示例（示例须经真实 schema 校验，可用仓库外验证器或测试夹具，注明来源）；版本与旧档政策；与 combat/growth/narrative 的软接口（part-break、phased profile、XP 报价等）现状。
2. **小问题修正**：沉渊巨像分裂后，消息称“岩脊碎像”而侧栏/实体名显示“岩脊兽”。请统一（建议分裂产物使用独立的显示名/形态，如“岩脊碎像”，或消息改用产物实际名；以数据驱动方式解决，不硬编码）。
3. **完整性审计**：对照设计 r3 §1–§14 与各步报告（4a0–4e），列出设计目标逐项是否已实现、证据与已知限制；确认未开放能力（镜像、再生、4×4 正式内容、残骸地形等）在数据/创建/读档处明确拒绝。发现遗漏的功能缺口要补齐（不是只写进限制）。
4. **独立性准备**：确认 giants 目录物理删除后底座多格/复合体/转换 fixture 测试仍完整可运行（列出归属底座的测试文件清单），`scripts/check-module-removal.mjs` 与 composition smoke 的发现器会自动包含 giants 与 combat；只做 `--plan`/`--prepare-only` 级检查，不运行完整删除矩阵。
5. 更新 `docs/ext/README.md` 阶段 4 状态与审阅入口。

不升底座版本（5 归 3g）。

## 门禁（开发期功能测试政策）
- boundary、`npx vue-tsc -b`、`npm run build`；本部分改动直接相关的测试与 giants 专项；`npm run test:drift`（若改动内容数据导致 trace 变化，先单变量归因再按原入口重录）。
- Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。不必启动浏览器。

## 交付
- 文档、修正、测试与 `docs/ext/phase4f.report.md`（本部分，逐项清单与证据；为“统一收尾门禁”预留章节）。**不要 commit**。
