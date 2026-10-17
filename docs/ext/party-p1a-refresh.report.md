# P1a任务与合同phase6刷新报告

2026-10-18。已在当前 `ext/phase6` 工作树新增[任务书](party-p1a.task.md)与[合同](party-contract.md)，回填维护者M1–M5裁定并新增M6–M11待决定问题。仅新增这两份文件及本报告；未修改代码、测试、工具、既有文档或试玩改动，未commit/push，未启动P1a实施或云端性能任务。

## 1 只读来源与身份

- 当前HEAD：`0e684d100146af38b1e2056811fef821001f7555`，分支 `ext/phase6`。该提交包含MainMenu配置代理快照修复及真实创建组合SFC测试。
- 文档来源：本地已有远端跟踪引用 `origin/ext/party-design`，解析为 `8bd271b4bc26dea697ca8af1257240d848f3665d`；按用户要求分别用 `git show origin/ext/party-design:docs/ext/<文件>` 读取 `party-p1a.task.md`、`party-contract.md`、`party-multiplayer-design.md`、`party-p0.report.md`。未fetch、切换、合并或修改该分支。原任务生产基线79bb26e（5Z），原P0基线7ec0ca0仅作历史。
- 开始时三个目标文件均不存在，按新文件写入。设计与P0原文不复制进当前工作树，刷新稿用固定来源提交链接引用，避免产生不在范围内的第四/第五份文件。
- 已读HANDOFF/development/architecture；核对phase6合同差量、6Z/性能P0–P2/6B4 D6修订报告，并直接核对descriptor、codec、growth/loot属性与奖励、缓存/事务、创建流程和云端脚本。此次为定向执行链核对，**没有重跑P0全AST普查**，旧9188 occurrence/1259文件等数字不冒充phase6最新扫描结果。

## 2 身份、版本和门禁差量

| 原稿 | 刷新结果 / 依据 |
|---|---|
| foundation13/whole-run6/recording4/origin2 | foundation20/whole-run7/recording4/origin2；`src/ext/descriptor.ts`、`WholeRunSnapshot.ts`、`RecordingV4.ts`、Game header与RecordingFormat |
| world5.schema4/worldSdk1/edibleSdk1 | world5.schema6/worldSdk2/edibleSdk1，增加itemSdk4；不是只升foundation |
| party候选F14/S7/R5/O3，无party13/6/4/2 | party候选F21/S8/R5/O3，无party20/7/4/2；双有效身份是M1已批方向，**当前代码尚未实现、号码尚未占用**，须从实施冻结源复核 |
| 七模块 | 八模块：combat1.6.0、crafting1.1.0、foraging1.0.0、giants1.1.0、growth1.10.0、loot、narrative1.5.0、settlement1.4.0（state2）；以各descriptor及定义常量核对 |
| 未纳入loot | HEAD loot0.9.0，当前未提交试玩为0.9.1；pack0.6.0/schema5、实例6/state2/dropTables2。明确区分工作区与提交身份，实施前重新采集configuration/规则指纹 |
| 128旧组合×party开关=256 | 当前八模块256理论子集，加party后512；理论空间不等于门禁。精选12条正常配置（classic + 11个扩展子集），余501个扩展子集不穷举 |
| 九冻结SDK保持5Z字节 | 保护phase6当前接口；worldSdk/stats/forageFixture历史已有变化，itemSdk为新增。未来party接口优先独立能力口，所有实际修改登记字段/消费者/有效身份 |
| 全量full/gen/drift/test:ext + 多行物理删除 | M5于2026-10-18修订为影响面选测、精选组合含UI创建、一行全删、boundary/依赖/vue-tsc/build。不调用已从package.json移除的ce:fetch/test:full/test:gen，不跑完整npm/test:ext/drift套件 |
| P0毫秒/64KiB/256KiB预算待冻结 | P1a先实测单步、摘要、体积与内存；P1b再定新阈值。当前D6回归方法保留，但不把旧单人数据当四人指标 |

零影响比较基线同步改为**实际phase6开工冻结源**，不再要求恢复5Z历史快照字节。无party仍严格比较版本、域顺序、RNG和规范化字节；对party语义变化的growth等模块，也必须有有效规则/模块身份分支，不能只改RecordingHeader。

M1–M4按推荐明确回填为2026-10-18已批；M5回填用户本次修订，去掉原“需确认”及旧全量要求。单步DTO补入合同，并将原窗口/AI持久类型标为后续草案，避免P1a空挂window/AI状态；保留A01–A13及原单步/时间/所有权/共享感知/死亡/留守/Worker要求。

## 3 新冲突与写集补充

任务书§9逐项列出现行符号、处理建议和A01–A13对应，本节只摘关键差量：

| 核对点 | 刷新后要求 |
|---|---|
| growth `settle/planAward`，已有actor组件但XP仍有主角/盟友分账 | M4参与池/收据一次性；`growth.xp-gain`增益与分池先后另提M6，不把物品/身份首访资源一并当XP复制 |
| growth.attribute、loot装备/套装/插槽/符文词与属性DAG | 非主成员按真实身份、装备和原生基值取属性；排查`actor.player`/模板分支，防止成员进入loot怪物缩放；knownOnly和真实materialization隔离 |
| `loot/drops.ts`与`ext/itemDrops.ts`仍以event.playerId限制幸运值查询 | 新增M7决定属性主体/过滤/金币；共享地面与实际拾取物主分离，unique/set/part/encounter全局来源账不能四人重放 |
| WorldWork装备escrow、退款/完成票据与craft来源 | 根枚举包含所有成员、冻结层、容器和escrow；actor库存戳/工位距离/预留/资源收费一致，失败保别名和属性账；不抢居民工单 |
| P0/P1光照/FOV/占位缓存与P2来源/事务优化 | 不是“现有缓存全部只认player”；保持actor/target/facts及跨actor组件读集，补生命周期失效、知识隔离、完整对象图回滚。不得省略新成员写根换取性能 |
| growth全局objectiveClock到期清理与留守冻结 | 新增M10；世界继续走，成员效果/冷却/focus等按冻结剩余量恢复，居民按home经济，不变成多世界时钟 |
| MainMenu / ext/ui/creation | 现有每模块一个initialCommand，新增M9讨论roster与批量身份；保留toRaw快照、取消/重试/异步会话、重复提交锁。`ext_creation_combinations_ui.test.ts`与`ext_module_creation_ui.test.ts`成为明确选测入口 |
| 录像链修复与Worker | 非周期末行full在下一输入前撤销并重算链；保存频率不得改变party前缀。保留固定chunk与未来窗口语义边界区别，所有成员域同一冻结job及完整性fail-closed |
| 云端A/B工具 | 当前三分片classic/all-full/all-prefix及merge汇总；party identity尚不存在，新增M11接入建议。保留D6 P95/P99/max/墙钟与两轮越线规则，all完整工作量变化仅报告、可比prefix参与判定 |

任务书§7在旧共享清单外增加实际存在的 `engine/Stats/{StatPipeline,NativeStatSources,MaterializedStats}.ts`、`ext/{attributeCatalog,itemSdk,itemDrops,json}.ts`、growth/loot来源与UI、WorldCheckpoint、MainMenu/creation、模块自有测试登记、`scripts/test-dependencies.json`及云端性能工具候选写集。花括号分组中的具体路径已展开检查；不凭旧文件名猜新位置。未来新增party路径明确标为拟新增，本次未创建生产目录。

## 4 新增待维护者决定

完整推荐同步写在任务书§10与合同§9.3，均明确**未批准**，没有重开已批M1–M5：

| 编号 | 决定主题 | 推荐摘要 |
|---|---|---|
| M6 | XP增益先后/辅助事件/旧盟友分账/死者份额 | 基础池先分再按各actor增益；权威辅助事实白名单；成员不二次allySplit，历史参与不抹掉，死者份额不转赠 |
| M7 | 共享掉落的rarity-find主体/拾取过滤/金币 | 击杀/part取可信creditActor，静态生成取primary；实际actor拾取，局级过滤/金币保持；全局来源收据一次 |
| M8 | 受控成员与原生NPC属性资格 | 独立成员能力口，按人身份/装备，排除成员怪物缩放，不伪装所有Monster为player |
| M9 | 多成员创建如何接单模块单初始命令 | 现有会话收齐roster与growth批量身份，统一预检、一次new-game、引擎内稳定槽映射；无growth也能创建 |
| M10 | 冻结成员与growth绝对截止值 | 保存剩余量/冻结起点并平移截止，不停全局clock、不影响居民经济 |
| M11 | party云端场景/身份与工具写集 | 现有无party回归路线保留，新增party-only/party+all的1/2/4人身份，沿拆分A/B方法，P1a先报告、P1b定阈值 |

## 5 本次验证与限制

- 文档合同唯一TypeScript块提取到仓外，使用仓库TypeScript执行 `--strict --noEmit --skipLibCheck --target es2022 --module esnext --types node`，通过。这只证明声明自洽，不证明生产实现或SDK已开放。
- 检查本地Markdown链接、明确代码路径（展开花括号）、M1–M5日期/身份与M6–M11两份一致性、LF/尾空格、目标新文件范围。来源设计/P0使用固定远端提交链接，内容已由git读取，未联网确认页面可访问性。
- 未运行任何游戏测试、vue-tsc/build、组合/删除、浏览器或性能测量；未重录基线/黄金trace。文档更新无需把未来实现门禁提前跑一次，所有历史结果只是来源，不称本次通过。
- 6Z未关闭项、性能已知开销/历史失败、浏览器/真机未验仍留原报告，不改写、不冒称解决。此次没有给全部单人假设逐条证明，只列本轮定向发现及实施建议。

## 6 既有工作区保护

开工时11个受跟踪修改与2个未跟踪文件均只读，逐文件SHA-256保存于 `/private/tmp/party-p1a-refresh/initial.json`；完成后逐项重算一致。既有列表：

- `docs/ext/loot-config.md`、`progress.md`、`src/engine/Core/Game.ts`、`src/engine/Systems/Logger.ts`。
- `src/ext/modules/loot/locales/ui.zh_CN.json`、`session.ts`、`test-suites.json`、`ui/LootPickupFilterForm.vue`、`tests/loot_inert.test.ts`、`tests/__snapshots__/loot_ui_components.test.ts.snap`。
- `src/test/presentation_timeline.test.ts`。
- 原未跟踪 `docs/ext/playtest-1018.report.md`、`src/ext/modules/loot/tests/loot_auto_pickup.test.ts`。

只额外出现指定三个未跟踪文档，HEAD仍为0e684d1；未暂存任何文件。仓外只留只读来源副本、声明检查文件与轻量验证记录，不向仓库加入截图或大体积原始证据。
