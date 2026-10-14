# 阶段5扩展测试政策清理报告

阶段 `integration-policy-cleanup`，2026-10-13。唯一生产作者，HEAD `a15c9800877db8280ab031e9e600d33f019db33c` 加既有集成/R1及本轮未提交差量；未reset、merge、commit、push、tag或改main/foundation。独立集成R2 PASS保持，本步不开集成R3。维护者原状态/任务差量未暂存或改写。

本步已实际完成政策清理、依赖检查及必要相关复测，可以交维护者冻结新候选。完整npm/ext/drift/正常128/实际全删1行及Claude人工留统一最终批次，不能把本报告称为最终全量通过。规则来源为执行根 `test-policy-20261013.md`、`n2-performance-directive-20261013.md`、最新用户授权；扩展分支覆盖旧CE全量/逐叶黄金/所有前提反事实要求，main政策不追改。

## 实现与分类

逐用例按实际用途审计：129项纯CE定义移除，12项混合处理，1178项候选定义保留，涉及196文件。这里计数是静态定义，不是展开it.each/循环后的运行用例数，也不与Vitest计数相加。附录逐项列文件/标题/判定/理由；按CE外部依赖、内嵌权威表与具体断言目的分类，未按CE字串批量删。未含纯CE义务的其他发现文件在依赖/归属附录逐文件保留。

| 对象 | 处理与理由 |
|---|---|
| armors/weapons数据测试 | 整份仅CE权威表逐件数值/存在性对账，删除2文件并从注册表注销，未在发现器exclude隐藏 |
| monsterDamage/monsterBolts/monsters/hordes | 删除内嵌CE表、行号、枚举词序逐项对照，保当前字段形状/有效范围/效果映射/生成池覆盖等项目守卫 |
| U02/U06/U07/U09/U13/U14/U15/U17/U19及W/X系列 | 仅移除源码/编译C矩阵和表格oracle；实际命令、伤害/状态、生成确定性/回滚、显示RNG、完整同版本生命周期与classic/extension自身差分保留，详附录 |
| U05混合 | 去576项C谓词；原五个retry边界的输入、输出与回调断言逐值原样保留为本地小参数 |
| U05a混合 | 删除C inventory完整性/哈希依赖；所有权守恒原断言与两个数量端点保留，改由当前项目blueprint实际ownership flags驱动，以唯一id选行 |
| X2g/X2m/X4r3/X4r5/X3U8c | 剥离来源表/源码行/外部矩阵，保真实shield/no bleed、完整存读次回合、DF flare、滚动生成/极性/本地化、怪物类/重叠消费者 |
| U17外观、U19c回滚 | 保项目当前renderer/旧项目外观基线；移除CE源码行和列比较；afterAbort原0改同值0，不改回滚/完整实体断言 |
| 参考支持 | 删除`ceSource.ts`、`ceGlobalSetup.ts`、`fetch-ce-reference.mjs`、纯CE captive捕获器；Vite取消CE globalSetup，无剩余实质参考源读取依赖 |
| 夹具 | 删除34个已仅服务被移除外部C/源码对照且无消费者的资源；完整逐项夹具表见下。CE命名的项目外观基线、真实录像/分布/状态证据及historical-null-requests非法生成输入保留，不当成外部规格 |
| 注册/入口 | package取消ce:fetch/test:full/test:gen；全部27个原gen测试文件并入普通test；root及七模块manifest和runner/discovery/类型/fixture注册同步；发现文件从621＋新checker－2纯CE文件=620，无空测试文件，无静默排除 |

本步没有格式/版本升级、黄金重录或生产行为/RNG修改。保留的外观基线和既有N2/C2自然原始夹具未换身份。删除外部oracle是授权政策清理，不以重录项目黄金掩盖变化。现有项目渲染、命令、同种子生成和自身classic/extension差分仍执行自身断言。

## 旧格式审计

未发现可直接删除的旧schema接受/迁移测试；不为制造删除数量而删当前版本测试。以下看似legacy/migration的用例逐项保留：

| 文件/用例 | 实际输入与裁定 |
|---|---|
| U03 incomplete/old worlds | 旧/不完整世界直接拒绝且不改活局/RNG，保版本拒绝 |
| U27 rejects legacy recordings | 当前版本4录像改为版本1真实拒绝，保首分歧检测；没有旧录像迁移 |
| U03 flavor reassignment三模式 | 当前完整合法snapshot及当前ItemLoader restore API，对slot/稳定身份/RNG的守卫；legacy order仅过时命名改current slot order，原断言不变 |
| UX1D world-only diagnostic | 当前toSnapshot，不含完整录像来源时仍可玩但不能冒充完整录像；仅去legacy标签，不接受旧版本 |
| UX1D malformed/stale/incomplete prefixes | 当前版本来源与完整prefix非法输入拒绝，保保存prefix独立回放/seek/续录 |
| W5 migration describe | item codec的version1是当前版本；保实际反序列化不抽RNG、独立E/容量/消耗和当前完整world，改current-version命名 |
| W24/W25旧部分flavor映射 | 当前存档里非法/缺字段输入应false，保拒绝边界，不是兼容迁移 |
| C4a旧缺layer flags | 当前格式必须完整，旧缺字段拒绝，不放宽 |
| extension foundation/manifest/SDK与缺包 | 版本/规则/非法引用/缺包拒绝均保留。真实同版本缺包拒绝与旧格式兼容不同，最终全删脚本继续用原候选树真实存档录像验证 |

纯过时命名没有断言语义变化，按新政策无需无收益反事实。混合剥离保留项目断言语义。本轮两处X2g前提修复同样未改断言：①手工平地/状态编辑后保存前刷新实际vision，避免旧派生视野参与完整快照比较；②存读后切换水地形再刷新vision，使原“可见时浮出”前提成立。detail首败保留，原保存eel格isVisible=false/seen=false证据在`policy-x2g-premise-v1-detail.log`；只改观察前提，没有注入自然资源/位置/RNG，没有生产修复需求。原完整快照、20%抽样、grab/invisibility/干地浮出全部断言保留，15项正式复测通过。

## 静态依赖合同与skip边界

入口`npm run check:test-dependencies`；`npm run check:modules`依次运行边界/导入白名单与同级依赖检查，边界CLI自身也调用同一分析器。`scripts/test-dependencies.json`显式声明67个跨包文件（39模块自有、28底座），普通自身/底座无需空声明。检查完整620发现文件，不依赖可删除工厂存在。

TypeScript AST跟踪直接/间接import/export/dynamic import/require、本地helper闭包、导出常量、默认参数/实际boolean参数、manifest/startNewGame/模块请求、实际catalog安装集合；解析被导入或readFile读取的JSON和完整gzip payload，核rawBytes/SHA再遍历全部world/cache/manifest模块要求。模块字串的无业务数组和无关词句不当作需求。没有声明、遗漏、重复/未知、无实际需求的空泛/stale声明失败。生产SDK/导入白名单未放宽；仅测试消费者声明的跨模块边可合法。附录给所有发现文件的owner、推断与声明，详细每条来源/witness保存在门禁JSON。

9个既有R1安装树驱动的组合/metadata/rewards文件使用optional声明：须出现真实导入的安装发现/helper，且不能静态导入对方；原合法降级/真实缺包拒绝分支保持。其余必须required。分析器是当前TS/JSON输入的静态需求检查，不声称证明任意JavaScript控制流；既有R1/R2运行证据及本轮真实小夹具运行共同验证边界。

缺required包时Vite pre-load插件在import解析前产生一个含文件名/缺模块ID的声明组skip，保文件在发现清单中；正常树直接返回原源码，全部原断言/timeout/原prefix执行不变。粒度为文件声明组，不能称该文件原N个断言已执行，也不能拿正常树内容失败触发skip。missing模块不伪造factory/registry/状态；当前真实源集合没有跨包静态import硬边，类型/构建仍严格执行。

新增checker回归覆盖别名/绝对路径/import type/实际const拼接动态导入以及自身/底座通过、直接（含已物理删除）未声明失败、间接helper/import/manifest、导出常量/readFile JSON、fixture/extensions manifest、默认false与true真实helper输入、完整压缩raw/SHA破坏、遗漏/stale/冒名guard失败；声明满足正常执行、缺包具名skip且归属仍发现。隔离小夹具实际运行alpha→beta原value断言，正常1过exit0；真实删除beta目录后原static import不会在skip前崩溃，0过1具名声明skip exit0。这只证明checker运行边界，非真实七包删除/生命周期验收，也不累计进外层53项。

## 实际验证与身份

Node24.19.0，3072MiB，Vitest maxWorkers1/no-file-parallelism，重负载全串行。全部长stage经执行根launch-detached.py新OS session/nohup/文件stdin-out/run-child done。每条命令前后src/scripts与package/lock/vite/tsconfig集合身份相同；没有门禁运行中改源码。所有正式stage已done，不留运行中测试。末次ps状态读取被sandbox拒绝（operation not permitted），未把监督工具异常当测试结果；run-child逐stage真正wait并写done为完成凭据。

最终源码身份（1343文件，SHA256的path→fileSHA排序JSON）：`fb8be72f22f7bf43272de36a889ba3eec4dbeb72d1356d1fc2a12d0cee20c086`。完整清单`/private/tmp/brogue-commander-20261009-5z/integration-policy-evidence/final-source.json`。生产非测试src、SDK与既有集成自然fixture相比本轮开工SHA逐项不变；只清理测试、脚本/注册/配置。先前R2身份是旧候选，不能替代本轮门禁。HEAD/merge父系保持，git index空；父专属差量未纳入作者路径。

| stage / 实际范围 | exit | pass/fail | 真实skip/todo/unhandled | 名称过滤/未执行 |
|---|---:|---|---|---|
| policy-gates-v1 | 1 | runner命令清单写入遗漏json导入，0门禁 | 0/0/0 | 无测试启动，保首败 |
| policy-gates-v2 | 2 | dependency/boundary 0；types19 unused绑定首败 | 无Vitest | build/contracts未执行 |
| policy-gates-v3 | 1 | static/boundary/types/build 0；49项27过22败 | 0/0/0 | 20旧gen fixture＋1旧默认profile＋1macOS realpath；child缺包首败exit1，保原报告 |
| policy-gates-v4 | 0 | static/boundary/types/build 0；5文件51过0败 | 0/0/0 | 0；child正常1过/缺包1skip分别exit0，重叠不累加 |
| policy-final-contracts-v1 | 0 | full-static/boundary/app types/build/retained-map/structure-readers及5文件52过0败 | 0/0/0 | 全删1/release15仅plan exit0，非实际矩阵 |
| policy-related-v1 mixed-runtime | 1 | 8文件162项160过2败 | 0/0/0 | 后两个分组因首败未启动；7未改文件147项过可按文件身份沿用，整批exit1保留 |
| policy-x2g-detail-v1 | 1 | 原2项0过2败 | 0/0/0 | 13名称过滤，非内容豁免 |
| policy-x2g-premise-v1 | 1 | 2项1过1败 | 0/0/0 | 13名称过滤，诊断中间结果不当正式完成 |
| policy-related-v2 x2g | 0 | 全文件15过0败 | 0/0/0 | 0 |
| policy-related-v2 appearance-data | 0 | 8文件定向27过0败 | 0/0/0 | 82名称过滤 |
| policy-related-v2 current-format | 0 | 4文件定向13过0败 | 0/0/0 | 47名称过滤 |
| policy-path-contracts-v1 | 0 | 最终全620 static/boundary/完整types/build/两reader/5文件53过0败 | 0/0/0 | 0；全删1/release15仍只plan |
| policy-path-contracts-v2 | 0 | 最后canonical父路径/实际绝对及file URL/物理缺包负例；全620 static/boundary/完整types/build/reader/5文件53过0败 | 0/0/0 | 0；全删1/release15仍只plan |
| policy-related-v2后续 | 0 | 全620静态/边界、完整vue-tsc -b、实际Vite build均0 | 无Vitest | 无过滤；app-only旧types范围不冒称全项目 |

不把上述重叠数累计成一个“总过数”。全部原始JSON保存assertion status、snapshot、command、exit与前后身份；Vitest日志无unhandled，原todo/XP skip定义未删除，本步选中范围没有XP。JSON中pending为名称过滤时已单列，不冒充真实skip。真实缺包声明skip只出现在独立child，正常树不因已批准内容缺口跳过。

证据根`/private/tmp/brogue-commander-20261009-5z/integration-policy-evidence`，各stage对应`*-commands.json`/`*-results.json`/日志/Vitest JSON，wrapper launch/pid/done在执行根。首敗/类型失败/child解析失败原文件完整保留，raw>1MB仅在执行根，不提交。git diff --check通过、全src JSON hygiene通过、620发现membership通过、空测试文件审计0。

## 最终门禁与非阻塞缺口

可执行命令见[README实际入口](README.md#已实现入口与依赖声明)。维护者冻结本候选后，用Node24/3GiB/单worker、launch-detached串行一次执行：check:modules（含完整依赖/导入白名单）、vue-tsc -b、build、完整npm test、test:ext、test:drift、正常128 engine-only composition smoke、check:module-removal --profile=removal --retain=none --engine-only --maxWorkers=1 --output=新唯一目录。全删实际目录/所有权核对、剩余全部ext、依赖/边界/types/build、全关去重生命周期1与同版本真实缺包存档录像拒绝由入口完成。15行仅release-matrix发布前义务；本轮未执行完整npm/ext/drift/128/物理全删。

既有九行/1620公开输入、seed23/118原安全prefix、seed47完整存读seek续录、自然缓存v4非空资源与完整raw原断言/首败/timeout均保留。已批准giantHit47/zombie anchor-break/自然group内容证据缺口非阻塞；不追加自然搜索，不称整包绿。N2性能调查仅551/1620事件（550命令＋init），117.3s后监督ps/退出异常，done0只代理报告完成；depth/命令种类与窗口增长混杂，未确证产品热点或路线过重，本步未改生产性能、路线或预算。七包原900s timeout保留为非阻塞调查，不能当通过。XP skip、5D3另案、Z1-A不主动CE fetch/full/gen，Claude最终候选人工仍待验。六项与SDK闭环不重开。

## 夹具逐项分类

| 文件 | 处理 | 理由 |
|---|---|---|
| src/test/fixtures/x2o-ce-catalog.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u17c-ce-catalog.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/x4-r1-ce-terrain.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/u17d-ce-catalog.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/u19e-ce-catalog.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u19c-ce-order.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u21c-ce-terrain.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/x3b/public-recording.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/x4-r1/ce-additions.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/u-15d3/ce-golden.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-14a/ce-weakness.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/x2g/ce-oracle.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/w-24/distribution.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/w-23/ce-negation.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/x2f/ce-thrown.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-05a/ownership-cases.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-05/ce-golden.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-05/historical-null-requests.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/u-13/ce-combat.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-02b/ce-reference.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-15b2/ce-golden.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/x3a/ce-iterator.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/x4-r4/state-matrix.txt | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/x2j/ce-state.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u19b-ce-occupancy.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u03b-ce-follow.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u19f-ce-catalog.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u17b-ce-catalog.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u17e-ce-catalog.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/u19d-ce-catalog.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/x2g-ce-terrain.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/w-17/ce-domination.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/x2e/ce-oracle.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-06/ce-staff-damage.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/w-19/ce-catalog.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/w-19/ce-polymorph.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/w-20/ce-clone.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-14b/ce-donning.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/x4-r5-ce-text.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/u17f-ce-catalog.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/captive-ce-terrain.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/u19a-ce-view.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/u19a-ce-carriers.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/w-18/ce-entrancement.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/x2k/ce-path.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/w-21/ce-empower.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/w-16/ce-blade-count.txt | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/u-09/ce-target-cases.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |
| src/test/fixtures/ce-oracles/w-26/distribution.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/w-26/entry-audit.json | 保留 | 保项目当前外观/场景键/非法请求输入或真实录像/状态/分布证据；来源命名不作为CE规格，当前消费者保留 |
| src/test/fixtures/ce-oracles/u-07/ce-blink.json | 移除 | 仅被已移除CE源码/编译C逐项对照使用；无当前项目输入/生命周期消费者 |

## 用例逐项分类（定义数，非运行数）

| 文件 | 原用例标题 | 判定 | 理由 |
|---|---|---|---|
| src/data/armors.test.ts | '6 件护甲 id 全部存在' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/armors.test.ts | 'banded_mail：str=15，armor=7（CE 70 ÷10）' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/armors.test.ts | 'chain_mail：str=13，armor=5（CE 50 ÷10）' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/armors.test.ts | 'leather_armor：str=10，armor=3（CE 30 ÷10）' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/armors.test.ts | 'plate_mail：str=19，armor=11（CE 110 ÷10）' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/armors.test.ts | 'scale_mail：str=12，armor=4（CE 40 ÷10）' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/armors.test.ts | 'splint_mail：str=17，armor=9（CE 90 ÷10）' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/hordes.test.ts | '#0 RAT：L746 {MK_RAT,0,{0},{{0}},1,5,150}，尾部字段省略' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#111 TENTACLE_HORROR 地牢俘虏：L867 maxLevel=AMULET_LEVEL=26' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#113 GOBLIN 雕像：L871 spawnsIn=STATUE_DORMANT，1/6/100' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#174 末条 GOBLIN 兵营俘虏：L948 3/7/10，MACHINE_GOBLIN_WARREN\|LEADER_CAPTIVE' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#19 VAMPIRE_BAT：L765 成员{1,2,1}，6/13/70，HORDE_NEVER_OOD' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#21 GOBLIN 三成员：L767 {GOBLIN{2,3}, GOBLIN_MYSTIC{1,2}, JACKAL{1,2}}，6/12/40' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#32 GOBLIN_TOTEM 四成员：L778 machine=MT_CAMP_AREA(62)，10/17/80，NO_PERIODIC' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#4 EEL：L750 {MK_EEL,…,2,17,100,DEEP_WATER}，省略 machine/flags' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#56 TENTACLE_HORROR：L802 maxLevel=DEEPEST_LEVEL-1=39，22/39/100' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#62 KRAKEN 深水群：L808 30/39/100 DEEP_WATER，成员{5,10,2}' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#65 GOBLIN_CONJURER 召唤：L813 0/0/100，SUMMONED\|DIES_ON_LEADER_DEATH' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | '#75 MONKEY 俘虏：L825 1/5/10，LEADER_CAPTIVE\|NEVER_OOD，成员 KOBOLD{1,2}' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/hordes.test.ts | 'D1 可用常规 horde >= 3（CE 真值 3：RAT/KOBOLD/JACKAL）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/data/hordes.test.ts | 'D3/D5/D8/D12/D17/D22/D26 各深度可用常规 horde >= 8' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | 'HORDE_LEADER_CAPTIVE 条数 = 56（锚点 56）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '上述深度实际数量（防回归快照）: D3=10 D5=12 D8=18 D12=23 D17=22 D22=16 D26=11' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '常规池条数 >= 55（实际 58，锚点 58）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '常规池（领袖+全部成员）可产出物种数 >= 40（实际 41；修复前旧表仅 9）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '总条数 = 175（CE hordeCatalog_Brogue L746-948）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/data/hordes.test.ts | '每条 member：type 字符串、0 <= minCount <= maxCount' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '每条：flags 必为数组（省略 flags 的条目序列化为 []，不是 null）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '每条：leader 字符串、members 数组、min/maxLevel 数字、frequency 数字' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '每条：machine 必为数字（省略 machine 的条目序列化为 0）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/hordes.test.ts | '每条：spawnsIn 为字符串或 null（CE 为 0 时 = null）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/data/hordes.test.ts | '陆生主力物种（goblin/ogre/troll/wraith/kobra 系等）已进入常规池' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsterBolts.test.ts | 'SLOW_2 不在 BoltEffect 里单独存在（CE 用 BE_SLOW 复用同一效果，仅强度不同——GlobalsBrogue.c:62,81）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/data/monsterBolts.test.ts | 'arrow_turret：单 bolt，炮塔型（Globals.c:1055）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'dar_battlemage：三 bolt，含已知缺口 SLOW_2（Globals.c:1090）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'dar_priestess：四 bolt，顺序为源码原始顺序而非字母序（Globals.c:1088）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'dart_turret：单 bolt，炮塔型（Globals.c:1100）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'dragon：单 bolt，DRAGONFIRE（Globals.c:1123）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'goblin_mystic：单 bolt，法师型（Globals.c:1045）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'goblin_totem：双 bolt，固定顺序 HASTE 在前（Globals.c:1047）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'mangrove_dryad：单 bolt，U08 DF 施法 ANCIENT_SPIRIT_VINES（Globals.c:1163）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'pixie：四 bolt，顺序为源码原始顺序（Globals.c:1108）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'spark_turret：单 bolt，炮塔型（Globals.c:1069）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'spider：单 bolt，U08 DF 施法 SPIDERWEB（Globals.c:1067）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | 'vampire：双 bolt，BLINKING 在前（Globals.c:1131）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | '带 bolts 的怪物恰好 25 只（Globals.c monsterCatalog 逐条核对结果）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsterBolts.test.ts | '无 bolts 的怪物一律为空数组（抽样：rat 无远程攻击）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsterBolts.test.ts | '每条 bolts 里的名字，要么能映射到现有 BoltEffect 枚举，要么在已知缺口清单内——不允许第三类未知名字' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsterBolts.test.ts | '每条怪物都具备 bolts 数组字段（无 undefined，缺省为空数组）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsterBolts.test.ts | '汇总：带 bolts 的怪物涉及的 bolt 种类恰好 15 种' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsterDamage.test.ts | '共 67 条怪物，全部有 damage 字段' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsterDamage.test.ts | '每条 damage 经 CombatSystem.parseDamageString 的 min/max 与 CE 一致（行号为 Globals.c monsterCatalog 表体）' | 移除 | 内嵌CE源码表/行号的逐项数值或词序对照；混合文件项目形状/映射/常规生成池守卫保留 |
| src/data/monsterDamage.test.ts | '非 {0,0,0} 怪物记法解析语义为 1dN(+M)（clumping=1）；{0,0,0} 怪物使用 0d1（min=max=0）' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/monsters.test.ts | 'CE 黄金值硬断言（注释中的 L 行号为 Globals.c monsterCatalog 表体）' | 移除 | 内嵌CE源码表/行号的逐项数值或词序对照；混合文件项目形状/映射/常规生成池守卫保留 |
| src/data/monsters.test.ts | '共 67 条，每条都具备 5 个有限数值字段（无 undefined）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsters.test.ts | '取值区间合理' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/monsters.test.ts | '既有字段未被合并脚本破坏（抽样核对保留字段仍在）' | 保留 | 当前项目自身字段/映射/生成池正确性守卫，外部来源为历史注释 |
| src/data/weapons.test.ts | '12 件 CE 武器 id 全部存在' | 移除 | 整份文件仅内嵌CE权威表逐件数值/存在性对账；不含项目独立命令/生成/生命周期守卫 |
| src/data/weapons.test.ts | 'axe：str=15，1d3+6 → min=7/max=9/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'broadsword：str=19，1d9+13 → min=14/max=22/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'dagger：str=12，1d2+2 → min=3/max=4/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'dart：str=10，1d3+1 → min=2/max=4/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'flail：str=17，1d7+8 → min=9/max=15/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'mace：str=16，1d5+15 → min=16/max=20/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'rapier：str=15，1d3+2 → min=3/max=5/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'spear：str=13，1d2+3 → min=4/max=5/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'sword：str=14，1d3+6 → min=7/max=9/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'war_hammer：str=20，1d11+24 → min=25/max=35/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'war_pike：str=18，1d5+10 → min=11/max=15/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/data/weapons.test.ts | 'whip：str=14，1d3+2 → min=3/max=5/clumping=1' | 移除 | 仅CE权威表逐项对照，已人工逐用例确认 |
| src/engine/Combat/BoltCatalog.test.ts | '21 CE item identities follow the actual staff/wand power columns; inventions get no CE item identity' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/engine/Combat/BoltCatalog.test.ts | 'CE magnitude records source and consumer units, never charges, computed damage or legacy defaults' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Combat/BoltCatalog.test.ts | 'all 30 types and 22 effects retain CE enum values; all 10 flag bits include the bit-5 gap' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/engine/Combat/BoltCatalog.test.ts | 'every CE catalog row preserves all 12 fields, including forbidden flags, glyph/color symbols and DF references' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/engine/Combat/BoltCatalog.test.ts | 'the 15 native entries retain their projections, plus U09 learnable identities and CE forbidden exceptions' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Combat/BoltCatalog.test.ts | 'web dispatch aliases preserve ATTACK versus DAMAGE and append type-only POLYMORPH/PLENTY without renumbering' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Combat/BoltContract.test.ts | 'knowing the full CE catalog does not enable generic monster blink' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Combat/CombatFormulas.test.ts | '有害/表外符文固定 15（PowerTables.c:303-305；mercy=CE 有害符文，vampirism/venom 为 web 自创按同口径）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Combat/CombatFormulas.test.ts | '迟滞/迅捷攻速修正（web 数据暂无对应标志，用合成上下文验证 CE PowerTables.c:314-316、331-338）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Core/startingKit.test.ts | 'normal 模式：背包含口粮/匕首/飞镖/皮甲，且发放顺序与 CE 一致' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Items/itemFlavors.test.ts | '1a. 每个外观池的大小 >= 对应未知物品种类数（CE 五类全覆盖）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/Items/itemFlavors.test.ts | '2c. CE 护符出生即鉴定，无外观映射时仍显示完整中文名称' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/engine/UI/Discoveries.test.ts | 'shows true names for the five CE tables and omits missing web kinds' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts | 'a real staircase follower migration cancels previously paid member shapes and preserves loadable source ledgers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/ext/modules/crafting/tests/crafting_geometry.test.ts | 'real crafting work positions and every interaction ray survive the 5A3 migration' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/ext/modules/foraging/tests/foraging_eat.test.ts | 'independent crypto oracle selects roast policy %i and verifies actual effect plus separate raw knowledge' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/ext/modules/growth/tests/ext_growth_ui.test.ts | 'preserves intrinsic search and other badges in the compiled immersive cascade at %i px' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/ext/modules/narrative/tests/narrative2_trace.test.ts | 'N2-TRACE $name: fixed real public commands retain full mechanical and message checkpoints' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ai_1_scent_tracking.test.ts | 'A1 玩家穿门后西侧气味 = CE 时序手推值 1013..1023；踩门回合末门开、走完后门关' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ai_1_scent_tracking.test.ts | 'B2 路径②感知丢失（硬截断）：perceived > awareness*3 → WANDERING（CE Monsters.c:1776-1779）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b1_retire_invented.test.ts | 'CE $ce qualifies with $flag on every allowed depth' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b1_retire_invented.test.ts | 'CE $ce reaches placement through weighted chooseBP with $flag' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b1_retire_invented.test.ts | 'keeps the engine retirement set exactly equal to all null CE identities' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'CE %i/F%i has personalSpace %i' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'CE %i/F%i layer contract and actual production carrier are distinguished' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'CE %i/F%i now starts the closed U17c DF %i' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'CE %i/F%i starts U17e DF %i; full-room drops consume the generated pipes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'CE15 fungus follows tile, promote/fire, propagation and subsequentDF edges without deferred promotion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'CE55 MAXIMIZE is present and U19f restores its closed tunnel consumer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'observes committed CE71 machines and their actual occupants on 34 seed × D1–D26' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'retains CE40 F5/F6=1 and fills CE31 hallway flag, CE10 weight, CE71 exact monster id' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b2_transcription.test.ts | 'the same CE71 machine realizes zero sentinels with the old id, and three living grid occupants with the real id' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1_weapon_specials.test.ts | 'weapons.json 旗标照 CE Items.c:209-236 补齐：dagger/rapier/flail 三件，' +<br>        '且经 spawnWeapon 流入 Item；其余武器的既有数值（damage/strengthRequired/' +<br>        'weight）一个都不许动。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1_weapon_specials.test.ts | '留痕（本轮明确不做：CE abortAttack 确认提示）+ 盟友不进 hitList：连枷弧线' +<br>        '上站着盟友、双相邻格上有敌人时——整回合一次走完（无任何确认回合，' +<br>        'currentTick 恰好 +attackSpeed），盟友毫发无损、敌人挨打；CE 需要确认的' +<br>        '酸怪场景 web 照打（同一条 hitList 路径）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1_weapon_specials.test.ts | '留痕（本轮明确不做：镜像盟友继承武器旗标，CE Combat.c:755-772）：web ' +<br>        '盟友没有武器槽，玩家武器旗标不存在被盟友继承的通路——盟友实例上无 ' +<br>        'equippedWeapon/flags 武器旗标字段。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1a_identification.test.ts | 'CAN_BE_IDENTIFIED 维护（CE updateIdentifiableItem，Items.c:7699-7713）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1a_identification.test.ts | 'L1 全链 D1..D26 每件生成物品都落在物品合法格（CE T_OBSTRUCTS_ITEMS\|T_PATHING_BLOCKER 回避）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1a_identification.test.ts | '戴上即亮种类：clairvoyance/stealth（CE Items.c:8583-8586）；普通戒指不行' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1a_identification.test.ts | '接线：真实近战击杀扣减 1；击杀无生命怪不扣减（CE Monsters.c:157-159）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1a_identification.test.ts | '诅咒绝不进名字（CE 无 cursed 前缀分支；玩家经"摘不下"得知）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1a_identification.test.ts | '边界：1499 块不亮、第 1500 块实例+种类一起亮（CE identify()）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1b_identification_persistence.test.ts | 'call 拒绝已识别种类（CE "you already know what that is."）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1b_identification_persistence.test.ts | '无可鉴物品：不进待选态、卷轴照常消耗（CE "already identified" 短路）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | 'CAN_BE_DETECTED 类别集与 CE Rogue.h:770 逐项一致（食物/金币/钥匙不在内）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | 'allies 后缀为 -1，敌向为 +1；三件自创兼容项仍无 CE 后缀' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | '入口B：对侧极性类的极性**全部已知**（identified 或 revealed 都算，CE :6617-6620）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | '存读一轮：两级状态都往返；新局清零（CE resetItemTableEntry :8777）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | '护身符恒 +1（CE charmTable 的 magicPolarity 列全 +1）；安卡恒 +1（CE :8295）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | '武器/护甲/戒指按**实例**的诅咒与附魔算，不查种类表（CE :8272-8277 / :8287-8293）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | '读恶意卷轴走同一条闸（CE :7757-7767）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_1c_detect_magic.test.ts | '魔杖充能耗尽 → 0，有充能 → 贯穿到种类表（CE :8278-8281 的 fallthrough）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_2_throwing.test.ts | 'K1b: 瘫痪时 throw_item 被拦（CE 瘫痪不能投掷）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_2_throwing.test.ts | 'W1: 投掷击杀不消耗任何武器熟悉度（CE hitMonsterWithProjectileWeapon 不调 decrementWeaponAutoIDTimer）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_2_throwing.test.ts | '登记钉子：X2g POTION_DARKNESS 投掷 DF 闭环后按 CE 频率入池' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | 'CE_METERED_ITEMS_TABLE 30 条、顺序与 CE 对齐，三条非零条目为 CE 原值' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | 'chooseKind 消耗恰 1 次随机数（CE rand_range(1, total) 一次）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | 'dart 基表频率 0：在武器池上抽 20000 次一次都不出现（CE：飞镖不参与随机生成）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | 'enchanting / life / strength 的基表（json）频率为 0，跑完一局后仍为 0（CE memcpy 还原语义）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | 'foodSpawned 公式的整数口径与 CE 一致：D1-D2 无保底，D3 起可触发（CE Items.c:685-691）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | 'potion_of_poison（CE caustic gas）整局生成中出现——B-4a 回池的直接产物' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | '产物侧：300 次生成恒 enchantment=0、无符文、不诅咒，quantity/quiver 在 CE 区间' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4a_item_generation.test.ts | '计量状态随开局重置：新局的 initialFrequency 与 CE 一致（enchant 60 / life 0 / strength 40）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4b_item_placement.test.ts | 'T5 选点扫描序 = i 外 j 内（CE Items.c:520-528）——对抗③（换 j 外 i 内）必红' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/b_4b_item_placement.test.ts | 'T8 金币：堆数在 CE 公式带内、quantity 在 rand_range(50+d10, 100+d15) 带内' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'allows only one web owner for each CE index' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'covers exactly the audited CE set' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'preserves all 81 audited owners, including distinct statuary entries and CE 52' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'rejects a newly added blueprint whose CE field was forgotten' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'rejects losing an implemented CE blueprint' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'rejects swapping CE %s and %s while preserving set and uniqueness' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_ce_coverage.test.ts | 'requires an explicit null or integer CE index on every row' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_center.test.ts | 'g) CE8 空锚点只接受原实例经子机成功领养的落物；伪造实例或 feature 不得放行' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/blueprint_center.test.ts | `b) 全局扫描（${SCAN_SEEDS.length} seeds × D1..D26）：房间 center 可通行、区域 origin 属于 interior（CE8 空域单独验证）` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_1_room_profile.test.ts | 'B1 对抗（首房间未固定为入口房）：D1 首房间恒为 ENTRANCE_ROOM，D2+ 恒非入口房' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_1_room_profile.test.ts | 'B2 对抗（attach 池混入 6/7 号房）：CE 调整后 [6]/[7]=0 → 抽取计数逐层钉死' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_2_lakes.test.ts | 'C-5 已反转（原断言：无绕行 → 不架桥，据"C-2 留形 pathingDistance 不可达=-1"）：' +<br>        '无绕行的全高深渊带恰恰必须架桥（CE Dijkstra.c:247 pdsClear 30000——' +<br>        '不可达距离 30000 使比值判据恒真，这正是桥存在的意义）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_2_lakes.test.ts | 'C-5 已反转（原留痕：liquidType 全深度域永不产生深渊族——风险裁决 1）：' +<br>        '候选域恢复 CE 原样后，深渊族在全深度域出现且镶边契约恒成立' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_2_lakes.test.ts | '对抗 AD-A2：最深层特例——depth=40 恒深水（CE 2526-2528）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_2_lakes.test.ts | '对抗 AD-A5b：深水带不可架桥（T_CAN_BE_BRIDGED = 深渊独占，CE Rogue.h:1953）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_2_lakes.test.ts | '门不是边界：[深水][门][深水] 的门原样保留（CE DOOR 无 OBSTRUCTS 旗标）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_3_walls_doors.test.ts | 'T1 secretDoorChance：CE Architect.c:2735 整除表 + clamp(0,67)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_3_walls_doors.test.ts | 'T5 真实关卡不变量：终态 GRANITE 的 8 邻必全部不暴露（等价于 CE 裸露补墙收敛）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_0_layer_model.test.ts | 'DungeonLayer 数值序逐值对齐 CE Rogue.h:1293-1300（GAS 在 SURFACE 之前）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_0_layer_model.test.ts | 'skipGas 跳过 GAS 层（CE skipGas 形参逐位照搬）；terrain getter 固定 skipGas（G-1）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_0_layer_model.test.ts | '液体必须落 LIQUID：把某个液体写进 SURFACE 的错误实现在这里翻红' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_0_layer_model.test.ts | '表面地形必须落 SURFACE，结构地形必须落 DUNGEON' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'B-3 新增条目：FORCEFIELD（Globals.c:477）/ FORCEFIELD_MELT（:478）逐字段钉死' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'B-3：迁移后新增的墙族 tile 的通行判定 = CE 查表口径（挡通行、不进旧清单）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'F-1 新增条目：PLAIN_FIRE（CE Globals.c:492）逐字段钉死' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'F-2a 新增条目：EMBERS（CE Globals.c:469）与 ASH（:461）逐字段钉死' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'G-3 新增条目：PARALYSIS_GAS（CE Globals.c:506）逐字段钉死' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'V-2b-2b 新增条目：机器蓝图地形载体六条逐字段钉死（CE Globals.c 原列）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'V-2b-3：wired 载体九条的通行判定 = CE 查表口径（四条墙族挡通行、五条可走）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'V-2b-4：祭坛族七条的通行判定 = CE 查表口径（三条墙族挡通行、四条可走）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'V-2b-5：休眠载体七条的通行判定 = CE 查表口径（五条墙族挡通行、两条可走）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'V-2b-6：钥匙轮载体的通行判定 = CE 查表口径（两条挡通行、四条可走）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4a_terrain_catalog.test.ts | 'V-2b-7：DF 特征系统轮载体的通行判定 = CE 查表口径（三条挡通行、十六条可走）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'A4 种子格清理：requirePropTerrain 且种子格自身没有 propTerrain → 收尾清 0（CE :3327-3329）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'A5 startProbability=0：footprint 恰为种子一格（CE while 直接不进）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'B4 对抗：SURFACE 层 + T_OBSTRUCTS_SURFACE_EFFECTS 禁止（漏守卫在此翻红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'C4 DFF_CLEAR_OTHER_TERRAIN：足迹内其余非 GAS 层清空（DUNGEON 归 FLOOR、SURFACE 归 NOTHING）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'D3 countRegionSize=true 返回相触区对中较小者的格数（CE :3186-3190）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'E1 W-14 恰 135 条（原 134 + DF_FORCEFIELD）；历次闭包（C-6 增补 DF_GRASS/DF_FOLIAGE；B-3 增补 DF_FORCEFIELD_MELT/DF_SACRED_GLYPHS/DF_SHATTERING_SPELL；T-1 增补 DF_CRYSTAL_WALL；V-2b-2b 增补 DF_SHOW_TRAPDOOR_HALO/DF_SHOW_TRAPDOOR/DF_WOODEN_BARRICADE_BURN——TRAP_DOOR_HIDDEN.discoverType 与 WOODEN_BARRICADE.fireType 的载体，CE Globals.c:627/628/825；V-2b-3 增补 14 条 wired 载体 DF 链，见下；V-2b-4 增补 8 条祭坛族载体），且 DF 枚举 id 与 CE 枚举逐一对位（Rogue.h:1469 起）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4b_dungeon_feature.test.ts | 'F3 留痕（C-6 已到期翻转）：生产生成的多层格仅限 CE 核实组合 + GAS 恒空' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4c_promotion.test.ts | 'A4 缓办不改地形：缺 tile DF 的 vanish 先行会造成 CE 不存在的半晋升态——不允许' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_4c_promotion.test.ts | 'D1 踩门开门 + 同回合客观块自动关门（CE：OPEN_DOOR promoteChance=10000）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_5_fall_subsystem.test.ts | '喝下坠药水：原地开出 HOLE（DF_HOLE_POTION → DF_HOLE_2 链）且回合末坠落；' +<br>        '悬浮时洞照开、人不坠（CE Items.c:8098-8100）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_5_fall_subsystem.test.ts | '未发现的渊：不弹确认直接坠落（蒙眼跳坑是 CE 原味——方向写反即在此翻红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_5_fall_subsystem.test.ts | '深水落点零伤害（CE :1146-1150 "unharmed"）；浅水落点减半（CE :1156-1158 ' +<br>        'TM_ALLOWS_SUBMERGING，damage /= 2 整除）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_5_fall_subsystem.test.ts | '踩上渊格的同一动作里怪物不得获得回合（CE：playerFalls 整段 return，' +<br>        '没有怪物推进）；坠落本体在玩家回合末照常发生' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_6_autogenerators.test.ts | 'AD-5 对抗：深度约束——写反或边界开合写错在此翻红（CE 含两端）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_6_autogenerators.test.ts | 'AD-6 对抗：randomMatchingLocation 的 CE 语义——500 次全败返回 null 且恰消耗 1000 个随机数' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_6_autogenerators.test.ts | '哨兵 S-1：非机器 wired 条目 U19f 覆盖全部 CE 非机器地形；机器接线集合精确覆盖 13 条' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_6_autogenerators.test.ts | '实测：草/树的实际生成数随深度分布（CE 数量公式的 web 落地曲线）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_6_autogenerators.test.ts | '留痕 T3 反转：V-2b-9e-2 接齐全部 13 条 CE 机器族' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_6_autogenerators.test.ts | '留痕 T5：index 0（granite column）是 CE 上游死条目——除非上游修复，永不接' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_7_lighting.test.ts | 'CE 固有光让深层矿灯以外的 wisp 可见' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_7_lighting.test.ts | 'NO_LIGHT 是 CE {0} 原样（含 clumpFactor=0）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_7_lighting.test.ts | '全 tile 的 glowLight 逐值等于 CE 原列（结构性穷尽）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_7_lighting.test.ts | '关键地形光条目逐字段等于 CE 原值（含 randomRange 型半径——抄成定值即红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_7_lighting.test.ts | '留痕（UI-1 第 7 条已反转，2026-09-18）：渲染层消费 lightAt 三通道做 CE 乘法，仍不得直接 import 光照目录/paintLight' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/c_8_connectivity.test.ts | 'T3 机制断言（AD1）：壕沟夹具上 CE 判据放行、移动图判据判切断、spawnDungeonFeature 真实否决' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'CE surface assignment replaces fungus foliage and removes only its opacity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'all eight identities have the complete nonblocking CE decoration fields and visible directional glyphs' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'all eight tile rows match the actual CE source'+(hasCeSource()?'':' - '+CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/captive_manacles.test.ts | 'blocked diagonals fall back vertically first; an invalid vertical anchor falls back horizontally' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'display keeps known direction in vector mode, conceals undiscovered cells, and uses remembered terrain after leaving sight' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'four blocked diagonal anchors use up/down before left/right' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'ineligible anchors include stairs, a liquid bridge and the map boundary; surface decorations are replaced like CE' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'natural horde entry places the four diagonal chains on the surface without displacing dungeon terrain' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'normal deterministic recording with a naturally generated captive replays and seeks without OOS' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'placement consumes neither RNG stream and preserves physical passability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'save/load retains chains and rescuing via a real move releases the monster, leaving the floor anchors as in CE' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'selection leaves all grid state and both RNG streams untouched' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/captive_manacles.test.ts | 'special-terrain captives do not receive chains; ordinary hostile hordes do not either' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/dialog_host.test.ts | 'renders stable selectors, danger, Chinese long text and both buttons, focuses no, and keeps CE Enter=yes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/dialog_service_input.test.ts | 'CE confirm %s answers %s once and swallows repeat/key-up through the next request' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_combat_adapter_foundation.test.ts | 'rejects prior foundation manifest and snapshot versions without migration' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_generation_checkpoint_differential.test.ts | 'the retained oracle itself restores shared cycles, descriptor changes and typed bytes in place' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_module_removal.test.ts | 'hashes source/tests/resources without counting preserved CE reference or generated/raw evidence' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_module_removal.test.ts | 'prepares real deletions with exact test ownership, preserved CE sources and fresh caches without claiming execution' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_recording_async.test.ts | 'keeps no-Worker public synchronous path and the pure independent full oracle' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_stats_review.test.ts | 'F1 clamps module speeds to 25..max(400, CE speed), and zero rows preserve slow turret identity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_stats_review.test.ts | 'F1 preserves every CE monster speed under slow/haste and all mutations, including spell-slow actors' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_stats_review.test.ts | 'F8 zero modifiers preserve CE damage and random consumption for %j' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_structure_geometry.test.ts | 'C5 work positions and every interaction ray match the pre-migration baseline' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ext_world_work_review.test.ts | 'dirty domains reuse clean hashes and agree with the independent oracle after writes/rollback' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_1_fire_as_terrain.test.ts | 'igniteForced 在非可燃地形（地板）上：火 DF 照落、烧的是火地形本身，' +<br>        '衰老后落 EMBERS/ASH（CE：火 DF 铺在任何地表上，石地板不参与燃烧）。' +<br>        '错误实现：地板火"原样熄灭不留痕"（F-1 行为）——F-2a 产物是 CE 的。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_1_fire_as_terrain.test.ts | '燃烧格（有效地形=火）不吃血迹；CE：血 DF 的优先级判定弹开火（10<80）。' +<br>        '错误实现：把血液 DF 改成 terrain setter → 清掉火层，制造脱钩。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_1_fire_as_terrain.test.ts | '燃烧草格的有效地形 = PLAIN_FIRE（CE：可燃物被火消耗，同层替换）；' +<br>        '火 DF 落在门上时有效地形仍是门（prio 8 < 10）。' +<br>        '错误实现 a：prio 抄成 >60 → 草压住火，第一对断言红；' +<br>        '错误实现 b：prio 抄成 <8 → 火压住门，第二对断言红。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_1_fire_as_terrain.test.ts | '蔓延出的火同样是"火地形"（CE：可燃物被消耗）。' +<br>        '错误实现：只在 ignite 入口落火地形、火段蔓延路径绕过。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2a_fire_mechanics.test.ts | 'BOG（webOnly）目录记 T_IS_FLAMMABLE 但无 fireType/chanceToIgnite=0——' +<br>        '直燃无 DF 可落、掷骰路径概率为 0：BOG 不再可点燃（web 旧白名单行为退役）。' +<br>        '若未来给 BOG 定 CE 化的火数据，须先改 TerrainCatalog 再翻本断言。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2a_fire_mechanics.test.ts | 'igniteForced（CE 火 DF 生成家族）在楼梯/祭坛上落不了火；对照地板照落。' +<br>        '错误实现：绕开 DF 管线直写 SURFACE 层（F-1 旧 igniteForced）→ 楼梯/祭坛照烧。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2a_fire_mechanics.test.ts | '直燃路径（exposeTileToFire）同样伤不到楼梯/祭坛——它们不可燃，' +<br>        '暴露计数都不动（CE :1308 T_IS_FLAMMABLE 先决）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '在火格挂上状态后走到草地，草地必须被直燃（alwaysIgnite：Gas.ignite 即' +<br>        'CE Time.c:539 exposeTileToFire(x,y,true)）；未着火的对照生物不得点燃' +<br>        '脚下草地。捕获的错误实现：else-if 接线缺失（移动火种不点火）或漏掉' +<br>        'burning 前置（任何生物都能点火）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗①：离开火格后燃烧必须继续——状态没挂上的实现（伤害只在站火格时' +<br>        '发生，web 旧"平扣"形态）在此翻红。CE：exposeCreatureToFire 只上状态' +<br>        '（Time.c:59-60），伤害来自每回合燃烧结算（Time.c:2581-2591），与脚下' +<br>        '地形无关；烧 ~7 回合后自然熄灭，伤害随之停止。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗②：站在火里反复暴露，剩余时长必须刷新到恰好 7 而非叠加——' +<br>        '写成 current + 7 的堆叠实现 12 块后累计 80+，在此翻红。' +<br>        'CE Time.c:59-60：status = max(status, 7)。（CE 的 max 语义下靠暴露' +<br>        '本身到不了 >7，"更高值保留"半边不可达，不设断言。）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗③：燃烧的生物蹚进浅水必须被扑灭——灭火分支失效（站水里还在烧）' +<br>        '在此翻红。CE Time.c:226-232：TM_EXTINGUISHES_FIRE && burning && ' +<br>        '!levitating → extinguishFireOnCreature。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗⑤：喝下抗火药水后站进火里必须完全不掉血、不上燃烧状态——' +<br>        'P1-44 的三重断线（grantTemporaryImmunity(\'burning\' as any)：键不' +<br>        '存在 + 通道无读者 + 伤害端查的是 immune_fire）复发时在此翻红。' +<br>        'CE Items.c:8188-8193：IMMUNE_TO_FIRE = magnitude，且 exposeCreatureToFire' +<br>        ' 的豁免让免疫者连状态都拿不到（Time.c:31 直接 return）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗⑧：燃烧伤害必须落在 CE rand_range(1,3) 的支撑集内——30 只独立' +<br>        '各烧一块的 rat 总伤 ∈ [30, 90]（支撑带，带外概率为 0，非统计脆弱）。' +<br>        '捕获的错误实现：0 伤害（结算段没接）或 ≥4/块（量级走样）。' +<br>        '"伤害恒等于 2"的平扣复辟由 p1_28 对照组的分布锁翻红。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗⑨：着火时喝药必须立即扑灭（CE Items.c:8190-8191：若在烧则' +<br>        'extinguishFireOnCreature）——只加免疫、不灭 existing 火的半实现翻红。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2b_creature_burning.test.ts | '对抗⑪：怪物被烧死 → die() 收口（hp=0、尸符）+ "burns to death" 铭牌' +<br>        '（CE Monsters.c:1887-1895 "%s burns to death." + killCreature）。' +<br>        '捕获的错误实现：烧死只扣血不收口（尸体满血赖在怪物表）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2c_explosion.test.ts | '对抗③a：免疫跟着生物走，不跟格走——挨炸后**移动到另一格爆炸地形**上' +<br>        '仍免疫。按格记账的实现（Set<格>）在新格查不到记录 → 再扣一次（翻红）。' +<br>        'CE 依据：Time.c:347 是 monst->status[STATUS_EXPLOSION_IMMUNITY] = 5——' +<br>        '生物身上的状态（任务书"按格记账"为转述错误，按 CE 翻正）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2c_explosion.test.ts | '对抗④：爆炸格在下一个晋升趟必须清层消失（promoteType 0：清层不落新 DF）。' +<br>        'promoteChance 记 0（永不衰老）或漏抄 VANISHES_UPON_PROMOTION（晋升了但' +<br>        '地形留着）的实现都翻红。CE：Globals.c:496 第 8 列 10000 + mechFlags ' +<br>        'VANISHES；Time.c:1644 掷骰必中、:1254-1266 清层。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2c_explosion.test.ts | '对抗⑤：bloat 爆炸的第 1 笔是瞬时的 max(15-20, maxHP/2)（不经燃烧状态、' +<br>        '不等客观块），第 2 笔是爆炸铺的火点燃生物后的燃烧结算 1-3。把两笔' +<br>        '合并成一笔（只点燃烧不瞬伤 / 燃烧段再爆一次 50）的实现都翻红。' +<br>        'CE 依据：fillSpawnMap refresh 分支（Architect.c:3255）当场结算 + ' +<br>        'Time.c:527 火点燃生物 → :2581 燃烧 1-3。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2c_explosion.test.ts | '对抗⑥：石地板上死亡格必落 GAS_EXPLOSION（种子格无条件标记），且 BFS ' +<br>        '距离 2/3 的格必中（第 2/3 波 250%/150% ≥ 100 恒真）——退回 igniteForced' +<br>        '×5（落 PLAIN_FIRE、只到距离 1）或参数错记 60/17（距离 2 只有 43%）的' +<br>        '实现都翻红。CE：Globals.c:654 {GAS_EXPLOSION, SURFACE, 350, 100}。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2c_explosion.test.ts | '对抗⑧：悬浮生物站在爆炸格上照常受击。把熔岩/深水的悬浮豁免' +<br>        '（Time.c:183-190）错误地复制到爆炸段的实现翻红——CE 爆炸段没有' +<br>        'STATUS_LEVITATING 守卫（只查 STATUS_EXPLOSION_IMMUNITY 与 ' +<br>        'MB_SUBMERGED，web 无潜水簿记已登记）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/f_2c_explosion.test.ts | '对抗⑨a：玩家站在爆炸格 → 掉 max(15-20, maxHP/2) 血且 lastDamageSource ' +<br>        '= violent explosion（CE gameOver "Killed by a violent explosion" 的' +<br>        'web 等价铭牌链）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_1_gas_volumetric.test.ts | 'Game.objectiveTimeBlock 的探测守卫：无气体回合跳过两轮（CE Time.c:1600-1613）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_1_gas_volumetric.test.ts | '单轮均分后对角邻格必须拿到体积（CE nbDirs 8 向，GlobalsBase.c:38）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_2_gas_df_wiring.test.ts | 'X4-R1 HEALING 与 X2g ROT/DARKNESS 均有真实 CE 地形和 DF 来源' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_2_gas_df_wiring.test.ts | '浅水不可燃（CE SHALLOW_WATER ign=0）：贴火不产蒸汽——灭火层不是蒸锅炉' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_2_gas_df_wiring.test.ts | '目录级：三条 GAS DF 的 tile 归属层必须是 GAS；DF_GAS_FIRE 的必须是 SURFACE' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_2_gas_df_wiring.test.ts | '行为级：点燃毒气后 GAS_FIRE 落在 SURFACE 层，GAS 层绝不出现 GAS_FIRE' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_3_gas_effects.test.ts | 'MONST_INANIMATE 怪不沾混乱/麻痹/伤害（CE Time.c:444/:474/:594 豁免）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_3_gas_effects.test.ts | '毒气对 zombie（maxHp 80）= 5/回合，不是 1（CE"大怪更怕毒气"）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_3_gas_effects.test.ts | '玩家站毒气：hp −2 且无 poisoned 状态（CE 的毒状态走 addPoison，与气体无关）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/g_3_gas_effects.test.ts | '豁免前置是 T_RESPIRATION_IMMUNITIES 组旗标：甲烷（组外）不触发自动鉴定' +<br>        '（CE Time.c:409-412 cellHasTerrainFlag 前置；越界鉴定在此翻红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/horde_selection.test.ts | '周期刷怪候选池 >= 55 条（CE 锚点 58）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/horde_terrain_spawn.test.ts | 'hordeFitsTerrain CE PB：普通群拒绝深水；DEEP_WATER 只认 WATER_DEEP' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/horde_terrain_spawn.test.ts | 'passableArcCount 弧段计数（CE Architect.c:171）：计数有界且与邻域可通行性一致' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/hunger_regen.test.ts | 'consumables.json 与 CE foodTable 数值一致（Globals.c:1577-1580）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/hunger_regen.test.ts | 'nutrition 归零后每回合扣 1 HP（CE Time.c:2525-2530）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/hunger_regen.test.ts | '常量与 CE Rogue.h:1124-1127 一致' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/hunger_regen.test.ts | '开局饱食度为满胃（CE Monsters.c:3923）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/hunger_regen.test.ts | '恢复量不超过 maxNutrition 上限（CE Items.c:7491 的 min）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/i_1_interaction.test.ts | '玩家燃烧：同样发光（CE handledPlayer 模式把玩家包含在生物光循环里）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/invented_content_pool.test.ts | '8000 次附魔：武器/护甲只授 CE 符文，vampirism/venom/vitality 出现 0 次' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/invented_content_pool.test.ts | `20 seed × 19 种装备 × ${SPAWNS_PER_KIND} 次：vampirism/venom/vitality 出现 0 次，CE 符文均出现` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/lava_connectivity.test.ts | 'allows a CE TM_CONNECTS_LEVEL gate to connect dry regions without counting it as dry' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/monster_stats_effect.test.ts | '30 次近战中命中率显著低于 100%（CE 公式约 40%）且非 0' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_24_death_sink.test.ts | '对抗性①：熔岩烧死后 hp 必须精确为 0（CE Combat.c:2042 currentHP=0）。' +<br>        '捕获的错误实现：die() 保持旧版只改外观不归零——6 HP 的老鼠被烧死后 hp 仍是 6，' +<br>        '断言 hp===0 直接失败。（P1-27 补做：载体由"深水淹死"换成 CE 唯一即死地形熔岩，' +<br>        '同一 die() 收口；rat 无悬浮/火焰免疫/MONST_INVULNERABLE，三条熔岩豁免均不适用。）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_24_death_sink.test.ts | '对抗性③：hp -= N 之后才调用 die() 的既有路径不得被改成重复结算——' +<br>        '火焰致死的尸体 hp 必须精确停在 0（CE 口径），不能是负数。' +<br>        '捕获的错误实现：把 die() 写成"再补一刀"（如 hp -= maxHp 确保死亡），' +<br>        '受害者被火焰扣到 0 后又被补刀扣成负数，=== 0 断言失败。' +<br>        '【F-2b 翻正】原断言"2 HP 恰好一烧即死"（环境分支平扣 2）随燃烧状态机' +<br>        '到期：环境首过只上 STATUS_BURNING（Time.c:527→:59-60），伤害来自燃烧' +<br>        '结算段的 rand_range(1,3)（Time.c:2582/Monsters.c:1882）——故先挂状态、' +<br>        '再以 1 HP 走一回合结算（任意掷骰必死）。die() 归零守卫原样保留。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_24_death_sink.test.ts | '对抗性④（续，P1-27 载体重写）：深水里的 explosive bloat 被玩家砍死后照样爆燃——' +<br>        '"水里燃起大火"是 CE 行为：GAS_EXPLOSION 火格铺在表层、覆盖在水上；' +<br>        'killCreature 的死亡 DF 分支只认 MB_IS_FALLING（Combat.c:1963-1965），' +<br>        '爆炸伤害只豁免爆炸免疫与 MB_SUBMERGED（Time.c:343-345），站水里的生物' +<br>        '没有豁免。原载体"淹死后触发 DF"已随淹死移除；本条同时接管原"深水毒气"' +<br>        '条的深水角——上一轮还是 web 自创即死地形的深水，不抑制死亡地形。' +<br>        '捕获的错误实现：①"水中死亡抑制死亡地形"被实现成水中跳过 DF——' +<br>        'isBurning 恒 false；②给深水补 CE 的 TM_EXTINGUISHES_FIRE 语义时把死亡' +<br>        '点燃一并掐掉——同样在此失败。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_24_death_sink.test.ts | '对照组：战斗致死与水淹致死走同一条收口——被玩家砍死在水里的 bloat 一样放毒气' +<br>        '（CE：killCreature 不区分伤害来源，只看 administrativeDeath/MB_IS_FALLING）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_24_death_sink.test.ts | '玩家泡在深水里（P1-27 重写为断言新事实）：不 game over，hp 与外观都不受影响——' +<br>        '连续两轮环境结算也是同样结果。CE 深水零伤害（Time.c:1146-1150 "You fall ' +<br>        'into deep water, unharmed."），web 自创的玩家淹死分支已被 ' +<br>        'WEB_ONLY_DEEP_WATER_DROWNING=false 退出生效路径。捕获的错误实现：' +<br>        '①标志被改回 true（或玩家分支被复活）——第一轮 isGameOver 就翻 true；' +<br>        '②"半吊子移除"——不 game over 了却把玩家 hp 清 0 或 char 变 %（误走了 die()）。' +<br>        '任一都在本条失败。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_27_remove_drowning.test.ts | '对抗性③（本轮对齐项）：MONST_INVULNERABLE 的生物站熔岩不死——' +<br>        'CE 第三条豁免（Time.c:185 !(info.flags & MONST_INVULNERABLE)，' +<br>        '全 CE 仅 Warden of Yendor 使用）。捕获的错误实现：改动前的 web——' +<br>        '熔岩分支只查悬浮/火免，Warden 会被岩浆烧死（P1-24 报告 §八.3 申报的缺口）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_27_remove_drowning.test.ts | '豁免（悬浮）：levitating 状态的生物站熔岩不死（CE !status[STATUS_LEVITATING] 条款）。' +<br>        '捕获的错误实现：豁免条件被删/被写反（如漏了 !isFlying）——悬浮怪被烧死。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_27_remove_drowning.test.ts | '豁免（火焰免疫）：immune_fire 状态的生物站熔岩不死（CE !status[STATUS_IMMUNE_TO_FIRE] 条款）。' +<br>        '捕获的错误实现：豁免条件被删/被写反——火免怪被烧死。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性①（验收核心）：火焰免疫的 Wisp 站在熔岩里连续多回合必须存活。' +<br>        'Wisp 同时带 MONST_IMMUNE_TO_FIRE 与 MONST_FLIES，CE 里两道豁免齐备' +<br>        '（Monsters.c:3917/3915 派生永久状态）。捕获的错误实现：改动前的 web——' +<br>        '熔岩分支只查 abilities.has(\'immune_fire\')（全库无写入者，恒 false），' +<br>        'wisp 第一轮就被烧死（hp=0、char=\'%\'）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性②：只有 MONST_FLIES（无火免）的 vampire_bat 站熔岩也必须存活——' +<br>        'CE 里 MONST_FLIES 派生永久 STATUS_LEVITATING（Monsters.c:3915-3916），' +<br>        '熔岩条款的第一豁免就是悬浮。捕获的错误实现：只把 MONST_IMMUNE_TO_FIRE ' +<br>        '接进判定、漏掉飞行豁免（或反向），bat 被烧死。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性③：wisp 的 levitating/immune_fire 连续 tick 50 次后必须原封不动' +<br>        '（CE 字面 1000，源码注释：不衰减）。捕获的错误实现：只做旗标→状态翻译、' +<br>        '漏掉 updateMonsterStatus 的不递减守卫——每回合 -1，50 轮后 <1000。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性④：Wisp 站在燃烧格上不受伤——火免旗标在火焰地形处同样生效' +<br>        '（CE：T_IS_FIRE → exposeCreatureToFire，STATUS_IMMUNE_TO_FIRE 直接' +<br>        'return）。捕获的错误实现：改动前的 web——火焰分支的火免通道同样是死的' +<br>        'abilities 查询，wisp 每轮被平扣 2 点。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性⑤：MONST_INVULNERABLE 的 Warden 站燃烧格不受伤——CE ' +<br>        'exposeCreatureToFire 的 MONST_INVULNERABLE 豁免（Time.c:31），' +<br>        '原 web 火焰分支没有这条。捕获的错误实现：只修旗标通道、漏补无敌豁免。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性⑥（玩家侧）：悬浮药水状态下的玩家站燃烧格照样被点燃——CE 玩家' +<br>        '悬浮踩火同样被 exposeCreatureToFire 点燃（Time.c:8085 玩家同条款）。' +<br>        '【F-2b 翻正】原断言为悬浮玩家 tick 1 平扣 2；新事实同怪物侧：挂状态、' +<br>        '同块 1-3 掉血。捕获的错误实现：怪物侧移除悬浮豁免、玩家侧残留（分支' +<br>        '拆成两半），或任一侧恢复悬浮豁免。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性⑥：旗标飞行的 vampire_bat 站燃烧格照样被点燃并掉血——CE 火焰' +<br>        '地形不豁免悬浮生物（Time.c:527 无悬浮条款），原 web 的 ' +<br>        '!hasStatus(\'levitating\') 豁免会让 bat 经派生悬浮状态获得 CE 没有的' +<br>        '火免（本轮移除该豁免）。【F-2b 翻正】原断言为悬浮 tick 1 平扣 2；' +<br>        '新事实：悬浮照样挂上燃烧状态并按 1-3 掉血。捕获的错误实现：恢复悬浮' +<br>        '豁免（bat 拿不到燃烧状态、不掉血）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对抗性⑦：fiery bolt 的目标筛选必须把火免旗标怪排除在外——CE ' +<br>        'specificallyValidBoltTarget 读 target->status[STATUS_IMMUNE_TO_FIRE] ' +<br>        '（Monsters.c:2624），旗标怪恒有该状态。捕获的错误实现：改动前的 web——' +<br>        'wisp 没有状态，FIRE bolt 视其为合法目标。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_28_flag_channel.test.ts | '对照组：rat 站燃烧格当块先挂燃烧状态（7−1=6）、同块按 CE ' +<br>        'rand_range(1,3) 掉血——锁定火焰分支本身仍然工作（防止"顺手把火焰' +<br>        '分支关掉"）。【F-2b 翻正】原断言为平扣 2（hp 10 → tick 2 → 6），随' +<br>        '燃烧状态机到期。捕获的错误实现：①状态没挂上/火分支失效（hp 与状态' +<br>        '均不动）；②退回平扣旧实现（伤害恒 2，脱离 1-3 支撑集的分布锁）；' +<br>        '③时长写错（叠加实现烧几块后 >6）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_31_35_placement_snapshot.test.ts | 'T2 方向序 = CE Rogue.h:413-422（北>南>西>东）：十字舞台必落北格' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_31_35_placement_snapshot.test.ts | 'T5 CE 不可达态锁死：玩家被摆上楼梯 → CE 顺序必然平图 {-111,30000}、方向率 0' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_31_35_placement_snapshot.test.ts | 'T9 跨局读档：保留 CE 预热前 waypoint，原构建网格与 RNG 重建一致且非空' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_42_secret_door_search.test.ts | 'A7 percent ≤ 0 仍消耗一次抽取（RNG 流一致，CE Math.c:62 rand_percent 先抽后夹）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_46_keybindings.test.ts | 'AD3：s 触发 search；X3-A06 的 S 留给 CE 存档退出、不冒充搜索' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_46_keybindings.test.ts | 'AD4：方向键保留（不与任何 CE 命令冲突）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p1_46_keybindings.test.ts | 'B-2：CE THROW_KEY t 已接投掷入口（Rogue.h:1183）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_2_real_speed.test.ts | 'A5 haste 到期后速度恢复 info 基准（CE Time.c:2261-2273）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_2_real_speed.test.ts | 'B1 泥泞不再双倍耗时（CE 玩家移动耗时与地形无关）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1a quaff 是完整回合（CE Items.c:7633 apply → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1b read 是完整回合（CE Items.c:7633 apply → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1c eat 是完整回合（CE Items.c:7633 apply → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1d equip 是完整回合（CE Items.c:4024 equip → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1e unequip 是完整回合（CE Items.c:8349 unequipItem → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1f drop 是完整回合（CE Items.c:8390 drop → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D1g throw 是完整回合（CE Items.c:7173 throwItem → playerTurnEnded）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_3_objective_time.test.ts | 'D2 楼梯不消耗回合（CE useStairs 无 playerTurnEnded），但换层同步客观门' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_6_display_settings.test.ts | 'B2 大窗允许放大（CE 无 scale 上限），铺满不缩水' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_6_display_settings.test.ts | 'B4 CE 整除公式参考实现对照：两者都恰好铺满、无 1px 缝隙' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p2_6_display_settings.test.ts | 'D1 宽窗口：宽度 = 容器宽 × 20%（CE STAT_BAR_WIDTH/COLS 基准）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_1b_monster_casting.test.ts | 'imp 只有 BLINKING 一个 bolt：monstUseBolt 永远不会施放它（CE 在别处处理）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_1b_monster_casting.test.ts | 'monsters.json 里出现的所有 CE bolt 名都能在 MONSTER_BOLT_TABLE 查到' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_2_monster_summoning.test.ts | 'goblin warlord：monsters.json bolts=[]（与 CE Globals.c:1127-1128 一致，任务描述'<br>        + '"goblin warlord 具备 bolts" 与源码不符，见报告）——仍验证召唤本身不受影响' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_3_special_monster_flags.test.ts | 'golem（MONST_REFLECT_50）的反射概率与 CE PowerTables reflectionChance(4) 一致' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_3_special_monster_flags.test.ts | 'stone guardian 带有该标志，但 web 没有 CE 的"机关/激活"子系统，因此它目前仍会像普通怪物一样每回合自主行动' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_4_split_kamikaze.test.ts | 'bloat 死亡在原地释放毒气（GasType.POISON，G-1 起注入 CE 体积 2000）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | 'failsafe 解除还要检查相邻：抓取者仍然活着但已不在玩家旁边时，玩家移动不再被阻拦 ' +<br>        '（CE Movement.c:1267-1296 的搜索条件含 distanceBetween==1；只检查抓取者是否' +<br>        '存活的错误实现会继续拦人）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | '对抗性②：吸血没有 maxHP 上限 —— 复核确认 CE inflictDamage（Combat.c:1871）' +<br>        '在 attacker->currentHP += transferenceAmount 之后紧接着只有玩家血量归零判断，' +<br>        '没有任何 clamp 到 maxHP 的代码；错误的"好心" clamp 实现会把这里摁回 maxHp。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | '对抗性②：被抓住后尝试移动到空地必须被阻挡（不消耗位移）—— 错误实现（移动' +<br>        '处理完全不检查 player.seized）会让玩家自由移开。挣扎要消耗回合' +<br>        '（CE "you struggle"分支走 playerTurnEnded）；不耗回合的错误实现会被 tick 断言抓住。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | '对抗性③：目标被打死的那一下不触发击退（CE specialHit 只在 Combat.c:1385 起的' +<br>        'else-survive 分支调用，inflictDamage 杀死目标时走的是 if-killed 分支，走不到' +<br>        'specialHit）—— 调用点忘记检查 target.hp>0 的错误实现，会把已经死亡的目标' +<br>        '"死后诈尸挪一格"，用 ally 分支的真实集成路径（Monster.takeTurn）验证。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | '对抗性⑥：抓取不参与命中掷骰（CE return false 早于 attackHit）—— accuracy=0 的 ' +<br>        'bog_monster 在正常公式下命中率恒为 0%，第一次贴身仍必须抓住；' +<br>        '错误实现（把抓取放在命中掷骰之后）永远抓不住。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | '对抗性⑦：被抓者面对抓着自己的攻击者必中（CE Combat.c:125-130：defender SEIZED && ' +<br>        'attacker SEIZING → hitProbability 直接返回 100）—— accuracy=0 的抓取者抓住后' +<br>        '第二击必须命中并造成伤害；漏掉这条规则的错误实现会继续按 0% 公式恒 miss。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_5_melee_specials.test.ts | '撞向抓着自己的怪物仍然是正常攻击（CE playerMoves 的攻击分支先于 MB_SEIZED ' +<br>        '检查，Movement.c:1267 的挣扎只拦"移动进空地"）—— 错误实现（把 seized 检查' +<br>        '放在攻击判断之前）会让玩家永远无法反击抓取者。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '对抗性【不打第一个受阻点/打多个目标】：CE 的鞭只打 getImpactLoc 停下的' +<br>        '那一个目标（Movement.c:888-894）—— 前方 2 格站着盟友、玩家在 4 格时，' +<br>        '被抽的是挡弹的盟友、玩家毫发无损；跳过盟友直取玩家或双目标齐打的实现都会翻车。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '对抗性【射程只有相邻】：CE 的矛是"直线穿透至多 2 格"（handleSpearAttacks ' +<br>        'range=2，Movement.c:923）——goblin 在 2 格直线外就应该隔空刺到玩家且' +<br>        '原地不出手；只会相邻近战的实现会让 goblin 走进中间格、玩家不掉血。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '对抗性【攻击顺序写成正序】：CE Movement.c:1005-1009 人为倒序攻击' +<br>        '（"so that spears of force can send both monsters flying"，先远后近）' +<br>        '—— 2 格外的远处目标必须先于贴脸玩家挨打；正序实现的日志顺序相反。' +<br>        '同时断言矛循环两个目标都挨打（CE 的矛攻击循环没有 dying 复查，' +<br>        '远处目标死后贴脸的照样挨打）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '对抗性【横扫误伤同阵营】：CE buildHitList sweep 分支的 monsterWillAttackTarget ' +<br>        '复查（Combat.c:2079）+ 攻击循环复查（Monsters.c:3883）—— naga 旁边站着 ' +<br>        '同阵营同类时绝不扫它；漏掉 willAttackTarget 的实现会把同类一起砍了。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '对抗性【矛穿过了墙】：CE Movement.c:976-979 遇到阻挡通行/视线的格子' +<br>        '立即 break —— goblin 与玩家之间隔一格墙时绝不能隔着墙刺到玩家；' +<br>        '漏掉 break 的实现会把 2 格外的玩家隔墙刺穿。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '旗标分发走 abilityFlags 而非种类白名单：注入 MA_ATTACKS_EXTEND 的 rat ' +<br>        '在 4 格外甩鞭；注入 MA_ATTACKS_ALL_ADJACENT 的 rat 贴脸时扫掉斜角。' +<br>        '（mutations.json 现无携带这三个旗标的变异，按 P4-5 的变异测试意图改为 ' +<br>        '直接注入 abilityFlags，验证的是同一条 hasAbility 分发路径。）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '横扫要扫满 8 个邻格里的多个敌人（CE buildHitList sweep 分支 i 走满 ' +<br>        '0..7，Combat.c:2072-2086）—— naga 被玩家 + 4 个盟友团团围住时 5 个 ' +<br>        '全部挨打；只打主目标或漏掉斜角的实现在这里翻车。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_6_attack_geometry.test.ts | '留痕（P4-7 已反转）：weapons.json 的 Whip/Spear/Axe/War Pike 现已携带 ' +<br>        'CE Items.c:209-236 按种类赋予的物品旗标（EXTEND / PENETRATE / ' +<br>        'ALL_ADJACENT）。本断言是 P4-6 §7.1 留痕测试的预埋反转（原断言：flags ' +<br>        '全空，"P4-7 实现时应反转"）；玩家侧几何行为见 ' +<br>        'p4_7_player_weapon_geometry.test.ts。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | 'weapons.json 旗标对照 CE Items.c:209-236：六件武器各有其旗标，且经' +<br>        'spawnWeapon 装载进 Item；halberd（web 自创、已退出生成池）与普通武器' +<br>        '不带任何几何/钝器旗标。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '对抗性【不打第一个受阻点/多目标齐打】：CE 的鞭只打 getImpactLoc 停下的' +<br>        '那一个目标（Movement.c:888-894），而挡弹者若不可攻击（盟友）则整鞭落空' +<br>        '—— 前方 2 格站着盟友、敌人 4 格时：移动过去、两人都毫发无损；' +<br>        '跳过盟友直取敌人或双目标齐打的实现都会翻车。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '对抗性【几何伸进墙里】：CE Movement.c:1173-1186 的几何检查在"移动未被' +<br>        '阻挡"分支内 —— 贴脸是墙、敌人 2 格外时，朝墙移动不出手也不耗回合；' +<br>        '漏掉该门控（或漏掉 :976-979 穿墙 break）的实现会把 2 格外的敌人隔墙刺穿。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '对抗性【只做击退、漏了额外恢复回合】：钝器命中且目标身后是墙（无空间击退' +<br>        '，CE "if there is room"）时，额外恢复的一回合让敌人的攻击落进玩家窗口 —— ' +<br>        'mace 命中后玩家恰好掉 1 点（200-tick 窗口内敌人 t=150 攻击一次）；漏掉' +<br>        '额外恢复的实现只给 100 tick，敌人 t=150 的攻击落空（玩家满血）→ 在' +<br>        '这里翻车。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '对抗性【射程写成 2 或无限】：距离 4 必须甩得到且原地不出手；距离 6 必须' +<br>        '甩不到、走近一格 —— 把射程写成 2 的实现在距离 4 翻车，写成无限/6 的' +<br>        '实现在距离 6 翻车（CE getImpactLoc maxDistance=5，Movement.c:888）。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '对抗性【攻击顺序写成正序】：CE Movement.c:1005-1009 人为倒序攻击（先远' +<br>        '后近）—— 两个 1 HP 敌人（贴脸 + 2 格外）都被刺死，但日志里远处目标' +<br>        '的命中消息必须在前；正序实现的消息顺序相反。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '对抗性【横扫误伤盟友】：CE buildHitList 的 monsterWillAttackTarget 复查' +<br>        '（Combat.c:2079）—— 主目标与另一斜角敌人（1 HP，必死）被扫掉，斜角' +<br>        '盟友必须毫发无损；漏掉敌我过滤的实现会把盟友一起砍了。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '横扫要扫满 8 个邻格里的多个敌人（CE buildHitList sweep 分支 i 走满 0..7，' +<br>        'Combat.c:2072-2086）—— 5 个方向围上来的 1 HP 敌人全部被扫死；只打主' +<br>        '目标或漏掉斜角的实现在这里翻车。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_7_player_weapon_geometry.test.ts | '留痕（B-1 已反转）：dagger 的 ITEM_SNEAK_ATTACK_BONUS、rapier 的 ' +<br>        'ITEM_ATTACKS_QUICKLY\|ITEM_LUNGE_ATTACKS、flail 的 ITEM_PASS_ATTACKS ' +<br>        '现已按 CE Items.c:209-236 落到数据里；行为见 b_1_weapon_specials.test.ts。' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/p4_8_scent_map.test.ts | 'T13 对照组：MONST_ALWAYS_HUNTING 不受任何截断影响（CE updateMonsterState 首分支强制追踪）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/phase4a0_spatial_differential.test.ts | `exact pre-migration graph: ${ids.join('+') \|\| 'empty'}` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/phase4a1_game_square.test.ts | 'moving contact triggers new cells only, and two real CE trap mechanisms emit once each' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/phase4a2_body_combat.test.ts | 'through-wall square defender may still be seized orthogonally: CE seize checks distance/corner, not endpoint passability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/phase4b_rigid_rotation.test.ts | 'square and fixed shapes allocate no rotational edges; compiled data cannot be mutated' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/phase4e_body_transition.test.ts | 'innate active shape replacement can change an inanimate form without weakening incoming CE polymorph qualification' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/r_1_appearance.test.ts | '可见但有光 → CE 逐通道乘法：{100,100,100} 是恒等乘数，颜色原样' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/r_1_appearance.test.ts | '可见燃烧格 + 恒等光 → "*" 覆盖层已移除，CE 火外观原样可见（UI-1 反转）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/r_1_appearance.test.ts | '可见燃烧格（PLAIN_FIRE）无光 → CE 火字形压暗、无底色（UI-1 反转：不再有 "*" 覆盖层）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/r_1_appearance.test.ts | '燃烧格 + 毒气并存：bg 仍被毒气覆盖，但字形保住火字形（!isBurning 守卫；UI-1 后字形 = CE 火字形）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/scroll_effects.test.ts | 'negation：读一次消耗 0 次随机数（CE negationBlast 全程零掷骰）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/scroll_effects.test.ts | '半径 9 内的墙变 FORCEFIELD；半径外的墙不变；边界格变 CRYSTAL_WALL（非 FORCEFIELD）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/scroll_effects.test.ts | '玩家自己的状态也被清（CE :4834 negate(&player) 先于怪物循环、无消息）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/scroll_effects.test.ts | '脚下与 4 正邻的 SURFACE 层落 SACRED_GLYPH（100/100 十字波前），T_SACRED 旗标成立' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/t_1_tail.test.ts | 'AD-A2 对抗：identify 占比贴 CE 完整卷轴表 30/158（等概率 1/14 在此翻红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/t_1_tail.test.ts | 'AD-A3：类别抽取本身的 RNG 消耗——卷轴/药水恰 2（CE pickItemCategory + chooseKind 各 1 次 rand_range；武器/护甲 ≥1，其附魔/符文模型另有 CE 原生掷骰）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/t_1_tail.test.ts | 'AD-B1 表行与 DF 条目逐值钉死（抄错 CE 原值 → 红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/t_1_tail.test.ts | '恰 50 项，边界值与抽查位与 CE 一致' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/theme_shell_fixes.test.ts | 'updates displayed player turns without an HP change, uses the CE clock and polls without RNG consumption' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u20_inventory.test.ts | 'CE full-pack precheck compares quiver number before the stricter merge check' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u20_inventory.test.ts | 'CE quiver match ignores curse and identification while conflating known flags' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u21c_terrain_appearance.test.ts | 'uses the CE glyph and base color for the terrain named in K16' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'JSON preserves detached seed/visited metadata and rejects old algorithms/malformed tables atomically' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'first layer starts from its table seed; later entry retries zero oldSeed and returns before vision' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'generation failure still returns the streams and does not mark a never-generated layer visited' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'mixed raw64/range streams resume bit-for-bit through JSON and reseeding retains both counts' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'raw64 draws exactly twice, hi before lo, on selected stream and counts once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 're-entering the active or freshly loaded layer uses its live world, never regenerates it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'revisit restores the same grid and consumes waypoints on the live stream without reseeding' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | 'stair rejection precedes the next seed draw' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | `CE seed ${row.seed}: both tuples, eight raw64 values, all 41 seeds/stairs and count` | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_02b_level_rng.test.ts | `different actual D1 actions cannot change D2–D6 terrain, seed ${seed}` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_02b_level_rng.test.ts | `zero levelSeed uses i+1 for all slots, ${seed}` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_03b_level_travel.test.ts | '4608 eligibility/countdown rows match the compiled local CE loop' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_03b_level_travel.test.ts | 'CE gas precedes promotion/fire' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_03b_level_travel.test.ts | 'borrowed clock and player position restore on exception; timer normalization is CE +100 once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_03b_level_travel.test.ts | 'revisit after %s objective blocks clamps to 100 and borrows CE historical clock' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | '1002 candidates at exhaustion; terminal invalid candidate retained; null propagates immediately' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'ITEM_RUNIC alone satisfies machine quality independently of the effect mapping' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'all six equipment categories retain the full generated quality payload through the U01 codec' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'duplicates compare category and construction kind, never display names; all eight CE categories' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'each retry redraws the entire category/kind/resource request' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'earlier own and child creations enter parent duplicate scope; adopted source is not a child creation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'invalid web loader request propagates as an error instead of publishing a missing item' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'later duplicate checks never relocate an already-owned outsourced instance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'matches 576 compiled original-CE predicates and all five retry boundaries' | 混合剥离 | 移除576项C谓词oracle；五个项目重试预算边界原输入与原输出断言逐值保留为本地小参数，后续所有权/完整存读断言不变 |
| src/test/u_05_machine_items.test.ts | 'mixed masks draw category once, then kind, then resources (input mask order is irrelevant)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'replays all 67 historical null requests as real items, independently of changed natural seeds' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'ring CE 16% curse and 10% positive tail; charm 7% tail starts ready' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | 'unconditional curse; require runic bit, throwing quantity, heavy kind/strength AND positive enchant' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | `${carried?'carrier':'floor'} → JSON → death/pickup → JSON retains identity/resources/quality` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05_machine_items.test.ts | `${category}: every explicit kind, category order, resource lottery and no depth gate` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | 'CE inventory is complete, disabled CE48 remains absent from web pool' | 移除 | 纯CE源码所有权inventory行/哈希/表覆盖对照；删除参考源要求 |
| src/test/u_05a_item_ownership.test.ts | 'adopt + outsource + carry transfers only to child, never parent ground/carrier' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | 'adopt only once; later itemless instances/features do not erase the last valid torch pair' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | 'duplicate deferred identity is rejected before either copy is instantiated' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | 'handoff replaces the horde leader’s existing item without a second floor/inventory owner' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | 'reject orphaned earlier torch in malformed multiple-generation TAKE features' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | `${horde?'horde leader':'ordinary monster'} owns one item before death, after reload/death, after pickup/reload` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_05a_item_ownership.test.ts | `CE${row.ce}/F${row.feature}: generation/adoption/outsourcing/carry conserves identity` | 混合剥离 | 原所有权守恒断言及两数量端点保留；参数来源改为当前项目blueprint真实ownership flags，以唯一id选行，移除C inventory依赖 |
| src/test/u_05a_item_ownership.test.ts | `recursive ${lateParentFailure?'child succeeds, parent later fails':'child adopts then fails'} rolls back terrain, pending items/monsters and external item` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | '$name catalog magnitude and exhaustive CE distribution' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_06_monster_damage.test.ts | '$name ignores caster accuracy/damage/status/riders and monster armor, consumes only CE dice' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | '$name ignores player armor and armor runics; no melee on-hit statuses' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | '$name reaches both CE endpoints with exactly the declared dice order' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | '%s retains accuracy miss, weapon immunity, attack damage/riders and RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'BE_ATTACK on an ASLEEP target short-circuits a false accuracy mock and wakes it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'WHIP remains CE BE_ATTACK on the existing geometry route, with no monster bolt-table addition' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'armor reflection identifies armor and deals fixed fire damage to the original caster' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'killed bloat reaches ordinary death DF/carried-drop cleanup exactly once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'lethal flame does not ignite player or terrain after the death return' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'monster-origin reflected damage splits the surviving recipient after ignition' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'negating innate fire immunity exposes the same target to the new direct damage exit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'negation removes actual damage casting abilities; next turn cannot cast them' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'reflected spark kills caster and player in order; player death stops piercing and credits original caster' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'shield=%i absorbs once; shield-only hits still burn and release control' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'spark harms fire/weapon immune targets, but invulnerability consumes no roll and does not stop piercing' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | 'transference remains after shields and before damage (ally=%s), including reflected self-hit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_06_monster_damage.test.ts | `${name}: %s immunity precedes RNG, preserves shield, emits immunity and ignites terrain` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | '%s cannot enter the dedicated schedule' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | '30% rejection consumes exactly the gate RNG; ALWAYS bypasses it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'CE strict enemy-map inequality leaves visible nearest enemy unseeded' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'a later better adjacent diagonal clears an earlier useful jump' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'ally follows player scent beyond distance 10 with no probability gate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'ally safety sources are enemies even outside player visibility, never player/teammates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'ally=%s escapes harmful terrain with no 30% lottery' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'an unobservable landing is legal; player blink visibility policy is not consulted' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'blocked straight leader path uses target-distance map; clear straight path skips it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'bolts, not an MA flag: absent and ALWAYS cost zero draws; ordinary gate costs one' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'captive-priority gate rejects %s, without resource/time use' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'dormant occupied landing is rejected by W11 commit without displacing either creature' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'enemy scans respect both -2 diagonal obstructions, without changing the shared scanner' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'enumerates the exact 40 targets without duplicated corners' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'every currently flammable terrain has a readable immediate burn successor' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'failure continues walking in the same takeTurn, without charging an attack turn' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'fixed E5/12-cell range, slow=%s, no RNG or item resource consumption' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'flat/no ability failures leave position, clock, animation and RNG unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'fleeing blink increases distance using the existing safety map before summon/bolt' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'four-layer obstruction %s stops the ray, including flying casters' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'hazard and immunity contract is based on real layers and temporary statuses' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'hidden enemy is ignored in prediction but actual cast stops short and spends the attack clock' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'hunting moves uphill toward player scent even without line of sight' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'invisible closer enemy is retried by enemy-map loop after the first scan misses it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'leader distance 10 and independent follower gates suppress scent blink' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'matches all 100 independently compiled CE vectors, with 40 probes and no RNG' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_07_monster_blink.test.ts | 'occupied target %s halts before it without damage/reflection' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'ordinary successful magic keeps priority over hunting blink' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'rest/search extends ally combat leash, with no changes to ordinary movement state' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'safe-terrain map seeds floor but not gas, doors, fire or forbidden chasms' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'safety snapshot survives an unseen moving player and is released upon awareness' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'target map seeds a forbidden destination like CE pdsSetDistance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'ties keep the first aim; a cardinal score must be beaten, not equaled' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'wandering follower reaches its own leader across a blocked straight path, captive=%s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_07_monster_blink.test.ts | 'weak ally flees nearby enemies using ally safety, not player safety' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_08_terrain_bolts.test.ts | 'DF %s copies CE id/tile/spread and no unrelated flags' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_08_terrain_bolts.test.ts | 'release clears only SURFACE even in a synthetic multi-layer entanglement' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | '%s applies its CE faction, invulnerable, forbidden and reflectability gates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | '%s is erased by negation and CE refunds all learning slots' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | '%s is learnable but neither AI nor direct monster execution opens an exit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | '%s synchronizes, survives ticks/current snapshots and is permanently negated' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | '%s: eligible target, real cast, attack ticks; no power counter spent' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'CE masks are exactly four behaviors and two abilities; no TURRET, FIERY, POISONS or reflection100' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_09_learning_consumers.test.ts | 'CONJURATION detonates before the intercepted creature and creates 15 player-bound blades even for a hostile caster' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'CONJURATION on a full grid creates no overlapping/off-map creature' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'DOMINATION failure and player contact preserve ownership and spend only the eligible roll' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'DOMINATION from hostile caster still converts to player allegiance, demotes leadership and clears discord' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'ENTRANCEMENT player contact confuses; monster contact wakes and entrains independently of caster allegiance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'LIGHTNING reflection owns transference and lethal source at the original monster' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'LIGHTNING uses magnitude10 (9..29, four clumps), pierces, and never calls physical attack' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'MONST_REFLECT_50 reads reflectionChance(4) and real travel loses the ability after negation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'POISON magnitude10 stacks 40 turns and one concentration per contact; no immediate health transfer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'POLYMORPH uses W19 in-place species replacement; player contact is immune without species RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'TELEPORT frees a captive even when destination search fails; IMMOBILE prevents both' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'TRANSFERENCE ally=%s: melee and bolt share shield/remainingHP/cap semantics' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'TRANSFERENCE and weakness reject a %s victim' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'TURRET contributes all six bits at effect gates; no sleep/initialization RNG rewrite' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'all 22 learnable identities have metadata; the seven unlearnable entries stay excluded' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'allied reflective recipient remains eligible and contact reflection is still resolved by travel' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'an already-FIERY recipient rederives permanent burning after learning another power, without making FIERY learnable' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'installed flight and fire immunity protect against real environmental contact; invisibility enters perception' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'learning flight clears aquatic restrictions, while initialization retains its own CE flags' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'legacy on-hit/abilities/immunities are not learned or removed by negation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'matches the verbatim compiled CE predicate on all 198 new-identity target cases' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_09_learning_consumers.test.ts | 'preserves player-first/bolt-order and 30% rolls, including failed candidates without a roll' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_09_learning_consumers.test.ts | 'weakness affects a surviving monster through melee and BE_ATTACK, but never BE_DAMAGE; removing the ability preserves existing weakness' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_10_absorption_snapshot.test.ts | 'detail %s follows CE position equality, without extra counter/MB gates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_11_corpse_learning.test.ts | 'all22 CE learnable identities survive selection and installation: %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_11_corpse_learning.test.ts | 'clone copies task by value; return before16 can duplicate learning as CE permits, without a global token' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_11_corpse_learning.test.ts | 'expiry clears only the CE task fields, leaves name/behavior/new and never rebroadcasts; null target with lingering absorption expires' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | '%s has no hit die and only the CE multiplier' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | '%s melee consumes the CE distribution, not just its mean' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_13_combat_math.test.ts | '%s substantive count=%s (a 0..0 clump call consumes no random number)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | '1215 hit probabilities include zero/negative defense/short maxima and every integer enchant' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_13_combat_math.test.ts | '168 original recalculateEquipmentBonuses cases reach actual player melee, including negative enchant and strength boundaries' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_13_combat_math.test.ts | 'all 281 enchant table entries and 711 defense boundary inputs match exactly' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_13_combat_math.test.ts | 'all catalog clumps survive constructor/form/empower/clone/JSON restore without new draws' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'every tuple and RNG range of {$lo,$hi,$clump} matches CE' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_13_combat_math.test.ts | 'invisibility has no extra multiplier and weakened duration cannot substitute for U14 weaknessAmount' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'javelin clump survives loading and melee; enchanted endpoints scale before rolling' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'miss/immune skip damage dice; immune sneak still wakes and delays; zero damage never calls armor callback' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'monster→sleeping monster / paralyzed player uses generic ×3 and no hit roll' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'ordinary 100% and seized 100% still consume a hit die; first seizure/kamikaze/aquatic rejection consume none' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'polymorph installs the new species clump' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'real BE_ATTACK entry consumes full clump with its normal hit roll' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'sleep/paralysis/lunge overlap multiplies only once; ally wandering and inanimate sleep have no bonus' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_13_combat_math.test.ts | 'unarmed is CE {1,2,1}; zero ranges have no minimum-one damage or random draw' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | '%s runs on objective time for both actors' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'CE contact weakness: %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'CE fear source stays retired; X2g completed darkness throw returns at CE frequency' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_14a_status_gaps.test.ts | 'U21b consumes the U14a darkness carrier in miner light' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'all consumers, weakness=$weakness' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_14a_status_gaps.test.ts | 'catalog negation player=%s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'direct monster bolt clears magical fear but preserves ordinary fleeing; auto-negation sees fear' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'fear cannot recover from full HP or attack when cornered; ordinary fleeing can' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'fear refresh, expiry and ally restoration; ordinary fleeing is untouched by status ticks' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'magical fleeing permits summoning but cannot cast attack bolts' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'melee misses shorten fear to one, environmental damage does not' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'monster physical intent vomits before melee and moving, not spell dispatch' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'no vomit check for rest or failed wall move; failed nausea roll permits movement' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'objective stench contact is before monster decay and after player decay' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'panacea preserves weakness at one, clears it above one (%i)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'player, active/dormant monsters and clones round-trip amounts and independent maxStatus' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'refresh rules preserve darkness historical max and refresh nausea max to current' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'repeat doses cap at ten, refresh both maxima, expiration clears layers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'strength potion clears layers immediately, keeps countdown one until tick' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'terrain exposure: %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'thrown misses shorten fear and alert target; normal fleeing remains' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'vomit replaces %s with movement time and DF, not damage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14a_status_gaps.test.ts | 'weakness immediately feeds the reflection armor enchantment' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'STUCK auto-hits without RNG or a sneak multiplier, even inanimate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'actual armor hit chance and detail include donning, without a damage penalty' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'all four non-negatable and unaffected by panacea (player=%s)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'all layers hold; final attempt clears only surface; terrain loss clears on tick' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'blink releases even when landing in another web; unsuccessful placement retains count' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'bolt eligibility consumes counter, not occupation (%s)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'conjuration blades still have 1 HP and no lifespan; no expansion of retired sources' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'contact gates: %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'current/max persist for player, active and dormant monsters; clones own independent maps' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'earlier burning death does not also consume/announce lifespan expiry' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'entranced forced follow gates on counter, including away from terrain' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'expiration kills directly, including %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'monster counter and final move preserve base/liquid (%i)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'monster damage bolt and thrown weapon activate the same survivor source' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'monster melee on occupied target does not decrement STUCK' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'objective clock, %s equipment/action timing' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'only grouped hunters at <= half HP ignore safe-room to corridor avoidance while enraged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'ordinary equip starts armor/10, refresh replaces; forced starting equipment and unequip clear' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'ordinary lifespan has no negation death, DIES_IF_NEGATED remains an independent flag' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'player attacks occupied destination before struggling; wall does not consume a count' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'real entry, waits, 3 attempts, last attempt releases surface and moves' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'source draws 3–7 once and never refreshes (%i)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'source gate %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'timed allies never flee; ordinary low HP allies retain their flee decision' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_14b_status_gaps.test.ts | 'weakness $weakness / donning $donning: defense $playerDefense' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_15b2_ring_birth.test.ts | 'E=%i caps by target HP before shield and charges with wisdom in the same hit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'a miss, inanimate/invulnerable victim, no bonus or zero damage has no extra substantive draw' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'birth E, curse, familiarity and known state survive the U01 codec without rerolling' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'drains charged/full staffs, clamps cooling charms, leaves ready charms and wands alone' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'matches 144 compiled original CE light cases including darkness and water truncation' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_15b2_ring_birth.test.ts | 'matches 1944 original CE staff cases: negative/zero/positive, capacity and signed-short overflow' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_15b2_ring_birth.test.ts | 'matches all eight CE ringTable names, order, frequency and unfiltered kind draw' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_15b2_ring_birth.test.ts | 'ordinary and machine paths give the same resource fields and exact RNG state for 80 seeds' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'ordinary birth draws 1..3 once, then 16% curse OR an uncapped 10% tail' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'ready notification and known/unknown detail do not reveal unknown E' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'refreshes actual Game light on equip/unequip, kind-only identification and load' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'sums effective E and skips zero, with independent unknown positive caps' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'throws and direct damage transference do not reap; landed melee does use one draw' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b2_ring_birth.test.ts | 'unknown positive E, both slots, zero roll and exact one substantive draw' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b_rings.test.ts | 'feeds stealth E into the CE range with fourfold cursed penalty' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b_rings.test.ts | 'reveals and darkens within CE clairvoyance radius without RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15b_rings.test.ts | 'uses CE fixed point regeneration table at negative, zero and positive E' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15c_charms.test.ts | 'applies the six CE effects, charges even at full health, and rejects charging attempts' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15c_charms.test.ts | 'enchanting recharges an active charm and increases its CE curve' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15c_charms.test.ts | 'round trips the CE charm instance (no legacy-save migration, per project decision)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15c_charms.test.ts | 'uses CE fixed-point golden values at multiple enchantments' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15d3_runic_generation.test.ts | 'U05 Q requests retry the same complete birth; category draw, candidates, result and two RNG streams match' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15d3_runic_generation.test.ts | 'bad pool implies negative enchant and curse; heavy weapons and plate cannot obtain a good runic' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15d3_runic_generation.test.ts | 'maps every CE enum index, including all harmful runics, without holes or reordering' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_15d3_runic_generation.test.ts | 'ordinary birth → U01 JSON → hidden detail → identification → JSON preserves every generated runic' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15d3_runic_generation.test.ts | 'vorpalEnemy: every ticket at all maxDepth boundaries uses exactly one CE weighted draw' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_15d3_runic_generation.test.ts | `${category === 0 ? 'weapon' : 'armor'}: every kind, probability boundary, threshold, pool and ordered RNG request` | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_15d_weapon_runic.test.ts | 'counterfactual: CE table runics at E10 are not the legacy 15% fallback' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_15d_weapon_runic.test.ts | 'effect magnitudes follow CE integer truncation' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_15d_weapon_runic.test.ts | 'paralysis, slowing, and confusion end at CE durations' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15d_weapon_runic.test.ts | 'quietus and slaying kill; force travels up to CE distance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15e_potions.test.ts | 'fixed CE durations and native potion generation frequencies stay correct' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_15e_potions.test.ts | 'life increases maximum HP, heals, and applies the CE panacea list' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '104 active timeout at 10/10000 creates sulfur fire/light; 2500/10000 expiry leaves liquid, no embers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '104 player fire bolt ignites ACTIVE into INERT + sulfur fire, burns an occupant and scroll through the shared transaction' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '61 actual step tramples foliage, opens sight; moving away allows regrowth; occupied regrowth retramples synchronously' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '61 fallen item also tramples regrowth; other layers block regrowth according to CE priority' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '66 environment activates inert brimstone at 800/10000 boundary, never an invented explosion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '83 reusable key persists; snapshot retains the iron tile, passability and appearance name' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '83 wrong key leaves lock, matching key bump opens iron door, emits flare, consumes disposable key; later steps never reclose it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '98 a levitating player remains above the collapsed bridge; an earthbound player falls at turn boundary' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | '98 fire bolt collapses a rope span only, successor walks the bridge, then creature falls; stone bridge is nonflammable' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'D40 floor falls destroy even nonpotions without a D41 queue' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'appearance golden extension keeps every previous row byte-equivalent in value' | 混合剥离 | 删除CE源码行号比较，保本项目外观旧基线与当前render字段守卫 |
| src/test/u_17b_carriers.test.ts | 'bridge floor item fall: potion shatters, weapon queues exactly once, survives save/load and new-level landing' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'fall landing uses item-only CE terrain veto: allows liquid, excludes occupied/machine/stair cells, and delays future catch-up' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'fallen items on existing fire/lava burn before drifting; amulet survives lava and future items wait' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'fallen-item landing excludes each CE map veto and terrain obstruction, then chooses the nearest free ring' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'fallen-item restore runs before the new-level RNG reseed, once; cached lower floors consume the same ownership queue' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'five complete tile rows come from CE, including flags, all three chains and glow' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17b_carriers.test.ts | 'historical U17b missing projection excludes exactly the five U17c and nine U17d closures' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17b_carriers.test.ts | 'nine CE DF rows include the new regrowth successor and all inherited edge fields' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_17b_carriers.test.ts | 'no evacuation is invented: all five DFs preserve position; brimstone contact still ignites' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '144 carpet-constrained propagation remains invisible; player entry/wait repeatedly sends power, monsters and items do not' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '144 resurrection consumer: empty altar can retry on the retained floor after an ally enters purgatory' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '152 CE22 whole blueprint builds the pit before the plate; actual throw opens its exit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '152 DF lays holes and each halo without evacuation; monster and floor items reuse the fall queues' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '154 actual thrown weapon depresses a LIQUID plate, clears that layer and opens the linked cage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '154 monster placement uses the shared contact; breaker blocks power but not the plate state' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '154 player step powers only same-number remote gate and leaves an inactive pressure plate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '17 manual search clears hidden base and surface, creates liquid hole + halo/flare, then confirmed player falls' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '17 search has no forged discovery behind a wall; hidden trapdoor falls without confirmation and levitation prevents falling' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '95 searching then bumping wall lever leaves player in place, consumes a turn and opens a distant gate exactly once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | '95 upstream dormant wired lever can be created after a cached no-secret scan, then searched and pulled' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | 'CE-generated appearances preserve all old rows and represent the new glyphs' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_17c_triggers.test.ts | 'five tile rows and all three chains equal CE-source goldens, including an invisible repeating floor' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17c_triggers.test.ts | 'historical U17c projection after nine U17d closures; every other missing identity remains ordered' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | 'no invented evacuation flags; pending later-family discovery does not erase its source' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17c_triggers.test.ts | 'seven DF rows match CE flags, probability, layer, description/light and successor exactly' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17c_triggers.test.ts | 'three machine DF data starts restored, hidden-trap autoGen correct; U19d restores the secret lever and U19f restores the worm machine' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '157 CE-generated appearances include visible traps/vents/fire; hidden forms still look like floor' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '175 actual pickup → poison vent → diffusion → existing caustic damage, no poisoned status or relocation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '175 poison opening has no immediate gas; 10000 boundary emits exactly 25, remains active' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '180 immediate 60 volume, then 5000/10000 promotion boundary; no forced evacuation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '180 player picks altar key → same-machine methane opens and emits; other machine stays hidden' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '182 actual pickup drops torch; wall/light preserved and existing fire loop ignites adjacent methane into explosion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '183/185 pressure plate fires discovered or hidden paralysis vent, reveals silently and applies existing paralysis' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | '185 gas payload is 350 and visible vent can be wired again; breaker prevents remote activation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'CE40 whole room: actual altar pickup closes exit and starts gas; searching and pulling its created lever reopens exit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'all nine tile rows (including dormant torch light) equal CE sources' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17d_vents.test.ts | 'four CE autogen starts have exact depth/rate columns; paralysis machine selection/forced-autoGen eligibility remains unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'immolation catalog uses shared fire contact/scroll burning, not a new armor trigger' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'known poison trap depresses once; empty environment re-arms; JSON restores depression' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'levitation does not depress hidden traps; offscreen monsters fire without player knowledge reveal' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'methane vent 15% ignition boundary overlays CE embers, retaining the non-vanishing vent' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'nine restored DF and six successors/armor rows equal CE including no immediate poison successor' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17d_vents.test.ts | 'removes precisely nine registrations, preserves remaining ordered eleven and old numeric IDs' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | 'wall occlusion prevents vent discovery and no gas/flash is forged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | `${T[hidden!]} real step discovers and emits through U17a while preserving trap` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | `${T[hidden!]} search reveals without firing or wiring, persists and displays` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | `CE${id} whole area machine: a real player step opens all wired vents; nearby occupants are paralyzed without damage` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17d_vents.test.ts | `autoGen ${index}: actual CE row placement → player wait on trap → final gas/fire and retained carrier` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '140 two drops exchange enchantment and its knowledge, make both altars inert and 141 pipes charred' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '141 CE6 blueprint feature actually lays glowing pipes; a user drop pair consumes that generated network' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '143 repeated floor entry retries with no dead ally then resurrects strongest saved ally once with CE light' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '145 pressure entry activates altar and cage; entranced marked creature enters and dies, opening surviving reward' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '164 CE appearances include exact glyph/color/background and localized terrain descriptions' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '85 pickup closes same-machine cages, evacuates player and monster, preserves remaining loot and can reopen' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | '85 user throws onto a wired plate while standing on an open altar: the shared transaction evacuates the player before closing' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'CE blueprint DF starts and all library item flag columns match raw source; frequencies and qualification stay separate' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17e_altars.test.ts | 'CE1/2 natural seed777 D1 library (U17f drift-adjusted fixture): borrowed item closes cages only after departure; return and replacement reopen the remaining collection' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'CE6 full blueprint → walking and two drops → swapped items, two inert altars and charred generated pipes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'CE7 full blueprint → user floor contact → U16 ally returns at the distinct inert altar' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'a blocked or wrong-machine key cannot open a closed cage; save/load retains terrain and bound key' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'charm cooldown uses existing CE delay formula with integer percent; positive runes fade on nonpositive exchange' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'removes exactly five missing rows and preserves saved numeric IDs' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'seven tile rows and nine DF rows equal independently parsed CE, including three necessary successors' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_17e_altars.test.ts | 'staff capacity/charges clamp, recharge timer remains, known max charges transfer, harmful runes persist' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'staff shatters below two without losing the other item or duplicating an exchange' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | 'two overlapping drops occupy one CE floor slot and cannot power a commutation machine' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | `does not consume items or altars when ${reason}` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17e_altars.test.ts | `does not sacrifice ${reason} creature` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | '148 player approaches a CE trigger-area coffin, vampire rises with its original carried key exactly once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | '155 pickup cracks rat walls, then existing wall shatter releases all residents and leaves loot reachable' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | '187 player entry cracks doorway statue, waits shatter it, awakens existing monster and opens the passage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | '191 player pulls lever, activates worm markers, frontier opens granite and reveals resident using existing wake transaction' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | '87 pickup retracts the altar into floodable ground; existing flood propagation crosses the new floor' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | '88 matching key activates portal, evacuates occupant, awakens ally and temporary light vanishes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'CE blueprint trigger and monster entry rows remain wired, including dormant marker and coffin trigger area' | 混合剥离 | 剥离golden.blueprintFeatures外部列比较；保当前休眠/虫洞消费者装配守卫 |
| src/test/u_17f_carriers.test.ts | 'CE69 full blueprint builds dormant hordes; actual player entry and waits complete its previously missing payoff' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'RUBBLE autogen CE row invokes the real DF and decorates reachable floor' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'all six restored terrain identities survive save/load with layers and machine IDs intact' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'contact keys on floor or carried by occupant monsters use the same portal chain; unrelated and nondisposable keys survive' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'retains the empty missing-tile guard and preserves old IDs; five appended appearances come from CE' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'sealed active worm marker waits without RNG; one open orthogonal neighbor yields strict 2000 boundary' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | 'six tile rows and eleven DF rows match CE, including granite superpriority and actual flash fields' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_17f_carriers.test.ts | 'wrong key and circuit breaker cannot awaken portal resident' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_17f_carriers.test.ts | `${T[t!]} exact CE promotion boundary` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_18a_2_generation_terrain.test.ts | 'pathless final fallback includes boundary, uses one-based CE tie draw and does not invent reachability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_18a_2_generation_terrain.test.ts | 'weighted four-way multi-source negatives, boundary override and zero transit retain CE values' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_18a_3_generation.test.ts | 'CE literal exemptions: flight does not remove P or fire, invulnerability does not remove traps/water' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_18a_3_generation.test.ts | 'CE%i/F%i writes a real door, displays a wall, discovers and opens a route' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_18a_3_generation.test.ts | 'fallback rejects shallow liquid, machine and occupied tiles, but allows fire (CE mask)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19a_machine_view.test.ts | '579 whole-map masks agree with the actual CE C scanner in both modes' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19a_machine_view.test.ts | 'CE%i literal complete blueprint, including retired explicit fixtures' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19a_machine_view.test.ts | 'affected catalog is exactly 14 machines / 18 features, retaining literal flags' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19a_machine_view.test.ts | 'does not consume RNG or write player visibility/memory; radius is map-wide' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19a_machine_view.test.ts | 'integer-slope boundary rejects a cell the legacy scanner admits: %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19a_machine_view.test.ts | 'layered obstruction %s/%s: ordinary=%s passable=%s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19a_machine_view.test.ts | 'oracle source hashes pin the C inputs, and the old web scan demonstrably differs' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19a_machine_view.test.ts | 'snapshots after preceding feature writes, once across EVERYWHERE/repeat, fresh on next feature/build' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19a_machine_view.test.ts | 'view cache remains isolated during reentrant child machine construction' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19b_pending_occupancy.test.ts | 'CE candidate selection permits zero-space item/monster co-location and BUILD_AT_ORIGIN overlays' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19b_pending_occupancy.test.ts | 'CE15 complete blueprint reaches populateLevel, then actual pickup transfers its amulet exactly once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19b_pending_occupancy.test.ts | 'matches 64 compiled CE room/vestibule/candidate truth-table rows (five entity flags, two positions)' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19c_immediate_entities.test.ts | 'matches the compiled CE call-site RNG oracle before the NEXT feature (allocation stubs only)' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19c_immediate_entities.test.ts | late-failure older entities / afterAbort | 混合剥离 | 将sole C oracle.afterAbort(0)替为原同值0；保完整rollback与既有实体身份断言，非玩法/RNG黄金重录 |
| src/test/u_19d_machine_families.test.ts | 'CE weighted selection %i/%i: enumerate every integer ticket, exactly eight select the returning machine' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'CE%i complete ALTERNATIVE lever branch: search, pull, wait for passage, collect the adopted key and return' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'CE18 both complete barrier alternatives open after search and bump' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'CE18 reenters only its CE depth and vestibule pool, CE67/68/69 keep zero lottery weight' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'CE28 deferred population retains the caged reward instead of silently dropping it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'CE28 explicit builder can adopt a key; U19f restores CE52 to the weighted pool' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'CE28 no observer: preserve the CE caged item identity through population and storage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19d_machine_families.test.ts | 'all fifteen family rows retain CE depth, size, frequency and literal feature flags' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19d_machine_families.test.ts | 'paralysis/statue/hidden-trap autoGen rate columns equal CE, including minima and caps' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/u_19d_machine_families.test.ts | `natural CE${row.ce} seed${row.seed}/D${row.depth}: ${row.kind}` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19e_machine_families.test.ts | 'CE%i immediate and recipe-only population retain a blocked adopted item without observer or blueprint-name exception' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19e_machine_families.test.ts | 'CE%i qualifies only within CE depth and its reward/adoption pool' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19e_machine_families.test.ts | 'exact integer selection tickets CE%i/%i retain their original weights' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19e_machine_families.test.ts | 'literal frequency/depth/room/feature flags and all autoGen entries retain local CE values' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19e_machine_families.test.ts | `natural CE${row.ce} seed${row.seed}/D${row.depth}` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19f_autogen.test.ts | '21 appended tiles and 24 DF rows retain every CE behavioral field' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19f_autogen.test.ts | 'all 49 autoGen rows match CE columns and all 48 executable rows are connected' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_19f_autogen.test.ts | 'every CE blueprint qualifies under its own flags/depth, only D2 inventions retire' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19f_autogen.test.ts | `autoGen row ${index} has its CE consumer` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_19f_machines.test.ts | `U19f natural CE${row.ce}: generation → player activation → original reward → exit` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'D26 and D39 retain doors; D40 consumes the door roll but places floor' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'D40 portal rejects an empty pack, then settles %i gem stacks and description' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'GEM birth is identified, single, depth-tagged and consumes neither RNG stream' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'a real drop command moves the entire GEM stack, survives save/load and can be picked up' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'a real levitation potion permits movement across lava and chasm without falling' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'a real wait in deep water washes away the entire GEM stack (CE dropItem)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'deep hordes and mining light use actual depth, with CE color/profile saturation only' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'food has priority, then gems bypass metered guarantees and ordinary category draws' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'matches the CE 26/40 constants and all fourteen lumenstone quotas' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/u_26a_deep_levels.test.ts | 'real movement can swim across a deep-water connection between dry rooms' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'same-depth stacks take one slot and merge at capacity; other depths remain distinct' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26a_deep_levels.test.ts | 'seed %i: D26–40, all gems, upstairs/cache/save and terminal victory' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26b_endgame.test.ts | 'keeps 30 scores, ranks descending, and uses CE local date and description' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/u_26b_endgame.test.ts | 'uses CE gold, death gem redemption, amulet and lumenstone values for three endings' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | 'CE 空名集恰为 web 现有载体（explosion_immunity/enraged）；新增载体须同步扩入' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | 'PARALYSIS：bg = CE pink 减半、字形 ~ + 淡粉前景；METHANE：bg = CE methaneColor 减半、~ + 草绿前景' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '回放期间不弹 Host（CE IO.c:2941-2943；答案由引擎消费）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '对抗：bg 值锚定 CE 原色（pink {100,60,66} / methaneColor {45,60,15} 各减半，Globals.c:506-507）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '对抗：分支顺序——右支（携带物）压过左支（地面物），CE IO.c:1123-1125' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '对抗：字形/颜色值逐字符等于 CE 原值（⧲ U+29F2 一族抄成 ASCII 替代品即红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '左支：恶意物品 → G_BAD_MAGIC + badMessageColor；不做记忆变暗（CE IO.c:1349-1359 "do nothing"）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '常规对局：问题原样转给 Host，受控答案映射到引擎（CE Enter=Yes/Esc=No）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '护符特例：已探测护符 → G_AMULET + white（优先于极性分支，CE IO.c:1229-1231）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '无极性的已探测物品（enchantment 0）不显示符号（polarity 0 过不了 CE 的守卫）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '有名状态与未知键照常显示（CE name[0] 门只挡空名；未知键裸显是 web 既有调试可见性）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '燃烧状态不改变怪物外观（谁在这里加"燃烧染色"谁红——CE 没有这种机制）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '背景与前景用同一乘数（CE 对两者各做一次 applyColorMultiplier）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '自动寻路仍询问（CE autoPlayingLevel 是自动演示；X3-U1 D10）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_1_rendering.test.ts | '负通道按 max(0,·) 钳位（黑暗类光是负分量，CE colorMultiplierFromDungeonLight）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_2_protection.test.ts | 'quiverNumber 非零时重掷为 [1,60000]（CE :1436-1438，投掷武器的口径）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_2_protection.test.ts | '下界照 CE 字面 enchant1 >= -10：-10 仍降到 -11，-11 才停' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_2_protection.test.ts | '受保护武器同样显示（CE 该块在武器/护甲 if-else 之外，两类都出）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_2_protection.test.ts | '投掷路径不降级（CE 该块只在近战 attack()，hitMonsterWithProjectileWeapon 无此逻辑）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ui_2_protection.test.ts | '目标被这一击打死时降级照常发生（CE 该块在命中支尾部，不吃目标存活条件）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/ux_1d_recording_continuation.test.ts | 'keeps world-only and legacy snapshots playable without claiming a complete recording' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1a_blueprint_items.test.ts | 'T1 墓碑：blueprints.json 不再含 _random_good_，全部 itemCategory 落在 CE 类别名集合内' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1a_blueprint_items.test.ts | 'T2b（V-2b-6）key_poison_gas 按 CE :436-444 重写：两条逃生工具 feature（SCROLL_TELEPORT / POTION_DESCENT，MF_ALTERNATIVE 组）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1a_blueprint_items.test.ts | 'T2（V-2a 反转）门厅/守卫机器零自产奖励 feature（key_poison_gas 按 V-2b-6 反转）；vestibule_locked 按 CE :300 恰一条 KEY 解题工具 feature' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1a_blueprint_items.test.ts | 'T3 area_shrine 掩码逐字 = CE GlobalsBrogue.c:561-565 的五类，数量 {1,1}，走 MF_GENERATE_ITEM' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1a_blueprint_items.test.ts | 'T5 整局 ench/life 下移带（V-1a 后实测 13-16 / 6-7，10 seed；带宽 ± 余量；CE 参考量级 12-15）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1a_blueprint_items.test.ts | 'T7 掩码抽取 RNG 消耗恰 2 次（CE pickItemCategory 1 + chooseKind 1）；单池单次抽取的错误实现消耗 1 必红' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1b_alternative.test.ts | 'P1（X4-R2 顺延）MF_ALTERNATIVE 精确目录含 CE19 两条；MF_ALTERNATIVE_2 仍零载体' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1c_machine_structure.test.ts | 'Q1 顶层抽签（required=[BP_REWARD]）只允许 CE reward；自创 reward 与其他类别均不可选' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1c_machine_structure.test.ts | 'Q2 两条 NOT-unless-required 守卫：ADOPT/VESTIBULE 位只在被要求时可选；required=∅ 时 reward 也合格（CE 缺口6 的字面行为）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1c_machine_structure.test.ts | 'Q4b 开局清零（CE RogueMain.c:292）：startNewGame 后计数器归零' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_1c_machine_structure.test.ts | 'R3 领养 10 次全败 → 整机回滚：无输出、地图逐位复原、无孤儿（CE :1576-1583）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2a_vestibule_return.test.ts | 'T3 基座二选一（V-2b-2b 起按 CE 两条蓝图）：每台恰发（附魔卷轴 XOR 生命药水），绝无双份' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2a_placement_flags.test.ts | 'P1（V-2b-7 五次顺延）feature 旗标载体普查与 V-2b-7 落地后的 CE 原表一致' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2a_placement_flags.test.ts | 'RNG 记账：EVERYWHERE 不掷 instanceCount（CE :1393 只在非 EVERYWHERE 分支）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2a_placement_flags.test.ts | '否决耗尽候选 → min 不达 → 整机失败（CE :1676-1687）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2a_placement_flags.test.ts | '整机失败时随整图回滚（CE copyMap 连 pmap.flags 一起恢复）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2b_blueprints.test.ts | '19 号 barricade / 20 号 statue doorway / 23 号 pit traps：CE 有效 feature 全等' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2b_blueprints.test.ts | 'TM_IS_WIRED 豁免（CE :1694）——已按 V-2b-3 反转：预置 wired 格先被剪线，feature 自带载体才受豁免' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_2b_blueprints.test.ts | '吞并格的花岗岩邻墙改 WALL（CE :651-656）；洞开格不得被吞（外部世界检查）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | '14 条新 DF 枚举 id ≡ CE Rogue.h 数序（对抗：抄错枚举位即错目录行）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | '24 号 beckoning：featureCt=3——CE 第 4 行 feature 是 featureCount 界外的死数据，不入表' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | 'B2 对抗：两次洗牌无条件先掷（CE :1177-1180）——空机器/机器号 0 也掷 (W-1)+(H-1) 次' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | 'B4 对抗：逐层晋升（CE :1192-1196）——同格两个 wired 层都晋升（只晋升有效地形即红）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | 'D1 端到端 67/68：踩触发板 → 全机通电 → 两喷口逐层晋升、payoff 按 CE :865 链尾缺 tile 缓办响亮登记' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | 'D1b 对抗：T_IS_DF_TRAP 载体踩上触发的 CE 形态——promoteTile 即通电，与是否先 spawn fireType 无关' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_3_wired.test.ts | 'WALL_LEVER_HIDDEN（Globals.c:347）——CE 原样不带 TM_IS_WIRED' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_4_altars.test.ts | 'A8 U19f: FUNGUS_FOREST uses its distinct CE promotion and light carrier' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_4_altars.test.ts | 'B1 DF_LUMINESCENT_FUNGUS（:608）：3 号蓝图 DF 列的起点，tile 缺口登记' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_4_altars.test.ts | 'B8 DF 枚举 id ≡ CE Rogue.h 枚举行（脚本对位 + 三条既有锚点校准）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_4_altars.test.ts | 'D2 生产代码与数据零 `MF_ALTAR_GROUP`——该旗标是 web 自创（CE Rogue.h 零命中）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_4_altars.test.ts | 'E1 X4-R2：6 seed × D1-D26 各强制一台 CE15，frequency=0 仍不进入普通抽签' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_4_altars.test.ts | 'F4 全零池：totalFreq = 0 ⇒ 一台都不建（CE :1047-1055 的 no suitable blueprints 分支）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_5_dormant.test.ts | 'A3 四条新 DF 条目 ≡ CE 目录行；DF_MISSING_TILES 顺延为 28（顺延不放宽）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_5_dormant.test.ts | 'B3 格被占则重选址（CE :4168-4181）——被普通怪占与被玩家占两种形态' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_5_dormant.test.ts | 'B4 两表皆无 → 无操作（CE 两次 removeCreature 都失败时不做任何事）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_5_dormant.test.ts | 'C2 原点半句：builtCells 为空时原点那只仍要醒（startProbability=0 的 DF，CE :679 形态）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_5_dormant.test.ts | 'C4 连通性否决失败（succeeded=false）时不得唤醒（CE 该段在 if(succeeded) 里）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_6_keys.test.ts | 'B1 否定面：非 CE 形态的 KEY feature（key_rat_trap，无外包）generatedKey 不置位——否则补偿循环被跳过、0 钥匙死局' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_6_keys.test.ts | 'B2 数据面：CE 形态的 KEY feature 都带 itemId（门钥匙 iron_key / 笼钥匙 cage_key）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_6_keys.test.ts | 'B3 Kennel 蓝图结构 ≡ CE 10 号（GlobalsBrogue.c:247-256）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_6_keys.test.ts | 'F0 U19d restores the executable secret-lever vestibule with CE frequency and features intact' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_6_keys.test.ts | 'F3 §6.3（单元口径）：disposableHere=false 的钥匙开锁后保留（CE Movement.c:636-656 收口）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_7_features.test.ts | 'A6 归属层：19 条里 10 条 DUNGEON / 8 条 SURFACE / 1 条 LIQUID（CE 原列）' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_7_features.test.ts | 'B3 CE 位置初始化异常如实登记：DF_WORM_TUNNEL_MARKER_DORMANT 的 effectRadius' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_7_features.test.ts | 'C1 深度/房间/频率/类别/蓝图旗标逐条 ≡ CE GlobalsBrogue.c' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_7_features.test.ts | 'E3 Game 段（确定性）：finalizeBlueprintMonster 消费 fleeing；dormant 分支按 CE 顺序覆盖它' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_7_features.test.ts | 'F2 携带指令：钥匙有绑定；CE8 非钥匙奖励有完整的外包/领养来源' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_7_features.test.ts | 'G2 U19f: both CE47 and CE52 closed-cage adoption machines occur naturally' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9b_environment.test.ts | 'contains the nine literal CE blueprint rows and keeps 38/39 in-pool because their escape items are implemented' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/v_2b_9c_effects.test.ts | '32 builds literal traps/pools and leaves a route to the altar and out' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | '51 mud horde really wakes on pickup; key and exit remain reachable' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | '54 pickup drives darkening, torch transition, ectoplasm and all dormant phantoms' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | '55 retains CE data and U19f restores its complete tunnel consumer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | 'a wall stops player electricity; monster SPARK lights the crystal and stops before its target' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | 'darkness reduces actual light while leaving the movement graph unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | 'four blueprint rows match every supported CE column; U19f restores #52 selection' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/v_2b_9c_effects.test.ts | 'non-electric / off-ray crystals stay off; only the last direct lightning hit releases the cage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | 'seven tiles retain all CE flag, priority, home-layer, chance and light columns' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9c_effects.test.ts | 'walks new DF tiles, propagationTerrain, subsequentDF, and reverse promote/fire parents without missing carriers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | '%s builds separated rooms with its unadjusted room-type distribution' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'CE %i really builds, materializes reachable rewards and preserves the shrunken machine-cell contract' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'MAXIMIZE wins over OPEN; OPEN alone still uses four neighbors' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'an exterior notch records only its first NB4 neighbor and loops use distance 10' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'both headers and all 19 features match CE including item/monster aliases and literal flags' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'glyph re-arms and mud smolders to gas + EMBERS with literal CE fields' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'recurses every feature terrain, DF tile, propagation terrain, successor and promote/fire edge' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'scratch loops keep -1 barriers impassable and never turn them into door candidates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9d_dungeon_profile.test.ts | 'scratch shields the exterior cell, records the first interior neighbor, uses 40/40 and reconnects >20 orphans' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_2_autogen.test.ts | 'dispatches real index %i to forced CE %i only at depths %i–%i' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_2_autogen.test.ts | 'observes six active forced carriers, CE66 restored, blocking retry, and empty rewards' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_2_autogen.test.ts | 'restores CE66 scheduler RNG while retaining the forced-only literal blueprint' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_2_autogen.test.ts | 'transcribes CE 8 exactly and leaves all six forced-only frequencies at zero' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_2_autogen.test.ts | 'uses dynamic zones beyond CE zoneSizes[200] without byte-sized zone aliases' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_area_machine.test.ts | 'CE %i reaches area selection and never gate/vestibule selection' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_area_machine.test.ts | 'audits exactly the 22 area rows including CE 8, retaining 65/66 frequency zero' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/v_2b_9e_area_machine.test.ts | 'retains attempt-500 failure for autoGen and the last coordinate for the CE area caller' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | '%s has no status, damage or autoID' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | '%s rejects before concentration or autoID' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | '%s: same 200 ticks despite different action count' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | '50-tick action has no pulse, second completes the block; final poison pulse cannot regenerate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'CE statusEffectCatalog: negation and ordinary healing both preserve poison' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'E%s gives %s, ignores charges/capacity/config magnitude, no immediate damage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'G-3 gas stays direct terrain damage, never adds a dose or countdown' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'JSON save/load retains both species doses, paused regen and half-block' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'MA_POISONS physical hit: 1 contact + rolled duration, %s target' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'UI staff submission consumes once; cancel never poisons, confirms tick once and save keeps E separate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'burning then poison with HP%s: only actual lethal source messages/loot' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'damage after poison death cannot trigger a second death or revive the player' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'invisibility prevents observation, not poison; weapon immunity is not poison immunity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'last tick deals full dose then clears concentration; re-poison starts at one' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'matches all 51 CE fixed-point table rows and both clamps, without pow approximation' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_10_poison.test.ts | 'miss, lethal contact and inanimate targets never receive a dose' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'monster regen pauses its counter throughout poison including last tick; resumes next objective tick' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'normal hostile melee uses the same single dose as geometry' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'normal melee and geometry wrappers do not apply MA_POISONS twice' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'physical bolts share MA_POISONS; poison dart remains weakening without the ability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'poison death drops loot/carried item, triggers death DF and removes corpse once at same turn end' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'poison pulses never split; later physical split inherits independent poison fields' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'returning bolt poisons player exactly once, reflector untouched' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'starvation still hurts while poisoned; lethal poison cannot be healed or relabelled starvation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'successive staff hits add both fields; only one damage pulse per tick' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'venom runic adds duration/dose without its old extra instant damage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_10_poison.test.ts | 'zero duration is inert; zero concentration increments establish but do not stack a dose' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_11_teleport_placement.test.ts | 'CE fire-trap depression prevents retrigger until the next objective environmental update' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_11_teleport_placement.test.ts | 'CE flag-based poison traps emit their DF on entry instead of requiring the legacy TRAP id' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_12_blink_beckoning.test.ts | 'CE destination gold bypasses capacity and never occupies a slot (full=%s)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_12_blink_beckoning.test.ts | 'CE pickup precedes blink vision and follows teleport vision (blink=%s)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_14_obstruction.test.ts | 'E=%s yields CE integer decrement %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_14_obstruction.test.ts | 'invalidates active path/safety caches without adding a non-CE waypoint rebuild' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_15_shielding.test.ts | 'hidden/inanimate targets and unchanged shields still autoID, CE has no living gate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_15_shielding.test.ts | 'matches compiled CE fp_pow/staffProtection golden values, including negative exponent' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_16_conjuration.test.ts | '200 objective ticks do not expire a blade or settle loot, kills, death DF, or die' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'E=%i creates %i unique real entities near final landing, independent of charges/config' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'JSON restores actual species despite translated name, ally/binding/AI, ticks, flying and negate vulnerability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'a completely full level fails cleanly, no invalid entity and no autoID' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'actively pursues enemies outside player FOV, then hits for 1 and spends attackSpeed' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'awake enemies retaliate against an adjacent blade' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'does not track player when idle; mills only on the 30% check' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'dormant and test-room restoration use the same tagged blade payload' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'down/up stairs leave blades alive on their original cached level, no follower/death/loot path' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'empty/same-origin path creates nothing and cannot autoID' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'first wait = 101 ticks under player action cost %i, then normal 50-tick movement' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'first-cell contact detonates once after travel, not once per hit plus landing' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'flying inanimate blade accepts terrain %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'horde summon keeps leader and default tracking; allied minion counts naturally include conjured blades' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'hunting enemy prefers an accessible adjacent player over a summoned blade' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'matches clang-compiled unmodified staffBladeCount for 81 fixed-point inputs' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_16_conjuration.test.ts | 'negation casters recognize the newly summoned magical enemy without requiring haste or shield' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'negation kills the actual magical entity through existing death path, bypassing shield; swept once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'occupied active/player/stair cells excluded, dormant creatures do not occupy CE HAS_MONSTER' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'ordinary lethal combat removes a blade while other blades keep their binding' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'origin first consumes no placement RNG; occupied origin chooses x-major nearest ties with RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'partial capacity produces only qualifying entities and still identifies' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'prefers reachable path cells over geometrically nearby sealed cells; forbids cutting diagonal corners' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'real UI commit cancels without mutation, then spends one charge, identifies and leaves three waiting blades' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'rejects terrain %s across layers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'same seed repeats positions; ties vary across seeds only when actually casting' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'unknown/known=%s produces entities without any Blade floating text' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_16_conjuration.test.ts | 'walls/forcefield/diagonal corners block pursuit and melee; web immunity lets it move' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | '%s contact performs no roll, conversion, cure or autoID' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | '%s ray cannot convert, cure or identify' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'HP %i/100: every possible CE roll yields exactly %i actual conversions' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'W-11 freeCaptive shares corrected leader demotion but does not clear discordant' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'W-24 supplies the domination identity/config and generation entry' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'a full-health already allied discordant target resists without being cured or detached' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'active/dormant JSON round trip retains allegiance, cleared discord, item key binding and re-elected leader references' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'actual test-room reset restores both the ally and hostile follower references from JSON baselines' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'always reflection hits the player, who remains unchanged and cannot be dominated' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'an occupied drop square searches nearby without overwriting the existing item; monsters can share a drop square' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'chance 80 percent failure leaves every target field, leader, followers and carried key unchanged (ally=%s)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'converting a leader elects current active follower, reparents later/cross-level followers, detaches dormant and bound ones' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'converting a member detaches only it from its old leader; hostile minion count falls' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'dead active entities and stale current-level cached arrays cannot win leadership on a revisited level' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'detached bound enemy dies through normal turn/death settlement once; allied bound follower survives' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'dominating the player\'s seizer retains its seizing bit but ends the hostile grab relationship' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'even chance %i consumes one substantive RNG draw' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'explicit pending fixture: cancel costs zero; confirmation at HP=%i consumes one charge/turn and visible result autoIDs' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'horde blade leader/binding round trip uses the shared entity contract' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'invisible enemy becomes observable on success; failure stays invisible and unidentified' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'known candidates exclude full health but manual fire still makes a 0% attempt; unknown kind does not leak HP filtering' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'living IMMOBILE/weapon-immune targets are eligible; no extra guessed immunity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'matches the unmodified clang-compiled formula, including integer truncation and overhealing' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_17_domination.test.ts | 'natural splitting inherits converted allegiance and binding without converting the old team' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'random reflection dominates only the actual bystander, leaving the reflector and original aim unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'real summonMinionsFor marks the CE bound horde without changing summon allegiance inheritance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'success frees a captive without calling freeCaptive/logging a separate rescue; drops same bound key, never auto-picks it up' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'successful conversion clears only discordant/captive/seized, wakes target, retains seizing and other statuses' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'test-room baseline restore uses the same relation and actual form payload' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'the converted ally attacks its former team, and an awake enemy can retaliate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'unseen success/failure (success=%s) does not identify' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_17_domination.test.ts | 'when no current follower can inherit, election visits cached levels by CE depth order, not Map insertion order' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | '%s blocks follow and leaves the actual monster in place' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | '%s rejects without waking or changing budget' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'CE enemy catalog gate rejects same-team entrancement; actual negation contact still frees it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'E=%i, not charges/catalog magnitude; weaker recast replaces' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'actual player direction %i,%i yields exactly opposite single step' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'ally AI does not pursue/attack entranced enemy; damage bolt selection also skips it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'aquatic melee rejects a levitating target before release; kamikaze also leaves recipient entranced' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'chasm: W11 marks falling, C5 transfers survivor once and clears entrancement/grabs' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'confusion/flitting cannot override controlled direction' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'controlled %s uses real P4-6 attack output' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'deep water is legal and does not drown; lava actually kills' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'diagonal corner blocks follow and secret door admits it via placement' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'directional melee even a miss follows; struck recipient releases before follow and really attacks on the next wait' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'dormant and test-room snapshot carriers preserve the new payload' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'entranced %s retains actual speed/traits after JSON load, then obeys physical movement rules' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'entranced ally neither attacks nor swaps with player teammate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'entranced seizer cannot hold player; moving seizer clears its own grip' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'fire immunity protects on lava; flight prevents chasm descent' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'fire immunity rejects before release' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'fire staff damage breaks entrancement even fully absorbed by shielding' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'follow onto gas pressure plate actually triggers terrain DF' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'follower wall collision does not sidestep/pathfind or attack; consumes player turn only' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'follows into same-faction enemy by attacking without swapping; target releases, caster remains entranced' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'haste player: follow occurs each action while duration decrements only at 100 objective ticks' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'hostile entranced creature can still attack %s (CE enemy fallback)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'invalid movement and cancelled dive never trigger follower' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'living immobile target is eligible: CE moveMonster itself has no immobile gate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'matches compiled CE duration including fixed-point truncation' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_18_entrancement.test.ts | 'mouse/automatic path steps also drive one opposite step; confused path uses the actual direction' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'new entrancement does not reveal a hidden invisible recipient (CE monsterIsHidden precedes monsterRevealed)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'non-turn action %s leaves actual location and budget unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'player wall collision with dirty render does not advance objective time or follower' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'player-origin reflected fire damages a bystander without moralAttack release (CE Items5210)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'random reflection affects actual bystander only' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'real reflection confuses player, not reflector; actual confused direction drives all entranced monsters' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'restricted-liquid follower cannot step onto land' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'save/load preserves duration/timing and actual follow/wait; absent status remains absent' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'seized entranced monster spends movement budget but stays held' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'selection/cancel costs nothing; confirmed fixture consumes charge/time once without follow' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'slow player cannot induce multiple follow steps; expiry resumes real AI on that objective boundary' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'speed %i: one follow per player move, zero autonomous move/attack/cast/summon' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'thrown weapon miss releases; environmental/direct generic damage and poison do not' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'wait leaves an adjacent entranced enemy inert and player unharmed' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_18_entrancement.test.ts | 'wakes recipient/teammates; applying to an ally retains allegiance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | '%s -> %s death uses new ability/type, exactly once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | '%s has no target, no roll, no autoID' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | '%s is a valid SOURCE despite output restrictions/weapon immunity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | '%s rejects before mutation/status/relationship writes or draws' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | '101 wait protects the cast action; the transformed creature acts on the next objective advance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'JSON round-trip retains current species, speed, item identity, hostile relation, and later death' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'autoID uses NEW invisible status only, regardless of visibility=%s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'bound ally unAlly preserves the bound bit; orphan death happens on the ordinary next-turn sink' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'cancel is zero cost; actual confirm spends one charge/turn and transforms in place' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'captive demotes after info/status reset, elects ordinary followers, detaches bound/dormant, keeps own hostile leader and item' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'cleared haste leaves new cached speed, survives unrelated expiration, then a new slow/expiry restores normal behavior' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'does not exclude %s for depth, habitat, machineOnly, or boss role' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'does not invoke immediate terrain entry or kill on losing flight; next environment pass owns lava death' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'existing 67-row projection has the exact CE order and eligible set, including composite turrets and special exclusions' | 移除 | 原CE编译输出/表格逐项对照；同文件项目性质、同版本状态及真实入口守卫保留 |
| src/test/w_19_polymorph.test.ts | 'initializeStatus derives exactly the new %s flags, permanent for 1001 ticks' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'living immobile targets may transform' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'matches every compiled CE HP/old haste+slow combination through the actual in-place operation' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_19_polymorph.test.ts | 'negation resets polymorph cached speed even without a haste status' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'normal ally loses only its own leader; its followers, including bound/dormant, keep their pointers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'old %s state %i becomes %i (including C precedence)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'ordinary save BEFORE any polymorph keeps species identity and actual traits despite a translated display name' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'random reflection transforms only its bystander contact' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'reflection into player does not polymorph the player or the reflector' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'rejects the same species and each invalid roll without spawn/depth RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'resets every projected info field but preserves creature identity, counters, bookkeeping, item and followers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'tagged dormant list and test-room reconstruction preserve form and references' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'ticksUntilTurn %i is max(old,101)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_19_polymorph.test.ts | 'unAlly/mutation/carried creature reset occurs BEFORE the first species roll' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'JSON round trip keeps all clone runtime/containers/references and next ids beyond dormant high id' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'W-20 generic clone placement honors TURRET composite INANIMATE even though plenty itself rejects it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'W-20 player regeneration progress projects into independent monster counters' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'W-8 actual fire staff now leaves both surviving jelly bodies burning' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'actual tick, shield absorption, poison and death mutate only clone state' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'ally leader=null means &player; subsequent clones retain that pointer representation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'audits EVERY object-valued Monster own field (including nested mutation arrays); no shared value container' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'burning, grabbed/entranced/poison/shield/regen inherited; levitation %i follows CE exception' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'cancel costs nothing; real confirmation spends charge/turn, newborn waits 101 then acts' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'captive copy is allied and released; original captive/key/discord/seized unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'clone death triggers ordinary DF/cleanup once and never duplicates original carried loot' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'cloning does not invoke summoning, but a real cloned follower legitimately counts for P4-2' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'current HP %i rounds UP independently; maxHP does not split' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'dead targets cannot be copied by generic helper' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'empty shot does not clone player or identify' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'explicit allied monster leader is retained without cloning the leader graph' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'leader references use existing leader, otherwise original; no rebinding original followers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'matches compiled original BE_PLENTY and cloneMonster for every HP 1..137' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_20_cloning.test.ts | 'new private safety map never aliases the parent; source changes never reach clone containers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'no valid cell anywhere is failure with no HP/id allocation/entities/RNG writes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'ordinary named clone stays ordinary, and high dormant id is reserved' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'original saved mutation provenance survives, so self split keeps its mutation-only trait' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'path fallback can find a disconnected room beyond walls' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'player clone and polymorphed clone remain Monsters with actual form after restore' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'player clone is a legitimate polymorph source, before and after saving' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'plenty failure leaves odd HP intact and autoID false' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'plenty has no 100 self-split cap; its clones count toward the subsequent self-split cap' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'plenty preserves learned bolts and flags, unlike self split' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'real melee clone kill does not advance weapon familiarity, original kill does' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'reflected player produces gray allied @, 1d2/0 defense, copied HP/status/speed, no inventory' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'rejects inanimate/invulnerable %s without writes or RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'retains polymorph cached speed, current learned/negated capabilities; does not rebuild from catalog' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'reverse mutation of clone.%s leaves parent byte-for-byte unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'searches through occupied creatures to next free distance ring' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'stairs/player are forbidden, dormant monster does not occupy active cell' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'temporary levitation does not change info-based avoidance; native flight does' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_20_cloning.test.ts | 'unobserved invisible success still identifies (CE no sight gate)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'JSON saves active/dormant/counts/form and test reset uses same fields' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'W-19 actual polymorph replaces enhanced info but retains both counts, then can be empowered again' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'W-20 cloneMonster copies stats and counts; subsequent hits are independent' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'W-9 ordinary healing remains percentage-only; at full HP panacea still cures' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'actual PLENTY and self-split both preserve strengthened attributes and counts' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'actual inventory selection/cancel/submit spends one charge, identifies singleton wand and schedules one turn' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'ally details show pending talents; waiting after an unlearnable kobold death preserves them' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'autoID observes %s while successful empowerment always creates CE light' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'empty shot and dead helper recipient have no effect' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'existing negation recovers slots except invulnerable/death paths, without removing numeric gains' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'immune %s blocks travel without any writes, flash, identification or RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'matches 540 compiled original CE cases, including zero and decade boundaries and twelve successive hits' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_21_empowerment.test.ts | 'matches compiled CE for all modeled statuses when duration=%i' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_21_empowerment.test.ts | 'reflected beam reaches player but neither heals, cures nor empowers it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'same fixed increments for ally=%s; no allegiance, mutation or ability changes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'save after polymorph keeps retained counts alongside the new catalog stats' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'slow survives at one turn and expires normally; panacea does not clear burns, grabs or paralysis' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_21_empowerment.test.ts | 'strengthened bounds reach real melee damage, and precision/defense reach hit probability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | '%s is not eligible for known auto-target but DOES autoID on manual hit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'AI selects weapon-immune or magical enemies and terrain vulnerabilities, cures discordant actual teammates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'active/dormant JSON, reset and clone preserve stripping and mutation removal without rebuilding species' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'all shipped bolts, including arrows/darts/web/vines/blink, are negatable regardless of learnability' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'autoID uses visibility after clearing invisibility; hidden offscreen remains unobserved' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'description reads wasNegated AND count equality; polymorph clears it and clone copies it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'die-if-negated %s message, bypass shield and skip states/counts/tile' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'fiery trait removal extinguishes, but no automatic rederivation; repeated negation stays inert' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'invulnerability rejects automatic targets but direct negate still removes abilities/grip before its gate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'loss of flight immediately evaluates terrain %s without waiting' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'matches original compiled CE status rows (player=%s)' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_23_negation.test.ts | 'mutation %s: clear only CE-negatable identity, never reverse numeric changes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'permanently removes %s with wasNegated' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'plain target is unchanged, returns false and emits no stripped message; count reset alone is not an effect' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'plain-floor negation has no RNG; W-24 supplies its catalog item' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'player one-turn safety lasts until the normal expiry tick; negation does not create absent protection' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'poison dose, paralysis, weakness, ordinary burning and web regeneration survive; shield and magical states clear' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'real scroll entry preserves poison, removes caster bolts and traits, and does not undo domination/empowerment' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'reflect-all only excludes bolt eligibility; blast kills it and reflected beam negates the player' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'retains four physical geometry abilities, removes all other MA flags including death DF before death' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'speed-only and grip-only effects do not set wasNegated; learned count restoration is inside living/non-invulnerable branch' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_23_negation.test.ts | 'synthetic non-negatable bolts follow backup sentinel and CE surviving-tail behavior, restoring catalog afterwards' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | '%s: normal use/cancel/confirm runs the existing effect with no substitute config' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | '%s: unknown flavor, polarity detection, discovery suffix and full identification' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | '64 seeds × 1000 real kind+instance draws: all nine kinds, weighted frequencies, uniform charges, exact RNG calls' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | 'all 22 tickets follow the CE intervals through the actual Game kind selection' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | 'current mapping, identity sets, calls and depleted instances survive real load; legacy flavor saves are rejected' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | 'machine WAND/STAFF requests materialize CE identity/resources through U05' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | 'new kinds participate in both polarity elimination groups and enchant by their CE lower bound' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | 'new save preserves all eleven flavors; partial maps fill new identities uniquely without RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_24_wand_catalog.test.ts | 'parses the actual CE rows: order, frequency, market value, charge range, polarity, power and flavor slots' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_25_staff_catalog.test.ts | '%s: initial/reset/natural/enchantment CE exceptions' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | '%s: real selection, cancel, confirmation, resource/time/autoID and actual effect' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | '%s: unknown appearance, polarity, discovery and full identification' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | '64 seeds × 1000 real kind/instance draws: 12 kinds, weighted frequency, uncapped E, per-item exact RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'E%s: known-capacity preview and actual travel; remote cursor allowed, cancel zero consumption' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'all 110 tickets follow the CE row intervals through the real kind selector' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'current mapping, empty charges/calls/known sets and timer survive load; legacy flavor saves are rejected' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'known blink/tunnel aim at cells, entrancement targets eligible enemies; unknown kinds retain generic candidates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'known kind/unknown range prompts; rejecting cancels, hidden kind never reveals lava risk or E' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'known lethal landing refuses before charge/time/RNG; fire immunity permits existing effect' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'machine direct/category staff requests materialize CE identity/resources through U05' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'new maps, partial maps and current blink timer are deterministic' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'new positive kinds participate in elimination; known blink details expose distance only with capacity known' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_25_staff_catalog.test.ts | 'parses all twelve CE rows including non-contiguous wood slots, range, polarity, value and power' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/w_25_staff_catalog.test.ts | 'real blink scroll resets 10000/E; absent timer uses 1000 and full timer freezes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | '%s participates in its CE polarity elimination group without revealing other kinds' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | '%s: known target direction, unknown polarity fallback and manual cells' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | '%s: unknown selection/cancel, one commit, real effect, outcome-based identification' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | 'W-25 saved flavors/calls/empty staff survive real load; fill three missing slots without RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | 'new identities and current E/capacity/timer round-trip independently without RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | 'obstruction actual identity: initial1000, inventory natural timer/clump, full freeze, scroll10000/E, enchant500/E' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_26_arcana_closure.test.ts | 'obstruction has no blink risk confirmation; discord/protection reject inanimate automatic candidates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_2_arcana_submission.test.ts | '%s uses its known CE target flags (%s), then consumes only one existing charge' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_2_arcana_submission.test.ts | '11 existing CE items enter selection without charge, turn, identity or RNG changes; Escape cancels' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_2_arcana_submission.test.ts | 'invisibility CE ally/revealed condition and beckoning actual movement are observed; casterMovement is not target movement' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_3_bolt_trajectory.test.ts | 'CE defaults to center when every candidate scores nonpositive (collinear teammates)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_3_bolt_trajectory.test.ts | 'CE diagonal center rounding in all octants and exact corner passage do not use movement corner blocking' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_3_bolt_trajectory.test.ts | 'CE diamond offset selection goes around a centerline obstruction while still passing the aim' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_3_bolt_trajectory.test.ts | 'adjacent obstruction: CE first-update exception for conjuration; blink guard has no landing or origin exposure' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_4_bolt_reflection.test.ts | '%s reaches the player (W-9 slow/invisibility; W-10 retires poison 12 in favor of CE E2=5)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_4_bolt_reflection.test.ts | 'repeated guaranteed reflection terminates at the CE path budget and keeps every animation/hit index finite' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_5_arcana_instance.test.ts | '%s uses its inclusive CE range, endpoints and actual RNG footprint' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_5_arcana_instance.test.ts | '50,000 staff draws follow CE 50% / 42.5% / 6.75% / 0.675%, including tail >5' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_5_arcana_instance.test.ts | 'CE staff conditional draws / exact threshold sequence %j -> E=%i' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_5_arcana_instance.test.ts | 'W-26 has twelve CE staffs; W-24 nine CE wand identities/frequencies remain unchanged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_5_arcana_instance.test.ts | 'every existing CE staff spawns full with E=capacity; consumption changes current charges only' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_6_arcana_recharge.test.ts | 'CE normalizes an overlong timer at unusually high E without RNG or changing E/capacity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_6_arcana_recharge.test.ts | 'W-25/26 activate both CE slow-cycle identities' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_7_arcana_enchantment.test.ts | 'capacity synchronizes to CE E, never refills missing uses from an old capacity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_8_staff_damage.test.ts | 'U06 monster %s uses CE catalog staffDamage without physical attack' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_8_staff_damage.test.ts | 'player fire reflected by %s damages/ignites a jelly but cannot split it (CE Items.c:5210)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_9_directed_status.test.ts | '$id only identifies an observable recipient; telepathy does not reveal hidden invisible (CE)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_9_directed_status.test.ts | 'CE directed states do not inherit custom web status immunity/resistance; generic entry remains separate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/w_9_directed_status.test.ts | `${flag}: $id applies exact CE effect gate (healing is allowed)` | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2c_hit_status_owner.test.ts | 'keeps legacy rows in data but gives the three non-CE hits no effect' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2d_scroll_equipment.test.ts | 'CE forced refresh: enchanting the worn armor=%s clears only its DONNING, preserving maxStatus' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2d_scroll_equipment.test.ts | 'enchants the entire thrown stack and draws exactly the CE 1..60000 quiver roll' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2d_scroll_equipment.test.ts | 'first unknown scroll: CE kind alias at autoIdentify tail, %s reveals rune=%s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'keeps a no-space guardian attempt finite while still spending cooldown and a turn' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'matches 624 compiled original C cases, including clamp and signed-short boundaries' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2e_charms.test.ts | 'matches all twelve CE table rows in order and frequency, including category-only machine requests' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2e_charms.test.ts | 'negates self, creatures and floor items at radius+1, with LOS/radius boundaries and inventory exclusion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'overwrites levitation duration/maxStatus, frees seizure, and rejects cooling/foreign items without time or RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'recharges every staff using W6 timers, excludes wands/other charms, and the scroll still charges all charms' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'retains birth range/tail, identified state, cooldown, all own fields and zero-RNG enchanting for each new kind' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'shatters through walls at CE radius, preserves outside/protected cells and invokes U15a exactly once' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'summons a grounded, fire-immune bound guardian with CE lifetime, turn delay, save and expiry' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'uses CE terrain-aware teleport selection/commit, disentangles, retains seizure flags and spends once even without destinations' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2e_charms.test.ts | 'uses the same formulas for current/enchant preview in Chinese and leaves the five CE Discoveries groups intact' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2f_thrown_math.test.ts | 'a miss spends one hit die; auto hit spends none; immune hit spends no damage dice' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2f_thrown_math.test.ts | 'instance {$lo,$hi,$clump}, enchant {$enchant}, strength {$strength}: distribution and RNG tuples' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2f_thrown_math.test.ts | 'slaying gives 100% hit probability but still consumes attackHit die' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'CE inflictLethalDamage from quietus/slaying still emits zombie blood and bypasses shields' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'blink lands on submerged occupants after CE shuffled Manhattan relocation; no home is silent administrative death' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'darkness throw creates a negative light gas, drinking keeps its own status; terrain and statuses survive save' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'hides identity above water, telepathy only marks location, underwater observers see; throws and bolts pass through even when seen' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'lethal rot blood from burning, explosion and gradual terrain has exactly one death callback' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'lichen regrows at the old cell, spreads at 2%, cannot cross lava, and respects flight/inanimate immunity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'matches 1024 CE submerge eligibility cases and 16 observer cases' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2g_native_effects.test.ts | 'matches original C blood truncation for 8000 damage/HP pairs; fully shielded hits do not bleed' | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x2g_native_effects.test.ts | 'quaff, throw and infested death plant real terrain; contact caps duration without adding concentration' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'renders rot tint from the live gas layer before mirror refresh, preserving glyph and using CE density weight' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'restores both CE frequency-7 potions; save/load preserves the next turn including gas, lichen and surfaced state' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x2g_native_effects.test.ts | 'submerged and surfaced aquatic creatures on submergible terrain do not press either legacy or CE plates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'submerged creatures never alter bolt tuning or blink impact, even for underwater observers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'submerged creatures resist nausea, damage, paralysis, explosions, fire and webs but not confusion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'submerges at 20%, surfaces on attack/dry placement, retains seizure exception, and saves the actual runtime bit' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2g_native_effects.test.ts | 'uses CE surface lichen and all three DF sources, not a lichen monster or gas' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2g_native_effects.test.ts | 'zombies emit 15 volume per objective tick; living contact causes nausea, inanimate and respiration are immune; gas burns and saves' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'PERM_FLEEING survives thrown attempts and both damage bolt paths, with thrown miss retaining fear and bolt damage shortening it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'always-hunting outranks permanent flight; immobile awareness outranks the ordinary mode branches' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'does not steal: %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'excludes every equipped slot but samples unequipped stacks equally, not individual quantities' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'feared enemies require both traversible terrain and an unobstructed creature path' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'fears attackers within 3, recovers at 3, and respects fear, immunity, kamikaze and poisoned prey' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'lost awareness wanders toward the remembered location, not the current player' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'matches the original compiled CE updateMonsterState over all 10,240 branch combinations' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2j_monster_ai.test.ts | 'noise wakes a permanent thief without losing its mode or waking permanent-mode packmates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'quarter-health entry / three-quarter retention at %i HP' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'remembering a waypoint consumes no RNG and survives until lazy initialization on actual wandering' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'requires a second attackHit and permits a zero-damage hit to steal' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'returns carried item on %s without duplicating it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'safe terrain and ally maps persist through a player action and reset on the next action' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'save/reload during flight preserves split identity, private maps and exact next action' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'sleep awareness is a 25% roll and awakening consumes the action, alerting normal horde members' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'steals category %s stack %i -> %i with one owner' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'successful scheduled theft interrupts automatic travel' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'target-owned map reuses stale terrain / traveler costs until current target distance exceeds 3' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2j_monster_ai.test.ts | 'thief keeps fleeing out of sight; loss of the item resets mode only after magical fear expires' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'binds restored monsters and preserves appearance through purgatory save/raise' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'catalog ENTER_SUMMONS survives negation, restores info/statuses and consumes no construction RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'drops before the DF; dying reentry is inert; list/purgatory move only at sweep' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'drops on an occupied monster cell; item restrictions do not block paths; valid origin consumes no RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'falling suppresses DF, dormant death suppresses release and clears dormant occupancy' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'matches original C Grid.c + Dijkstra.c + getQualifyingLocNear on 256 terrain/occupancy maps' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2k_lifecycle.test.ts | 'nested explosive deaths finish before the outer leadership demotion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'pins CE death DF rows and the explosive mutation override' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'releases a passenger immediately, applies lethal contact, and does not repeat either death' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'reports loss immediately only for an unseen, unbound ally without a passenger' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'restored vampire info replaces %s death DF across JSON, retaining mutation bookkeeping' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'selects highest power, then CE monsterID; no RNG for a valid origin and no dormant occupancy exclusion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'silent administrative death suppresses DF/drop/passenger/resurrection but demotes followers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'uses x-major nearest path ties, rejects corner cutting and falls back across sealed walls' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2k_lifecycle.test.ts | 'vampire death uses the CE blood explosion on the existing surface layer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2l_reflected_death.test.ts | '%s ends on fatal contact with CE attribution' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'bakes separate fore/back random channels with CE integer arithmetic' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'checks every DF flare symbol against its CE source row and executes explosion DF' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x2m_lighting.test.ts | 'confusion gas consumes its background random channels and preserves the terrain glyph' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'does not reveal through a wall or cursed clairvoyance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'empowerment actually casts on hidden=%s; light has no identity-observation gate' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'expires stale turn entries and discards light across level travel' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'idle render color draws do not move either recorded RNG stream or later flare knowledge' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'keeps terrain samples stable between renders, dances only visible dancers, never draws main RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'negative runic light can temporarily extinguish visibility without altering base channels' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'real %s runic dispatcher queues CE flare and respects submersion' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'real falling move creates the landing flare on the destination level' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'reveals dark FOV, shares sidebar gates, remembers items, restores base light/shadows and hides identity afterward' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'samples light color/radius and preserves stream selection even on exceptions; base light never dances' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'skipped frames, fine playback and save during playback preserve identical knowledge and both RNG states' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2m_lighting.test.ts | 'summoning uses random-only CE color and remains neutral to substantive RNG during animation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2n_lumenstone_description.test.ts | '$label: persists the CE description and preserves both scoring rules' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2o_horde_clump.test.ts | '%s clumped D30 horde places exactly the rolled members on real terrain' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2o_horde_clump.test.ts | 'all CE-mapped blueprints match both depth endpoints; unmapped rows remain explicitly retired' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2o_horde_clump.test.ts | 'all summon rows use their complete CE triple through the actual summon consumer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2o_horde_clump.test.ts | 'every ordinary/captive/machine horde consumes each member triple exactly once before placement' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x2o_horde_clump.test.ts | 'exhausts every C branch, value and rand_range call sequence, including constant and oversized clumps' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2o_horde_clump.test.ts | 'pins CE source provenance and every member triple in all 175 rows' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x2o_horde_clump.test.ts | 'same initial real RNG has the C-oracle result, logical draw count and complete final state on both streams' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x3_u2_ally_captive.test.ts | 'CE visibility/confusion/hallucination exemptions still apply; telepathy restores hallucination confirmation' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u2_ally_captive.test.ts | 'an enclosed landing uses CE square-ring fallback across blocked diagonal corners' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u2_ally_captive.test.ts | 'applies CE current-terrain exception after relocation: deep water does not force fallback' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u3_cursed_equipment.test.ts | 'CE refuses a loose cursed singleton with timesEnchanted >0 after Yes as well' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u4_auto_travel.test.ts | '%s first sight has the CE stop/message policy' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u5_commands.test.ts | '%s: already there is a no-turn CE message' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u5_commands.test.ts | '%s: unknown stairs report CE failure without exposing the target or spending a turn/RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u5_commands.test.ts | 'adjacent %s has CE isDisturbed semantics' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u5_commands.test.ts | 'recovery is capped at CE TURNS_FOR_FULL_REGEN (300) turns, without changing regeneration rates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'C13 leaves no Chinese defaults in Game and C04 flags every existing CE source family' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'CE !FOLDABLE allows latest cross-turn folding; combat FOLDABLE does not' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'CE distance %i, speed %i, duration %i => %s' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'CE message turns advance for nested forced eating, but not paralyzed turns' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'does not search the 1360th old entry when full, matching the CE ring scan' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'expiration %s has its own CE prose' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u6_messages.test.ts | 'hunger %s has food suffix and CE acknowledgment policy' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u7_sidebar.test.ts | '%s uses live state and CE precedence' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u7_sidebar.test.ts | 'uses the first flagged terrain layer, not the top drawn layer; covers every listed kind through the CE text catalog' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8b_items.test.ts | 'full pack walking emits CE message, marks floor item, and repeated exploration never retries it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'CE integer thresholds clamp 2/3/4/5 verb grades, fists and concealed/hallucinated attackers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'all 68 attack tables and all 15 overlapping classes match the local CE source' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x3_u8c_combat_items.test.ts | 'buffers in attack order, flushes before normal messages and folds only display copies' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'call dispatch distinguishes a whole unidentified kind from one inscribed instance' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'every grade has a Chinese translation; no numbers/weapon names by default, optional suffix only' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'hints each matching equipped item once, acknowledges, persists without revealing the rune or drawing RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'inscription/relabel are zero-turn/zero-RNG, swap occupied letters, validate labels and survive reload' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'keeps English text usable before the translation service initializes' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'new-game inscription and relabel recordings replay and seek with zero OOS' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'real move/turn flushes melee text and the display setting leaves all non-log snapshot fields/RNG identical' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'requires direct sight (not telepathy, clairvoyance, invisibility, dormancy or submerged location)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'startFighting suppresses nonlethal hits/misses, still reports lethal hits; distant sound once per turn' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'unseen combat conceals both names and optional damage, including death/destruction' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3_u8c_combat_items.test.ts | 'weapon damage range and all circumstances are captured before waking the target, without text RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'DF activation leaves completed dormant corpses linked and inert until the sweep' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'a dead final follower cannot keep a leader avoiding corridors' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'auto-explore does not auto-attack or mark a stale visible corpse as seen' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'checks later members at visit time; a stable cohort does not admit a released passenger twice' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'dead allies/followers do not count toward summoning or wake with the horde' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'demotion skips completed dormant followers but detaches living dormant followers' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'dying DF retains occupancy and iteration; reentry cannot duplicate its effects' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'explosion chain removes completed victims from live queries before sweeping' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'group discord/negation leave corpses untouched and still affect living targets' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'invisible dead enemies do not affect ally selection/maps or draw target RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'light, visible identity, telepathy markers, sidebar and auto-targets ignore listed corpses' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'matches original CE iterator for every death mask; HP zero alone is not HAS_DIED' | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x3a_live_iteration.test.ts | 'monster spell selection neither heals a corpse nor consumes a target roll for it' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'opening a cage cannot recruit a listed corpse or make it eligible for resurrection' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'purgatory remains a raw resurrection payload; a restored ally is live again and can die again' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'released passenger participates only if contact survives (lethal=%s)' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'scent following uses the same direction and RNG through a completed death cell' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'seed22013 fear and real wait match a swept control with corpse at index %i' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3a_live_iteration.test.ts | 'stale visible corpse at x=%i cannot divert or stop the next auto step' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3b_display_recording.test.ts | 'keeps each state equal with frames, automatic/animated playback, backward seek and strict OOS' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3b_display_recording.test.ts | 'keeps item selection, confirmation, throwing and a real endgame equal in animated mirrored replay' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3b_display_recording.test.ts | 'normalizes callback commands and autonomous steps before their consumers run' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x3b_display_recording.test.ts | 'replays quaff -> flare -> use -> confirm without changing the default target or spending charges' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'burning bursts a pod into healing gas; burning hay produces stench and ordinary fire' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'has no substituted DF tile or propagation carrier, and accounts for every absent CE enum' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x4_r1_world_catalog.test.ts | 'healing retains CE integer order, minimum, cap and inanimate/submerged exclusions' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'independent fire identities have CE successors, light and burning membership' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'new descriptions, flavor and two activation messages use i18next and Chinese resources' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'preserves every CE field of the fifteen new terrain and their visuals' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x4_r1_world_catalog.test.ts | 'real natural generation produces stalks and pods; a grown pod bursts through the player bump path and supplies healing spores' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'the real Game move command bursts an adjacent pod; healing gas survives a save round trip' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'urine evaporates, guardian glow vanishes and burned carpet retains its own surface identity' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r1_world_catalog.test.ts | 'uses actual CE IDs and complete fields for all nineteen new DFs' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x4_r2_generation.test.ts | 'CE15 forced entry stops on success, caps failures at 50, and only runs on D26' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r2_generation.test.ts | 'CE9/10 truncate inactive storage rows and CE19 actually produces each alternative exclusively' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | '%s emits its CE objective feature while asleep/paralyzed/submerged' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | '%s emits only in activation and uses existing one-time DF messages' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'burns empty impact cells and consumes exactly the detached unit; ordinary darts decline' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'calls the existing CE alarm at width+height and retains waking, pursuit, scent and player status' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'derives feature state through mutation, info reset and saved species without adding a timer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'lays each blood family through the real layered DF spread, with damage-dependent coverage' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'matches all 68 CE catalog rows and real DF enum IDs, including bloodless species' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x4_r3_creature_items.test.ts | 'preserves RNG for DF_NONE, skips dormant/dead/zero chance and respects unsuccessful rolls' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'preserves zombie gas after shielding, on lethal hits, and in its objective puff' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'registers the missing CE scroll in generation, polarity, metering, names and detail text' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x4_r3_creature_items.test.ts | 'retains %s DF info through real negation, graph round-trip and resurrection reset' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'truncates both C divisions, caps by pre-hit HP and never mutates the catalog' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r3_creature_items.test.ts | 'uses real fire exposure after the DF, including immunity, water, submerged and thrower cases' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'all 12 staff branches with known capacity E=%s; remaining charges stay hidden' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'all 21 CE runes have gated prose; numerical triggers require instance identification' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'all charms include E/E+1 recharge; protection and invisibility include CE limits' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'all nine wand ranges, use count, remaining/empty uses and increments respect both knowledge gates' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'covers all 100 CE identities, with effect assertions and forbidden information' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'equipment next-enchantment includes strength reduction, including the zero-requirement edge' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'food boundary, carried/vault origin, no-context omission and special assets' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'hidden E, curse, rune and remaining uses have no effect on unknown output' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'inline Game status/healing formulas agree with actual E and E+1 effects' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'known capacity is the sole E projection for an unidentified staff, including inconsistent legacy fixtures' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'ring cap appears only after familiarity or detection; curse is independent of kind identification' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'the existing ground-inspect outlet shares context-free sections and consumes no time/RNG' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'unknown %s never exposes hidden identity or effect' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'unknown current equipment is stripped of hidden enchantment before comparison' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'uses apparent wisdom, observed history only, and never reads a hidden recharge timer' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r4_item_details.test.ts | 'uses catalogue descriptions for restored instances and the restored R3 aggravation item' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r5_content_text.test.ts | 'accepts an explicit locale without consulting or mutating global game state' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r5_content_text.test.ts | 'compares priorities across ALL layers, including gas, with CE tie order and no flavor fallback' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r5_content_text.test.ts | 'covers all 67 species and preserves the eight CE summon identities and all status distinctions' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x4_r5_content_text.test.ts | 'covers every current web terrain, including the 88 former ground fallbacks and NOTHING' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r5_content_text.test.ts | 'keeps all undiscovered secrets disguised and uses the CE discover tile only when explicitly known' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r5_content_text.test.ts | 'pins all 215 CE rows and all 188 nonempty flavors against the actual C source' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 移除 | 纯外部CE源码行/枚举/表格或编译C输出逐项对照，不是本项目自身正确性守卫 |
| src/test/x4_r5_content_text.test.ts | 'registers the content namespace, including the two ancient-spirit terrain keys' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r5_content_text.test.ts | 'restores %s and keeps visibility/once-per-reset eligibility' + (hasCeSource() ? '' : ' — ' + CE_SKIP_REASON) | 混合剥离 | 移除CE源码/编译输出部分，保留原项目状态、消费、显示或同版本完整生命周期断言 |
| src/test/x4_r5_content_text.test.ts | 'uses the remembered stack and its knowledge, without borrowing current discovery or hazards' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r6_integration.test.ts | 'naturally generated bloodwort bursts by a player move, heals by CE integer division, and resumes identically after JSON load' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |
| src/test/x4_r6_integration.test.ts | 'standing uses CE flavor and respiration/levitation/disturbed/end gates without writing history' | 保留 | 项目自身入口、生成/显示/状态正确性、确定性或同版本生命周期；CE命名/注释不构成外部对照 |

## 完整发现/依赖/归属矩阵

下表620文件全部在发现清单，未排除；self/base表示无观察到跨包需求，required缺包产生明确声明组skip，optional保实际安装树分支。每条直接/间接/fixture需求witness见完整静态JSON。

| 文件 | owner | 当前用途分类 | inferred | required | optional |
|---|---|---|---|---|---|
| src/data/hordes.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/data/monsterBolts.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/data/monsterDamage.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/data/monsters.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/engine/Combat/BoltCatalog.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/engine/Combat/BoltContract.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/Combat/CombatFormulas.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/Core/snapshotQuantity.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/Core/startingKit.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/Items/itemFlavors.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/Random.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/UI/DetailGenerator.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/engine/UI/Discoveries.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_body.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_combinations.test.ts | combat | 项目自身守卫保留 | crafting,foraging,giants,growth,narrative,settlement | — | crafting,foraging,giants,growth,narrative,settlement |
| src/ext/modules/combat/tests/combat2_content.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_defense_cancel.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_evasion.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_growth.test.ts | combat | 项目自身守卫保留 | crafting,foraging,giants,growth,narrative,settlement | — | crafting,foraging,giants,growth,narrative,settlement |
| src/ext/modules/combat/tests/combat2_integrated_natural.test.ts | combat | 项目自身守卫保留 | crafting,foraging,giants,growth,narrative,settlement | — | crafting,foraging,giants,growth,narrative,settlement |
| src/ext/modules/combat/tests/combat2_links.test.ts | combat | 项目自身守卫保留 | crafting,foraging,giants,growth,narrative,settlement | — | crafting,foraging,giants,growth,narrative,settlement |
| src/ext/modules/combat/tests/combat2_natural.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_persistence.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_revisit.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_runtime.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat2_sdk_repro.test.ts | combat | 项目自身守卫保留 | crafting,foraging,giants,growth,narrative,settlement | — | crafting,foraging,giants,growth,narrative,settlement |
| src/ext/modules/combat/tests/combat2_ui.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_adapters.test.ts | combat | 项目自身守卫保留 | giants,growth,narrative | giants,growth,narrative | — |
| src/ext/modules/combat/tests/combat_animated_defense.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_body_transition_facts.test.ts | combat | 项目自身守卫保留 | giants,growth,narrative | giants,growth,narrative | — |
| src/ext/modules/combat/tests/combat_bonfire_definitions.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts | combat | 项目自身守卫保留 | narrative | narrative | — |
| src/ext/modules/combat/tests/combat_bonfire_ui.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_combinations.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_defense_state.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_display.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_dodge.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_dodge_ui.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_foundation_dodge_gate.test.ts | combat | 项目自身守卫保留 | giants | giants | — |
| src/ext/modules/combat/tests/combat_native_defense.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_native_stamina.test.ts | combat | 项目自身守卫保留 | growth | growth | — |
| src/ext/modules/combat/tests/combat_parry.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_parry_advisory.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_parry_decision.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_parry_ui.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_part_break.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_part_break_runtime.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4d_playable_recording.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4d_rest_relations.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_phase4e_recording.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_planner.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_runtime.test.ts | combat | 项目自身守卫保留 | growth,narrative | growth,narrative | — |
| src/ext/modules/combat/tests/combat_scheduler_due.test.ts | combat | 项目自身守卫保留 | giants,growth,narrative | giants,growth,narrative | — |
| src/ext/modules/combat/tests/combat_schema.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_sdk_generation_identity.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_square_replay.test.ts | combat | 项目自身守卫保留 | giants | giants | — |
| src/ext/modules/combat/tests/combat_ui.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/combat/tests/combat_warning_map.test.ts | combat | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_combinations.test.ts | crafting | 项目自身守卫保留 | combat,giants | combat,giants | — |
| src/ext/modules/crafting/tests/crafting_commands.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_config_examples.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_data_tables.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_geometry.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_input.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_module.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_persistence.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_placement.test.ts | crafting | 项目自身守卫保留 | giants | giants | — |
| src/ext/modules/crafting/tests/crafting_projection.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_regen.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_rejections.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_runtime.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_schema.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_sdk_integration.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_trace.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_ui.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/crafting/tests/crafting_work.test.ts | crafting | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_atomic.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_combinations.test.ts | foraging | 项目自身守卫保留 | giants | giants | — |
| src/ext/modules/foraging/tests/foraging_commands.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_companion.test.ts | foraging | 项目自身守卫保留 | giants | giants | — |
| src/ext/modules/foraging/tests/foraging_config_examples.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_data_tables.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_eat.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_feed.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_fire.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_imports.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_knowledge.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_leak.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_module.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_names.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_nodes.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_persistence.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_roast.test.ts | foraging | 项目自身守卫保留 | combat | combat | — |
| src/ext/modules/foraging/tests/foraging_schema.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/foraging/tests/foraging_trace.test.ts | foraging | 项目自身守卫保留 | crafting | crafting | — |
| src/ext/modules/foraging/tests/foraging_ui.test.ts | foraging | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_combinations.test.ts | giants | 项目自身守卫保留 | combat,crafting,foraging,growth,narrative,settlement | — | combat,crafting,foraging,growth,narrative,settlement |
| src/ext/modules/giants/tests/giants2_contract.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_generation.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_geometry.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_imports.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_parts.test.ts | giants | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/ext/modules/giants/tests/giants2_persistence.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_phase.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_trace.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants2_ui.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_c5_placement.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_colossus.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_committed_transition.test.ts | giants | 项目自身守卫保留 | combat,growth,narrative | combat,growth,narrative | — |
| src/ext/modules/giants/tests/giants_composite.test.ts | giants | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/ext/modules/giants/tests/giants_composite_natural.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_composite_sfc.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_config_examples.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_contract.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_rigid.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_runtime.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_spine_trace.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_trace.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_transitions.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_transitions_sfc.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_ui.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_zones.test.ts | giants | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/ext/modules/giants/tests/giants_zones_natural.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/giants/tests/giants_zones_sfc.test.ts | giants | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_attributes.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_body_transitions_rewards.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_classic_isolation.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_clone_overhealth.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_combat_stats.test.ts | growth | 项目自身守卫保留 | combat | combat | — |
| src/ext/modules/growth/tests/ext_growth_composite_rewards.test.ts | growth | 项目自身守卫保留 | combat | combat | — |
| src/ext/modules/growth/tests/ext_growth_config.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_content_rewards.test.ts | growth | 项目自身守卫保留 | narrative | narrative | — |
| src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_creation_view.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_data_contract.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_death_projection.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_descriptions.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_evaluator.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_identities.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_identity_adversarial.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_identity_runtime.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_item_runtime.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_items.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_lifecycle.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_optional_rewards.test.ts | growth | 项目自身守卫保留 | narrative | narrative | — |
| src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_progression.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_public_effects.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_runtime.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_skill_integration.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_skills.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_skills_movement.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_skills_slot_order.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_sources.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_square_melee.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_target_knowledge.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_templates.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_templates_runtime.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_ui.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/growth/tests/ext_growth_view.test.ts | growth | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_combinations.test.ts | narrative | 项目自身守卫保留 | combat,crafting,foraging,giants,growth,settlement | — | combat,crafting,foraging,giants,growth,settlement |
| src/ext/modules/narrative/tests/narrative2_data.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_graph.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_imports.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_metadata.test.ts | narrative | 项目自身守卫保留 | settlement | — | settlement |
| src/ext/modules/narrative/tests/narrative2_persistence.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_rewards.test.ts | narrative | 项目自身守卫保留 | growth | — | growth |
| src/ext/modules/narrative/tests/narrative2_runtime.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_trace.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_ui.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative2_world.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_combat.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_content.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_dialogue.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_kernel.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_persistence.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_portrait_pixels.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_rewards.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_runtime.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_schema.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_sessions.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/narrative/tests/narrative_ui.test.ts | narrative | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/foundation_lifecycle_repair.test.ts | settlement | 项目自身守卫保留 | crafting,foraging | crafting,foraging | — |
| src/ext/modules/settlement/tests/foundation_retirement_replay.test.ts | settlement | 项目自身守卫保留 | crafting,foraging | crafting,foraging | — |
| src/ext/modules/settlement/tests/foundation_xr_repair.test.ts | settlement | 项目自身守卫保留 | crafting,foraging | crafting,foraging | — |
| src/ext/modules/settlement/tests/resident_captive_natural.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_codec.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_combinations.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_escort.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_failures.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_fall.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_foraging_integration.test.ts | settlement | 项目自身守卫保留 | combat,crafting,foraging,giants,growth,narrative | combat,crafting,foraging,giants,growth,narrative | — |
| src/ext/modules/settlement/tests/resident_jobs.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_labor.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_lifecycle.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_natural.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_needs.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_performance.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_performance_preparation.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_production.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_production_codec.test.ts | settlement | 项目自身守卫保留 | crafting | crafting | — |
| src/ext/modules/settlement/tests/resident_production_economy.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_production_food.test.ts | settlement | 项目自身守卫保留 | crafting,foraging | crafting,foraging | — |
| src/ext/modules/settlement/tests/resident_production_replay.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_replay_import_ui.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_scale.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/resident_sources.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_boundaries.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_camera.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_display.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_harvest.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_input.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_inventory_ui.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_materials.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_natural.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_performance.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_persistence.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_raid_async.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_raid_performance.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_raid_replay.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_raids.test.ts | settlement | 项目自身守卫保留 | combat,giants,growth | combat,giants,growth | — |
| src/ext/modules/settlement/tests/settlement_review.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_runtime.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_safety.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts | settlement | 项目自身守卫保留 | combat | combat | — |
| src/ext/modules/settlement/tests/settlement_ui.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/ext/modules/settlement/tests/settlement_validation.test.ts | settlement | 项目自身守卫保留 | self/base | — | — |
| src/test/ai_1_scent_tracking.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/armor_display_effect.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/armor_model_effect.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/armor_runic_effect.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b1_retire_invented.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b2_transcription.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_1_weapon_specials.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_1a_identification.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_1b_identification_persistence.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_1c_detect_magic.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_2_throwing.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_4a_item_generation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/b_4b_item_placement.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/blueprint_ce_coverage.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/blueprint_center.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_0_add_loops.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_1_room_profile.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_2_lakes.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_2_lakes_determinism.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_2_lakes_e2e.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_3_walls_doors.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_4a_0_layer_model.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_4a_terrain_catalog.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_4b_dungeon_feature.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_4c_promotion.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_5_fall_subsystem.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_6_autogenerators.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_7_lighting.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/c_8_connectivity.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/canvas_resize.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/captive_manacles.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/dialog_continuations.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/dialog_d4_blink.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/dialog_host.test.ts | foundation | 项目自身守卫保留 | foraging | foraging | — |
| src/test/dialog_service_input.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/dpad_hold_input.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_actor_actions_root_world.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/ext_actor_attack_validation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_actor_needs_runtime.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_actor_resources.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_births.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_bolt_causality.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_canvas_input.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_causality.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_checkpoint_imports.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_combat_adapter_foundation.test.ts | foundation | 项目自身守卫保留 | growth | growth | — |
| src/test/ext_combat_neutral_differential.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_combat_transition_facts.test.ts | foundation | 项目自身守卫保留 | combat,giants,growth,narrative | combat,giants,growth,narrative | — |
| src/test/ext_compatibility_diagnostics.test.ts | foundation | 项目自身守卫保留 | narrative | narrative | — |
| src/test/ext_controlled_action_bridge.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_departure_runtime.test.ts | foundation | 项目自身守卫保留 | combat,giants | combat,giants | — |
| src/test/ext_derived_draw_vectors.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_edible_combinations.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_edible_review.test.ts | foundation | 项目自身守卫保留 | combat,giants | combat,giants | — |
| src/test/ext_edible_runtime.test.ts | foundation | 项目自身守卫保留 | growth | growth | — |
| src/test/ext_engine_policies.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_fingerprint.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_fire_contact_runtime.test.ts | foundation | 项目自身守卫保留 | crafting | crafting | — |
| src/test/ext_foundation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_foundation_boundary_audit.test.ts | foundation | 项目自身守卫保留 | combat,crafting,foraging,giants,settlement | combat,crafting,foraging,giants,settlement | — |
| src/test/ext_foundation_contracts.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_foundation_native_visibility.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_foundation_origin_performance.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_foundation_origin_repair.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_foundation_retirement_atomicity.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/ext_foundation_world_repair.test.ts | foundation | 项目自身守卫保留 | combat,crafting,foraging,giants,growth,narrative,settlement | combat,crafting,foraging,giants,growth,narrative,settlement | — |
| src/test/ext_generation_actor_identity.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/ext_generation_checkpoint.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_generation_checkpoint_differential.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_generation_transactions.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_hardening.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_kind_knowledge_runtime.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_module_boundaries.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_module_composition.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_module_creation_ui.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_module_removal.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_module_ui.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_optional_queries.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_optional_rewards.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_part_break_protocol.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_placement_group_runtime.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_prepared_controlled_commands.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_recording_async.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_recording_v4_digest.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_recording_v4_snapshots.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_recording_v4_storage.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_region_runtime_transactions.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_resident_needs.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_rest_point_runtime.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/ext_rooms_topology.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_slaying_alignment.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_slumber_runtime.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_stats_native.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_stats_pipeline.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_stats_review.test.ts | foundation | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/test/ext_stats_runtime.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_combinations.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_geometry.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_integration.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_performance.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_properties.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_protection.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_review.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_source_guard.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_structure_transactions.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_test_dependencies.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_validation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world5_clock_levels.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world5_offline.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_display.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_harness_closed_loop.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_harness_combinations.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_interactables.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_items_roots.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_work_boundaries.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_work_failures.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_work_review.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/ext_world_work_sdk_contract.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ext_world_work_transactions.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/f_1_fire_as_terrain.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/f_2a_fire_mechanics.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/f_2b_creature_burning.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/f_2c_explosion.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/fe_1_touch.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/fix_rapier_travel.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/frame_profile.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/g_1_gas_volumetric.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/g_2_gas_df_wiring.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/g_3_gas_effects.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/gameplay_layout.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/generation_baseline.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/giants2_foundation.test.ts | foundation | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/test/glyph_inverse_contrast.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/horde_selection.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/horde_terrain_spawn.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/hunger_curve_sim.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/hunger_regen.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/i_1_interaction.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/immersive_mode.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/immersive_polish.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/invented_content_pool.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/lava_connectivity.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/main_menu_replay_seek.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/map_tile_modes.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/map_touch_input.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/monster_damage_balance.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/monster_path_cache.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/monster_stats_effect.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/native_bolt_delivery.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/p1_20_item_placement.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_24_death_sink.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_26_invariants.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_27_remove_drowning.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_28_flag_channel.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_29_adversarial_gate.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_29_lake_connectivity.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_30_i18n_gate.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_31_35_placement_snapshot.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_33_machine_chokepoint.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_34_loopmap_reset.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_37_machine_flag_i18n.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_42_secret_door_search.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p1_46_keybindings.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p2_0_seeded_rng.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p2_1_tick_architecture.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p2_2_real_speed.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p2_3_objective_time.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p2_4_animation_cadence.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p2_6_display_settings.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_10_waypoint.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_1b_monster_casting.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_2_monster_summoning.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_3_special_monster_flags.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_4_split_kamikaze.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_5_melee_specials.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_6_attack_geometry.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_7_player_weapon_geometry.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_8_scent_map.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/p4_9_safety_map.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/perf_2_auto_cadence.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/perf_2_npc_path_cache.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/perf_2_replay_cadence.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase3a0_actor_action.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase3a0_defense.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase3a0_native_prelude.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase3a0_scheduler.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase3b_action_lifecycle.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/phase3b_body_action_resolution.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a0_spatial.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a0_spatial_differential.test.ts | foundation | 项目自身守卫保留 | growth,narrative | growth,narrative | — |
| src/test/phase4a1_game_perf.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a1_game_square.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a1_pathing_perf.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a1_square_pathing.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a2_body_combat.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a2_body_effects.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a3_body_display.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a3_body_sfc.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a4_generation_contributions.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4a4_movement_regions.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4b_game_rigid.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4b_pose_pathing.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4b_rigid_rotation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4c_fixed_zone_health.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_body_lifecycle.test.ts | foundation | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/test/phase4d_body_status.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_composite_movement.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_declarations.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/phase4d_effects_rewards.test.ts | foundation | 项目自身守卫保留 | combat,growth | combat,growth | — |
| src/test/phase4d_group_sidebar.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_movement_environment.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_playable_recording.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_production_body.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/phase4d_terminal_identity.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4d_travel_ai.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/phase4e_body_transition.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/phase4e_recording.test.ts | foundation | 项目自身守卫保留 | combat | combat | — |
| src/test/phase4f_audit.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/presentation_timeline.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/r_1_appearance.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/replay_import_ui.test.ts | foundation | 项目自身守卫保留 | foraging | foraging | — |
| src/test/repo_hygiene.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/retained_map_drawing.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/retained_render_determinism.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/scroll_effects.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/search_progress_hud.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/sfc_harness.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/slaying_melee_autohit.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/smoke.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/t_1_tail.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/test_suite_membership.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/theme_shell_fixes.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/title_wordmark.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u20_inventory.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u21c_flare_sidebar.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u21c_terrain_appearance.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u24_hardcoded_text.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u25_machine_observation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_00_new_run.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_01_instance_snapshot.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_02a_rng_snapshot.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_02b_level_rng.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_03_whole_run_snapshot.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_03b_level_travel.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_04c_machine_cells.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_05_machine_items.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_05a_item_ownership.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_06_monster_damage.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_07_monster_blink.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_08_terrain_bolts.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_09_learning_consumers.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_10_absorption_snapshot.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_11_corpse_learning.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_12a_cast_eligibility.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_12b_ally_mode.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_13_combat_math.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_14a_status_gaps.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_14b_status_gaps.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_15a_shattering.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_15b2_ring_birth.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_15b_rings.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_15c_charms.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_15d2_armor_runic.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_15d3_runic_generation.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_15d_weapon_runic.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_15e_potions.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_15f_food.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_16_lifecycle.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_17a_df_transaction.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_17b_carriers.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_17c_triggers.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_17d_vents.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_17e_altars.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_17f_carriers.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_18_water_cage.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_18a_2_generation_terrain.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_18a_3_generation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_18a_terrain_contracts.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_19a_machine_view.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_19b_pending_occupancy.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_19c_immediate_entities.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_19d_machine_families.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_19e_machine_families.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_19f_autogen.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_19f_fire.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_19f_machines.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_23_memory_mapping.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_26a_deep_baseline.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_26a_deep_levels.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/u_26b_endgame.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_27_recording.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_r1_codec.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_r2_trace.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_r3_trace.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/u_r4_trace.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ui_1_rendering.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ui_2_protection.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ui_4_glyph_feedback.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ui_concepts.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1a_end_ui.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1b_input.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1c_display.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1c_hallucination_display_rng.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1d_export_boundary.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1d_recording_continuation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/ux_1e_pathfinding.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_1a_blueprint_items.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_1b_alternative.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_1c_machine_structure.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2a_vestibule_return.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_2a_placement_flags.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_2b_blueprints.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_3_wired.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_4_altars.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_5_dormant.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_6_keys.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_7_features.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_8_autogen.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_9a_carriers.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_9b_environment.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/v_2b_9c_effects.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/v_2b_9d_dungeon_profile.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/v_2b_9e_2_autogen.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/v_2b_9e_area_machine.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/vector_atlas.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_10_poison.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_11_teleport_placement.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_12_blink_beckoning.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_13_tunneling.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_14_obstruction.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_15_shielding.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_16_conjuration.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_17_domination.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_18_entrancement.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_19_polymorph.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_20_cloning.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_21_empowerment.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_23_negation.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_24_wand_catalog.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_25_staff_catalog.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/w_26_arcana_closure.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_2_arcana_submission.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_3_bolt_trajectory.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_4_bolt_reflection.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_5_arcana_instance.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_6_arcana_recharge.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_7_arcana_enchantment.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_8_staff_damage.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/w_9_directed_status.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2a_recording_checkpoint.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2b_terrain_derivation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2c_hit_status_owner.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2d_scroll_equipment.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2e_charms.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x2f_thrown_math.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x2g_native_effects.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x2h_test_mode_reachability.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2i_discovery_text.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2i_i18n_flow.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2j_monster_ai.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x2k_lifecycle.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x2l_reflected_death.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2m_lighting.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x2n_lumenstone_description.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x2o_horde_clump.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x3_u1_movement_safety.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u2_ally_captive.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u3_cursed_equipment.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u4_auto_travel.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u5_commands.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u5_ui.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u6_messages.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u7_sidebar.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u8a_forced_turns.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u8b_items.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3_u8c_combat_items.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x3a_live_iteration.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x3b_display_recording.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x3b_item_details.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x4_r1_world_catalog.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x4_r2_generation.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x4_r3_creature_items.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x4_r4_item_details.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x4_r5_content_text.test.ts | foundation | 混合：仅CE剥离，项目守卫保留 | self/base | — | — |
| src/test/x4_r6_integration.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x4a_movement_rendering.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
| src/test/x4b_flavor_text.test.ts | foundation | 项目自身守卫保留 | self/base | — | — |
