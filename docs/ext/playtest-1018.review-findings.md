# 1018 试玩修复独立审查（仅一轮）

**结论：可合入。** 本轮未发现由这些改动引入的阻断或重要正确性问题；限定范围内，同版本存读、回放、seek、续录及原生自动行动回归通过。

审查基准：`0e684d100146af38b1e2056811fef821001f7555`，包括未跟踪的试玩报告和 `loot_auto_pickup.test.ts`。已读 AGENTS.md、HANDOFF、development、architecture 与试玩报告。本轮未编辑仓库文件，未 commit；脚本、日志及此结论均在 `/private/tmp/`。没有运行全量、drift、生成普查、类型、构建或浏览器验收。

## 核查结论

- **探索、旅行与拾取过滤正确衔接。** `Game.ts:14515` 的探索目标与 `15273` 的移动拾取均查询实际 runtime 策略，且保留原生 `ITEM_PLAYER_AVOIDS`。`5477` 的自动行动停止判断跳过过滤物品。过滤不写永久 avoids，手动 `pickup` 仍绕过过滤；同格第一件被过滤时可选择后面的合格物品。满包置 avoids、金币容量例外及开关都有实际回归覆盖。
- **原生行为保持。** 无 loot 时，在已安装模块中没有其他 itemPickup 提供者，因此新增查询返回 true；classic 没有 runtime 时也保持原分支。原生自动旅行 38 项及物品回归通过，包括发现敌人/钥匙/楼梯、中断、避免拾取物品、满包和相应录制回放。原生“经过 avoids 物品仍停步”的既有行为没有被顺带改变（`x3_u8b_items.test.ts:121` 明确保留此预期），不作为本次新增缺陷。
- **麻痹修复只减少重复 MORE。** `Game.ts:13143` 在应用状态前读取是否已麻痹；`Logger.ts:273` 只阻止持续刷新产生新的显示 occurrence，归档、机械消息证据和 disturbed 路径不变。对照本机 CE `Time.c:470–493`，只在进入麻痹时提示符合其执行路径。普通重复警告、陷阱、受击、死亡相关测试均通过；动画开/关各有真实时间线测试。
- **版本与确定性处理恰当。** loot module、rules 和派生 fingerprint 随常量升级到 0.9.1。涉及探索路线改变的旧 loot 0.9.0 录像明确拒绝，没有静默沿用旧检查点。无新增 Game 字段、命令入口绕过或 RNG 调用。UI 文案走 i18n；版本预期及五项 UI 快照只改了对应前提/帮助段落，作者登记的单变量反事实日志已检查，未见放宽断言或改生成基线。

## 独立执行的证据

1. **相关测试单批：exit 0，13 文件、289/289 项通过，117.05 秒。**
   日志：`/private/tmp/playrev/related.log`。
   命令：`npx vitest run <下列文件> --maxWorkers=1`。
   - `src/ext/modules/loot/tests/`：`loot_auto_pickup.test.ts`、`loot_integration.test.ts`、`loot_commands_integration.test.ts`、`loot_ui_components.test.ts`、`loot_ui_i18n.test.ts`、`loot_inert.test.ts`。
   - `src/test/`：`presentation_timeline.test.ts`、`x3_u8a_forced_turns.test.ts`、`x3_u8b_items.test.ts`、`x3_u6_messages.test.ts`、`ux_1a_end_ui.test.ts`、`ext_foundation_boundary_audit.test.ts`、`x3_u4_auto_travel.test.ts`。
2. **boundary、测试归属及依赖检查：exit 0。** 执行 `npm run check:modules`；输出 `Module boundaries and test ownership verified.`，依赖报告 `errors: []`。日志：`/private/tmp/playrev/boundary-dependencies.log`。`git diff --check` 亦通过。
3. **麻痹单变量旧录像复验：exit 0。** 复用并审读作者探针，以 Vite 只读 load 插件加载 HEAD 拾取/版本代码、叠加本次麻痹修复；440/440、零 OOS，回合454/HP36。恢复第438条后的真实快照，再执行第439条，实际只需1次MORE，最终无麻痹，时间线 pendingEvents=0、captureFailures=0。日志：`/private/tmp/playrev/paralysis-only.log`。这证明麻痹呈现改动不破坏旧机械证据，不声称正式新版接受旧 loot 录像。
4. **正式新版录像复验：exit 0。** 正式代码拒绝原0.9.0；将原440条输入作为新局输入原生录制，得到440条新录像，回合284/HP36；完整回放及 seek 85→440 均零OOS。日志：`/private/tmp/playrev/current.log`；新录像写入本轮独立路径 `/private/tmp/playrev/current-recording.json`，未覆盖原件或作者录像。
5. **七种组合的定向自动探索烟测：exit 0，7/7 通过。** classic全关、loot、growth+loot、growth、八模块全开、全开减loot、全开减growth；seed439559475，每种执行48次探索/自动步进输入，含loot的中途通过正式命令切换过滤。检查同版本save/load摘要相等、完整回放摘要相等、seek中点/终点、读档后续录一条再回放，全部通过。实际事件数分别48/50/51/49/51/49/50，包含初始化与过滤命令。脚本/日志：`/private/tmp/playrev/combinations.mjs`、`combinations.log`。这是本轮限定烟测，不等同历史七组合完整发布门禁或长局性能验收。
6. **三个组合的受控过滤布景：exit 0，3/3 通过。** loot、growth+loot、八模块全开；走廊(10,10)起步，普通过滤装备(11,10)、合格戒指(14,10)。验证探索直接以14格为目标、规划不消耗RNG、探索和鼠标旅行均跨过11格继续前进并拾取14格物品、不可见但记忆中的过滤物品不再吸引探索。脚本/日志：`/private/tmp/playrev/filtered-travel-final.mjs`、`filtered-travel-final.log`。

## 诊断过程与范围限制

受控布景探针首版还试图存读直接清空怪物/物品、替换地形后的世界，在 `loadSnapshot(cut)` 失败（exit1，`filtered-travel.log`）。进一步确认：尚未执行探索命令的初始布景就不能载入；只用HEAD的Game.ts替代工作区Game.ts也出现相同拒载，且全开组合的布景序列化直接报 `C5_BAD_REFERENCE: resident.source.actor`。原始与诊断日志均保留（`filtered-travel-diagnostic.log`、`fixture-head-check.log`，后者exit1）。因此该不完整布景不用于持久化裁决；最终受控探针只验证过滤/旅行，持久化结论来自上述自然生成的七组合以及正式集成测试。没有修改生产代码或仓库测试来消除这个失败。

SSR 探针有 Vite WebSocket监听EPERM提示，但模块加载、断言与回放均正常完成；相关测试有 Node localstorage 参数提示。未据此声称完成浏览器绘制或真机验收。

审查前后 tracked diff SHA-256 均为 `ed46c656ca34b1070aee70bf863184639584f5157c3def14e1ebfec49bbc5a14`；新增测试及报告哈希也保持不变。没有剩余需附复现的阻断/重要生产问题。
