# 阶段 2b：通用交互实体与开口

状态：实现、独立审查、第三冻结树全部云端门禁与Mac同字节静态QA完成；浏览器结果为 `passed_with_tool_coverage_limits`，具体覆盖和限制见下文。交付后停止，等待维护者验收。基线 `71eac53a588b6b5e4781c7bfaa2e027cc70817f3`，仅 `ext/foundation`；2a1已验收。本次只2b，不进入2c/2d，不合main、不打标签、不部署。

## 范围与合同

实现与版本合同见[架构§19](architecture.md#19-阶段-2b-通用世界交互与零时间会话)。当前修改是原生地图完成后的非阻挡实体放置，不改地图生成算法/候选重试/地形/RNG；本步不自动采用旧CE全量档，不运行ce:fetch/test:full/test:gen，不隐藏既有CE缓存。最终生产差异确认只做生成后放置，不改地图生成，test:drift不适用、未运行。

完整实际结果、冻结hash、组合/真实删除与浏览器状态见下文；未验证内容不称通过。


## 第一冻结候选的真实结果

2026-10-03 20:54 UTC，2053份输入，hash `8d1a82e9030660d4b71b1885b169fdcfa26458a38646268844b73b3d5def2001`。首项 `npx vue-tsc -b` 18.96s、exit2：新i18n扫描器使用当前仓库ES lib不支持的Array.at。build/ext/完整npm test/删除矩阵均未启动，不称通过。只将该测试工具末项访问换为相同含义的索引取值，再冻结新候选；不调整生产行为、tsconfig、断言或门限。


## 第二冻结候选的真实结果

2026-10-03 20:56–21:01 UTC，2053份输入，hash `9868e257f3148dc42797665e4d74ae80b6a78cc95991375c5be10bdd3ad7fbdd`。vue-tsc/build/boundary各exit0（20.63/30.05/4.07s）；ext exit1，58文件通过、1套件导入失败，1147项测试通过，262.00s Vitest/262.88s墙钟。失败原因是叙事UI的eager descriptor间接导入浏览器Input单例，在无window的纯发现环境提前接线。未加window mock或跳过旧套件；改为App通过既有通用ModuleUiHost注入输入注册/held取消端口，模块声明不创建浏览器单例。修复专项3文件31项过。完整npm test及三个物理删除构建/测试尚未开始。

这次重新整合同时补了多目标同格的数据绑定回归：明确选择第二个实体进入它自己的dialogue，不能由列表第一项或样例NPC ID替代目标。测试仍归narrative自有manifest。此前独立审查/实际normal布景发现并修复的门禁旁路、活动存档空间资格、录像gate时序、投影预算、键盘跨关闭held续发及遮光植被落位均保持回归覆盖。


## 第三冻结树最终云端门禁

2026-10-03 21:08:09–22:03:54 UTC，Node24.19.0/npm11.9.0、3072MiB堆、2workers。全部重门禁串行，正常树完整npm test只运行一次；删除副本按维护者新版removal轻档，不重复完整npm test。

| 树 | 实际命令 | 结果 | 墙钟 | exit |
|---|---|---|---:|---:|
| 正常 | `npx vue-tsc -b` | 通过 | 19.07s | 0 |
| 正常 | `npm run build` | 通过 | 28.57s | 0 |
| 正常 | `node scripts/check-module-boundaries.mjs` | 通过 | 3.92s | 0 |
| 正常 | `npm run test:ext -- --maxWorkers=2` | 59文件 / 1156 passed；0 skip/todo/fail | 273.89s | 0 |
| 正常 | `npm test -- --maxWorkers=2` | 304文件 / 5575 passed、8历史skip、5历史todo、0 fail | 2127.74s | 0 |
| 删narrative，保留growth | `node scripts/check-module-boundaries.mjs` | 通过 | 3.83s | 0 |
| 删narrative，保留growth | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | 18.95s | 0 |
| 删narrative，保留growth | `npm run build` | 通过 | 28.55s | 0 |
| 删narrative，保留growth | `npm run test:ext -- --maxWorkers=2` | 54文件 / 1007 passed；0 skip/todo/fail | 231.76s | 0 |
| 删growth，保留narrative | `node scripts/check-module-boundaries.mjs` | 通过 | 3.65s | 0 |
| 删growth，保留narrative | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | 18.62s | 0 |
| 删growth，保留narrative | `npm run build` | 通过 | 25.12s | 0 |
| 删growth，保留narrative | `npm run test:ext -- --maxWorkers=2` | 29文件 / 608 passed；0 skip/todo/fail | 163.31s | 0 |
| 两模块全删 | `node scripts/check-module-boundaries.mjs` | 通过 | 3.74s | 0 |
| 两模块全删 | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | 15.85s | 0 |
| 两模块全删 | `npm run build` | 通过 | 27.64s | 0 |
| 两模块全删 | `npm run test:ext -- --maxWorkers=2` | 24文件 / 462 passed；0 skip/todo/fail | 143.10s | 0 |

Vitest实际耗时：正常ext272.90s、正常完整2126.60s；三个删除ext230.99/162.49/142.23s。完整npm test保留8个历史skip与5个todo，没有新增skip/todo、放宽超时/种子或拼接定向绿灯。无FATAL/OOM、未处理错误或worker异常；构建保留既有chunk体积及npm环境提示。

正常额外 `node scripts/check-module-composition-smoke.mjs --engine-only --output=…` 6.65s、exit0。删除总入口 `NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-removal.mjs --profile=removal --engine-only --maxWorkers=2 --output=…` 699.60s、exit0；它逐副本运行上表四项与smoke，没有调用完整npm test。各smoke耗时5.75/4.47/3.79s，均exit0。脚本正常full字段仍标外部required/not-run；真实正常完整结果由上表独立证据提供，未改脚本为假passed。

## 组合、物理删除与冻结归属

正常 `{}` / growth / narrative / 两者四子集，加删除后的2/2/1子集，共9组真实Game新局、原生游玩、save/load、逐checkpoint双RNG回放、seek 0/中间/末尾、save后wait续录与回放，以及缺模块输入拒绝全部通过。该通用smoke没有冒称每组完成真实UI流程；叙事会话本身的真实Game路径由自有集成测试另验。

三个独立临时副本真删narrative29文件/5自有测试、growth60文件/30自有测试、两者89文件/35自有测试。副本先核对完整冻结树hash，再删除和清理TS/Vite缓存；不在开发工作树删除，不保留模块空壳，不catch import或额外exclude。所有余下测试归属仍由共用发现器检查；removal档仅执行剩余ext测试，不把未运行的其它npm测试写成pass。

第三树2053份输入hash `5be0e4d066b168778a28840ccd4bfa70dd5382f453b6590915390ad72994129c`，正常长门禁与整个轻删除矩阵前后完全一致；三个删除副本自身输入前后也一致。最终重建的84份dist与QA包逐文件相同。上述脚本的总状态为 `partial-browser-not-verified` / `passed-engine-browser-separate`，没有把engine-only出口0改成browser passed。

| 静态构建 | 文件数 | 排序path/SHA组合hash |
|---|---:|---|
| normal | 26 | `e54d2f6149bfd62ba767d0f4e451a254465e1abfca47cba3597f7db2fcb9b581` |
| without-narrative | 24 | `1d6637b8f7fb00ed2c5558cfe9b0a4431a08ede409f7324123ca465b7f03adf4` |
| without-growth | 18 | `4d0de5b035820f9e12316ed3b2825c5f9688e569566790c5d08bf13e2f6ae597` |
| without-modules | 16 | `24f1a33c4037084f1db732ce435de8911541bebc0911dabf544443378eabd2f4` |

最终门禁结束后补交付文档/证据摘要；生产与配置字节继续与第三冻结树相同。收尾首次将新增文件纳入 `git diff --cached --check` 时另报 `narrative_ui.test.ts:221: new blank line at EOF`（exit2）；此前未暂存diff未涵盖该新增文件。随后按维护者要求仅删除该测试文件末尾1个LF（16,401→16,400字节），其余字节不变。原文件SHA256为 `201291e4c7cfdb5b5d90bae80067fab8e91a51f55d3aba9995b1d9015a1e0413`，清理后为 `a9ad858a159741b016d43c7c355545521e22fd3984a9f39ec2c213bcf1b9cd28`。2026-10-04 02:58 UTC补跑 `NODE_OPTIONS=--max-old-space-size=3072 npx vitest run src/ext/modules/narrative/tests/narrative_ui.test.ts --maxWorkers=2`，1文件11项通过、828ms、exit0；最终基线到交付的diff检查通过，无CRLF/冲突标记/新增大证据。完整npm test与删除矩阵仍对应修前等义测试文本，未冒称在清理后重跑；维护者明确无需因单字节测试空白重跑完整门禁。生产构建未改变，原84份dist及Mac QA继续适用。原始日志、完整hash、物理副本和QA归档保留仓库外 `cloud-extension-evidence/phase2b-final-candidate3/`；前两失败候选与开发日志分别保留，不提交原始大证据或截图。

## 实际实现与版本

- 底座 manifest.schema 仍为1，foundation包络/descriptor要求升2，旧foundation1拒绝；growth机械包仍1.4.0，仅更新其底座要求
- narrative module/rules=1.1.0，state/input=2，机械 fingerprint `sha256:57bb31b0b3832697dbd82cd70db6038a312df3a885a8056badc6fb1b561cda62`。portrait显示manifest独立，未接入正式立绘
- 真正引擎改动为 `src/engine/Core/Game.ts` 与 `src/engine/Input.ts`。前者接空间/资格/提交/持久校验和时钟及公开动作门禁，后者补显示层物理键释放屏障；新增Game访问器/方法，没有Game实例字段，U03原清单不需添项
- 底座 `world.ts/worldSpatial.ts/types.ts/runtime.ts/registry.ts/descriptor.ts/ui/types.ts` 定义与保存通用实体、放置端口、gate和只读投影。世界对象与gate存在extensions.foundation.world；depth是当前层/缓存层共同根，不塞进Monster，也不借growth组件或另一个可漂移坐标账本
- narrative自有placement/sessions/validation/view与state/input/schema/effects/triggers承接数据放置、严格会话、预算、引用、收据和纯执行计划；UI仅通过现有通用bar贡献临时呈现。App没有具体模块import；GameCanvas只消费通用可见DTO，危险格/气体/玩家/可见物品与怪物优先

## 实体、事务与时间合同

对象固定、可穿行、非战斗，不参与攻击/伤害/AI/碰撞/射线阻挡，也不获得成长组件。共享run-local entity ID；分配计数仍是原run.nextEntityId。底座仅允许声明worldInteractables的已启用模块，在已完成原生地图生成/恢复的enteredLevel提交边界批量放置；候选按入口距离/y/x稳定排序，排除不可见、非安全地板、遮光覆盖、无交互线、机器/陷阱/气体/危险、楼梯距离不足、原生对象及本批占位。不写地图、不取RNG、不反复生成。

整个放置batch先检验结构/预算与候选再分配ID；既有floor事务异常时恢复模块状态、世界对象与本次放置分配器，保留此前原生生成自己的ID合同。narrative用固定slot实例与有界placed/skipped/pending收据防重复；defer仅在新eligible深度尝试，范围结束确定性skip。缓存层重访和load不重放置。GC按当前+缓存层根，终局仅关闭会话而保留可检查NPC；移除失根对象时清模块绑定并保留不重复放置收据。

open/choose/close都是已提交的0tick/0turn ext命令。owner/session/revision/node及条件每次重验；无效/重复输入不记录录像、不取RNG、不消耗资源。gate只允许所属模块声明的continuation；移动、等待、物品、成长、自动步和既有公开玩家物品/目标/旅行入口在变更前拒绝，时钟入口同样守门。关闭不会自动恢复旧自动探索/长休息。

可见/附近/当前节点投影不外泄完整definitions、条件AST、flags、未来节点或收据；条件与显示均为纯查询。节点全部选项最坏条件操作数在包加载前共用预算检查，拒绝完整预览会超限的包，防御性显示失败仍留close。暂时闪光仅照亮的目标不进入可执行open，避免命令清显示时目标失效。合法同格交互不因可通行的遮光覆盖而拒绝。

UI的显示暂停与引擎gate分开。临时bar不设置displayModalOpen，不建独立dialog host；回放只读显示不阻塞自动播放/seek。opaque runtime/session token和revision防new/load/seek后的旧回调；指针关闭保护、键盘capture记录及release屏障防双击/held跨关闭穿透，失焦漏keyup后的全新按键可恢复。正式2d样式、立绘、统一dialogue类型及六布局仲裁仍等待后续授权并复用main dc0b78b。

## 持久、录像与专项证据

存档在退休旧局前交叉校验模块/owner/绑定/收据/gate、实体ID冲突、分配器、当前或缓存层根，以及active目标可见/距离/交互线/玩家资格。load恢复原节点和gate，不重新open/trigger。录像静态预检同时约束前一checkpoint gate与下一输入，首条choose/close不合法；live、逐步replay、seek和续录共用命令处理。

专项与独立审查覆盖：非法/不可见/远距/遮挡目标、多目标同格精确绑定、无候选skip/defer、重复入层、取消/重复命令、预算边界、陈旧session/node/revision、new/load退休、自然normal缓存换层与死局存读、narrative-only及growth组合的真实Game会话冻结/资源/RNG、active/选择后save/load、完整前缀续录、逐checkpoint replay与seek，以及恶意存档/录像拒绝前保留旧player/runtime/RNG。

真实normal生命周期用既有test helper切层，明确clearRecording并断言不能凭该helper路径输出完整原生录像；另两组合的实际命令链独立验证完整录像。纯SFC/模拟DOM及Input事件回归不是实际浏览器验收。

当前只记录本模块局部事实序号与纯内核效果；optional reward仍为skip，未增加growth XP adapter、全局fact ID、提交flush、重世界效果或其它阶段能力。

## 测试前提与门禁档位

- foundation预期版本由1改2，旧版本继续作为负例；2a1“纯包没有hooks/commands/enteredLevel不改状态”的旧前提改为2b实际行为，保留边界/版本/持久/确定性断言
- i18n扫描器改为分别解析Vue script、插值与指令表达式；动态字段候选仅来自所属模块真实data与有限投影/类型，不能宽泛认领locale前缀。新增missing/dead、无数据/跨模块/未知开放表达式和删除负例，不删词条或伪造t调用
- 通用地图显示读取secret标志的真实用途登记现有reader白名单，保留其它读者审计；隐藏陷阱不因marker消失泄漏，秘密阻挡格仍不覆盖
- 新基础/模块测试都登记manifest；通用地图marker测试归底座，删除narrative仍保留。删除脚本新增auto/full/removal精确档位，不更改2a0/2a1历史全量结果
- 本次没有修改Generator、GenerationCoordinator、地形写入或地图生成算法；实体放置发生在原生生成后。因此test:drift不适用、未运行，未重录生成基线/黄金trace。未运行ce:fetch/test:full/test:gen，默认npm test保留已有CE缓存

## 同字节静态包与Mac浏览器QA

四份云端静态构建均已重新type/build/boundary通过，84份dist文件有逐文件hash。QA归档 `brogue-phase2b-qa.tar.gz` 为2,959,083字节、SHA256 `deb7189b1db845b5ffc544487ae5078b480472e486c3606bb84909be8919789b`，包含小原生录像、active-save文件及必要说明；大world只留文件/页内，不传入工具参数。

初轮Mac连接不稳的失败仍保留：2026-10-03 21:18 UTC为offline；22:04短暂connected后再次offline。首轮仅Library解析成功，落盘/size/hash未确认；exec-server transport disconnected、browser/reset Transport closed，pwd挂起，未启动server/tab，结果JSON写入未确认。该轮不算产品失败或浏览器通过。后续在同一QA任务恢复，2026-10-04最终归档结果为 `passed_with_tool_coverage_limits`，没有发现产品阻塞；未重建或改动候选源码。

浏览器为用户Mac上的Codex IAB，实际UA：`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36`。DPR未记录，不作推断。包大小/SHA、manifest精确文件集合与84份静态文件逐项hash在QA前后均一致；该浏览器证据与上文云端engine-only证据分开，未回写脚本的历史 `browser-not-verified` 状态。

### 真实界面输入覆盖

- 自然新局遇NPC后实际开口、选择/关闭，零回合/零tick并冻结世界；活动对话的实际菜单save/load、只读replay与续录通过
- 重复双击只有一次合法choice；320px窄视口用鼠标关闭没有地图穿透；三种尺寸检查通过。这里的鼠标/键盘操作不称为真实touch或持续held按键覆盖
- 四构建共9组合实际走同一UI链路：启动 → wait → save → load → 续录 → 保存/加载回放 → 起点/终点seek。normal为空/growth/narrative/both，without-narrative为空/growth，without-growth为空/narrative，without-modules为空；checkpoint及双RNG精确一致，续录保留历史并追加事件，没有replayError
- 要求缺失模块的输入、旧foundation1/旧input-v1导入被拒绝并保留旧局。上述真实UI结果与下列页内夹具/探针结果分项记录，不用辅助probe替代界面验收

### 辅助页内夹具与状态核验

active-save通过页内加载夹具补验：session精确恢复，sessionId=1、targetEntityId=24，narrative gate保持，tick/turn=0。wait/search、stale revision/session、旧v1、foreign-target均拒绝；checkpoint中的双RNG、player/runtime身份和输入数不变。合法close不推进世界，只追加1条事件并清gate。此项为辅助页内加载/状态核验，不声称界面具备存档文件导入按钮，也不将直接引擎探针算作真实UI操作。

### 限制、清理与证据位置

没有覆盖真正按住方向跨关闭、真实touch或路由中断；held/失焦释放仍只有源码与自动测试证据。IAB工具调用长延迟已记录，不能据此认定产品延迟。正式2d六布局/立绘尚未实施，不在本次通过范围。

最终QA线程 `01a103cc-fdd2-736d-9a75-93facaed401e`、完成turn `01a1049e-5381-757f-8d06-1583e92ba1e5`。归档报告在Mac `/Users/coolking70/Documents/Codex/2026-10-04/task-2/mac-qa-2b/evidence/report.json`，截图索引同目录 `screenshot-index.json`；9张截图只保留本地，不入仓库。本段据已归档报告回收结果填写，不把云端未材料化截图说成已独立看图。

QA临时页内状态已清除，viewport恢复，immersive/settings未改变；本次4个tab与按PID归属确认的5个服务已关闭，端口无监听，未触旧tab或源码。生产/配置仍与第三冻结树相同；测试仅有上文已专项复验的末尾1个LF清理，其余后续变更为交付文档。

本步交付foundation commit和相对 `71eac53a588b6b5e4781c7bfaa2e027cc70817f3` 的verified git bundle，供Mac轻量发布。云端已知无GitHub认证，没有重试push；远程发布另行验证，不写成已经完成。没有main合并、tag或部署；交付后停在2b，不启动2c/2d。

开发中曾因并行新增测试尚未落盘被ownership守卫阻止启动，类型过渡错误在冻结前修复；i18n专项的2个真实失败由解析/精确引用修复，normal终局专项的1个open失败由遮光候选过滤修复。首两冻结树失败的真实退出码已单列；没有用其局部成功替代第三树门禁。
