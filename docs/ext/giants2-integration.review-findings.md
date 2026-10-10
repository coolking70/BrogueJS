# giants2 集成 R1 独立审查

2026-10-09；HEAD `8d5f8a6`，ext/phase5，MERGE_HEAD 精确为固定 `357a473e67281e2164ebdcac6f738336598e8027`，索引无U。已读规定文档及外部作者READY/退出回执。**结论：限定范围审查通过，没有新增确证的玩法或存档录像缺陷需要退回作者。加载依赖修复独立关闭；不重开底座审查，不称giants整批一次全绿。**

## 核对与发现

- 九冻结、Game/TimeCoordinator/ItemStatInvalidation、settlement与descriptor对HEAD无差量；definitions/locale与固定源逐字相同。共享差量仅检查点抽取与两条轻入口导入，未覆盖底座三修、R1属性会话恢复或5E1，未改概率/世界规则。WorldCheckpoint无导入，其完整实现逐字等于HEAD协调器原段；旧入口转导出保持同一函数引用。巨兽预加载绕过已撤销，原导入顺序实际通过。
- 旧D12文件逆替换7322→7309并删两行说明即逐字等于HEAD：五项原断言、800/600搜索边界、480000ms门限保留。已核对同底座/seed7309/原路线仅切definitions的失败→通过日志，再选7322；没有混换代码与种子当作因果证明。独立五项复现D15、九成员自然出生、8次断部位、核心HP0，事件1264/1282/1335与作者一致；断部位存档续录、完整世界/事件回放和broken/arrived/last三seek真正进入验证。
- 三旧trace相对固定源仅extensionsHash不同；两新trace仅27个检查点/终点hash叶不同。独立沿三旧捕获入口及两新原公开输入核算：只在离线投影改变foundation的两个13→11字段，即复现固定源摘要；当前摘要亦匹配。灯褶seed1/155事件、铜须seed2/615事件，全部25切点、最终完整世界、commands/decisions及双RNG通过；未将历史manifest载入真实Game。没有新增具体正确性发现。

## 独立窄复核

Node24.19.0、3GiB；Vitest单worker/文件串行、原门限，各批串行。下表为文件与筛选摘要，日志位于外部同目录`review-r1-*.log`，检查点/trace完整argv另见`review-r1-narrow-summary.json`。所有未选项均为-t过滤，所选项无真实skip/todo或缺CE跳过；计数不累加。

| 复核 | exit / 实际结果 |
| --- | --- |
| ext_checkpoint_imports + giants_committed_transition（无过滤） | 0；2文件8通过，3.33s |
| giants_composite_natural整文件 | 0；1文件5通过，106.92s |
| giants2_combinations首个复合过滤（实际仅七模块自然铜须命中） | 0；1通过/15过滤，51.57s；出生、预留避让、save/load |
| 同文件-t `natural contact.*growth` | 0；2通过/14过滤，41.25s；双模块与七模块的自然存读/续录/逐条回放/非单调seek |
| foundation真正第二位两场景 + 三checkpoint文件四指定项 | 0；4文件6通过/52过滤，5.21s；原F1绑定/缓存/属性/对象身份及检查点停止边界保持 |
| giants_trace + giants_spine_trace（无捕获写入、无过滤） | 0；2文件3通过，25.64s |
| review-r1-trace-probe.mjs | 0；38.89s，三旧摘要及两新25切点协议因果核算；非Vitest计数 |

D12测试唯一小型输出仅重定向到同目录`review-r1-d12-summary.json`；没有引擎/harness预加载或断言替换。生产和测试只读，无commit/push、索引操作或代理。

## 作者门禁与覆盖限制

核对[作者报告](giants2-integration.report.md)、commands.jsonl和对应日志：原giants整批exit1、197过/11败，另一个文件0测试收集失败保留；修后持久化/契约2文件29过exit0，13共享205过/1败exit1，boundary/types/build及实际drift7文件14过exit0。后续窄通过没有覆盖原整批退出码。加载环修前/仅切两条依赖/恢复旧依赖的cycle日志因果成立；本轮未修改生产做第二次反事实。

本轮未重复新持久化整文件或几十分钟模块整批；其断部位/转换/失撑/续录/完整回放与seek按作者实际29项日志及未变断言核对。历史17切点raw逐叶对照引用作者结果，8个before切点只有全世界hash投影核算。既有六项全局失败、完整npm/test:ext、CE full/gen、128组合/物理删除、浏览器120格/真机/失焦、最大负载与性能仍留5Z；没有追加问题或提高门限。
