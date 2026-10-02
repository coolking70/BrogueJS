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
