# Dialog D2：经典确认的命令续体

日期：2026-10-03。工作区 `BrogueJS-newtheme`，分支 `feat/dialog-d2-continuations`，基点 `189559d2a1c94cf3a279a9ecbb77da24fa493afc`。依据 [D2 任务书](../tasks/dialog-d2-continuations.md) 和已确认的 [设计](../design/in-app-dialogs.md)。未 commit/push；开工时已有的 D2、SFC resolver 两份未跟踪任务书未改动。

## 实现

- Q1–Q10 全部改为命令前半段 generator。命令、继续阶段、答案和局部上下文由引擎 WeakMap 持有；UI 只收到冻结的消息、command ID 和对象身份 token。保留 P0/P1/P2/P3 的执行顺序，从实际提问位置继续，不重跑命令、不抛异常模拟暂停、不回滚世界。
- `executeCommand` 持有整个提交边界。等待时不建临时事件、不增加 index，不收费、不推进时间、不抽取双 RNG；拒绝仍提交原 action/data 和 `[false]` / `[true,false]`。接受后的动画检查点沿用原收尾更新。loaded、playing、单步、seek 均由 `replayRecording` 驱动同一 generator 同步消费 decisions，不发 Host；缺失/多余答案仍 OOS。无 Host 保留同步 resolver，null 默认是。
- 混乱候选方向、俘虏/钥匙、投掷物品/目标、完整 hitList、酸→盟友问题顺序、渊→火→气→板风险链和自动步 next/origin/depth 保留在原调用阶段。回答前只读复核玩家、物品/装备和怪物身份，以及相关位置、关系、知识、钥匙绑定、状态和时钟。意外变化时关闭未收费后缀，提示重新输入；不批准替代对象、不制造否答案或事件，并撤销被外部改世界的完整录像资格。
- 自动步骤仍实际经过 `handlePlayerAction(..., 'system')` 的共享入口。只有处在引擎 generator 驱动栈内的自动调用才返回继续阶段；外部同步 system 调用照旧立即执行，pending 时拒绝。`inAutoTravelStep` / `blockCombatText` 保存在命令上下文，返回 UI 恢复全局值，恢复后仅重建原局部作用域；取消也执行词法清理，绝不执行回合尾声。
- DialogHost 接入经典确认适配器，复用 D1 的危险样式、默认聚焦否、CE Enter/y 是和 Space/Esc/n 否、token/epoch、物理按键/指针生命周期和最高输入仲裁。新局、读档、返回标题、Host 卸载/epoch 重置丢弃旧续体，旧答案不能进新局。对象变化提示是 UI ACK，不写 Logger、不额外 disturbed。
- pending 时阻止正式命令、system 输入及自动步。世界保存给出待回答反馈；引擎拒绝待决存档/导出，录像导出等待完整边界，不借动画的 5 秒超时批准。同步只读诊断导出、旧动画拒绝错误及有效存档续录合同保留。Inventory 的 read/enchant 生产调用归一为 operation 描述，移除 perform 闭包，并让延迟关闭等待确认和推进都结束。
- 新增两个 i18n 键；原十处确认文案和条件未改。`render_game_to_text` 增加只读 pending command ID / 确认文本。唯一新增的 Game 字段 `onCommandConfirmRequest` 已登记 U03 会话契约；续体/token 不进存档、录像、生成基线或 trace。

## 回归覆盖

新增 `dialog_continuations` **57 项**，已登记套件；真实 Vue Host 新增 4 项，App 菜单新增待决保存检查。相关 15 文件覆盖：

| 范围 | 证明 |
|---|---|
| Q1–Q10 | 每点经真实 executeCommand/executeItemCommand，true/false 与同步解析器最终世界、库存/钥匙/装备/充能、HP/营养/位置/时钟、双 RNG 严格相等；每点载入、单步、restart/seek 零 OOS，无 Host |
| 前缀和多问题 | 普通拒绝双 RNG 不变；P1 陈旧抓取清理、P3 投掷退出保留；混乱方向骰否 0 次/是 1 次；酸→盟友 `[true,false]`；鞭/矛/斧完整列表；四段地形风险链各拒绝位置及全部接受 |
| 自动步骤 | 真实 auto_step / auto_explore 进入；路线停止后仅恢复原步骤；自动战斗文本只在恢复作用域阻断，返回 UI、取消及完成后全局配置不残留 |
| 生命周期与输入 | 重复/晚到 token，无 Host 的同步默认与 resolver，通知故障不批准；新局/读档/取消/epoch/卸载失效；俘虏、钥匙、物品、投掷目标、hitList、玩家变化；pending 其它输入无效；真实 Host 的连续 Enter repeat 不回答下一题 |
| 保存与 UI | 等待超过 6 秒仍待决；实际 App 保存处理在世界投影/存储之前反馈；导出等答案后完成；拒绝/接受后存档续录 `[false],[true]` 回放零 OOS；真实 Inventory 食用按钮的两个答案都保留延迟关闭 |

未采样闪光另做 **D1 原码对照**：`git archive HEAD` 的只读副本位于 `/private/tmp/dialog-d2/d1-reference/`，SSR 探针不修改当前源码/测试。D1 同步拒绝与 D2 异步拒绝均恰好消耗 **14 次 cosmetic**，实质流不变，比较的最终 RNG/位置/时钟/营养/库存完全一致；D1 同步返回已有 1 个事件，D2 等待边界 0 个，回答后同一 `eat|a|` 事件、`decisions=[false]`。证据 `p0-probe.mjs/json/log`。Vite 尝试 WebSocket 24678 报 EPERM，但两个 SSR 探针均完成、exit 0；不称为浏览器验收。

## 旧测试接口前提及失败处理

**没有改白名单、容差、黄金 trace、生成基线、规则期望，也没有删用例或加 skip。**

- `ui_1_rendering`、`dpad_hold_input`、`map_touch_input`：按任务书把经典原生框夹具转为可控答案服务，保留原问题文本、两种答案、回放不问、停止持有、晚到释放及实际接线断言；另保留明确标识的 D4 原生闪现测试。原三文件在 D2 生产代码下 **77 项通过**；只回退本轮生产文件到 D1、原测试不动，也 **77 项通过**。证据 `old-premise-new-production.log` / `old-premise-counterfactual.log`，备份 `production-backup/`。原导出钩子因 D4 仍存在，故本例不声称“旧过新失败”，这是任务书要求的显式接口前提转换。DPad 保留原先模块的提前初始化时点，避免 Settings 在简化 document 夹具后才首次加载。
- `w_7_arcana_enchantment`：原静态针脚要求 Inventory 内直接 `readItem(toRaw(item))` / `chooseEnchantTarget(toRaw(item))`，依赖被任务书要求移除的 perform 闭包。新生产实现、原测试失败；**只回退 InventoryOverlay.vue 到 D1**，原测试通过；恢复新组件、原测试再次失败。证据 `w7-counterfactual.log` / `w7-new-original.log`，备份 `w7-inventory-backup.vue`。只将这两个针脚前提换成对应 `executeItemCommand('read'/'enchant', toRaw(item))`，保留“两个生产物品边界都 unwrap”和所有强制选择/其它动作隔离断言。这是调用接口转换，不是放宽强制选择或 raw 对象合同。

首轮完整 `npm test` **6 文件 / 9 项失败，exit 1**，保留 `npm-test-final.log`，没有拿定向拼接冒充全绿。动画存档/导出的旧错误信息、UR4 同步诊断导出、X4a 自动步骤共享入口均修生产代码并保留原测试；UR4 没有重录。共享入口初修又暴露 3 项同步 system 前提回归，增加真实驱动栈上下文后修复。W7 按上述反事实登记接口前提。

第二轮完整命令 **1 文件 / 3 项失败，exit 1**，保留 `npm-test-stairs-regression.log`（248 文件 / 4519 项通过，8 skip / 5 todo）。X3-U5 自动行走到楼梯的嵌套共享入口返回了 generator，原调用漏驱动，导致楼层切换与 D1 入口阻拦消息未执行。生产代码补上对返回阶段的 `yield*`，保留共享入口和全部原断言。原 X3-U5 与 D2 合计 100 项、原 X4a 21 项随后全过，build 和静态扫描重新通过；最终再次完整验收见下表。

## 最终门禁

本地证据均在 `/private/tmp/dialog-d2/`，原始日志、源码副本不入仓库。

| 门禁 | 结果 | 证据 |
|---|---|---|
| vue-tsc -b / build | 最后修正后 exit 0；仅既有大 chunk 提示 | `type-stairs.log` / `build-stairs.log` |
| 相关回归 | 15 文件 / 347 项通过；最后楼梯修正后 **3 文件 / 121 项通过，exit 0** | `related-accepted.log` / `stairs-fix.log` / `shared-entry-stairs.log` |
| 完整 npm test | **249 文件 / 4522 项通过，exit 0**；既有 8 skip / 5 todo 未变；524.45 秒 | `npm-test-accepted.log` |
| 生成套件源码守卫 | 7 文件 / 11 项通过，exit 0；133 项为筛选排除 | `source-guards-final.log` |
| 最终生成套件静态扫描 | **6 文件 / 11 项通过，exit 0**；126 项为筛选排除 | `source-scanners-stairs-final.log` |
| 最终 test:drift | **2 文件 / 2 项通过，exit 0** | `drift-stairs.log` |

常规完整套件包含 UR2/UR3/UR4、U27、x2a/x3b、U03、存档续录和常规全部源码守卫。生成套件额外守卫含 c_4a 读写白名单、免费入口、墓碑、i18n 扫描及 blueprint_center 生产入口钉子；最终扫描补齐 D2 自创旗标扫描。蓝图中心扫描按原种子/门限、单 worker 完成，未修改生成依赖；后续仅输入驱动/导出边界修正，最终 drift 再过。

最终门禁前后 `src/` + `scripts/` **570 文件**的路径/字节有序 SHA-256 相等：`6b0c5d5bdc28992caf00d6649da7c2b035f5b36fcd4e155b34421f0d5e03a933`（`final-stairs-before.json` / `final-stairs-after.json`）。`git diff --check` 通过；17 个本轮变更文件均无 CRLF、无超过 1 MB 的原始证据；`src/test/fixtures` 零变更，生成基线/黄金 trace 未重录。

## 阶段边界

浏览器四视口、沉浸开/关、原生触摸与几何验收按任务书由 Claude 完成；本轮是实际 Vue 客户端组件的宿主渲染/输入回归，不声称真实浏览器/物理设备验收。

**D3 显示事件序列未实现；D4 闪现直连原生确认仍保留。** 不声称原生 confirm 全部清零，也不声称多回合麻痹的地图/HUD/警报呈现问题已经完成。跳渊已知旁支差异、规则条件、RNG 次序、存档/录像格式、ACK 模拟推进均未改。

CE 使用用户给定只读 `.ce-reference/`：legacy `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`，未 fetch 或修改。
