# R-E01 候选加载时钟修复：维护者侧独立审查

**结论：R-E01 在本固定候选上关闭；未发现新的、有复现证据的修复缺陷。可签收此共享修复本步。** 独立 Node24 真 might / feed / wait / load 探针通过，两个直接相关原测试文件87项通过。本结论不代表整个5G浏览器、5D1/foundation11移植或5Z最终验收。

## 1 固定输入与只读范围

- 基线：`bca0c5b5c06a2c01395ddb132f8b8bd0a14df8c0`，原 `../review-tree`；其HEAD不变、工作树干净。
- 修复候选为本目录 **input固定快照**，以manifest而非移动工作树/分支身份界定：**2655文件，SHA-256 `fbcb09035c633aa1e6711a1f03274c149c0016b338e713ad43c05042f279b515`**。
- manifest.json 文件自身SHA-256：`3291c2f2ba15b6609e8af19b45f1fda2b4fb4f5f701a6e01af606cf212c58d95`。开始和结束逐文件复算全部符合；manifest字节/输入汇总/基线HEAD与状态均不变，input中无额外文件。
- bca→input恰四个既有文件变化：`src/engine/Core/Game.ts`、`src/ext/runtime.ts`、`src/test/ext_edible_runtime.test.ts`、`src/test/ext_stats_runtime.test.ts`；另新增两份文档：`docs/ext/phase5g-load-clock.report.md`、`docs/ext/phase5g-maintainer.review-findings.md`。未混入其他生产或测试变化。
- 完整阅读实现报告与 `../evidence/review-findings.md`，独立读四文件diff、真实stats/resource/加载调用链。本轮没有读取移动maintenance-tree生产代码或5D1源码，没有改input、原review-tree、共享依赖或仓库报告，没有commit/push/派代理。
- 此目录本身不是git工作树；首次在快照根调用git返回not a git repository（exit128），随后仅核对允许只读的bca工作树，快照身份以全部SHA验证。

九冻结文件（worldSdk、edibleSdk、worldEdible、kindKnowledge、actorNeeds、stats、worldHarness、forageHarness、fgfixture/index）逐SHA与bca及前次独立审计一致。U03契约文件未变。Game diff只增加局部变量/调用scope，无新增Game字段；新增时间字段在原私有WeakMap StatSession内，未入存档或Game自有状态。

协议仍为foundation10 / worldSdk1 / edible1 / whole-run6 / recording4 / origin2 / IDB2。foraging及其他模块生产、数据/locale、黄金trace、发现器/清单与其他共享文件均不变。这是本固定快照审查，不涉及远端发布或提交签名。

## 2 R-E01 独立复现修复结果

探针 `probe.ts` 导入input真实Game/harness、原foraging descriptor与参与者；descriptor的statSources仅包只读观察并原样返回原collect结果，没有mock来源、改buff数据或直接给力量赋值。初始安全地形/移除敌人/授予食物/HP17是受控布景，效果与时间推进均经公开命令。

seed `51020001`，仅foraging：公开eat might产生力量12→14，tick100，applied bonus2，untilTick40000。保存字符串始终不变（本次SHA `3c72e0e66583b84b104530654e9df15807cb2fa1bbb054e8c93438e68e0832ff`；savedAt等真实时间元数据使其不要求等于上一轮hash）。每次加载重新parse同一个字符串。

| 独立场景 | 实际结果 |
| --- | --- |
| 同Game即时加载活动档 | true，tick100 / 力量14 |
| 399个公开wait到40000后，同Game加载原活动档 | **true，tick100 / 力量14** |
| 再次到期后重复加载同档 | true，恢复+2；未出现单次有效的缓存偶然性 |
| 恢复后公开推进到39900 / 40000 | 分别力量14 / 12；期满timed行清除，applied bonus归0 |
| 真实tick200档载入tick100活局；fresh Game载入该档 | 均true，发布后200 / 力量14 |

**全程没有上一轮的时钟port反事实。** 观测期满活局仍为40000，而outer candidate scope显式时间100、inner scope未传时间，真实求值力量14。合法加载预检期间旧player/runtime/grid/world5等身份和完整机械状态保持，到所有预检完成后才发布新世界。

上一轮整快照比较的false已得到更精确裁决：这次用 `toSaveSnapshot` 完整投影，**仅归一根savedAt为0**，逐叶比较；所有合法preflight入口/成功出口、异常退出前及八个拒绝终态均零差异。没有删除logger、recordingOrigin、ID或其他机械字段来制造相等。双RNG、实体ID、logger另独立比较，对象根使用引用相等。

## 3 边界与实际消费者

### 候选覆盖、嵌套和缓存

- `Game.ts:11621–11668` 的outer withStatWorld覆盖完整detached preflight：validateWorld、work references、combat状态/容量/几何/行动校验。候选world5合法性已在 `11571` 检查，scope读取候选 `simulationTicks`；缺world5用0。
- `runtime.ts:1242` 内部validateWorld和 `Game.ts:11639` 的combat容量回调均嵌套withStatWorld，未传时间时继承outer；没有再落回旧活局port。
- `runtime.ts:454–462` 保存/恢复之前actors和nullable时间，进入与finally退出调用pipeline.clear；`StatPipeline.ts:252–255` 清value和source cache。可选时间0使用nullish语义，不会被truthy判断丢弃。
- 原生产全部withStatWorld调用者仅上述加载路径和validateWorld；没有漏掉其他生产调用者。本步未把scope加入StatQuery、StatSourceContext或模块SDK。

独立异常scope以真实保存玩家解码出的候选对象、原might真实timed行验证：untilTick−1时+2，nested默认仍+2，nested显式untilTick时0，返回outer又+2；主动抛出同一个marker后恢复live actor/time，cacheSize为0，再读live仍+2。正常scope在untilTick求值0，退出cache为0，live再读+2。没有直接手写临时行建立此独立场景。

### 过期来源与严格坏账拒绝

从真实公开到期后的world-only投影保留原schema合法旧timed行，向较早tick100活局加载：候选tick40000被接受，力量保持12、bonus0，下一次公开wait清掉旧行。此为隔离来源过滤的合成持久化边界，不冒称自然save仍有活动玩家过期行。

另以world-only候选隔离属性校验，四种坏账均拒绝：applied bonus+1、timed value+1、untilTick恰等于候选tick100但仍带活动bonus、候选tick推进到40000但仍带力量14/bonus2。每次false后完整快照逐叶一致、七个对象根引用不变、HP/双RNG/ID/clock/logger不变，活局仍14；后续公开到期/合法载入继续正常。MaterializedStats严格断言与NativeStatSources扣除旧bonus的公式均未修改。

### 玩家/NPC与真实资源

- 原foraging公开feed might给真实Goblin；使用生产 `nativePair(...,'physical-damage',{baseValue:100,...})`：125%→公开期满100%→同Game load恢复125%，重复两轮，再期满100%。该more来源不产生物化damage账本；加载后按ID重取actor。玩家力量保持12。
- 启用真实growth+combat+foraging，先通过公开付费 `combat.attack fixture.slash` 建立真实combat资源行，再公开eat might。候选tick190、旧活局tick40090的load成功；validateWorld与combat容量两个inner scope都求值14（继承190），outer也14。公开续行至原期限仍回12。
- 真实growth的focus current>capacity / remainder==recovery interval，真实combat的stamina / poise超过实际stats容量四个候选均拒绝，完整投影/对象身份/双流/ID/logger不变。保留严格资源约束，没有通过修改fixture定值或删除账本绕过。
- 原foraging statSources只读观察确认：preflight collect的actor HP/位置来自候选，state来自候选模块state，playerId/player标记与候选身份吻合。实际旧局已回血而候选HP17的场景仍收到17。StatSourceContext没有新增候选clock读口；作用域时间仅由底座临时来源筛选使用，未扩模块写权限。

最终独立脚本共 **22次load：14合法成功、8有意坏账/资源拒绝**，所有断言通过。日志逐场保存outer/inner显式时间、活局时间、候选对象值、真实求值和provider读取数。

## 4 新发现与既有条目裁决

- **R-E01：关闭（仅此固定foundation10候选）。** 原失败触发条件已用原公开might在Node24独立绿灯，真实到期、未来/过去候选、坏账与资源守卫均保持。
- **新生产/测试缺陷：0条。** 未发现须返修此四文件的有证据缺陷；不把独立探针自身前两次错误列为生产问题。
- 上次R-F01不在本共享修复diff内，本次未复跑foraging atomic，也不改写其历史关闭证据。
- 5G浏览器24格/真实触摸/5Z及5D1集成仍未由本审查验证，不列为新代码缺陷。

本步没有必要新增生产修复建议。后续foundation11/P5移植仍须由原实现者按其自己的候选加载结构覆盖全部读取；保留嵌套继承、finally恢复与严格账本/资源测试，再独立验证，不能据本候选通过直接宣布另一棵树集成完成。

## 5 独立命令、失败过程与覆盖精度

所有Node使用绝对路径：

`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`

实际版本 **v24.19.0**；全部进程 `NODE_OPTIONS=--max-old-space-size=3072`，未用shell默认Node25。run.py记录实际argv/cwd/版本/堆限制/退出/wall时间。共享node_modules只用现有依赖；esbuild metafile380输入，生产源码全部来自input，maintenance-tree和5D1源码输入0。

| 本次命令/标签 | exit | 实际结果 | wall秒 |
| --- | ---: | --- | ---: |
| `python3 audit.py before` / `after` | 0 | 2655逐文件与manifest完全一致，前后输入不变 | 审计，不计测试耗时 |
| `python3 run.py compile compile.cjs` | 0 | 首轮独立probe编译 | 0.127 |
| `python3 run.py probe probe.cjs`，保留为probe-initial | 1 | 观察包装未在发布后卸下，后续scope检查误报旧preflight快照 | 56.854 |
| `python3 run.py compile-fixed compile.cjs` | 0 | 修正观察包装finally恢复 | 0.133 |
| `python3 run.py probe-fixed probe.cjs` | 1 | 真实力量/同伴通过；组合布景未建立combat资源行，未触发容量inner scope | 19.505 |
| `python3 run.py compile-final compile.cjs` | 0 | 补公开付费slash建立真实资源行 | 0.124 |
| `python3 run.py probe-final probe.cjs` | **0** | 22load与上述scope/消费者/边界全部通过，无反事实 | **23.135** |
| `python3 run.py vitest-related …`，完整argv如下 | **0** | **2文件87passed，0failed/skip/todo** | **57.258** |

首轮失误归因明确：合法load已经发布新世界，探针仍将同一个已发布runtime的内部scope包装绑定到发布前捕获的旧世界，产生大量真前后差异。这不是preflight改了live；修复仅在探针load finally恢复所创建runtime的原withStatWorld，未修改任何input。第二轮没有为了减少期望nested计数放宽断言，而是用真实公开slash创建资源，仍要求两个inner scope并真实校验stamina/poise。

原失败日志、command回执和原bundle都保留；最终 `probe.result.json` 为成功轮。重复轮通过场景不累计为独立测试总数。原实现报告346项是执行者证据，本审查没有复跑346或借用其数量。

独立Vitest完整实际命令（run.py子进程cwd为input）：

```sh
python3 run.py vitest-related node_modules/vitest/vitest.mjs run \
  src/test/ext_edible_runtime.test.ts src/test/ext_stats_runtime.test.ts \
  --config ../review-vitest.config.mjs --configLoader native --maxWorkers=1 \
  --reporter=default --reporter=json \
  --outputFile.json=/private/tmp/brogue-commander-20261008-5g-revision/load-clock-review/vitest-related.json
```

两个原测试文件完整执行（61+26=87），含新增10项，没有名字过滤、skip或改断言。Vitest4.1.11；一次、单worker，等Node探针结束后串行启动。外部配置只继承原vite.config并把Vite缓存放本审查目录，native config loader避免在只读共享依赖写临时配置。globalSetup提示CE缓存缺席，但本次选集中实际skip为0，未fetch或制造跳过。

未跑类型/build/drift、完整npm/test:ext、全组合/删除/浏览器或长局；不将未运行项写成通过。结束manifest自身哈希、2655输入聚合与逐文件SHA全部不变；只新增本审查目录中的probe/support、log/cache和报告，原树无写入。完成后停止，等待指挥。
