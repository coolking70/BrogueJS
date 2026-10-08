# 5D1 需求纯计算核固定副本审查

日期：2026-10-08。结论：**发现1项严格输入校验缺陷；本次检查未复现生产库存预算内的需求数值、稳定床分配、饥荒离开或规范消费identity错误。** 这是阶段纯核审查，绝不替代5D1最终完整独立审查。

## 固定输入及审查边界

先核对 `input-manifest.json`，9/9份文件SHA-256相符，复现结束后再次核对，仍全部一致。证据：`repro/sha-verification.json`。

完整读取固定任务副本（包括§0、§0.1及其F1/F2优先裁定）、合同审查、`ResidentEconomy.ts`、`ext_resident_needs.test.ts`、resident SDK，以及运行所需纯数据/校验依赖。`world5.ts`读取相关类型定义，没有把它及其未提供的引擎依赖导入复现。独立 `oracle-work/cases.md`仅作合同预期参考，不计产品通过证据。

只写本审查目录，未改输入、P5源码或共享文件；未读取P5移动实现，未运行Vitest、产品build或browser，未安装/联网、派代理、commit/push。只从P5的已有 `node_modules/esbuild`使用编译工具；编译输入全部来自固定 `input/`，见 `repro/build-inputs.json`。

## F1 — S2（中等）：非JSON数组原型可执行回调并绕过actor唯一性校验

**位置：** `input/src/ext/worldJson.ts:20–24,40–43`；调用和错误依赖点为 `input/src/engine/Core/ResidentEconomy.ts:55,73–79,104`。

`c5Canonical`明确声称不执行getter，但第24行只检查非数组对象的原型。数组的自定义原型不被拒绝，第43行通过实例的 `.map`读取/执行该原型方法。随后需求校验也调用输入数组的 `.map`和 `.some`，把唯一性及引用判断交给输入可控制的方法。

**输入域声明：** 以下输入故意离开生产合法域，带自定义数组原型，且重复actor引用；它应被严格校验拒绝。不是自然存档或真实Game提交反例，不是合法库存下的数值算法错误。尚未读取适配器，不能据此断言公开命令或load能够把这种对象送到纯核。

**最小getter反例：** 标准有效单居民DTO，将 `residents`数组的原型设为 `Object.create(Array.prototype)`，该原型的 `map`为getter，返回 `Array.prototype.map`并增加外部计数。期望：拒绝非JSON数组，getter调用0次。实际：`assertResidentNeedsInput`接受，getter执行2次。实际输入及结果保存在 `repro/check.cjs`、`repro/validation-results.json`及 `repro/check.output.txt`。

**具体错误规划反例：** `fromTick=0,toTick=32000`；两个居民条目均为 `initialResidentNeed(1)`；粮为 `{containerId:1,itemId:42,quantity:2,lockedQuantity:2}`；床为 `[{actorId:1,bedId:101},{actorId:2,bedId:102}]`，合法床集合 `[101,102]`。仅 `residents`数组带自定义原型：继承的 `map()`返回 `[1,2]`，`some()`返回 `true`。完整可执行输入在 `repro/strict-array.cjs`。

- 期望：因非JSON原型、重复actor或孤儿床引用，在规划前拒绝，不调用输入方法，不发布消费效果。
- 实际：接受；校验调用输入方法4次；`structuredClone`随后恢复普通数组，但重复actor条目已通过校验。规划返回两个完全相同的消费identity：`actorId=1,itemId=42,atTick=32000,quantity=1,lockedQuantity=1`，总共扣2份粮，且保留两个actor1需求条目。
- 后果：严格纯输入门禁自身会执行不可信回调，并可以生成重复消费事实。如果此门禁被用作未经其他规范化的可信边界，重复消费/引用错误可以进入后续提交；实际Game可达性及提交是否另行拒绝，本次未确认。

**最小建议：** 在 `c5Canonical`读取任何数组方法前拒绝非标准数组原型（本环境标准JSON数组要求 `Object.getPrototypeOf(v) === Array.prototype`），保持现有own-key/data-descriptor检查。需求校验只操作已通过该规范检查的数组。补两条针对性断言：原型getter不执行且被拒绝；带伪造map/some的重复actor输入被拒绝。无需改变需求跳跃算法。

该发现对应非JSON/getter零副作用及引用唯一性合同，不是对指挥I8“split test尚缺完整oracle”的重复报告。

## 实际运行与独立比较

环境：Node **v24.19.0**，esbuild **0.27.3**。所有下列命令实际执行，退出码均0：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro/compile.cjs > repro/compile.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro/check.cjs > repro/check.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro/strict-array.cjs > repro/strict-array.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro/targeted.cjs > repro/targeted.output.txt
```

`compile.cjs`只打包固定核和三个纯依赖。固定副本未提供 `fingerprint.ts`；将仅供未调用的 `c5Hash`使用的该导入标为external/无副作用，使esbuild删除不用的hash导出。`c5Canonical`及需求算法未改。meta验证所有源输入均处于本目录 `input/`；没有导入P5生产TS文件。`repro/kernel.cjs`为实际运行的编译产物。

`check.cjs`另写逐1000tick边界参考器；每个日界逐actor取一份粮、先锁后自由、判断旧f3、释放床并住房±1。它没有调用生产规划作为预期。1600组确定种子 `0x7a98f12d` 的输入，1..16人口，短跨度最多约10日，比较以下内容：

- 全部居民双欠额/unfedDays/departed、床分配、库存与剩锁；原输入不被修改。
- 将压缩消费效果按 `firstTick + i*32000` 展开为单份事实，核对末端 `atTick`、actor/item/container/锁数量和离开identity，与独立参考相符。
- 每例再按2段、17段执行，比较同样的完整状态、展开后的事实和epochCount之和，均相符。耗尽库存根在续段输入中移除，在最终状态比较中也统一移除；不会把合法删除零量根的表现差异当成丢物。

样本遵守实际库存限制（每箱单位合计≤64、箱数≤4、总锁≤2），同时包含死人/已离开等明确过渡资格输入以核对排除逻辑；没有把所有组合宣称为天然可达生产存档。压缩效果分组及原数组顺序不作为规范事实identity；这也不能证明适配器的receipt滚动、revision、world计数或真实对象根删除正确。

另有7个具名数值例，输入及实际结果保存在 `repro/targeted.actual.json`：低actor空床不抢高actor的有效旧床；离開同刻释放床→住房；旧f3吃上后退2再缺不立即走；死人/已走者不分粮不占床；actor/锁粮/自由容器次序；无粮10^9tick第四日离开；MAX_SAFE_INTEGER最后一tick不误跨界。

安全整数另在接近 `Number.MAX_SAFE_INTEGER` 的约100日区间，以BigInt推导规范日/epoch边界，比较参考最终状态与全部展开identity，核对所有效果tick仍为安全整数，未见溢出或舍入越界。已结清的零跨度输入返回零effect/epochCount且状态保持。

合法16箱×64份FOOD、16居民、10^9tick的单次纯核观察耗时 **0.151ms**，1024份耗尽，第68日统一离开，展开消费量守恒。这是单次小型复现观察，不是64人口完整产品≤50ms性能验收、GC验收或5Z最大负载通过。

## 非生产域观察与尚未审查事项

`assertResidentNeedsInput`还接受单箱百万FOOD及3份锁定粮（见 `validation-results.json`）。两者明确违反真实64槽和初锁总2的生产域；本审查没有用它们作性能失败，也不把缺少这两项纯核检查单独升级为已证实生产缺陷。真实快照/提交是否按container权限、容量、初锁守恒及FOOD实物资格拒绝，必须在适配器审查核实。

未审需求发布事务、真实Item身份/耗尽删根、锁消费累计、actor生命资格采样、床结构合法性来源、home跨层选择、entry/死亡/离开退款、F2回滚、codec、job信用及F1端点调度、receipt/revisions/world计数、录像和UI。这些范围不能由纯核参考或当前测试代替。没有泛泛重报执行者正在处理的I8测试缺口；本报告对规范事实的独立比较也不关闭I8的适配器验收。

处理建议：将F1和复现交原执行会话修复/评估入口；修复后重新固定输入复核。保留完整5D1独立审查及主进程最终验收。

## 维护者收件记录（尚未关闭发现）

原独立报告SHA-256：9ceee78514fbe2a2be6d6cb0426b1faa23dbfe5247d252709af637ff059a6134

独立进程：01a1182f-e3e6-7621-af41-671474843bed，gpt-6.1-sol/high；固定ResidentEconomy.ts SHA-256：21533d0b4446f4e8ed13541548096ce78c96ff6d4303e7a387adb0e95691548b。原证据根/private/tmp/brogue-commander-20261008-5d1/needs-kernel-review，完整9文件摘要见input-manifest.json，复现见repro/。本报告F1在维护者指令中记为K1，避免与正式任务§0.1的劳动时间F1混淆。

发现交原执行进程修复；实际Game入口可达性仍未证实，不作已存在公开存档利用路径的宣称。纯核检查通过不能代替适配器完整分段结果与最终整项审查。


---

# 维护者追加：K1 独立修后复审

以下为同一独立审查进程对固定 input-v2 的复审全文；保留上方原始发现。仅关闭 K1，不代表 5D1 验收。

# 5D1 需求纯核 K1 固定副本复审

日期：2026-10-08。**此固定 `input-v2/` 的K1可以关闭。** 原型getter及伪map/some反例均在执行输入回调之前拒绝，回调次数0；合法标准JSON数组、先前1600组独立需求比较及边界检查未出现回归。本次未发现新的实际问题。此结论仅关闭前次报告F1（指挥编号K1），不代表需求适配器、Game、岗位或完整5D1验收。

## 固定输入与精确修复

复现前后均核对9份新输入SHA，与 `input-v2-manifest.json`完全相符；记录为 `repro-v2/sha-verification.before.json`、`sha-verification.after.json`。旧 `input/`、`repro/`全部24份文件前后内容及文件集合一致，见 `preservation.before.json`、`preservation.after.json`；旧报告未改。

| 新固定输入 | SHA-256 |
| --- | --- |
| `src/engine/Core/ResidentEconomy.ts` | `21533d0b4446f4e8ed13541548096ce78c96ff6d4303e7a387adb0e95691548b` |
| `src/ext/residentSdk.ts` | `6db8b66c16bbd8730b7d782dc8e324f7100ad751464b9faecabbf63118e9fed9` |
| `src/ext/world5.ts` | `c21e2462fc5aeac3c317b006445511d2102c6e9d6673f095d7554e7b3ac4f17e` |
| `src/ext/worldBasics.ts` | `bac9dbfc831d9728afce8b8eebd7cc1f5a5b43c521632e91c0d161414656370b` |
| `src/ext/worldJson.ts` | `ea3432eee48372e76391e5ca30fc8965dcf2a7c3b3ba0ecd80b803ed7b19c59b` |
| `src/ext/json.ts` | `49471610865e85a6282516c98f321f837fceac4e021a1313bf2920466d634ed0` |
| `src/test/ext_resident_needs.test.ts` | `ba0d2836200af243390d3d57bb67104e60d9f2a2512a0c3d13fb621917a48133` |
| `docs/ext/phase5d1.task.md` | `8de2d03106f19cd018ba70fbbb8b42227224bea03c5121176d1ba2558da16b62` |
| `docs/ext/phase5d1-contract.review-findings.md` | `f00bf0c80088ed1df32b2bac2c15618a0473ac412dbfe44931f6a622131e9a7b` |

与旧输入逐份比对，仅共享 `worldJson.ts`和需求测试变化。`worldJson.ts:24`将原先仅校验非数组对象原型的条件，改为数组必须具有当前realm的 `Array.prototype`，其他对象仍仅允许 `Object.prototype/null`。这一检查发生在枚举own属性及读取数组 `.map`之前；因此原反例的继承方法不再获得执行机会。需求跳跃、床分配及整数算法源码SHA未变。

新增产品测试静态核对见 `input-v2/src/test/ext_resident_needs.test.ts:75–82`：继承map getter和伪造map/some分别断言抛错及calls=0。本复审没有运行Vitest；任务告知的需求6项通过、岗位3项仍失败未作为本人执行证据，也未合并成整体通过。

## 实际复现与结果

环境：Node **v24.19.0**、已有esbuild **0.27.3**，无安装/网络。下列小型复现命令均实际运行成功，输出保存在同名 `.output.txt`：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/compile.cjs > repro-v2/compile.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/check.cjs > repro-v2/check.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/strict-array.cjs > repro-v2/strict-array.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/targeted.cjs > repro-v2/targeted.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/canonical-compile.cjs > repro-v2/canonical-compile.output.txt
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/canonical-check.cjs > repro-v2/canonical-check.output.txt
```

构建仅为任务允许的固定副本临时esbuild编译，并非产品build。需求bundle源为 `input-v2`内 `ResidentEconomy.ts/worldJson.ts/worldBasics.ts/json.ts`；canonical bundle源仅为新 `worldJson.ts`和内存生成的测试导出入口。完整esbuild元数据保存在 `kernel.metafile.json`、`canonical.metafile.json`。未提供的 `fingerprint.ts`仍仅作为未调用的c5Hash依赖标为external/无副作用，让不用的hash代码被删除；canonical实现不替换、不stub。没有读取或导入P5移动实现，仅使用其既有node_modules编译工具。

**K1原反例：**

- 在有效单居民DTO的residents数组原型挂map getter：现在抛 `Invalid C5 JSON`，getter调用0次。见 `validation-results.json`和 `check.output.txt`。
- 原重复actor1、孤儿actor2床引用、2份锁粮、伪map/some输入：现在在规划前抛同样错误，所有校验回调调用0次，不产生原先的两条同actor/同日消费效果。见 `strict-array.actual.json`、`strict-array.output.txt`。

这两个输入明确属于非生产合法域，本次证明的是非法输入门禁修复；不是自然Game提交测试。

**需求闭合比较：** 原独立逐1000tick参考器复用到 `repro-v2/check.cjs`，1600组固定种子 `0x7a98f12d`全部相符；每例核对完整需求/床/库存/剩锁、展开后的消费/离开identity，以及2段/17段切分的最终状态和epochCount之和。原输入保持不变。库存遵守每箱≤64份、最多4箱及总锁≤2；另包含明确的死人/已离开过渡输入，不宣称每种随机欠额组合为自然可达存档。耗尽根统一移除后比较，不把效果压缩分组差异等同规范事实差异。

零区间、接近MAX_SAFE_INTEGER的BigInt边界、全部具名7例仍通过：稳定保留旧床、离开同刻再分床→住房、旧f3吃上退2再缺、死人/已离开不分粮不占床、锁粮/actor/自由容器次序、无粮10^9tick第四日离开，以及安全整数最后1tick。见 `targeted.output.txt`和 `targeted.actual.json`。

合法16箱×64份FOOD、16居民、10^9tick单次纯核观察为0.170ms，消费1024份且第68日离开；仍只是复现观察，不是64人口产品性能/GC验收。

**共享canonical直接回归：** `canonical-check.cjs`的14项均符合期望，完整结果在 `canonical-results.json`：

- 普通、空、嵌套数组及包含标准数组的null原型对象正常canonical，对象key排序仍正确。
- 数组索引own getter、own map getter、对象own getter均拒绝且执行0次。
- 顶层/嵌套非标准数组原型均拒绝，继承map getter执行0次；数组子类在species getter执行前拒绝，调用0次。
- null数组原型、稀疏数组、额外数组属性及其他realm的数组拒绝。

## 修复边界与未验证范围

该修复现在明确要求**当前realm标准Array.prototype**；跨realm数组即使内容可序列化，也会被拒绝。本次直接复现确认这一更严格边界，没有把其他realm数组说成当前realm正常JSON数组回归。尚未核查全部共享canonical调用者是否依赖跨realm或数组子类，也未全面测试Proxy、全局原型污染或所有共享DTO类型。

此前单箱百万FOOD/3份锁粮仍被纯输入校验接受；它们违反生产库存/初锁域，记录保留，不据此声称性能失败或新增已确认生产缺陷。实物权限/容量/锁守恒验证继续属于适配器审查。

未验证真实Game提交、床资格来源、FOOD对象根删除、锁累计、home跨层、生命周期退款/回滚、receipt/revisions/world计数、codec、岗位信用/端点调度、录像/UI及产品门禁；K1关闭不关闭I8或岗位失败，也不替代5D1最终独立验收。只写本审查目录的新 `repro-v2/`及本报告，未改仓库、旧证据或新固定输入，未运行Vitest/产品build/browser、commit/push或派代理。
