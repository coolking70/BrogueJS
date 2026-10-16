# 6B4 生成夹具逐字段变化

原 first-hit finder 分别在43f115b原树与当前树执行；全体实例v1→v2单列，不在下表重复。开启符文族改变候选池及后续取骰；R06/R07/R08筛选前提和R08/R16种子变化见主报告。原SSR由Vitest原入口重新捕获，未手写快照结果。

| 字段 | 原值 | 当前值 |
| --- | --- | --- |
| `R08.data.affixes` | `[{"id":"loot.affix.keen","tier":3,"values":[5867],"known":false},{"id":"loot.affix.swift","tier":3,"values":[-1031],"known":false},{"id":"loot.affix.precise","tier":4,"values":[2650],"known":false},{"id":"loot.affix.giantsbane","tier":4,"values":[8973],"known":false}]` | `[{"id":"loot.affix.keen","tier":2,"values":[2896],"known":false},{"id":"loot.affix.giantsbane","tier":4,"values":[6810],"known":false},{"id":"loot.affix.brutal","tier":2,"values":[1,4],"known":false}]` |
| `R08.data.baseId` | `"war_axe"` | `"flail"` |
| `R08.data.nameParts` | `[5,4]` | `[13,6]` |
| `R08.seed` | `146` | `397` |
| `R10.data.affixes` | `[{"id":"loot.affix.swift","tier":2,"values":[-778],"known":false},{"id":"loot.affix.titan","tier":3,"values":[1],"known":false},{"id":"loot.affix.leech","tier":2,"values":[1],"known":false},{"id":"loot.affix.giantsbane","tier":2,"values":[3505],"known":false},{"id":"loot.affix.honed","tier":5,"values":[3],"known":false},{"id":"loot.affix.dull","tier":2,"values":[-1500],"known":false}]` | `[{"id":"loot.affix.swift","tier":2,"values":[-778],"known":false},{"id":"loot.affix.leech","tier":3,"values":[1],"known":false},{"id":"loot.affix.titan","tier":2,"values":[1],"known":false},{"id":"loot.affix.giantsbane","tier":2,"values":[3505],"known":false},{"id":"loot.affix.honed","tier":5,"values":[3],"known":false},{"id":"loot.affix.dull","tier":2,"values":[-1500],"known":false}]` |
| `R16.data.affixes` | `[{"id":"loot.affix.adept.strength","tier":4,"values":[2],"known":false}]` | `[{"id":"loot.affix.plated","tier":4,"values":[3],"known":false},{"id":"loot.affix.adept.strength","tier":4,"values":[2],"known":false}]` |
| `R16.data.baseId` | `"broadsword"` | `"leather_armor"` |
| `R16.itemIndex` | `1` | `0` |
| `R16.seed` | `9` | `39` |
| `R17.data.affixes` | `[{"id":"loot.affix.antivenom","tier":4,"values":[3029],"known":false},{"id":"loot.affix.mending","tier":6,"values":[3],"known":false},{"id":"loot.affix.plated","tier":4,"values":[2],"known":false},{"id":"loot.affix.reinforced","tier":5,"values":[4160],"known":false},{"id":"loot.affix.warding","tier":4,"values":[-1062],"known":false}]` | `[{"id":"loot.affix.rune-a-absorption","tier":4,"values":[6],"known":false},{"id":"loot.affix.mending","tier":6,"values":[3],"known":false},{"id":"loot.affix.plated","tier":4,"values":[2],"known":false},{"id":"loot.affix.reinforced","tier":5,"values":[4160],"known":false},{"id":"loot.affix.warding","tier":4,"values":[-1062],"known":false}]` |
| `E-W.data.affixes` | `[{"id":"loot.affix.precise","tier":2,"values":[1330],"known":false}]` | `[{"id":"loot.affix.swift","tier":2,"values":[-888],"known":false}]` |
