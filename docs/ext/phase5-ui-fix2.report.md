# P5 UI fix2：地图跟随与开局口粮

任务：`p5-ui-fix2.task.md`；开工 `ext/phase5` / `5fb605f`，初始工作区干净。唯一写入者，未 commit/push。两项修复及限定范围复验完成；浏览器/真机验证受沙箱限制，仍待人工。

## 实现

- `GameCanvas.vue` 用有效地图宽高、布局模式、地图模式及显示设置识别几何变化；变化后清除旧视口平移，以当前显示中的玩家重算相机。保留缩放值和显式整图模式；稳定视口中的手动平移仍保留，“回到玩家”仍只清平移。
- 面板状态、窗口尺寸与横竖布局使用 post-flush watcher，在 DOM 更新后读取有效视口。因此抽屉仅裁剪画布、容器尺寸不变时也能重算；容器自身变动继续由原 ResizeObserver 驱动。新 watcher 随组件卸载清理。玩家移动继续经过原显示循环跟随，不因模块面板暂停自动行动而暂停镜头。
- `mapCamera.ts` 桌面放大分支的边界钳制不再被记成用户平移，防止后续尺寸变更继承伪造的 pan。未改 Game 字段、输入命令边界或显示 RNG。
- settlement 自有 `startupItems` 末尾增加 `settlement.ration × 1`；使用既有原生口粮定义及一次性发放收据，与基础开局口粮合为 2 份。其余材料数量不变。经典局及不启用 settlement 的扩展局仍为 1 份；模块定义指纹自然更新，没有存档格式升级或旧档迁移。配置手册同步更新。

## 四档视口与玩法回归

| 视口 | 自动化验证 |
|---|---|
| 320×844 | 编译真实 GameCanvas SFC，容器 60%→40% 高度、抽屉开合、横屏往返后玩家仍可见 |
| 390×844 | 同上；覆盖抽屉裁剪但容器不变的路径 |
| 800×991 | 同上；平板竖横布局切换与跟随 |
| 1440×900 | 桌面放大及桌面/紧凑布局切换；边缘钳制不产生残留 pan |

四档均检查手动平移在普通帧保持、几何变化后归中、缩放/整图状态保持、“回到玩家”及暂停自动行动时的真实移动跟随。布局纯函数另覆盖四档的玩家可见性和指针逆变换。SFC 使用真实 Vue/Pixi CPU 图层与生产相机，DOM 几何和 GPU 文本为 fixture，不能替代浏览器像素验收。

自然 seed28、normal、仅 settlement：无地图/食物/位置/随机数注入，开局两份口粮，公开移动一步后在 D1 公开建营，真实锁入两份粮；同版本保存、加载及回放摘要一致。既有遍历测试继续验证跨层和读档不重复发放；七模块及单模块真实开局 UI 测试均检查两份口粮。

## 旧前提与 trace

- `settlement_natural` 两项和 `settlement_boundaries` 一项原断言依赖旧的一份开局粮。新生产下 3 项失败；仅回退 settlement 的 `data/definitions.json` 后同 3 项通过。同步起始 1→2、拾粮后及撤营退款 2→3，保留路线、真实锁粮、对象身份、存读/回放断言。
- `settlement_inventory_ui` 四项共用的自然路线前提把拾粮后数量 2→3；只回退发放配置后原四项通过，恢复新配置并修数量后四项通过。回归按钮、关闭、Confirm/ACK 隔离语义保持。
- 两份含 settlement 的 narrative2 trace 使用原 `captureNatural` 捕获函数。仅回退上述发放配置后，两份旧 trace 的完整命令重建/全部检查点通过。补发口粮会消耗一个实体 ID，因此后续 ID 与引用顺移；完整 8/36 个世界检查点逐字段对照为 379/12895 叶差异，归于口粮合堆（quantity、originDepth）、发放收据、定义指纹和后续 ID/引用（含按 ID 索引的字典与派生 footprint hash）。trace 共 12/52 叶更新：44 个 worldHash、2 个 finalHash、6 个出生 entity.id、12 个 open 命令 targetEntityId。命令中其余数据/决策、全部消息 hash、最终双 RNG、事件数、recordingBytes 不变。逐字段登记见[小型证据](evidence/phase5-ui-fix2-trace.json)。不冒称纯格式重录。

## 门禁与证据

所有命令使用 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 的 Node 24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。长命令均等待实际完成，原失败不抹去。

- 新回归红对照：2 文件，17 通过 / 5 失败；首次修复复验：5 文件，49 通过。
- 旧口粮前提首次：2 文件，49 通过 / 3 失败；单变量回退后所选 3 项通过。
- 相关批次首次：20 文件，234 通过 / 4 失败（均为上述 inventory UI 数量前提），无 skip/todo/unhandled。
- 受影响前端/背包文件及源码守卫复验：9 文件、136 项通过，无 skip/todo/unhandled；包含修正后的横竖屏矩阵。
- 地形读源码守卫：3 项通过，另 27 项仅因名称过滤未选；未修改守卫。
- trace：旧配置原两份重建 2 项通过；原 captureNatural 重录 2 项通过。首次捕获探针错误要求 targetEntityId 也不变而失败（2 项）；修正为核验准确 +1 后原法重录，通过。未修改正式 trace 测试断言。
- `npm run build`（含 vue-tsc）：exit0；仅既有大 chunk 提示。
- 新 trace 正式重建函数复验：2 项通过（66/1620 条输入、8/36 个世界检查点）；双包正式存读/回放/seek/续录生命周期 1 项通过、8 项名称过滤未选。
- 最终测试发现清单：1 文件、6 项通过；临时探针及注册清单已清理。
- 最终 `npm run check:modules`（boundary + 静态测试依赖）、显式 `vue-tsc -b`、`git diff --check`：exit0。类型检查与实际 build 均通过，生产源码此后未变。

本次不运行完整 npm/test:ext、128 组合或删除矩阵，不替代阶段5最终收口。七模块 narrative2 完整生命周期原有 900s 性能项不在本次修复范围；本轮一次误选的全生命周期反事实已主动中止（exit130），另用只重建命令/检查点的探针完成基线核对，不将中止算通过。

浏览器尝试：Vite `127.0.0.1:5198` 监听被沙箱拒绝（EPERM）；按 develop-web-game 技能运行原 Playwright client，Chromium 在 MachPort 初始化处失败，未到页面。没有本候选截图/实机验证，也未借用其他工作树的已运行页面。原日志 `/private/tmp/p5-ui-fix2-browser.log`；四视口真实浏览器抽样仍待维护者。

全部日志 `/private/tmp/p5-ui-fix2-*.log`；多 MB 的完整世界对照在 `/private/tmp/p5-ui-fix2-traces/`，不提交原始证据。首次类型检查发现新测试数组元素可能 undefined，已改为 readonly tuple，后续类型检查通过。临时 trace 探针发现清单先漏登（启动失败），随后按既有注册规则补登；已移到 `/private/tmp/p5-ui-fix2-traces/p5_ui_fix2_probe.test.ts` 并恢复清单原字节，不改守卫。

复现入口（仓库根，使用上文 Node/PATH/堆配置）：

```sh
node node_modules/vitest/vitest.mjs run \
  src/test/ext_phase5_ui_open.test.ts src/test/gameplay_layout.test.ts \
  src/test/canvas_resize.test.ts src/test/fe_1_touch.test.ts \
  src/test/p2_6_display_settings.test.ts src/test/p2_4_animation_cadence.test.ts \
  src/test/immersive_polish.test.ts src/test/ext_canvas_input.test.ts \
  src/engine/Core/startingKit.test.ts \
  src/ext/modules/settlement/tests/settlement_camera.test.ts \
  src/ext/modules/settlement/tests/settlement_runtime.test.ts \
  src/ext/modules/settlement/tests/settlement_natural.test.ts \
  src/ext/modules/settlement/tests/settlement_boundaries.test.ts \
  src/ext/modules/settlement/tests/settlement_persistence.test.ts \
  src/ext/modules/settlement/tests/settlement_ui.test.ts \
  src/ext/modules/settlement/tests/settlement_input.test.ts \
  src/ext/modules/settlement/tests/settlement_validation.test.ts \
  src/ext/modules/settlement/tests/settlement_inventory_ui.test.ts \
  src/test/ext_world_work_boundaries.test.ts src/test/ext_world_work_sdk_contract.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run \
  src/test/ext_phase5_ui_open.test.ts src/ext/modules/settlement/tests/settlement_inventory_ui.test.ts \
  src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts \
  src/test/r_1_appearance.test.ts src/test/map_tile_modes.test.ts \
  src/test/vector_atlas.test.ts src/test/map_touch_input.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/test/c_4a_terrain_catalog.test.ts -t '留痕' --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/ext/modules/narrative/tests/narrative2_combinations.test.ts -t settlement --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/test/test_suite_membership.test.ts --maxWorkers=2
npm run check:modules
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
git diff --check
```

上述第一批原退出1保留；第二批完成受影响两文件及额外守卫复验，不把不同批次计数累加为“一次完整套件全绿”。`-t settlement` 实际选中双包正式生命周期 1 项，另8项未选；全七包通过另一个原函数命令/检查点探针核对，不宣称900s完整生命周期通过。
