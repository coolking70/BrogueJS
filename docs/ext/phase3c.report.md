# 3c 体力与一格闪避报告

日期：2026-10-05 UTC。分支 `ext/phase3`。本步只实现 3c；不开放 3d 韧性/弹反/AI 防御、3e 篝火，不合并 main、不打 tag、不部署。

## 基线与能力边界

实际 GitHub `https://github.com/coolking70/BrogueJS.git` 的 `ext/phase3` 与 `ext/foundation` 在开工时均为已验收 3b `c7561e68f161c7046cc93dde5c74ddb5dbb65ec9`。明确 fetch foundation 到远程跟踪引用并 merge，结果 Already up to date；保留全部 4a 历史，没有使用旧脏树、覆盖文件或更改 giants 默认数据。

- combat module/rules **1.2.0**，生产 state **2**；数据 schema=1。foundation=4、native entity/whole-run/replay=3 不变。精确 manifest/指纹与严格状态校验拒绝旧包/旧状态，不做迁移。
- combat 仍只硬依赖底座。growth 技能通过既有受控 action 事务同时提交专注与体力，没有模块互相 import；没有声称已实现属性 stat adapter。
- **闪避仅允许单格及独立 builtin r0 2×2/3×3 方形**，显式白名单独立于底座的未来能力。一次 anchor 位移一格，`canStepFootprint` 验证整个身体及斜角中间落点，经 `commitCreatureAnchor` 统一提交；拒绝任意 mask、旋转、zone、复合体、穿人、穿墙、楼梯/portal/altar 与区域越界。4b 即使合入也不自动开放这些能力。水生生物的液体限制也传入同一足迹 step 谓词，覆盖方形对角中间足迹；活着且敌对的合法近邻抓持者阻止闪避，失效的旧 seized 标记只在成功提交时清理。

## 费用、恢复与事务

`ActorResourcePolicy` 声明原生攻击费用、容量/初始值、定点恢复分子/分母、恢复延迟和允许恢复的阶段；dodge 声明费用/保护/恢复 ticks。当前基础模板为 24 点体力、原生近战费用 2、闪避费用 4、保护 40 tick、恢复 80 tick、恢复 1/20、延迟 40 tick，允许 idle/recovery/break-recovery。原三招式费用保持。

- `ActorResources.ts` 纯整数计算，保存小数余数与延迟剩余；仅正 elapsed 推进。延迟内不恢复，跨越延迟只使用剩余 delta；满池不积攒余数。多子动作必须全部处于允许恢复阶段。
- 唯一资源真相在 module actor ledger。native dodge timer 为恢复剩余的镜像，load 验证一致；scheduler elapsed 同时推进资源，缓存层不 catch-up。若 native 状态计时跨过 dodge 恢复终点，内部拆成 recovery/idle 两段，使可配置恢复阶段不依赖 delta 分块。
- `NativeAttackTransaction.ts` 为同步引擎动作提供一次费用凭据：玩家/NPC、斧/矛/鞭/突进的多目标只扣一次；phased 释放使用受信 ActorActionScope 的已付凭据，不按段或目标再次收费。普通移动/等待不收费；未声明费用的投射物/魔法不收费。
- NPC 体力不足使用原生正耗时等待，不回退成免费攻击；NPC 与玩家共用资源计算，已接受的近战均在恶心/呕吐判定前付费。尚未选中攻击的普通移动恶心判定仍保持原生顺序。未分配 phased profile 的生物使用基础资源模板，但不会因此获得额外招式。
- growth 受控攻击在原 `runtime.command` 事务中先验证两方资源，在同一 commit 提交体力和专注。任一预检拒绝没有单边扣费；提交钩子异常恢复双方模块状态，再次绑定替换后的 state。凭据不跨 await，不进入存档。
- 换形策略在付款/elapsed 安全点重算当前 policy：钳制容量和延迟、清理不兼容余数、不回满；busy bundle 仍保持其原 profile 元数据至结束。新实体 ID 不复制旧资源/窗口。

## 闪避与原生环境

命令为 `ext:command` 的 `{module:'combat',action:'dodge',payload:{facing}}`。方向/确认/返回/取消复用 DialogService/DialogInput；显示不会取规则 RNG 或推进资源。纯准备不修改资源/时间/ID/RNG，提交前重验 session、revision、原位置修订、完整足迹和风险。

- 风险沿原生火焰、气体、压力板、坠落谓词，通过既有 requestConfirm 逐条录一次答案。No/无效落点零机械开销；已识别但拒绝的零时间输入沿既有录像合同记录尝试，不冒称成功。未知/坏 envelope 仍不录入。
- 费用、位置和窗口在同一同步提交中生效；环境接触走原生路径。已提交的陷阱/坠落等后果不会回滚成免费取消；内部未完成世界解析异常显式使运行/录制失效。
- 仅 dodgeable **直接物理**在命中/伤害骰与 `physicalResolved` 前被过滤。明确不可闪避的 phased 段、bolt/远程、状态/DOT、火/毒/坠落均不因此免疫；不伪造 positivePhysicalDamage。
- 保护终点不含到期时刻。强制位移（包括离开后回原格）、失能或离层取消保护；恢复/体力仍保留。立即入坑和客观环境块内坠落都在落层后自动完成同一动作恢复，不要求额外命令，不留永久输入锁。
- load 惰性绑定，不发新攻击/费用/恢复；下一 update 可继续保存的玩家恢复。保存/回放/seek/续录使用同一输入及双方 RNG，UI 等待不作为机械时钟。

## UI 与历史显示

新增体力条、费用、恢复中/不足原因和一格闪避按钮。所有新文本走 combat i18n。保护说明明确保留环境危险。HUD 通过通用 `DisplayFrame.moduleViews` 捕获只读公开 projection，不带 session、定义或机械 actor ledger；旧伤害 ACK 期间不会读取未来体力/窗口。既有 shell 在 live ACK 时隐藏模块插槽的政策未改。

## 验证记录

环境 Node 24.19.0、3 GiB 堆、Vitest 最多 2 workers。只跑新增/直接受影响功能、boundary/type/build 与相关真实组合 smoke；没有完整 npm test、全部 test:ext、removal、CE full/gen、drift，也没有修改生成基线或黄金 trace。

开发过程精确旧前提更新：

- 3b 包版本/键列表改为 1.2.0 与新增 dodge 字段；基础 actor fixture 增加 state2 资源字段，所有非法结构拒绝断言保留。
- 旧“整招式结束后等于初始减费用”改为初始减一次费用加已发生的声明恢复；原风摇/中段扣费断言仍保留。saved-player 恢复的 no-extra-fee 用 actionId 不再分配与准确恢复量共同验证。
- 新火焰测试第一次把 80tick 闪避误当成已到原生 100tick 环境边界，修正观察时点，未改原生环境速度或伤害。

浏览器：本机 Vite 以 127.0.0.1:5176 成功启动；官方 cloud browser 打开同 URL 返回 **net::ERR_BLOCKED_BY_CLIENT**。没有绕过限制，没有声称 cloud 像素已验证。稳定轻量 QA 包交给验收方 Mac fallback；截图只保留本地，后续填入实际像素结果，不把 SFC/引擎测试冒充真实触控。


### 开发阶段失败与复核口径

- 首轮 runtime/square 2 文件为 25 passed / 6 failed，全部是旧扣费后不恢复的数值前提；修订为已批准恢复后，4 文件 174 passed / 1 failed，剩余是 schema 键列表未增加 dodge；已修正。
- 首轮 47 文件相关集合为 **46 文件通过、1 文件失败，976 passed / 3 failed / 8 skipped，exit1**。三项为 saved-player 恢复旧期望 18，而实际完整 recovery 后为 21；现同时验证准确恢复量和 nextActionId 不变。
- 中间 49 文件运行期间加入了审查反例和修复，结果 **48 文件通过、1 文件失败，1043 passed / 5 failed / 8 skipped，exit1**，不能作为最终同字节门禁：三项新水生 fixture 误用了不存在的 DEEP_WATER 枚举，两项抓持反例仍使用该进程先前载入的生产文件。后续稳定定向复核仅剩两项 mock 精确参数检查因额外 undefined 参数失败；恢复非水生两参数 facade 调用，未放宽断言。全部保留原失败日志并在最终稳定快照统一重跑。
- 新 native 8 文件先通过 314 项；后来的重复 6 文件运行主动停止（exit130），不计通过。最终 native-stamina 本身 18 项通过（含恶心同费用语义、双资源失败回滚、换形 policy 与克隆），其后最终 4 文件额外 differential/growth 集合 **254 passed / 0 skipped，exit0**。
- 5 个相关真实 Game 组合 smoke **5 passed，exit0**；其余 26 项由名称过滤，未运行，不称为所有子集矩阵。

### 最终稳定候选

- boundary / vue-tsc / production build / diff-check 全部 **exit0**。build 仅保留既有大 chunk 提示；没有新增 Game 实例字段，无需新增 U03 字段登记。
- 最终 49 文件同字节相关集合 **49/49 文件，1049 passed / 8 skipped，exit0，318.52s**。8 skipped 为既有 p2_1/p2_2/p2_3 历史退役基线，未新增 skip。
- 文件清单 `/tmp/phase3c-related-files.txt`，日志 `/tmp/phase3c-related-stable.log`、`phase3c-{boundary,type,build}-stable.log`；额外四文件 254 项日志 `phase3c-native-extra-final.log`。四文件额外集合是在最后 NPC intrinsic dodge 修复前运行，其文件不调用新增 dodge 路径；新增路径与相关原生几何/资源均由最终49文件覆盖。
- 最终源集合（src/scripts/public/package/config，866 文件）SHA-256 **7e1dcc6b13727dd3000939676e91b8a3d66b03c88871cda424ea0333889c148f**，最终门禁前后完全一致；报告/README 是门禁后纯文档更新。
- 独立只读审查无剩余源码 blocker；恢复分块、换形、呕吐费用、克隆、坏档、坠落、水生和抓持反例均已落地。最终源上的 dodge52项、native18项包含在上述49文件中。
- 最终同字节 5 个相关组合 smoke 再次 **5 passed / 26 名称过滤，exit0，10.98s**，日志 `/tmp/phase3c-composition-stable.log`。
- 最终明确 fetch/merge hosted foundation 仍是 c7561e6，Already up to date，4b 尚未到达；发布前如上游前进仍须再合入并补跑实际受影响门禁。

最终截图 QA 仍待验收方，不能在本报告中提前宣称通过。

## 4b foundation 集成与第二次 QA 候选

Mac 对第一份 3c QA 包只观察到自然测试局初始体力 24/24；后续官方状态读取等待 3607.5 秒后停止，未完成闪避操作/像素验收，不能据此接受 3c。5398 服务已关闭，标签页关闭/视口重置未确认。后续有界恢复检查发现原任务没有暴露官方 CUA/IAB 工具，没有发出新的浏览器调用或收到新的浏览器拒绝；这不是已确认的产品故障。旧 QA 包不作为本次整合后的验收对象。

按维护者要求重新核对实际 GitHub：hosted foundation 为 **2eb3181e67c9e7650b538b08af76ba2759c75710**，含已发布的 4b 任意刚体 mask / 四向旋转；phase4 的 **dba3c5875d085c2fec82e4a036cef56cb6176cf5** 属于尚未进入 foundation 的 4c0，本次不合入、不实现其 prepare/commit 合同。

整合采用保留双方历史的 merge，不覆盖 4b。只有 Game.ts / Monster.ts 顶部 import 块冲突，合并保留两边所有 import；其余增量三方自动合并。底座的新空间目录、实际 mask/pose、native form、原生 NPC 位姿路径、保存/恢复绑定与 squareMotion 契约完全保留。giants 的新增正式内容和 trace 来自上游，合并后相对 hosted foundation 的 giants 目录差异为零，没有另改默认生成或平衡。

3c 的 `dodgeBodySupported` 白名单和收费/窗口实现不变。有效且已安装的 `giants.spine-crawler` 即使可以原生移动/旋转，仍不能用 3c dodge；有效 r0 任意 mask 也不因 pose 为 r0 被误当成 builtin square。新增整合专项直接覆盖可信已安装四姿态、免费拒绝、陈旧 square→mask 计划、伪造恢复坏档拒绝、原生移动/旋转与费用/恢复共存；不以未知非法形状拒绝冒充生产能力边界验证。

### 4b 整合实际门禁与保留缺口

- boundary / vue-tsc / production build / diff-check：均 **exit0**。新 integration 用例与平台输出路径修订后再次运行；保留已有 chunk 大小提示。
- 原 3c49 文件加8个直接受影响4b/giants文件：**57 文件，54 文件通过 / 3 文件失败，1139 passed / 3 failed / 8 历史 skipped，exit1，640.30s**。日志 `/tmp/phase3c-4b-related-first.log`，清单 `/tmp/phase3c-4b-related-files.txt`。这不是57文件一次全绿。
- 两项失败来自上游测试将性能证据写到 `/private/tmp`，云环境实际 `ENOENT`；单独原样运行也重现。仅把两个证据路径改为 `join(tmpdir(), filename)`，没有改断言/种子/耗时阈值或生产代码。修订后的两份完整4b测试加新 integration 文件：**3文件 / 61 passed / 0 skipped，exit0**，日志 `/tmp/phase3c-4b-focused-final.log`。其中新 integration 本身 **27/27** 通过；不把重叠结果相加声称唯一测试总数。
- 其余一项是上游 `giants_rigid.test.ts` 的自然1174命令存读/回放/seek/续录超过原 **120000ms** 阈值。整合集合中166.20s；原阈值/同种子/单worker隔离复跑仍 **153.33s、exit1**。随后在隔离副本只使用真实 hosted foundation `2eb3181` 原样源码与同一环境，亦 **152.02s、exit1**。两次未报告其它断言差异；这证明该超时也存在于上游云环境，不把它当成已通过或已解决。日志 `phase3c-4b-natural-isolated.log` / `phase3c-4b-natural-foundation-control.log`。未延长阈值、删用例、改路线、加skip或重录trace。
- 5个相关真实组合 smoke：**5 passed / 26名称过滤，exit0，13.15s**，日志 `/tmp/phase3c-4b-composition.log`。不是全子集矩阵。
- 独立只读 merge 审查无源码 blocker；确认3c实现与5309542相同、giants目录与hosted foundation完全相同，只有冲突import整合、新测试/文档和两个测试输出路径属于本次集成调整；提交前另清理上游 rigidScene fixture 的一个多余文件末尾空行，以通过整段 merge diff-check。
- 当前876个src/scripts/public/package/config输入集合 SHA-256：**7fbfc34373e6978080b15a4e1f0ad01c4a60a9f39f51a7e0ee7df2f5ba80a3b4**。相对旧QA源集合新增10文件、修改31文件、删除0；详细源记录和 diff 随更新QA包提供。

本次不运行完整 npm test、全部 ext、removal 或 CE full/gen，不主动重录上游 trace。旧3c的1049/8、额外254和5smoke证据保留为前一候选历史，不冒充全部在4b整合后重跑。**自然长录像120秒门限和Mac像素验收仍是明确未通过/未完成项，需维护者决定覆盖方式；更新包只是可复核候选，不是最终验收通过。**
