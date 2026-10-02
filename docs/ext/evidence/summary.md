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
