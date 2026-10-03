# 弹窗层 D1：统一显示与输入外壳（DialogService / DialogHost）

> 分支：`feat/dialog-d1-host`（工作区 `BrogueJS-newtheme`，基于 main `358aafa`）。
> 依据：`docs/design/in-app-dialogs.md`（维护者已确认）§6 与 §7.3 表中 D1 行。本步不做确认异步化（D2）、不做显示事件序列（D3）、不动闪现确认（D4）。

## 范围
1. 新增 `src/ui/dialogService.ts`、`src/ui/dialogInput.ts`、`src/components/DialogHost.vue`（命名可按设计微调）：会话级服务、token/epoch、队列按发生顺序、单次解决（idempotent）、卸载/新局/读档失效旧请求。
2. DialogHost 常驻 App，沿用刻符视觉，适配桌面/平板/手机竖横屏与沉浸模式，按钮 ≥44px，长文本滚动；可被自动化稳定读取：`data-dialog-kind/id/owner`，按钮 `data-dialog-action=yes/no/more/view-result`。
3. 统一输入仲裁（设计 §6 输入设计 1–6）：Host 活跃时最高 capture 优先；开层同步 `cancelHeldInputs()`、吞掉触发问题的旧按键 repeat/keyup 与晚到指针；Host 外 pointerup 不生效；双击/合成 click 不重复解决。把现有 `messageAcknowledgment.ts` 的 capture 监听与 `ReferenceOverlay` 的 capture 纳入同一仲裁，避免注册顺序决定谁吃键；Host 不活跃时不抢任何键。
4. 接入现有内容，**行为语义不变**：
   - "--更多--"（ACK）改由 DialogHost 呈现（替换 `MessageAcknowledgment.vue` 的独立层，或让其成为 Host 的一种类型）；按 CE `IO.c:2914-2927` 改为只接受**新的**空格/Esc/在 Host 内按下并释放的指针，其它键只提示继续方式（设计 §1、§7.1 关于 `x3_u6_messages` 前提的说明：如该测试因 CE 键位而失败，按 AGENTS.md 做单变量反事实后仅把前提键从 ArrowRight 改为 Space，并新增 ArrowRight 不通过的用例）。
   - 上一步刚加入的"查看结算"按钮迁移到 Host（`view-result`），行为保持：游戏结束后可随时直达结算、未读保留、返回标题清队列。
   - 已知恶意药水/卷轴的使用确认（`pendingUseConfirm`，设计 §2.3）改用 Host 外观，**保留**现有 `item:command` 的 confirm/cancel 分段与录像语义。
5. 原生 `window.confirm`（App.vue `wireConfirmRequest`）本步**保留**，仅确保它与 Host 不冲突；在报告中明确"原生确认框仍存在，D2 才移除"。
6. 新增可见文本全部走 i18n。

## 不做
- 不改 `requestConfirm` 调用点、不改 Logger 的 ACK 产生条件与日志内容、不改模拟/RNG/录像/存档。
- 不实现显示事件序列（麻痹多回合按顺序播放属 D3）。

## 门禁（docs/development.md §4）
轻档：`vue-tsc -b`、`build`、相关组件与输入测试、全部读源码守卫（含 `test_suite_membership`）；因涉及输入仲裁与 Logger 呈现接口，**升中档**：再加 UR2/UR3/UR4 黄金 trace、u_27/x2a/x3b 录像测试、U03、`test:drift`。新测试登记 `scripts/test-suites.json`。
回归要点见设计 §7.1 "Dialog 组件/服务"与"输入"两行。

## 约束
撞上已有测试改代码不改测试；确需改测试按 AGENTS.md 逐条登记（单变量反事实）。不产生 CRLF。**不要 commit/push**。浏览器截图验收由 Claude 完成。

## 输出
报告 `docs/reports/dialog-d1-host.report.md`；中文简报。
