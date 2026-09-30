# LAVA-1 熔岩断路修复

日期：2026-09-30。执行工作树 `codex/lava-connectivity`，起点 `ee51a11`。首轮完整门禁已结束，未全绿；失败归因进行中，以下为已验证结果。

## 问题与规格

录像 `brogue-web-replay-1790696110523.json`，seed 437995121；第四层 levelSeed 15318643，上行梯 (25,19)，下行梯 (63,23)。此前只读回放零 OOS，确认挡道格是普通 FLOOR+LAVA、machineNumber 0，没有机关链或可收回熔岩；手动跨越墙/熔岩夹角是旧实现留下的唯一无伤通路。这里不是遗漏了机关。

旧湖泊闸门把 `terrainAllowsMove(cell.terrain)` 当作干地，做不检查墙角的八向泛洪：熔岩/陷阱会被算成连通走廊，且剩余通路可以只是一条贴墙斜线。手动移动允许这种斜走，自动寻路已经按 CE 拒绝墙角，形成矛盾。

同时核对 legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9 与 [当前官方 CE 104a20f](https://github.com/tmewett/BrogueCE/tree/104a20fedbe7d9360d2dfc8ff665571694212ad8)：

- `Architect.c:2569–2636` 的 `lakeFloodFill/lakeDisruptsPassability`：四方向泛洪，四层 `T_PATHING_BLOCKER` 判断干地；`TM_CONNECTS_LEVEL` 可连接泛洪，但不算干地。两版执行条件相同。
- legacy `Movement.c:1050–1065,1165–1176`、官方 `Movement.c:825–840,931–937`：`diagonalBlocked` 检查两个正交角格；手动使用真实地形，寻路使用玩家已知地形。穿墙可攻击目标例外；撞机关的 promotion 先于这项检查。

## 改动

`Connectivity.ts` 恢复 CE 四方向与四层旗标口径。候选湖及已收录湖仍均被排除；可开启机关仅充当连接，额外统计已达干地避免被访问的机关格掩盖孤立干地。保持供其它调用者使用的 `terrainAllowsMove`、`DIRS8` 原语义。

`PlayerTravel.ts` 共用角格判定，默认仍读已知地形，手动传 false 读真实层。`Game.ts` 在 bump promotion 之后、武器几何/普通攻击/钥匙/危险确认之前阻挡墙角，保留 `MONST_ATTACKABLE_THRU_WALLS` 例外。没有新增 Game 状态、可见文本或随机数调用；输入仍经过原命令入口。`DungeonFeature.ts` 仅更新过时的算法说明。

不加入自动踩陷阱、跨熔岩的危险兜底。原录像里必须踩已知陷阱的单行道，仍属于 CE 自动行进的保护策略；需要玩家主动选择危险步。

## 复现与反事实

新增 `lava_connectivity.test.ts` 11 项：候选湖只留下墙角斜线、既有熔岩/深水/裂隙/陷阱及跨层显示遮盖、可开启机关连接与孤立干地计数、已知/未知真实墙角、拒绝时回合/tick/RNG/录像检查点不变、熔岩旁无遮挡斜走、普通攻击和穿墙可攻击例外、真实种子 D4 楼梯可达。

首次测试复现断路；新增全部行为用例完成后，仅把三份行为生产文件回退到 `ee51a11`，不动测试和夹具：五份旧基线/trace 精确通过，新回归九项失败、两项通过（旧深水判据和穿墙可攻击例外）。恢复生产后新 11 项全部通过。相关既有移动/寻路检查此前 63 项通过。旧守卫行为断言没有修改。

证据均在 `/tmp/broguejs-lava-fix/`：`red.log`、`old-production.log`、`green.log`、`targeted.log`。反事实基线集合与新实现首次检查集合一致，包括 shallow/deep 生成与 UR2/UR3/UR4；新实现首次仅 shallow/deep/UR3 失败，UR2/UR4 通过。

## 基线重录登记

反事实通过后，用原 `createHeadlessGame + terrainFingerprint` 全局连续 D1–D40 捕获两份生成基线；UR3 使用原 `UR3_CAPTURE=1`。UR2、UR4 保持原文件。临时捕获测试已移至 `/tmp/broguejs-lava-fix/capture-generation.test.ts`，未纳入门禁集合。

逐叶前后值、路径、SHA256 见 [登记 JSON](lava-1-fixture-diff.json)，大小约 93 KB。

| 夹具 | 变化 | 归因 |
|---|---:|---|
| generation_baseline | 157 数据叶 + 1 note | fp 56；怪物数 33、物种 35、物品数 33。新的湖泊拒绝/重试改变几何与生成期随机抽取，影响后续机器/人口落位 |
| deep_generation_baseline | 157 数据叶 + 1 note | fp 23；gem x/y 各 43、怪物数 18、物种 18、物品数 12。浅层生成历史和深层湖泊变化继续影响种群、拾取物与宝石落点；quantity/originDepth 未变 |
| UR3 | 262 数据叶 | 105 hash、怪物数 33、观测数 88、物品数 35、fall 1。hash 包含当前/缓存层地图、生成观察、随机状态，累积层历史及存读档也受影响 |

随机算法与预分配 levelSeeds 不改；不追求 CE 同种子逐骰一致。没有放宽断言、超时、数量下限或目录守卫。

## 浏览器

真实 Vue/Pixi/Game，Chrome/Playwright，1440×900。运行 `scripts/lava-1-browser-check.mjs`：使用原 seed 生成 D4，揭示地形并移除怪物/物品隔离通行几何，鼠标点击下行梯，经 45 步合法路线进入 D5、HP 500 未降；键盘 n 的墙角尝试不移动且不耗时/RNG，移走墙后可斜走；控制台零错误。场景装配直接置测试地形/知识，实际操作均使用 UI 命令。该验收不是声称完成原设备自然整局试玩。

技能标准客户端分别无头/有头运行并检查 text state；其 Canvas 直接读回均为黑，与上一轮 Pixi 采证问题一致。改用浏览器页面合成截图，并已实际查看 D4、下楼后的 D5、墙角放行截图。原始截图和状态放 `browser/`、`browser-standard-game/`、`browser-standard-headed/`，不提交。

## 门禁与限制

构建与 CE fetch 退出 0。首轮 CE 完整套件退出 1：247 文件中 238 通过、9 失败；4562 项通过、12 失败、8 历史 skip、5 todo，耗时 5333.65 秒。后续 drift 退出 0（1/1），整链于北京时间 2026-09-30 12:15:10 结束。状态/退出证据 `/tmp/broguejs-lava-fix/gate-state.json`，生产及测试/脚本前后 SHA256 均为 `86a1f676f5876accd161f2bebed8218cbf481ee50956ffe69050278294dd2947`。

失败均为非超时：`blueprint_center` 的真实区域 origin 物品正例计数归零；`horde_terrain_spawn` 的自然 CE47 闭笼钥匙正例归零；`monster_stats_effect` 的预期攻击/实际命中采样；`hunger_curve_sim` 的饥饿流程；`b_1a_identification/p1_20_item_placement/u_19e_machine_families` 的闭笼完整动作；`u_19d/u_19e/u_19f` 共五个旧固定自然机器样本缺失。仅回退三个行为生产文件、保留原测试和夹具，九份失败文件的 101 项全部通过（退出 0，1244.36 秒）；自动恢复后逐字节核对生产文件。进一步保留新 Connectivity、仅回退手动移动的 Game/PlayerTravel，战斗聚合、seed7 延长饥饿和自然 CE47 完整动作三项全部通过（退出 0，270.98 秒）。这证明上述三类失败来自旧策略反复发出穿墙角输入，将无回合的拒绝误计作攻击/时间或陷入路线循环。证据 old-guards-state.json、old-guards.log、isolate-movement-state.json、isolate-movement.log。现仅修正局部测试策略及 CE47 测试侧 BFS 的可执行边，原断言、种子数量、容差和预算不变；当时自然样本与非空转正例尚待采样核验；后续修订与结果见下。

修复作用于新生成关卡。旧存档已存下的坏地图不自动重写，旧录像重演可能因生成变化报 OOS；本项目既定不做旧存档迁移。原录像保留作为旧实现诊断材料。不合并、推送或发布本轮改动。

## 旧测试前提修订（已复核）

见 lava-1-test-prerequisites.json 的夹具逐叶变化、原/新 SHA256 与采样出处。保留全部原普查种子和深度；blueprint_center 追加 seed43（D7 两份真实 CE39 origin 产物），horde 的四组全深度普查外追加 seed777 的 D1–D14（自然 CE47 闭笼钥匙），原四组护符计数断言不变。只替换五个已缺失的固定自然机关坐标/种子：CE21=43/D18、CE35=3/D21、CE7=3/D13、CE52=2/D7、CE55=36/D11。

CE55 的实际外格 (15,14) 从上行梯用原四向路径可达（15 步），拉杆在 (14,15)。四个正交邻格均阻挡，旧测试辅助只选四向拉杆邻格而报告 no outer entry。CE 先执行 bump promotion，允许从此外格斜向拉杆；辅助仅扩充隐藏拉杆的邻格候选，不改变行走路线或引擎规则。新样本出现奖励路线时仍有一个活跃隧道标记，原辅助过早记录 opened；在原 350 步内等待奖励可达且全部标记消失，再执行原有零活跃标记断言。整体三项 U19f 原断言通过（14.99 秒），四个其它自然机关用例此前通过。新增斜向拉杆顺序回归，LAVA 用例现共 12 项通过。未采用的 D26 候选完整动作未能在原预算内完成，其诊断保留在 /tmp；没有增加预算或把失败计为通过。

首轮九份失败文件和四份相关前端守卫串行复核全部通过：13 文件、194 项，退出 0，1298.56 秒。前后生产/测试/脚本 SHA256 均为 dded29119ebd3e2fcfd9355ff3bf7da58c33c4d8b4e762cb09503d10a0659cfe，证据 adjusted-guards-state.json / adjusted-guards.log。已冻结并启动统一 build、CE full 与 drift，证据在 combined-gates/；build 与 CE fetch 已退出 0，冻结启动时完整套件尚未结束，W-5 普查失败当时待最终错误确认；收尾与串行复核结果见下。地形字符 tint 的实测和视觉证据见 PERF-2 报告。


统一门禁于北京时间 2026-09-30 18:25:45 全链结束：build/CE fetch/drift 均退出 0；full 退出 1，245 文件通过、2 失败，4573 项通过、2 失败、8 skip、5 todo，6361.88 秒。两份失败的最终错误均为 Test timed out in 900000ms（blueprint_center 用例 b、W-5 generated results），原 12 项行为失败在本轮全部通过。冻结前后源码/测试/脚本哈希 dded29119ebd3e2fcfd9355ff3bf7da58c33c4d8b4e762cb09503d10a0659cfe。正在原门限、单 worker、不并行文件复跑两份完整文件，证据 /tmp/broguejs-lava-fix/combined-timeout-retries/；此时不能称完整套件退出 0。


两份超时普查原门限串行复核全通过：blueprint_center 7/7、537.27 秒；W-5 18/18、485.49 秒。前后冻结哈希相同，证据 combined-timeout-retries/state.json。完整套件实际退出 1 与串行复核退出 0 分开记录，不称完整套件一次全绿。

本轮完整套件原退出 1 的超时与串行复核退出 0 分开保存，因此不满足 development §4 的“合并结果免复跑”条件；未来合并/发版应按规定补验，不把本报告视为一次全绿的完整套件证明。后续计时与 NPC 纯查询优化按中档独立验收，不再改变 LAVA-1 的规则/生成文件与登记基线。

性能与显示计时的后续整改已按计划完成，最终中档 53 文件/987 项及 build、drift 全过，源码冻结哈希一致，详见 perf-2-spawn-stutter.report.md。本轮未合并、推送或发布，保留主仓其他工作。
