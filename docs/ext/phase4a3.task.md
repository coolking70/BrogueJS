# 4a-3 任务书：方形身体的刻符呈现与通用 UI 投影

> 分支 `ext/phase4`（= ext/foundation `f61a382`，含 4a0/4a-1/4a-2、combat 3a1、3a0）。设计：`docs/ext/phase4-giants.md` r3 §9（渲染/目标/移动端；**D05=A**：实际掩码轮廓 + 一个主字形）、§11 显示时序。前序报告 `phase4a0/4a1/4a2.report.md`。
> 子步：4a-1、4a-2 已完成 → **4a-3（本步）** → 4a-4 giants 模块/原创内容/场地/正式 Boss 血条。

## 范围

1. **身体绘图组**：一只 square 生物在地图上是一个绘图组——身体格细轮廓（按实际 mask 边界画，不画包围盒）、低亮填充、一个主字形放在稳定的已见身体格（完整可见时取中央/固定格）。不要画成 N² 个怪物字形，也不要放大字形盖住相邻危险格。四种地图模式（ASCII/汉字/图块等现有模式）共用占位几何，只主字形随模式变化。
2. **部分可见裁切**：只画玩家当前公开可见/允许感知的身体格；未见尾格不画、不画完整外框；选中/目标描边也按公开格裁切。telepathy/entranced 等只保留原单位置标记（沿 4a-2 的知识规则）。显示不消耗规则 RNG（含幻觉外观不按格重复取随机）。
3. **目标与交互**：鼠标悬停/点击/检视任一公开身体格都解析为同一实体；目标高亮该实体全部公开格；瞄准仍走原“瞄准→确认”，点击同一实体的另一格不得直接确认；手机长按尾格检视同一实体。
4. **侧栏/附近列表**：一只大型者一条 row，显示公开体型（如“2×2”）与原状态/HP；排序取玩家到身体最短同类距离；row 的定位格是稳定公开检视格，不暴露隐藏锚点。Sidebar、ThemeNearby、ContextPanel 等消费同一 row DTO。
5. **显示时序**：`displayProjection`/DisplayFrame 与 `presentationTimeline` 捕获公开 body 数据，旧伤害消息等待（D3 MORE）期间不读未来坐标/HP；录像回放与 seek 清理旧绘图组/hover/目标描边后按当前帧投影。
6. **通用 HUD 插槽**：确认现有扩展 HUD contribution 足以承载 4a-4 的 Boss 血条（名称 + HP 条，读取公开帧 DTO）；若不足，增加通用插槽/展示端口（不写 Boss 专用代码）。
7. **诊断入口（仅开发/向导模式）**：提供一个**不进入正式菜单与生产录像**的诊断方式，在当前层安全位置放置一只 2×2 和一只 3×3 原生 fixture 生物，供维护者浏览器验收（例如 wizard 模式命令或 `import.meta.env.DEV` 下的 `window` 调试函数；使用后该局标记为不可导出生产存档/录像，参照 3a0 的 fixture 导出守卫）。在报告中写明用法。

不做：giants 模块、正式内容、场地生成、正式 Boss 血条内容（4a-4）；任意 mask 生产使用/旋转/zone/复合体。

## 测试与门禁（开发期功能测试政策）

- boundary、`npx vue-tsc -b`、`npm run build`。
- 专项（SFC 共享 harness / 投影单测）：一体一 row/浮字；绘制格与碰撞格一致；隐藏身体裁切；显示刷新不改变规则双 RNG；旧 ACK 帧与未来 HP/位置隔离；seek 清理；尾格悬停/点击解析；瞄准确认不被另一格误确认；无 square 时绘制路径与原来一致（快照或调用计数）。
- 直接相关的既有 UI/投影/渲染测试（displayProjection、presentationTimeline、GameCanvas、Sidebar、targeting、mapPointer、nearbyInspection、dialog D3 等，按实际改动挑选），以及 4a0 零影响差分。
- 浏览器验收由维护者执行（1440×900、390×844、320×844 × 普通/沉浸），你不需要；但请保证诊断入口可用。
- 不跑完整 npm test / 全部 test:ext / removal。Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。

## 交付

- 代码、测试、`docs/ext/phase4a3.report.md`（范围、共享文件函数级改动、诊断入口用法、实际测试与结果、已知限制）。可在干净子里程碑停下并列剩余项。**不要 commit**。
