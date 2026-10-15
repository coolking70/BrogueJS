# 营地录像与施工反馈修复

## 范围

- 工作树 `ext/camp-fix`，基于 `ext/foundation` 的 `3cff4bb`；未 commit/push。
- 按本次明确授权，只跑相关测试、boundary、测试依赖检查、vue-tsc、build。不跑全量/CE 对照/生成基线/开发存档兼容。
- 威胁判定、施工费用和时间、录像格式版本、SDK、Game 状态合同字段均未改变。

## 1. 录像根因与修复

### 原文件结论

`r2.json` **没有丢失开局前缀**，也没有晚启动录制。首条命令是建营地，正常消耗 `createTicks=300`，事件记录的是命令完成状态，所以 `index=0, turn=3` 正确；新局初始时仍是第 0 回合。

使用正式中文初始化和录像内的种子、模块、`settlement.raids=false` 配置生成新局后，r/r2 的六个初始摘要域及根摘要全部一致。`r.json` 原文件可加载并完整回放 540 条，零 OOS。

`r2.json` 原文件实际被 `validateRecordingV4` 的**事件哈希链校验**拒绝，尚未进入 `Game.loadReplay` 的初始世界摘要校验。首次独立链不匹配在 **index 361**（第 362 条，建造木墙，确认 true）；后续事件沿用了这个错误链值。初期未初始化中文的诊断会额外出现 knowledge 域差异，正式原文件结论以加载 `src/i18n` 后的验证为准。

### 单变量定位

异步检查点完成后，`publishRecordingChains()` 从旧检查点向后发布链。若后面的动画命令仍在推进，它已存在于事件数组，但 `tick/turn/player/hp/checkpoint` 等还是临时值。旧实现会给这个临时事件发布哈希，并推进 `chainFrontier`；命令完成补齐最终状态时，不会重新访问已经越过的行。

取 r2 已验证的前 361 条，恢复该回放前缀，再以动画模式执行原 index 361 建造命令：**其尚未推进完毕的临时行所计算的哈希，与 r2 中的错误哈希完全相同**。这确认了具体损坏来源，未依赖“首回合不为零”的推测。

修复只在 `Game.publishRecordingChains()` 增加边界：遇到 `pendingCommand.kind === 'record'` 对应行即停止。由既有推进收尾路径补齐检查点后再发布。未改录制起点、哈希算法、加载校验或规则。

### 原文件恢复副本

原 `r2.json` 已写入错误链，生产加载器仍严格拒绝它；没有静默修补或放宽完整性验证。为维护者另生成：

`/private/tmp/camprep/r2.recovered.json`

只重算 index **361–376 的 chainDigest（16 个字段）**，输入、确认、回合、RNG、初始摘要、事件检查点、最终摘要全部保持。副本经真实加载、seek 377、最终完整 mechanicalDigest 对照通过，零 OOS。原文件及恢复副本均未入库。

SHA-256：

- r.json：`15037070a61c61eb22b92a7ec1e6773f5843f463e6927aaa0429c0272a22ec39`
- r2.json：`46dc8d35b710540127ae94d38b259ae160949823afd7e174aee10ef5330dc4ab`
- r2.recovered.json：`1061d4bbe45672861fd317e1968a322a3328c5a0b1112f21362dac8de3bac93b`

### 入库回归

`settlement/tests/camp_recording.test.ts`：

1. 自然种子 28、normal、营地突袭关闭，无场景/背包/RNG 注入。第 0 回合新局→首个建营地事件为 turn 3→扩张→建造→异步导出→加载→seek 末尾/0/末尾，最终六域摘要一致。
2. 延迟第 256 条异步检查点，下一条营地命令仍在动画推进时完成旧任务。断言临时行不会发布哈希，再完整收尾、扩张、建造、导出和回放一致。合成同类“临时行旧哈希＋后缀沿用旧链”的损坏副本，确认加载仍拒绝且保留当前局。

先红后绿：原生产逻辑下延迟后端用例直接观察到临时行已有错误哈希。初版自然夹具选 r2 种子时，扩张后建造遭真实 `C5_THREAT`，改选自然种子 28；没有改威胁规则或绕过校验。

## 2. 施工面板与键盘

- 将停止队列和清空草稿分开。只有已完成命令才移出对应格；确认/动画未完成时保留。
- 首次失败停止后续发送，持久显示 `第 N 格 (x,y) 未施工：<原因>`，保存 SDK 精确错误码对应译文；取消确认也有独立原因。
- 后续轮询、其他操作清除引擎 lastError、切换页签，不会抹掉失败说明和未完成格。可逐格“移出草稿”，重新选格/修改材料后再次确认；新一轮施工清除旧错误。关闭面板/换局仍释放临时草稿。
- 建造、居民选格、尚未建营时的选格状态接管全部键盘输入，方向键只移动显示光标；物品栏、丢弃、等待、移动等不会穿透至全局输入。保留原生 Tab/按钮行为、Esc 关闭和非选格库存页的原有走动方式。
- 所有写状态操作仍经 `executeCommand`；显示状态不进入存档/录像，不消耗 RNG。

新增真实 SFC/真实 Game 回归覆盖：首格材料不足、取消、睡着的可见敌人威胁；成功一格后第二格距离失败，保留精确后缀；跨轮询/页签/成功库存操作保留原因；移除错误格后继续；真实 InputManager 的 i/d/a/j/./x/Tab/Enter/方向键隔离与关闭后恢复。

### 既有用例变更及反事实

首次既有 UI 批次 3 文件：18 通过、3 失败，均为旧草稿生命周期断言。只把 `useSettlementUi.ts` 回退到 HEAD，保持其他文件不变，原 `settlement_ui.test.ts` 6/6 通过；随后恢复新实现。

这三处按本次用户明确要求变更 UI 预期，不作为守卫放宽：

- ACK 暂停时，显示草稿仍含尚未提交展示结果的格：1 → 2。
- 一格成功、第二格距离失败：旧“全部清空”改为保留 15 格，并精确断言首格坐标和失败原因。
- 确认 No：旧“立即清空”改为保留原单格并断言取消原因；关闭再打开仍为空。

原命令数、施工结果、消耗时间、RNG/只读保护和关闭清理断言保持；未删除用例、skip、改超时或改基线。

## 3. 验证结果

| 检查 | 实际结果 |
|---|---|
| 最终相关 Vitest，`--maxWorkers=2` | **12 文件 / 113 项通过，exit 0**，203.39s；无 skip/todo/unhandled |
| i18n 源码定向检查 | **5 通过 / 21 名称筛选未运行，exit 0**；没有运行400回合普查 |
| `npm run check:modules` | boundary + 测试归属 + 测试依赖，**exit 0** |
| `npx vue-tsc -b` | **exit 0** |
| `npm run build` | 含最终 vue-tsc 与 Vite，**exit 0** |
| `git diff --check` | **exit 0** |

最终相关文件：

- 模块：`camp_recording`、`settlement_ui`、`settlement_feedback_ui`、`settlement_input`、`settlement_inventory_ui`。
- 底座：`ext_recording_async`、`ext_recording_v4_digest`、`ext_recording_v4_snapshots`、`ext_recording_v4_storage`、`replay_import_ui`、`u24_hardcoded_text`、`test_suite_membership`。
- i18n 另执行 `p1_30_i18n_gate` 的“扫描覆盖/每个静态/每个动态/所有 t/没有从未”五个用例。

主要日志：`related.log`、`i18n.log`、`check-modules-final.log`、`types.log`、`build.log`。早期失败保留在 `ui-first.log`（旧预期3项）、`recording-red.log`（竞态及自然夹具威胁）；单文件反事实 `ui-counterfactual.log` 6/6。中间 UI 27项、录像2项通过不与最终113项累计。外部原录像诊断 `raw-final.log` 1通过/2名称筛选未运行，单独列证。

没有运行全量 `npm test` / `test:ext` / drift / CE，也没有兼容旧格式、修改黄金 trace 或生成基线。当前无已确认的本次未修复代码缺陷；浏览器实机验证受下述环境限制。

原始本地诊断/日志在 `/private/tmp/camprep/`，不入库。`raw-final-validation.json` 记录真实原录像校验、临时行哈希一致性及恢复后最终摘要；外部原文件探针已从测试文件移除，入库测试不依赖该目录。

浏览器限制：Vite `127.0.0.1:5199` 监听被沙箱以 EPERM 拒绝；按 develop-web-game 技能尝试标准 Playwright 客户端，Chromium 在 MachPortRendezvous bootstrap_check_in 阶段 Permission denied。没有可用页面或截图，不声称浏览器/真机验收通过。相关交互已通过真实 Vue SFC 渲染器及 InputManager 路由检查。
