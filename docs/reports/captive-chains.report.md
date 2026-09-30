# CAPTIVE-1 俘虏锁链修复

用户2026-10-01试玩反馈已定位：这是生成步骤缺失，不是hover、字体或缩放问题。

## CE 证据

Legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9 Monsters.c:767-785 / :869-878与官方upstream 104a20fedbe7d9360d2dfc8ff665571694212ad8 Monsters.c:758-776 / :860-869执行路径一致：对普通地形的俘虏生成四组链锚，试斜角→竖向→横向，只允许DUNGEON=FLOOR、LIQUID=NOTHING，直接替换SURFACE。特殊地形俘虏（笼子等）例外。Globals.c:480-487八种链锚均无旗标/随机数/光源，前景gray、背景透明、drawPriority=20。Movement.c:741-758救出后不清除链锚。

## 修复

- spawnHordeAt 原只设俘虏状态和血量，现在按CE接入placeCaptiveManacles。选址帮助函数只读取Map；由已有地形生成写入者 Architect 应用表层写入，原守卫白名单不变。
- 追加6种地形，保持旧枚举ID；补齐层/优先级/属性/色彩/外观/文本目录，删除错误unused-decoration缺位声明。不新增Game状态字段。
- 原版/精修字符用方向符号，全汉字模式用地图本地化文本，图块模式按已知地形方向绘链环，仍经原Appearance可见/记忆门限。
- 救出后留下地面链锚，不随怪物移动，与CE一致。自然相邻俘虏的锚点可以重叠，后生成的方向覆盖前者，与CE直接写SURFACE一致。

## 前提修订与基线归因

新红灯：生成基线、UR3、图形目录历史208数量；构建提示C7的Record<TerrainType,number>夹具缺新6项。仅回退本轮10份已跟踪生产文件、暂移新模块及新测试，不动原测试/夹具：build exit0，三份失败文件原7项全通过。finally恢复新生产，证据/tmp/bjs-captive-chains/counterfactual.json。

仅补C7新6项NO_LIGHT期望、将目录历史精确数量208改214，断言语义/容差/超时/skip均不变。基线按原harness+terrainFingerprint方法重录，UR3使用原UR3_CAPTURE=1。深层基线、UR2、UR4未变。

逐叶登记见captive-chains.fixture-diff.json（不是仅登记hash）。原UR3探针保存的哈希输入重现原黄金trace；新旧同口径比较120份快照输入的4076个变化叶子：
- SURFACE地形和结果terrain各2019处（含缓存楼层在后续快照中重复出现）。
- isOpaque 32处：种子20260913的D13 (74,7)、D20 (66,5)、D25 (39,2)原FUNGUS_FOREST按CE被链锚表层替换，遮挡消失；三格在后续楼层缓存及重访中重复登记。新回归验证覆盖菌林时不消耗RNG。
- rememberedTerrain / rememberedLayers[3] / rememberedAppearance.char 各2处：重访D25时将已看见的链锚记入记忆，加上返回后的缓存副本。
- 其他字段无变化，包括两条RNG、实体、物品、机关观察、日志。

D1-D26的104层中37层指纹更新；怪物数/物种/物品数未变。原始快照与截图仅留/tmp，不提交大体积证据。

## 验收状态

新回归、目录/光源定向检查通过；真实Vue/Pixi浏览器已验自然seed777俘虏四模式显示、缩放、切换模式不改存档/RNG、键盘救出原生确认、链锚留存。浏览器布景仅移动玩家并移除其他敌人以隔离展示，不冒充自然探索过程。标准客户端已跑，Canvas直接读回仍为黑，已用有头浏览器页面合成截图核对实际地图。

另四份旧目录/外观文件在新生产下失败；仅回退生产时 c_4a_terrain_catalog、x4_r5_content_text、r_1_appearance、map_tile_modes 原100项全过（counterfactual-counts.json）。只更新精确214计数，旧135地形投影仍保持；用原CE源码提取方法 scripts/capture-captive-appearance.mjs 补独立六项外观夹具，旧外观夹具字节未动、全部可见/记忆断言不变。最终build和显示相关5文件87项通过。

开阔房间布景另验四条斜链、真实鼠标救出确认；四模式合成截图已查看。390×844、844×390响应式窗口无水平溢出，未声称真实手机硬件验收，控制台零错误。本轮修复新生成俘虏，按项目决策不为旧存档里已生成的楼层补链。

首轮完整冻结门禁会话75648已全部结束，证据 /tmp/bjs-captive-chains/gates/state.json：build/ce:fetch/drift exit0，full exit1（259文件：257通过、2失败；4642通过、3失败、8历史skip、5todo）。前后SHA256均为d6c9838f90a9c33f78475d76dd5cf3494d14b08c56b58fa7d5ec8e578175745f。三项均非超时：C4a0期望表漏新增地形、写入模块不在原白名单、C4b旧F3组合未包含新链锚。首轮不能视为通过。

仅回退生产的第三轮反事实：原 C4a0/C4b 的相关6项全通过（counterfactual-layer-contracts.json，其他45项由命名过滤，不是新增skip）；finally恢复生产。最终修正：
- C4a0手写完整层/优先级期望仅补CE六项，写入白名单原样保留。
- Map/CaptiveManacles改为纯选址，Architect应用原顺序的写入。选址仅读DUNGEON/LIQUID，写入只改SURFACE，两者无依赖，结果等价。
- C4b F3对新增六种链锚单独要求下三层恰为FLOOR/NOTHING/NOTHING，不放入宽泛的DF装饰例外。
- 新回归增加全存档与双RNG不变的纯选址检查，共13项；build exit0，定向3文件19项通过，旧写入边界与多层合同恢复。
- 重构后UR3和生成基线2文件2项精确通过（refactor-traces.log），无需再次更新夹具。

重构后的最终标准客户端退出0，4条输入事件；Canvas读回黑图限制仍存在。再次运行真实Vue/Pixi有头浏览器并查看页面合成截图：自然seed777与开阔布景的四模式锁链、真实键盘/鼠标确认救出、模式切换世界与双RNG不变、390×844及844×390无横向溢出，控制台零错误。证据 /tmp/bjs-captive-chains/browser-final/ 和 standard-final/。

第二轮完整冻结门禁采用与首轮相同的2 workers、4GB堆、原超时/断言，串行build→ce:fetch→test:full→drift；保留首轮失败证据，最终结果另存 /tmp/bjs-captive-chains/final-gates/state.json，现已全部结束并通过。当前分支codex/captive-chains，未合并/推送。


## 最终裁决（2026-10-01）

最终会话83665：Pages基路径build / ce:fetch / test:full / test:drift均exit0。完整CE套件259文件全过，4646passed、0failed、8历史skip、5todo（4659总数），3359.65秒；drift 1文件1项通过，25.68秒。北京时间03:14:34全链结束。冻结前后生产/测试/脚本/资源SHA256均为64b47a05cdb15a78ee4f0451ab43cabdb072f2b7aad4d195c557b2d2e14c57c2。

首轮的C4a0两项与C4b F3一项已在同一轮完整集合中通过；不是定向拼接或超时复跑。原守卫写入白名单、断言语义、容差、超时和skip保持；历史外观夹具不变；所有基线重录均已做生产反事实并逐字段登记。新13项回归在强制启用CE的完整门禁中全部通过。

修复完成后只补文档。主仓main仍为997872f且干净，修复保存在独立codex/captive-chains，未合并、推送或发布。开发预览 http://127.0.0.1:5395/ 保留。新生成的俘虏按CE布链；旧存档里已经生成的楼层不做迁移补链。
