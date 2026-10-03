# 测试基础设施：统一 SFC 测试的模块依赖解析（待执行）

> 状态：**执行中**（分支 `chore/test-sfc-resolver`，基于 main `d8d0756`）。用户已同意。扩展分支 ext/foundation 为独立原型、不合并进 main，本任务**只迁移 main 上的测试**，不考虑扩展分支。

## 背景
多个测试文件（至少 `immersive_polish`、`ui_4_glyph_feedback`、`x3_u5_ui`、`dpad_hold_input`，以及扩展分支上的 `ext_growth_ui`、`main_menu_replay_seek` 等）各自手写一份"模块白名单 / 依赖映射表"，用来在测试里编译真实的 Vue SFC。每当生产组件新增一个 import，这些表就要逐个手工补映射；UI-4、方向键修复、1c、1e 已多次因此修改旧测试，每次都要单独批准并做单变量反事实。

## 目标
- 提供一个公共的测试工具（例如 `src/test/support/sfcHarness.ts`）：按真实导入关系自动解析并加载依赖模块，测试只需声明需要替身（stub）或注入的少数模块（如 `activeGame`、`inputManager`、重型子组件）。
- 迁移所有现有的手写映射表测试到该工具；迁移后新增组件依赖时无需修改这些测试。
- 不改变任何断言、容差、超时、skip；每个迁移文件迁移前后用例数与通过情况一致，在报告中逐文件列出。
- 迁移范围：main 上全部手写模块映射/白名单式 SFC 测试（含弹窗层 D1–D4 期间新增或修改的：dialog_host、ux_1a_end_ui、immersive_polish、ui_4_glyph_feedback、x3_u5_ui、dpad_hold_input、map_touch_input、ui_1_rendering、gameplay_layout、main_menu_replay_seek 等；以实际 grep 为准）。

## 约束
- 撞上已有测试改代码不改测试；本任务本身是改测试基础设施：每个迁移文件迁移前后用例名、数量与通过情况一致，断言/容差/超时/skip 不变，在报告逐文件列出。
- 不产生 CRLF；**不要 commit/push**。

## 门禁
纯测试基础设施：`vue-tsc -b`、`build`、全部被迁移的测试文件、全部读源码守卫、`test_suite_membership`；最后跑一次 `npm test` 确认无连带影响。

## 输出
报告 `docs/reports/chore-test-sfc-resolver.report.md`（迁移清单、每文件前后用例数、公共工具用法说明）；中文简报。
