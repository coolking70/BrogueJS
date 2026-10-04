# 2e 收尾、独立性验收与阶段2总结

## 授权、基线与停止点

维护者已联合验收2c+2d，授权仅推进2e。从干净的`ext/foundation`、`015beaa85bc5634ef1ce1b2a4938f693660f7a90`开展收尾；阶段2四项A维持：独立模块先决底座、全对话0tick且世界冻结、固定可穿行非战斗NPC、自有剧情与可选XP。没有新世界机制、阶段3、整分支main吸收、合并、tag或部署。此报告是提交维护者最终验收的候选记录，不代替验收决定。

## §11/12缺口核对与有界补充

- 四种启用子集与四种目录保留状态是不同轴。现有发现式组合测试和真实物理删除工具已覆盖相应流程，2e必须在最终候选重新执行，不能沿用2d门禁。
- 原`narrative_runtime.test.ts`会话闭环使用真实Game，但模式是`test`；已测活动存档、领取后读档和会话录像，未将开口前、显式close后两切点分别恢复到完全相同终点。
- 新增模块自有`tests/narrative_persistence.test.ts`，登记于模块根目录`test-suites.json`。两个用例分别测试narrative-only与实际发现growth后的组合；使用正常生成`mode:'normal'`、默认内容、seed8201、自然邻近守卫，仅通过公开Game命令。四个切点各保留原始存档，逐一读档、执行剩余输入、比较完整世界和录像、逐事件回放、向后seek到各切点和0/终点。无传送、手改快照/事件、改数据包、模拟provider或虚构世界。
- 完整世界断言保留地图/当前及缓存层、原生实体图/物品/生物/资源、规则运行状态、扩展对象/绑定/gate/收据和双RNG。只排除墙钟`savedAt`与录制/显示账本；录像另做除`recordedAt`外的精确结构对等。默认组合奖励仍是`disabled`，独立叙事是`absent`，不是声称默认包已发XP。
- 删除smoke原有缺模块检查通过篡改manifest模拟缺席。2e另导出正常树的四份真实save/recording（叙事组合保留active会话），逐份交给真实删除副本，校验保留集合可读取、要求缺席模块的输入被拒绝且原局对象/runtime/机械及录制快照不变（预期拒绝文案的logger单列）。原始数据保留仓库外，不用伪造manifest冒充原始旧档。
- 不修改旧守卫、不删除或放宽旧断言、不增加skip。新增测试首次开发运行失败仅因误把导出墙钟`recordedAt`列入确定性比较；修正为明确排除此非机械字段，全部世界与事件断言保留。独立审查在长门禁前完成，未发现阻塞项。手册三个JSON示例由仓库外验证器直接提取并合并默认包，真实schema/纯内核11类检查通过；这属于内容夹具校验，不冒称正式内容已经新增。审查指出load与seek措辞混淆，已明确load不重触发、replay/seek在重建状态重演命令。

## 阶段2实际提供的能力

1. 独立`narrative`包：稳定ID、私有数据/locale/UI/测试目录、独立版本/规则指纹/状态。仅依赖底座；growth可关闭或整目录移除。
2. 通用固定交互对象：非战斗、可穿行、1×1、当前层可见/距离/交互线资格；内容驱动安全放置、skip/defer、去重和缓存层持久化。
3. 对话图：严格版本的open/choose/close；当前节点/选项、条件禁用或隐藏、flags/counters、日志、显式剧情事件和预算；修改合法数据即可增加/删除内容，无样例NPC ID分支。
4. 零时间机械会话：引擎gate阻止原生/成长/自动行动和时钟推进；关闭不恢复旧自动行动。拒绝重复revision/session/失效目标，真实输入只由命令入口落账。
5. 剧情安全提交：入层与派生事实、稳定顺序、收据去重、单checkpoint原子提交。可选growth公开身份查询/奖励协议；缺席、关闭、无报价分别跳过，支持后非法provider报错而非静默降级。
6. 同一刻符对话栈：共用DialogService/DialogHost，DialogInput唯一物理屏障；正文/选项滚动、日志、大图子页、立绘占位/缺图回退。回放为只读展示，图片或显示等待不阻塞机械seek。
7. 自有持久状态及确定性录像：活动会话、对象绑定/放置、flags/log/receipt都随精确manifest保存；真实保存续录保留原输入前缀，逐事件回放与seek重建机械状态。

### 配置/内容的准确入口

完整字段、可验证示例与新增步骤见[`narrative-config.md`](narrative-config.md)。主要入口：

- NPC、放置、flags/counters、对话节点/选项、journal、storyEvents、triggers与limits：`src/ext/modules/narrative/data/definitions.json`
- 文本键：`src/ext/modules/narrative/locales/zh_CN.json`
- 立绘显示元数据：`src/ext/modules/narrative/data/portraits.json`；图片放`src/ext/modules/narrative/assets/portraits/`的包内png/webp路径
- 包校验/指纹：`schema.ts`、`definitions.ts`；会话/解释器：`sessions.ts`、`conditions.ts`、`effects.ts`、`triggers.ts`、`commit.ts`；持久校验：`state.ts`、`validation.ts`
- 世界接入/放置：模块`module.ts`、`placement.ts`，底座`src/ext/world.ts`/`runtime.ts`与Game；只读视图及显示：`view.ts`、`ui/`，共用`src/components/DialogHost.vue`、`src/ui/dialogService.ts`/`dialogInput.ts`
- 可选XP的来源开关与报价由growth自己的`data/definitions.json`管理；金额不写进narrative。具体字段以手册实际核对结果为准

## 版本、兼容与独立性界限

2e没有生产代码、规则数据、生成算法、放置规则、实质RNG、Game字段或持久格式变更。foundation=3、manifest.schema=1；narrative module/rules=1.2.0、data schema=1、state=3、input=2；growth module/rules=1.5.0；存档/录像version=2，whole-run schema=`brogue-web-whole-run-v2`；立绘schema=1/displayVersion=1.0.0。规则包精确指纹随mechanical JSON变化；图片像素/显示manifest/文案变化不等于规则版本变化，definitions.json内的引用变化仍属机械包变化。

每局模块集合固定，选择不同组合须新建局。读取按存档/录像自己的完整manifest重建；模块缺失、版本/规则指纹/底座不匹配严格拒绝，不剥离状态、不迁移旧档、不承诺旧引擎可读D4的`arcana:risk-confirm`动作。2e无机械变更，兼容同一2d精确包；这不代表任意历史版本兼容。未来阶段3–5与32组合尚不存在，未声称验证。

## 覆盖分层与剩余限制

- §12.2：schema/kernel/sessions测试负责严格形状、引用/预算/条件/effect/收据恶意输入；实际Game坏档/坏录像不退休旧局见runtime，模块/基础发现与边界守卫另验证所有权。不是把每个纯schema负例都称作浏览器实测。
- §12.3：世界候选/交互线、引擎冻结和失效令牌由基础world与narrative runtime/UI自动测试负责；真实物理触摸、可靠物理held/window-blur序列仍未实测。
- §12.4：默认四子集及删除后的2+2+1子集smoke是实际Game新局/游玩/save/load/step/seek/续录；本次新normal用例补足全部四个对话持久切点。可选奖励合法报价/反注册顺序/失败回滚由已有实际Game+诊断growth配置和provider事务夹具分层覆盖；默认内容仅一个节点，不能声称自然样例覆盖后续多节点剧情。
- §12.5：2d既有六尺寸/模式实际像素、320英文caption修复与食物/部分诊断风险路径保留原报告证据。本轮是否有相同构建字节及新增浏览器结果在下节单列，不把SFC、无图fixture或headless Game叫做手工UI覆盖。
- 尚未提供真实立绘素材；无外部图生成/下载。本轮不实现自由文本/LLM对话、任意脚本、任务物品/商店、关系大系统、可战斗/移动NPC、背包/地形/传送/阵营等重世界效果或多格单位。当前storyFact单消费者合同不扩充成未来多消费者分配协议。
- 建议下一步先由维护者验收阶段2，再按需提供真实素材/扩充数据样例、补真实触摸/held/blur与完整UI持久化路径；需要新增重联动或阶段3时先单独设计授权，不自动开工。

## 最终候选门禁与浏览器记录

冻结候选输入SHA256：`9feb164305659bc1b0c7212f600e674669c2339ef2f341d5ee521ecb8d61dc95`（2085个输入）。正常树、三份删除副本的实际前后hash均相同；所有门禁在此冻结树完成。Node24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`；原有4.9MiB CE缓存保留并复制，不隐藏缓存制造skip。无生成改动，不跑test:drift；不ce:fetch/test:full/test:gen。

### 正常树 full 档

| 实际命令 | 结果 | 耗时秒 | 退出码 |
|---|---|---:|---:|
| `node scripts/check-module-boundaries.mjs` | 通过 | 5.56 | 0 |
| `npx vue-tsc -b` | 通过 | 23.26 | 0 |
| `npm run build` | 通过 | 30.42 | 0 |
| `npm run test:ext -- --maxWorkers=2` | 66文件1284 passed，0skip/todo/fail | 364.30 | 0 |
| `node scripts/check-module-composition-smoke.mjs --engine-only --output=<外部证据文件>` | 空/growth/narrative/两者四子集全部真实Game新局/游玩/save/load/逐条replay/seek/续录通过 | 8.14 | 0 |
| `npm test -- --maxWorkers=2` | 317文件5887 passed，8历史skip、5历史todo，0fail；完整仓库套件只运行一次 | 2360.43 | 0 |

未拿定向拼接代替完整npm test。新增正常模式持久测试包含于上述ext/full及保留narrative的删除ext中；早期专项2/2通过属于开发验证，不代替最终门禁。

### 实际物理删除 removal 档

实际命令：`node scripts/check-module-removal.mjs --profile=removal --engine-only --maxWorkers=2 --output=<仓库外新证据目录>`。三个独立副本确实删除整个模块目录与自有数据/测试，清理TS/Vite缓存重新发现；不保留空壳、不更改剩余清单、不新增skip。三份副本均保留CE缓存。每行按boundary/type/build/剩余全部ext/全部剩余子集smoke执行；没有重复完整npm test。

| 实际保留目录 | 实际删除文件/自有测试 | 剩余ext | boundary/type/build/ext/smoke秒 | 子集 |
|---|---:|---|---|---:|
| growth | 36/8 | 58文件1100 passed，0skip/todo/fail | 3.83 / 21.90 / 40.57 / 299.17 / 5.24 | 空、growth（2） |
| narrative | 62/32 | 34文件668 passed，0skip/todo/fail | 3.92 / 21.27 / 30.33 / 200.58 / 4.78 | 空、narrative（2） |
| 无 | 98/40 | 26文件494 passed，0skip/todo/fail | 3.80 / 19.30 / 26.27 / 190.03 / 4.37 | 空（1） |

每个实际命令exit0；删除前输入均等于正常冻结hash，删除后输入分别`77f2f20ad990c78bac8196c1bed89318ce9d24398861ae1ef17949f63d2f1742`、`fcb09326a4be9384c5ee8045c94ee098b0149903d5d75ca35333c37ae3824433`、`b218cb7a907fe2e94c45e32864bb107452337c618a3b67c1332c7abd53ea9620`，门禁结束不变。

删除工具返回`partial-browser-not-verified`，准确表示选择engine-only；不能把工具状态改写成自身做了浏览器。后续同字节浏览器结果独立列于下一节。正常full是外部另行实际完成，不修改删除报告中normalFull未包含的事实。

真实旧档补证使用正常树原样生成的四份save/recording，seed8201、normal模式，narrative组合处于active会话。四构建×四来源共16格，每格分别load save/load recording：保留所需模块9格接受，缺模块7格拒绝；所有被拒输入保持player/runtime引用、完整机械与录制快照、双RNG不变，不静默丢块。第一版外部探针将预期错误文案也计为状态变化而exit1；逐叶诊断仅`run.logger.messages.0`与`run.logger.nextId`变化。改正探针将显示logger单列后，四构建全部通过（5.82/6.07/5.34/4.74秒、exit0），原失败记录保留。没有改生产代码或弱化机械/录制断言；完整npm test是在此补证完成后才开始。

### 构建字节与实际浏览器

四份新dist逐文件path/hash/size与2d最终第三候选完全一致。构建集合hash：normal=`bf88ea48fa901c7eaa23943b275c700587d981fbe2482d9501972d5ee1cff07e`；without-growth=`c7a81a6bdf6c9bfb1fd613f1ac15aa0d5a6606cbe159fa82796318eda3c8b7d0`；without-narrative=`66ea95d7342765a3f02b8411a0af4f705d14e1430ad7de6e4c977f2559294218`；without-modules=`c23af5090fed358446e1868bc6f64359b8ec2da3e1a87dfb97d066d54dc6c2cf`。这些是字节对等证据，不是重新点过界面的证据。

2e QA归档SHA256=`829c00dd45f482990ec770d7a1f3183668e9d7151e0611e6fec687b5e3faa30f`，97个文件全部核对；只含四份构建、配置计划和已有smoke/服务辅助，不含截图。Mac不安装依赖、不构建、不跑全量测试。

- 云端默认Chromium154.0.8037.57探针因`socket() failed: Operation not permitted`/SIGABRT及crash路径只读未启动，没访问产品、没改安全参数绕过限制，不算产品失败或浏览器通过。
- 初次Mac任务本回合没有浏览器工具，0/9未运行且关闭临时端口。随后另起受支持任务恢复浏览器工具；前次缺工具结果没有被隐去或记为产品失败。
- 实际完成者：Mac任务`01a107bc-f872-773d-8791-1be8b26c3027`，turn `01a107bd-05c5-7153-b038-26e5baa9cd67`；使用Codex In-app Browser、官方cua_repl CDP。报告未记录浏览器版本/UA/viewport/DPR，因此不借用2d元数据。
- 新2e **9/9 built-engine browser loops通过**（4/2/2/1，0fail、0未运行）：在真实构建页面对activeGame调用现有smoke函数，逐格exactCheckpoints/saveLoad/replaySeek/continuation均true。空/narrative为2→3事件，含growth为3→4；每格最终tick300、turn3、depth1、位置(4,3)。双RNG算法`brogue-web-ranval32-uint64-level-v2`、version2、current0，调用数2618/161；精确两流状态保存在本地报告。缺模块输入拒绝保持player/runtime/RNG。按build/modules索引，不虚构独立case ID。
- 浏览器本地报告SHA256=`8524fce90ed33713f7e1a62436df4b999d9d4f5b935b36b24d73fb787b13ddbf`；97归档文件复核未变，临时5430–5433服务和QA页已关闭，viewport已复位。

新9格是实际浏览器中的引擎驱动持久化冒烟，**不是九组菜单/对话按钮/文件选择器的完整UI操作循环**。本轮没有重拍像素；2d已验收的六布局与英文320修复使用上述完全相同生产字节，仍准确标为2d证据。真实触摸、可靠物理held/window-blur、D4熔岩aim后No、九组完整UI持久化循环仍未实测。2d自然对话与诊断成长风险场景的边界继续以原报告为准。没有真实立绘资产，本轮不声称图像素材接入验收完成。

### 交付封存

门禁后只回填本报告的已发生结果、browser边界和hash；其它六个变更路径与生产/测试/脚本/数据保持冻结候选原字节。外部封存记录保留回填前后文件差集与最终hash，不把报告文字回填冒称重新跑过完整套件。原始日志、真实存档/录像、所有输入hash清单与QA资料留仓库外；仓库只收精简实际命令/结果和配置手册。

阶段2候选交付完成，等待维护者最终验收。只提交`ext/foundation`；不合main、不打tag、不部署，不启动阶段3。
