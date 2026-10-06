# 阶段 3/4 收尾补丁任务书（浏览器验收发现）

> 分支 `ext/polish-3-4`（基于 ext/foundation `2cd10a5`，阶段 3/4 收尾门禁已全部通过）。来源：维护者浏览器全面验收（全部检查项通过，以下为遗留问题）。
> 门禁按开发期政策：只跑与改动相关的测试 + boundary + `npx vue-tsc -b` + `npm run build`；不跑完整 npm test / 删除矩阵。

## 1（中，仅 DEV）调试夹具污染后续真实对局
- `src/engine/Core/ActorActionSession.ts` 的 `fixtureGames` WeakSet 从不清除：页面里执行过 `window.debug_combat_telegraphs()` 后，同页新开启用 combat 的对局报错 “Cannot bind production actor actions to a fixture or invalid run”。
- 修复：夹具标记只作用于夹具 Game 实例本身（确认新 Game 不会被误判；若是同一实例被复用为新局，新局开始时清除标记或改用一次性 token）。补回归：创建夹具 → 新建真实 combat 对局可正常绑定。

## 2–8（低，界面）
2. `.combat-telegraph-hud` `max-height: 72px` 裁掉最后一行：改为按内容自适应（设合理上限并可滚动），320/390 宽下不遮挡关键地图区域。
3. 320px 宽时“篝火”按钮溢出战斗操作栏：换行/缩短/图标化，保证在栏内。
4. 侧边栏怪物名称/状态被截断：允许两行或 tooltip/title 显示全文，320/390 下不溢出。
5. 日志缺失：弹反成功、篝火休息完成、篝火休息被打断 三类事件补日志（i18n 中英文键，沿用现有日志颜色约定；不重复刷屏）。
6. 离开 NPC 后“附近的人”标题残留为空列表：列表为空时隐藏整个区块。
7. 地图缩放按钮半透明难辨：提高不透明度/对比度（亮暗主题都检查）。
8. 角色页“加载中”按钮文字溢出：按钮宽度/文字截断处理。

## 约束
- 只改与上述问题相关的 UI/日志/DEV 调试代码；不改规则数值、存档/录像格式、版本号。
- 新增 i18n 键需中英齐全，跑 i18n 相关测试。
- UI 改动给出改动的组件/样式清单与在 320/390/桌面宽度下的预期效果说明。

## 交付
- `docs/ext/polish-3-4.report.md`：逐项原因、改动、测试命令与结果。**不要 commit**。
