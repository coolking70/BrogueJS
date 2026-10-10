# 5G R-E01 候选加载时钟修复

## 结果与固定范围

本轮在 `codex/phase5g-maintainer`、HEAD `bca0c5b5c06a2c01395ddb132f8b8bd0a14df8c0` 修复共享既有 R-E01：合法活动力量存档向已经期满的同一 Game 载入，现在使用候选存档时间校验并成功恢复；公开续行仍在原期限正常失效。严格 materialized ledger / resource 校验保留。此为实现与定向门禁交付，等待独立审查，不代替维护者最终验收。

实际修改四个既有文件，另新增本报告：

- `src/ext/runtime.ts`：在原 WeakMap StatSession 内增加 nullable 的临时时钟；timedStats 来源先取 scope 时间，正常活局继续取原 live port。`withStatWorld` 增加内部可选第三参数，嵌套 actor scope 默认继承时间；进入/退出清属性缓存，finally 恢复之前的 actors/time。
- `src/engine/Core/Game.ts`：在候选 world5 结构与时间验证、实体解码之后，以候选 simulationTicks（无 world5 为0）包住完整 detached preflight。范围包含 validateWorld 的资源/账本检查、work references、combat stamina/poise capacity 和其余 action 验证。全部检查结束才走原发布路径。
- `src/test/ext_edible_runtime.test.ts`：新增9项共享真实命令/存读/拒绝/资源回归，使用原 fgfixture；resource 例用本文件内合法中立 growth descriptor，不依赖生产 growth 实现。
- `src/test/ext_stats_runtime.test.ts`：新增1项内部 scope 嵌套、边界、异常退出与缓存回归。

未新增 Game 字段，U03 清单无需修改；没有存档/录像/SDK/protocol bump、迁移、取消守卫、测试 skip 或 timeout 修改。foundation10、whole-run6、recording4、origin2、worldSdk1、edibleSdk1、IDB2保持。本轮没有改 foraging/其他模块、原参与者修订报告、数据/locale/黄金 trace/基线，也没有修改发现器/测试清单。九冻结文件逐 SHA 与开工相同（`frozen.json`）。没有读取/修改 P5 的未提交5D1实现或其他产品工作树，没有 commit/push/代理。

## 原生产红灯与真实效果

证据根 `E=/private/tmp/brogue-commander-20261008-5g-revision/load-clock-evidence`。开工保存2653个跟踪文件逐 SHA、四个拟改原件。复制原独立小 esbuild 探针，仅改维护树/输出根与“晚期合法载入应为 true”断言，先在原生产运行：`red-public-load` **exit1**。真实原 foraging might 由公开 eat 激活，tick100、strength14、bonus2、until40000；即时载入通过；399次公开 wait 到40000、strength12后，相同保存字符串 load=false，堆栈指向原 MaterializedStats.assert。原源码 bundle / probe / 全日志保留，未用修改 guard 造红灯。

修复后相同断言 `green-public-load` exit0；扩展探针最终 `real-extended-fixed` exit0，真实 might 同 Game 到期后载入两次均恢复 tick100/力量14，真实公开续行再到40000回12；fresh Game 对照通过。同一个保存字符串每次重新 JSON.parse，保存字节 SHA 全程不变。

同一探针还真实创建 Goblin 同伴、原 foraging 公开 feed might，调用生产 `nativePair` damage consumer：保存前125%、期满100%、同 Game载入后125%、再次公开期满100%。该 more 来源没有物化 damage ledger；加载后重新按ID取得 actor。未直接改力量、临时行、持续时间或时钟建立效果。

探针遗留字段 `effectiveTick` 是原 live port 的观测值：修后仍显示40000，而候选内部 scope 为100；它说明没有临时重写 port/活局时钟，不应解读为修后来源仍使用40000。所有 `clockCounterfactual` 均 false。生产来源全部来自 maintenance-tree，esbuild metafile 380输入；glob只在内存 loader 改为本树七 descriptor 静态发现，未改源文件，P5源码输入为0。

## 新增回归与严格拒绝

共享回归原 sample6 食物由公开 eat/feed 建立4回合效果；公共 wait 推进，真实 save/load 和原模块事务照常执行：

1. 同一 Game 活动存档在旧局期满后重复加载，100→300仍14，400回12；账本2→0，临时行最终清除。
2. 候选tick200载入旧局100和fresh0；发布后200/14，继续到400回12。
3. world-only候选tick400保留 schema合法的已过期来源行、力量12/空账本，向旧局100加载成功，bonus不复活，下一次公开wait清行。此为专门隔离来源过滤的合成持久化边界。
4. 同伴非物化 increased damage，真实 feed/存读/公开期满，两轮120→100→120，最终100；玩家力量12，damage不产生物化账本。原生产might的more125%另由上述探针覆盖。
5. bonus、timed value、期限恰等于候选tick、候选时钟越过期限四种不一致拒绝。使用 world-only候选隔离属性守卫，完整 whole-run 保存投影 deepEqual，仅归一真实 savedAt；单独核对玩家/背包/runtime/grid/monsters/items/world5对象身份、HP/力量/时钟/世界、双RNG、实体ID和logger。拒绝后活局继续到期并重新载入原合法保存。
6. 合法资源候选与活动力量可向过期局加载；focus current超capacity、remainder等于recovery interval仍拒绝，完整投影、身份/双流/ID/消息保持。combat容量与存读另跑原 combat adapters/runtime。
7. 内部scope对相同ID不同候选actor验证20+2；嵌套继承99tick，显式100失效，返回外层重新+2；抛错后恢复live actor/时间，cacheSize0，后续活局/再次scope读取合法。没有更改actor原始strength。

两个首次非生产错误均保留日志：`new-regression` 为新增过期行例最初使用带录像 provenance 的 save，修改候选后先触发录像一致性，7pass/1fail；修正为项目支持的world-only快照以隔离属性校验，未弱化断言。`real-extended` 首次公开foraging feed漏了模块payload的v:1，C5_BAD_PAYLOAD exit1；补齐真实协议字段，125%及期满断言原样通过。类型首轮 exit2 是本次新增测试的可选字段非空标注遗漏，补标注后通过。

## 排程、输入与门禁

遵循 parent 排程：只做读写/小Node探针，直到 `../gates-second/done` 出现 exit0；在 **2026-10-07 22:41:22 UTC**（北京时间10月8日06:41:22）记录到 `parent-gates-completed.txt` 后才启动Vitest/types/build。未把 parent 的门禁算作本轮结果。

所有Node命令实际 **24.19.0**，run.py在子进程环境显式前置绝对runtime PATH，NODE_OPTIONS=`--max-old-space-size=3072`；Vitest4.1.11最多2workers。未装依赖、未改node_modules。每个实际验证命令有同名 `.command.json`（argv、cwd、完整PATH、堆参数、exit、wall秒）和 `.log`；Vitest另有JSON。

相关集合13文件 **346passed，0fail/skip/todo**：ext_actor_actions_root_world11、ext_actor_resources16、ext_edible_runtime61、ext_recording_v4_snapshots11、ext_stats_native24、ext_stats_pipeline36、ext_stats_review29、ext_stats_runtime26、U03 whole-run18、combat_adapters27、combat_runtime21、foraging_atomic54、foraging_persistence12。精确路径与argv见 `related.command.json`。

346门禁输入的2653文件聚合SHA为 `7a22b564a641fb11751511e97c467e016f68ba5f6397a943e9c8c9cd8a69211e`。类型修正后仅上述测试非空标注有字节差异，esbuild独立对照输出JavaScript逐字相同（`type-only-verification.json`），生产输入没有变化；最终新增10项又完整定向复跑。最终输入聚合SHA为 **`e58ccf4e954aa664e979a572bf20c66ad6fced1056ed197a80ddcadd60fcf145`**，逐文件见 `input-final.json`。算法为码点排序“路径+NUL+SHA256+LF”，2653跟踪输入含原报告，排除本报告自引用及期间由指挥放入的独立审查元数据（只读，未改）。`audit-final.json` 精确列出四处变更；其余2649文件不变。

| 验证命令标签 | exit | 结果 | wall秒 |
| --- | ---: | --- | ---: |
| `red-compile` | 0 | esbuild编译通过 | 0.112 |
| `red-public-load` | 1 | 原生产真实晚期load断言红灯 | 1.536 |
| `green-compile` | 0 | esbuild编译通过 | 0.110 |
| `green-public-load` | 0 | 同一断言绿灯 | 1.555 |
| `new-regression` | 1 | 7pass / 1fail，未选52 | 9.938 |
| `new-regression-fixed` | 0 | 9pass，未选77 | 9.904 |
| `new-resource` | 0 | 1pass，未选60 | 2.806 |
| `real-extended-compile` | 0 | esbuild编译通过 | 0.108 |
| `real-extended` | 1 | feed payload遗漏v:1 | 2.714 |
| `real-extended-fixed-compile` | 0 | esbuild编译通过 | 0.133 |
| `real-extended-fixed` | 0 | 真实加载/期满/125%同伴全部通过 | 5.243 |
| `related` | 0 | 13文件346pass，0skip/todo | 124.076 |
| `boundary` | 0 | 边界通过 | 2.711 |
| `types` | 2 | 新增测试可选字段标注，exit2 | 8.511 |
| `types-fixed` | 0 | 通过 | 8.368 |
| `final-new-regression` | 0 | 10pass，未选77 | 10.993 |
| `type-only-verify` | 0 | 类型修正前后JS逐字相同 | 0.057 |
| `build` | 0 | npm run build通过，保留Vite大chunk提示 | 11.560 |

上述18个实际验证命令 wall 累加 **200.435s**，包括红灯、编译和重复定向验证；不把重复通过数相加。shell读取/编辑/散列审计不计入测试数量。最终 diff-check 另存回执。

## foundation11 / P5 移植交接与边界

本修复只在此foundation10候选实施/验证。没有查看P5未提交5D1内容，不声称foundation11集成通过。后续由指挥安排原P5执行者按以下语义适配，不能机械整块覆盖它的Game/runtime：

- 在P5原内部 stat session 中保留本次 nullable candidate时间；正常来源继续live port。它是临时求值上下文，不进snapshot/格式号/U03 Game字段。
- 从P5自己的已校验候选world5时间建立scope；覆盖其全部候选属性来源、物化账本、focus和combat capacity预检以及新增5D1相关候选读取。嵌套withStatWorld只换actor时必须继承外层时间。
- 成功/抛错退出均finally恢复此前actor/time，并清掉候选缓存；结束scope后才允许原发布流程。严禁先写活局时钟/实体，或为了消除拒绝删bonus/放宽账本断言。
- 将本次10个共享回归及真实might同Game/同伴探针按P5自己的FOUNDATION_PROTOCOL/合法fixture入口适配，复核相应新增资源/候选作用域。保留其原foundation11和5D1持久化契约；本补丁不要求另一次协议升版。

本轮按任务未跑完整npm test/test:ext/test:full/强制CE生成、drift、全128组合、删除矩阵、浏览器或5Z长局。parent原foraging完整+drift的完成marker只是排程条件，不计成本轮验收；这里只报告已实际运行的上述定向集合。所有>1MB bundle/原始证据在E，未入仓库；没有CRLF。完成后停止，独立进程另行审查。
