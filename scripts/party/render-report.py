import json,collections,pathlib
x=json.load(open('/private/tmp/party-p0/inventory.json'))
p=pathlib.Path('docs/ext/party-p0.report.md');s=p.read_text()
classes=collections.Counter(r['category'] for r in x['entries'] if r['scope']=='production')
table='| 主类别 | occurrence | 含义 |\n|---|---:|---|\n'+'\n'.join(f'| {k} | {classes[k]} | {v} |' for k,v in [('A','焦点/显示'),('B','全队共享/世界枚举'),('C','按成员/actor 能力'),('D','终局/录制/持久生命周期')])
s=s.replace('<!-- P0_CLASS_TABLE -->',table)
budgets={'src/engine/Core':'1800–3500 行；调度/命令/持久化主风险','src/entities':'450–900 行；能力/敌对目标','src/engine/Combat':'350–700 行；双解算器及法术归属','src/engine/Map':'150–350 行；多源感知/安全图','src/engine/Movement':'150–350 行；占位/换层','src/engine/UI':'100–250 行；上下文 DTO','src/engine/Items':'100–200 行；actor 参数','src/engine/Generator':'50–150 行；入口/全队落点','src/engine/Stats':'30–100 行；来源事实','src/ext':'250–500 行；SDK/manifest/codec','src/components':'250–600 行；组件绑定','src/ui':'150–350 行；输入/投影'}
table='| 子系统 | A | B | C | D | 合计 | 预计改动量/重点 |\n|---|---:|---:|---:|---:|---:|---|\n'
for f,v in x['bySubsystem'].items():table+=f"| `{f}` | {v['A']} | {v['B']} | {v['C']} | {v['D']} | {v['total']} | {budgets.get(f,'模块每包约50–200行；创建/资源/命令或UI适配' if '/modules/' in f else '约20–50行；装配/焦点')} |\n"
s=s.replace('<!-- P0_SUBSYSTEM_TABLE -->',table.rstrip())
table='| ID | 类别/风险 | 当前执行位置 | 迁移要求 |\n|---|---|---|---|\n'
for r in x['semanticSites']:table+=f"| {r['id']} | {r['category']}/{r['severity']} | `{r['file']}:{r['line']}` | {r['migration']} |\n"
s=s.replace('<!-- P0_SEMANTIC_TABLE -->',table.rstrip())
table='| 文件 | A | B | C | D | 合计 | 首处 | 复核范围 |\n|---|---:|---:|---:|---:|---:|---:|---|\n'
for f,v in x['byFile'].items():
 first=next(r['line'] for r in x['entries'] if r['scope']=='production' and r['file']==f)
 size='系统拆分' if v['total']>=150 else '接口/调用链' if v['total']>=20 else '局部接线/兼容核对'
 table+=f"| `{f}` | {v['A']} | {v['B']} | {v['C']} | {v['D']} | {v['total']} | {first} | {size} |\n"
s=s.replace('<!-- P0_FILE_TABLE -->',table.rstrip())
table='| 归属 | 字段数 | 完整字段名 |\n|---|---:|---|\n'
for c in 'ABCD':
 names=[r['name'] for r in x['stateFields'] if r['category']==c]
 table+=f"| {c} | {len(names)} | "+'、'.join('`'+n+'`' for n in names)+' |\n'
s=s.replace('<!-- P0_STATE_TABLE -->',table.rstrip())
s=s.replace('8145 个 occurrence / 4948 个去重源码行 / 153 个文件','9048 个 occurrence / 5571 个去重源码行 / 158 个文件').replace('测试 **16354**','测试 **19462**').replace('153 个生产文件','158 个生产文件')
s=s.replace('避免把两个作用域的同名变量算成同一别名。','避免把两个作用域的同名变量算成同一别名。另提取 Game 内部直接依赖 this.player 的 223 个方法，枚举其同名调用点，记录 dependency 来源；这是保守调用候选，异类对象同名方法需排除。')
s=s.replace('`src/engine/Core/RecordingV4.ts:66`','`src/engine/Core/RecordingV4.ts:73`').replace('`src/engine/Core/RecordingDigest.ts:24`','`src/engine/Core/RecordingDigest.ts:20`').replace('`src/engine/Core/RecordingV4.ts:47`','`src/engine/Core/RecordingV4.ts:45`').replace('`src/entities/Player.ts:31`','`src/entities/Player.ts:30`').replace('`WorldItemRoots:34`','`WorldItemRoots:30`').replace('`ActorNeeds:104`','`ActorNeeds:96`')
s=s.replace('任务书所述 `769f6fc` 是分支来源，本报告证据绑定实际 HEAD。','任务书所述 `769f6fc` 是分支来源；两者仅相差设计稿与任务书两份文档，源码一致，本报告证据绑定实际 HEAD。')
p.write_text(s)
