# 5D1 / 5G 即时语义集成

5D1 `f067e8968c76571c405b78b19d2c3da414160bfc` 已由父提交推送；指定5G `eda309443cdd57a4cad1ec92d2cd3c5da7230d34` 已在同一 `ext/phase5` 工作树语义集成，限定门禁及一次受影响复核已完成，**5G已集成待父提交**。执行者未commit/push，未合main。

按2026-10-09即时任务覆盖旧draft：只作一次集成门禁，失败只做一次最小修复及受影响复核；每开发步骤最多两轮审查→修复，剩余归5Z；只保存结果摘要，不另开代理/审查、浏览器或多版本封存。完整阶段门禁和性能留[5Z](phase5z-remainders.md)。

## 共享取舍与实际修复

- Game/runtime：保留5D1居民完整原生图事务、调度/需求/离层，纳入5G detached候选的独立simulationTicks作用域、嵌套继承与finally恢复，不先发布候选世界。保持foundation11/world5schema2/settlementrules1.1.0 state2、whole-run6/recording4/origin2。
- WorldWorkWorld：保留居民岗位容量预留/离层理由，公开节点只读投影再生且保留live CAS revision；错误读口和共享原子提交保持。
- Logger：唯一实际内容冲突是两侧同义disabled/非空ACK守卫；语义一致化，保留5D1原数组/消息行/队列对象身份回滚。没有整文件取侧。
- test-suites/发现：根测试取并集，保留模块自有发现、G runner环境长度修复和SDK导入白名单；新增居民/foraging联动测试在settlement自有清单登记，真实foraging未安装时按安装能力定义组合。App导入显式进入本批。
- 精确食用按healPoints、知识新增/升级才true、内容writer错误传播保持G修复；九冻结接口实际逐项核对不变，未改原规则data/locale。

R1：真实foraging+settlement下，招募removeOwnComponent/replaceState失败仍成功，解除资格setOwnComponent/replaceState失败不抛错，首次联动7项中4项因此红灯，另1项为新增测试漏归一savedAt，2项cached/pending日粮通过。最小修复仅在底座ActorNeeds的`resident-changed` attached/detached事件使用严格参与者提交，失败由原居民外层事务恢复；普通need/fire/feed降级语义保持。新增测试涵盖No纯读、Yes去行/组件、合法仍在场资格解除恢复、四类writer前后故障/完整图身份/合法重试、真实stairs缓存护送与真实pending fall的home日粮。严格路径及普通降级均在受影响三文件复核中通过。

## 必要格式捕获

已实测旧A/B和旧App正例受当前格式影响：2文件7项，2过5失败，失败发生于final摘要或39事件全等比较。按原captureNatural及真实App正常新局公开命令执行一次捕获，不手改header/digest。

- A seed2/149命令、B seed6/27命令：命令/决策、库存/知识/state逐字段不变，仅各自final.digest变更；普通机械断言保留。取消capture开关后由集成/实际drift验证。
- 原foundation10/39事件/39402字节文件SHA `f2a22fc3b3b7eb81ae68630c8f0c760ad83342b444bc780dc3f161b908daca9e`逐字保留作拒绝例。
- 新原始公开导出`src/test/fixtures/foraging-foundation11-import.json`：39事件/59162字节，SHA `97a81b4a70d8a5bf0a549e4be5eb11fb1ea1ec2e063e6233891c41e28324996e`。165个字段差异仅foundation头、world5/extensions域及根/链摘要和recordedAt，公开action/data/decisions与全部事件双RNG不变。新正例保留真实App导入、静默、seek39→0→39、存读/40事件续录；旧格式另加拒绝后完整投影、对象身份、双RNG、ID/日志保持断言。

捕获命令exit0，3项执行、5项名称过滤未选；仅计捕获，不能称普通门禁通过。外部只存命令/结果摘要，目录`/private/tmp/brogue-commander-20261008-5d1/phase5g-integration-immediate-evidence`。

## 一次集成门禁

Node24.19.0绝对PATH、3GiB；单批Vitest87文件、最多2workers，foraging/settlement自有非性能文件与五共享直接相关文件，含R-E01/SDK四问题、R1、两自然路线、App/Logger、保存/录像、源码守卫。随后重任务串行：boundary、vue-tsc、实际npm build、实际npm test:drift各一次。

| 命令/范围 | exit | 实际结果 | 秒 |
| --- | ---: | --- | ---: |
| R1首次联动（1 worker） | 1 | 1文件2过5失败：4个真实writer红灯，1个新增savedAt前提错误 | 15.771 |
| 原格式正例确认（1 worker） | 1 | 2文件2过5失败，版本投影影响已确认 | 8.041 |
| 一次原方法捕获（1 worker） | 0 | 3项执行，5项仅为名称过滤未选，不计普通门禁 | 16.231 |
| 单批集成（2 workers） | 1 | 87文件1916过3失败，0skip/todo | 1165.496 |
| 一次受影响复核（1 worker） | 0 | 3文件111通过、0失败/skip/todo | 106.447 |
| `node scripts/check-module-boundaries.mjs` | 0 | 边界/发现所有权通过 | 2.311 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 类型通过 | 8.694 |
| `npm run build` | 0 | 真实npm类型+构建通过，保留既有大chunk提示 | 11.856 |
| `npm run test:drift -- --maxWorkers=2 --reporter=json` | 0 | 实际6文件12通过、0失败/skip/todo（含普通A/B新正例） | 84.508 |

集成批次的3个失败均完成一次最小前提修正：新解除资格oracle在安装writer spy之前捕获函数身份，移动至安装后，完整图断言保持；旧settlement startup守卫漏列5D1已批准的6个seed，按当前definitions精确补齐库存全等期望，未改变任何生产定义。随后只重跑R1、settlement_boundaries及普通foraging_atomic三文件，全111通过；没有重复整批，没有调超时/加skip/放宽断言。首次exit1与复核exit0分开保留，111与1916有交叠，不累加。

87文件中的R-E01/SDK四问题、两居民自然路线/回放续录、App新正例/旧格式拒绝和Logger均已有通过结果。未运行完整npm/test:ext/128组合/删除矩阵/browser/正式性能。

## 剩余与交回

已复现的R1玩法半发布问题已修复并由真实联动回归关闭；当前无剩余已证实玩法/存档录像失败。初批退出1保留，不称整批一次全绿。浏览器、性能、原生失焦/真机及全阶段兜底按用户裁决留5Z。

代码冲突标记已清除，最终九冻结逐项一致，`git diff --check`结果见外部READY；`git add src/engine/Systems/Logger.ts`被文件系统沙箱拒绝，实际索引在主仓`BrogueJS/.git/worktrees/BrogueJS-p5/`，不在本执行者可写根。因此索引仍需父暂存解决，执行者不绕过沙箱、不提交推送。
