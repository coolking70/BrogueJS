# 阶段 3f：联动与收尾工作稿

日期：2026-10-05 UTC。基线 `96580f018ec3c8fba8eb27ba598609bd4812df60`，分支 `ext/phase3`。**本报告是开发子步记录，不是完整3f验收；完整门禁须与4f协调，等待维护者通知。**

## 基线与范围

开工对真实 GitHub `coolking70/BrogueJS` 执行 `git ls-remote`，`ext/foundation`、`ext/phase3` 均为 `96580f018ec3c8fba8eb27ba598609bd4812df60`。随后显式 fetch 三条 ref：foundation、phase3 均同上，phase4 为 `a2b58f8`；`git merge --ff-only origin/ext/foundation` 返回 Already up to date。3e 已在双方分支，不重复合并，不重写历史；当前树已经包含4d-4共享合同。

维护者已明确确认保留玩家行动计数，并同意本轮不实现两个新adapter。本步补齐[配置手册](combat-config.md)、已存在软联动的组合验证、[待决定adapter简稿](phase3-adapters.proposal.md)和后续统一验收清单。没有变更招式平衡、成长属性公式、叙事剧情、底座时钟或任何格式版本。

### adapter边界

- 已实现：`combat.part-break.v1`，由 `combat/module.ts` 注册、`combat/partBreak.ts` 提供，与底座fallback互斥；共享部位/群体事务与唯一破坏收据由现有4c/4d底座拥有。
- 已实现的跨模块合作：growth受控技能和combat体力在原有事务中共同提交；原生逐击/死亡事实继续供growth使用；篝火不重置growth专注/冷却或narrative收据。
- **尚未实现/不得冒充已批准具体设计**：设计文档§8.1的 `growth.combat-stats.v1`、`combat.event.v1` 仍为协议提案；§10 P3-D06=A要求属性adapter独立验收。现有 `OptionalQueryContext` 只有player scope，没有可直接借用的可信任意actor查询。属性→容量/恢复映射、容量变动政策及叙事订阅语义没有具体批准，不在本步自造数值或剧情。
- `combat.public-state.v1` 与 `combat.attack-profile.v1` 也不能因设计文档列名而宣称已注册；现有combat UI投影和actorActions绑定是各自现行合同。

## 500tick休息后的HUD回合

这是有意保留的历史口径，不是机械时钟丢失：

- `src/ui/useGameHud.ts` live分支明确注释 CE playerTurnNumber，读取 `logger.turn`；历史显示分支读取 `frame.messageTurn`。
- `src/engine/Core/TimeCoordinator.ts` 玩家回合入口（非麻痹）只递增一次 `logger.turn`。
- `src/ui/displayProjection.ts` 同时保存独立的 `displayTurn=game.absoluteTurnNumber` 与 `messageTurn=logger.turn`。
- 3e的一次休息命令推进500tick/5个客观100tick块，因此命令回合1、客观回合5并不矛盾。没有改任一时钟、录像checkpoint或消息分组。

维护者随后明确认可保留既有“玩家行动计数”口径，本步保留显示。现有真实rest测试补充两种回合投影及只读零副作用断言；该测试不等于真实浏览器像素验收。

## 新增组合测试与独立审查

`combat_combinations.test.ts` 从实际安装描述符发现所有包含combat的启用子集（本次8个），不硬import growth/narrative/giants目录。在未改地图、HP、出生、RNG或内容包的normal seed7397中，执行真实命令：自然出生敌人实际受到玩家原生伤害，三个生产招式、弹反尝试、一格闪避实际位移、完成篝火休息。三招式沿用当前生产的 `fixture.*` ID，不注入fixture包；正常D1用例不冒充深层giants自然遭遇证明，也不把接受弹反/闪避命令冒充成功防御判定。

每条命令对比完整机械存档投影（仅排除墙钟savedAt及live/replay各自输入缓冲）、两RNG状态/调用数；逐条replay、前后seek、完成休息后的save续录保持唯一休息收据。8组合共112次损坏save/replay拒绝覆盖模块版本、规则指纹、重复模块和缺模块，明确允许错误消息显示，但不退休原玩家/runtime、不变机械世界/输入/实体分配器/两RNG。这里仍是启用组合和坏manifest验证，不是物理删除矩阵。

独立只读审查核对配置手册、adapter提案、报告、HUD新增断言及组合测试，发现并修正文档的四处易误解表述：载入按存档manifest而不是当前菜单/旧局启用集合；休息不额外回满growth专注但普通时间恢复/冷却继续；HUD指玩家行动计数而非按钮数量；弹反在普通命中骰前按合资格物理接触消耗窗口。没有修改生产逻辑来迁就说明，也没有放宽旧断言。

开发草稿问题均限新测试：错误snapshot时钟字段、过晚休息被自然敌情中断、空的续录索引和负零移动delta；通过调整真实命令次序/合法保存点修正，不压制敌人或改生产规则。HUD初次新增投影断言漏传logger参数，修正后原文件47项全绿。最终首轮type发现新测试3处Array.at不在项目TS目标库内，改成既有风格的下标last辅助函数；首轮type exit2，build/相关批次尚未运行，不算通过。随后重新冻结并重跑全套本步相关门禁。

## 开发期验证

最终同一冻结候选：Node24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest最多2 workers。

| 命令 | 实际结果 | 耗时 |
|---|---|---|
| `node scripts/check-module-boundaries.mjs` | exit0，边界与测试唯一归属通过 | 3.908s |
| `npx vue-tsc -b` | exit0 | 21.858s |
| `npm run build` | exit0，保留既有大chunk提示 | 30.317s |
| `npx vitest run <下列10文件> --maxWorkers=2` | **10文件199项全部通过，0失败/skip/todo，exit0** | Vitest107.89s；runner108.8s |

精确相关文件：combat模块的 `combat_bonfire_runtime`、`combat_bonfire_definitions`、`combat_part_break`、`combat_part_break_runtime`、`combat_native_stamina`、`combat_square_replay`、新增 `combat_combinations`；growth模块的 `ext_growth_skill_integration`；底座 `ext_optional_queries`、`ext_optional_rewards`。全部为 `.test.ts`，未用全部test:ext入口。8个normal自然组合包含在新增文件中；未另跑全16组合脚本。

917份src/scripts/package/tsconfig/vite输入逐文件SHA-256在每个门禁前后均一致，changedInputs均为空；路径排序紧凑JSON哈希清单摘要 `ed695b01963a279dd19fc5d2a6cf9ba82ad11a629e22a13a59446f4dea63f8ca`。门禁之后仅补报告。生产、数据和版本相对96580f0零改动；仅新增/增强模块自有测试、登记及文档。LF、文档相对链接、`git diff --check`通过，独立只读审查无剩余blocker。

最终再次 `git ls-remote` 确认foundation/phase3仍为96580f0，phase4仍为a2b58f83a9e4255b4f3be9499efd3b9399301202。证据命令/退出码/逐文件hash及日志保留在执行环境的3f验证目录；原始大日志不提交。CE源码不存在的通用提示保留，本次定向集合实际0skip，没有隐藏缓存或运行CE门禁。

仅完成本次授权的开发子步验证，不以这些定向结果替代完整门禁或完整3f验收。

## 与4f共同收尾：仍未运行

以下全部保持pending，只有收到维护者通知并整合双方最终提交后才开始：

1. 正常最终树完整 `npm test` 一次，全部 `test:ext`、完整安装子集smoke；记录真实skip/todo/失败，不拼接定向结果充数。
2. 按最终发现器清单做所有实际目录删除副本；每行跑boundary/type/build、全部剩余ext、剩余组合与缺模块旧档/录像拒绝。当前四模块应为16保留组合、15删除行；执行时重新发现，不硬编码跳过新模块。删除行不重复完整npm test。
3. 最终统一源代码完整性检查及独立审查；若4f改变共享合同，先补受影响回归，不能沿用本步绿灯。
4. 设计§9要求的六布局、四地图、历史帧、输入屏障、触控与自然战斗/rest/giants可选行为浏览器验收。引擎测试不冒充浏览器或真实设备；维护者3e combat-only休息实测是已有证据，不冒称本轮新测。
5. 按实际生成改动决定相关drift。当前仅测试/文档改动，无新地图生成改变，不新增基线或重录黄金trace。

没有合main、tag或部署，没有开启下一阶段，没有宣称3f完整完成或已验收。
