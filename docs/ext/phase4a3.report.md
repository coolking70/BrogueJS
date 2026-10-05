# 4a-3：方形身体刻符呈现与通用 UI 投影

执行任务书：`docs/ext/phase4a3.task.md`。工作分支 `ext/phase4`，起点与交付 HEAD 均为 `f61a3827ae060cf6312248ddaf2ceaa0a853100f`。未 commit，暂存区为空。没有制作图片素材。

## 完成范围

1. **一体一个绘图组**：公开身体格低亮填充，沿实际公开 mask 边界细描边，内部相邻边不重复画；共用几何支持凹角和孔洞的绘图单测。生产仍仅接已开放的原生 2×2 / 3×3 square。一个主字形按公开格的固定顺序选择；完整身体取中央合法格，2×2 的中央并列取固定格。四种模式共用轮廓和占格，沿原有字形接口绘制，不扩大字形。
2. **裁切与知识**：主字形、身体轮廓、悬停和目标轮廓只使用当前公开身体格；glyph 的选择也只读公开 mask，不能由隐藏锚点决定。部分可见时不公开总尺寸；完整当前可见才显示本地化的 `2×2` / `3×3`。telepathy / entranced 的单位置呈现保留；隐藏身份时保留原 `x` 标记，不生成身体拓扑或列表身份。不可见怪物只有公开气体格能产生轮廓。世界交互图标的遮挡优先级覆盖公开身体，并保留单位置标记优先级。
3. **交互**：鼠标尾格悬停/右键和手机长按使用 4a-2 的同一实体解析。公开 square 的桌面投掷/法杖点选接现有“两步瞄准”路由；另一身体格只是改瞄准，确认仍比较准确的格坐标。普通单格桌面入口保持原行为，原命令/录像边界保留。瞄准时仍有准确接触格标记，并额外描边整个公开身体。
4. **共享 row DTO**：Sidebar、ThemeNearby、ContextPanel 一体一 row。`row.loc` 使用稳定公开检视格；`bodyCells`、`bodySize`、欧氏平方排序距离和切比雪夫显示距离均由公开格派生。排序沿原“直接/感知、怪物/物品/地形”分组，取对应公开身体的最近距离；尾格焦点提升同一 row。HP、行为、状态沿原身份门槛。
5. **显示时序与清理**：DisplayMap 捕获冻结的 `bodies`，DisplayFrame 捕获 `hoverCell` 和共享 rows。实时与历史身体使用相同投影/绘图函数；MORE 等待时绘制与列表、公共 HUD 端口只取历史帧，不读取未来位置/HP。真实回放/前后 seek 清旧 timeline 与 throw aim；画布每次绘制先清身体/目标几何，hover 按当前公开帧重建，不保留旧组。
6. **通用 HUD**：现有 `ModuleUiSlot` 的任意组件/props 和 `hudSlots` 可承载名称、HP 条，不需要新 Boss 专用插槽。补充 `ModuleUiHost.readDisplayFrame()` 展示端口，由 App 供应历史帧优先、否则当前只读冻结帧。4a-4 可按 row.id 选择公开目标并读 name/hp/maxHp/bodyCells，不能把 live `game.monsters` 的未来 HP 当作旧帧数据。沿用原 `presentationHidden` 忙态隐藏与会话退役机制；本步不产生 Boss 内容或血条组件。
7. **开发诊断**：只在 DEV 注册 `window.debug_square_bodies()`，在当前层安全、完整可见、无机关/物品/世界交互图标的地板上放置一只 2×2 和一只 3×3 原生 fixture 老鼠（固定不移动，分别 200/300 HP，复用已有名称/字形）。选址先预检，不改变地形或开视野；无足够位置时整体拒绝且不消耗 RNG/ID/命令。发布经 `executeCommand` 与原 `createSquareMonster`，随后更新显示。先标记 3a0 的 fixture 导出守卫，`toSnapshot`、`toSaveSnapshot`、`exportRecording` 都拒绝；正式菜单无入口，生产构建剔除调试函数和 fixture 命令。

没有修改战斗、生成、调度、Game 状态字段、U03 契约、存档/录像格式、CE 源码、黄金 trace 或生成基线。

## 共享文件函数级改动

| 文件 | 函数/接口与用途 |
|---|---|
| `engine/UI/MonsterBody.ts`（新增） | `publicMonsterBody`：公开格、稳定 glyph、完整可见的尺寸；`bodyContains`：公开格命中；`publicMonsterMapCells`：身体/单位置标记对交互图标的优先级。 |
| `ui/monsterDisplay.ts`（新增） | `observeDisplayMonster`：共享外观投影，一个实体仅调用一次 `monsterAppearance`，幻觉不按身体格重复取随机。 |
| `ui/bodyDrawing.ts`（新增） | `bodyEdges`、`paintBody`、`paintBodyOutline`、`selectedBodyCells`：实际公开掩码几何、低亮填充及裁切选中。 |
| `ui/displayProjection.ts` | `observeDisplayMap`：捕获 bodies、复用单实体外观、公开身体遮挡图标；`observeDisplayFrame`：捕获 hoverCell、共享 row。 |
| `ui/presentationTimeline.ts` | `clear`：沿已有 start/load/replay/seek reset 清除 UI throw aim，无新增引擎字段。 |
| `engine/UI/MonsterSidebar.ts` | `visibleMonsterRows`：公开检视格、体型与最短同类距离；`sidebarEntityRows` / row 辅助：尾格焦点、覆盖所有公开身体格，保持单格 DTO/排序语义。 |
| `components/GameCanvas.vue` | `render` / `renderProjection`：共用身体与单主字形；`selectionCells` / `drawHover` / `drawTargetBody`：公开裁切；`publicSquareAt` / `activateCell`：square 桌面也经既有瞄准路由；挂载/卸载：开发诊断注册与释放。 |
| `Sidebar.vue`、`theme/ThemeNearby.vue`、`ContextPanel.vue` | 原共享 row 显示体型；ThemeNearby 使用 DTO 的最近身体距离，不按 row.loc 重算。 |
| `ext/ui/types.ts`、`App.vue` | `ModuleUiHost.readDisplayFrame` 与 shell 注入，现有 HUD 插槽/隐藏机制不变。 |
| `ui/squareBodyDiagnostics.ts`（新增） | `placeSquareBodyFixtures`：安全预检、命令发布、fixture 导出守卫；`installSquareBodyDiagnostics`：DEV 注册、卸载删除。 |
| `locales/zh_CN.json` | 新增 `sidebar.body_size`，组件玩家文本使用 i18n。 |
| 测试/清单 | 新增 `phase4a3_body_display.test.ts`、`phase4a3_body_sfc.test.ts` 和只供测试的 `support/squareDisplayScene.ts`；两测试登记在 `scripts/test-suites.json` 常规核心清单。 |

## 维护者浏览器验收用法

用开发服务器 `npm run dev` 打开游戏，开局后关闭菜单，在有足够空间的房间停下。浏览器开发控制台执行：

```js
window.debug_square_bodies()
```

返回两实体的 `entityId`、`size` 和实际 `cells`，便于精确点击尾格。若安全可见位置不足，移动到更大房间重试；诊断不会挖墙/清场/开启透视。切换四种地图及普通/沉浸模式，验收 1440×900、390×844、320×844；可绕墙观察部分可见裁切、尾格右键/长按、投掷/法杖“另一格改瞄准”。

使用后当前页面 Game 实例被 3a0 的 fixture 守卫永久标记，所有生产存档/录像导出被拒绝；结束诊断后**刷新页面，再开正式局**。该标记不是可写进存档的调试许可，不能靠切换菜单解除。正式生产构建没有 `debug_square_bodies`。

本步依任务书未执行真实浏览器截图验收。SFC harness 实际运行生产 client 脚本、模板、生命周期、鼠标/触屏处理和绘图调用，以替代 DOM/Pixi 应用宿主验证合同；它不是像素截图验收。

## 实际测试与结果

环境：Node **24.19.0**；PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。相关集合设置 `BROGUE_REQUIRE_CE=1`，使用现有 legacy 参照，不让缺 CE 的相关用例静默跳过。

| 命令/集合 | 最终结果与本地原始证据 |
|---|---|
| 46 文件直接相关集合 | **46/46 文件、722/722 项通过，exit=0，148.42s，无跳过**；`/private/tmp/p4a3-related-final.log`。 |
| 两个新增专项 | 最终固定前一轮 **27/27 项通过，exit=0，4.08s**；`/private/tmp/p4a3-special-dev4.log`，后续纳入上面的完整相关集合，不累加统计。 |
| `node scripts/check-module-boundaries.mjs` | **exit=0**；`/private/tmp/p4a3-boundary-final.log`。 |
| `npx vue-tsc -b` | **exit=0**；`/private/tmp/p4a3-type-final.log`。 |
| `npm run build` | **exit=0**，Vite 2.89s；`/private/tmp/p4a3-build-final.log`。保留已有 >500 KB chunk 提示。 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts -t 白名单 --maxWorkers=2` | **1 项源码守卫通过、29 项由 -t 过滤，exit=0**；`/private/tmp/p4a3-terrain-guard-final.log`，未跑整个重型目录普查。 |
| 生产包诊断剔除检查 | `rg` 检查 dist JS，`debug_square_bodies` 与 `fixture:square-body-display` 均无匹配。 |
| 文件检查 | **18 个生产/测试/清单文件在最终门禁前后 SHA-256 一致**；`/private/tmp/p4a3-delivery-hashes.json`。交付文件全 LF，`git diff --check` 通过，HEAD 不变且暂存区为空。 |

新增 27 项包括：两尺寸碰撞格/绘制格一致、一体一 row/主字形/真实受击浮字；四模式同几何、凹角/孔洞；隐藏锚点与尾格裁切、气体与隐藏身份单位置标记；稳定公开定位、最近身体距离、尾格焦点；幻觉一次外观与双 RNG 不变、普通 1×1 原路径；旧 ACK 的 HP/位置/hover 与冻结 DTO；真实 replay 和前后 seek；鼠标不同尾格改瞄准、准确格确认；实际 SFC 尾格悬停/右键/手机长按；列表历史 HP、通用 HUD 历史 rows 与 D3 隐藏；开发入口释放、安全选址及导出守卫、无空间时零影响拒绝。

46 文件集合的完整可复现命令保存在 `/private/tmp/p4a3-related-final.sh`，文件清单在 `/private/tmp/p4a3-related-files.json`。包含本步专项、4a0 零影响差分、相关 4a1/4a2、display/presentation/dialog/渲染/Sidebar/targeting/触屏与回放门禁、UR2/3/4、U03 和所有直接相关源码守卫。完整列表：

```text
src/test/phase4a3_body_display.test.ts
src/test/phase4a3_body_sfc.test.ts
src/test/phase4a0_spatial.test.ts
src/test/phase4a0_spatial_differential.test.ts
src/test/phase4a1_game_square.test.ts
src/test/phase4a2_body_combat.test.ts
src/test/phase4a2_body_effects.test.ts
src/test/presentation_timeline.test.ts
src/test/dialog_continuations.test.ts
src/test/dialog_host.test.ts
src/test/dialog_service_input.test.ts
src/test/dialog_d4_blink.test.ts
src/test/ui_4_glyph_feedback.test.ts
src/test/ui_1_rendering.test.ts
src/test/ui_2_protection.test.ts
src/test/r_1_appearance.test.ts
src/test/ux_1c_display.test.ts
src/test/ux_1c_hallucination_display_rng.test.ts
src/test/retained_map_drawing.test.ts
src/test/retained_render_determinism.test.ts
src/test/map_tile_modes.test.ts
src/test/canvas_resize.test.ts
src/test/fe_1_touch.test.ts
src/test/map_touch_input.test.ts
src/test/immersive_mode.test.ts
src/test/immersive_polish.test.ts
src/test/search_progress_hud.test.ts
src/test/theme_shell_fixes.test.ts
src/test/x3_u7_sidebar.test.ts
src/test/u21c_flare_sidebar.test.ts
src/test/x3_u5_ui.test.ts
src/test/main_menu_replay_seek.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/u_27_recording.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/x3b_display_recording.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/ext_module_ui.test.ts
src/test/ext_world_display.test.ts
src/test/ext_module_boundaries.test.ts
src/test/p1_30_i18n_gate.test.ts
src/test/u24_hardcoded_text.test.ts
src/test/repo_hygiene.test.ts
src/test/test_suite_membership.test.ts
```

## 失败记录、旧守卫与基线

旧测试、旧断言、旧夹具与生产守卫均未修改，无旧测试前提修订、单变量反事实或基线/黄金 trace 重录。

第一轮相关集合完整退出 1：44/46 文件、719 项通过、2 项失败（142.56s，`/private/tmp/p4a3-related-before-final.log`）。一项是 FE-1 源码守卫把新增只读 getMonsterAt 算入触屏命令区：已移动生产端公开实体查询 helper 到命令区外，守卫不变。另一项是在追加 marker 优先级专项/辅助函数期间，测试模块已缓存旧辅助模块却载入了新测试，出现 `publicMonsterMapCells is not a function`；第一轮不是固定交付代码的全绿证据。随后固定全部生产/测试/清单文件并从头重跑相关集合。第二轮完整退出 1：45/46 文件、721 项通过、1 项失败（146.40s，`/private/tmp/p4a3-related-second-attempt.log`）；其唯一失败仍是 FE-1，因为首次移动 helper 仍位于守卫按注释定义的扫描区中。按实际注释边界再次移出后，定向 FE-1 + 真实画布 SFC 2 文件 27 项通过（exit=0，2.32s，`/private/tmp/p4a3-guard-fix-dev.log`），再次记录全部交付散列并完整重跑最终集合。以上两次失败都不计作通过。

开发新增专项的早期失败还包括：原版字形使用格左上角 anchor，图块模式不使用 Text 坐标；Pixi 指令包含纹理循环引用，几何比较应观察 path/style；L 形边界新夹具指向了内部边；inspectTarget 是公开 DetailInfo；ACK 布景需要启用已有 acknowledgment 展示口；模拟鼠标点击必须包含 native down/up 才能清 held-input 模态取消状态；自动初始瞄准格已经是目标之一，应选择另一个格验证改瞄准。只修新增夹具/观察方法，生产输入边界问题按上述方式修生产代码，未改变旧守卫语义。

## 已知限制与后续

任务书范围内无剩余实现项。浏览器六种视口/模式组合由维护者执行；本步未提供截图。正式 giants 模块、Boss 内容/血条选择策略、场地生成、任意 mask 生产使用/旋转/zone/复合体仍留在后续步。公共 HUD 端口提供 rows/body/HP 的公开帧数据，4a-4 需要自行提供内容身份与组件；D3 忙态继续隐藏模块呈现，不另造弹窗或等待屏障。

依任务书未运行完整 npm test、全部 test:ext、removal、CE full/gen 或 drift。截图与原始日志没有放入仓库；没有 commit/push。
