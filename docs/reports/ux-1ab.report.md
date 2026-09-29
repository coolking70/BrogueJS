# UX-1A / UX-1B：结算可达性与背包键盘

2026-09-29；工作树 `playtest-fixes/BrogueJS`。本单元不修改游戏调度、CE 规则、RNG、存档或录像格式，不提交或推送。

## 复现与判断

在真实 Chromium DOM 中挂载实际 Vue 组件和实际 InputManager；用受控 Game UI port 避免在后台基线重测时重复整局生成。`scripts/ux-1-ui-check.mjs --baseline` 在生产修复前的结果：

```json
{"inventoryCommands":[["inventory_action","drop"]],"endAndAckOverlap":true,"ackTouchAction":"none"}
```

- Input 的全局监听先注册，背包后挂载。按 `d` 没有选中行，直接切到全局 drop 模式，确认了输入优先级缺陷。
- 结束标志与待确认消息同时存在时，结算和确认遮罩同时挂载。确认层使用 `touch-action:none`，长文本及其尾部确认按钮不能依靠触屏滚动可靠访问。修复后实际 touch drag 改变消息段 `scrollTop`，并且 MORE 在屏幕内。
- 这些证据证明 UI 缺陷；**没有把它们宣称为用户麻痹近战死亡后卡住的唯一根因**。本单元没有真实手机、用户种子或录像；真实引擎麻痹/近战死亡及性能验收仍由主线程统一完成。

## 修改

- `Input.ts` / `ui/modalKeyboard.ts`：全局键位映射前先询问明确优先级的浮层处理器。当前优先级为终局 100、详情 50、背包 0；注册顺序不决定优先级，卸载清理处理器。文本编辑保留 DOM 原行为，浮层可保留 Tab、滚动、按钮 Enter/Space 默认操作，同时阻止游戏命令穿透。
- `InventoryOverlay.vue`：列表字母与点击共用 `selectItemOrIdentify`；强制鉴定/附魔、丢弃、装备、卸装、命名、重标字母及戒指替换继续复用原处理器。无效字母不进入全局映射。详情动作只作用于选中物品，所有实质动作仍经 `executeItemCommand`。长按自动重复不能从首次选择继续触发丢弃。Escape 依次返回子状态/关闭；强制目标仍保持原不可取消语义。命名框自动获得焦点，文字不会变成游戏命令。
- 同时修复装备模式的戒指替换列表：原 equip 过滤会把已装备戒指隐藏，导致不能选替换目标；进入替换子状态后明确列出已装备戒指。
- `DetailPanel.vue`：改为上述明确优先级入口；背包内 `x` 关闭旧详情后交给背包选择，不再主动发自动探索；Escape 只关闭详情，不继续传到背包。普通地图详情的 `x` 继续保持原探索行为。
- `MessageAcknowledgment.vue`：正文单独滚动、允许纵向触摸、MORE 与提示保留在面板可见范围。没有清空或合并待确认队列，没有修改确认的世界/录像语义。
- `GameEndOverlay.vue`：待确认队列清空后才显示结束页，保留消息顺序；终局不接收地图键位。新增保存当前录像、导出当前 JSON 入口和结果反馈。返回标题只 emit，不修改引擎终局标志。

## 集成 API

GameEndOverlay props：

| prop | 默认值 | 语义 |
| --- | --- | --- |
| `canSaveReplay` | false | 父层确认当前内存录像来源有效，可以申请保存/导出 |
| `replayBusy` | false | 正在等最终 checkpoint 或保存；保存、导出、返回均禁用，避免卸载 Canvas 中断推进 |
| `replayFeedback` | 空串 | 父层本地化的等待/成功/失败说明，在结果页直接可见 |

事件：`save-replay`、`export-replay-json`、原有 `return-to-title`，均无 payload。

使用 `menu.replay.save`、`menu.replay.export_current`（主线程新增）和现有 `endgame.return`；本单元未写翻译文件。

## 定向验证

- `npx vitest run src/test/ux_1a_end_ui.test.ts src/test/ux_1b_input.test.ts src/test/p1_46_keybindings.test.ts --maxWorkers=1 --no-file-parallelism`：3 文件、14 用例全过。终局测试使用实际 SFC 客户端 script/template 和 Vue lifecycle；输入测试使用 EventTarget 事件与生产 InputManager，不以源码字符串代替行为断言。
- `node scripts/ux-1-ui-check.mjs`：真实 Chromium 页面 390×844、844×390 全过，无 pageerror。包含 d/a/e/i/h/j/k/l/x 字母、详情 d、按住 d、两级 Escape、背包外 d、丢弃目标、鉴定合法性、强制附魔、双戒指替换、输入名称提交、旧详情 x/ESC、消息捕获优先、长消息触摸拖动、连续两条 MORE、长背包结算、触摸保存/导出/返回、录像不可用及保存等待的禁用状态。
- 浏览器脚本只用现有 `vite` / `playwright` 依赖；启动临时随机端口并在 finally 关闭服务和浏览器，不纳入默认 Node 单测（新克隆未必安装浏览器二进制）。
- 没有改旧断言、放宽超时、重录黄金 trace 或生成基线。没有运行重门禁。
- 类型检查首次发现主线程在改的 Game.ts 使用目标 lib 不支持的 `.at()`，已通知主线程；本单元测试翻译 mock 的类型错误已修。最终统一 build、i18n/源码守卫、录像和全量门禁由主线程负责。

## 仍需最终集成验收

完整应用中启用动画的普通死亡、麻痹近战致死、麻痹中毒致死、麻痹气体持续施加；确认最终 checkpoint 后保存、导出、返回、新局均可操作，消息队列不残留。同步与让帧引擎路径的世界/RNG/录像一致性不在本单元受控 UI port 的证明范围。

## 集成审查补充

主线程指出读档保留 inventoryAction / item id、却替换 Player 和 Item 对象的情况。已在 player 身份变化时清除选中物品、命名目标/文字及延迟关闭；延迟关闭执行前也先检查身份，避免轮询先 flush 再 update 时错误关闭新局背包。真实 DOM harness 已覆盖保留 id 替换对象，禁止旧 Item 引用进入 executeItemCommand，并验证动画中待关闭后读档不会向新背包补发 escape。补充用例通过。

## X3-U5 旧组件夹具的单变量反事实

首轮完整门禁发现 `x3_u5_ui.test.ts` 的手动 SFC 客户端编译器没有登记 InventoryOverlay 新增的 `../engine/Input` 依赖，suite 在 beforeAll 中失败，七项断言均未运行。按仓库守卫规则，先保留原测试不动，仅替换一个生产文件验证：

1. 备份当前 `InventoryOverlay.vue` 至 `/tmp/ux-1ab-inventory-before-x3u5.vue`，临时换成 `4277e73` 的同文件，其余生产文件和原测试不动：7/7 通过，日志 `/tmp/ux-1ab-x3u5-counterfactual-baseline.log`。
2. 恢复当前生产文件，原测试仍不动：suite 原样报 `Unresolved component import: ../engine/Input`，7 项跳过，日志 `/tmp/ux-1ab-x3u5-counterfactual-current.log`。
3. 只补夹具前提：modules map 提供 beforeAll 已加载的真实 `inputManager`；document stub 的 `querySelector` 返回 null，以支持命名框可选焦点查询。没有替换生产处理器，没有修改任何断言或超时。定向复跑 7/7 通过，日志 `/tmp/ux-1ab-x3u5-fixture-fixed.log`。

三次均运行 `npx vitest run src/test/x3_u5_ui.test.ts --maxWorkers=1 --no-file-parallelism`，未启动全量。恢复后的 InventoryOverlay 与备份逐字节一致，SHA-256 均为 `fd5e0a7c50b6399513a513471cd985168f02db75a5c2cab3fa0a5dd643833f3f`；本次最终改动仅测试夹具两行与此报告。
