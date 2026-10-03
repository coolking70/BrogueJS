# 扩展模式最终门禁原文摘要

本目录只保留最终结果摘要；原始日志、runner、哈希清单、Vitest缓存和中断日志不再提交。旧原始证据已归档到执行环境本地 `/tmp/brogue-phase0-evidence-raw-709f219/`，Git 历史 `709f219` 仍可追溯。后续阶段同样只提交摘要。

## 阶段 0：709f219 的历史最终验收

云端 Linux；Node 24.19.0/npm 11.9.0；NODE_OPTIONS=--max-old-space-size=4096、VITEST_MAX_WORKERS=4、TZ=UTC。下面四项退出码均为 0。未获取 CE 参照，83 skipped 包含 75 个 CE 条件跳过和 8 个历史 skip，5 todo；**CE 对照用例未执行**。这是合并 main 之前的历史结果，不是此次整合/阶段 1 的完整测试证明。

### `npx vue-tsc -b` — exit 0

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
```

### `npm run build` — exit 0

```text
> brogue-web@0.2.0 build
> vue-tsc -b && vite build
vite v7.3.1 building client environment for production...
✓ 948 modules transformed.
(!) Some chunks are larger than 500 kB after minification. Consider:
✓ built in 6.00s
```

### `npm test` — exit 0

```text
> brogue-web@0.2.0 test
> vitest run --exclude '**/generation_baseline.test.ts'
*** CE reference source not found; run npm run ce:fetch ***
CE-dependent tests will be explicitly skipped.
 Test Files  262 passed (262)
      Tests  4594 passed | 83 skipped | 5 todo (4682)
   Start at  19:37:27
   Duration  3193.30s (transform 10.88s, setup 0ms, import 199.37s, tests 12289.51s, environment 104ms)
```

### `npm run test:drift` — exit 0

```text
> brogue-web@0.2.0 test:drift
> vitest run src/test/generation_baseline.test.ts
*** CE reference source not found; run npm run ce:fetch ***
CE-dependent tests will be explicitly skipped.
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  20:30:41
   Duration  50.40s (transform 1.49s, setup 0ms, import 2.20s, tests 47.99s, environment 0ms)
```

## 阶段 1 前置合并：7024ea0

2026-10-02 UTC，`709f219` + fresh fetch 的 `origin/main 912d7a1`。只解 progress.md / zh_CN.json 两处冲突，保留双方新增与 main 词条改名删除。此轮按任务仅跑类型检查与构建，未跑 npm test/test:drift/ce:fetch/test:full，也未做新的浏览器验收。原文日志在 `/tmp/brogue-phase1-merge/`。

### JSON 校验 — exit 0

```text
JSON.parse OK: 1438 keys
```

### `npx vue-tsc -b` — exit 0

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
```

### `npm run build` — exit 0

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
> brogue-web@0.2.0 build
> vue-tsc -b && vite build
vite v7.3.1 building client environment for production...
✓ 960 modules transformed.
(!) Some chunks are larger than 500 kB after minification. Consider:
✓ built in 5.25s
```

## 阶段 1a0：技术底座与数据合同最终验收

2026-10-02 UTC；云端 Linux，Node v24.19.0 / npm 11.9.0，`NODE_OPTIONS=--max-old-space-size=3072`、`TZ=UTC`。源码冻结后完整/CE档全部 exit0；`test:full` 替代 npm test。旧断言/黄金 trace/生成基线未改，原始日志/缓存/逐文件散列留在本地忽略目录。

CE参照已实际启用；无缺参照条件跳过。8个既有退役skip、5个既有todo仍未执行；其中4个todo是CombatFormulas的历史CE公式占位，详情见 [1a0报告](../phase1a0.report.md)。没有新增skip/todo。

### `npx vue-tsc -b` — exit 0

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=16 2026-10-02T06:46:50Z
```

### `npm run build` — exit 0

```text
✓ 968 modules transformed.
(!) Some chunks are larger than 500 kB after minification. Consider:
✓ built in 5.63s
END build EXIT_CODE=0 DURATION_SECONDS=22 2026-10-02T06:47:12Z
```

### `npm run ce:fetch` — exit 0

```text
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=2 2026-10-02T06:47:14Z
```

### `npm run test:full -- --maxWorkers=2 --reporter=verbose --bail=1` — exit 0

```text
 Test Files  275 passed (275)
      Tests  4890 passed | 8 skipped | 5 todo (4903)
   Start at  06:47:14
   Duration  5592.13s (transform 8.49s, setup 0ms, import 183.36s, tests 10951.56s, environment 105ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=5594 2026-10-02T08:20:28Z
```

### `npm run test:drift -- --maxWorkers=1` — exit 0

```text
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  08:20:28
   Duration  49.79s (transform 1.19s, setup 0ms, import 1.87s, tests 47.75s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=52 2026-10-02T08:21:20Z
```


## 阶段 1a：配置驱动经验与等级最终验收

基线 51897db，完整报告见 [phase1a.report.md](../phase1a.report.md)。实际改动 Game、GenerationCoordinator、ItemLoader、Monster 四个引擎/实体文件，因此采用完整/CE档；test:full 替代 npm test。84 新用例、全部 ext 13文件225例、全部源码守卫146快速+3重型预检通过。获准历史初始化调整的单变量反事实及9例清单见报告，原断言不变。

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=14 2026-10-02T09:43:28Z
END build EXIT_CODE=0 DURATION_SECONDS=21 2026-10-02T09:43:49Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T09:43:49Z
 Test Files  280 passed (280)
      Tests  4974 passed | 8 skipped | 5 todo (4987)
   Duration  5754.68s (transform 9.04s, setup 0ms, import 192.59s, tests 11273.62s, environment 109ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=5756 2026-10-02T11:19:45Z
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  49.96s (transform 1.24s, setup 0ms, import 1.96s, tests 47.84s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=50 2026-10-02T11:20:35Z
FINAL all_gates=0 2026-10-02T11:20:35Z
```

前后源码聚合相同：`8aec4a68979ee9c78e6c6d50371aff563a686b3bbf2ed5fea67b0945876e3aa8`。活动 CE 对照已执行；8历史skip/5历史todo明确保留，未新增。此前一轮为修复加载预检实体ID消耗而主动中止exit130，不计完整通过。最终代码后没有再改生产/测试。原始日志/清单/中断记录仅在忽略目录 `tmp-phase1a-raw/`。

1a 完成后停下；合 main 前由维护者本机另跑完整 test:full。


## 阶段 1a1：生成检查点缩窄最终完整 / CE 门禁

2026-10-02 UTC；云端 Linux / Node24.19.0 / npm11.9.0，`TZ=UTC`、`NODE_OPTIONS=--max-old-space-size=3072`。完整 2 worker，drift 1 worker，原超时/断言/测试集合不变；唯一最终完整轮次全部 exit0。实现、13项新回归、性能和剩余实体规模成本见 [1a1 报告](../phase1a1.report.md)。

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=16 2026-10-02T12:05:32Z
✓ built in 5.94s
END build EXIT_CODE=0 DURATION_SECONDS=21 2026-10-02T12:05:53Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T12:05:53Z

> BROGUE_REQUIRE_CE=1 vitest run --exclude '**/generation_baseline.test.ts' --maxWorkers=2 --reporter=verbose --bail=1
 Test Files  281 passed (281)
      Tests  4987 passed | 8 skipped | 5 todo (5000)
   Start at  12:05:53
   Duration  6080.44s (transform 9.58s, setup 0ms, import 205.48s, tests 11908.80s, environment 112ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=6081 2026-10-02T13:47:14Z

> vitest run src/test/generation_baseline.test.ts --maxWorkers=1
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  13:47:14
   Duration  53.66s (transform 1.41s, setup 0ms, import 2.22s, tests 51.26s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=54 2026-10-02T13:48:08Z
FINAL all_gates=0 2026-10-02T13:48:08Z
```

CE活动对照全部执行，8个skip/5个todo仅原有退役或历史占位；无新增skip/todo，无FATAL/OOM/worker异常。构建保留既有大块产物警告。595个输入前后SHA-256相同：`e3c05d9aa0a1daaae6eb463c3500adc3496c446dc60e035ea6ec30a6535e232c`。原1a0/1a/经典测试、黄金trace/生成基线与U03未改。门禁后只整理文档；不把预检或性能成功路径当回滚正确性替代证据。


## 1b：纯求值、属性与原物品（2026-10-02）

完整/CE档；实现/覆盖/边界见 [1b报告](../phase1b.report.md)。冻结后五项均exit0，test:full替代npm test，没有拼接定向结果冒充完整通过：

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=15 2026-10-02T15:07:23Z
✓ built in 6.31s
END build EXIT_CODE=0 DURATION_SECONDS=24 2026-10-02T15:07:47Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T15:07:47Z
 Test Files  289 passed (289)
      Tests  5140 passed | 8 skipped | 5 todo (5153)
   Duration  6751.17s (transform 10.09s, setup 0ms, import 224.71s, tests 13229.83s, environment 123ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=6752 2026-10-02T17:00:19Z
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  52.06s (transform 1.29s, setup 0ms, import 1.96s, tests 49.94s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=53 2026-10-02T17:01:12Z
FINAL all_gates=0 2026-10-02T17:01:12Z
```

607个输入前后SHA-256相同：`6093922b8969e9df75050e652794ae6e994c010b6a9a089e16e02e6db2bd15d1`。8 skip/5 todo为原有历史项；无FATAL/OOM/worker异常。旧测试、源守卫、黄金trace、生成基线及U03未改。新增153项回归，含13项独立完整对象图差分及漏写敏感性控制。预检全部ext391项、源码守卫146快速+3真实普查通过；后者45种子×26层、3803台machine、0center违例。

初期复活合同整合失败和新经典测试private签名typecheck失败均修生产/新测试后重新验证；详情和原始日志位置见报告。最终完整运行与drift均一次完整全绿，不把这些早期失败隐藏为通过。停在1b，未开始1c，未合并main。


## 阶段1c：中性对等保险与刻符界面最终验收

2026-10-02 19:34:25–21:13:42 UTC；最终代码包含main0ca1c67与预期搜索修复830ad74。实际引擎文件Combat.ts（预览修复）、Game.ts（合入只读getter），因此完整/CE档；full替代npm test。Mac仅做最终v5真实三尺寸/普通沉浸浏览器和D1→D5计时，详见[1c报告](../phase1c.report.md)。移动视口不是物理手机，真实触摸/连续触控按住未实测；截图只留Mac本地。

Node24.19.0/npm11.9.0、3GiB、full两worker/drift一worker；冻结624输入SHA256 `9f5813c8683725a9793876aa732c67ed9a9072e446443312d509edbe3d1d744a`，最终unchanged=true。原断言/黄金trace/生成基线未改；三份旧SFC仅在生产单变量反事实后补resolver依赖。两次被浏览器整改中断的full为exit130、drift未开始，不移用为通过证据。

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=17 2026-10-02T19:34:42Z
✓ built in 5.71s
END build EXIT_CODE=0 DURATION_SECONDS=21 2026-10-02T19:35:03Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T19:35:03Z

 Test Files  295 passed (295)
      Tests  5416 passed | 8 skipped | 5 todo (5429)
   Start at  19:35:04
   Duration  5868.48s (transform 8.91s, setup 0ms, import 199.53s, tests 11491.51s, environment 111ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=5869 2026-10-02T21:12:52Z

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  21:12:53
   Duration  48.49s (transform 1.20s, setup 0ms, import 1.84s, tests 46.50s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=49 2026-10-02T21:13:41Z
FINAL all_gates=0 2026-10-02T21:13:42Z
```

8 skip/5 todo均为历史原项；CE活动对照全部执行，无FATAL/OOM/worker异常。原始日志与完整散列仅保留执行环境tmp-phase1c-raw/。仅限ext/foundation交付；1c后停止，1d/1e未授权。


## 阶段1d：受控动作、技能与数据说明最终验收

2026-10-03 01:27:13–03:01:13 UTC；实现、两项限定旧UI前提反事实、真实ITEM_RUNIC补充对等保险及Mac最终浏览器证据见[1d报告](../phase1d.report.md)。Node24.19.0/npm11.9.0、`TZ=UTC`、`NODE_OPTIONS=--max-old-space-size=3072`；full两worker，drift一worker。旧完整脚本仍含生成普查，新main门禁拆分不在本次冻结输入中；没有改变原超时或跳过失败。此前00:02轮次会话中断、无完整退出码或drift结果，不计入通过。

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=16 2026-10-03T01:27:29Z
✓ built in 5.67s
END build EXIT_CODE=0 DURATION_SECONDS=22 2026-10-03T01:27:51Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-03T01:27:51Z

> BROGUE_REQUIRE_CE=1 vitest run --exclude '**/generation_baseline.test.ts' --maxWorkers=2 --reporter=verbose --bail=1
 Test Files  307 passed (307)
      Tests  5550 passed | 8 skipped | 5 todo (5563)
   Start at  01:27:52
   Duration  5548.96s (transform 9.30s, setup 0ms, import 197.01s, tests 10861.06s, environment 111ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=5550 2026-10-03T03:00:21Z

> vitest run src/test/generation_baseline.test.ts --maxWorkers=1
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  03:00:21
   Duration  51.99s (transform 1.31s, setup 0ms, import 1.89s, tests 49.94s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=52 2026-10-03T03:01:13Z
FINAL all_gates=0 2026-10-03T03:01:13Z
```

638个生产/测试/脚本/资源/构建输入前后SHA256一致：`f5c0c383384cf798c075cae576b3160c503caf310ee4a0cdccc476d6dd183f96`。最终生产哈希`ddbc12288df0e4546fc67eec5c64ff726a565760ead96ae90f97a1c9e5c2c315`与Mac第三版完全相同。活动CE对照已执行；8 skip/5 todo均为原有历史项，无新增。D27–40独立基线在full、D1–26基线在drift通过，原黄金trace/基线/U03未改。完整日志无FATAL/OOM/断言失败/未处理错误/worker异常；保留既有大产物块与npm代理配置警告。原始日志、全量散列及中断轮次只留`tmp-phase1d-raw/`。

仅限ext/foundation交付；远端目标SHA由发布步骤单独核对。本步后停止，1e与NPC主动AI未实施。


## 阶段1e：身份、怪物模板与阶段1收尾（最终验收）

档位：新版全量；扩展身份/赠技/来源与创建DTO改变存档/录像合同，真实出生启用模板。前置合入main1ff39a8，保留36个既有遗漏测试登记，新增8个测试全登记。最终只用下列第二候选完整一轮，不拼接第一候选中断结果。第一候选07:50–08:01 UTC因真实浏览器QA-1（双击下一步越页）主动exit130，full未完整结束、gen/drift未执行。

Node24.19.0/npm11.9.0，3072MiB堆，full/gen两worker、drift一worker；2026-10-03 08:21:16–10:18:46 UTC。类型26秒、build38秒、固定legacy ce:fetch均exit0；build保留原大块与npm代理提示。

```text
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9

COMMAND npm run test:full -- --maxWorkers=2
 Test Files  288 passed (288)
      Tests  5314 passed | 8 skipped | 5 todo (5327)
   Start at  08:22:21
   Duration  2334.86s (transform 14.10s, setup 0ms, import 254.82s, tests 4360.89s, environment 141ms)
EXIT_CODE=0

COMMAND env BROGUE_REQUIRE_CE=1 npm run test:gen -- --maxWorkers=2
 Test Files  27 passed (27)
      Tests  436 passed (436)
   Start at  09:01:17
   Duration  4513.57s (transform 4.39s, setup 0ms, import 34.28s, tests 8898.17s, environment 13ms)
EXIT_CODE=0

COMMAND npm run test:drift -- --maxWorkers=1
 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  10:16:32
   Duration  133.76s (transform 1.80s, setup 0ms, import 3.65s, tests 129.73s, environment 1ms)
EXIT_CODE=0

FROZEN_INPUT_COUNT=652
FROZEN_INPUT_HASH=55e2ab92d5291176f31812c417b1b96ae09469c003f7cd7a12179dbfc5c45792
FROZEN_INPUTS_UNCHANGED=true
FINAL_END 2026-10-03T10:18:46Z EXIT_CODE=0
```

旧8skip/5todo未改，CE用例执行；源码守卫/黄金trace/两份生成基线原断言保留。96份严格JSON、3份JSONC、LF及diff检查通过，无FATAL/OOM/未处理或worker异常。第二候选生产hash e08d450666c2f607b95832a9a237c4b56952f7e28738e3b5e936b26e6ce6043e；16个dist与Mac验收字节一致。Mac六布局/完整身份、18次真实上下步双击、创建屏障、7事件自然存读/导入/seek/续录与法器瞄准取消通过；原生食物确认取消、真实触摸、导出剪贴板字节未覆盖，既有BODY/Tab焦点限制非1e回归，详见[1e报告](../phase1e.report.md)。原始日志/反事实/截图不提交。


## 阶段2a0：组合与物理可移除底座

第二冻结树：2026-10-03 13:49:43–14:37:45 UTC，Node24.19.0/npm11.9.0，3072MiB堆，每命令2workers。原CE缓存保持，未fetch/full/gen；无地图生成改动，不跑drift。下面原文结果均来自这一最终代码/测试树，首轮唯一源码字符串守卫失败和旧删除轮exit130另记于[报告](../phase2a0.report.md)。

```text
COMMAND npx vue-tsc -b
EXIT_CODE=0 WALL_SECONDS=22.82
COMMAND npm run build
EXIT_CODE=0 WALL_SECONDS=34.83
COMMAND node scripts/check-module-boundaries.mjs
Module boundaries and test ownership verified.
EXIT_CODE=0
COMMAND npm run test:ext -- --maxWorkers=2
 Test Files  51 passed (51)
      Tests  976 passed (976)
   Duration  273.37s
EXIT_CODE=0
COMMAND npm test -- --maxWorkers=2
 Test Files  296 passed (296)
      Tests  5385 passed | 8 skipped | 5 todo (5398)
   Duration  2543.61s
EXIT_CODE=0

COMMAND node scripts/check-module-removal.mjs --retain=none --engine-only --maxWorkers=2 --output=<isolated-evidence>
ACTUAL_REMOVAL=src/ext/modules/growth
DELETED_FILES=60 DELETED_OWNED_TEST_FILES=30
COMMAND node scripts/check-module-boundaries.mjs
Module boundaries and test ownership verified.
EXIT_CODE=0
COMMAND node node_modules/vue-tsc/bin/vue-tsc.js -b
EXIT_CODE=0
COMMAND npm run build
EXIT_CODE=0
COMMAND npm run test:ext -- --maxWorkers=2
 Test Files  21 passed (21)
      Tests  431 passed (431)
   Duration  192.83s
EXIT_CODE=0
COMMAND npm test -- --maxWorkers=2
 Test Files  266 passed (266)
      Tests  4840 passed | 8 skipped | 5 todo (4853)
   Duration  2296.95s
EXIT_CODE=0
COMMAND node scripts/check-module-composition-smoke.mjs --output <json> --engine-only --removed-modules growth
installed=[] engine=passed requestedScopePassed=true browser=not-run
REMOVAL_STATUS=partial-browser-not-verified
EXIT_CODE=0

FROZEN_INPUT_COUNT=2015
FROZEN_INPUT_HASH=6291f89229bd60dc075a1576e2b62f43792e5249637f164bc1b55b8b93a19d60
FROZEN_INPUTS_UNCHANGED=true
REMOVED_COPY_INPUTS_UNCHANGED=true
CODE_TEST_INPUT_COUNT=727
CODE_TEST_INPUT_HASH=b3e049d421ec9c64920f70ee975ad0bdc1bc098438c131da712d946284ded0d8
```

浏览器不由engine-only冒充；Mac使用与第二树新构建逐字相同的normal24文件/删模块16文件，实际UI证据及工具限制见报告。无FATAL/OOM/未处理或worker异常。日志、完整散列、截图与百MB级跨版本快照均不提交。
