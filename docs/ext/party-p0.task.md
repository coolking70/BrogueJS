# 小队 P0 任务书：单人假设审计与合同草案

> 分支 `ext/party-design`（基于 `ext/phase5` `769f6fc`）。依据：已批准设计 `docs/ext/party-multiplayer-design.md`（D-01～D-17 全部按推荐）。**只读审计 + 文档，不改代码、测试、数据，不 commit。**

## 范围
1. **单人假设审计**：枚举 `src/` 中所有直接或间接依赖“唯一玩家”的位置（`this.player`/`game.player`、`player` 参数、`isPlayer` 判定、玩家专属全局状态、UI 读取等），按设计 §5.1 分类 A 镜头/显示、B 全队共享、C 按成员、D 唯一主角语义；每类给出代表位置、迁移方式与风险。输出机器可读清单（JSON，放仓库外 `/private/tmp/party-p0/`）与文档内汇总表（按文件/子系统计数、预计改动量）。
2. **合同草案** `docs/ext/party-contract.md`：小队/成员/控制者/焦点数据结构；窗口推进与打断（§4）的精确语义、事件与错误码；窗口批次录像事件格式与摘要域归属；AI 托管 v1 接口；队长指令；按成员机制（背包、饥饿、状态、死亡、换层）的规则；零影响合同（经典与未启用小队）；版本计划。
3. **P1 拆分建议**：P1a–P1d 每步范围、验收、门禁、预计触碰的共享文件，以及与阶段 5（5C/5D/5E/5Z）的冲突评估与合并顺序。
4. **体积/性能预算**：4 人小队下窗口推进、AI 决策、摘要的预计成本，给出测量方法（P1 落地后再实测）。

## 交付
`docs/ext/party-p0.report.md`（审计结论与 P1 拆分）、`docs/ext/party-contract.md`。只读，不 commit。环境：Node 24.19.0 放 PATH 前，NODE_OPTIONS=--max-old-space-size=3072。
