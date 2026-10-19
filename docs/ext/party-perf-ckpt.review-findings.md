# checkpointCombatFactWorld 独立审查（一轮）

日期：2026-10-19。基准：`ba360b4b7a31868b09d7c92a0debf7f083a9ea10`；候选：当前未提交工作区。

**结论：需修。** 以本轮要求的“跨层与失败回滚完整性”为验收标准，当前候选仍有下面两项确证问题。**两项均在真实 ba360b4 生产源码上复现，是基线遗留，不能归因于本次性能优化。** 本次属性捕获表示变更本身未发现新增语义差异；如果只裁决性能差量是否引入回归，现有证据没有发现阻断，但不能据此宣称跨层失败回滚完整。

## F1：首次跨层晚失败没有恢复生成元数据，重试永久拒绝

位置：`src/engine/Core/Game.ts:735`、`:751`、`:4638`、`:4659`。

`commitPartyControl` 用 `checkpointCombatFactWorld` 包住整次换层；`generateDepth` 的内层生成事务成功后，后续 `enteredLevel` 仍可能失败。外层捕获根没有覆盖 `levelSeeds`、`meteredItems` 的原地生成写入，内层成功事务的快照此时也不再回滚。

复现：seed42、wizard、party 两人，将主成员布景到 D1 下楼梯；通过 `executeCommand('party:control', … travel-party destination D2, leavingBehind=[副成员ID])` 进入新层。在原 `runtime.emit('enteredLevel', …)` 执行后抛出一次异常。捕获边界的独立全对象图审计得到 **13 处残留**：9 处 `meteredItems` 的 frequency/numberSpawned，另有 D2 visited/上下楼梯位置及 D3 上楼梯位置。返回缓存层的同类晚失败则完全恢复。

去掉注入后重试，实际结果：

```json
{"errors":["Error: review-first-entry-failure","Error: Visited level state is unavailable"],"depth":1,"d2Visited":true,"d2Cached":false,"seedsEqual":false,"meteredEqual":false}
```

应将外层跨层事务的捕获/恢复范围与实际生成写集对齐，或保持生成与后续成员发布的原子性；不能通过放松 visited/cache 守卫掩盖不一致。

## F2：party + combat 正常首次跨层在 enteredLevel 发布阶段失败

位置：`src/engine/Core/Game.ts:2159`、`:4657`；`src/ext/runtime.ts:636`；`src/ext/modules/combat/bonfires.ts:70`。

最小场景只有 `['party','combat']`，seed42、wizard、默认两人。主成员置于 D1 下楼梯，使用上述公开 party control 命令留副成员在 D1，进入 D2。**没有失败注入，也不安装 body fixture**，命令直接抛出 `World placement outside committed level entry`。

party 的 `enteredLevel` 被延后到 `generateDepth` 返回之后；此时生成发布上下文已结束，而 combat 篝火进入钩子仍调用要求 `publishingGeneration` 的 `placeInteractables`。失败随后触发 F1，第二次下楼变为 `Visited level state is unavailable`。应修正钩子的事务/发布时序，保持 capability 守卫。

## 复现与归因证据

全部临时文件在 `/private/tmp/ckptrev/`，没有向仓库添加探针。

```bash
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
# 仓库根执行：6 项正确性断言，候选与基线均为 4 过 / 2 败。
node node_modules/vitest/vitest.mjs run rollback.test.ts --config /private/tmp/ckptrev/probe/vitest.config.mjs
node node_modules/vitest/vitest.mjs run rollback.test.ts --config /private/tmp/ckptrev/baseline/vitest.config.mjs
# 诊断重试后果：2 项通过表示确证上述错误及二次拒绝，不表示正确性通过。
node node_modules/vitest/vitest.mjs run retry.test.ts --config /private/tmp/ckptrev/probe/vitest.config.mjs
node node_modules/vitest/vitest.mjs run retry.test.ts --config /private/tmp/ckptrev/baseline/vitest.config.mjs
```

- 最终正确性探针：`probes-final.log/json`、`probes-baseline.log/json`。两边相同的 F1/F2；候选肢体 phase/split 的嵌套晚失败/重试、缓存楼层回滚、非主成员营地建设刷新后的回滚均通过。
- 基线由 `git archive ba360b4 src` 导出，1512 个 src 文件逐 Git blob 核验。唯一覆盖是本次已修正的 `src/test/support/committedBodyTransitions.ts` 测试 helper，避免其既有 registry identity 问题阻断肢体布景；**没有覆盖任何基线生产文件**。见 `baseline-source-audit.json`。F1/F2 最小重试探针不依赖这个 helper。
- `retry-probe-false.json`、`retry-probe-true.json` 及对应 `retry-baseline-*.json` 保存完整后果；两边一致。`retry-*-evidence.log` 均 exit0。
- 初版探针 `probes.log/json` 为 2 过 / 3 败：肢体探针准备跨层时先碰到 F2，另有 F1。保留原失败；最终将肢体布景留在当前层，独立测试跨层，没有绕过生产守卫。强制旧捕获表示的单变量结果也保留于 `probes-old-initial.log/json`。

## 已通过的审查范围

1. **表示与失效**：实际改动不是跨动作缓存或增量写集，而是每个非 pooled party 保存点重新完整遍历，把普通数据属性压缩成 key/value 数组，特殊 flags/accessor 保留 descriptor。未增加跨事务生命周期，无需新增缓存失效协议；原 pooled capture 优先、seal 及独立保存点保持。循环/别名、符号、稀疏数组、typed bytes、Map/Set、引用/shallow 截断与嵌套/重复恢复测试通过，捕获不执行 getter。
2. **本轮独立门禁**：相关 **23 文件 / 395 项全部通过，0 失败、0 skip/todo，exit0，792.26s**。清单/精确命令见 `selected-tests.txt`、`commands.json`，结果见 `related.log`、`results.json`。包含非主成员单步与窗口原生动作后注入失败、窗口保留此前已接受前缀、成员动作/环境/占位/生命周期、营地/扩展、跨层成功路径及生产 Worker 边界 255/256/257/2047/2048/2049 的存读、seek、续录。
3. **boundary / 依赖**：`node scripts/check-module-boundaries.mjs` exit0；`node scripts/check-test-dependencies.mjs` exit0，694 文件，`errors=[]`。没有运行全量 npm test/full/gen/drift、build、云端或浏览器。
4. **回放与无 party 字节**：本轮 `party_checkpoint` 的 save/load、续录、seed replay、前后 seek 比较七域/root/双 RNG 通过；原 `ext_party_inert` 五配置 save/recording/Game keys/RNG/messages 固定夹具通过，未重录。无 party 仍使用原算法。
5. **作者配对证据的独立核验（不是本轮新跑性能）**：两条 2049 输入路线的输入、逐步工作量、双 RNG、七域/root、末态与零 OOS 一致；完整 save/recording 仅归一化 savedAt/recordedAt 后相等；42 对交替窗口的前后摘要、收据、双流与捕获数一致。A/B 各 1512 个 src 路径及最终生产文件散列已核对，见 `source-audit.json`、`evidence-audit.json`。连续混合窗口路线的反向性能结果仍须保留，不能称全面性能通过。
6. **旧测试 helper**：只保留未修改模块原 descriptor/configuration-aware factory；未改断言、身份守卫或容差。作者保留的基线/只回退生产文件日志均在原 identity 检查处失败，支持既有夹具缺陷归因。

本轮未修改实现、测试、守卫或夹具，未 commit/push；审查前后记录的 3259 个既有文件内容不变。仅按用户要求新增本结论文件及仓内副本。已有未跟踪 `scripts/.party-ckpt-micro.mjs` 未运行、未修改，不作为证据。
