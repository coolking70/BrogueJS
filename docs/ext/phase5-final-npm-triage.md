# 新政策最终 npm 门禁失败初分类

核对时间：2026-10-13T20:30:32+08:00。当前ext仍运行，未修改候选或重跑测试；此为npm已结束部分，非整批验收。

源码：a15c980+集成/政策差量，SHA256 `fb8be72f22f7bf43272de36a889ba3eec4dbeb72d1356d1fc2a12d0cee20c086`，前后相同。完整发现核对通过；npm exit1，耗时30462.958秒。11259通过 / 99失败 / 9真实skip / 5todo / 0已报告unhandled。文本文件计数29失败、582通过、1跳过（612）；5个空套件错误额外于99条用例失败，不混加。

## 分类边界

确证的是测试清理缺陷与日志症状；尚不能把全部行为失败裁定为生产缺陷或过时前提。N2性能豁免与内容豁免分别记账。其它超时不自动豁免。未重复性能探针、未改变断言或黄金。

- 其它超时，根因未定：11项。
- 测试扫描前提：2项。
- 行为失败，生产缺陷/测试前提尚未区分：79项。
- 测试夹具初始化缺口：3项。
- 已批准内容缺口：2项。
- 已批准N2性能调查：1项。
- 测试清单前提：1项。
- 另有5个确证空套件清理错误。

## 空套件错误（不属于99条失败）

- `src/test/u_13_combat_math.test.ts`：No test found in suite，移除CE用例后遗留空套件。
- `src/test/u_19a_machine_view.test.ts`：No test found in suite，移除CE用例后遗留空套件。
- `src/test/x2e_charms.test.ts`：No test found in suite，移除CE用例后遗留空套件。
- `src/test/x2o_horde_clump.test.ts`：No test found in suite，移除CE用例后遗留空套件。
- `src/test/x4_r1_world_catalog.test.ts`：No test found in suite，移除CE用例后遗留空套件。

## 逐项台账（全部99条）

### NPM-001 · 其它超时，根因未定
- 文件：`src/test/blueprint_center.test.ts`
- 用例：蓝图宝藏落点（machine center）可通行性 b) 全局扫描（45 seeds × D1..D26）：房间 center 可通行、区域 origin 属于 interior（CE8 空域单独验证）
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-002 · 测试扫描前提
- 文件：`src/test/c_4a_0_layer_model.test.ts`
- 用例：C-4a-0 留痕（本轮明确不做的事，断言现状） 留痕（已反转，C-4b）：setTerrainLayer 调用点只出现在清单许可的文件
- 证据：AssertionError: setTerrainLayer 调用点超出许可清单 engine/Generator/Architect.ts, engine/Map/DungeonFeature.ts, engine/Map/Promotion.ts, engine/Map/AutoGenerator.ts, engine/Map/WallDoorFinish.ts, engine/Generator/BlueprintEngine.ts：
- 归类与影响：生产扫描守卫把ext/modules/*/tests纳入：实际报错指向测试/测试helper，需修扫描边界，保生产守卫语义。

### NPM-003 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q5 answer false matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-004 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q5 answer true matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-005 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q6 answer false matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-006 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q6 answer true matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-007 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q8 answer false matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-008 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q8 answer true matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-009 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q9 answer false matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-010 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q9 answer true matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-011 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q10 answer false matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-012 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 Q1–Q10 use the actual command boundary and resume original suffixes Q10 answer true matches the synchronous world and replays without Host/OOS
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-013 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts sword keeps hitList and acid→ally question cursor; No on second question never attacks
- 证据：AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-014 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts whip keeps hitList and acid→ally question cursor; No on second question never attacks
- 证据：AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-015 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts spear keeps hitList and acid→ally question cursor; No on second question never attacks
- 证据：AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-016 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts axe keeps hitList and acid→ally question cursor; No on second question never attacks
- 证据：AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion. You can use an array, a map, an object, a set, a string, or a weakset instead of a string
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-017 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts whip executes the frozen multi-target list once after both approvals
- 证据：TypeError: Cannot read properties of null (reading 'token')
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-018 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts spear executes the frozen multi-target list once after both approvals
- 证据：TypeError: Cannot read properties of null (reading 'token')
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-019 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts axe executes the frozen multi-target list once after both approvals
- 证据：TypeError: Cannot read properties of null (reading 'token')
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-020 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts keeps chasm→fire→gas→plate risk chain; refuse at position 1
- 证据：AssertionError: expected [ true ] to have a length of 2 but got 1
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-021 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts keeps chasm→fire→gas→plate risk chain; refuse at position 2
- 证据：AssertionError: expected [ true ] to have a length of 3 but got 1
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-022 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts keeps chasm→fire→gas→plate risk chain; refuse at position 3
- 证据：AssertionError: expected [ true ] to have a length of 4 but got 1
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-023 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts keeps chasm→fire→gas→plate risk chain; refuse at position 4
- 证据：AssertionError: expected [ true ] to have a length of 4 but got 1
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-024 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts auto_step restores only its selected step and releases Logger scope, answer false
- 证据：AssertionError: expected false to be true // Object.is equality
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-025 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts auto_step restores only its selected step and releases Logger scope, answer true
- 证据：AssertionError: expected false to be true // Object.is equality
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-026 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts auto_explore restores combat blocking only while resuming, answer false
- 证据：AssertionError: expected false to be true // Object.is equality
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-027 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts auto_explore restores combat blocking only while resuming, answer true
- 证据：AssertionError: expected false to be true // Object.is equality
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-028 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 multi-question, geometry, automatic scope and prefix contracts P1 stale seize clearing and P3 throw exit survive refusal without repeating the prefix
- 证据：TypeError: Cannot read properties of null (reading 'token')
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-029 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/dialog_continuations.test.ts`
- 用例：D2 asynchronous lifecycle, save/export and resolver contracts invalidates changed hit-list without charging or a replacement approval
- 证据：TypeError: Cannot read properties of null (reading 'token')
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-030 · 其它超时，根因未定
- 文件：`src/test/ext_module_composition.test.ts`
- 用例：EXT-2a0 installed module combinations opens, plays, saves, loads, replays, seeks and continues crafting+narrative+settlement
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-031 · 其它超时，根因未定
- 文件：`src/test/ext_module_composition.test.ts`
- 用例：EXT-2a0 installed module combinations opens, plays, saves, loads, replays, seeks and continues foraging+giants+narrative+settlement
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-032 · 其它超时，根因未定
- 文件：`src/test/ext_module_composition.test.ts`
- 用例：EXT-2a0 installed module combinations opens, plays, saves, loads, replays, seeks and continues combat+crafting+foraging+giants+narrative+settlement
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-033 · 其它超时，根因未定
- 文件：`src/test/ext_module_composition.test.ts`
- 用例：EXT-2a0 installed module combinations opens, plays, saves, loads, replays, seeks and continues combat+crafting+foraging+giants+growth+narrative+settlement
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-034 · 测试扫描前提
- 文件：`src/test/p2_0_seeded_rng.test.ts`
- 用例：P2-0 守卫: 生产代码不得再出现未播种随机源 src/ 下（测试除外）没有任何 Math.random( 调用
- 证据：AssertionError: expected [ Array(1) ] to deeply equal []
- 归类与影响：生产扫描守卫把ext/modules/*/tests纳入：实际报错指向测试/测试helper，需修扫描边界，保生产守卫语义。

### NPM-035 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/p4_7_player_weapon_geometry.test.ts`
- 用例：P4-7 玩家矛（ITEM_ATTACKS_PENETRATE） 对抗性【攻击顺序写成正序】：CE Movement.c:1005-1009 人为倒序攻击（先远后近）—— 两个 1 HP 敌人（贴脸 + 2 格外）都被刺死，但日志里远处目标的命中消息必须在前；正序实现的消息顺序相反。
- 证据：AssertionError: expected -1 to be greater than or equal to 0
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-036 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/phase4a0_spatial_differential.test.ts`
- 用例：4a0 no-capability full-graph baseline exact pre-migration graph: narrative
- 证据：AssertionError: expected { …(13) } to deeply equal { …(13) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-037 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/phase4a0_spatial_differential.test.ts`
- 用例：4a0 no-capability full-graph baseline exact pre-migration graph: growth+narrative
- 证据：AssertionError: expected { …(13) } to deeply equal { …(13) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-038 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/slaying_melee_autohit.test.ts`
- 用例：slaying command and inspection integration examine cycle shows the same hit probability without consuming RNG
- 证据：TypeError: Cannot read properties of null (reading 'sections')
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-039 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/u_02a_rng_snapshot.test.ts`
- 用例：U02a game save → JSON → fresh load → continuation combat checkpoint 0: 12 steps match every snapshot field and both RNG streams
- 证据：AssertionError: expected { depth: 1, width: 79, …(40) } to deeply equal { depth: 1, width: 79, …(40) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-040 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection opens the monster detail with no world, turn, recording or RNG change
- 证据：AssertionError: expected null to be truthy
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-041 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection opens the item detail with no world, turn, recording or RNG change
- 证据：AssertionError: expected null to be truthy
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-042 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection opens the terrain detail with no world, turn, recording or RNG change
- 证据：AssertionError: expected null to be truthy
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-043 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection connects App sidebar/immersive entities to the existing detail overlay and restores focus on pointer close (immersive=false)
- 证据：AssertionError: expected undefined to be defined
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-044 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection connects App sidebar/immersive entities to the existing detail overlay and restores focus on pointer close (immersive=true)
- 证据：AssertionError: expected undefined to be defined
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-045 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection renders native entity buttons, isolates Enter, and restores focus after closing detail (drawer=false)
- 证据：AssertionError: expected undefined to be defined
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-046 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/ui_4_glyph_feedback.test.ts`
- 用例：UI-4 panels and nearby inspection renders native entity buttons, isolates Enter, and restores focus after closing detail (drawer=true)
- 证据：AssertionError: expected undefined to be defined
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-047 · 测试夹具初始化缺口
- 文件：`src/test/w_14_obstruction.test.ts`
- 用例：W-14 detonation and terrain boundaries invalidates active path/safety caches without adding a non-CE waypoint rebuild
- 证据：TypeError: Cannot read properties of undefined (reading 'lightAt')
- 归类与影响：Object.create(Game.prototype)构造局部Game，未初始化lightMap或fov；新命令收尾路径触发undefined。确定夹具缺字段，修后仍须验证原语义，不能由此放宽VISIBILITY生产逻辑。

### NPM-048 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/w_18_entrancement.test.ts`
- 用例：W-18 forced attack relationships, grab and real terrain diagonal corner blocks follow and secret door admits it via placement
- 证据：AssertionError: expected [ 19, +0, +0, +0 ] to not include 19
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-049 · 测试夹具初始化缺口
- 文件：`src/test/w_2_arcana_submission.test.ts`
- 用例：W-2 choose / cancel / commit (CE Items.c:6361-6516,7340-7440) 11 existing CE items enter selection without charge, turn, identity or RNG changes; Escape cancels
- 证据：TypeError: Cannot read properties of undefined (reading 'computeFOVMask')
- 归类与影响：Object.create(Game.prototype)构造局部Game，未初始化lightMap或fov；新命令收尾路径触发undefined。确定夹具缺字段，修后仍须验证原语义，不能由此放宽VISIBILITY生产逻辑。

### NPM-050 · 测试夹具初始化缺口
- 文件：`src/test/w_2_arcana_submission.test.ts`
- 用例：W-2 choose / cancel / commit (CE Items.c:6361-6516,7340-7440) Tab cycles eligible candidates in both directions, and missing candidates leave the cursor unchanged
- 证据：TypeError: Cannot read properties of undefined (reading 'computeFOVMask')
- 归类与影响：Object.create(Game.prototype)构造局部Game，未初始化lightMap或fov；新命令收尾路径触发undefined。确定夹具缺字段，修后仍须验证原语义，不能由此放宽VISIBILITY生产逻辑。

### NPM-051 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/w_5_arcana_instance.test.ts`
- 用例：W-5 generated results: 12 fixed seeds (W-24/W-25/W-26 coverage supplements) × D1–26 retain category coverage and obey initial per-kind values
- 证据：AssertionError: expected [ +0, 1, 10, 11, 2, 3, 4, 5, 6, …(3) ] to deeply equal [ +0, 1, 10, 11, 13, 2, 3, 4, 5, …(4) ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-052 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D01-D04 terrain refusal and CE exemptions flame: No preserves the entire action state; Yes performs one move
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Venture into flame?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-053 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D01-D04 terrain refusal and CE exemptions confusion gas: No preserves the entire action state; Yes performs one move
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Venture into dangerous gas?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-054 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D01-D04 terrain refusal and CE exemptions paralysis gas: No preserves the entire action state; Yes performs one move
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Venture into dangerous gas?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-055 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D01-D04 terrain refusal and CE exemptions pressure plate: No preserves the entire action state; Yes performs one move
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Step onto the pressure plate?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-056 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D01-D04 terrain refusal and CE exemptions gas trap: No preserves the entire action state; Yes performs one move
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Step onto the pressure plate?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-057 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D01-D04 terrain refusal and CE exemptions questions are ordered fire -> gas -> plate, and stop at the first No
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-058 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation sword cancels the whole attack/movement before nausea, damage and RNG; Yes still attacks
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-059 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation whip cancels the whole attack/movement before nausea, damage and RNG; Yes still attacks
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-060 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation spear cancels the whole attack/movement before nausea, damage and RNG; Yes still attacks
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-061 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation axe cancels the whole attack/movement before nausea, damage and RNG; Yes still attacks
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-062 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation rapier cancels the whole attack/movement before nausea, damage and RNG; Yes still attacks
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-063 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation flail cancels the whole attack/movement before nausea, damage and RNG; Yes still attacks
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-064 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D07 acidic attack confirmation sweep checks every target before hurting any of them and asks only once
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-065 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording an animated auto step records answer=false and replay/seek stays stopped with zero OOS
- 证据：AssertionError: expected [] to deeply equal [ false ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-066 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording an animated auto step records answer=true and replay/seek stays stopped with zero OOS
- 证据：AssertionError: expected [] to deeply equal [ true ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-067 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording stops an auto step before asking, and stays stopped after answer=false
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Venture into flame?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-068 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording stops an auto step before asking, and stays stopped after answer=true
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Venture into flame?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-069 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording flame replays rejected/accepted decisions and seeks without UI or OOS
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-070 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording confusion gas replays rejected/accepted decisions and seeks without UI or OOS
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-071 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording paralysis gas replays rejected/accepted decisions and seeks without UI or OOS
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-072 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording pressure plate replays rejected/accepted decisions and seeks without UI or OOS
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-073 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording gas trap replays rejected/accepted decisions and seeks without UI or OOS
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-074 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u1_movement_safety.test.ts`
- 用例：X3-U1 D10 automation and recording acid attack replays rejected/accepted decisions and seeks without UI or OOS
- 证据：AssertionError: expected { Object (loc, hp, ...) } to deeply equal { Object (loc, hp, ...) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-075 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 ally swap swap still picks up the destination item and respects the terrain confirmation before moving either creature
- 证据：AssertionError: expected { player: { …(5) }, turn: 1, …(7) } to deeply equal { player: { …(5) }, turn: +0, …(7) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-076 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 discordant attack confirmation undefined No changes no gameplay state; Yes attacks without swapping
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ Array(1) ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-077 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 discordant attack confirmation axe No changes no gameplay state; Yes attacks without swapping
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ Array(1) ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-078 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 discordant attack confirmation whip No changes no gameplay state; Yes attacks without swapping
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ Array(1) ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-079 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 discordant attack confirmation spear No changes no gameplay state; Yes attacks without swapping
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ Array(1) ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-080 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 discordant attack confirmation sweep confirms a secondary discordant ally before damaging the primary enemy; asks once for multiple allies
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-081 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D05 discordant attack confirmation acid question precedes discordant question, with both answers in one command decision list
- 证据：AssertionError: expected { player: { …(5) }, turn: 1, …(7) } to deeply equal { player: { …(5) }, turn: +0, …(7) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-082 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D06 captive release undefined No preserves state; Yes uses attackSpeed without attack recovery, nausea or movement
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Free the captive Monkey?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-083 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D06 captive release mace No preserves state; Yes uses attackSpeed without attack recovery, nausea or movement
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Free the captive Monkey?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-084 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 D06 captive release rapier No preserves state; Yes uses attackSpeed without attack recovery, nausea or movement
- 证据：AssertionError: expected "vi.fn()" to be called once with arguments: [ 'Free the captive Monkey?' ]
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-085 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 recording and auto-travel discordant public commands replay and seek with zero OOS and no UI
- 证据：AssertionError: expected { player: { …(5) }, turn: 1, …(7) } to deeply equal { player: { …(5) }, turn: +0, …(7) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-086 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u2_ally_captive.test.ts`
- 用例：X3-U2 recording and auto-travel discordant request stops automation before asking, including on Yes
- 证据：AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-087 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u8b_items.test.ts`
- 用例：X3-U8b A09 pack and persistent avoidance an avoided item does not hide collectable loot on the same cell
- 证据：AssertionError: expected [ …(2) ] to not include Item{ spawnTurnNumber: +0, …(42) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-088 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x3_u8b_items.test.ts`
- 用例：X3-U8b A09 pack and persistent avoidance weapon that misses a creature clears inherited avoidance and becomes an exploration goal
- 证据：AssertionError: expected [ Item{ spawnTurnNumber: +0, …(42) } ] to not include Item{ spawnTurnNumber: +0, …(42) }
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-089 · 行为失败，生产缺陷/测试前提尚未区分
- 文件：`src/test/x4a_movement_rendering.test.ts`
- 用例：X4a per-step known exploration/travel prioritizes a known adjacent enemy through the common attack entry
- 证据：AssertionError: expected "resolvePlayerMeleeAttackOn" to be called 1 times, but got 0 times
- 归类与影响：最终断言失败已确认；仅凭日志不能裁定生产根因，不列为已批准缺口。保持原断言，后续做相关归因。

### NPM-090 · 已批准内容缺口
- 文件：`src/ext/modules/combat/tests/combat2_links.test.ts`
- 用例：C2-NAT optional giants target and public growth skill share a genuine origin and complete persistence
- 证据：AssertionError: expected false to be true // Object.is equality
- 归类与影响：最终日志定位 line47 giantHit=false；属于自然巨兽有效命中缺证据，非阻塞但仍记失败。

### NPM-091 · 已批准内容缺口
- 文件：`src/ext/modules/combat/tests/combat2_natural.test.ts`
- 用例：C2-NAT bounded original-world capture or complete compact-trace replay
- 证据：AssertionError: expected [ 'combat.advancing-point', …(3) ] to deeply equal [ 'combat.advancing-point', …(4) ]
- 归类与影响：最终差异仅NPC combat.anchor-break缺失；definitions.json将zombie映射该profile，符合已批准zombie自然出招缺口。

### NPM-092 · 其它超时，根因未定
- 文件：`src/ext/modules/combat/tests/combat_combinations.test.ts`
- 用例：3f independently installed combat combinations on a natural normal run 'combat+crafting+foraging+growth+narra…': real commands, every checkpoint, seek, continuation and corrupt-manifest preservation
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-093 · 其它超时，根因未定
- 文件：`src/ext/modules/combat/tests/combat_combinations.test.ts`
- 用例：3f independently installed combat combinations on a natural normal run 'combat+foraging+giants+growth+narrati…': real commands, every checkpoint, seek, continuation and corrupt-manifest preservation
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-094 · 其它超时，根因未定
- 文件：`src/ext/modules/combat/tests/combat_combinations.test.ts`
- 用例：3f independently installed combat combinations on a natural normal run 'combat+crafting+giants+settlement': real commands, every checkpoint, seek, continuation and corrupt-manifest preservation
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-095 · 其它超时，根因未定
- 文件：`src/ext/modules/combat/tests/combat_combinations.test.ts`
- 用例：3f independently installed combat combinations on a natural normal run 'combat+foraging+narrative+settlement': real commands, every checkpoint, seek, continuation and corrupt-manifest preservation
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-096 · 其它超时，根因未定
- 文件：`src/ext/modules/combat/tests/combat_combinations.test.ts`
- 用例：3f independently installed combat combinations on a natural normal run 'combat+crafting+giants+narrative+sett…': real commands, every checkpoint, seek, continuation and corrupt-manifest preservation
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

### NPM-097 · 已批准N2性能调查
- 文件：`src/ext/modules/narrative/tests/narrative2_combinations.test.ts`
- 用例：N2-COMBO 'combo-narrative-growth-combat-giants-…' installed NPC/persistence lifecycle
- 证据：Test timed out in 900000ms
- 归类与影响：七包用例最终日志明确900000ms超时；非阻塞调查项，不记通过、不重复探针。

### NPM-098 · 测试清单前提
- 文件：`src/ext/modules/narrative/tests/narrative2_imports.test.ts`
- 用例：N2-IMPORT exhaustive narrative production ownership has exact test discovery membership without duplicate, stale or omitted tests
- 证据：AssertionError: expected [ 'drift', 'test' ] to deeply equal [ 'drift', 'gen', 'test' ]
- 归类与影响：仍硬编码drift/gen/test三入口；新政策已移除gen，实际drift/test。须保持完整发现/无重漏断言。

### NPM-099 · 其它超时，根因未定
- 文件：`src/ext/modules/narrative/tests/narrative2_rewards.test.ts`
- 用例：N2-REWARD real Game independent quotes, two endings and durable once-only results bone.clerk: both endings produce fixture applied 5 in the same command
- 证据：Test timed out (以normal-npm-test.log最终分组为准)
- 归类与影响：JSON只有STACK_TRACE_ERROR；文本最终汇总确认该组超时。不能推断产品复杂度或自动沿用N2豁免。

## 接续

test:ext自19:50:29起串行执行，drift/128/全删1行尚待。runner58500；完成接续器58543等待整批done且无BLOCKED。整批期间保持源码稳定；完成后沿用原事件接续核对，须读取本台账、ext/drift结果并保留npm首败。仍有未归因/未关闭项时不能称最终全绿或验收通过，不开R3。

原始证据：`/private/tmp/brogue-commander-20261009-5z/policy-final-gates-v1/normal-npm-test.vitest.json`、同目录`normal-npm-test.log`及执行根`policy-final-gates-v1.summary.json`。
