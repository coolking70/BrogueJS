# LAVA-1 试玩录像中的熔岩断路

用户授权：2026-09-30「请开始尝试修复该问题」。录像种子 437995121，D4 levelSeed 15318643；旧地图墙角斜跨熔岩是唯一无伤通路，没有关联机关。

范围：按 CE `Architect.c:lakeFloodFill/lakeDisruptsPassability` 保留四方向干地连通（四层 T_PATHING_BLOCKER，TM_CONNECTS_LEVEL 例外）；按 `Movement.c:diagonalBlocked/playerMoves` 收口手动移动墙角检查，保留穿墙可攻击目标和 bump 的执行顺序。自动寻路不加入踩陷阱/熔岩的危险兜底。

步骤：先写失败回归，修生产，再核对原种子与多层样本；基线/trace 如变化，先仅回退生产作单变量反事实，再按原方法重录并逐叶登记。旧用例布景失效同样先反事实，不放宽行为断言。

验收：build、ce:fetch、test:full（覆盖 npm test 的完整集合，启用 CE）、test:drift、真实浏览器键盘与点击通行、录像命令/RNG 边界。截图与大体积日志存 /tmp，不入库。使用 codex/lava-connectivity 独立工作树，暂不合并/推送/发布。
