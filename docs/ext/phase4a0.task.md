# 4a0 任务书：通用空间底座一次迁移

> 分支 `ext/phase4`（已合入 `ext/foundation` 70a5e1d 内容扩充）。维护者 2026-10-05 授权实施 **4a0**。设计依据：`docs/ext/phase4-giants.md`（r3，已批准；决定见 §12），本步范围见 §14.2 表中 4a0 行与 §3、§11、§14.1。
> 并行情况：dot 正在 `ext/phase3` 做 3a1（只改 `src/ext/modules/combat/`），4a0 合入 `ext/foundation` 后 dot 才在其上做 3a0。因此 4a0 **必须提供阶段 3 需要的单格 facade**（phase3-combat.md §5.2 中 `spatialOf`/`nearestContact`/`canStepFootprint`/`collectBodyTargets` 的单格/隐式单成员群实现，签名以本设计为准，可调整但要在报告中列出最终签名）。

## 范围（只做这些）

1. **身份与 schema**：底座拥有的 shape（mask）/ pose / zone / group 身份与校验；Creature 可选 spatial 组件（普通 1×1 生物**不创建**该属性）；方形是预编译特例。尚未开放的能力（真实多格生产生物、复合体行动、命中区战斗、转换等）在创建、读档与命令预检中**明确拒绝**。
2. **占位 facade 与索引**：`footprintOf/creatureAtCell(policy)/distanceBetweenFootprints/nearestContact/canFitAt/canStepFootprint/planPlacement/commitPlacement/collectCreatureTargets(或 collectBodyTargets)`等（§3.2），三种目标键 entity/part/group（D08 默认表见 §6.1），活跃/休眠预留/死亡窗口策略区分。索引是派生缓存、不存档、按需懒建；无空间使用者时不建索引、不扫描。
3. **迁移全部位置写出口与占位查询**：按 §2.1/§2.2/§2.3 的审计，先建立实际调用点清单（每项标注“改 footprint / 保留单格坐标 / 仅改端口”），把生物位置写入改走统一提交原语，把“锚点等同整个身体”的碰撞/接触/距离/可见性推断改为 facade 查询。生产内容仍全部是单格生物，行为必须不变。
4. **持久化**：实体 codec 支持可选 spatial（缺席语义，不写出 `spatial: undefined`）、群表/区域的底座字段预留与严格校验、读档后重建索引。版本：本步是第一次底座空间格式落地，按 §11.1 升级 **实体/whole-run version 2→3、whole-run schema v2→v3、录像 version 2→3、foundation 3→4**（manifest.schema 仍 1）；阶段 3 之后按合入顺序再分配，不要预留给它。growth/narrative descriptor 的兼容声明随底座更新，模块自身规则版本不变。
5. **底座 fixture**：不依赖 giants 模块（giants 模块本步**不创建**）的测试 fixture，覆盖方形 2×2/3×3 与任意 mask（L 形缺角、十字、孔洞）的索引/查询/去重键、自重叠、死亡 DF 窗口、休眠策略差异、save/load 重建、未开放能力拒绝、clone 容器不共享。
6. **零影响差分**：**改代码前**先在当前基线用真实 Game 固定种子场景（新局、走路、战斗、击退/闪现/召唤/机关/换层、存读、录像）捕获完整机械对象图 + 消息 + 双 RNG 状态与调用数作为基线夹具（提交进测试 fixture，体量要克制）；迁移后比较一致（只排除版本标识、savedAt、明确派生缓存）。这是本步最重要的验收证据。

不做：正式大型敌人、giants 模块、场地生成、寻路体型图、渲染身体组、复合体调度、部位破坏、转换事务（这些属 4a 及以后）。

## 门禁（开发期功能测试政策，见设计 §14.1 r3）

- 必跑：`node scripts/check-module-boundaries.mjs`、`npx vue-tsc -b`、`npm run build`。
- 测试：新增的底座空间测试与零影响差分；被修改模块直接相关的既有测试（实体 codec/快照/录像、移动/放置/位移、战斗/弹道、时间推进、生成放置等，按实际改动挑选，可用 `npx vitest run <files>`）；相关组合（空/growth/narrative/两者）的真实 Game smoke（`scripts/check-module-composition-smoke.mjs --engine-only`）。
- **不跑**完整 `npm test`、全部 `test:ext`、removal 删除矩阵（收尾 4f 统一跑）。没有生成改动就不跑 drift。
- Node 24.19.0；`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。

## 交付

- 代码 + 测试 + `docs/ext/phase4a0.report.md`：调用点迁移清单摘要（分类计数与仍保留单格坐标的理由）、最终 facade 签名（供阶段 3 使用）、版本变化、实际运行的测试命令与结果（不把未跑的写成通过）、零影响差分的场景列表与结论、已知限制。
- 如果改动过大无法一次安全完成，可在一个干净的子里程碑停下（例如先完成 1、2、4、5、6 与部分写出口迁移，未迁移入口在能力开放前保持拒绝），在报告中说明剩余清单。不得留下“部分迁移但宣称完成”的状态。
- 浏览器验证由维护者侧执行，你不需要；但不要改变任何 UI 行为。
- **不要 commit**，完成后停下。
