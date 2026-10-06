# 6B1-α v1.1 调参落地任务书

> 分支 `ext/phase6-loot-core`（当前 HEAD 含 `docs/ext/phase6-loot-tuning.md`，维护者 2026-10-07 已批准“全部按推荐”）。只改 `src/ext/modules/loot/**` 与 loot 自有文档；不改其他模块与共享文件。

## 范围
1. 按 `phase6-loot-tuning.md` 的 v1.1 最小数据补丁修改 4 个字段（presets.json 三个 `encounter.uniqueWeightBp`；affixes.json `loot.affix.warding.itemClasses` → `["armor"]`）。
2. loot rules 版本 0.1.0 → 0.1.1；更新 rules 指纹相关断言。
3. 同步更新写死旧数值的转录断言与固定向量（loot_data、loot_catalog、V7/V8/V22/V23 等）：向量必须由生成器按新数据重新逐抽推导并在测试注释中写明，不得只改期望值凑通过；抽取次序与规则代码不变。
4. 修统计工具 B 类口径（见调参文档 §B）：唯一“机会”按降级前计；稀有件数剔除唯一降级件；整数格容差合理化。补充“一致装备”减伤代理与现有乐观代理并列输出。
5. 用新数据重跑 300 局×3 预设统计，更新 `docs/ext/evidence/phase6b1a-loot-stats.json`，并在 `phase6b1a.report.md` 追加“v1.1 调参”节：前后对比表、剩余标记逐项归类（应只剩 A/D 类）。
6. 同步把 `phase6-loot-numbers.md` 的 v1.1 勘误（A1–A8）与改目标值写入（标注 v1.1）。

## 门禁
boundary、vue-tsc、build、loot 与 narrative 模块测试。不跑完整 npm test。**不要 commit。**
