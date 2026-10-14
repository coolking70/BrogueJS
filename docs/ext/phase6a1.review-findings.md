**需修，暂不建议将当前 C6-1 候选作为 6B1 的验收冻结版。** 已读 AGENTS.md；全程未修改文件。以下均有代码路径依据，关键问题已用不落盘探针复现。

1. **S1：否定爆发使合法物品变成无法保存的状态。**  
   [Game.ts:8311](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Core/Game.ts:8311) 直接将地面戒指 `identified=true`，未同步 `moduleData` 知识。  
   **复现：** 中性 fixture 的未知戒指置于爆发范围，执行原生否定爆发后得到 `identified=true / known=false`，随后 `toSnapshot()` 抛 `C6_VALIDATOR`。  
   **修复方向：** 把此原生写入口接入受控知识同步，并保持 CE“实例已知、种类未必已知”的区别；同步失败须原子回滚。

2. **S2：碎片鉴定成功扣料，却没有完成整件鉴定。**  
   [ItemCommands.ts:82](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Core/ItemCommands.ts:82) 只设置模块数据、`identified/canBeIdentified`，遗漏原生种类知识及 `runicKnown`。  
   **复现：** 消耗十碎片且提交成功后，戒指仍显示“黑曜石戒指”；符文匕首仍显示 `Dagger (unknown runic)`。  
   **修复方向：** 宿主提供完整鉴定提交口，同步原生及 owner 知识、摘要和缓存；戒指真实有效点数变化时仍须机械失效，不能一律视为纯知识变化。

3. **S2：vault 转换拒绝后重新抽全武器池，改变投掷概率。**  
   [Game.ts:1458](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Core/Game.ts:1458)、[Game.ts:1512](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Core/Game.ts:1512)。  
   **复现：** 无指定基底、无 qualifiers 的武器请求先分到近战；provider 返回 `converted=false`，后续仍能抽出 javelin。全部拒绝转换时，投掷概率由 **20/140＝14.29%** 变成 **26.53%**。  
   **修复方向：** 回退保留已经确定的分支；同时补未接管投掷路径的抽骰次数与顺序向量，避免额外分流骰。

4. **S2：盟友遭遇主体死亡仍领取遭遇奖励。**  
   [Game.ts:11112](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Core/Game.ts:11112)、[Game.ts:11136](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Core/Game.ts:11136)。  
   普通 kill 检查盟友/克隆/无奖励资格，encounter 终结只传 `administrative`。  
   **复现：** 中性遭遇主体设为盟友后死亡，`settled:0→1、watermark:0→1`，仍发奖。  
   **修复方向：** 为遭遇终结应用死亡资格排除，并正确传播至分裂遭遇的失效状态；不能直接依赖仅在 kill provider 存在时登记的出生表。

5. **S2：JSON 安全检查会先执行数组 getter，再拒绝数据。**  
   [ItemData.ts:23](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Items/ItemData.ts:23)。  
   `.every()` 在描述符验证之前读取元素。  
   **复现：** 给数组索引 `0` 安装 getter，验证最终抛 `C6_DATA`，但 getter 已执行一次。这违反“安全检查前不读取访问器”的合同。  
   **修复方向：** 完全通过长度、索引和属性描述符检查稠密性；通过后只递归 `descriptor.value`。

6. **S2：熟悉度空操作每次也复制完整世界，新增持续性卡顿。**  
   [ItemLoader.ts:927](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Items/ItemLoader.ts:927)、[runtime.ts:1894](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/ext/runtime.ts:1894)。  
   事务包装发生在“已鉴定／无需处理”的检查之前；客观时间块会遍历护甲与两枚戒指。  
   **复现：** 对已鉴定 C6 护甲调用一次熟悉度处理，返回 `null`，仍触发一次完整 checkpoint，实测约 **52ms**。  
   **修复方向：** 无操作先返回；普通倒计时避免完整世界快照，真正揭示时保留完整事务保护，并消除嵌套鉴定重复 checkpoint。

7. **S2：两项性能超标可复现，主要存在重复计算。**  
   [StatPipeline.ts:412](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/engine/Stats/StatPipeline.ts:412)、[runtime.ts:443](/Users/coolking70/Documents/同步空间/BrogueJS-p6/src/ext/runtime.ts:443)。  
   **复测 median/P95：** 冷查询 **0.184/0.202ms**；装备比较 **5.377/5.688ms**。一次比较的 36 个注册键导致 **35 次 provider.collect**。每次又重复冻结装备事实、复制 state、执行策略前后校验及管线校验，DAG memo 也逐键重建。  
   **修复方向：** 在一次 hypothetical 内共享脱离实体的事实、已验证来源和 DAG memo；冷查询复用本次求值的装备投影，并按可靠 revision 缓存不可变校验结果。保留全部预算守卫及 hypothetical 不污染活局的约束。

冻结清单的 **367 条散列全部匹配**。公式前属性节点、能力发现及缺 growth 属性时的 fallback 已有实物；本轮未发现名称/外观投影额外泄露、终结时分配 ordinal 的乱序漏发，或死亡事务回滚的新增确证缺陷。但上述知识同步、事件资格与回退语义尚未闭合，接口“存在”不足以判定 6B1 已可安全接入。

验证范围：Vitest 使用 `--maxWorkers=1 --no-cache --configLoader runner`，因只读沙箱禁止创建临时 SSR 目录，**未执行任何用例**；上述复现使用内存 Vite 探针。未执行完整回归、真实模块删除矩阵或浏览器验证，不将这些范围判为通过。