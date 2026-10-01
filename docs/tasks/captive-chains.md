# CAPTIVE-1 俘虏锁链显示修复

用户2026-10-01反馈：可救出并成为同伴的俘虏怪物，缺少原版几个方向的锁链。

## 根因和规格

CE legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9 Monsters.c:767-785 / :869-878，与官方 upstream 104a20fedbe7d9360d2dfc8ff665571694212ad8 Monsters.c:758-776 / :860-869 执行一致：
- 非特殊地形的 HORDE_LEADER_CAPTIVE 在生成时绘制四组锁链，顺序 TL/BL/TR/BR，各自先斜角，再竖向，再横向。
- 落点 DUNGEON 必须是 FLOOR，LIQUID 必须是 NOTHING；SURFACE 直接替换，不消耗随机数。
- 八种 MANACLE_* 地形都是优先级20、灰色前景、透明背景、无旗标、无光源的装饰。
- Movement.c:741-758 救出后只改阵营与俘虏状态，不删除地面锁链。
web spawnHordeAt 只设 isCaged/血量，未调用锁链生成；目录仅有MANACLE_L/T，其余6种被错记为 unused-decoration。

## 实施与验收

1. 先失败回归，补齐方向地形（枚举只追加）、层/属性/色彩/文本目录，接入真实horde生成入口；Map 帮助函数只选址，Architect 作为已有地形生成写入者落地，保持写入白名单不变。
2. 沿用 Appearance 的可见/记忆门限；四种地图模式可见，矢量方向对齐，不显示未知地形。
3. 验证落点回退/水与笼子排除/无RNG/存档/命令救出/链锚留存；原始证据 /tmp/bjs-captive-chains。
4. 生成改动用完整门禁：build + ce:fetch + test:full + test:drift；同一集合不重复跑 npm test。不降低守卫/超时。基线或黄金trace变化先做仅回退生产的反事实，再用原方法重录并逐字段登记。
5. 真实Vue/Pixi浏览器验证四模式、救出、缩放与横竖响应式窗口，查看合成截图与控制台；窗口模拟不等同于手机硬件验收。

工作树 /Users/coolking70/.codex/worktrees/playtest-fixes/BrogueJS，分支 codex/captive-chains，基于 main 997872f。不混入其他修改；先独立验收，用户随后已授权合并推送。

状态：2026-10-01修复及验收完成。完整CE259文件4646项与drift全过，四模式真实浏览器及救援操作通过；详细反事实、夹具登记和两轮门禁结果见 docs/reports/captive-chains.report.md。修复提交fb79ace已按后续授权快进main，推送由已有Pages工作流部署。
