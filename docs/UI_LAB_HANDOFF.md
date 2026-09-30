# UI、美术与性能分支交接

更新：2026-09-30。供本地测试、审阅与后续合并使用。

## 1. 来源与合并边界

- 分支：`feat/ui-lab-visuals-performance`
- 原仓库与基点：`coolking70/BrogueJS`，`ee51a1197ba827dbaaa2b96fe9014b6667287037`
- 对应当前公开试玩 v10：<https://brogue-ui-lab.coolking.chatgpt.site>
- 试玩源码快照：`5555647562871770692409a7408119e28156a356`
- 准备分支时 GitHub `main` 仍为上述基点。此分支保留原仓库历史，未重置、合并或覆盖 `main`；后续本地工作请先重新获取远端状态
- 从试玩移入的是代码、测试、成品美术、字体及精简性能报告；原仓库 `.github/workflows/pages.yml`、Vite/依赖配置、开发工具配置和既有文档保持原样
- 不包含 Site 配置、托管身份、依赖目录、构建产物、重复源码压缩包、CE 参考源码、原始测试日志或另一条 CI 门禁试验线

相对 v10 的应用源码仅做回迁所需的两项元数据修订：信息面板源码下载链接改为本分支的 GitHub 源码归档，存档说明改为准确的“当前浏览器与站点”。游戏、地图渲染与引擎实现保持 v10 字节一致。`UI_PREVIEW.md` 前置了本次回迁说明；早期阶段报告保留当时的范围与结果。

## 2. 包含的改动

- 三套可即时切换且不重新开局的完整 UI：玄石圣所、荧渊、蚀刻远征；包含各自标题画、主菜单、HUD、消息/详情与物品浮层布局
- 四种独立地图模式：原版、精修 ASCII、汉字、矢量图标；带可检索图例。汉字/矢量使用方格镜头，覆盖 208 种地形、67 种怪物、13 类物品
- 视野、记忆、密门/机关伪装、幻觉与魔法定位的过滤由既有 Appearance 决定，地图适配器不揭示未探索身份
- Pixi 保留几何缓存、白色四边形背景复用、显式批处理及绘制请求合并；颜色仍实时取自引擎，缩放不依赖位图分辨率
- `Monster.ts` 的两个追踪玩家 A* 调用点增加单次搜索内的可通行性缓存。通用 Pathfind、优先队列、查询顺序、路径、行动频率、随机数、存档/录像格式均未改动
- 可选 `?profile=1` 本地性能面板；不上传遥测
- 美术提示词、资源校验值与许可说明见 [`public/art/README.md`](../public/art/README.md)；字体附带原 OFL 许可

## 3. 已有验证与必须保留的限定

v10 的 CE-inclusive aggregate 使用 Node v24.19.0、固定 legacy CE 参考源码
`49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`。

- 首轮汇总实际结果为 4576 通过、6 失败（两个旧 UI 夹具）、8 历史跳过、5 todo；另一个 B2 转录 worker 未正常完成
- 两个旧夹具已先做单变量反事实，随后只修其前提/源码委托路径，28 个相关检查在最终源码上通过；未放宽断言、门限或增加 skip
- B2 单跑首先因默认约 2GB JS 堆 OOM；相同 21 项测试仅增加进程堆至 4GB 后通过
- 合并统计为 254 个测试文件、4603 个不同可执行检查通过，另有 8 skip、5 todo；生成 drift 独立通过
- 最终 build/typecheck 在夹具修订后通过
- **没有在最终夹具上再从头跑一次全量 aggregate；不得把上述分次证据描述成一次全绿全量运行**

性能等价探针：1326 条真实命令、204 条完整 A* 路径及查询顺序散列、8 个完整世界检查点一致。
目标卡顿检查点中位耗时约 103.694 → 40.949ms（Node CPU，无渲染器），并非手机帧率承诺。
测试楼层自然生成但以测试方式进入，HP10000 为生存夹具，并非不中断的自然深层通关。

详情及可复现脚本：

- [`ui-map-performance.md`](reports/ui-map-performance.md)
- [`ui-monster-search-performance.md`](reports/ui-monster-search-performance.md)
- [`ui-monster-search-metrics.json`](reports/ui-monster-search-metrics.json)
- `node scripts/profile-retained-map.mjs /tmp/brogue-map-profile.json`
- `node scripts/check-retained-map-batches.mjs`
- `node scripts/profile-monster-search.mjs /tmp/brogue-monster-search.json`

## 4. 本次回迁后的复验

在回迁后的最终应用源码上复验，Node v24.19.0 / npm 11.9.0：

- `npm run build`：类型检查与生产构建通过
- `npm run build -- --base /BrogueJS/`：通过；实际构建 CSS/HTML 中三幅标题画、汉字字体、favicon 的 `/BrogueJS/` 前缀及产物存在性均检查通过
- 18 个定向测试文件、201 个检查全部通过（`BROGUE_REQUIRE_CE=1`，两个 workers）
- 地形生产读者白名单守卫单独通过 1 项；同文件另 29 项由名称筛选而未运行，不混入通过计数
- Pixi 批处理探针三个规模 320/1200/3713 均为单批、零 standalone graphics；进程退出码 0。关闭 Vite 时曾打印依赖扫描取消诊断，发生在六组结果与断言之后，不计作 GPU 或浏览器性能测量
- `git diff --check` 通过；游戏源文件相对 v10 的差异仅为上面注明的两处链接/说明文本
- 本次没有再次执行耗时全量或 drift；全量/漂移证据来自 §3 的同一 v10 游戏实现

定向命令：

```bash
BROGUE_REQUIRE_CE=1 npx vitest run \
  src/test/frame_profile.test.ts src/test/gameplay_layout.test.ts \
  src/test/map_tile_modes.test.ts src/test/monster_path_cache.test.ts \
  src/test/retained_map_drawing.test.ts src/test/retained_render_determinism.test.ts \
  src/test/ui_concepts.test.ts src/test/vector_atlas.test.ts \
  src/test/x3_u5_ui.test.ts src/test/x4a_movement_rendering.test.ts \
  src/test/ux_1e_pathfinding.test.ts src/test/p2_6_display_settings.test.ts \
  src/test/ui_1_rendering.test.ts src/test/ui_2_protection.test.ts \
  src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts \
  src/test/repo_hygiene.test.ts src/test/r_1_appearance.test.ts --maxWorkers=2
BROGUE_REQUIRE_CE=1 npx vitest run src/test/c_4a_terrain_catalog.test.ts \
  -t '生产读者只出现在白名单文件' --maxWorkers=1
```

## 5. 本地接手命令与建议顺序

先保留本地未提交改动，再获取此分支。不要用整文件覆盖正在开发的主分支。

```bash
git fetch origin feat/ui-lab-visuals-performance
git switch --track origin/feat/ui-lab-visuals-performance
npm ci
npm run dev
```

已有同名本地分支时，直接 `git switch feat/ui-lab-visuals-performance` 并核对提交。
本仓库推荐 Node 22（20+）；本次云端验证使用 Node v24.19.0、npm 11.9.0。
三个主题可由 `?concept=classic`、`?concept=tactical`、`?concept=immersive` 打开；
同一局内用顶部按钮切换地图模式。浏览器存档按站点隔离，本地不会自动读取公开试玩的存档。

```bash
npm run build
npm run build -- --base /BrogueJS/
npm run ce:fetch
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=4096" npm run test:full -- --maxWorkers=1 --no-file-parallelism
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=4096" npm run test:drift -- --maxWorkers=1 --no-file-parallelism
```

全量较长且 B2 内存需求较高；上面的单 worker/4GB 设置用于避免已观察到的资源争用与堆 OOM，不修改断言或超时。
确认最终本地合并结果再按仓库门禁验收。原 Pages workflow 仅在 `main` push 或手动 dispatch 时部署，本分支推送不触发自动上线。

## 6. 仍需本地/设备验证

- 真机手机与触屏、竖横屏布局；当前有源码与定向前端测试，未做独立移动浏览器全覆盖
- 自然长局深层探索、Android 性能、GPU 时间与原设备卡顿复现
- 原生浏览器中的重复开关菜单、切主题/地图、背包、录像保存/回放、换层与同站点存档
- 本分支尚未合并；未创建 PR、未发布新 tag、未改动公开试玩部署
