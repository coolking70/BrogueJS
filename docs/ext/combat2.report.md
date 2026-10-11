# combat2 实施报告

结论：**部分完成，尚未验收通过**。五招数据、玩家执行和自有UI已实现；029全批150通过/5失败，最终UI与守卫修复复测112项通过，九组合9/9、drift14项通过。保留真实共享SDK失败及自然证据缺口，不继承任务包§A或5Z的通过数。下文是本实例的实际命令、源身份和证据。

## 基线、环境和范围

- 代码基线：`59b9ba691daf66819eeea0299a0539f3641ad208`。
- 派发 tip：`5782e73015c8d0caa81b8b31501706bb2a1fb774`；相对代码基线只增加 `docs/ext/combat2.dot-package.md`。
- 起始工作树干净；从 `origin/ext/combat2-base` 创建 `ext/combat2`。普通 fetch 的 refspec 只取 main，因此另做明确的 base ref 读取，没有修改 fetch 配置。
- 工作目录 `/workspace/BrogueJS`；Node `v24.19.0` 位于 `/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin`，PATH前置；`NODE_OPTIONS=--max-old-space-size=3072`；所有 Vitest 显式 `--maxWorkers=1`，验证串行。
- 代码与文档写入限于 `src/ext/modules/combat/**`、`docs/ext/combat-config.md`、本报告。共享源码、其他模块、任务包、README/HANDOFF、共享测试登记未修改。会话此前按明确授权建立单host HTTPS的gh认证接入；实施阶段未再改认证配置或脚本，没有提取凭据。
- 仓库外原始证据统一放在 `/tmp/combat2-evidence/`。没有进入或操作 BrogueJS-p5。

## 内容与冻结合同

从任务包的两个标记块直接提取原表及装配器执行，完整数据由真实 loader、工厂和 descriptor 验证。保留原三招、四profile、三绑定，以及资源、闪避、弹反、篝火整个对象的原值与顺序。新增五招、六profile、五绑定，玩家使用 `combat.second-profile`；旧 `fixture.profile` 仍保留三招。

当前为 **8 attacks / 10 profiles / 8 nativeProfiles**；1资源策略、1篝火，总定义数20。玩家八招加 dodge/parry 共10动作，篝火另计。指纹为 `sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae`。

| 招式 / 新NPC | 费 | 前摇 | 段delay / 释放刻 | 恢复 / 总长 | poise / parryable | 形状 |
| --- | ---: | ---: | --- | --- | --- | --- |
| 沉锚击 / zombie | 8 | 140 | 0 / 140 | 90 / 230 | 8 / false | 前扇三格加第二格 |
| 回潮扫 / goblin | 7 | 100 | 0,80 / 100,180 | 70 / 250 | 3,3 / true,true | 前扇，后反扇 |
| 逐隙刺 / jackal | 6 | 80 | 0,60,60 / 80,140,200 | 60 / 260 | 2,2,3 / true,true,true | 第一、第二、第三格分别一段 |
| 掷影击 / monkey | 5 | 120 | 0 / 120 | 80 / 200 | 2 / false | 第二与第三格，近身空带 |
| 应隙斩 / toad | 3 | 30 | 0 / 30 | 50 / 80 | 3 / true | 正前一格 |

八向显式坐标及默认完整资源/篝火字段见更新后的配置手册；40个真实Game八向用例以独立扇形/反向/向量预期核对当前锁格及释放刻。全部新段仍是 native-melee、part、locked-world、whole-group、line-of-effect、dodgeable=true、friendlyFire=false、cancel-pending。高韧性冲击不增HP倍率。

下表坐标相对来源足迹；沉锚击取前扇∪2v，回潮扫依次取前扇及反向前扇，逐隙刺依次取v/2v/3v，掷影击取2v∪3v，应隙斩取v。反向为n↔s、e↔w、ne↔sw、se↔nw，不做浮点旋转。

| 朝向 | v | 前扇三偏移 |
| --- | --- | --- |
| n | (0,-1) | (-1,-1),(0,-1),(1,-1) |
| e | (1,0) | (1,-1),(1,0),(1,1) |
| s | (0,1) | (1,1),(0,1),(-1,1) |
| w | (-1,0) | (-1,1),(-1,0),(-1,-1) |
| ne | (1,-1) | (0,-1),(1,-1),(1,0) |
| se | (1,1) | (1,0),(1,1),(0,1) |
| sw | (-1,1) | (0,1),(-1,1),(-1,0) |
| nw | (-1,-1) | (-1,0),(-1,-1),(0,-1) |

玩家可用原三招及五新招；新NPC每种仅配置对应单招。五招由满池出招后的余额依次20/20/21/23/23，包含恢复，不能据此推算收费。测试分别在commit边界证明8/7/6/5/3一次费用，并核对exact-cost、差1与挥空。

所有招式原地执行。逐隙刺只延伸危险格；掷影击没有弹体/弹药，不在中间生物处停止；应隙斩可独立使用，也可在弹反恢复后另付体力手动使用。弹反没有自动反击，三格外的可弹反标记不越过默认contactRange=1。NPC依然经过原生prelude，首段覆盖目标才可启动；猴子贴身可回退普通近战。没有改巨兽原有profile来宣传新巨兽技能。

冻结身份保持：combat module/rules/COMBAT_VERSION1.6.0，pack1、正式state4、foundation13、whole-run6、recording4、origin2、world5 schema4和SDK兼容号1。没有增加第二时钟、状态字段、命令参数或其他模块的数据绑定。

## 覆盖口径

| 合同 | 本次文件与证据 |
| --- | --- |
| C2-DATA/IMPORT | `combat2_content`：完整装配深等、8/10/8、旧前缀及对象、loader/工厂/descriptor同身份、20严格负例、模块私有导入检查；精确装配器和旧表在自有support/fixtures。 |
| C2-SHAPE/ACT | `combat2_runtime`：五招八向真实锁格、原生接触、段释放和满池余额，五挥空、墙/图界/中间生物、五NPC真实就绪选择、首段门与猴子fallback。 |
| C2-RESOURCE | 同文件：commit中途一次费用、exact-cost/少1、No/忙态/陈旧plan，全世界与双流/ID拒绝保持。容量、固定余数和默认策略沿直接回归补证。 |
| C2-DEFENSE/CANCEL | `combat2_defense_cancel`：段属性、接触距离、正反朝向、窗口剩1/0、无普通命中骰及无免费反击；来源死/强制位移/失能/破防和目标移开。其余来源转换/离层/反伤细节按实际直接回归结果列明。 |
| C2-BODY | `combat2_body`：共享productionComposite支撑的明确诊断fixture，合法providerProfileId映射新逐隙刺；四来源独立收费、核心一时钟、全群排除、部位退休、核心破防、真实部位接触去重与传导。它不是巨兽生产配置。provider错误回滚与fallback互斥由直接回归补证。 |
| C2-GROWTH | `combat2_growth`：公开合法角色创建/equip/use，真实Stat容量不免费补满、不改招式费；每次physicalResolved一次，measured-strike在原生解算前分别扣2专注与一次native体力；体力不足及失效目标全事务保持。`combat_native_stamina`补专注不足及异常双资源回滚，通用actorActions补No事务；成长技能的专门No场景未单列。没有导入growth实现或写其私有state。 |
| C2-PERSIST | `combat2_persistence`：正式state4/actorActions，五招真实命令保存及后缀、完整replay、非单调seek、完整origin续录；坏锁格/段/profile/镜像/预算拒绝；实施前真实旧指纹输入和真实新招缺包负例。自然安全阶段由自然验证补证。 |
| C2-UI | `combat2_ui`：18个SSR/组件与真实Game命令用例，十按钮/i18n/时间/费用/限制，方向返回取消和实际确认，重叠/未知信息；不将这些测试冒称浏览器。 |
| C2-NAT/COMBO | `combat2_natural`、`combat2_links`、`combat2_combinations`：自然控制器、五NPC/五招命中、normal短局、巨兽目标/growth技能、九行真实新局与持久化；结果依下文实际证据。 |

## 持久化比对方法

机械对象使用完整 `Game.toSnapshot()`，只归一化 `savedAt=0`。原生世界、当前与缓存层、HP/可见性、消息归档、全部扩展state、actorActions、nextEntityId、双RNG全状态与调用数均保留。紧凑摘要是整个该对象的native-number canonical SHA-256，不删摘要叶来隐去差异。

真 `toSaveSnapshot` 保留 `recordingOrigin`，加载到新Game后比较完整机械对象；按原public输入继续后缀和原事件前缀，再执行新wait并完整回放续录。续录仅按既有 `continuingPrefix` 规则比较先前末事件的fullCheckpoint边界转换，没有手改原manifest、checkpoint或origin。逐事件replay检查error及已有机械检查点；非单调seek检查完整捕获切点和游标。事件0来自真实header入口的只读捕获，initialCommands仍是录像事件。

实施前的真实旧包输入由临时 `combat2_capture` 在修改数据前取得：旧save 1,972,565字节，recording2,667字节，位于 `legacy/`。核心验证实际使用这两份输入；独立checkout可由旧表、loader和工厂重建等价的真实旧输入。临时capture测试及登记已删除，原始大文件不提交。

诊断回放通过共享 `installRecordingScene` 在正式origin捕获前重建同一场景；自然路线没有布景、怪物/HP/资源/装备/RNG/AI/计时写入。动画关闭不关闭机械时间。

## 自然搜索、组合、UI与删除计划

自然种子按1…32，必要时33…128顺序一次扩展；每seed≤2500公开命令、战斗≤300、D8上限和64无进展停止。方向n/e/s/w/ne/se/sw/nw、平局y/x/id；瞄准仅用当前可见敌人。寻楼梯使用全地图BFS，明确为“引擎路线器可知地形”，不称玩家可见地形策略。食物和growth角色/技能均走公开命令。

首轮长捕获曾被作者中断；逐命令探针证明原路线继续正常推进，未确认底座死锁。探针保留到seed11/D3/141命令，超时exit124。随后移除无敌人时多余的40次只读prepare查询，并使手动反击仅依本局成功弹反；保留完成的seed1…11，继续后续种子，没有以引擎/持久化断言失败换seed。这个中断不是功能通过，也不是SDK缺陷证明。

九相关组合精确为[]、[combat]、combat分别配crafting/foraging/giants/growth/narrative/settlement，以及七模块全开；不称64/128子集覆盖。含growth使用skirmisher/human/unaffiliated、human agility+1和measured-strike，revision每次取通用readModuleView。每行自然命中与五新招、save后缀/fullreplay/seek0中末/续录分别核对。

删除只执行任务包精确 `--plan --profile=removal --retain=crafting,foraging,giants,growth,narrative,settlement --engine-only --maxWorkers=1`。实际计划及条目见下文；不删除目录，不运行prepare-only，normal full required/not-run不得称通过。

UI矩阵是1440×900、390×844、320×844，普通/沉浸与original/refined/hanzi/tiles。实际浏览器、触摸模拟、组件和未验项见下文。真实设备和独立审查没有实际安排，不冒称作者自检为独立审查。

## 首次失败、自行决定与接续

- 首次types exit2为新测试使用目标lib不支持的Array.at；后续新增测试另有未用import、错误Terrain导出、readonly坐标和遗漏type import，均只修自有测试。
- 首次runtime 62通过/1失败：以猴子回合末已恢复的体力判断原生攻击付费，改为实际原生调用观测后定向通过。
- 首次UI17通过/1失败：SSR只初始化$t实例，遗漏组件直接调用的全局i18next；补齐真实翻译初始化，18项通过。
- 首次七文件核心124通过/15失败：自有诊断target未就绪、跨越调度边界、覆盖而未保留原有body attackProfiles；修正版后body3项通过，defense/growth21项通过。随后3个弹反断言错误地期待普通native适配器被调用；实际上防御在调用前拦截，修为零调用并保留HP/RNG/成功弹反/费用断言。所有首次exit和日志保留。
- 旧自有测试前提的反事实与修订，在实际失败和临时生产回退验证后逐项列明；未执行的不能记为已通过。
- 自行决定：静态UI helper显式映射hint，时间从已校验自有包读取；新增本模块纯测试support与真实Game观察器；紧凑trace只含输入/关键索引/出生/命中/完整机械摘要；原始录像、搜索日志、截图留仓库外；浏览器端口独立于p5。均未改变C2-D01…D06的数值或范围。
- C2-D01…D06按已派发任务包执行；维护者保留最终签认。独立审查未执行，最多两轮的上限没有被当成自动循环授权。

下文分别列出已确证功能缺陷、证据缺口和集成待验。未运行完整npm test、全部test:ext、旧64组合整文件、128子集、实际删除、CE fetch/full/gen；不隐去CE缓存制造skip，不修改共享黄金trace。



## 实际验证记录

完整 stdout/stderr、UTC起点、源散列、命令和退出码在 `/tmp/combat2-evidence/commands.jsonl` 与编号日志。每个源散列按路径排序，对 src/scripts/package.json/package-lock.json 的已跟踪及自有未跟踪文件逐字节计算；命令还列出 vitest.config.ts，但本仓库实际测试配置在 vite.config.ts，后者单独与tip核对字节相同，散列另列。文档不影响源散列。早期001…010仅含已跟踪文件，其身份不能冒称完整候选。以下次数有重叠，不相加为独立套件通过数。

|编号|exit|秒|Tests 最终摘要|source SHA-256|
|---:|---:|---:|---|---|
|001|0|7.436|1 passed (1)|`d34f39d6aafd3a1477e96ffff9237ceb19b138b782243f3fa33fadcce8744ee1`|
|002|0|1.546|30 passed (30)|`be8656305d8ad84e308cef65990a567d8b9ce4a8ed42f2ac0f2f8fd7f2d3aded`|
|003|0|6.782|非用例命令/未取得用例摘要|`be8656305d8ad84e308cef65990a567d8b9ce4a8ed42f2ac0f2f8fd7f2d3aded`|
|004|2|29.912|非用例命令/未取得用例摘要|`be8656305d8ad84e308cef65990a567d8b9ce4a8ed42f2ac0f2f8fd7f2d3aded`|
|005|1|91.163|1 failed | 62 passed (63)|`8d5871f0c18a3ce3aab56e170ad47518f3c0dd3692fb634f716df9eb6c15aac1`|
|006|0|8.654|1 passed | 62 skipped (63)|`c16ebb0c3e45e76324a6a02538e221a37c011c23119b7d16acafb6a1fc825275`|
|007|1|29.503|1 failed | 17 passed (18)|`c16ebb0c3e45e76324a6a02538e221a37c011c23119b7d16acafb6a1fc825275`|
|008|2|29.644|非用例命令/未取得用例摘要|`b5afa0d2c566c4ae0fdfef0518bdb5f68ce8dc609f9705f283c0f0c592cd6651`|
|009|1|552.57|(1)|`ab8a2554c0ba4ce539d33b62e2018692e990ad835effd4566a2ce717968e963f`|
|010|2|30.463|非用例命令/未取得用例摘要|`b468e561fe0af76bbeac2a2c8881d44d59a7c8bb72f6924bd0e3a04254911f0b`|
|011|124|120.008|非用例命令/未取得用例摘要|`c54afddbbce807389b36ce1b2dbec1f300cff113ead81fd8c4ca850916272699`|
|012|0|30.561|非用例命令/未取得用例摘要|`d208ee899043d209a4f96c4b46a5f96e9269784a7d0abdb2a4aa50ff6ded2758`|
|013|1|187.803|15 failed | 124 passed (139)|`a833763e15082a4142f6cafcf4a523a7dc7f9a8a6ee2148d8dbc67be214e0565`|
|014|1|29.234|3 failed | 14 passed (17)|`abc88281f546ef4f92e65597367e396044c4012f61c64b0c17ac20f8f22089bd`|
|015|0|36.253|21 passed (21)|`faaf477d37df861e4168511f343fd71dc5e774688d1a67c1ff69ea542a2e3380`|
|016|1|1042.634|1 failed | 1 passed (2)|`5bf208a57879b0235c790e3419a43248962be68e097fe08733cf506fde5ebfc2`|
|017|1|0.629|非用例命令/未取得用例摘要|`6271deb4eb83f42561ec3a168e51cc9e7af749fdd133020f359661407a5df9c7`|
|018|1|0.625|非用例命令/未取得用例摘要|`6271deb4eb83f42561ec3a168e51cc9e7af749fdd133020f359661407a5df9c7`|
|019|1|25.47|1 failed (1)|`407a9bec332a951470560b5f20dfbdb69a75c765d7bb25bfcb2f041af337c252`|
|020|1|441.782|3 failed | 500 passed (503)|`94b436aea1258ee65286b58a3014e1dc19a0ade68e01965a5f0569cabb538e44`|
|021|0|2.808|134 passed (134)|`54219886b46d4d03d91ebb6b3e5e9710b172e4480df27e85ceb8593dfb0361a3`|
|022|1|320.303|1 failed | 143 passed (144)|`86ac826dd99bfb819a63ec8abd2cfc2c10b9c807bf4be2d0021f4aecc33a48e1`|
|023|1|8221.39|1 failed (1)|`bb4e301cf52c3b074aec688aff9bc9d8dd234e431e8710d5a3b3237196b36ed6`|
|024|1|85.148|1 failed | 1 passed (2)|`9264b21b5e50e87b09273ace682a382a439479f43aa43b109b949d7f5102893e`|
|025|1|34.623|1 failed (1)|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|026|0|6.7|非用例命令/未取得用例摘要|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|027|0|31.059|非用例命令/未取得用例摘要|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|028|0|41.627|非用例命令/未取得用例摘要|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|029|1|1617.382|5 failed | 150 passed (155)|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|030|0|5.333|64 skipped (64)|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|031|1|250.861|1 failed | 265 passed (266)|`9c1d6c96327942ca1ac9ea3d748215117966ccac4cb0322d86dfaa5fb4be25fa`|
|032|0|390.729|14 passed (14)|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|033|0|0.072|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|034|0|0.007|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|035|0|6.924|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|036|0|32.508|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|037|0|41.033|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|038|0|5.207|64 skipped (64)|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|039|0|51.602|112 passed (112)|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|040|0|0.007|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|041|0|5.18|64 skipped (64)|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|042|0|5.321|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|043|0|30.225|1 passed | 63 skipped (64)|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|
|044|1|0.442|非用例命令/未取得用例摘要|`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`|

逐项实际命令（task_flags仅是本任务测试开关，不含认证环境）：

**001** 2026-10-11T00:42:55.757763+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_capture.test.ts --maxWorkers=1
```
**002** 2026-10-11T00:45:20.233544+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_content.test.ts --maxWorkers=1
```
**003** 2026-10-11T00:45:36.116660+00:00；`{}`
```bash
node scripts/check-module-boundaries.mjs
```
**004** 2026-10-11T00:45:54.005814+00:00；`{}`
```bash
npx vue-tsc -b
```
**005** 2026-10-11T00:49:18.560344+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_runtime.test.ts --maxWorkers=1
```
**006** 2026-10-11T00:53:16.380210+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_runtime.test.ts --maxWorkers=1 -t 'advancing-point cannot start'
```
**007** 2026-10-11T00:55:41.095879+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_ui.test.ts --maxWorkers=1
```
**008** 2026-10-11T00:58:23.515008+00:00；`{}`
```bash
npx vue-tsc -b
```
**009** 2026-10-11T01:00:09.335438+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_natural.test.ts --maxWorkers=1
```
**010** 2026-10-11T01:09:26.340277+00:00；`{}`
```bash
npx vue-tsc -b
```
**011** 2026-10-11T01:10:30.245089+00:00；`{}`
```bash
timeout --signal=TERM 120s npx vitest run src/ext/modules/combat/tests/combat2_natural.test.ts --maxWorkers=1
```
**012** 2026-10-11T01:12:56.313282+00:00；`{}`
```bash
npx vue-tsc -b
```
**013** 2026-10-11T01:14:00.717512+00:00；`{'COMBAT2_PREIMPLEMENTATION': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_content.test.ts src/ext/modules/combat/tests/combat2_runtime.test.ts src/ext/modules/combat/tests/combat2_defense_cancel.test.ts src/ext/modules/combat/tests/combat2_body.test.ts src/ext/modules/combat/tests/combat2_growth.test.ts src/ext/modules/combat/tests/combat2_persistence.test.ts src/ext/modules/combat/tests/combat2_ui.test.ts --maxWorkers=1
```
**014** 2026-10-11T01:17:45.479884+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_defense_cancel.test.ts src/ext/modules/combat/tests/combat2_body.test.ts --maxWorkers=1
```
**015** 2026-10-11T01:18:42.708433+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_defense_cancel.test.ts src/ext/modules/combat/tests/combat2_growth.test.ts --maxWorkers=1
```
**016** 2026-10-11T01:19:29.652795+00:00；`{'COMBAT2_CAPTURE': '1', 'COMBAT2_FIRST_SEED': '12'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_natural.test.ts --maxWorkers=1
```
**017** 2026-10-11T01:38:15.078741+00:00；`{'COMBAT2_REPRODUCE': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_sdk_repro.test.ts --maxWorkers=1
```
**018** 2026-10-11T01:38:22.829724+00:00；`{'COMBAT2_REPRODUCE': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_sdk_repro.test.ts --maxWorkers=1
```
**019** 2026-10-11T01:38:30.183639+00:00；`{'COMBAT2_REPRODUCE': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_sdk_repro.test.ts --maxWorkers=1
```
**020** 2026-10-11T01:39:38.732415+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_schema.test.ts src/ext/modules/combat/tests/combat_runtime.test.ts src/ext/modules/combat/tests/combat_display.test.ts src/ext/modules/combat/tests/combat_ui.test.ts src/ext/modules/combat/tests/combat_warning_map.test.ts src/ext/modules/combat/tests/combat_native_stamina.test.ts src/ext/modules/combat/tests/combat_defense_state.test.ts src/ext/modules/combat/tests/combat_parry.test.ts src/ext/modules/combat/tests/combat_parry_ui.test.ts src/ext/modules/combat/tests/combat_parry_advisory.test.ts src/ext/modules/combat/tests/combat_scheduler_due.test.ts src/ext/modules/combat/tests/combat_part_break_runtime.test.ts src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts src/ext/modules/combat/tests/combat_square_replay.test.ts src/ext/modules/combat/tests/combat_adapters.test.ts src/ext/modules/combat/tests/combat_dodge.test.ts src/ext/modules/combat/tests/combat_dodge_ui.test.ts src/ext/modules/combat/tests/combat_native_defense.test.ts src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts src/ext/modules/combat/tests/combat_body_transition_facts.test.ts src/ext/modules/combat/tests/combat_part_break.test.ts --maxWorkers=1
```
**021** 2026-10-11T01:47:57.613810+00:00；`{'COMBAT2_GATE_ROOT': '/tmp/combat2-evidence/counterfactual/tree'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_schema.test.ts src/ext/modules/combat/tests/combat_part_break.test.ts --maxWorkers=1
```
**022** 2026-10-11T01:48:18.963427+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_schema.test.ts src/ext/modules/combat/tests/combat_part_break.test.ts src/ext/modules/combat/tests/combat2_sdk_repro.test.ts src/ext/modules/combat/tests/combat2_combinations.test.ts --maxWorkers=1
```
**023** 2026-10-11T01:54:28.085998+00:00；`{'COMBAT2_REVISIT': '1', 'COMBAT2_CAPTURE_LINK': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_links.test.ts --maxWorkers=1
```
**024** 2026-10-11T04:12:45.771164+00:00；`{'COMBAT2_CAPTURE_EVASION': '1', 'COMBAT2_CAPTURE_REVISIT': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_evasion.test.ts src/ext/modules/combat/tests/combat2_revisit.test.ts --maxWorkers=1
```
**025** 2026-10-11T04:16:22.158313+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_evasion.test.ts --maxWorkers=1
```
**026** 2026-10-11T04:17:27.457065+00:00；`{}`
```bash
node scripts/check-module-boundaries.mjs
```
**027** 2026-10-11T04:17:34.247877+00:00；`{}`
```bash
npx vue-tsc -b
```
**028** 2026-10-11T04:18:05.400479+00:00；`{}`
```bash
npm run build
```
**029** 2026-10-11T04:18:47.120951+00:00；`{'COMBAT2_PREIMPLEMENTATION': '1'}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_content.test.ts src/ext/modules/combat/tests/combat2_runtime.test.ts src/ext/modules/combat/tests/combat2_defense_cancel.test.ts src/ext/modules/combat/tests/combat2_body.test.ts src/ext/modules/combat/tests/combat2_growth.test.ts src/ext/modules/combat/tests/combat2_persistence.test.ts src/ext/modules/combat/tests/combat2_ui.test.ts src/ext/modules/combat/tests/combat2_sdk_repro.test.ts src/ext/modules/combat/tests/combat2_evasion.test.ts src/ext/modules/combat/tests/combat2_revisit.test.ts src/ext/modules/combat/tests/combat2_combinations.test.ts src/ext/modules/combat/tests/combat2_natural.test.ts src/ext/modules/combat/tests/combat2_links.test.ts --maxWorkers=1
```
**030** 2026-10-11T04:45:44.598959+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t '(^|\s)combat: real commands, every checkpoint' --maxWorkers=1
```
**031** 2026-10-11T04:45:50.030373+00:00；`{}`
```bash
npx vitest run src/test/phase3a0_actor_action.test.ts src/test/phase3a0_scheduler.test.ts src/test/ext_actor_actions_root_world.test.ts src/test/ext_stats_native.test.ts src/test/ext_stats_pipeline.test.ts src/test/ext_stats_runtime.test.ts src/test/ext_stats_review.test.ts src/test/phase4a3_body_display.test.ts src/test/ext_world_display.test.ts src/test/ext_recording_v4_snapshots.test.ts src/test/u_03_whole_run_snapshot.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=1
```
**032** 2026-10-11T04:50:00.985875+00:00；`{}`
```bash
npm run test:drift -- --maxWorkers=1
```
**033** 2026-10-11T04:56:31.806929+00:00；`{}`
```bash
node scripts/check-module-removal.mjs --plan --profile=removal --retain=crafting,foraging,giants,growth,narrative,settlement --engine-only --maxWorkers=1
```
**034** 2026-10-11T04:56:31.970229+00:00；`{}`
```bash
git diff --check
```
**035** 2026-10-11T04:56:50.132711+00:00；`{}`
```bash
node scripts/check-module-boundaries.mjs
```
**036** 2026-10-11T04:56:57.151487+00:00；`{}`
```bash
npx vue-tsc -b
```
**037** 2026-10-11T04:57:29.749170+00:00；`{}`
```bash
npm run build
```
**038** 2026-10-11T04:58:10.873061+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t '(^|\s)combat: real commands, every checkpoint' --maxWorkers=1
```
**039** 2026-10-11T04:58:16.173570+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat2_ui.test.ts src/ext/modules/combat/tests/combat_ui.test.ts src/ext/modules/combat/tests/combat_parry_ui.test.ts src/ext/modules/combat/tests/combat_parry_advisory.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=1
```
**040** 2026-10-11T04:59:07.865324+00:00；`{}`
```bash
git diff --check
```
**041** 2026-10-11T04:59:57.842368+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t 'combat: real commands, every checkpoint, seek, continuation and corrupt-manifest preservation' --maxWorkers=1
```
**042** 2026-10-11T05:00:57.065046+00:00；`{}`
```bash
npx vitest list src/ext/modules/combat/tests/combat_combinations.test.ts --json --maxWorkers=1
```
**043** 2026-10-11T05:01:27.502084+00:00；`{}`
```bash
npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t ''"'"'combat'"'"': real commands, every checkpoint' --maxWorkers=1
```
**044** 2026-10-11T05:02:53.083539+00:00；`{}`
```bash
node /tmp/combat2-evidence/browser.mjs
```

## 自然搜索实测

combat-only原搜索完成1…22；seed23在第91个公开命令抛出底座守卫错误后停止，没有继续换seed。首轮中断/探针与后续继续的记录见上文和009/011/016，成功完成的旧prefix机械检查点保留。4/5 NPC自然释放仍缺zombie；已见出生不等于可到达释放。

|seed|depth|命令|停止原因|累计目标变化|
|---:|---:|---:|---|---|
|1|3|111|no-safe-stair-route|0/0/false/false → 4/1/true/true|
|2|5|219|no-safe-stair-route|4/1/true/true → 5/1/true/true|
|3|2|64|no-safe-stair-route|5/1/true/true → 5/2/true/true|
|4|2|114|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|5|3|151|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|6|3|181|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|7|3|155|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|8|3|102|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|9|3|112|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|10|3|141|no-safe-stair-route|5/2/true/true → 5/2/true/true|
|11|6|315|no-safe-stair-route|5/2/true/true → 5/3/true/true|
|12|5|1328|combat-limit-300|5/3/true/true → 5/4/true/true|
|13|1|5|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|14|5|233|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|15|3|154|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|16|2|51|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|17|3|84|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|18|3|150|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|19|4|211|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|20|1|3|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|21|2|76|no-safe-stair-route|5/4/true/true → 5/4/true/true|
|22|3|173|no-safe-stair-route|5/4/true/true → 5/4/true/true|

保留trace的原始录像均在仓库外；紧凑fixture仍逐公开输入核对完整机械散列，不改checkpoint。以下RNG为真实终点，算法统一 `brogue-web-ranval32-uint64-level-v2`、schema2、currentRNG0。

|seed/mode|事件/tick|原录像字节|实质/外观调用数|实质全状态 a,b,c,d|外观全状态 a,b,c,d|持久化结果|
|---|---|---:|---|---|---|---|
|1/wizard|111/9400|109806|314889/162|2375136646,1091314143,335696203,149249936|3954751084,3183114292,313824553,845799174|`{'result': {'events': 111, 'saves': 12, 'seek': [111, 0, 13, 1, 111], 'continuedEvents': 112, 'oos': 0}, 'evidence_time': '2026-10-11T04:30:01.029341+00:00（最终029本轮结果）'}`|
|2/wizard|219/19400|214287|553012/162|4083428294,3845567551,3071964822,3171083922|3693296867,1784734526,3212371100,3713721903|`{'result': {'events': 219, 'saves': 14, 'seek': [219, 0, 62, 1, 219], 'continuedEvents': 220, 'oos': 0}, 'evidence_time': '2026-10-11T04:34:23.429561+00:00（最终029本轮结果）'}`|
|3/wizard|64/5900|63498|317776/165|285376655,2141197624,2891407807,2936383447|3743919415,3322842154,109117171,335710893|`未取得完整验证结果，见实际失败日志`|
|11/wizard|315/26100|310330|825388/359|2174471419,2200058137,3392495173,3192631725|335835255,2624432155,786802842,1200862365|`未取得完整验证结果，见实际失败日志`|
|12/wizard|1328/99300|1321052|2918271/417|149447209,1613836581,2475930017,1028721982|1113210634,3358189353,3921647750,3231048454|`未取得完整验证结果，见实际失败日志`|

normal seed1：13事件、1100tick、14277字节；真实自然新招正伤害命中，持久化 `{'events': 13, 'saves': 3, 'seek': [13, 0, 8, 1, 13], 'continuedEvents': 14, 'oos': 0}`，证据时间2026-10-11T04:35:20.441599+00:00（最终029本轮结果）。这不构成普通模式长局平衡结论。


|NPC|seed/depth/sourceId|真实新招释放|
|---|---|---|
|jackal|1/1/27，creationReason=natural|`{'actionId': 3, 'sourceId': 27, 'sourceSubactionId': 1, 'attackId': 'combat.advancing-point', 'segmentIndex': 0, 'elapsed': 80, 'cells': [{'x': 39, 'y': 19}]}`|
|monkey|3/2/29，creationReason=natural|`{'actionId': 4, 'sourceId': 29, 'sourceSubactionId': 1, 'attackId': 'combat.cast-echo', 'segmentIndex': 0, 'elapsed': 120, 'cells': [{'x': 7, 'y': 22}, {'x': 7, 'y': 23}]}`|
|goblin|11/6/112，creationReason=natural|`{'actionId': 48, 'sourceId': 112, 'sourceSubactionId': 1, 'attackId': 'combat.returning-sweep', 'segmentIndex': 0, 'elapsed': 100, 'cells': [{'x': 47, 'y': 6}, {'x': 47, 'y': 7}, {'x': 48, 'y': 7}]}`|
|toad|12/4/96，creationReason=natural|`{'actionId': 109, 'sourceId': 96, 'sourceSubactionId': 1, 'attackId': 'combat.answering-edge', 'segmentIndex': 0, 'elapsed': 30, 'cells': [{'x': 34, 'y': 14}]}`|
|zombie|缺口|没有取得自然新招释放证据|

## 九相关组合实测

表中结果来自本次实际新局、原始manifest/initialCommands、完整机械比对和公开成长命令。没有枚举旧64/全部128组合。首轮022已通过九行，但其中早切点为0的行不足以证明非零earlier；最终记录以这里保留的最新结果及对应最终命令为准。

|模块|事件/tick/录像字节|存读/seek/续录/OOS|
|---|---|---|
|[]|4/400/5240|`{'modules': [], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': []}, 'trace': {'events': 4, 'tick': 400, 'bytes': 5240, 'reason': 'empty-module-short-run', 'commands': 4}, 'persistence': {'events': 4, 'saves': 3, 'seek': [4, 0, 2, 1, 4], 'continuedEvents': 5, 'oos': 0}}`；2026-10-11T04:36:49.993683+00:00（最终029本轮结果）|
|combat|17/1100/18532|`{'modules': ['combat'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}]}, 'trace': {'events': 17, 'tick': 1100, 'bytes': 18532, 'reason': 'combination-hit', 'commands': 17}, 'persistence': {'events': 17, 'saves': 7, 'seek': [17, 0, 13, 1, 17], 'continuedEvents': 18, 'oos': 0}}`；2026-10-11T04:37:23.749713+00:00（最终029本轮结果）|
|combat+crafting|17/1100/18686|`{'modules': ['combat', 'crafting'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'crafting', 'version': '1.0.0', 'rules': {'schema': 1, 'version': '1.0.0', 'fingerprint': 'sha256:fc1b8d11b7faf918331cf58895f135e11e67d397b5c88d1a08c5b2b679597fe1'}}]}, 'trace': {'events': 17, 'tick': 1100, 'bytes': 18686, 'reason': 'combination-hit', 'commands': 17}, 'persistence': {'events': 17, 'saves': 7, 'seek': [17, 0, 13, 1, 17], 'continuedEvents': 18, 'oos': 0}}`；2026-10-11T04:37:58.521740+00:00（最终029本轮结果）|
|combat+foraging|17/1100/18686|`{'modules': ['combat', 'foraging'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'foraging', 'version': '1.0.0', 'rules': {'schema': 1, 'version': '1.0.0', 'fingerprint': 'sha256:d2e0803474a80f1adfc41680351199da38b7f3e8129df3d58ffd0349488d936f'}}]}, 'trace': {'events': 17, 'tick': 1100, 'bytes': 18686, 'reason': 'combination-hit', 'commands': 17}, 'persistence': {'events': 17, 'saves': 7, 'seek': [17, 0, 13, 1, 17], 'continuedEvents': 18, 'oos': 0}}`；2026-10-11T04:38:32.565764+00:00（最终029本轮结果）|
|combat+giants|17/1100/18693|`{'modules': ['combat', 'giants'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'giants', 'version': '1.0.0', 'rules': {'schema': 1, 'version': '1.0.0', 'fingerprint': 'sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8'}}]}, 'trace': {'events': 17, 'tick': 1100, 'bytes': 18693, 'reason': 'combination-hit', 'commands': 17}, 'persistence': {'events': 17, 'saves': 7, 'seek': [17, 0, 13, 1, 17], 'continuedEvents': 18, 'oos': 0}}`；2026-10-11T04:39:06.897789+00:00（最终029本轮结果）|
|combat+growth|18/1200/20172|`{'modules': ['combat', 'growth'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'growth', 'version': '1.8.0', 'rules': {'schema': 1, 'version': '1.8.0', 'fingerprint': 'sha256:1278eaf53be3250203cac8c17b7c9cc12f97ebb1d61eafff05e24a5b13a8752c'}}]}, 'trace': {'events': 18, 'tick': 1200, 'bytes': 20172, 'reason': 'combination-hit', 'commands': 17}, 'persistence': {'events': 18, 'saves': 7, 'seek': [18, 0, 13, 2, 18], 'continuedEvents': 19, 'oos': 0}}`；2026-10-11T04:39:49.365818+00:00（最终029本轮结果）|
|combat+narrative|17/1100/18696|`{'modules': ['combat', 'narrative'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'narrative', 'version': '1.4.0', 'rules': {'schema': 1, 'version': '1.4.0', 'fingerprint': 'sha256:9ea296bd831838437026abda8ffec6bacf9f4b2edd104e6667eeec3b7b7067e8'}}]}, 'trace': {'events': 17, 'tick': 1100, 'bytes': 18696, 'reason': 'combination-hit', 'commands': 17}, 'persistence': {'events': 17, 'saves': 7, 'seek': [17, 0, 13, 1, 17], 'continuedEvents': 18, 'oos': 0}}`；2026-10-11T04:40:22.589843+00:00（最终029本轮结果）|
|combat+settlement|13/800/14773|`{'modules': ['combat', 'settlement'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'settlement', 'version': '1.3.0', 'rules': {'schema': 1, 'version': '1.3.0', 'fingerprint': 'sha256:c1d64430d3dd42fab6dadb9954b241333bc8be8714ec79af2b2a72cc313f73e7'}, 'configuration': {'raids': False}}]}, 'trace': {'events': 13, 'tick': 800, 'bytes': 14773, 'reason': 'combination-hit', 'commands': 13}, 'persistence': {'events': 13, 'saves': 8, 'seek': [13, 0, 8, 1, 13], 'continuedEvents': 14, 'oos': 0}}`；2026-10-11T04:40:57.757817+00:00（最终029本轮结果）|
|combat+crafting+foraging+giants+growth+narrative+settlement|14/800/17191|`{'modules': ['combat', 'crafting', 'foraging', 'giants', 'growth', 'narrative', 'settlement'], 'seed': 1, 'mode': 'wizard', 'identity': {'schema': 1, 'foundation': 13, 'modules': [{'id': 'combat', 'version': '1.6.0', 'rules': {'schema': 1, 'version': '1.6.0', 'fingerprint': 'sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae'}}, {'id': 'crafting', 'version': '1.0.0', 'rules': {'schema': 1, 'version': '1.0.0', 'fingerprint': 'sha256:fc1b8d11b7faf918331cf58895f135e11e67d397b5c88d1a08c5b2b679597fe1'}}, {'id': 'foraging', 'version': '1.0.0', 'rules': {'schema': 1, 'version': '1.0.0', 'fingerprint': 'sha256:d2e0803474a80f1adfc41680351199da38b7f3e8129df3d58ffd0349488d936f'}}, {'id': 'giants', 'version': '1.0.0', 'rules': {'schema': 1, 'version': '1.0.0', 'fingerprint': 'sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8'}}, {'id': 'growth', 'version': '1.8.0', 'rules': {'schema': 1, 'version': '1.8.0', 'fingerprint': 'sha256:1278eaf53be3250203cac8c17b7c9cc12f97ebb1d61eafff05e24a5b13a8752c'}}, {'id': 'narrative', 'version': '1.4.0', 'rules': {'schema': 1, 'version': '1.4.0', 'fingerprint': 'sha256:9ea296bd831838437026abda8ffec6bacf9f4b2edd104e6667eeec3b7b7067e8'}}, {'id': 'settlement', 'version': '1.3.0', 'rules': {'schema': 1, 'version': '1.3.0', 'fingerprint': 'sha256:c1d64430d3dd42fab6dadb9954b241333bc8be8714ec79af2b2a72cc313f73e7'}, 'configuration': {'raids': False}}]}, 'trace': {'events': 14, 'tick': 800, 'bytes': 17191, 'reason': 'combination-hit', 'commands': 13}, 'persistence': {'events': 14, 'saves': 8, 'seek': [14, 0, 9, 2, 14], 'continuedEvents': 15, 'oos': 0}}`；2026-10-11T04:41:46.893834+00:00（最终029本轮结果）|

## giants/growth自然联动实测

原进程实际完成117个顺序seed；最后完成seed117，没有重复搜索。growth成功行101，新招正伤害命中自然giant行0。逐行：

|seed|depth|命令|停止原因|giant新招正命中|growth公开技能|
|---:|---:|---:|---|---|---|
|1|3|164|no-safe-stair-route|False|True|
|2|2|62|no-safe-stair-route|False|False|
|3|4|241|no-safe-stair-route|False|True|
|4|2|100|no-safe-stair-route|False|True|
|5|2|101|no-safe-stair-route|False|True|
|6|2|115|no-safe-stair-route|False|True|
|7|3|124|no-safe-stair-route|False|True|
|8|2|66|no-safe-stair-route|False|True|
|9|1|49|no-safe-stair-route|False|True|
|10|4|290|no-safe-stair-route|False|True|
|11|2|109|no-safe-stair-route|False|True|
|12|4|191|no-safe-stair-route|False|True|
|13|1|6|no-safe-stair-route|False|False|
|14|5|202|no-safe-stair-route|False|True|
|15|2|93|no-safe-stair-route|False|True|
|16|3|154|no-safe-stair-route|False|True|
|17|4|160|no-safe-stair-route|False|True|
|18|2|81|no-safe-stair-route|False|True|
|19|2|35|no-safe-stair-route|False|False|
|20|1|3|no-safe-stair-route|False|False|
|21|2|55|no-safe-stair-route|False|True|
|22|2|98|no-safe-stair-route|False|True|
|23|6|397|no-safe-stair-route|False|True|
|24|3|179|no-safe-stair-route|False|True|
|25|2|79|no-safe-stair-route|False|True|
|26|1|1|no-safe-stair-route|False|False|
|27|4|236|no-safe-stair-route|False|True|
|28|4|170|no-safe-stair-route|False|True|
|29|1|30|no-safe-stair-route|False|True|
|30|2|84|no-safe-stair-route|False|True|
|31|4|169|no-safe-stair-route|False|True|
|32|3|126|no-safe-stair-route|False|True|
|33|2|146|no-safe-stair-route|False|True|
|34|4|150|no-safe-stair-route|False|True|
|35|5|284|no-safe-stair-route|False|True|
|36|4|129|no-safe-stair-route|False|True|
|37|3|126|no-safe-stair-route|False|True|
|38|4|203|no-safe-stair-route|False|True|
|39|2|79|no-safe-stair-route|False|True|
|40|4|204|no-safe-stair-route|False|True|
|41|2|44|no-safe-stair-route|False|True|
|42|2|68|no-safe-stair-route|False|True|
|43|2|106|no-safe-stair-route|False|True|
|44|2|2063|starving|False|True|
|45|3|155|no-safe-stair-route|False|True|
|46|1|48|no-safe-stair-route|False|True|
|47|7|424|no-safe-stair-route|False|True|
|48|4|115|no-safe-stair-route|False|True|
|49|2|86|no-safe-stair-route|False|True|
|50|1|8|no-safe-stair-route|False|False|
|51|5|232|no-safe-stair-route|False|True|
|52|3|113|no-safe-stair-route|False|True|
|53|3|53|no-safe-stair-route|False|True|
|54|4|191|no-safe-stair-route|False|True|
|55|2|69|no-safe-stair-route|False|True|
|56|4|286|no-safe-stair-route|False|True|
|57|3|275|no-safe-stair-route|False|True|
|58|4|302|no-safe-stair-route|False|True|
|59|3|176|no-safe-stair-route|False|True|
|60|2|95|no-safe-stair-route|False|True|
|61|1|46|no-safe-stair-route|False|False|
|62|3|138|no-safe-stair-route|False|True|
|63|3|227|no-safe-stair-route|False|True|
|64|1|35|no-safe-stair-route|False|True|
|65|4|153|no-safe-stair-route|False|True|
|66|5|184|no-safe-stair-route|False|True|
|67|5|281|no-safe-stair-route|False|True|
|68|1|34|no-safe-stair-route|False|True|
|69|3|138|no-safe-stair-route|False|True|
|70|3|75|no-safe-stair-route|False|True|
|71|4|220|no-safe-stair-route|False|True|
|72|3|172|no-safe-stair-route|False|True|
|73|5|258|no-safe-stair-route|False|True|
|74|3|165|no-safe-stair-route|False|True|
|75|1|15|no-safe-stair-route|False|False|
|76|2|121|no-safe-stair-route|False|True|
|77|1|16|no-safe-stair-route|False|True|
|78|3|132|no-safe-stair-route|False|True|
|79|2|98|no-safe-stair-route|False|True|
|80|4|146|no-safe-stair-route|False|True|
|81|1|2|no-safe-stair-route|False|False|
|82|3|203|no-safe-stair-route|False|True|
|83|3|88|no-safe-stair-route|False|True|
|84|3|157|no-safe-stair-route|False|True|
|85|2|95|no-safe-stair-route|False|True|
|86|2|137|no-safe-stair-route|False|True|
|87|6|341|no-safe-stair-route|False|True|
|88|2|44|no-safe-stair-route|False|False|
|89|2|48|no-safe-stair-route|False|True|
|90|4|253|no-safe-stair-route|False|True|
|91|1|31|no-safe-stair-route|False|False|
|92|2|93|no-safe-stair-route|False|False|
|93|3|133|no-safe-stair-route|False|True|
|94|2|51|no-safe-stair-route|False|True|
|95|4|351|no-safe-stair-route|False|True|
|96|6|281|no-safe-stair-route|False|True|
|97|6|464|no-safe-stair-route|False|True|
|98|4|110|no-safe-stair-route|False|True|
|99|1|1|no-safe-stair-route|False|False|
|100|2|81|no-safe-stair-route|False|True|
|101|5|217|no-safe-stair-route|False|True|
|102|2|101|no-safe-stair-route|False|True|
|103|1|37|no-safe-stair-route|False|True|
|104|2|73|no-safe-stair-route|False|True|
|105|2|59|no-safe-stair-route|False|True|
|106|1|10|no-safe-stair-route|False|False|
|107|3|202|no-safe-stair-route|False|True|
|108|5|270|no-safe-stair-route|False|True|
|109|2|157|no-safe-stair-route|False|True|
|110|5|320|no-safe-stair-route|False|True|
|111|4|167|no-safe-stair-route|False|True|
|112|1|13|no-safe-stair-route|False|False|
|113|2|61|no-safe-stair-route|False|True|
|114|1|37|no-safe-stair-route|False|False|
|115|1|27|no-safe-stair-route|False|True|
|116|2|102|no-safe-stair-route|False|True|
|117|1|45|no-safe-stair-route|False|True|

`evasion/at-release.json`：`[{'actionId': 4, 'sourceId': 29, 'cells': [{'x': 7, 'y': 22}, {'x': 7, 'y': 23}], 'player': {'x': 7, 'y': 21}}]`；2026-10-11T04:35:34.861650+00:00（最终029本轮结果）


## 旧前提的单变量反事实

|旧测试|原失败前提|生产回退反事实|最小修订/保留断言|
|---|---|---|---|
|combat_schema|仅3 attacks、3 nativeProfiles、3条segments列表|020中此1项失败；021只回退本次生产文件后，原两文件134项全部通过|改为精确8个ID、8绑定、8条精确段数；旧profile、字段白名单与全部负例守卫保持|
|combat_part_break|unmapped和player默认profile两项硬编码fixture.profile|020中这2项失败；同一021反事实通过|仅两处预期读权威playerProfileId；rat映射、完整resource行深等与全部行为断言保持|
反事实树 `/tmp/combat2-evidence/counterfactual/tree` 来源真实派发tip。仅恢复 definitions/locale/旧Bar/Dialog，并去掉新静态helper；共享文件和原两测试逐字节一致。021 exit0/134项，022修订后同两文件134项通过。自然trace没有按新预期重新捏造；追加header identity取原始真实录像，新增分支另保留真实origin。


## SDK-1 最小公开复现（S1 功能阻断）

自有 `combat2_sdk_repro.test.ts` 从wizard seed23、combat真实startNewGame启动，执行自有5084字节fixture中90条真实公开输入，再执行第91条 `ext:command`，data为`{"module":"combat","action":"attack","payload":{"attackId":"combat.anchor-break","facing":"s"}}`。不调用prepare、不布景、不改世界，也不捕获后反转为“预期失败通过”。022及最终定向命令如实失败：`Actor attack state: metadata and scheduler bundle mismatch`。

失败前D2玩家HP999、目标goblin id29 HP7；失败后D3玩家HP999且未gameOver。root actorActions.bundles已空，但combat仍留actionId3/profile combat.second-profile/paidCost8/suppressTerminalSweep=true；子动作lockedCells为空。归属镜像失配发生在原生伤害推进引起跨层之后，疑为跨层Session.state重绑定及清扫归属，定位是推断，不冒称已修复。最小fixture、失败前真save/recording、前后完整机械对象都保留在 `/tmp/combat2-evidence/natural/seed23-*`；首次原搜索错误另保留 `first-failure-23.json`。

涉及 `src/engine/Core/PhasedAttackProduction.ts`、共享actorAction验证及Game生命周期，均在白名单外。没有放宽守卫、清理元数据、改费用/时长/profile或换seed隐藏错误。本地应先复现并窄修共享底座，再从原seed23继续自然搜索。


## 最终候选、门禁与范围核对

最终候选源码 SHA-256：`1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`。026…031为先前候选；031暴露i18n动态键后只修Dialog，随后按影响范围复测。各命令源身份分别保留，不把两个源散列冒称同一候选。源码身份覆盖src/scripts/package.json/package-lock.json；实际vite.config.ts独立核对，报告另有文档提交。

|最终门禁|exit/结果|
|---|---|
|026 `node scripts/check-module-boundaries.mjs`|0；|
|027 `npx vue-tsc -b`|0；|
|028 `npm run build`|0；|
|029 `npx vitest run src/ext/modules/combat/tests/combat2_content.test.ts src/ext/modules/combat/tests/combat2_runtime.test.ts src/ext/modules/combat/tests/combat2_defense_cancel.test.ts src/ext/modules/combat/tests/combat2_body.test.ts src/ext/modules/combat/tests/combat2_growth.test.ts src/ext/modules/combat/tests/combat2_persistence.test.ts src/ext/modules/combat/tests/combat2_ui.test.ts src/ext/modules/combat/tests/combat2_sdk_repro.test.ts src/ext/modules/combat/tests/combat2_evasion.test.ts src/ext/modules/combat/tests/combat2_revisit.test.ts src/ext/modules/combat/tests/combat2_combinations.test.ts src/ext/modules/combat/tests/combat2_natural.test.ts src/ext/modules/combat/tests/combat2_links.test.ts --maxWorkers=1`|1；4 failed | 9 passed (13) / 5 failed | 150 passed (155) / 1616.42s (transform 3.69s, setup 0ms, import 19.24s, tests 1595.42s, environment 6ms)|
|030 `npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t '(^|\s)combat: real commands, every checkpoint' --maxWorkers=1`|0；1 skipped (1) / 64 skipped (64) / 4.39s (transform 2.93s, setup 0ms, import 4.23s, tests 0ms, environment 0ms)|
|031 `npx vitest run src/test/phase3a0_actor_action.test.ts src/test/phase3a0_scheduler.test.ts src/test/ext_actor_actions_root_world.test.ts src/test/ext_stats_native.test.ts src/test/ext_stats_pipeline.test.ts src/test/ext_stats_runtime.test.ts src/test/ext_stats_review.test.ts src/test/phase4a3_body_display.test.ts src/test/ext_world_display.test.ts src/test/ext_recording_v4_snapshots.test.ts src/test/u_03_whole_run_snapshot.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=1`|1；1 failed | 14 passed (15) / 1 failed | 265 passed (266) / 249.90s (transform 3.59s, setup 0ms, import 19.79s, tests 228.05s, environment 7ms)|
|032 `npm run test:drift -- --maxWorkers=1`|0；7 passed (7) / 14 passed (14) / 389.95s (transform 3.22s, setup 0ms, import 12.31s, tests 376.69s, environment 3ms)|
|033 `node scripts/check-module-removal.mjs --plan --profile=removal --retain=crafting,foraging,giants,growth,narrative,settlement --engine-only --maxWorkers=1`|0；|
|034 `git diff --check`|0；|
|035 `node scripts/check-module-boundaries.mjs`|0；|
|036 `npx vue-tsc -b`|0；|
|037 `npm run build`|0；|
|038 `npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t '(^|\s)combat: real commands, every checkpoint' --maxWorkers=1`|0；1 skipped (1) / 64 skipped (64) / 4.34s (transform 2.88s, setup 0ms, import 4.17s, tests 0ms, environment 0ms)|
|039 `npx vitest run src/ext/modules/combat/tests/combat2_ui.test.ts src/ext/modules/combat/tests/combat_ui.test.ts src/ext/modules/combat/tests/combat_parry_ui.test.ts src/ext/modules/combat/tests/combat_parry_advisory.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=1`|0；8 passed (8) / 112 passed (112) / 50.69s (transform 3.66s, setup 0ms, import 11.14s, tests 38.52s, environment 4ms)|
|040 `git diff --check`|0；|
|041 `npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t 'combat: real commands, every checkpoint, seek, continuation and corrupt-manifest preservation' --maxWorkers=1`|0；1 skipped (1) / 64 skipped (64) / 4.33s (transform 2.84s, setup 0ms, import 4.17s, tests 0ms, environment 0ms)|
|042 `npx vitest list src/ext/modules/combat/tests/combat_combinations.test.ts --json --maxWorkers=1`|0；|
|043 `npx vitest run src/ext/modules/combat/tests/combat_combinations.test.ts -t ''"'"'combat'"'"': real commands, every checkpoint' --maxWorkers=1`|0；1 passed (1) / 1 passed | 63 skipped (64) / 29.37s (transform 2.83s, setup 0ms, import 4.10s, tests 25.10s, environment 0ms)|
|044 `node /tmp/combat2-evidence/browser.mjs`|1；|

旧定向集合020共22文件503项，500通过/3个旧前提失败；021反事实和022最小修訂见上表。20个未修订文件369项沿用020，2个修订文件134项沿用022，原合计503项；不是500+134的重叠累加。031后Dialog仅静态翻译键修订，直接UI/parry UI/advisory、C2 UI18和扫描守卫按实际最新命令复测；未受该模板更改影响的机械生产与其余测试保留原结果。所有首次失败保留，不新增skip/todo。030/038/041均实际0用例/64过滤；参数化名在Vitest中是`'combat':`，另有正则转义错误，exit0没有被当成功证明。042只列名称没有执行矩阵；043按实际带引号名称选唯一combat-only，结果以实际日志为准。

相对派发tip逐字节核对白名单外2723个已跟踪文件：变化0；白名单外新增0；CRLF0；单个fixture超过1MB为0。生产文件SHA-256如下，数据/显示与冻结共享字节分开核对：

测试配置vite.config.ts SHA-256：`cbb80a849259d0a00d8b7100a45800bdafdebd09f2c3c76c40aa1daafcfd672c`，与派发tip字节相同：`True`。

|生产文件|SHA-256|
|---|---|
|`src/ext/modules/combat/data/definitions.json`|`f8beb26074a6101e378f8184b549ece3c58608519c4fc99f68593497325a87f3`|
|`src/ext/modules/combat/locales/zh_CN.json`|`fd7c6cb02c1bfe4783e7a341ce094c77585f1a926ca908c96663cdd87ad26527`|
|`src/ext/modules/combat/ui/CombatAttackBar.vue`|`4a423991dc6a418ce55700b1c8b2c5ddec357d7afa91dcd8df62a77891641f8b`|
|`src/ext/modules/combat/ui/CombatAttackDialog.vue`|`0dfd1fc0f38a507a787fc33dbe31fec67654cd6ae34f7ce4403c07f4a37529b2`|
|`src/ext/modules/combat/ui/attackPresentation.ts`|`f76c6fae731f9f47b93aef1a25ebef58965631b56745ea36d377c01157d637aa`|
031修复前后生产字节比较：仅`['src/ext/modules/combat/ui/CombatAttackDialog.vue']`变化；definitions/locale/Bar/helper四文件原SHA完全相同。139核心中的UI18另复测，其余121核心、自然/九组合/SDK输入与执行支持均未改，不重复长路线。首轮029的150通过/5失败保留，不以复测叠加或替换该套件退出1。


## SDK-2 最小公开复现（S1 功能阻断）

原giants/growth搜索首次异常为seed118、第152条公开输入：`Invalid module state: growth`。停止规则立即生效，119…128未跑，沒有提高128/D8/2500/300/64上限。自有15566字节fixture保留真实growth initialCommands、151条成功公开输入和最后一条`ext:command`：combat.attack，attackId=`combat.answering-edge`，facing=`w`。

最终029独立公开复现实际得到 `Error: Invalid module state: growth`，失败前depth=3，失败后depth=3、player={'hp': 1000, 'x': 17, 'y': 8}、gameOver=False。前一安全点真save/recording与完整前态、后态诊断在`natural/seed118-*`。用例未反转为预期失败，也未略过。

原堆栈经过`src/ext/modules/growth/module.ts`的deathCaptured/saveState、`src/ext/runtime.ts`的setState校验和Game.killMonster；错误实际可复现，触发归属定位仍需维护者确认。growth与共享runtime在白名单外，未改守卫、丢弃death事件或私有state来掩盖错误。


## SDK-3 非单调seek完整世界差异（持久化阻断，严重度待维护者裁决）

固定原seed3的自然分支以真实monkey id29/action4的新掷影击预警为依据：锁格(7,22)/(7,23)，事件61公开move把玩家从(7,22)移至(7,21)，事件62真实到期释放时仍在锁格外。来源出生creationReason=natural，实际释放记录与到期坐标均已断言；不是旧fixture.double-thrust的走位。

024捕获与025默认重放均通过全部线性replay机械检查点及完整末态，随后replaySeek(62)在无replayError、游标62时失败。Wanted/direct SHA-256均为`48d9b3a353d8dd81ff70e475ab26458545cce124a5493cdac44d14adc684f1ea`。完整差分恰8处：`levels[0].grid[72/73/74/101/102/130/248/249].isVisible`从true变false；其余完整机械字段相等。原对象在`persistence/seek-3-combat-62.json`。

最小保留用例是`combat2_evasion.test.ts`及11913字节真实fixture；原62事件录像61382字节、tick5900。共享Game.replaySeek将candidate世界通过loadSnapshot发布，可能在缓存层可见性发布时改变字段；这是定位推断。沒有删除可见性/缓存叶或追加归一化，失败保留。该分支未完成其后save/load/suffix/续录，不将线性replay通过写为全部持久化通过。最终029若同类错误出现在其他自然trace，按实际日志与对应完整diff登记，不能以0 replayError等同0差异。

|完整seek差分|索引|direct与原摘要相同|差异数/字段|
|---|---:|---|---|
|`seek-3-combat-62.json`|62|True|8 / `{'isVisible': 8}`|
|`seek-3-combat-64.json`|64|True|8 / `{'isVisible': 8}`|
|`seek-47-combat+giants+growth-425.json`|425|True|23 / `{'isVisible': 23}`|
差异位于缓存层isVisible；沒有据此推断当前层HP、RNG或实际游玩已改变。严重度由维护者裁决，完整对象合同仍未通过。


## 自然证据的范围与真实重访

已完成117条giants/growth路线，101条公开growth技能成功，55条有自然giant出生，计85条出生记录；玩家新招对这些自然giant正伤害命中为0。最近候选seed47到D7，ridgeback IDs51/83/99和abyssal-colossus151均有自然出生证明，425事件/tick37300，原录像416484字节，紧凑fixture85921字节；不把出生或未识别目标70/71当自然giant接触。

combat-only保留seed1/2/3/11/12中五招各有player id1对自然活敌的正伤害，jackal/monkey/goblin/toad各有对应真实NPC释放，zombie仍缺自然释放。seed1事件36公开parry facing se成功，事件38另付费手动应隙斩 facing s，二者之间事件37是移动；不声称自动反击。诊断群体body3项不是自然巨兽同线证明。

|玩家新招正伤害|seed/自然目标id/type/depth|segment/elapsed/damage|
|---|---|---|
|anchor-break|1/27/jackal/D1|0/140/4|
|returning-sweep|1/27/jackal/D1|0/100/3|
|advancing-point|1/27/jackal/D1|0/80/3|
|cast-echo|2/32/kobold/D2|0/120/15|
|answering-edge|1/23/kobold/D1|0/30/4|
真实重访固定seed1，公开输入记录的实际层变化`[{'index': 56, 'from': 1, 'to': 2}, {'index': 57, 'from': 2, 'to': 1}, {'index': 59, 'from': 1, 'to': 2}]`；完整持久化结果`{'events': 59, 'saves': 4, 'seek': [59, 0, 56, 1, 59], 'continuedEvents': 60, 'oos': 0}`。此路线资源缓存行before/after均为空（0/0），只证明真实离层重访及机械一致性，不能证明非空NPC资源冻结或不补离线攻击；该部分列为证据缺口。旧links控制器的stairs_up输入未改变深度，没有据此宣传重访。


|额外紧凑trace|seed/mode/modules|事件/tick/原录像字节/fixture字节|完整双RNG终点|
|---|---|---|---|
|links|47/wizard/`['combat', 'giants', 'growth']`|425/37300/416484/85921|`{"version":2,"algorithm":"brogue-web-ranval32-uint64-level-v2","streams":[{"a":1104585502,"b":2795134725,"c":3047006154,"d":2968078318},{"a":3918101662,"b":1355161724,"c":3399816536,"d":3402027879}],"currentRNG":0,"randomNumbersGenerated":795165,"cosmeticNumbersGenerated":217}`|
|evasion|3/wizard/`['combat']`|62/5900/61382/11913|`{"version":2,"algorithm":"brogue-web-ranval32-uint64-level-v2","streams":[{"a":4109073601,"b":229600261,"c":2040615281,"d":3443676455},{"a":3743919415,"b":3322842154,"c":109117171,"d":335710893}],"currentRNG":0,"randomNumbersGenerated":314064,"cosmeticNumbersGenerated":165}`|
|revisit|1/wizard/`['combat']`|59/4700/59244/15819|`{"version":2,"algorithm":"brogue-web-ranval32-uint64-level-v2","streams":[{"a":324413130,"b":2106368219,"c":448976081,"d":157982084},{"a":4186464015,"b":989628893,"c":943134691,"d":1165901774}],"currentRNG":0,"randomNumbersGenerated":124167,"cosmeticNumbersGenerated":162}`|

## UI实测矩阵与未验项目

|视口|普通：original/refined/hanzi/tiles|沉浸：original/refined/hanzi/tiles|
|---|---|---|
|1440×900|未验×4|未验×4|
|390×844|未验×4|未验×4|
|320×844|未验×4|未验×4|
044实际exit1：已有Playwright找不到Chromium可执行文件 `/home/agent/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`。正常启动日志在仓库外 `browser/launch.log`；24格均未验，未下载/安装/绕过权限，未生成截图；本次独立127.0.0.1:28763静态服务器已停止。

组件18项涵盖静态SSR、十按钮、真实Game选择/方向/返回/取消/确认、费用/时间/提示、44像素和未知/重叠信息。浏览器脚本若启动则只覆盖上述24格的十按钮44像素、横向滚动、弹窗边界、选择方向/返回/取消以及鼠标或触摸模拟；不把其当真正设备或完整动作确认验证。未知预警历史、ACK、倒计时、replay/seek页面同步和实际设备全部未有浏览器证据；独立审查未执行。截图仅仓库外。


## 删除计划实测

实际命令编号033，exit0，原始输出`/tmp/combat2-evidence/033.log`；下列为实际输出，未执行删除或prepare-only：
```text
{
  "source": "/workspace/BrogueJS",
  "requestedProfile": "removal",
  "foundationFixtureDirectories": [
    "src/test/fixtures/ce-oracles",
    "src/test/fixtures/example-module",
    "src/test/fixtures/modules",
    "src/test/fixtures/traces",
    "src/test/fixtures/world5-module"
  ],
  "preservedCeReference": false,
  "installedModules": [
    "combat",
    "crafting",
    "foraging",
    "giants",
    "growth",
    "narrative",
    "settlement"
  ],
  "matrix": [
    {
      "id": "keep-crafting+foraging+giants+growth+narrative+settlement",
      "retained": [
        "crafting",
        "foraging",
        "giants",
        "growth",
        "narrative",
        "settlement"
      ],
      "removed": [
        "combat"
      ],
      "profile": "removal",
      "plannedGates": [
        {
          "id": "boundaries",
          "command": [
            "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node",
            "scripts/check-module-boundaries.mjs"
          ]
        },
        {
          "id": "typecheck",
          "command": [
            "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node",
            "node_modules/vue-tsc/bin/vue-tsc.js",
            "-b"
          ]
        },
        {
          "id": "build",
          "command": [
            "npm",
            "run",
            "build"
          ]
        },
        {
          "id": "extension-tests",
          "command": [
            "npm",
            "run",
            "test:ext",
            "--",
            "--maxWorkers=1"
          ]
        },
        {
          "id": "composition-smoke",
          "command": [
            "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node",
            "scripts/check-module-composition-smoke.mjs",
            "--output",
            "<evidence>/keep-crafting+foraging+giants+growth+narrative+settlement-smoke.json",
            "--engine-only",
            "--removed-modules",
            "combat",
            "--combinations",
            "endpoints"
          ]
        }
      ]
    }
  ],
  "ownedRoots": [
    "src/ext/modules/combat",
    "src/ext/modules/crafting",
    "src/ext/modules/foraging",
    "src/ext/modules/giants",
    "src/ext/modules/growth",
    "src/ext/modules/narrative",
    "src/ext/modules/settlement"
  ],
  "tests": {
    "test": 561,
    "gen": 27,
    "drift": 7,
    "ext": 306
  },
  "normalTreeFullGate": {
    "required": true,
    "includedInMatrix": false,
    "status": "not-run",
    "note": "A full normal-tree gate remains required for this candidate. A removal-only run does not verify or replace it."
  },
  "removalPolicy": "Physical-deletion copies run boundaries, typecheck, build, all remaining extension tests and all-enabled/all-disabled smoke; complete npm test runs only on the normal tree.",
  "smokeScope": "Physical deletion: remaining modules all-enabled and all-disabled, deduplicated when empty. Normal tree: every installed subset. All use real Game new/play/save/load/replay/seek/continued recording and removed-module input rejection.",
  "caveat": "Matrix covers only currently installed module directories."
}
```


## 交付裁决与本地接续

**已确证功能阻断：** SDK-1跨层metadata/clock失配；SDK-2自然死亡捕获拒绝growth state；SDK-3完整seek可见性不一致。均保留公开复现及失败用例，未在本步修改白名单外源码。

**证据缺口：** zombie自然新招释放、自然giant新招接触/自然群体handled闭环、非空缓存NPC资源冻结、部分自然trace被首个持久化失败阻断的后续检查、growth技能专门No场景、上述浏览器/真设备与独立审查。诊断群体与单NPC调度不能替代自然闭环。最终九行是否完整通过以029结果及带时间的九行表为准。

**另排集成门禁：** 完整npm/test:ext、64旧组合与128子集、实际只删combat、CE fetch/full/gen、全项目性能体积；本步沒有执行，也不继承5Z作为自动兜底。

C2-D01…D06均按任务包固定方案执行，仍交维护者签认；沒有改数值、NPC绑定、协议或搜索上限。dot新增自有可逆决定7项：①校验包静态UI hint/timing helper；②44像素按钮并沿用横向滚动；③模块自有support/独立shape预期；④完整机械对象SHA紧凑检查点且仅savedAt归一化；⑤真实origin入口只读捕获；⑥固定原seed3预警分支和seed1真实楼梯分支；⑦保留最近真实giant候选及两个公开异常fixture。独立评审輪数0，沒有R1/R2/R3自动循环。

本地接续：先按三个自有最小复现窄修共享生命周期/seek和growth死亡捕获，保留原有效守卫；复测相应失败，不重新抽已完成seed。共享修复后从combat-only原失败23及links原失败118安全prefix接续，继续原一次128上限内未完成部分，补zombie/giant/非空缓存证据；再补浏览器与真设备，安排明确的集成门禁和维护者签认。未合main、打tag或部署。


最终数量口径：自有全批13文件155项为150通过/5失败/0真实skip/todo；Dialog修复后UI18沿用039最新通过，未重复其他长路线。直接旧回归22文件503项按上文不重叠合成，三个受影响UI文件最新复测通过；043旧combat-only唯一自然组合1通过，63仅名称过滤。共享15文件266项：031先265通过/1自有i18n失败，039中该文件26项全部通过、另外三扫描守卫也通过；其它不受模板更改影响的240项沿用031。没有宣称共享SDK问题已关闭。

## 提交身份与相对派发tip的白名单diff

实现及手册提交：`3317c7c944ed270f1d5c93fa58e9b158cdd55b63`；父提交为派发tip `5782e73015c8d0caa81b8b31501706bb2a1fb774`。最终经验证源码散列为 `1d310273c719e7e786337b1d2f8e2e7da5894202564eb5ef422d1786c5b3d93e`，对应当前Dialog静态翻译修复后的候选。实现提交含36个显式白名单路径，3282新增/13删除；本报告另作独立文档提交，报告本身的提交就是交付tip，准确tip与实际push结果以最终回执为准，可用 `git log -1 --format=%H -- docs/ext/combat2.report.md` 定位。两次提交均按任务规定添加同一Co-Authored-By页脚。

相对tip完整路径清单共37项，包含本报告；其余2723个已跟踪文件已再次逐字节核对不变，全部新增文件也在白名单内。

- `docs/ext/combat-config.md`
- `docs/ext/combat2.report.md`
- `src/ext/modules/combat/data/definitions.json`
- `src/ext/modules/combat/locales/zh_CN.json`
- `src/ext/modules/combat/test-suites.json`
- `src/ext/modules/combat/tests/combat2_body.test.ts`
- `src/ext/modules/combat/tests/combat2_combinations.test.ts`
- `src/ext/modules/combat/tests/combat2_content.test.ts`
- `src/ext/modules/combat/tests/combat2_defense_cancel.test.ts`
- `src/ext/modules/combat/tests/combat2_evasion.test.ts`
- `src/ext/modules/combat/tests/combat2_growth.test.ts`
- `src/ext/modules/combat/tests/combat2_links.test.ts`
- `src/ext/modules/combat/tests/combat2_natural.test.ts`
- `src/ext/modules/combat/tests/combat2_persistence.test.ts`
- `src/ext/modules/combat/tests/combat2_revisit.test.ts`
- `src/ext/modules/combat/tests/combat2_runtime.test.ts`
- `src/ext/modules/combat/tests/combat2_sdk_repro.test.ts`
- `src/ext/modules/combat/tests/combat2_ui.test.ts`
- `src/ext/modules/combat/tests/combat_part_break.test.ts`
- `src/ext/modules/combat/tests/combat_schema.test.ts`
- `src/ext/modules/combat/tests/fixtures/combat2-base-locale.json`
- `src/ext/modules/combat/tests/fixtures/combat2-base.json`
- `src/ext/modules/combat/tests/fixtures/combat2-evasion.json`
- `src/ext/modules/combat/tests/fixtures/combat2-links.json`
- `src/ext/modules/combat/tests/fixtures/combat2-natural.json`
- `src/ext/modules/combat/tests/fixtures/combat2-revisit.json`
- `src/ext/modules/combat/tests/fixtures/combat2-rows.json`
- `src/ext/modules/combat/tests/fixtures/combat2-sdk-seed118.json`
- `src/ext/modules/combat/tests/fixtures/combat2-sdk-seed23.json`
- `src/ext/modules/combat/tests/support/combat2Harness.ts`
- `src/ext/modules/combat/tests/support/combat2Natural.ts`
- `src/ext/modules/combat/tests/support/combat2Persistence.ts`
- `src/ext/modules/combat/tests/support/compileCombat2.d.mts`
- `src/ext/modules/combat/tests/support/compileCombat2.mjs`
- `src/ext/modules/combat/ui/CombatAttackBar.vue`
- `src/ext/modules/combat/ui/CombatAttackDialog.vue`
- `src/ext/modules/combat/ui/attackPresentation.ts`

实现及手册实际diff-stat（报告为另一新增文件）：

```text
docs/ext/combat-config.md                          |  35 +-
 src/ext/modules/combat/data/definitions.json       | 897 ++++++++++++++++++++-
 src/ext/modules/combat/locales/zh_CN.json          |  15 +-
 src/ext/modules/combat/test-suites.json            |  13 +
 src/ext/modules/combat/tests/combat2_body.test.ts  |  61 ++
 .../combat/tests/combat2_combinations.test.ts      |  29 +
 .../modules/combat/tests/combat2_content.test.ts   | 120 +++
 .../combat/tests/combat2_defense_cancel.test.ts    |  83 ++
 .../modules/combat/tests/combat2_evasion.test.ts   | 102 +++
 .../modules/combat/tests/combat2_growth.test.ts    |  47 ++
 src/ext/modules/combat/tests/combat2_links.test.ts |  47 ++
 .../modules/combat/tests/combat2_natural.test.ts   |  93 +++
 .../combat/tests/combat2_persistence.test.ts       |  85 ++
 .../modules/combat/tests/combat2_revisit.test.ts   |  89 ++
 .../modules/combat/tests/combat2_runtime.test.ts   | 135 ++++
 .../modules/combat/tests/combat2_sdk_repro.test.ts |  41 +
 src/ext/modules/combat/tests/combat2_ui.test.ts    |  87 ++
 .../modules/combat/tests/combat_part_break.test.ts |   4 +-
 src/ext/modules/combat/tests/combat_schema.test.ts |   9 +-
 .../combat/tests/fixtures/combat2-base-locale.json |  94 +++
 .../combat/tests/fixtures/combat2-base.json        | 734 +++++++++++++++++
 .../combat/tests/fixtures/combat2-evasion.json     |   1 +
 .../combat/tests/fixtures/combat2-links.json       |   1 +
 .../combat/tests/fixtures/combat2-natural.json     |   1 +
 .../combat/tests/fixtures/combat2-revisit.json     |   1 +
 .../combat/tests/fixtures/combat2-rows.json        |   7 +
 .../combat/tests/fixtures/combat2-sdk-seed118.json |   1 +
 .../combat/tests/fixtures/combat2-sdk-seed23.json  |   1 +
 .../modules/combat/tests/support/combat2Harness.ts | 107 +++
 .../modules/combat/tests/support/combat2Natural.ts | 198 +++++
 .../combat/tests/support/combat2Persistence.ts     |  58 ++
 .../combat/tests/support/compileCombat2.d.mts      |   6 +
 .../combat/tests/support/compileCombat2.mjs        |  50 ++
 src/ext/modules/combat/ui/CombatAttackBar.vue      |   2 +-
 src/ext/modules/combat/ui/CombatAttackDialog.vue   |  16 +-
 src/ext/modules/combat/ui/attackPresentation.ts    |  25 +
 36 files changed, 3282 insertions(+), 13 deletions(-)
```

所有代码验证已结束才执行显式 `git add -- <36个逐项路径>`、`git diff --cached --check` 和本地实现提交；报告随后显式add独立提交。推送另执行且仅允许 `git push -u origin ext/combat2`，不改认证、不读取凭据、不使用API/网页替代，不推其他分支或合并/打tag/部署。原始大证据未提交；自有紧凑fixture单个均≤1MB。
