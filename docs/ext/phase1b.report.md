# EXT-1b：通用求值器、属性与原物品成长

分支：`ext/foundation`；起点：已验收 `562fe96ded76d1827aeeceb962d6072aa00ad111`。1a1 性能剩余逐层小幅增长已获接受，本步不实现生产 undo journal。范围仅已批准的 P01/属性/原物品与生成写集差分回归；没有推进1c–1e。

状态：**1b 实现、独立审查和最终完整/CE 五项门禁全部通过**。已停在1b等待验收；没有进入1c。下列定向预检与最终完整运行分别记录。

## 实际生产修改范围

- 引擎：`src/engine/Combat/Combat.ts`、`Core/Game.ts`、`Items/ArcanaEnchantment.ts`、`Items/ItemEffectFormulas.ts`、`Items/ItemUseCoordinator.ts`、`UI/DetailGenerator.ts`
- 实体：`src/entities/Monster.ts`
- 扩展桥：`src/ext/types.ts`、`runtime.ts`
- growth：新增 `evaluator.ts`、`attributes.ts`、`items.ts`；更新 `components.ts`、`module.ts`、`state.ts`、`schema.ts`、`index.ts`、`definitions.ts`/JSON
- 无新增 Game 实例字段，U03 清单未改；只有扩展会话的策略原型/搜索模式使用 WeakMap/WeakSet，并在会话退休重绑

moduleVersion/rulesVersion 同升 1.2.0，数据 schema 仍为1，精确配置指纹与manifest拒绝旧1.1.0输入，不迁移。未修改任何既有测试断言/前提/超时、黄金 trace、生成基线或CE参照。

## P01 与实际端口

P01 只有已验证数据和只读快照：常数/属性/等级幅度、AND条件、共享加法预算、命名乘法槽、全局钳制与舍入、保零/正值及冷却比例下限。乘法同槽按 `1 + Σ(factor−1)` 合并后钳制并只乘一次，不按注册先后覆盖。攻守物伤使用完全一致的共享kernel配置，合并双方预算后一次缩放。

实际接线：近战和投掷命中/直接物伤，潜行，手动和自动搜索，最大生命/力量差额，专注容量/恢复间隔和冷却时长纯端口。原必中/必失短路和概率100%原取骰分支优先；原命中精度仍向下取整。技能执行/效果消费/专注客观时钟仍属1d，身份/模板属1e。配置只声明并不使12样例技能或身份生效。

经典原 Combat solver 和 Game 原潜行/搜索函数体保持；扩展在已有 hooks 分支或会话组装入口选择独立策略适配器。只读命中详情也用同一公式。无任何新增经典 evaluator调用、DTO构造或策略读取；最终证明以专项与完整黄金/生成门禁为准。

## 属性、资源与物品

- 可配置属性目录/初值/系数/费用/单项和总上限/力量训练上限；公开 allocate/respec 只有当前玩家，精确payload/revision和原模拟/目标选择状态预检，0 tick、0 RNG，通过原命令录制/回放
- 洗点保留初值/继承构筑，只退付费属性；退款舍入损失、属性/技能点费用与原生gold/focus代价分开记账。预检失败零支出；CAS提交及异常恢复覆盖模块/组件、HP/maxHP、STR和gold
- 原生物品永久增益保持基础所有权，派生只按差額更新；load只校验重绑。原形态转换、强化、复活与克隆边界不把已有成长当新原生基值
- inheritBuild仅属性/训练构筑；不继承等级/XP/物品额度/奖励收据。默认复制体level1、无未分配点、无奖且禁成长；可配置继承余额与后续成长各有明确来源记账，护甲幻影按nativeStatsCopied同样处理
- 原药水/强化仅永久输出被 conversion/perItemCap/runCap 控制，先限额后floor、无跨次小数。每次cap与每actor每规则终身cap独立。生命药水原治疗/清状态保留；强化永久强度包和原清诅咒/计时/RNG分开，合法目标确认才提交
- 物品模块收据与引擎原生永久字段在同一受控异常恢复范围提交；可预期整数溢出先预检，不消耗药水或留下半份收益/收据

## 独立审查修复

本步独立审查实际发现并以新回归处理：手动搜索标记泄漏至同回合被动搜索；安全点异常遗漏STR/gold恢复；克隆后续等级与继承余额的预算来源；独立训练cap遗漏；物品永久字段溢出与收据提交不同步；原生超额HP在变形前被误钳制。复活保留1a已验收的扩展原形态恢复上限合同，变形的原生超额HP单独显式处理，不通过修改旧断言消化失败。固定legacy CE `Monsters.c:2928–2939`先heal再恢复模板，`initializeStatus:3904–3925`不改当前HP，因此CE复活可保留超额HP；本步明确保留既有扩展钳制，不宣称该扩展复活规则与CE相同，经典行为不变。

## 生成写集差分矩阵

测试专用原1a0全图捕获实现不调用当前缩窄根选择器；每例独立执行全图与缩窄两种真实失败入口。

| 固定种子 | 深度/路径 | 注入点 |
|---|---|---|
| 517 | 新D2，pending怪物/物品坠层 | 生成失败、发布失败 |
| 1701 | 新D5 | 生成失败、发布失败 |
| 424242 | 重访D2，真实气体补算 | 生成失败、发布失败 |
| 9001 | D2补算真实坠落进入已缓存D3 | 生成失败、发布失败 |
| 1977 | 同层重入D3 | 生成失败、发布失败 |

两种回滚逐一比较完整世界投影、实体图/别名身份、双RNG及计数、消息/待确认/战斗缓冲、模块状态与分配器结果。另以完整描述符图检查Map/Set/typed bytes和保存结构未登记字段，避免同投影漏检。两个敏感性控制证明漏捕真实gas格和新增离层几何写入都会报错，即使后者保存投影相同。弱会话状态仍需要显式生命周期快照；LightMap弱光源修复有独立行为回归，不声称全图遍历能看见WeakMap。

`docs/architecture.md` 与 `docs/ext/architecture.md` 已写明：修改生成/补算/发布路径的写入必须同步更新写集并通过该差分测试。

## 最终冻结前预检

- 全部扩展：22 文件 / 391 项通过，exit0，103.67s
- 全库源码读取重新扫描290个测试文件；146个快速实例及3个共享真实普查实例通过。普查保持45种子×26层=1170层、3803台machine，center违规0；原普查集合/超时不变。预检名称过滤产生的未选择用例不称“新增skip”，最终完整门禁仍执行原全集
- P01新求值器70项、属性命令21项、策略桥21项、物品26项、克隆超额HP1项、经典全生命周期0调用1项、差分13项，共153项新回归
- 初期联合ext预检出现1项旧复活断言失败（91 vs79），生产修正为分操作明确的超额HP语义后，旧生命周期16项及最终全部ext全过。没有改断言或伪造反事实/夹具修订
- 首次冻结的typecheck指出新经典隔离测试调用了private生成方法的错误签名；只修新测试为真实stairs_down命令并断言D2，定向/typecheck通过后从第一项重新跑全部最终门禁。前轮未进入build/full，原始失败日志独立保留
- 96个严格JSON以重复键拒绝解析通过；2个原有JSONC tsconfig用TypeScript解析通过。变更/新增文件无CRLF；git diff --check通过

## 门禁

选完整/CE档，因为实际触及CE命中、伤害、搜索、潜行及物品规则端口。最终必须运行 `vue-tsc -b`、`build`、固定legacy `ce:fetch`、完整 `test:full`、`test:drift`；full替代npm test，不拼接定向通过。运行环境Node24、3GiB堆、full两worker/drift一worker，原超时不变。

冻结源码/测试/脚本/构建输入607个，SHA-256 `6093922b8969e9df75050e652794ae6e994c010b6a9a089e16e02e6db2bd15d1`；17:01:12 UTC结束复核 unchanged=true，输入完整一致。原始日志仅放忽略目录 `tmp-phase1b-raw/`；仓库只保留摘要，无截图/大日志/CRLF。

### 最终五项结果（唯一完成的完整运行）

2026-10-02 15:07:08–17:01:12 UTC，Node v24.19.0 / npm11.9.0；full两worker、3GiB堆，drift一worker。完整/full使用 `--bail=1` 仅在失败时提前停；本轮没有失败，实际完整跑完。终态摘要原文：

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=15 2026-10-02T15:07:23Z
✓ built in 6.31s
END build EXIT_CODE=0 DURATION_SECONDS=24 2026-10-02T15:07:47Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T15:07:47Z

 Test Files  289 passed (289)
      Tests  5140 passed | 8 skipped | 5 todo (5153)
   Start at  15:07:48
   Duration  6751.17s (transform 10.09s, setup 0ms, import 224.71s, tests 13229.83s, environment 123ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=6752 2026-10-02T17:00:19Z

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  17:00:19
   Duration  52.06s (transform 1.29s, setup 0ms, import 1.96s, tests 49.94s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=53 2026-10-02T17:01:12Z
FINAL all_gates=0 2026-10-02T17:01:12Z
```

CE活动对照全部执行；8 skip / 5 todo均为历史原项，没有新增跳过或改变超时。无FATAL/OOM/worker异常；构建只保留已有chunk尺寸警告。经典精确双流tuple、UR2/UR3/UR4黄金trace、原生成基线全部通过，旧测试/fixture逐字未改。新增经典新局/攻击/投掷/搜索/潜行/实际换层/存读/回放seek探针直接证明原路径对 evaluator/kernel/runtime策略及模块工厂调用均为0。

原始本地证据：`tmp-phase1b-raw/final-{vue-tsc,build,ce-fetch,test-full,test-drift}.log`、`final-gates-summary.log`、`preflight-source-hashes.json`/`final-source-hash.json`；首轮typecheck失败独立保留于`initial-freeze-failed/`，未与最终通过混写。文档整理不改变607个冻结输入。

## 交付边界

只提交并推送ext/foundation；不合并或推送main、不打标签、不发PR/Pages。实际远端SHA核对之前不称已推送。最终完成后停下等待1c授权。未来合入main前维护者本机补跑完整test:full仍为后续要求，不冒充本步云端已执行结果。
