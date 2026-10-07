# 5G owner-lookup 独立只读审查

审查日期：2026-10-07。工作树：`ext/phase5`，HEAD `3134f1df9b581e2bec9da78e647345bb7b58b144`。

结论：**无阻塞发现；未发现本补丁引入的 P1/P2/P3 真实缺陷，未提出需修复的测试缺口或样式建议。** 实现符合本次五种定义列表 owner 查询范围。以下区分源码实查、独立运行、执行方历史证据与未覆盖项，不将它们合称为全量验收。

已读取 AGENTS.md、项目交接/开发/架构文档及本任务要求的五份扩展文档。审查包括完整工作树 diff 和未跟踪的 `WorldWorkOwner.ts`。本进程仅新增本报告，未修改代码、测试、任务书或执行报告，未 commit/push；没有创建临时探针，无临时探针待清理。

## 逐项实查

| 项目 | 源码位置与结论 |
| --- | --- |
| 五列表查询 | `src/engine/Core/WorldWorkOwner.ts:6–8` 对 items/resourceNodes/stations/recipes/edibleItems 的实际定义 owner 做存在性查询；缺省 edibleItems 当作空列表，不按 ID 前缀猜 owner，不修改包或 RNG。五列表均空或 owner 不存在时返回 false。 |
| 注册与校验前提 | `src/ext/registry.ts:10–16,55–63` 拒绝重复模块注册、核验工厂身份，并在创建时调用 `validateWorldModule`。`src/engine/Core/WorldDefinitions.ts:44–50,222–227` 要求四个基础数组存在、允许为空、每行 owner 等于模块 ID，再克隆并深冻结包。`src/engine/Core/EdibleDefinitions.ts:53–76` 对 edible 定义也要求同 owner、合法命名空间及唯一 ID。`src/ext/runtime.ts:245,1669` 使用这些已校验模块提供包，因此 helper 所依赖的同包同 owner 前提成立。 |
| 合法空 items 包边界 | `WorldDefinitions.ts:67–79,107–114` 允许 node yield 引用 edibleItems；`147–171` 的 station placementCost 和 recipe inputs/outputs 仍要求非空、引用本包普通 items。测试将 stations/recipes 切片用于查询单元输入，同时断言其不是合法可注册内容；没有通过放宽定义校验制造合法包。 |
| terminal tickets | `src/engine/Core/WorldWorkValidation.ts:26–37` 查询包后仍按 craft/harvest/station 选对应列表，并同时匹配 definitionId 和 owner。新增 owner 识别不会让 edible ID 冒充节点/配方/工位。 |
| work facts | 同文件 `191–268` 保留事实序号、上限、操作/结果值、定义类别与 owner、票据关联、tick 等校验。owner 的两次查询均已更新；独立 facts 不再依赖 items 非空。terminal ledger 中找不到票据时仍要求合法定义，既有独立保留语义没有放宽。 |
| active tickets | 同文件 `270–339` 仅替换包查询；kind 对应的定义查询、工作细节、actor、预留、托管与时钟引用不变。此处定义查找只显式匹配 ID，但注册阶段已强制同包同 owner，不能据此认定跨 owner 漏检。仅 edibleItems 的包虽然现在能被找到，其三个工作定义列表仍为空，伪造工作票据仍在 `284` 行被拒绝。 |
| 投影 | `src/engine/Core/WorldWorkWorld.ts:704–731` 仍要求 world5 与可识别 owner 才发只读 SDK；仅 edibleItems 的合法包现在能得到投影。`src/ext/runtime.ts:1747` 将真实端口传给 module.projectView。未知 owner 无 SDK，未知模块无投影。 |
| 同类查询与最小范围 | `WorldWorkWorld.ts:60–71` 的 worldPack 原本已有所需列表，并另服务 actorNeeds/structures/restPoints；无需缩窄为新 helper。`WorldWorkPlacement.ts:39–45,145–155` 的节点放置与 startup 路径不因本修复遗漏合法节点或 startupItems。生产修改仅两个既有文件的五处查询及 import，加一个 9 行内部 helper；未触碰生成、命令提交、状态格式或生产模块。 |

## 回归有效性

- `src/test/ext_world_work_sdk_contract.test.ts:257–286` 按五个列表分别构造输入，调用真实 `worldWorkReadSDK` 并断言固定 owner/SDK 结果及缺失 owner；没有复制 helper 表达式作为期望。非法包切片、外来 owner、非法命名空间定义仍经真实包校验器拒绝。
- `src/test/ext_edible_runtime.test.ts:435–454` 经公开 fixture 命令放置节点，再经公开 harvest 命令采集；明确要求产物数量为 1、活跃票据清空、一个 completed 终端票据，以及 accepted/completed 两个事实。不是直接塞入“预期终局”后只比较 digest。
- 同文件 `456–492` 保存采集后独立取下的票据/facts/投影期望，依次验证存读、逐条 replay、seek 到采集前后及读档 wait 续录。`src/ext/testing/worldHarness.ts:51–69,88–121` 确实调用 Game.executeCommand/toSaveSnapshot/loadSnapshot/exportRecording/loadReplay/replayStep/replaySeek，没有 mock 这些路径。`Game.ts:11431,11605` 在保存与候选加载时均执行受审引用校验。
- 续录前缀只剔除导出时会重建的 fullCheckpoint/chainDigest，仍比较命令与增量检查点，并对续录录像实际零 OOS 回放及最终完整 digest 作断言。状态对比虽使用共同快照代码，但配合明确业务不变量和旧生产反事实，不是共享 owner 实现自证。
- 同文件 `493–508` 使用真实注册的仅 edibleItems 包读取 module view，检查未知 owner、存档与双 RNG 不变，并读档后再查投影。`509–533` 的负向测试先确认合法基线；facts 测试移除 terminal ledger 后再单独污染 owner/definition，避免仅由前一层 terminal 校验代挡；另有合法独立 facts 正向保存测试。
- 修改过的两个测试文件全部是追加内容；没有改旧断言、夹具前提、超时或 skip。现有 crafting 活跃多批票据存读/回放/seek/续录见 `src/ext/modules/crafting/tests/crafting_persistence.test.ts:9–43`，本次独立复跑也通过。

## 反事实、门禁与输入核验

逐份读取 `/private/tmp/brogue-commander-20261007/owner-evidence/` 的 run.py、counterfactual.py、counterfactual-inputs.json、原始日志和退出码 JSON，而非仅采信报告摘要。

反事实脚本只以 HEAD 字节替换两个受审既有生产文件，测试不变，finally 恢复生产文件。新 helper 留在磁盘但旧生产文件未导入它。原始 counterfactual.log 为 **11 failed / 52 passed，退出码 1**：四个非 items owner 查询返回 undefined；投影返回 null；合法终端票据报 `terminal definition`；独立 facts 报 `workFact`。没有 import/注册失败。测试前后 SHA 相等，且本次独立计算的当前测试 SHA 与该记录一致；没有重执行会写受审文件的反事实脚本。

| 执行方原始证据 | 实际结果 |
| --- | --- |
| focused.log/json | 初次新增测试 59 passed / 3 failed，exit 1，36.049 秒；未隐去失败。 |
| focused-fixed.log/json | 两文件 62 passed，exit 0，36.631 秒；之后追加独立 facts 用例，最终两文件为 63 项。 |
| counterfactual.log/json | 两文件 52 passed / 11 failed，exit 1，33.826 秒；外层恢复脚本结束不代表测试成功。 |
| related.log/json | 报告列出的完整相关命令实际 15 文件 / 242 passed，exit 0，198.624 秒。 |
| boundary.log/json | Module boundaries and test ownership verified，exit 0，2.484 秒。 |
| final-types.log/json | npx vue-tsc -b，exit 0，10.353 秒。 |
| build.log/json | npm run build，类型检查及 Vite 构建完成，exit 0，18.085 秒；保留大 chunk 提示。 |

本进程独立执行以下定向命令，先核实 `node --version` 为 v24.19.0；PATH 前置要求的 runtime bin，NODE_OPTIONS 为 `--max-old-space-size=3072`：

```bash
node node_modules/vitest/vitest.mjs run src/test/ext_world_work_sdk_contract.test.ts src/test/ext_edible_runtime.test.ts src/ext/modules/crafting/tests/crafting_persistence.test.ts src/ext/modules/crafting/tests/crafting_sdk_integration.test.ts --maxWorkers=2 --no-cache --configLoader=runner
```

独立结果：**4 文件 / 73 passed，exit 0，Vitest Duration 45.80 秒，无 failed/skipped/todo**。关闭缓存并使用 runner 配置加载，未重做类型构建产物。CE 缓存缺失提示存在，所选用例无 CE 跳过。`git diff --check` 也通过。

独立重新散列全部 src/scripts/public 文件：1114 文件，树 SHA-256 为 `d1a57bf1c25923f9d41fb7462c2e6f1f9f7d979e9d07d70f010fe1b86b602b79`，逐文件表与 final-inputs.json 完全相同。八个冻结文件（worldSdk、edibleSdk、worldEdible、kindKnowledge、actorNeeds、stats、forageHarness、forageFixture/index）逐字节等于 HEAD，实际 SHA 同时符合 frozen-sha.json 和 `docs/ext/phase5a4.report.md:230–237`。版本定义文件无 diff；foundation 10、whole-run 6、recording 4、origin 2、worldSdk 1 及生产模块版本保持原值。

## 未覆盖项与结论边界

- 本进程未独立重跑执行方全部 242 项、boundary/types/build；这些结果为已核对原始输出和当前输入的历史执行证据，独立重跑仅为上列 73 项。
- 新空 items 采集场景在单次命令内完成，没有新增“空 items 长耗时活跃票据”的完整存读矩阵；active tickets 的本次变更按注册前提和定义分支逐行核实，非空 items 活跃工作由既有 crafting 回归覆盖。此限制未显示生产缺陷，不列为阻塞项。
- 非法 owner/definition 新测试直接调用保存/加载共用校验器，没有逐个经过损坏 JSON 的 loadSnapshot 外层；外层接线已实查。本轮不宣称完成任意坏档模糊测试。
- 未运行完整 npm test、全部 test:ext、drift、组合/物理删除矩阵、浏览器或生产 foraging 集成；未将中性 fixture 结果等同于自然完整采食产品验收。上述范围符合本次只读审查授权与任务书门禁限制。

无需针对本补丁提出修复项。后续提交、派发基线重建及 5Z 验收仍由指挥进程处理。
