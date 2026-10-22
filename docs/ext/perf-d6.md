# D6 v3 性能判定

维护者于 **2026-10-23** 裁定生效，脚本身份 `D6-v3-2026-10-23`。替代新运行中的 `D6-2026-10-16` 判定；**历史 run 不追溯改判**。离线结果另存并列比较，不覆盖原 artifact、GitHub 状态、原裁定或已冻结预算。[P1d 报告 §6.0](party-p1d.report.md#60-2026-10-23-汇总修复与-d6-v3)记录本次三批对照和证据限制。

同一个 gate（classic/full、all/full、all/prefix）内分别执行两条规则，任一触发则 timing regression：

| 指标 | 阈值 | 三轮判定 |
| --- | --- | --- |
| command/round 及完整路线 D20 的 P95；elapsed 墙钟 | +10%，最少 1ms | 保持逐轮规则：一轮任一 P95/墙钟越线算一轮；至少 2/3 轮则 regression，允许两轮由不同 P95/墙钟指标触发 |
| command.max、depth.20.max、round.p99、roundDepth.20.p99 | +25%，最少 1ms | 每项分别求 A 三轮中位数和 B 三轮中位数；任一指标中位数越线则 regression。单轮尾部越线仅记录，不能与 P95/墙钟凑成 2/3 |

统一公式仍为 `B > A + max(1ms, A × fraction)`，等于阈值不越线。尾部公式中的 A/B 是**分别取出的中位数**，不是逐轮比率的中位数，也不是合并三轮原始样本后再计算 P99。不删除慢样本，不调整原比例。P99 仍由各轮原 `.rounds.json` 按最近秩 `ceil(n × .99)` 生成。

只改变现有判定指标的跨轮聚合方式，不扩大指标范围：`round.max` / `roundDepth.*.max` 仍仅报告；prefix 没有 D20 判定项。少于三轮不计算尾部中位数、不可能 pass；P95/墙钟两轮已越线时仍可提前标 regression。

同 gate 的三轮与 A/B 仍在同一个 runner 上，跨 shard 的 CPU/Node 补丁号可不同，禁止混入不同机器的绝对时延。零 OOS、输入/逐域/终态/双 RNG、稳定工作计数、完整槽位和身份校验不变。all/full 工作量改变时 timing 仅报告，正确性仍是硬门禁；可比 prefix 决定回归，但不替代完整 D20 测量。相同工作量的 all/full 仍参与判定。party/window/AI 拆轮 A/B 仍是 report-only，不套用 D6、不自动批准绝对预算。

脚本输出同时保留：

- `pairs`、`exceededRounds`：所有原逐轮指标与越线轮数，作为诊断；后者不再直接决定 v3。
- `sustainedExceededRounds`：仅 P95/墙钟越线轮数。
- `tailMedians`：每项尾部 A/B 中位数、差量、比例、阈值及是否越线；`tailExceeded` 为其中任一越线。
- `timingStatus` 与最终 `status`：保留工作量 report-only 覆盖及硬门禁优先级。

新测量由 `run-ext-perf-ab.mjs` / `merge-ext-perf-ab.mjs` 统一使用该策略。已有完整 aggregate 可只读复算：

```bash
node scripts/recalculate-ext-perf-ab.mjs ORIGINAL_RESULT_JSON NEW_OUTPUT_DIR
```

同时支持旧单目录和 `shards/` 聚合布局：核对 shard 原结果 SHA256、源码/工具/runner 身份、原始 summary/rounds/input，再补算 P99、判定；原硬门禁是已完成 run 的证据，不声称离线又执行了游戏回放。输出不生成/采纳新预算，不替代独立第四轮。缺失原始文件或身份不符则失败，不自动降为摘要模式。只有明确标注“留存指标重算”的历史分析可使用已有完整精度 pairs，且不能冒称原始硬门禁复验。
