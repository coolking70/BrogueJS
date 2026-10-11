# narrative2 dot 任务包：第二批中立驻点 NPC（整包一次派发）

> 2026-10-11。代码基线 `59b9ba691daf66819eeea0299a0539f3641ad208`（起草时 `ext/phase5` 最新提交）；派发分支 `ext/narrative2-base` 仅追加本文件。交付 **5 名原创 NPC、45 个新节点、10 个互斥结局日志、5 个一次性可选奖励、5 份招募预留记录、5 张新像素立绘**；另择取已存在的 6B1-α 三张像素资产，使八人共用同一套调色板。复用冻结接口，不实施 5D3。
>
> §12 是预先给定、待维护者签认的决定，并非已逐条获批。维护者转贴 §0 即按此执行；dot 不再逐项询问。格式参照 giants2 与 6B1-α；历史任务书不携带其旧基线、版本或门禁豁免。本包写入白名单始终有效。

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型的 narrative2 执行者。按 docs/ext/narrative2.dot-package.md 一次长块独立完成第二批五名原创中立驻点 NPC、像素立绘、分支对话、剧情记录、可选奖励、招募预留数据、测试与报告。期间不要向维护者提问，未定细节按 §12 裁决并记录。

git fetch origin
git switch -c ext/narrative2 origin/ext/narrative2-base
开工确认工作树干净，git diff --name-only 59b9ba691daf66819eeea0299a0539f3641ad208 HEAD 只列 docs/ext/narrative2.dot-package.md，记录实际派发 tip。已有工作分支先核对祖先和未提交改动，不重置或覆盖。

先读 AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、docs/ext/README.md，再完整读本包、phase2-narrative.md、narrative-config.md 和 narrative 源码。§A 是派发前实测，不替代你的最终验收。

硬规则：
1. 只写 src/ext/modules/narrative/**、docs/ext/narrative-config.md、docs/ext/narrative2.report.md；本任务包、共享文件、其他模块及版本协议不可改。
2. 按 §3 内嵌内容和确定装配算法追加五人，保留首批机械内容；复用对话、剧情记录、立绘槽及 growth.story-reward.v1。默认奖励如实 skip，不伪称到账；不新增金币/物品/XP provider。
3. 仅 narrative module/rules 1.4.0→1.5.0、displayVersion→1.3.0；pack schema1/state4/input2 及全部共享协议不变。招募元数据仅在 narrative 自有静态表中，不实现招募/居民/岗位/跟随。
4. §5 固定来源择取三张旧像素成品与32色调色板/脚本/资产测试；只择取列明文件，不合并 loot 分支。五张新图沿同流程生成、键控、量化到固定共享调色板，逐张过资产和视觉闸门。
5. 自有单元、真实 Game、五名新 NPC 自然 trace、存读/回放/非单调 seek/续录及九行组合都按 §7–9完成；只删 narrative 执行精确 --plan，实际删除及全量集成留维护者。本包不把已结束的5Z当作未来自动兜底。
6. Node24.19.0 放 PATH 前，NODE_OPTIONS=--max-old-space-size=3072，Vitest --maxWorkers=2。开发期与收尾门禁分开；失败保留首次退出码，守卫不可削弱。
7. 只能越白名单才能解决的子项保留最小复现，继续其余工作并报部分完成；图像或浏览器不可用如实标 blocked。最多两轮审查→修复，不自动发起第三轮。

按 §10交付；先确认门禁结果，再显式提交白名单并只 git push -u origin ext/narrative2。不得推 base/phase5/foundation/main，不 merge/rebase/tag。每次提交信息末尾加 Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>。推送失败只报告，不用其他方式写远端。最终回 §10.3 的≤30行中文回执。
```

## A 派发前核对与实测（维护者执行；dot 作背景阅读）

### A.1 基线与方法

- 起草工作树：`ext/narrative2-base`，HEAD/本地 `origin/ext/phase5` 同为 `59b9ba691daf66819eeea0299a0539f3641ad208`；起始干净。仅提交本文件，不替 dot 实施生产代码。
- Node：`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，实测 `v24.19.0`；全部 Node 命令前置该目录，3 GiB 堆，至多2 workers。
- 副本 `/private/tmp/narrative2-dispatch/tree` 来自此 HEAD 的 `git archive`；依赖逐包链接，Vite 缓存独立。仅副本装配数据、同步 narrative 三处精确版本字面量、登记临时 probe；仓库源码不改。
- Git发布环境：原树`git add`因公共Git目录位于兄弟工作树而被沙箱拒绝创建`index.lock`。已在`/private/tmp/narrative2-dispatch/publish`从同一本地基线建立独立Git副本、同名`ext/narrative2-base`，只把本文作为提交载荷；不修改/替换原Git元数据。只以原origin URL执行指定CLI push，结果见本次最终回执，不用其他方式写远端。
- 终轮校验从本文件的 `narrative2-content` / `narrative2-compiler` 标记块直接提取，执行同一装配函数，断言与实测副本数据逐字段一致；不会用另手写的简化样例冒充内嵌数据。

### A.2 真实接口核对

| 项目 | 已核对的实际合同 |
| --- | --- |
| 当前内容 | 3 NPC / 14节点 / 5日志 / 4 flags；module/rules1.4.0、pack1、state4、input2；display1.1.0，三张288×384真PNG，尚无像素脚本/调色板。 |
| schema / 安装 | `loadNarrativePack(raw, portraits, locale)` 严格未知键、全局ID、引用、图可达/出口、循环和预算检查；返回深冻结且有 provenance 的包。`createNarrativeModuleFromPack` 要求该正式加载结果；不能强转手造包。 |
| 放置 | `enterNarrativeLevel` 首访提交；底座 `placeInteractables` 筛安全可见FLOOR，入口距离/y/x稳定排序；无概率或新RNG；defer只到范围内更深首访层；重访/load不重生。对象不是Creature、无HP/AI/职业。 |
| 输入/显示 | `buildNarrativeUiCommand` → `executeCommand('ext:command', …)`；open/choose/close v2，free-frozen，复用DialogService和模块Vue槽，日志/立绘切页只显示。 |
| 奖励限制 | 六种Effect无金币/物品/任意XP数额。唯一外部奖励是 growth.story-reward.v1 的rewardId；默认growth story=false，现有报价仅bell.settled/wick.settled各5XP。五个新ID未报价，不能改growth补上。 |
| 招募限制 | NpcDefinition不接受recruitable等字段；塞进definitions会报UNKNOWN_KEY。本包独立 `data/recruitment.json`，无运行时读取、不进当前state/manifest、不发布居民SDK。 |
| 美术来源 | 固定 `93523fc596b173396a0d526ab2073b327ff7cf3e` 的6B1-α已经有三张48×64成品、32色palette、Pillow/numpy脚本和PNG测试；报告曾按D-22从24升32，浏览器仍blocked。只继承资产，不继承其验收结论。 |
| 自有旧测试 | `narrative_content.test.ts`严格比较全部flags；追加五个未决flag需精确更新期望前提，保留全对象比较。原D1三人列表不变，新人从D2开始。先单变量反事实，不改共享测试。 |
| 共享身份 | foundation13 / whole-run6 / recording4 / origin2 / world5 schema4，worldSdk/edibleSdk及其余冻结SDK均保持。当前安装7模块，没有loot。 |

### A.3 本轮实测结果

<!-- narrative2-dispatch-results -->
已完成内嵌数据/新局窄预检（2026-10-11）。原树源码未改；下列全部是本次实测，不继承旧报告通过数。

| 命令 / 项目 | 实际结果 |
| --- | --- |
| 从本文标记块提取并执行§3.3 | `node /private/tmp/narrative2-dispatch/audit-document.mjs` exit0；四份输出与副本definitions/portraits/locale/recruitment深等，旧七类机械数组前缀与config预算保持。内容JSON块SHA-256=`9f8b4920d3d475b721ef22781005103dcdb17ccdc731946e30fb250f13fe1e5d`。 |
| 真实schema/模块工厂 | `loadNarrativePack` / `loadNarrativeDefinitionPack` / `createNarrativeModuleFromPack`接受完整追加包；只在副本同步definitions.ts/types.ts/schema.ts精确1.4.0→1.5.0字面量，没有放宽字段/图/预算校验；把recruitable硬塞NpcDefinition的负例被拒。 |
| 最终机械目录与身份 | 8 NPC、8对话/59节点、15日志、9 flags、8storyEvents、9triggers；schema1/version1.5.0，fingerprint=`sha256:c22c646d3b86ee57ab3d36069992e317bf355f8d105bacc92114a67176f04beb`；descriptor身份=工厂身份。 |
| 副本 `npx vitest run src/ext/modules/narrative/tests/narrative2_dispatch_probe.test.ts --maxWorkers=2`（probe-natural.log） | exit0，1文件3项通过，0失败/skip/todo，39.96s（测试37.05s）。正式schema；真实D1两组合；有界选种子自然五人A结局/回顾。没有深层持久化断言的最终自然探针不替代下方诊断。 |
| 真实D1新局 | seed1/wizard，narrative-only与七模块全开均实际startNewGame；各2条wait，事件数2/3（全开含初始命令）；toSaveSnapshot/load、完整逐条replay、seek0→末的完整规范机械末态相同，0 OOS。 |
| 自然五人（同一条成功路线） | narrative-only、seed4/wizard：缝绳人D2/98事件；听水员D4/299；拾骨书记D4/309；盐灯看守D6/453；递信人D8/633。每名placed且附近资格成立，公开open/ask/detail/back/decision/A/close/reopen/recall/close，日志存在、奖励各一次skipped/absent，无注入/传送/改HP/RNG。事件数为该人回顾关闭后的累计值。 |
| 有界搜索失败（自然探针） | seed1前四人可交谈，D7坐标13,13连续停滞64次后终止（574事件，HP999、nutrition1616）；seed2到D6存在目标但nearby资格断言不成立（353事件）；seed3到D3同类资格不足（62事件）；seed4成功。该简化探针未补“走近目标”，不将2/3记为产品放置缺陷；dot正式路线必须补公开接近步骤。 |
| 固定6B1-α源资产只读审计 | 三张PNG IHDR均48×64、8bit、索引色3、无隔行，1195/1175/1280 B合计3650 B；palette32色。六文件SHA见§5.1。未在本轮重做完整源图量化/数值/视觉门禁。 |
| 原树 `node scripts/check-module-boundaries.mjs` | exit0，Module boundaries and test ownership verified。 |
| 原树§8.4精确removal `--plan` | exit0，安装7模块、恰1行、只删narrative/其余6保留，展开smoke带`--combinations endpoints`；normal full=required/not-run。未实际删除或跑两个端点。 |
| 文档静态审计 | 两个JSON块可解析、§0/§A/§1–12齐全、回执20行、LF、路径/六个固定来源存在；`git diff --check`通过。 |

首次与探索结果保留，不与最终数累加：

- 最初准备在无.git的archive副本误调用git show，导致三份临时JSON空文件/prepare解析失败（exit1），随后从原树只读复制恢复；当次没有成功运行功能测试，仓库无改动。
- 第一轮probe（probe.log）exit1：3项中2过1失败，235.72s；seed1四新人对话成功后在D7用尽3000步未达D8。只改临时路线helper，加入正式吃食物/停滞检测/有界换seed；内容/生产规则没有为探针调数。
- 第二轮探索probe（probe-final.log）表面exit0、3项通过、126.65s，但它把深层cycle断言异常也捕获进换seed日志：seed1 D6完整世界比较失败、seed2 D6/seed3 D3附近资格不足，后换seed才完成。这不是合格的“全seed持久化通过”证据，不能用其总绿结论覆盖失败；已把最终自然探针与持久化诊断分开。正式验收不得把load/replay/seek断言失败当成可换seed的路线失败。

独立深层诊断（不吞断言、不换seed消错）：

`npx vitest run src/ext/modules/narrative/tests/narrative2_persistence_dispatch_probe.test.ts --maxWorkers=2`，**exit1，2项中1过1失败，91.08s**（测试88.67s），0skip/todo。seed4在上述五个累计事件切点98/299/309/453/633，均实际save/load→完整逐条replay→seek0/末→再load恢复继续，规范完整机械世界精确一致，0 OOS；同局覆盖五人已证明。seed1在69/168/178事件的前三个切点同样通过，盐灯D6切点的完整replay末态比较失败。

**N2-A01（未归因，不得默认忽略）**：seed1，narrative-only/wizard，公开路线依次D2缝绳人、D4听水员、同D4书记、D6盐灯；每人按§8.1固定A+回顾10条命令，之后执行上面的cycle并从真save继续。D6的save/load比较已过、逐条replay未报OOS，完整末态首批差异为 `levels[3].grid[21/22/23/51/52/81/197/223].isVisible`：原捕获true、replay后false（诊断只列最先8处，不声称仅8处）；断言即失败，未把这些字段从比较中删去。是否为基线缓存可见性语义、probe比较口径或新增内容问题，尚未做单变量归因，不能称“已确认底座bug”或“纯显示可忽略”。dot须在自有测试复现/归因；只可能改共享代码才能解决时保留失败交维护者，本包白名单不变。seed4通过不能关闭N2-A01。

本机无CE缓存，Vitest启动提示CE依赖会跳过；上述probe本身没有CE用例，实际skip=0，没有下载CE。临时源/日志/结果均在 `/private/tmp/narrative2-dispatch/`，不提交；远端据§3精确数据与§7–9入口自行重验。§A没有实现recruitment校验器或生成新立绘，也没有跑dot最终门禁。

<!-- /narrative2-dispatch-results -->

### A.4 实测界限

§A仅证明内嵌数据可经正式加载、真实新局及已列出的命令生命周期运行，不是五人完整实施验收。尚未生成五张新图、没有浏览器/触屏验收；§A新图只登记路径，加载器容许缺资产，不将fallback当作立绘交付。第二结局、全部旁支/负例、九组合、N2-A01归因及最终门禁仍交dot。没有执行完整npm/test:ext、128组合或实际删除，不能引用旧5Z通过数冒充本次验证。

## 1 目标、范围与非目标

五名人物分别处理“旧绳与归路、记录与保证、无名遗骨、值守与传授、未送达的信”。人物原创、语言克制，保持地下湿冷、物件磨损、失踪者与生者互相欠账的气氛；不借用其他作品人物/台词/美术，不让NPC代讲世界百科。

- 每人一个固定可穿行驻点、一张新48×64像素立绘、九节点对话、两个互斥结局和相应日志、一个每局最多一次的可选奖励。
- 每人主线两个结局均可独立完成；旧人/前序新人只解锁非必要线索旁支，不形成遇不到前人就卡死的任务链。
- 保留首批全部机械字段与数组前缀顺序，不调旧数值、不清旧触发器；三张首批立绘按§5择取像素版，旧ID/asset/altKey保持。
- 不添加新效果、世界事实、条件op、命令、时钟、随机源、HUD、对话容器或玩家字段。不做招募、好感数值、岗位、商店、交易、任务物品、地图揭示、点灯、修路、NPC移动/死亡。
- 对白中的绳、碗、笔、灯、信只是叙事道具；选择不会改背包/地形/照明。“愿意离开”只成为未来候选条件，本轮对象仍驻点。

## 2 基线、分支、版本与兼容

| 项目 | 定值 |
| --- | --- |
| 派发base / 实施分支 | `ext/narrative2-base` / `ext/narrative2` |
| 写入白名单 | `src/ext/modules/narrative/**`、`docs/ext/narrative-config.md`、新`docs/ext/narrative2.report.md` |
| narrative身份 | `NARRATIVE_VERSION`、definitions.moduleVersion/rulesVersion、types.ts字面量、schema.ts精确校验统一 **1.5.0**；descriptor继续读常量 |
| 保持 | pack.schema1 / stateVersion4 / inputVersion2 / display schema1；所有底座和其他模块的版本、SDK字节不变 |
| 显示 | portraits.displayVersion **1.3.0**（区分6B1-α的1.2.0） |
| 预留静态表 | recruitment.schema1、targetPhase='5D3'，只归本模块的内容作者数据，不是新增公共协议 |

沿 `phase2-narrative.md` §8 / 手册§2.1：新增NPC/节点/规则数据本次明确升自有module/rules版本，形状/语义未变所以state/input不升。完整definitions的现有canonical fingerprint自然更新；descriptor与实例identity必须完全相等。旧1.4.0或旧fingerprint存档/录像直接拒绝，不迁移、不兼容别名、不改whole-run/recording/origin。像素、locale与静态招募表本轮不进机械指纹；未来5D3若消费招募表，必须另定其规则身份与版本，不能将本表当成已冻结SDK。

开工记录真实tip、状态、基线差异。无法核定本包基线时停止依赖该基线的工作并报阻断，不合入新的phase5/loot去“顺手解决”。仅按§5逐文件读取固定资产来源；不cherry-pick其整提交。

## 3 内嵌内容与确定装配

### 3.1 权威驻点和结局表

| NPC / ID | 深度闭区间 | A / B结局 | 5D3候选 |
| --- | --- | --- | --- |
| 缝绳人 / cord.mender | D2–3 | splice接绳 / sever剪结 | true，splice |
| 听水员 / cistern.listener | D3–4 | mark留疑记 / erase擦线 | true，mark |
| 拾骨书记 / bone.clerk | D4–6 | blank留名栏 / number编号 | true，blank |
| 盐灯看守 / salt.warden | D6–8 | share传授 / keep留守 | false，永不在本表承诺招募 |
| 末班递信人 / letter.carrier | D8–10 | return面对寄信人 / wait继续等 | true，return |

全部presence=stationary-interactable、interactionDistance1；每个placement `maxPerRun=1,maxPerDepth=1,minStairDistance=1,maxEntranceDistance=8,onNoSpace='defer'`。所谓驻点即现有入口附近合法FLOOR，不要求水池/骨堆/灯具/特殊房型；无位延后，超范围终止，不承诺每seed必出。上限和原包预算完全不动。

### 3.2 内容原表（完整五行；不是运行时第二套解释器）

下表JSON是本包的转录源。`text`九键与装配器一一对应；`art`仅生成提示词素材，`suggestedXp`仅报价建议，不进入执行包。玩家可见字符串全部由装配器落入扁平locale。固定名称、ID、深度、分支语义、日志和收据；允许dot纠正明显错别字/人称并在报告列差异，不任意增删剧情或调奖励。

<!-- narrative2-content -->
```json
[
  {
    "id": "cord.mender",
    "name": "缝绳人",
    "glyph": "绳",
    "color": "#b08b5c",
    "depth": [
      2,
      3
    ],
    "asset": "cord-mender.png",
    "clueFlag": "archive.read",
    "clueValue": true,
    "recruitable": true,
    "eligibleVerdicts": [
      "splice"
    ],
    "outcomes": [
      "splice",
      "sever"
    ],
    "rewardId": "cord.settled",
    "suggestedXp": 5,
    "description": "缺了左耳的旅人把旧绳摊在膝上。绳结之间夹着几片磨得发亮的木片，上面没有字。",
    "ask": "问他为何留下这些断绳",
    "detailChoice": "辨认绳结中的木片",
    "clueChoice": "提起守卫保管的残页",
    "clueLocked": "尚未读过档案守卫的残页",
    "aChoice": "把还能承重的两段接起来",
    "bChoice": "剪开旧结，让绳子各归各处",
    "text": {
      "hello": "先别踩那一圈。看着像断了，里头还有两股没散。我每接一根，就有人说它能把人带回去；可绳子只认重量，不认归路。",
      "account": "最后一队人把绳尾交给我，说听见三下拉扯就收。我等到绳子绷直，又等到它松下来。收回来的木片多了一块，我却记不清出发时有几个人。",
      "detail": "木片没有名字，只有一道道横刻。细的是包裹，深的是人。我曾把刻痕磨浅，想让手里轻一点。后来发现，少算一个人，绳子也不会因此少湿一寸。",
      "clue": "残页上也缺了一行？那就留着缺口。别拿猜出来的名字填满它。往后有人回来，至少还有地方认领。",
      "decision": "这两段都还结实，只是接头难看。接起来，就得把旧结也带着；剪开，我能给后来的人一根看上去干净的绳。你说哪样更诚实？",
      "a": "他把短绳穿过旧结，拉了两次。接头鼓在掌心，像一道结硬的伤口。『难看些好，』他说，『下一个人会知道，经过这里要慢一点。』",
      "b": "剪刀没发出声音。旧结落在他膝上，他没有扔掉。『绳能换，欠下的不能算在新绳上。』他把木片另穿成一串，放进衣领。",
      "recall-a": "接头还在。他每次放出绳子，都把那个大结转向后来者，让人先摸到再往前走。",
      "recall-b": "他如今把旧木片和新绳分开放。你看见他数过木片，又重新数了一遍。"
    },
    "journalTitles": [
      "留在接头里的旧结",
      "另收的木片"
    ],
    "journalBodies": [
      "缝绳人接起两段旧绳，特意留下粗大的旧结。我们没有替失踪的人补上名字，只给后来者留下一个能摸到的提醒。",
      "缝绳人剪开旧结，把刻有旧人数的木片另行收好。新绳不替旧账作证，他也没有把那些木片扔掉。"
    ],
    "art": "a weathered adult missing the left outer ear, ochre patched coat, holding a thick spliced rope and blank wooden tally pieces at chest height, no readable marks"
  },
  {
    "id": "cistern.listener",
    "name": "听水员",
    "glyph": "滴",
    "color": "#657484",
    "depth": [
      3,
      4
    ],
    "asset": "cistern-listener.png",
    "clueFlag": "cord.mender.verdict",
    "clueValue": "splice",
    "recruitable": true,
    "eligibleVerdicts": [
      "mark"
    ],
    "outcomes": [
      "mark",
      "erase"
    ],
    "rewardId": "cistern.settled",
    "suggestedXp": 5,
    "description": "年轻女人抱着一只空陶碗，灰蓝袖口结着白盐。她听完一阵滴水，才抬起头来。",
    "ask": "问她在水声里数什么",
    "detailChoice": "看看碗内的两圈盐痕",
    "clueChoice": "说起缝绳人留下的大结",
    "clueLocked": "尚未见证缝绳人接起旧绳",
    "aChoice": "留下水位线，旁边留一道疑记",
    "bChoice": "擦去刻线，只记今天的水声",
    "text": {
      "hello": "等这一滴落下再说。上头有三个地方漏水，回声却总慢半拍。人把回声也算进去，就会以为这里还有第四口井。",
      "account": "以前我替过路人看水位。水退了，我在墙上刻一道线，告诉他们能走。后来有一夜，线还露着，通道里却先传来敲碗声。那条线救过人，也误过人。",
      "detail": "碗里浅圈是昨夜的，深圈是多年前留下的。我洗不掉它，倒不是盐太硬，是怕洗完以后，自己也相信这里只涨过一次水。",
      "clue": "让人先摸到那个结，确实比说一句『放心走』强。刻痕也是这样，最好告诉人它曾经错过。",
      "decision": "我还能看住这一小段墙，不能替整条通道作保。旧线留着，别人可能当它是保证；擦掉，后来的人连从前涨到哪里都不知道。",
      "a": "她在旧线旁刻了一道短斜痕。『这道是我不知道的部分。』她又把碗摆回石缝下，等下一滴水把寂静敲开。",
      "b": "她用湿袖子擦去软石上的浅痕。『今天的声响，只管今天。』碗底那圈旧盐还在，她没有再碰。",
      "recall-a": "旧线旁的斜痕已经落了灰。她先指给你看那一小道，再说今天听见了什么。",
      "recall-b": "墙上空了。她不再拿旧刻线回答来人，只让他们停一会儿，亲自听完一轮滴水。"
    },
    "journalTitles": [
      "水位旁的疑记",
      "只管今天的水声"
    ],
    "journalBodies": [
      "听水员保留旧水位线，加上一道表示不确定的短痕。她知道旧记录有用，也知道记录不能替整条通道作保。",
      "听水员擦去墙上的浅线，改为请每位旅人亲自听水。空碗里的旧盐圈仍留着，提醒她这里曾有过另一次上涨。"
    ],
    "art": "a young adult woman with short dark hair, slate blue sleeves with pale salt cuffs, holding an empty chipped clay bowl with both hands, calm attentive face"
  },
  {
    "id": "bone.clerk",
    "name": "拾骨书记",
    "glyph": "骨",
    "color": "#dcbd93",
    "depth": [
      4,
      6
    ],
    "asset": "bone-clerk.png",
    "clueFlag": "archive.read",
    "clueValue": true,
    "recruitable": true,
    "eligibleVerdicts": [
      "blank"
    ],
    "outcomes": [
      "blank",
      "number"
    ],
    "rewardId": "bone.settled",
    "suggestedXp": 5,
    "description": "瘦高的老人把几枚指骨排在布上。他的笔尖早已秃了，墨瓶里装着干燥的沙。",
    "ask": "问他为什么还带着笔",
    "detailChoice": "看那册没有姓名的簿子",
    "clueChoice": "告诉他档案中也有残缺",
    "clueLocked": "尚未读过档案守卫的残页",
    "aChoice": "留空姓名，把找到的地方记下",
    "bChoice": "给每一份遗骨一个不重复的数",
    "text": {
      "hello": "先看脚下。那不是碎石，是最后一节指头。我只管把同一只手放在一起，至于它生前拿过刀还是提过灯，骨头不会告诉我。",
      "account": "我从前替矿工登记工钱。人死了，名字旁边画一道横线，下一页又是新的。我带着那支笔下来，才知道有些横线画得比人的一生还快。",
      "detail": "簿上只写方位：裂墙下，浅沟边，两阶之间。我认不出他们，却不想让后来的人说，这里从来没有谁来过。",
      "clue": "纸会缺，骨也会散。缺的地方若被写得太满，真正知道的人来了，反而找不到自己该说的那一句。",
      "decision": "这一份没有任何可辨认的东西。我可以留着名字那栏，也可以给它一个数。空着怕被漏掉，写了又像账目已经结清。",
      "a": "他用秃笔蘸了一点水，写下石阶的方向，把名字那栏留白。『不是无名，』他说，『只是我还不知道。』",
      "b": "他在页角添了一个小点，数过前页，才补第二个。『数只能防止漏掉，不能抵掉一个人。』他把这一页折出很窄的角。",
      "recall-a": "那一栏仍是空的。每次有人停步，他先问对方是否认识这处石阶，再问要往哪里去。",
      "recall-b": "簿子的页角越来越厚。他翻到这一页时，仍先看遗骨，没有先念那个数。"
    },
    "journalTitles": [
      "尚不知道的姓名",
      "不能抵人的数目"
    ],
    "journalBodies": [
      "拾骨书记记下遗骨所在的位置，留下姓名一栏。他把空白当成尚待回答的问题，没有把它写成无人认领的结论。",
      "拾骨书记为遗骨编了一个数，防止清点时漏掉。他仍提醒自己，数目只能指向一个人，不能替代那个人。"
    ],
    "art": "a tall gaunt elderly man with a bald brow, parchment beige scarf and dark coat, holding a closed blank ledger and a blunt quill, a small pale bone resting on cloth at his chest"
  },
  {
    "id": "salt.warden",
    "name": "盐灯看守",
    "glyph": "盐",
    "color": "#daa267",
    "depth": [
      6,
      8
    ],
    "asset": "salt-warden.png",
    "clueFlag": "cistern.listener.verdict",
    "clueValue": "mark",
    "recruitable": false,
    "eligibleVerdicts": [],
    "outcomes": [
      "share",
      "keep"
    ],
    "rewardId": "salt.settled",
    "suggestedXp": 5,
    "description": "戴粗布头巾的人托着一盏封口盐灯。灯芯未燃，磨白的灯罩里压着几粒褐色的盐。",
    "ask": "问他在等谁来点灯",
    "detailChoice": "问灯罩为什么一直封着",
    "clueChoice": "提起水位旁那道疑记",
    "clueLocked": "尚未见证听水员留下疑记",
    "aChoice": "把守灯的方法告诉后来的人",
    "bChoice": "继续守着，但别许诺灯永远会亮",
    "text": {
      "hello": "别替我点它。封口里的盐还没干透，火一进去，罩子就会裂。我守的是一盏暂时不能亮的灯，这听上去比守一盏灭灯还蠢。",
      "account": "从前每一班只守一夜。下一班没来，我便又添了一笔；后来墙面写满了，只好把第一笔磨掉。我还记得该交给什么人，却已经忘了他的脸。",
      "detail": "罩子封住，不是为了留火，是为了留那一小撮干盐。潮气无处不在，总有人想把最后一点干的东西立刻用完。",
      "clue": "肯在水位旁边写下不知道，说明她还在看水。最怕的不是灯灭，是守灯的人早走了，墙上的话却还说着『有人值守』。",
      "decision": "你路过这里，不能替下一班答应。我能告诉你怎么封灯，也能继续等着；无论哪样，别在外头说这条路已经安全。",
      "a": "他一点点示范绳子怎样绕过灯颈。『学会了，忘掉也无妨。有人再问，你至少能说这不是一道神迹。』他把灯放回原处，没有跟上来。",
      "b": "他抹掉墙上一句早已发白的保证，只留下自己的坐痕。『我在的时候，就说我在。别替明天说话。』",
      "recall-a": "灯还在原处。他有时把封口拆开重做一遍，仿佛下一班随时会坐到对面看他的手。",
      "recall-b": "墙上不再写灯会亮到什么时候。他听见你的脚步，抬手示意自己还在。"
    },
    "journalTitles": [
      "盐灯的封法",
      "不替明天保证"
    ],
    "journalBodies": [
      "盐灯看守演示了封住潮气的方法。他愿意让人学会这门小手艺，却仍留在灯旁；这段交谈没有点亮灯，也没有让通道变安全。",
      "盐灯看守擦去墙上的旧保证，继续留守。他只肯说自己此刻在场，不肯再替未来的每一班值守作答。"
    ],
    "art": "an adult with a coarse ochre head wrap and square patient face, dark work robe, holding a sealed unlit amber salt lamp tied at the neck, absolutely no flame or glow"
  },
  {
    "id": "letter.carrier",
    "name": "末班递信人",
    "glyph": "函",
    "color": "#b67932",
    "depth": [
      8,
      10
    ],
    "asset": "letter-carrier.png",
    "clueFlag": "bone.clerk.verdict",
    "clueValue": "blank",
    "recruitable": true,
    "eligibleVerdicts": [
      "return"
    ],
    "outcomes": [
      "return",
      "wait"
    ],
    "rewardId": "letter.settled",
    "suggestedXp": 5,
    "description": "背着扁皮袋的老人捏着一封没有封蜡的信。信口反复折过，边缘薄得几乎透光。",
    "ask": "问信为什么没有投出去",
    "detailChoice": "问他是否拆开读过",
    "clueChoice": "说起书记留下的姓名空栏",
    "clueLocked": "尚未见证拾骨书记留下姓名空栏",
    "aChoice": "带回给寄信的人，说明没有送达",
    "bChoice": "留在这里等，但不再写已送达",
    "text": {
      "hello": "你从上面来？不必替我捎口信，我怕口信比这封信先旧。皮袋已经空了，只剩这一封，偏偏它最轻，走起来却总在撞我的背。",
      "account": "收信的地方已经塌了。我回去过一次，看见寄信人还在窗边，就又转身下来。袋子空着的时候，人总会问你事情办完没有。",
      "detail": "没拆。我把信口重新折紧过许多次，每次都差一点。我怕里面只有一句寻常的话，那样这些年便全是我自己加上去的重量。",
      "clue": "不知道名字，就把那一栏空着。这样简单的话，我竟绕了这么远。『没有送到』也是一句完整的话，不一定要在后面添个借口。",
      "decision": "路还通到我能走的地方。再等下去，也许有人来，也许没有。我得先决定下次被问到时，嘴里说的究竟是哪一句。",
      "a": "他把信平放进皮袋，第一次没有再折信口。『我会说没有送到。剩下的话，让寄信的人自己决定。』他仍坐着，把背带重新缝紧。",
      "b": "他翻过投递簿上画好的小勾，重新压平纸角。『我等着，不等于他收到了。』说完，他把信搁在手边，不再藏进袖里。",
      "recall-a": "皮袋的带子缝好了。他还没有动身，但再说起那扇窗时，不再急着岔开话题。",
      "recall-b": "信仍在手边。有人经过，他只问是否认得收信的人，没有再把等待说成已经完成的差事。"
    },
    "journalTitles": [
      "一句没有送到",
      "等候不是送达"
    ],
    "journalBodies": [
      "末班递信人决定面对寄信的人，说明信没有送达。他开始修补皮袋，仍留在驻点；这次谈话没有替他完成旅程。",
      "末班递信人继续等待，撤下了投递簿上的完成记号。他把信放在明处，承认等候尚未得到回答。"
    ],
    "art": "an elderly courier with a lined face and russet travel coat, flat leather mail satchel, holding one folded blank unsealed letter, tired but direct eyes, no text or symbols"
  }
]
```
<!-- /narrative2-content -->

### 3.3 唯一装配算法（离线工具；不加入生产运行时）

输入为基线三个JSON和§3.2五行。输出前三项分别写回definitions/portraits/locale，第四项写data/recruitment.json。保留原数组前缀，只修改顶层自有版本及旧立绘尺寸；不把rows或编译器另接生产加载器。可保存为模块自有tools/compile_narrative2.mjs供复核，必须拒绝对已追加数据再次装配；下面函数故意只描述一次干净基线输入，调用者须先核对基线或ID无冲突。

节点/choice ID限定小写；两结局分别进入a/b，回顾进入recall-a/recall-b。所有节点含独立恒真无效果离开项；手动detail/clue回路无剧情副作用。结局按set-flag→journal→emit-story，再由唯一trigger尝试奖励；不能把同一个receiptId抄入两个choice。

<!-- narrative2-compiler -->
```javascript
export function compileNarrative2(base, basePortraits, baseLocale, rows) {
  const definitions = structuredClone(base), portraits = structuredClone(basePortraits);
  const locale = { ...baseLocale }, recruitment = { schema: 1, targetPhase: '5D3', npcs: [] };
  definitions.moduleVersion = definitions.rulesVersion = '1.5.0';
  portraits.displayVersion = '1.3.0';
  for (const p of portraits.portraits) { p.width = 48; p.height = 64; }
  for (const r of rows) {
    const p = r.id, key = s => `ext.narrative.n2.${p}.${s}`;
    const put = (s, text) => { locale[key(s)] = text; return key(s); };
    const flag = value => ({ op: 'flag', id: `${p}.verdict`, equals: value });
    const pending = flag('unresolved');
    const settledKey = put('settled', '这件事已经作出选择');
    const laterKey = put('later', '尚未作出选择');
    const choice = (id, textKey, condition, next, effects = [], unavailableKey = null, unavailable = 'disable') =>
      ({ id, textKey, condition, unavailable, unavailableKey, effects, next });
    const leave = node => choice(`leave-${node}`, 'ext.narrative.choice.leave', { op: 'true' }, null);
    const node = (id, choices) => ({ id, textKey: put(`text.${id}`, r.text[id]), portraitId: null, choices: [...choices, leave(id)] });
    const a = r.outcomes[0], b = r.outcomes[1];
    const endEffects = verdict => [
      { kind: 'set-flag', id: `${p}.verdict`, value: verdict },
      { kind: 'journal', entryId: `${p}.${verdict}.note` },
      { kind: 'emit-story', eventId: `${p}.settled` }
    ];
    definitions.flags.push({ id: `${p}.verdict`, type: 'string', initial: 'unresolved', min: null, max: null, values: ['unresolved', a, b] });
    definitions.npcs.push({ id: p, nameKey: put('name', r.name), descriptionKey: put('description', r.description),
      glyph: r.glyph, color: r.color, portraitId: `${p}.neutral`, dialogueId: `${p}.greeting`,
      presence: 'stationary-interactable', interactionDistance: 1,
      placements: [{ id: `${p}.first`, minDepth: r.depth[0], maxDepth: r.depth[1], maxPerRun: 1, maxPerDepth: 1,
        minStairDistance: 1, maxEntranceDistance: 8, onNoSpace: 'defer' }] });
    definitions.dialogues.push({ id: `${p}.greeting`, entry: 'hello', nodes: [
      node('hello', [choice('ask', put('choice.ask', r.ask), pending, 'account', [], settledKey),
        choice('recall-a', put('choice.recall', '谈谈上次的选择'), flag(a), 'recall-a', [], laterKey, 'hide'),
        choice('recall-b', key('choice.recall'), flag(b), 'recall-b', [], laterKey, 'hide')]),
      node('account', [choice('detail', put('choice.detail', r.detailChoice), { op: 'true' }, 'detail'),
        choice('clue', put('choice.clue', r.clueChoice), { op: 'flag', id: r.clueFlag, equals: r.clueValue }, 'clue', [], put('clueLocked', r.clueLocked)),
        choice('consider', put('choice.consider', '听听还没作出的决定'), pending, 'decision', [], settledKey)]),
      node('detail', [choice('back-detail', put('choice.back', '回到刚才的话题'), { op: 'true' }, 'account')]),
      node('clue', [choice('back-clue', key('choice.back'), { op: 'true' }, 'account')]),
      node('decision', [choice('choose-a', put('choice.a', r.aChoice), pending, 'a', endEffects(a), settledKey),
        choice('choose-b', put('choice.b', r.bChoice), pending, 'b', endEffects(b), settledKey)]),
      node('a', []), node('b', []), node('recall-a', []), node('recall-b', [])
    ] });
    for (const [i, verdict] of r.outcomes.entries()) definitions.journal.push({ id: `${p}.${verdict}.note`,
      titleKey: put(`journal.${verdict}.title`, r.journalTitles[i]), textKey: put(`journal.${verdict}.body`, r.journalBodies[i]) });
    definitions.storyEvents.push({ id: `${p}.settled` });
    definitions.triggers.push({ id: `${p}.reward`, on: { kind: 'story', eventId: `${p}.settled` }, priority: 0,
      condition: { op: 'not', arg: pending }, repeat: { kind: 'once-per-run' },
      effects: [{ kind: 'optional-reward', capability: 'growth.story-reward.v1', rewardId: r.rewardId,
        receiptId: `${p}.reward.receipt`, onUnavailable: 'skip' }] });
    portraits.portraits.push({ id: `${p}.neutral`, asset: r.asset, width: 48, height: 64, fit: 'contain',
      anchor: 'bottom-center', altKey: put('portrait', `${r.name}像素立绘`), fallbackGlyph: r.glyph });
    recruitment.npcs.push({ npcId: p, recruitable: r.recruitable,
      eligibility: r.recruitable ? { flagId: `${p}.verdict`, anyOf: r.eligibleVerdicts } : null });
  }
  return { definitions, portraits, locale, recruitment };
}
```
<!-- /narrative2-compiler -->

## 4 奖励、招募预留与运行时硬规则

### 4.1 小额可配置奖励的实际边界（不可暗补provider）

每人一个独立 `rewardId`：cord.settled、cistern.settled、bone.settled、salt.settled、letter.settled；各有唯一 `${npcId}.reward.receipt`，每局最多尝试一次，两结局同额。建议每个报价 **5 XP**，五人合计最多25 XP，不增加金币/物品/永久属性。这个5是未来growth配置方的建议，不是本包假装可在narrative里执行的数额。

本步narrative可配置的是trigger.effects中的rewardId、是否配置该效果和receiptId；数额由能力provider所有。禁止冒用现有bell/wick报价ID（会显示错原因）、直接grantReward或写XP组件、加amount字段或新奖励kind。默认仅narrative→absent；默认growth+narrative→disabled；另有provider但没有新报价→unsupported-key。三者都记录skipped、故事/日志照常落地、以后不补发。不要写“获得5经验”这种保证到账的对白。

`narrative-config.md`须提供明确标成**未来维护者配置示例，未实施**的五项growth报价建议（各id/amount5/reasonKey，reasonKey在growth命名空间，由growth所有者另加），并说明开启story与升级该模块规则身份才能真实支付。报告区分：生产默认skip、测试provider真实事务applied、真实growth新报价未实施。若维护者要求新局默认就实际到账，与本次冻结接口/只写narrative约束冲突，应另开growth配置任务，不由dot扩大范围；此取舍列§12签认。

### 4.2 招募元数据（只记录，供5D3后续设计读取）

`data/recruitment.json`由§3.3输出，完整形状：

```json
{
  "schema": 1,
  "targetPhase": "5D3",
  "npcs": [
    { "npcId": "cord.mender", "recruitable": true, "eligibility": { "flagId": "cord.mender.verdict", "anyOf": ["splice"] } },
    { "npcId": "cistern.listener", "recruitable": true, "eligibility": { "flagId": "cistern.listener.verdict", "anyOf": ["mark"] } },
    { "npcId": "bone.clerk", "recruitable": true, "eligibility": { "flagId": "bone.clerk.verdict", "anyOf": ["blank"] } },
    { "npcId": "salt.warden", "recruitable": false, "eligibility": null },
    { "npcId": "letter.carrier", "recruitable": true, "eligibility": { "flagId": "letter.carrier.verdict", "anyOf": ["return"] } }
  ]
}
```

字段语义：recruitable=true只表示作者允许未来设计招募；eligibility是尚未被消费的叙事资格提示，不是已招募事实。false必须null。没有居民/岗位/阵营ID、坐标、actorId、招募成本、入住收据或“招聘按钮”。旧三人本步不推定可招募性，缺行=未定义，未来不得默认为true。

新增自有 `recruitment.ts` 纯校验器及单元测试（只由测试/内容工具导入，不接descriptor/module/view）：严格字段、schema/targetPhase、布尔、合法唯一npcId且恰覆盖五个新人、flag存在且为string、非空无重复anyOf属于枚举且不能unresolved、false/null约束、JSON原型/访问器/循环拒绝、克隆深冻结；错误用既有NarrativeError与本地化错误键/路径。用 `assertNarrativeJson` / `freezeNarrative` 等已有纯工具，不放宽生产NpcDefinition/schema。

自有源码守卫禁止生产入口导入或动态读取该文件；改变metadata不能改变当前getNarrativePackIdentity、Game快照、奖励和可见投影。未来5D3若采用它，必须经新任务定义跨模块DTO、消费时机和版本，不能从settlement私自import本文件。

### 4.3 硬规则

1. 新内容只能由既有数据解释器执行。无NPC ID特判、脚本字符串/eval、私有RNG、Date/Math.random规则分支、动态远程资源或隐藏持久WeakMap。
2. 所有状态输入经executeCommand/executeItemCommand；UI不能改flag/session/reward/entity，图片load/error、日志滚动、立绘切页不耗实质RNG/时间、不记录命令。
3. 不改机械schema字段或预算，不能把metadata夹进规则包/存档逃过守卫。free-frozen/close-session与交互资格保持。
4. once-per-run trigger与reward receipt双重去重；复点、旧revision、退出重开、跨层重访、save/load、replay/seek都不在原状态之外累加奖励。A/B互斥，回顾不执行结局效果。
5. 错误条件/预算或provider失败须沿真实原子事务拒绝，比较完整前后状态、双RNG/时间/录像；不吞异常、截断效果或重开局掩盖错误。
6. 不泄露未来日志、未解锁选项详情或metadata。UI只读现有公开投影，不能按活Game补读历史ACK/回放帧外信息。

## 5 像素立绘流程与完整i18n/UI

### 5.1 固定来源和逐文件择取白名单

参考提交：`93523fc596b173396a0d526ab2073b327ff7cf3e`（起草时origin/ext/phase6-loot-core），先核对对象存在。**仅**允许用`git show <固定sha>:<path>`取以下六个文件到同路径，不合并/cherry-pick分支，不复制definitions、locale、descriptor、旧test-suites或整份手册：

- `src/ext/modules/narrative/assets/portraits/archive-keeper.png`
- `src/ext/modules/narrative/assets/portraits/bell-mender.png`
- `src/ext/modules/narrative/assets/portraits/wick-listener.png`
- `src/ext/modules/narrative/assets/portraits/palette.json`
- `src/ext/modules/narrative/tools/pixelize_portraits.py`
- `src/ext/modules/narrative/tests/narrative_portrait_pixels.test.ts`

固定来源文件的起草时实测摘要（dot择取后独立复核）：

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| archive-keeper.png | 1195 | `8495d1db899170c3dc96ce8dfb894f78c790777497f39f82d6f5ebced1a617ba` |
| bell-mender.png | 1175 | `bf58147f8c1fd2646354e3744da08c72661bb44ac3b9b7a969a2ee58b2cdbe45` |
| wick-listener.png | 1280 | `551fe53ae60f7de2c04fbdf907d4d338a1e52db189db5d0a8c18074200a36606` |
| palette.json | 419 | `6e7dcdbb904c3337f951d4df4f5b53136772c351c4019bcbb50f605017f21905` |
| pixelize_portraits.py | 10472 | `1a57b64bc2912fa6bd05142df28ec21988825e558484266e431897a739f08e5c` |
| narrative_portrait_pixels.test.ts | 8201 | `e9aecee179ec522cae8ec33f01dd65aa17d68c2268f18c56e3483a1d8756bf95` |

报告记录来源与SHA-256。三张成品和palette原样保留；脚本/测试在本模块内扩展至八张，保留原三张全部闸门和断言语义。来源不可得先fetch该公开分支；仍不可得则记录美术子项blocked，不能换不明来源。旧三人的原288×384资产可只读作为角色参考，不再生成或重新量化旧三张。

固定palette共有 **32个不透明色+透明索引0**，这是6B1-α已执行一次24→32升级的结果；本次不再次扩色/另配色。新图主色选择§3色相族，L1映射至此palette。与6B1-α的唯一调色板步骤差异：复用已形成的共享色表，不用仅五张新图重新median-cut污染老三张。所有八图的非透明PLTE色必须属于同一palette，原三图字节不变。

### 5.2 生成提示词、尺寸与量化

每新人至多6次生成尝试；沿工具环境提供的正式图像生成能力，不手绘假像素/用SVG方块/从网络挪图替代。不要求访问维护者局域网ComfyUI，也不要求远端存在私人经验库；本节已完整转录所需流程。每张使用下列英文模板，SUBJECT取§3.art；PALETTE填写该人物的赭/灰蓝/骨白/铜褐主色及源palette，不带艺术家或作品名。

```text
Pixel art character portrait for a dark fantasy roguelike game. {SUBJECT}.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette: {PALETTE}. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
```

- 生成源尺寸1024×1536；如工具原生不能提供该尺寸，不自行拉伸伪造输入，记录能力限制并尝试其正式支持的尺寸参数。仍不能满足记blocked。
- 四角各32×32平均色与#FF00FF最大通道差≤60，否则拒收。KEY_COLOR仅脚本一处常量。
- 键控：与洋红最大通道差≤60，或min(r,b)−g>30的洋红边缘→透明；人物不用紫红衣料。
- 固定取底部1024×1365，即crop=(0,171,1024,1536)，不得每人单独缩放/裁切。源图裁后顶行及左右列上80%不透明均≤2，否则重生。
- 预乘alpha后BOX降采样至48×64，再反预乘；alpha≥128取255，否则0。不得先把洋红背景混入前景再缩小。
- 降采样后删与主体断开的≤2像素4连通小块，记录删除数。不人工描补不合格轮廓。
- 映射到固定32色palette，L1最近色，同距取最小索引，无抖动。P模式索引0透明，其他全不透明，optimize=True，不强设导致PLTE补齐256色的保存参数。
- 新文件名为§3.asset；1×存储，不存预放大版本。中间原图、联系表、截图在仓库外；允许小型机器测量摘要在模块自有tools输出或报告，不提交原图。

脚本兼容原三源入口，新增显式新图输入/`--palette`固定色表模式，输出目录强制仓库外候选区；不修改环境中的凭证、生成服务或根依赖。Python+Pillow+numpy只作离线处理，报告实际版本与精确调用，不加npm依赖。

### 5.3 资产测试与视觉闸门

资产测试枚举manifest全部8项，必须文件存在、可解码，不能用缺图fallback通过。继承并扩展源PNG解析测试：

| 数值闸门 | 每张/整套要求 |
| --- | --- |
| PNG | IHDR48×64、color type3、bit depth4或8、无隔行；有效PLTE≤33，非透明色⊆固定palette |
| alpha | 索引0透明，tRNS恰一个0，其余显式或PNG规则隐含255；不含半透明 |
| 元数据/字节 | 无tEXt/iTXt/zTXt/eXIf/tIME；每张≤4096 B，五新图≤20 KiB，八图≤32 KiB |
| 解码像素 | 用node:zlib解IDAT并反滤波；四角透明、顶行不透明≤2、左右列上80%各≤2 |
| 头顶/覆盖 | 首个≥3不透明像素行在3–12；八图头顶行极差≤4；覆盖率35%–75% |
| 对比 | 4邻接剪影边界相对#11130f的WCAG对比度中位数≥1.5 |
| 调色板 | 唯一32色表、无重复/洋红污染，原三张与palette散列保持；新图越界0 |

1×/5×/8×最近邻联系表把八人同排或等距分两排，深底#11130f。逐项人工/模型视觉检查并报告“是/否+观察”：同光向、朝向、轮廓粗细、像素密度；1×面部与道具可辨；主色与glyph同族；无水印/文字/边框；绳结、空碗、簿笔、封盐灯、折信区分清楚；盐灯与听烬人灯均无火光；老三人连续性保持。数值全过不能替代视觉检查。

生成失败≤6次后不得降低尺寸/阈值或交伪图。五新图作为一批安装；未齐全则不发布半套新图，保留已完成的机械内容与缺图降级，报告“部分完成：美术blocked”，不称全交付。不得给缺图测试加skip/todo制造绿灯。三张固定来源择取可独立保留并单列。

### 5.4 UI / i18n完整性与三尺寸验收

仅模块内适配：NarrativePortrait.vue img增加 `image-rendering:crisp-edges;image-rendering:pixelated`，背景纯`var(--bg-deep,#11130f)`；NarrativeDialogue.vue立绘页max-width420→384，保留桌面240×320、≤700px72×96、≤350px48×64。不新建panel/host/键盘屏障，不改变消息ACK与会话所有权。390/DPR1的1.5倍非整数显示如实肉眼检查，不称每个逻辑像素等宽；DPR2对应3物理像素。

所有姓名/描述/九节点/选项/禁用原因/两日志/alt文本写`locales/zh_CN.json`，不加共享locale。§3生成后的JSON里必须是完整字面键，不能让运行时模板拼键逃过i18n扫描。库是中文单locale，本次不凭空加第二语种；不得把内部reward/recruitment ID当玩家文案。末班递信人的“准备离开”不能写成已经跟随/加入营地。

本次 `npm run build` 的真实preview，Chromium浏览器；1440×900、390×844、320×844 × DPR1/2 × 普通/沉浸=12行。每行至少一位新NPC真实对话/选项/日志/查看立绘/返回/关闭；每个NPC至少在三种宽度显示一次，最长正文/长名称/禁用原因安排在320验证。另一次844×390横屏检查。键鼠与触摸模拟分别记录，模拟不冒称真机。

检查无横向溢出、48×64不缩小、脸/手/道具不裁切、按钮≥44px、正文/选项滚动可达、disabled/hide正确、Escape/数字/Enter不穿透、快速双击只记一次、切页不提交命令、关闭不续跑自动探索；会话中save/load、replay只读、seek0/中段/结束后名字/日志/图片正确。制造图片404/延迟/旧URL迟到error，fallback仍可交谈/离开且不改世界/双RNG。未加载资源不能算实际图像展示通过。

记录每行构建身份与结果；截图留仓外。浏览器不可用逐行blocked，完成SFC/引擎可做部分，不用源码CSS断言或旧6B1截图冒充像素验收。真实手机无设备写未实测。

## 6 写入与导入白名单

### 6.1 生产外部导入（穷举；含别名、re-export与动态import）

模块自有目录、`vue`、`i18next`允许；其余仅下表。新增自有import守卫覆盖全部TS/Vue生产文件，不修改共享boundary脚本。

| 路径 | 唯一用途 |
| --- | --- |
| src/ext/descriptor.ts | FOUNDATION_PROTOCOL值、ModuleDescriptor类型 |
| src/ext/types.ts | 仅import type：ExtensionModule/Context/Json/Fact/WorldInteractable等既有DTO |
| src/ext/fingerprint.ts | extensionDataFingerprint |
| src/ext/json.ts | canonical/validId等纯校验 |
| src/ext/ui/types.ts | 仅import type：ModuleUiContribution/Host/Session |
| src/ui/dialogService.ts | 仅既有useNarrativeUi适配器的presentationTimeline及DialogAction/Request类型 |
| src/engine/Core/Game.ts | 仅既有ui/view.ts的import type Game；只读公开view及命令构造，不能扩成机械实例读写 |

不开放任意src/engine、src/ui或任意SDK路径。不导入其他modules的代码、类型、JSON、测试helper/美术。生产不读测试fixture、Node文件系统或recruitment静态表；离线工具可以读文件但不进产品bundle。已有错误码复用，不新建共享报错路径。

### 6.2 测试、工具与文档

测试可只读导入底座catalog/registry/runtime/descriptor/types、src/test/harness、src/test/support/recordingV4、现有SFC harness与i18n、引擎Game/Random/Grid/Terrain/Logger/Item/Creature公开测试接口；Node fs/path/crypto/zlib、vitest、playwright仅用于测试/工具。新真实路线helper归narrative/tests，不import giants/naturalFixture.ts；可以阅读其公开命令规划思路，不能复制隐藏状态写入。

组合通过通用catalog发现器安装，不读别家私有数据控制世界。可选奖励用narrative自有测试provider实现现有底座合同；真实growth默认skip另验，不能把fixture支付写成默认growth已经集成。

新增测试仅登记narrative/test-suites.json：普通unit/Game/UI放test，自有固定自然trace回归放drift，gen为空；不改scripts/test-suites.json、vite配置或宽泛exclude。UI工具/小型trace可放模块自有tools/data，单文件≤1 MB，不拆碎大证据绕限制。文档只两份：配置手册更新；新报告。本文不可由dot修改。

## 7 验收用例：自有单元与真实Game（必须有明确预言）

| 编号 / 建议自有文件 | 覆盖与断言 |
| --- | --- |
| N2-DATA / narrative2_data.test.ts | 精确5人/45新节点/10日志；最终8人59节点15日志9flags8events9triggers；旧机械数组前缀与预算保持；全部ID/locale/portrait闭包、出口/无自动环、descriptor=工厂identity、1.4/错指纹拒绝。独立表验证机械数值，不能只用装配器生成期望自比。 |
| N2-META / narrative2_recruitment.test.ts | §4.2五行严格形状及全部负例；深冻结/克隆；不得写入definitions/npcBindings/玩家/居民；改变预留值不改变当前identity、投影或Game语义。 |
| N2-GRAPH / narrative2_dialogues.test.ts | 五人×A/B各从未决到结局；九节点全遍历；每节点离开无副作用；detail/clue回路不发奖；五种旁支条件true/false、hide回顾只见当前结局；重开/revision旧点击/伪造choice和重复事实拒绝；两结局不能并存。 |
| N2-REWARD / narrative2_rewards.test.ts | 五个不同rewardId与收据；absent/disabled/unsupported-key/applied四路各覆盖五人；同一根选择内日志与支付原子完成；自有真实事务provider按报价5兑现、重复0；prepare/commit异常回滚与失败不录制。测试provider不得称真实growth报价。 |
| N2-WORLD / narrative2_game.test.ts | 正式Game生产包自然放置与公开开口；不把直接plan当Game。深度上下端点及区间外、无位defer/末层skip/更深过期、楼梯距离、可见安全格、可穿行/交互线/不被当敌人。负例允许诊断布景，必须与自然证据分列。 |
| N2-PERSIST / narrative2_persistence.test.ts | 五人两结局真实Game状态至少各一次；进行中/结局/回顾/重访存读、旧会话输入、完整录像/非单调seek/续录；坏flag枚举/日志/收据/绑定、旧版本/旧指纹、缺模块拒绝且现存局不退休。 |
| N2-UI / narrative2_ui.test.ts | 真公开投影接SFC；五人姓名/正文/选项/日志/portrait/alt正确；未解锁信息不泄露，loading/error/迟到事件降级；显示反复刷新世界/双RNG不动；真实浏览器另按§5.4。 |
| N2-PIXEL / narrative_portrait_pixels.test.ts | 八图实际字节全闸门；源三图散列不变、五图独立可辨；不减原测试语义，按§5扩展数量和manifest前提。 |
| N2-IMPORT / narrative2_imports.test.ts | §6逐入口；无跨模块、无metadata生产消费者、无新Game字段/公共协议；测试发现精确登记。 |
| N2-COMBO / narrative2_combinations.test.ts | §8.3九行闭环，生产默认奖励语义与其他模块同时启用。 |
| N2-TRACE / narrative2_trace.test.ts（drift） | §8固定seed/真实commands重建，五新人全部自然命中；运行期不重新搜索碰运气、不改manifest/摘要骗过回放。 |

真实Game断言至少覆盖entity owner/contentId/instanceKey/depth/placement receipt、player位置/HP、turn/tick、两流完整状态/调用数、narrative revision/flags/journal/三类收据、活动节点、录像游标与末态规范快照。只能剔除现有测试约定的savedAt/recordedAt等非机械元数据；若排除logger或recordingOrigin作机械比较，必须另独立比较真实消息/记录前后缀和续录合法性，不删摘要叶掩盖差异。

旧测试只因新增flag或自有版本/图尺寸失败：在临时副本只回退本次对应生产文件、旧测试应通过；恢复新生产应失败，再精确增加五个unresolved初始值/新版本/尺寸前提，保留全对象断言。原D1三人列表与旧结局语义不可删。共享或其他模块trace/守卫需要改动只能报告，不能越界修。禁止skip/todo/降断言/延长旧超时凑绿。

## 8 自然trace、持久化、组合与只删narrative计划

### 8.1 选种子与自然采集（有界、可复现）

正式`startNewGame`，modules=['narrative']，mode='wizard'用于深层验收；自然指原样生产数据/生成和公开命令，不把wizard生存能力算作normal平衡。另normal模式短局至少自然遇到缝绳人并完成一结局，失败如实报告。

每个目标按seed=1…64递增，D1起依次公开移动/search/stairs_down，到目标最大深度；在范围内按depth升序取首次真实placed的目标。每seed最多3000条路线/食物/装备/搜索命令，对话额外最多100条；连续64条无位置/深度/地形或有效行动进展则停止此路线，记录死局/无路/预算/死亡/无位原因再换seed，不把同局无限等待算搜索。若1…64全失败，顺序65…256再一次扩展，不能调产品深度/范围/概率；仍失败即自然覆盖阻断。

可只读全图/实体规划有界BFS，报告注明不是玩家探索策略；方向固定上、下、左、右（需要斜向的扩展固定左上、左下、右上、右下，先按真实角阻规则判断），平局y/x/ID。只用正式move/search/stairs/物品/confirm命令；ACK只推进展示。禁止teleport、改HP/营养/seed/RNG、reveal、直接generateDepth、测试模式地图、注入NPC、篡改placement或清怪。

到NPC后用nearbyInteractables/公开投影确认可开口；有实体但不在交谈距离时须公开移动过去，不能放宽资格。每名采“open→ask→detail→back-detail→consider→choose-a→leave-a→重开→recall-a→leave-recall-a”；另一个从原始新局/结局前真实保存点分叉的B路径执行choose-b/回顾B，不能重置flag伪造另一结局。旁支clue通过实际先前交谈解锁；自然主trace无需强行覆盖所有旁支，另真实Game覆盖。

允许一条长trace覆盖五人，或按人五条；两种均须每名自然出生、A/B各有可复现真实命令，至少A主线纳入固定drift回归。资格不满足可按正式移动接近或记录路线失败；load/replay/seek/原子性断言失败必须作为缺陷保留，不得用换seed掩盖。记录完整有界搜索摘要：所有尝试seed/所到depth/placed或失败原因/命令数；固定seed、mode、modules、entity/placement证据、实际事件索引/turn/tick、奖励结果、录制字节及末态。保存小型 `data/narrative2-*.trace.json` 的seed+真实action/data/decisions+必要断言摘要；完整大录像/截图仓外，不改recording v4。常规回归只用选定seed/commands，不再每次搜索。

### 8.2 存读/回放/seek/续录（每名均验证）

切点：真实新局0、首次遇见、open、decision、结局选择后、close、回顾，至少一次公开上楼/下楼重访后的状态。命令与确认结算后才保存；活动对话本身是已提交状态，可保存。

1. 每切点记录规范完整机械状态+真实消息+双RNG+有效recordingOrigin；从toSaveSnapshot新Game载入后继续原公开命令后缀，末态/收据/日志与未中断局精确相等。
2. 导出原始真实录像，loadReplay逐条replayStep(true)到末，逐条游标/checkpoint/双流一致、0 OOS，不只测“load返回true”。
3. seek按末→0→结局前→open→结局后→回顾→末非单调顺序，每点比原捕获真相；seek不等待图加载，不弹可写选择。带growth初始命令的index0语义沿真实recordingV4工具，不删除初始事件。
4. 至少每人一次存档续录，核对原前缀和新增后缀，续录从原始新局再完整回放；不能用toSnapshot缺origin的诊断档冒充续录。
5. 同层/跨层回访不重生、不改entity绑定、不重开结局/奖励；A/B分叉各有独立正确收据。
6. 开工前真实捕获一份旧1.4含narrative档/录像（独立基线副本），候选读入应拒绝且当前活局/双RNG保持。另造错指纹负例；真实旧输入与篡改输入分列。为实际删除交接保留当前含五新人的真实save/recording仓外文件，不能只伪造manifest代替。

### 8.3 九行相关组合（不是128全集）

`[]`、`['narrative']`、narrative分别配growth/combat/giants/crafting/foraging/settlement六行、七模块全开一行。全部经正式发现器/manifest/initialCommands新局，实际play→save/load→继续→逐条replay→seek0/中段/末→存档续录。空集是extended空manifest；另classic路径如测单列不计第十模块组合。

八个含narrative行均自然遇到至少一位**新人**、完成一结局、关闭后再正常移动；其中narrative-only和七全开须自然覆盖五人（可分seed/多局），不能只D1遇旧三人凑数。growth组合默认disabled，缺席absent；其余模块自身初始状态/资源有效、不被交谈消耗，settlement存在也无本批NPC居民/招募效果。不同组合允许不同seed/RNG轨迹，按§8.1选择并记录，不要求跨组合逐骰相同。没有安装的未来loot不加第八模块。

### 8.4 精确删除计划（本步只plan，不执行物理删除）

```bash
node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,giants,growth,settlement --engine-only --maxWorkers=2
```

断言恰1行、removed=['narrative']、其余六目录保留。当前脚本在真实删除行自动向smoke传`--combinations endpoints`；报告核对其展开命令为剩余全开/全关两行，**不是旧giants2模板的剩余64子集口径**。normal full外部必要门禁状态not-run；engine-only明确浏览器未验。

交维护者后续narrative2集成验收：移除`--plan`，加`--output=/private/tmp/narrative2-removal-<唯一新目录>`。必须整目录物理删除narrative、清TS/Vite缓存、boundary/types/build/全部剩余test:ext、两端点真实Game持久闭环；另在删除副本读取§8.2真实含新人档/录像并证明拒绝不退休活局。通用脚本自造的缺包负例不能冒充这两份输入。dot仅计划，不prepare-only、不宣称删除已通过。

## 9 开发期与收尾门禁

本包采用内容扩充定向档：开发按里程碑，收尾同一最终候选一次。README中的一般full义务留维护者新的集成验收，**不称已经完成的5Z会自动覆盖新内容**。任务书发布本身仅做§A窄实测及文档/范围检查；dot不将§A当作其门禁结果。

### 9.1 开发期

| 阶段 | 工作 | 当步门禁 |
| --- | --- | --- |
| M1 | 数据/i18n/精确自有版本/recruitment与纯校验 | boundary、vue-tsc、N2-DATA/META/GRAPH/IMPORT、发现清单 |
| M2 | 真实Game/奖励/持久化/旧测试前提反事实 | boundary、types、build、自有受影响测试、底座world/optional事务回归 |
| M3 | 5图生成与源3图择取、脚本/像素测试、UI | boundary、types、build、全部资产测试/自有UI/i18n、数值与视觉验收 |
| M4 | 自然trace/九组合/三尺寸/手册与报告 | 固定trace+组合测试、当次build真实浏览器、只删narrative计划 |

全部根目录运行；Node24.19.0+3GiB、Vitest最多2workers。日志保存exit/通过失败skip/todo/时长；初次失败和复跑分列不累计。无新改动/失败/疑点不反复扩大门禁。

### 9.2 最终候选一次收尾

```bash
node scripts/check-module-boundaries.mjs
npx vue-tsc -b
npm run build
npx vitest run src/ext/modules/narrative/tests --maxWorkers=2
npx vitest run src/test/ext_world_interactables.test.ts src/test/ext_optional_queries.test.ts src/test/ext_optional_rewards.test.ts src/test/ext_generation_checkpoint_differential.test.ts src/test/ext_module_boundaries.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=2
npm run test:drift -- --maxWorkers=2
node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,giants,growth,settlement --engine-only --maxWorkers=2
git diff --check
```

另按§5.4真实浏览器12行+横屏；UI适配确有变化时补`dialog_host.test.ts` / `dialog_service_input.test.ts`；文件存在性开工用rg核对。新增自有drift纳入实际test:drift，不能只跑单个trace便称整个drift过。共享drift若因叙事identity/日志变动失败，单变量归因并保留失败交维护者，不手改共享fixture。自有旧trace可按原入口重录、逐字段登记，不能仅替fingerprint。

**不在dot跑**：完整npm test、全部test:ext、128全子集、实际删除矩阵、ce:fetch/test:full/test:gen、全项目性能/体积。集成维护者负责新候选的full与只删narrative实删，报告明确尚未运行。不能因跨白名单失败把全包宣布全绿；本次内容图像阻断与延期集成门禁分栏。

## 10 交付、报告模板与≤30行回执

### 10.1 docs/ext/narrative2.report.md（节序固定）

1. **结论**：完成/部分；五人机械/对话、像素、真实自然闭环各状态；默认奖励实况。
2. **基线与环境**：代码基线、实际派发tip/最终提交、Node/options/workers、图像/Python工具环境、工作树范围核对。
3. **写入与版本**：相对派发tip的显式文件列表/diff-stat；共享零改；1.5.0/display1.3.0与fingerprint；拒旧输入；源资产固定提交/散列。
4. **内容表**：每人ID/深度/驻点/九节点/两结局/日志/rewardId/收据、独立可达性、全部locale键；相对§3任何错字修订。
5. **招募预留**：五行逐条、纯验证负例、当前无消费者/无居民行为、未来5D3身份义务；不称已招募。
6. **奖励**：absent/disabled/unsupported-key/applied矩阵、单次额度/去重/原子性；哪些是fixture支付、哪些生产默认skip；真实growth报价未实施。
7. **测试与门禁**：命令/exit/数量/耗时，首次失败/复跑/未运行分列；N2编号对应测试入口；规范快照比较口径。
8. **自然与持久**：搜索全过程摘要、各人seed/depth/entity/placement/事件索引/字节/turn/tick、A/B分支、save/load/replay/seek/续录/重访；诊断fixture单列；normal补充结果。
9. **组合和删除计划**：九行逐条、plan展开命令及endpoint口径、真实含新人档/录像仓外路径与重建方式、后续full/实删待办。
10. **美术**：每人实际模型名或工具可得标识（不可得写未知）、日期、完整最终提示词、尝试次数/每次拒因、原图来源与SHA、五新PNG SHA、32色固定表、§5所有数值/视觉清单、许可来源；旧三图只引用原生成记录，不能冒称本轮生成。自有原创角色；未使用第三方角色/风格图；生成服务实际条款与未知项如实记录。
11. **UI**：12行+横屏、真实构建身份/工具、模拟/真机、对话/日志/立绘/失败回退/seek、截图仓外地址与未覆盖项。
12. **反事实与SDK问题**：旧测试/自有trace前提变更逐项归因；共享缺陷编号/最小复现/预期实际/影响/本地建议；原exit保留，不削弱断言。
13. **自行决定、签认与审查**：§12决定执行差异、dot新增可逆决定；R1→修复/R2→修复实际有几轮、各发现/关闭方式，末修不能称独立关闭。
14. **遗留**：功能正确性/图像交付阻断、证据缺口、延期集成门禁分开；后续步骤与责任方，不用“待验”掩盖已知缺陷。

报告只保留摘要和可复制入口，不提交截图/原始生成图/>1MB原证据。绝对仓外路径远端不可访问，必须同时给重建seed/命令/工具说明，避免维护者再问一轮才能复核。

### 10.2 手册与提交

更新narrative-config.md的当前身份、八人索引、五人全部配置入口/深度/分支/奖励skip/未来报价示例、metadata与未实现边界、48×64固定32色规范/生成工具/替换步骤、数据变更拒旧档规则与测试入口。保留现有`narrative-example`标记和教学样例可执行性，精确同步需要的自有版本；不改旧报告结论。

显式白名单路径提交，前缀feat(narrative)/test(narrative)/docs(ext)，每条末尾署名 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。审查完成、确认实测退出码与git diff --check后单独push实施分支；可交可复现部分完成，但须明报阻断。禁止merge/rebase/tag、推其他分支；推失败不换API写远端。收尾后停止等维护者集成，不启动5D3。

### 10.3 dot最终回复（下面20行，填值后仍≤30行）

```text
narrative2：<完成/部分完成>；5新人/45节点/10结局日志 <结果>
分支 ext/narrative2；最终commit <sha>；推送 <成功/失败原因>
报告 docs/ext/narrative2.report.md；手册 docs/ext/narrative-config.md
起始tip <sha>；代码基线 59b9ba691daf66819eeea0299a0539f3641ad208
写入 <仅白名单/异常>；共享协议 <未改/异常>
narrative1.5.0/state4/input2；display1.3.0；fingerprint <值>
五人驻点/两结局/回顾/日志 <完成数及缺口>
奖励：默认 <absent/disabled>；测试provider applied <结果>；growth新报价未实施
招募预留：5行/4候选1不可招募；未实施5D3 <核对>
立绘：源3+新5，48×64/固定32色；总字节 <n>；数值/视觉 <结果>
美术blocked <无/具体缺项>；来源/提示词/散列见报告§10
门禁 boundary/types/build/diff <结果>；自有 <passed/failed/skip/todo>
直接受影响回归 <结果>；实际drift <结果，保留首次失败>
自然trace：五人seed/depth <列表>；A/B <结果>；normal <结果>
存读/逐条replay/非单调seek/续录/重访 <结果，OOS数>
组合 <通过/9>；只删narrative plan <一行/结果>，实删未执行
UI 12行+横屏 <通过/blocked/未验>；真机 <结果/未验>
旧前提/trace反事实 <数量>；SDK问题/功能阻断 <摘要>
自行决定 <N条>；R1/R2 <实际轮数及余项>；待维护者签认 <列表>
未运行完整npm/test:ext/128组合/实际删除，交维护者新集成验收
```

## 11 禁止改动与失败处理

白名单外一律禁止：共享引擎/entities/ext根/testing/ui、src/components/ui/App/i18n/locales/data/test、其他模块、scripts、package/lock、构建配置、共享状态合同、黄金基线与本文/其他文档。即使“一行即可修好”的共享bug也交维护者；禁止宽化守卫、隐藏CE缓存、改超时、删失败用例或缩小清单制造绿灯。

发现真实接口不足：自有最小复现/仓外probe，记录预期、实际、失败命令与影响；停止依赖该缺口的子项，继续其余可做工作，最终部分完成。不得用fixture代替自然证据、placeholder代替立绘交付、手改存档代替真实续录、旧通过代替当前候选。推送失败如实说明。

## 12 预先决定、自行裁决与最多两轮审查→修复

### 12.1 待维护者签认（本包已按以下方案起草；转贴即采用）

| 编号 | 已选方案与理由 |
| --- | --- |
| N2-D01 | 恰5人，§3的姓名/深度/五条双结局故事；避开D1原三人，覆盖D2–10，全部是可绕开的固定驻点。 |
| N2-D02 | 奖励采用5个独立可选报价ID、建议各5XP；默认skip，实际数额和开启story由未来growth所有者配置。本步不承诺默认数值到账，守住只写narrative合同。 |
| N2-D03 | recruitment独立静态表、schema1、4候选1不可招募及§4.2资格；本步不改NpcDefinition、不接任何居民接口，不预定岗位。 |
| N2-D04 | 自有module/rules升1.5.0，state4/input2/pack1和共享协议保持；显示升1.3.0；新指纹/版本拒旧输入，无迁移。 |
| N2-D05 | 从固定6B1-α提交择取6文件，原三图与32色表字节保留，五新图量化到该表；每人至多6次生成，不扩色或降低闸门；新图整批安装。 |
| N2-D06 | wizard自然五人A/B闭环+normal早期短局；九相关组合；只删narrative精确plan，full/128/实际删除交维护者新集成验收，历史5Z不冒充覆盖。 |
| N2-D07 | §3正文作为基稿，dot可纠正人称/错字并登记；无额外剧情机制或美术授权扩张。最多两轮审查→修复，剩余缺陷交维护者。 |

这些是待签认的内容/执行取舍，起草、窄实测、仅任务包提交和指定base推送已由用户授权，不以待签认阻止本次交付。

### 12.2 dot自行决定顺序

1. 本次用户范围/白名单优先；真实冻结接口优先于历史设计草图。冲突记录条款与复现，不私改共享协议。
2. 自有函数名/测试拆分/离线脚本组织、在给定光向/人物/色表内的脸型衣物细节、错字人称修订可自行决定，报告列明。ID/数值/深度/结局效果/奖励策略/版本不得改。
3. 无位defer/skip、资格拒绝、默认奖励skip按既有合同接受；不能为顺利采trace提高预算/改位置/强开growth或减人物数。路线失败按有界选种子方法处理。
4. 图片或浏览器不可用按§5标blocked；继续已授权数据/测试/文档，不要求维护者先代做，也不伪造通过。无法完成五人全部自然/图像交付必须部分完成。
5. 奖励真实到账需要他模块报价、招募需要SDK时仅报告后续合同，不临时写替代系统；meta值不作运行时开关。
6. 审查对象是冻结候选与实际证据：**最多R1审查→修复、必要时R2审查→修复**。R1无发现即可止；第二轮后作者对末修跑受影响门禁，标“作者复测”，没有R3或伪称独立关闭。审查由维护者另会话/远端既有评审安排，无独立审查实际发生则写未执行；不把自检冒充独立审查，也不为等第三轮无止境停工。未修功能问题与纯证据缺口分别交本地裁决。
