# 架构与代码地图

本文说明代码怎么组织、一次玩家操作如何流经系统，以及存档、录像、随机数这些"不能随便碰"的边界。路径相对仓库根目录。

## 1. 目录总览

```
src/
  main.ts / App.vue        入口；App.vue 挂载菜单、游戏画布与各浮层
  i18n.ts                  i18next 初始化（translation / content 两个命名空间）
  locales/                 中文文本（见 docs/i18n.md）
  data/                    游戏数据 JSON：monsters、hordes、weapons、armors、consumables、arcana、blueprints、mutations
  types/                   公共类型
  engine/
    Core/                  游戏主控与跨系统协调
    Map/                   网格、四层地形、地形/DF 目录、寻路与各类距离图
    Generator/             关卡生成：房间、楼梯、蓝图机器
    Combat/                战斗、法术/射线、怪物 AI 与特殊能力
    Items/                 物品模型、装载、使用效果、法器、护符
    Movement/              玩家旅行、自动行进可见性、放置、换层、潜水、迷惑
    Environment/Gas.ts     气体体积与扩散
    Lighting/ Status/ Visuals/  光照、状态、视觉效果
    UI/                    与渲染无关的"显示模型"：外观、详情、侧栏、文字目录
    Systems/               Logger（消息通道）、EventBus、Time
    Random.ts / Seed.ts    随机数（两条流）与种子
    Input.ts               键盘 → 命令映射
    Settings.ts            显示设置（本地存储）
  entities/                Creature / Monster / Player
  components/              Vue 组件：GameCanvas（Pixi 渲染与帧循环）、Sidebar、InventoryOverlay、DetailPanel、CommandBar、DPad 等
  ui/                      前端辅助：命令分派、布局、镜头、触屏手势、目标选择、地图字形规范化
  test/                    测试（见 docs/testing.md），夹具在 test/fixtures/
scripts/                   仍被测试或门禁使用的脚本；CE 参照源码拉取脚本
docs/                      文档；docs/archive/ 为旧开发记录
.ce-reference/             （git 忽略）npm run ce:fetch 拉取的 CE C 源码
```

## 2. 核心对象

- **`engine/Core/Game.ts`**（约 1.1 万行）：游戏主控。持有网格、玩家、怪物、物品、日志、录像状态；实现玩家命令、物品使用、投掷与法术目标、自动探索/旅行/休息/奔跑、检视与悬停、存读档与录像回放。很多子系统以"端口"（ports 对象）方式注入到纯函数模块中，便于单测。
- **`engine/Core/TimeCoordinator.ts`**：CE `playerTurnEnded` 的对应物——推进时间、调度怪物行动、客观时间块（状态递减、环境更新）、麻痹期间的连续推进。
- **`engine/Core/GenerationCoordinator.ts`**：`generateDepth` → 建造（Architect）→ 蓝图机器（BlueprintEngine）→ 自动生成表（AutoGenerator）→ 楼梯 → 物品与怪物填充。每层种子由 `LevelSeeds` 从开局种子派生；已访问楼层由 `LevelSnapshot` 缓存。
- **`engine/Map/Grid.ts`**：四层地形（`DUNGEON` / `LIQUID` / `GAS` / `SURFACE`；气体实际由 `Environment/Gas.ts` 网格承载），可通行/遮挡等性质由四层 flags 统一派生。地形与 DF 的规则字段在 `TerrainCatalog.ts`、`DungeonFeatureCatalog.ts`，均按 CE `Globals.c` 逐项登记。
- **`engine/Systems/Logger.ts`**：消息通道。区分普通消息、需确认消息（CE `REQUIRE_ACKNOWLEDGMENT`）、可折叠消息；任何消息会置位 disturbed（打断自动行进，对应 CE `message()`）。位置描述行（CE `flavorMessage`）不走日志，由 `Game.flavorText` 承载。

## 3. 一次操作的数据流（命令边界）

```
键盘 / 鼠标 / 触屏
  └─ Input.ts / ui/commands.ts（dispatch）/ ui/touchGestures.ts
       └─ inputManager.triggerAction(action, data)
            └─ GameCanvas 注册的回调 → game.handlePlayerAction(action, data)
                 └─ game.executeCommand(action, data)      ← 唯一的录像边界
                      ├─ applyCommand(...)                  ← 实时输入、回放、自动步进共用
                      │    ├─ 停止旧自动行动、清悬停、结束瞬态显示
                      │    └─ performPlayerAction / 物品命令 / auto_step …
                      │         └─ TimeCoordinator.playerTurnEnded(...)
                      └─ 记录命令与本命令期间的确认决策（commandDecisions）
```

规则：

- **所有改变游戏状态的输入都必须经过 `executeCommand`**（背包内是 `executeItemCommand`）。组件里直接改引擎状态会破坏录像确定性。
- 确认对话框统一走 `requestConfirm`：实时输入时询问用户，回放时读取录像里的决策，不弹框。
- 自动行动（探索、旅行、长休息、连搜、奔跑）每一步都是一条 `auto_step` 命令，同样经过这个边界。

## 4. 随机数

`engine/Random.ts` 的 `rng` 对应 CE 的两条随机流：

- **substantive（实质流）**：影响规则结果的一切（生成、命中、伤害、AI 决策）。录像与存档都校验它。
- **cosmetic（装饰流）**：只影响显示的随机（光照闪烁、舞动颜色、幻觉显示字形等）。

**纯显示代码不得消耗实质流**；UI 自己的动画可以用 `Math.random` 或 CSS。新增 RNG 调用会改变后续所有结果，必须在测试与黄金 trace 上单变量归因（见 `docs/testing.md`）。

## 5. 存档与录像

- **存档**：整局 JSON 快照（`engine/Core/WholeRunSnapshot.ts`，`version: 2`），含全部楼层缓存、实体、两条随机流状态。存储在浏览器 IndexedDB（数据库 `brogue-web-saves`、对象仓库 `checkpoint`，见 `SaveStorage.ts`）。字段的生命周期（新局初始化、中断清空、是否保存）登记在 `scripts/u03-state-contract.json`，由 U03 守卫强制——**给 `Game` 加字段必须同时登记**。
- **录像**：命令日志 JSON（`exportRecording`，`version: 2`）：开局种子 + 逐条命令 + 确认决策 + 检查点（位置、回合、两流随机数）。`loadReplay` / `replayStep` / `replaySeek` 回放时逐条校验，分歧报 OOS（out of sync）。
- 新局自动在内存记录；点击保存录像才写入 localStorage 的 `brogue-web-replay-v1`，导入 JSON 不自动覆盖录像库。游戏中、结算及返回标题后均保留本局保存/导出入口，直至启动或载入另一局。
- `toSaveSnapshot()` 在普通 `toSnapshot()` 的世界投影外附加有效 `run.recordingOrigin`：记录来源、完整命令前缀和影响下一条命令解释的浮层状态。读档校验连续索引及最终位置/回合/双流/终局检查点，验证通过才续录；普通诊断快照和缺失来源的旧存档可读取，但不能冒充完整录像。来源校验不是对任意手改世界的证明。
- 保存录像等待当前命令和强制回合完成；菜单反馈只更新显示，不调用会中断自动行动的游戏日志。
- 开发阶段**不做旧存档迁移**，旧版本录像直接拒绝。
- 本地偏好：显示设置 `brogue-web-display-v1`、镜头 `brogue-web-camera-v1`（与游戏状态无关，不入存档/录像）。

## 6. 显示层

- `engine/UI/Appearance.ts`：格子外观（可见/记忆/测绘/透视、光照乘法、气体着色、记忆变暗），纯函数。
- `engine/UI/TerrainTextCatalog.ts`、`MonsterTextCatalog.ts`、`WorldCatalogText.ts`：地形描述/风味、怪物专属文字，含秘密与记忆的防泄露选择。
- `engine/UI/DetailGenerator.ts` 与 `ItemDetail*.ts`：物品/怪物详情（按 CE `itemDetails` 移植），上下文由 `ItemDetailContext.ts` 组装。
- `components/GameCanvas.vue`：Pixi 渲染、帧循环（动画、自动行进节奏、回放）、鼠标与触屏手势；字形经 `ui/mapGlyph.ts` 强制文本呈现（避免 emoji）。
- 响应式布局见 `ui/layout.ts`（桌面 / 竖屏 / 横屏三模式）。

## 7. 数据与目录

- 游戏数据在 `src/data/*.json`，由 `engine/Items/ItemLoader.ts`、怪物与群落装载器读取。
- 地形、DF、光源、外观、颜色目录都在 TypeScript 里按 CE 行号注释登记；`engine/Map/WorldCatalogAudit.ts` 维护"CE 枚举 ↔ web 实体"的缺位账本（哪些 CE 项有意不激活及原因）。
- 新增目录项时：同步外观、颜色、光源、文字目录与 i18n，并更新对应的目录全集守卫（它们会告诉你漏了什么）。

## 8. 修改时的高风险区

| 区域 | 为什么敏感 | 必须做的 |
|---|---|---|
| RNG 调用顺序 | 改变后续所有生成与战斗结果 | 单变量归因，按原方法重录基线/trace |
| 命令边界 / 确认 | 录像确定性 | 回放零 OOS 守卫 |
| `Game` 字段 | 存档合同 | 登记 `scripts/u03-state-contract.json` |
| 地形/DF 目录 | 生成、寻路、渲染全受影响 | 目录全集守卫、生成基线 |
| 读源码守卫（如 c_4a 白名单） | 新增文件读某些字段会被拒 | 按守卫注释的"扩清单"流程登记并写明 CE 依据 |
