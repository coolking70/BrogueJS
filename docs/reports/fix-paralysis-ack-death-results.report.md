# fix-paralysis-ack-death-results 执行报告

日期：2026-10-03。工作区：`BrogueJS-newtheme`；分支：`fix/paralysis-ack-death-results`；HEAD：`1c9c337f3e430774b3f9555c6a238efd5fe19e25`。用户已批准任务书；未 commit/push。

## 1. 实现与 CE 核对

已读 AGENTS.md、HANDOFF、development、architecture、testing、in-app-dialogs 设计及本任务书，补读 i18n 规则。使用已有只读 CE legacy `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`；`npm run ce:fetch` 仅复用校验，exit 0。未修改 CE。

- 麻痹气体：CE `Time.c:475-490` 在 `canDirectlySeeMonster(monst) && !STATUS_PARALYZED` 时提示，然后无条件按 `max(原值,20)` 施加状态。玩家可直接看见自己；web 保留原豁免、disturbed 和 applyStatus 路径，只在施加前记录原状态是否非零，并给原消息条件补零状态门槛。
- `applyTimedStatus` 也补同一玩家 onset 门槛；不改变 refresh 的返回值、持续时间、抵抗骰或来源专属普通消息。其现有经典调用包含防火药水、护符、再生符文与怪物 BE_ATTACK 的 on-hit 扩展入口；麻痹药水仍先生成气体，武器麻痹符文仍走自己的 `applyWeaponRunicEffect`。CE 武器麻痹 `Combat.c:722-734` 使用每次触发的 combatMessage，本轮未将它改成只提示首次。通用 JS 入口没有完全同名的 CE 函数，不将所有来源都声称为气体路径。
- 诅咒转移：CE `Combat.c:1847-1875` 先转移，玩家被吸至 ≤0 时即时 gameOver 并从 inflictDamage 返回 false，不扣受害者 HP。web 给所属 Player 绑定非持久化 WeakMap 回调，在新局和读档后接到 `triggerGameOver(false, death.cursed_ring)`；伤害前回调以 false 中止受害者 HP 扣除和 die。护盾、血迹、转移算术及其它路径顺序保留。
- 返回语义：CE `attack` 的 `Combat.c:1325-1454`、投掷 `Items.c:6825-6859` 在 false 时走存活消息/符文分支，不能把整个攻击当 miss 或立即返回。web 保留 hit、原伤害元数据和符文后续，仅终止本次受害者 HP 扣除；回归验证未计击杀、未掉受害者 HP、麻痹符文仍能触发。投掷与法杖的同一伤害边界也有真实命令回归，读档后回调重新接线。

同时查看官方 master 的 [Combat.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Combat.c)（1470–1473）和 [Time.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Time.c)（371–377），以上两个规则条件与 legacy 一致；没有同步新版 CE 或声称核对了整个 upstream。

## 2. 结算直达与生命周期

默认仍逐条显示 ACK，旧 UX-1A 默认顺序断言保持。

游戏终局且还有 ACK 时，现有消息层显示 i18n“查看结算”按钮与 R 快捷键提示。点击/触摸 click 走同一函数；R/r 可直接查看，Tab 保持原生焦点行为，聚焦该按钮后 Enter/空格也可查看。没有 isAdvancing 禁用条件；repeat 与对应 keyup 继续被吞掉，不能泄漏到游戏。

显式查看后，Logger 的 presentation WeakMap 将剩余队列按发生顺序移入未读副本；Logger.messages、id、count 和日志归档不删除、不重排、不改写。重复文本保留每次发生；结算内显示可滚动的未读消息区。结算已经呈现后的新 ACK 追加为非模态未读消息，不再挡住控制按钮。

结算的保存录像/导出 JSON/返回标题沿用原事件及命令完成边界。返回按钮先清 presentation 队列，再通知 App；新局、读档、Logger reset/setState 也清除待确认、未读和终局呈现标志。回放/seek 仍由原 `!replayRecording` 条件关闭 ACK 等待。

未新增 Game 字段；没有存档/录像格式、生成逻辑或显示 RNG 调用。完整命令续体、MORE 的 CE 键位替换和逐回合显示序列属于 D1–D4 后续任务，本次不宣称这些已完成。

## 3. 回归测试

新增 `paralysis_ack_death.test.ts` 的 10 项引擎回归，登记常规组；在 `ux_1a_end_ui.test.ts` 添加 3 项组件用例，旧三个用例的断言未改。

- 气体首次 ACK、刷新不重复、新一轮麻痹再提示；状态值、applyStatus 结果及双 RNG 保持。
- 通用玩家 timed status 刷新不再重复 ACK，来源普通文案仍保留。
- 同步/动画真实近战在 attack 返回时已经终局；诅咒戒指死因、护盾不抵消、受害者 HP 不扣、无击杀。
- 存活负转移仍正常扣双方 HP；一 HP 受害者不会误杀；致死后仍走存活符文分支；投掷、法杖、读档后接线。
- 实际 Vue 组件同时挂载 ACK 与 End：显式查看、三条未读（含重复）、归档/count/RNG 不变、终局后晚到 ACK 不再模态、保存/导出/返回可用、下一局队列清理、R/Tab/聚焦 Enter/空格和 repeat。

生产修改前最初 11 项（含旧 UI 三项）为 7 failed / 4 passed，exit 1。最后相关 8 文件 163 项全部通过，exit 0。

组件测试使用既有客户端 SFC 编译和 Vue host renderer；新增键盘测试直接调用实际 capture listener，避免 Node EventTarget 不实现 DOM capture-before-bubble 的装配差异。旧断言、容差、种子、超时、skip/todo 均未修改；不存在旧失败用例的前提修订。

## 4. 证据录像与任务书验收前提冲突

原文件 `.tmp-evidence/brogue-web-replay-1791020631948.json`，1,514,753 bytes；SHA-256 `867c2e41d862051a82eacab56e7a8af7fcaf6d7902eb47f45514544cc3ab3f82`，保持原样。

只读 SSR 探针用正式 loadReplay/replayStep/checkpoint 和原 25ms 动画推进；没有改录像事件、RNG、世界布景或跳过 OOS 校验。原始脚本和 JSON 见 `/private/tmp/brogue-paralysis-fix/replay-*`。比较使用 `absoluteTurnNumber`；`stats.turns` 是另一计数，未混用。

**当前基点本身不能零 OOS 重放这份历史录像。** 基点已合入 `ad50a8e` / `fbc346e` 的超额 HP 回合封顶修复，设计 §8 探针实际基于该修复之前的 `1ff39a8`。在当前 HEAD 原生产实现上重放前 3743 条全部检查点通过，但玩家 HP 已为 27；最终命令在 turn 3377 死亡，报 `OOS at command 3744: state mismatch after command 3744`。本轮新生产具有相同模拟结果和 OOS，最终警报从 5 次降为 1 次。

| 隔离条件（动画开/关均同） | 最后命令前 | 最后命令后 | 最后命令麻痹 ACK |
|---|---|---|---|
| 当前 HEAD 原生产 | cursor 3743、turn 3371、HP 27 | cursor 3743、turn 3377、HP 0、score 1820、既有 OOS | 5 |
| 当前本轮新生产 | 同上 | 同上；双 RNG 与原生产完全相等 | 1 |
| 原生产 + 仅换 `1ff39a8` TimeCoordinator | cursor 3743、turn 3371、HP 35 | cursor 3744、turn 3378、HP 0、score 1820、零 OOS | 6 |
| 本轮新生产 + 同一旧 TimeCoordinator | 同上 | 同上；最终检查点与前行逐字段相等、零 OOS | 1 |

最终绝对回合探针再次断言：当前与历史两组的新旧 before/final 对象（含 absoluteTurnNumber、stats.turns、完整双流 RNG 和计数）及麻痹施加序列（原值、施加后值和返回结果）分别逐字段完全相同；比较脚本 exit 0，结果在 `replay-comparison.json`。

隔离方式是在临时 Vite pre-transform 中读取 `git show HEAD:<生产文件>` 原字节，提供给该探针加载器；历史组再仅替换 TimeCoordinator 为 `git show 1ff39a8:...`。仓库生产文件和 CE 文件从未为探针回退或改写。历史时间协调器只用于归因，未并入修复。

因此“在当前基点直接重放此旧录像最终零 OOS”这一验收项与已有 CE 封顶修复冲突，本轮不通过撤销 CE 规则、改事件或倒推 RNG 来满足它。报告登记既有差异，提供当前新旧不变和原录像条件下 6→1 / 零 OOS 的两组证据；不冒充当前构建已零 OOS。

## 5. 门禁与覆盖限制

局部规则档；不运行重型生成普查，普查组内读生产源码守卫另行定向运行。

| 命令 | 结果 |
|---|---|
| `npm run ce:fetch` | exit 0，复用校验已有只读 legacy |
| `npx vue-tsc -b` | 最终 exit 0；首轮 App 多余 Logger 清理行未导入、测试使用不受项目 lib 支持的 Array.at 导致类型错误，已删除重复清理行并改等价测试读取 |
| `npm run build` | exit 0；保留既有大 chunk 提示 |
| 相关 8 文件（`--maxWorkers=2`） | exit 0，163 passed |
| 普查组源码守卫 5 文件定向（原命名过滤器） | exit 0，10 passed；118 项未被过滤器选中 |
| `npm run test:full -- --maxWorkers=2` | exit 0；246 files / 4422 passed / 8 历史 skipped / 5 历史 todo；1007.16s |
| `blueprint_center` c 完整原门限定向（含人口捕获中的 Game.ts 读源码守卫） | exit 0；1 passed，6 项未被过滤器选中；329.83s |
| `npm run test:drift` | exit 0；2 files / 2 passed；47.56s |

完整冻结运行状态：`/private/tmp/brogue-paralysis-fix/gates/state.json`，full → blueprint 源码守卫 → drift 全部串行退出 0，于北京时间 20:07:23 完成。前后 574 个源码、测试、脚本、资源及配置文件哈希完全相同；清单 SHA-256 `aad128b4fb6c7bd462122010e4f813f9db21c06674a1a131314ead09eca320e5`，changedFiles 为空。

浏览器采证尝试使用 develop-web-game 原标准客户端，未修改客户端：本地 Vite 监听 `127.0.0.1:5403` 被 sandbox `listen EPERM` 拒绝，Chromium 启动被 `bootstrap_check_in ... Permission denied (1100)` 拒绝；两者 exit 1，日志分别为 `vite.log`、`browser-client.log`。没有取得真实 DOM hit-testing、四视口截图或物理触摸验收；组件 click/键盘与规则真实命令验证均已执行，不将它们写成真实浏览器/手机验收。

SSR 加载器也输出 24678 WebSocket 监听 EPERM，但规则探针完成并写出结果；该提示不等于浏览器服务可用。早期探针的数据解析/计数检查错误留在临时日志，最终上述 JSON 比较才作为证据。

## 6. 基线与收尾

完整常规组已全绿：UR2/UR3/UR4、录像 u_27/x2a/x3b、U03 和所有常规组读源码守卫均通过。两份生成基线 drift 也通过；五份夹具逐字节与 HEAD 相同，未重录，无需逐字段变化登记。

开工已有未跟踪 `docs/tasks/chore-test-sfc-resolver.md` 与本任务书保持原样。截图、大体积原始证据、临时探针和 progress.md 均在 `/private/tmp/brogue-paralysis-fix/`，不入库。

最终 `git diff --check` exit 0；改动文件无 CRLF、无 >1 MB 文件；CE 参照 Git 状态干净，最终源码仍与冻结清单一致。未 stage、commit/push，未修改其它任务或实现后续完整弹窗方案。
