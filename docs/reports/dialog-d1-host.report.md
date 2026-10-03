# Dialog D1：统一显示与输入外壳

日期：2026-10-03。工作区 `BrogueJS-newtheme`，分支 `feat/dialog-d1-host`，基点 `358aafa655ebb0fac15a20fa9aeabe1031023c46`。依据 [D1 任务书](../tasks/dialog-d1-host.md) 和已确认的 [设计](../design/in-app-dialogs.md)。未 commit/push；开工时已有的两份未跟踪任务书未改动。

## 实现

- 新增会话级 `DialogService`、`DialogInput`、常驻并 Teleport 到 body 的 `DialogHost`。支持确认与 ACK，FIFO 保留重复发生次数；token 按对象身份、当前请求、epoch 校验，重复回答与晚到回答无效。取消/卸载只解除 UI 请求，不制造引擎否决答案。
- App 提供会话服务，新局、读档、录像导入/载入/重启/seek、返回标题和卸载使旧请求失效；Logger 适配器另检测 player 身份变化。返回标题清该局 ACK/未读队列。
- 同一 capture 仲裁入口在 InputManager 文本输入判断之前处理 Host，再处理 Reference，随后保留原 ModalKeyboard 优先级。Host 关闭时普通键交回原管线；已消费/触发问题的物理键仍等到释放。DPad/触屏持有和地图鼠标拖动同步取消，旧指针释放、Host 外释放、滚动、合成 click、重复解决不能回答下一题。`triggerAction`、地图点选与自动步计时读取统一 busy，Dialog 自身不受动画锁限制。
- 按本地 CE 执行路径 `IO.c:2914-2927`、`2951-2973`：确认 `y/Y/Enter` 为是，`n/N/Space/Esc` 为否；MORE 只接受新的 Space/Esc 或 Host 内重新按下并释放的指针。其它键显示 i18n 提示，不写 Logger。危险确认默认聚焦否，但 Enter 仍按 CE 回答是；Tab 在 Host 按钮内导航，队列清空恢复仍存在的来源焦点。
- MORE 与“查看结算”迁入 Host，默认仍按原 ACK 顺序；终局可直达结算，未读按发生顺序保留，晚到终局消息不再变为模态。`data-dialog-kind/id/owner` 及 `data-dialog-action=yes/no/more/view-result` 稳定可读。
- 恶意药水/卷轴沿用原提示及 `item:command` 的 `confirm||` / `cancel||` 分段，沿用原消费和背包延迟关闭逻辑。未新增 decisions，未改事件格式。
- 沿用刻符根节点颜色/字体变量、safe-area/dvh，按钮至少 44px，长文本独立滚动；沉浸开关不改变 Host 入口。新增可见标题/提示均走 i18n。

Logger 只增加可选呈现通知和只读发生队列入口；通知故障不能进入规则命令异常路径。ACK 产生条件、归档内容/折叠/count 上限、模拟推进、双 RNG、存档/录像协议、Game 字段均未改动。未重录生成基线或黄金 trace，未改守卫白名单。

## 旧测试前提修订

先保留原测试，运行新生产实现：6 个旧文件失败（5 个组件测试依赖/入口夹具失败，X3-U6 的 ArrowRight MORE 前提失败）。仅回退本轮已跟踪生产文件到 HEAD，保持原测试及其断言：**6 文件 / 123 项通过，exit 0**；随后恢复生产文件。证据 `/private/tmp/dialog-d1-initial.log`、`/private/tmp/dialog-d1-counterfactual.log`，备份 `/private/tmp/dialog-d1-production-backup/`。以下只修接口/前提，无删除用例、skip、容差或断言语义放宽：

| 文件 | 必要前提调整 |
|---|---|
| `dpad_hold_input` | App 新增服务/仲裁/Logger 导入加入手写模块映射，保留原持有与原生 confirm 接线断言 |
| `immersive_polish` | 新导入映射及子组件 stub 从 MessageAcknowledgment 改为 DialogHost |
| `ui_4_glyph_feedback` | 同上，保留原 UI 反馈断言 |
| `x3_u5_ui` | Inventory 新增服务导入加入手写模块映射 |
| `ux_1a_end_ui` | 挂载真实 DialogHost；补 Teleport、原生 DOM 节点/焦点及 pointer capture 的宿主夹具；点击改用新按下/释放，循环重挂载前释放物理键。保留默认警报顺序、直达结算、未读/归档/RNG、保存导出返回的原断言 |
| `x3_u6_messages` | 原单次消费/repeat/keyup/不泄漏用例的前提键 ArrowRight 改为 Space；新增 D1 用例证明 ArrowRight 不通过 MORE |

以上包含设计明确允许的 SFC 接口变更，不将组件替换说成单纯轮询时点修正。公共 SFC 解析器任务仍待执行，本轮未扩展到该任务。新增 `dialog_service_input` 和 `dialog_host` 共 38 项，已登记 `scripts/test-suites.json`。

## 验证

相关组件/输入回归：11 文件 / **224 项通过，exit 0**。覆盖会话隔离、只读请求数据、token/epoch/卸载、FIFO/重复102次/count封顶100、CE 各键、触发方向键继续按住与释放、文本输入目标、Reference 交叉、滚动/外部释放/lost capture/合成 click/重复点击/非主键释放、中文长文、默认焦点/Enter 例外、终局直达及恶意品两分支。真实恶意品取消只增加原 recorder 事件/index，物品、世界、时间、双 RNG 不变；批准消费一次并保留背包延迟关闭。另验证实际 triggerAction 阻挡代理/触屏命令、原生确认暂时接管输入，以及 blur 不被误当成物理 keyup。

| 门禁 | 结果 | 本地证据 |
|---|---|---|
| `npx vue-tsc -b`、`npm run build` | exit 0；构建仅保留既有大 chunk 提示 | `/private/tmp/dialog-d1-build-final.log` |
| 相关组件/输入回归 | 11 文件 / 224 项，exit 0 | `/private/tmp/dialog-d1-related-final.log` |
| 最终 `npm test` | **248 文件 / 4460 项通过，8 历史 skip / 5 todo，exit 0** | `/private/tmp/dialog-d1-npm-test-final.log` |
| 生成套件内的源码守卫 | 7 文件 / 12 项，exit 0；132 项为命令筛选排除。蓝图中心扫描使用原种子、原门限、单 worker，无修改其生产依赖 | `/private/tmp/dialog-d1-source-guards-final.log` |
| 最终静态扫描复核 | 6 文件 / 11 项，exit 0；126 项为命令筛选排除 | `/private/tmp/dialog-d1-source-scanners-final.log` |
| 最终 `npm run test:drift` | **2 文件 / 2 项通过，exit 0** | `/private/tmp/dialog-d1-drift-final.log` |

完整常规套件覆盖中档所需的 UR2/UR3/UR4、u_27/x2a/x3b 录像、U03，以及常规套件内全部源码守卫（i18n、硬编码文本、repo hygiene、test_suite_membership 等）。生成套件单独补跑的守卫包含 c_4a 地形读者/写入白名单、b_1a 免费入口、v_1a/v_2b 墓碑、p1_37 文本扫描和 blueprint_center 生产入口钉子；最终 blur 修正后再复核全部静态扫描，蓝图中心的 Game/生成依赖未变。

最终门禁前 `src/` + `scripts/` 的路径/文件字节有序 SHA-256：`8601c36eaa905ff6a053ab9e5157a78dcefde1e0f74a391a1b284d1763216adf`。门禁后复核一致。`git diff --check` 通过，改动文本无 CRLF。测试原始输出与备份均在 `/private/tmp/`，未收入仓库。

## 阶段边界

**原生确认框仍存在，D2 才移除经典 requestConfirm 的原生接线；闪现另属 D4。** `wireConfirmRequest` 保留同步 window.confirm，增加同一仲裁的持有隔离；本步不能将同一同步命令中的原生提问改为等待 Host 的续体。

未实现 D2 确认续体或 D3 显示事件序列。麻痹强制回合仍按现有模拟完成，不能声称已解决多回合警报与地图/HUD 提前显示最终状态的问题。

浏览器桌面/平板/手机竖横屏、沉浸开/关截图验收按任务书由 Claude 完成。本轮是实际 Vue 客户端组件的宿主渲染/输入测试，不声称真实浏览器几何、原生触摸或设备验收。截图和大体积原始日志均未收入仓库。

CE 使用用户给定只读 `.ce-reference/`，`SOURCE.json`：legacy `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`；未 fetch 或修改 CE。
