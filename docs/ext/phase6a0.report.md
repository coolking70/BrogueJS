# 6A0 报告：合同、接入点核实与编码探针

2026-10-11。授权范围：阶段6 §13 的6A0；基线 `59b9ba691daf66819eeea0299a0539f3641ad208`，分支 `ext/loot-6a0`，开工时与 `origin/ext/phase5` 相同且工作树干净。设计/数值/纯核心/β UI 输入固定为 `93523fc596b173396a0d526ab2073b327ff7cf3e`（origin/ext/phase6-loot-core）。没有读取、修改或运行 BrogueJS-p5；指挥进程的完整测试结果不作为本步证据。

## 1. 交付与结论

- [C6-1 候选合同](phase6a-contract.md)：moduleData/validator、全 Item 根与坏档拒绝、掉落事件/计划/提交、固定装配、命令与显示、5A2-S/5A1接口及版本计划；表内逐项标记现有实现与6A1差量，引用当前提交的文件:行。
- [只读体积探针](../../scripts/phase6a0-size-probe.mjs)：读取固定远端 git blobs 到私有临时目录，用真实loot纯生成器、真实C5固定装配、真实Game/Item快照与UTF-8编码做2000件测量。无生产文件变换、无测试清单登记、无依赖安装。
- [文档/声明检查探针](../../scripts/phase6a0-contract-check.mjs)：检查两文档、实际声明的TypeScript类型、行号存在性和本地链接；不启动项目类型构建或测试套件。

**6A0只完成合同与测量，不具备派发可玩6B1的条件。** 最大接线缺口是：全基底固定装配、通用遭遇终结服务、属性公式前输入/单位/能力发现；这些不是给Item加一个字段就能解决。5A1前置已落地为recording4，旧设计关于v3逐命令完整state的风险描述不再是现状。

## 2. 真实编码探针

### 2.1 方法、环境与复现

实际命令（仓库根运行；串行、无vitest worker）：

```sh
PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072 node scripts/phase6a0-size-probe.mjs /private/tmp/phase6a0-size.json
PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072 node scripts/phase6a0-contract-check.mjs
```

Node v24.19.0；Apple M5 / darwin-arm64 / 10逻辑核 / 32GiB内存；堆3072MiB。每项预热3次、测15次，P95取排序后的ceil(15×0.95)项，因此本次P95就是max。外部测试进程可能竞争CPU，**不是独占机器性能验收**。

1. 原生产harness建种子61002000的Game，生成4层真实地图。通过现有`assembleWorldItem`创建2000把固定匕首；26件背包，其余在四层各494/494/493/493件（3缓存层+1活跃层）。装备只保留ID引用。另有1件原生历史图引用，最终快照共2001个Item行；指定2000个ID逐一计数且无重复编码。
2. 从固定远端提取纯核心与数据，依赖当前树原生weapons/armors/arcana及json/fingerprint；无模块安装。调用真实`rollLoot`生成vault/dagger数据，每件通过真实`validateLootItemData`。mixed用standard/D26，five用standard/D26拒绝采样到5词缀稀有，six用bountiful/D40拒绝采样到6词缀稀有。全部可选模块缺席；唯一收据在各样本内维护，mixed仅1把唯一匕首。
3. 核心随机输入是固定种子61002000的探针LCG（闭区间），**不是引擎规则RNG验收**。生成在计时外，五/六词缀采用条件采样，不代表自然掉落比例。mixed 2000次调用、five 20757次、six 7725次；对应randomInt 26462/257945/161138次。
4. 原生`game.toSnapshot()`输出控制DTO。每组控制/候选的原生字段完全相同；候选仅在2000行添加`moduleData:{loot:真实生成数据}`。现有ITEM_FIELDS没有moduleData，因此这是**明确的候选DTO覆盖**，不是声称当前生产codec已支持该字段。JSON.stringify→TextEncoder是真实编码，JSON解码后逐行比较数据一致；不拿字符串长度估算UTF-8。
5. 计时分别测预投影DTO的编码、解码、候选深复制/覆盖+编码；另外单独测现有serializeItem×2000及Game.toSnapshot。覆盖时间包含structuredClone整个快照，**不能当作未来生产投影新增耗时**。不把几个中位数相加冒充端到端样本。
6. 物品摆放/所有权是探针构造（必要时同格多物品）；没有自然拾取2000件或通关证明。未测全品类/8固定行×4值的上界、容器/escrow、带loot manifest的load、录像/seek/续录、哈希、worker传输、IndexedDB或浏览器帧率。已知字段/熟悉度等未来接线也未被探针实现。

### 2.2 字节结果

紧凑JSON，UTF-8，未压缩。MiB=1,048,576B。

| 样本（各2000件） | 对照完整快照 B | 候选完整快照 B | moduleData净增 B / MiB | 每件平均净增 B | 仅loot实例值 B |
| --- | ---: | ---: | ---: | ---: | ---: |
| mixed-vault | 8,376,469 | 9,170,577 | 794,108 / 0.757 | 397.054 | 748,108 |
| rare-five | 8,376,417 | 9,490,849 | 1,114,432 / 1.063 | 557.216 | 1,068,432 |
| rare-six | 8,376,464 | 9,620,465 | 1,244,001 / 1.186 | 622.001 | 1,198,001 |

每件净增比实例值多23B，是`,`与`moduleData`/`loot`包装，不重复保存第二份物品。mixed构成：magic1=689、magic2=663、magic3=39、rare4=239、rare5=221、rare6=148、unique4=1；magic3来自合法腐化追加，不是预算漏洞。

**旧估算只能描述某些混合分布。** 五词缀真实实例值平均534.216B，含包装557.216B，超过设计“约420B”；2000件五词缀净增1.063MiB，不能继续报0.6–0.9MiB。本次最大完整快照约9.175MiB，单份小于当前64MiB seek缓存总预算；仅按恒定大小估算最多约6份同规模快照，尚未扣外壳/其它状态，不能承诺实际可保留数量。没有由此认定需要压缩或砍词缀。

### 2.3 时间结果（ms，中位数 / P95）

| 样本 | 对照编码 | 候选编码 | 候选解码 | 候选DTO深复制/覆盖+编码 |
| --- | ---: | ---: | ---: | ---: |
| mixed-vault | 23.283 / 24.730 | 26.198 / 28.677 | 14.157 / 23.483 | 61.243 / 64.132 |
| rare-five | 23.059 / 29.661 | 26.814 / 29.207 | 15.427 / 29.011 | 64.909 / 68.635 |
| rare-six | 23.413 / 25.143 | 27.170 / 27.761 | 16.018 / 25.250 | 66.792 / 72.550 |

现有Item序列化2000件：5.950 / 7.325ms；现有Game.toSnapshot（2000指定物品+4层）：22.503 / 24.105ms。候选编码中位数比配对对照高约2.915/3.755/3.756ms（统计量差值，不是逐次差分P95）。这是完整快照编码成本，不是“单击杀8件≤1ms”的测试，也不代表worker消除了主线程JSON编码。

### 2.4 身份与原始证据

原始小型结果在 `/private/tmp/phase6a0-size.json`，不提交大快照；私有提取目录在finally删除。生产源码与package输入哈希前后同为 `16843d93c078648c787e44e413ad9e61ddbcedf0fe5e30a5ed511aed9d67ab11`（git ls-files src/package两文件顺序，逐文件SHA256组成JSON数组后再SHA256）。两条引擎RNG在生成样本与全部编码测量期间保持不变。

| 身份 | 值 |
| --- | --- |
| 纯包版本/指纹 | 0.1.1 / `sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2` |
| 全可选能力缺席有效目录 | `sha256:ed86796fad38b1b7995aa94fb1ee4641a8d366e5c8f41c84295d206e9a1aa45c` |
| mixed候选快照SHA256 | `e1c41f33f4c767827aa948f5a6153eb59d1ae9bf8de68e6f3fcb8e40a504e07a` |
| five候选快照SHA256 | `957729faaef8325d81464f0ea0ebf3233dfec2579bc742f57748639056996e67` |
| six候选快照SHA256 | `dc9a56e4da4d61fe543d696d1429243b7dcbc747d9964f7e159fc9ed08dfe5b2` |

首次探针退出1：临时提取闭包漏了schema依赖的原生数据JSON，未开始测量。补齐当前原生数据及远端locale后重跑退出0；没有改生产代码/数据、测试断言、超时或门限。保留此失败说明，不把第一次也写成通过。

## 3. 6A1 建议拆分与验收

各子步由本地单主笔实施；没有在6A0启动子代理或下一步代码。相关功能验证按定向文件、`--maxWorkers=1`串行；完整阶段6门禁另请维护者批准排期，下面是**未来必验清单，不是本次通过记录**。

| 子步 / 停点 | 生产范围 | 验收重点 |
| --- | --- | --- |
| 6A1a Item/codec/校验 | Item、EntitySnapshot、WholeRunSnapshot、runtime注册、全根枚举、Inventory各合并快路 | 中性fixture一件数据物品；缺席省略、深拷贝、重复ID、非法原型/键/预算/版本/owner；活跃/缓存/背包/携带/载客/坠落/purgatory/容器/escrow/历史引用逐根坏档，失败保活局/双流/ID；equipment引用不重复计数 |
| 6A1b 装配/事件/事务 | 共用固定装配、floor/vault/kill/encounter宿主服务、giants通用适配 | 12武/6甲/8戒无RNG装配；floor投掷分流、转换false原生回退、vault所有qualifiers；近战/毒/法术/陷阱/盟友击杀，行政/克隆/召唤/无奖励/盟友死者排除，携带物先落；分裂最后主体/核心一次，重访load/seek不重发；满根/无落点保已抽骰；异常逐注入点全回滚；伪造/陈旧/复用plan拒绝 |
| 6A1s 属性接口补齐 | stats装备DTO、公式前基底/戒指点、能力发现、hypothetical；需另列growth/giants适配文件 | 本地加值在附魔前、力量惩罚、quarter enchant、再生/潜行/感知/光照单位，sourceId唯一，预算/槽/钳制归属；未知生效与已知比较隔离，双戒独立；物化降钳升不补、出生初始化；debug全量重算与缓存一致；growth能力缺席fallback，禁止伪报adept可用 |
| 6A1c 命令/只读装饰 | C6命令计划权限、名称/外观插槽、fixture命令与locale | executeCommand真实接受/拒绝/确认与时间；普通回调不能改Item；显示不写/RNG，幻觉与记忆不泄露；鉴定不增机械revision但进摘要；loot未安装不改变原命令/生成/显示行为 |
| 6A1d 格式统一/冻结 | 集成人统一版本、state合同、黄金归因、fixtures、SDK报告 | fixture生成→装备/迁移→命令→save/load→逐条replay零OOS→seek→续录；worker与同步回退；损坏档保活局/缺包拒绝；单变量归因并按原方法重录；真实codec再测2000件；最终导出/类型fixture/哈希/基线commit齐全后冻结C6 |

6A1s是已发现的6B阻断接线，不重做已完成5A2-S。可以与6A1a/b分批合入，但不能留给dot在模块目录里绕过。最低相关旧测试入口：`src/test/u_01_instance_snapshot.test.ts`、`src/test/ext_generation_checkpoint_differential.test.ts`及当前发现器列出的5A1/5A2/stats功能文件；实施者按真实影响补最少文件，不凭旧名字整批扫。原正常7模块=128启用子集；加loot后是**8模块=256子集**，旧设计写7模块128已过时；完整删除矩阵也应动态发现，不自动扩跑256布局。

6A1d通过才允许对外宣称C6底座可用；6B1自然闭环还需模块接线并验证掉落→装备→生效→鉴定→分解→存读/重放。6B2真实UI、6B3强化/符文、6C套装/插槽/工位均未授权自动开始。

## 4. 给6B1 dot包的冻结清单

目前只有**设计输入与现有基线冻结**；下表“待填”是明确阻断，不得把6A0提交当作6A1完成提交派发。dot建议基于现有α/β包做集成适配，不重写生成器或擅自回退v1.1数值。

| 派发项 | 本次可交付 / 仍需6A1填写 |
| --- | --- |
| 基线 | 当前59b9ba6仅审计基线；**待填6A1验收合入commit** |
| 输入包 | 固定93523fc；core/UI临时合同、v1.1数值与M1–M4批准保持 |
| 导出 | 候选src/ext/itemSdk.ts、types扩展、stats适配与fixture；**待填真实路径、签名、类型见证与SHA256** |
| 当前SDK对照 | worldSdk SHA `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`；edibleSdk `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b`；stats `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84`。这是现有输入散列，**不是新C6 SDK hash** |
| 版本 | 当前13/6/4/2，world5 schema4；**待填新批次与loot module/rules/state版本**；旧档拒绝，纯包0.1.1不能沿用成新行为身份 |
| 数据形状 | LootItemDataV1保留v1/corrupted/原数组顺序；moduleData.loot唯一真相；出生原生映射、知识语义、非堆叠；六词缀/八固定行上限不变 |
| 生成协议 | pure roll顺序/闭区间随机/64次每件与512次每事件/单候选不抽/错误码；宿主资格、floor分流、vault映射、部分接受与唯一收据回执须随fixture冻结 |
| stats | 真实可用键表、单位、公式前基底入口、slot/sourceId/caps、已知投影、软查询响应；不把`LootModifierDraft`直接强转StatModifierRow |
| 命令 | envelope+严格v1载荷、revision/CAS、确认、tick；分解唯一政策与碎片鉴定tick先裁定；preset配置与初始create对应 |
| 可选能力 | growth/combat/giants可用性规范化与有效目录指纹；缺席fallback、没有空壳依赖；part/craft/site暂不开放 |
| UI | β DTO复用；真实stats比较替换临时公式；floor/幻觉/未知戒指不泄露；容器位置新增需显式扩约，通用UI和主题本地负责 |
| 可写范围 | `src/ext/modules/loot/**`与loot自有文档；自有test-suites/locale/descriptor。禁止Game/共用codec/types/stats/其它模块/package；共享需求汇成清单由本地改SDK |
| 门禁 | **待维护者填写阶段6档位**；模块定向/预算负例/抽取向量/真实Game闭环，最终组合/真实删除及浏览器按排期做；未运行项不称通过 |

## 5. 待维护者决定

> **维护者裁定（2026-10-11）：C6-D1/D2/D3/D5/D6 按本表建议；C6-D4 以已批准数值表 v1.1 为准——唯一品可分解（分解前警告），批量每件 100 tick，10 片鉴定一次 100 tick，失败整单 0 成本。**

已批准L-D01–13、N-01–13、M1–M4及v1.1不在待定表中，M4后续真实力量/怪物倍率验证保持原排期。

| 编号 | 新问题 | 本合同建议 |
| --- | --- | --- |
| C6-D1 | 接受6A1a/b/s/c/d拆分及stats冻结文件的明确解冻范围吗 | 接受；公式前装备输入与能力发现由本地做，真实导出后重新冻结；growth.attribute能力未补时明确adept fallback，不伪造完整联动 |
| C6-D2 | 通用遭遇登记/ordinal与loot紧凑收据是否采用候选方案 | 采用底座验证生命周期+单调ordinal/watermark+唯一目录序号；6A1b冻结具体字段/容量；避免无限历史key列表突破4KiB目标 |
| C6-D3 | 新moduleData通用字节/深度预算 | 建议4 owner、每owner4KiB、每件总8KiB、深16；这些是防畸形载荷上限，不是本次2000件实测平均，也不是旧设计已批准值 |
| C6-D4 | 分解唯一、批量分解时间、碎片鉴定时间 | 原设计禁止唯一但数值/UI允许产量20，需统一。建议首版继续禁止唯一；批量按每件100 tick，10片鉴定一次100 tick，失败整单0成本 |
| C6-D5 | floor/vault转换边界 | 建议投掷先分流、可转换近战不重复抽旧基底；无法表达的机器qualifier整次原生回退。需要维护者确认首版覆盖与后续专门扩展，不暗自删除机器约束 |
| C6-D6 | 阶段6门禁与版本批次 | 开发期相关定向串行、收尾统一完整/组合/删除；6A1集成人按实际结构统一分配新foundation/whole-run，recording4/origin2结构不变时保留；不预占版本号 |

以上不妨碍交付6A0，尚未获准的API与策略在合同中保持候选身份。无需重新批准已定数值；不要把旧设计页末历史“数值未批准”当作本轮阻塞。

## 6. 本轮验证与范围

体积探针最终exit0，2000×3件实例校验/编码后数据比较通过，RNG与生产输入散列保持。文档检查/独立声明类型检查exit0（2文档、49个完整文件:行锚点、0类型错误），两脚本`node --check`通过；四个未跟踪产物另逐文件用`git diff --no-index --check /dev/null <文件>`检查whitespace，并检查CRLF/冲突标记与明确路径范围。只检查文档中的锚点存在和手工核实其语义，没有宣称自动证明整段设计。

没有运行npm test、test:ext、test:full、test:gen、drift、build、项目vue-tsc、组合/删除矩阵或浏览器；本步没有生产/规则/格式/基线修改，且用户要求避免与指挥测试竞争。未改测试/守卫/清单，不需要旧测试前提反事实或黄金重录。仅提交两份文档、两份只读探针；不提交原始快照/截图、提取源码、node_modules或其它工作树文件。提交/推送在本步检查结果确认后单独执行，远端结果以最终回复为准。

## 7. 提交/推送阻塞

检查通过后尝试仅暂存上述四文件，`git add -- <四个明确路径>`退出128：`Unable to create '/Users/coolking70/Documents/同步空间/BrogueJS/.git/worktrees/BrogueJS-6a0/index.lock': Operation not permitted`。该共享Git管理目录在当前沙箱可写范围外，环境禁止权限升级；没有修改其权限、复制Git元数据或借其它方式写远端。

**未暂存、未提交、未推送，四产物仍在当前工作树。** 未执行`git push -u origin HEAD`，因为HEAD仍是无本次产物的基线，不能把推送旧HEAD当成交付。后续在有Git元数据写权限的环境仅提交这四文件，提交信息末尾须加`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`，然后单独执行用户指定push；本步没有虚构commit或远端成功。
