# Phase6 补充见证与主测量隔离（2026-10-23）

工作树 `ext/party-p1a`，HEAD `3725955ea6dd424f1b649f411a2042c0b04d0874`；A 为 `e72cd6256daf810f89e520f1673b197d6ba6097d`。本次只改性能脚本、相关脚本测试、工作流和本文；不改游戏代码，不 commit/push。

## 原 run 的实际原因

原 run：[39863415840](https://github.com/coolking70/BrogueJS/actions/runs/39863415840)。本地失败日志 `/private/tmp/perfci-39863415840/full-failed-log.txt` 只显示子步骤开始标签，不能把最后一个标签当作失败原因。

- all-prefix 的原 `result.json` 是 `hard=pass, status=regression`，无异常；该分片根本不执行 C1/C4 补充。其 objective round P99 三轮独立中位数 A=388.264959 ms、B=501.975171 ms，增幅 29.2868%，超过 D6 v3 的 25% 门限。原判定保持。
- GitHub API 的 jobs/steps 和 artifacts 均证实：all-full、all-prefix、classic、aggregate 都上传成功。all-full 产物 ID 为 `12467418909`，大小 14,363,844 字节；上传步骤报告 74 个文件。all-prefix 为 `12468545710`，aggregate 为 `12468391371`。
- 汇总日志明确输出 `{"status":"regression","hard":"pass","manifest":null}`。该提交的汇总器要求每个主步骤 `status=pass`，且 C1/C4 原始场景文件与登记结果一致，因此这不是 C4 补充门禁失败或产物缺失。all-full 最后一行是 C4 的开始标签；runner 最终因性能回归设置 exit 1，却没有输出最终原因，造成误读。
- 原封不动的 C4 脚本在本机 Node 24.19.0、3072 MiB 堆限制下退出 0：三次重复均完成 100 次纯查询、12 次直接断肢、12 次掉落尝试，重复退役输入不增事件。证据 `/private/tmp/c4-node24-before-fix.{json,log}`。
- C1/C2 共用 `profile-ext-6c1.mjs`，通过 loot 版本选择原生物品 schema；没有独立 C2 脚本。未发现需要修改场景断言或游戏逻辑的证据，原 C1/C4 场景代码保持。

## 修改

1. 分片支持 `--supplements defer`。工作流先完成主测量、发布摘要并上传原始产物，随后单独运行补充门禁，最后以 `-supplements` 后缀上传结果与日志；上述上传和补充步骤均按 `always()` 保留失败路径。
2. 新补充执行器使用新目录，不覆盖主测量。报告绑定主 `result.json` 的 SHA256、runner invocation、B 提交及源码身份；执行前检查 B 源码和工具散列。某一补充失败会保留 exit/signal/日志，并继续登记其它补充；最终仍退出 1。
3. 原 C1/C2/C3/C4 选择条件保持。all-prefix 单独登记 `not-required`。本地分片不传 defer 时也会在主测量结束后产生同级 `-supplements` 目录。
4. 汇总先重验所有主原始测量与 A/B 比较，再判补充门禁。补充缺失、失败、未完成或绑定/场景漂移时，保留主测量和 D6 指标，登记 `measurementHard=pass, hard=failed`，退出 1 且不冻结预算。离线重算同样校验分离的补充证据。
5. runner 末尾明确打印 measurement 状态、hard 状态及发生回归的 case；补充执行器逐项打印实际退出结果。未调整 D6 门限、观测器、预算、游戏代码或场景断言。

## 验证

相关脚本测试：`test-ext-perf-ab.mjs`、`test-ext-perf-selection.mjs`、`test-ext-perf-split.mjs`、新增 `test-ext-perf-supplements.mjs` 均退出 0；`check-test-dependencies.mjs` 退出 0，`errors=[]`。原测试断言未放宽；新增失败/缺失/绑定漂移/场景篡改/缺步骤/未完成负例，以及 C1 exit 7 后 C4 仍执行且主文件字节不变的真实 CLI 测试。

本地完整单轮命令和产物位于 `/private/tmp/perfci-supplement-fix/`，入口 `run-local.sh`；使用 Node 24.19.0、A 独立只读源码 checkout、B 当前 HEAD，`rounds=1`、两侧 identity=6c4、无 `--limit`。单轮仅验证执行链路，不能作为 D6 三轮通过或新预算。

| 分片 | 主测量 | 补充 | 结果 |
| --- | --- | --- | --- |
| all-full | A/B 各 2,423 events、2,549 客观回合、0 OOS；完整比较通过，D20 settled=500 | C1/C4 各三次重复通过；主结果 SHA256 保持 | 两步骤均 exit 0；hard=pass / incomplete |
| all-prefix | 前缀=2,423 events；A/B 各 2,549 客观回合、0 OOS；完整比较通过 | 独立报告 not-required，保持原选择条件 | 两步骤均 exit 0；hard=pass / incomplete |
| classic（汇总所需） | A/B 各 2,208 events、2,431 客观回合、0 OOS；完整比较通过 | C1/C4 各三次重复通过；主结果 SHA256 保持 | 两步骤均 exit 0；hard=pass / incomplete |
| aggregate | 6 个主测量全部重验，3 个 A/B 完整比较通过 | 三份补充报告绑定重验通过 | exit 0；measurementHard=pass、hard=pass、status=incomplete；无 manifest |

最终核对摘要为 `/private/tmp/perfci-supplement-fix/verification-summary.json`，便携汇总为同目录 `aggregate/`。所有主结果在补充执行后字节哈希保持；两侧源码身份严格为上述 A/B。本地后半段耗时明显波动，所有时间仅作诊断，未作为性能改善结论；原云端 D6 regression 不因此改变。`git diff --check` 通过，`git diff --name-only -- src` 为空。

## 云端重跑

先由维护者提交并推送本次脚本/工作流修改到 `ext/party-p1a`，再执行以下命令。`--ref` 选择修复后的工具/工作流；`head_ref` 仍固定原 B 游戏源码，不混入后续游戏变动。本任务没有替用户提交、推送或启动云端任务。不要用 `gh run rerun 39863415840` 代替新 dispatch，它会继续使用旧工作流。

```bash
gh workflow run ext-perf.yml \
  --repo coolking70/BrogueJS \
  --ref ext/party-p1a \
  -f suite=phase6 \
  -f mode=ab \
  -f base_ref=e72cd6256daf810f89e520f1673b197d6ba6097d \
  -f head_ref=3725955ea6dd424f1b649f411a2042c0b04d0874 \
  -f base_identity=6c4 \
  -f head_identity=6c4 \
  -f comparison=strict \
  -f rounds=3
```

云端单轮链路诊断仅把最后一项改为 `-f rounds=1`；仍不得称 D6 通过。
