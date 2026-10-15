# P0/P1 独立审查 R1

审查对象：`/Users/coolking70/Documents/同步空间/BrogueJS-p6` 相对 `1fe7ff81da9725fa4f0de3f555e100241503b183` 的未提交改动。日期：2026-10-15。未修改仓库文件，未 commit。原始独立证据在 `/private/tmp/perfrev1/`。

结论：**可合入（本轮限定审查范围）**。未发现新增阻断或重要问题，无需因本轮发现启动第 2 轮修复审查。唯一测试失败已独立确认为 HEAD 既有 foundation 向量过期。

## 优化与失效条件审查

| 范围 | 审查结果 |
| --- | --- |
| 光照批量占位 | 光源遍历/叠加顺序及 `bodyLightOrigin` 保持。索引遍历所有 footprint（含肢体），桶保留原列表顺序；查询时仍检查实际 footprint、ignore、HP、DYING/deathProcessed。现有调用范围仅同步视野、dance、安全图和寻路/游荡规划，移动/出生/死亡落地在作用域外；异常以 finally 清索引。未发现跨动作或跨层残留索引。 |
| 光图与几何缓存 | 完整输入包含原点、半径、矿灯/阴影策略、穿怪策略、RGB、fade 和逐谓词占位；实际 opacity/占位逐格复验，同回合变化不依赖回合号。几何记录 shadowcast 实际读过的阻挡格，复用前复验；同批次跳过复验还要求谓词身份一致。衰减模板另外检查精确 radius/fade。颜色顺序、截断、原点叠加保持。 |
| 扩展回滚与跨层 | 几何 pass 位于图外，单调递增，不随事务回滚到旧 pass；通道对象保持身份。显示缓冲被 checkpoint 引用时标记写时复制，嵌套 restore 分别恢复自己的引用和源列表。FOV/LoopMap 图外缓存读取恢复后的实际输入；flare 知识 scratch 每次先清空，未作为显示帧逃逸。Grid/LightMap/FOV 所有者隔离不同楼层。 |
| 视野与记忆 | 只复用纯几何 mask；可见性、透视、探索/记忆及属性失效仍每次发布。物品索引保首匹配，排除非整数/越界坐标，避免数字键别名。FOV 输入覆盖 origin/radius/全部 opacity；唯一生产消费者只读返回 mask。 |
| 寻路与 LoopMap | A* 数字键只用于有界整数起点，保留原堆平局和回调顺序，特殊起点回退字符串。LoopMap 根据实际通行位判断失效，返回副本避免外部写坏缓存；DFS 扫描顺序及 flood 的最终连通集合保持。 |
| 气体与营地结构 | scratch 每次清零/覆写；缓存读取组合旗标，GAS 换型和移除后更新对应旗标。有结构观察器时使用活旗标和独立体积数组，避免观察器/重入污染；无观察器时的普通空间 revision 通知不执行地形副作用。 |
| 晋升与 DF | 晋升第一趟仍按 x/y/layer 原序取骰，第二趟按第一趟标记的原序落地，未跳过记账趟。DF 只跳过当前未标记格，仍逐格读取实时 spawnMap，保留递归新增后续格和早退行为。 |
| GameCanvas | 移除的仅是自动 Pixi render 回调，模拟 ticker 保留。render flush、hover、布局、可见性恢复均置脏；投影切换、浮字、bolt/flare/terrain、幻觉 50ms 仍请求绘制，finally 覆盖暂停和面板分支。模块选格、身体悬停、镜头/resize 原路径保留。未发现确定的漏画路径。 |
| MessageJournal | 全量 folded logs 保留，100 条限制仅作用于当前页 DOM；页数缩小时夹紧页码，翻页不触发游戏命令，文案均走 i18n。未发现消息被丢弃或不可达。 |

## 独立验证

- `node scripts/check-module-boundaries.mjs`：通过。
- `node scripts/check-test-dependencies.mjs`：exit 0，`errors=[]`。
- `git diff --check`：通过。结构读者清单/守卫、U03 契约和旧摘要测试均无差量。
- 使用 Node 24.19.0、单 worker，运行作者相关清单的 41 个文件（完整清单见 `/private/tmp/ext-perf-p0p1/related-tests.txt`）：40 文件通过、1 文件因既有摘要向量失败；601 项通过、2 项跳过、1 项既有失败，实际 exit 1，总时长 678.40s。日志 `related.log`。
- 独立双 Vite SSR 探针同时加载候选代码与纯 HEAD 副本，确认两侧实现不同后逐值比较：80 轮变化地形/占位/光源的 light/FOV/LoopMap；40 轮连续气体更新；30 轮晋升和递归 DF；另有结构观察器改阻挡并重入同一气体管理器。世界、结果、掩码及适用的 RNG 状态全部相等。脚本 `kernels.mjs`，日志 `kernels.log`。Vite 打印了环境禁止监听 WebSocket 24678 的 EPERM，但 SSR 探针全部执行完并 exit 0，不作为浏览器验收。

## 摘要旧失败核实

已用 `git archive 1fe7ff8` 在 `/private/tmp/perfrev1/head` 建立纯 HEAD 副本，仅连接现有 node_modules，未回退或改写工作区文件。独立运行：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /private/tmp/perfrev1/head/node_modules/vitest/vitest.mjs run \
  --root /private/tmp/perfrev1/head src/test/ext_recording_v4_digest.test.ts \
  -t 'freezes tagged empty'
```

同样在第 160 行失败，实际 `54ba08909354cb6a47cba280b1a83fe3e893acfef4a8a70bfb15bf62fdb75b8a`，期望 `2a655762f01a6b8e0f9d7bfae71e83ba3102d0052b5b9229ca9ff7f9a823a707`。HEAD `src/ext/descriptor.ts` 的 foundation 为 16；测试独立 root 向量仍写 `[whole-run-v7,7,15,2]`。确为 HEAD 既有向量过期，不列为本轮回归，不宣称测试全绿。证据 `head-digest.log`。

## 测试差量裁决

四个 Canvas 旧测试的变更只补 `Application.render`、`ticker.remove` 或抽取闭包中的 `canvasDirty/pixiApp` 环境，原断言未删改、未放宽。已核对作者保留的旧测试反事实记录（新 Canvas 23 失败/23 通过，仅回退 Canvas 后 46/46 通过），本轮未重复这组反事实。其他测试差量为新增用例及其辅助 import/参数，不是修改旧期望；`ux_1e` 辅助函数默认仍沿用旧无 dimensions 布景，另加数字键对照。接受这些前提调整。

## 基准与门禁

- runner 从 loadReplay 原点执行完整 v4 命令，排空 advancement，逐条检查 replay cursor/OOS；生产 completeReplayEvent 同步重算 full 六域，未旁路 oracle。固定 Date.now 隔离动画墙钟，真实 performance.now 用于耗时；无零回合/换层/多回合/256/2048 边界删样。
- 紧凑路线包含完整命令和确认，重建通过真实命令并核对完整录像哈希，失败候选另存，不覆盖冻结 manifest。计数和语义阈值以三次一致结果冻结；缺样本/组合不能通过。
- 本轮重新执行原始 P0 与最终 P1 制品比较：classic 3,499,183 终态叶 + 2,280 域叶、all 3,396,652 终态叶 + 10,144 域叶，均 0 差异；两组合 budget check 通过。这里是独立重比较既有制品，不冒称本轮重放了 all。
- 当前 `git diff HEAD -- src` SHA-256 为 `d09bddf43a22c3f83bf5a5ce802025f66ef0c1db8573bd7b4777b026f3d77a5e`，与两组最终实测源码身份一致；两条 route/manifest/summary 的录像哈希一致。该源差量哈希不含未跟踪新增文件，新增内核测试另由本轮定向执行覆盖。
- 独立负向检查：缺组合、录像哈希变化、OOS=1、stateHash 变化、调用数增加、原零值 light.dance 变 1，全部 exit 1；放大时间仍 exit 0 并告警，符合当前 report-only 策略。脚本/结果见 `budget-negatives.py/.log`。17 项入口次数是工作量代理，不是所有内核操作数；当前绝对时间/GC 不硬拦合理，不能据此声称已达全场景性能目标。
- 本轮另行完整执行 classic 2,208 条命令：exit 0、0 OOS；与 P0 比较 3,499,183 个终态叶 + 2,280 个域叶全部相等，完整 semantic 和调用数预算通过。实际回放墙钟 20.61s，仅记录本次观测，不据单轮推断加速比。证据 `classic-replay.log`、`classic.summary.json`、`compare-fresh-classic.json`、`budget-fresh-classic.log`。all 的 budget 输入仍为作者最终制品，已明确区分。

## 范围限制

未运行全量、drift、build 或额外组合删除门禁；遵循本轮“相关测试 + boundary + 测试依赖检查”的限定。未做真实浏览器/GPU/手机验收。单种子 D20 最小基准、40 怪下限未满足、D22/D25/D28、16/64 居民/满结构和保存续录/seek 性能场景仍是报告明确列出的覆盖缺口，不能从本次通过外推。上述限制不构成本轮已证实的新缺陷。
