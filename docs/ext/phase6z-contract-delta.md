# 6Z 当前合同与冻结身份差异

基线 phase5 `9cf8366` → 候选 `06682d5`。历史C0/A/C5数值不改，本页给后继合同映射；不把“九冻结全不变”当当前事实。

| 入口 | phase6实际后继 |
| --- | --- |
| 6A/C6 item基础 | itemSdk4：原生装备/实例/来源/接纳、读知性、强化桥、WorldWork票据、body只读目录及part联合；Game负责可信入口与事务 |
| 6B3 growth/stats | growth1.10.0，公开 `growth.attribute:<完整ID>`、L2装备贡献、knownOnly比较；原4职业/4血统/4信仰及通用树目录，未扩新内容 |
| 6B4 | 21随机/4固定原生符文、强化与精炼、真实效果知识失效；与插槽符文分开 |
| C0→C1/C2 | 两套×四槽累计阈值、四插槽符文/两词、孔数/顺序和材料堆叠；身份随实现升级，冻结数值不变 |
| C0→C3 / C5 | worldSdk2/world schema6、crafting1.1.0/definitions schema2；WorldWork原生装备escrow、预留、操作≤1KiB、退款、完成票据/ordinal与lootRoll≤magic |
| C0→C4 | foundation20/itemSdk4，`foundation.item-bodies.v1`、只读多消费者partBroken、宿主parts资格台账；来源已实现part，site协议保留而玩法延期 |
| 持久入口 | whole-run7/recording4/origin2；loot0.9.0/pack0.6.0/schema5/实例6/state2/dropTables2；旧版拒绝，不迁移 |

itemSdk调用方包括宿主Game/物品桥、loot的生成/投影/操作；worldSdk调用方包括WorldWork及crafting/settlement/loot工位桥；edibleSdk沿foraging/原生食用桥，phase6字节不变。stats.ts不是稳定SDK空壳，实际变化须登记；所有可选能力经公开目录，缺能力fallback进入指纹。

## 逐入口字节

SHA-256为完整文件字节，对比9cf8366。类型见证由本次vue-tsc及影响测试覆盖；版本见真实manifest/SDK常量。这里不声称所有生产接口都冻结不变。

| 文件 | 候选SHA-256 | 对phase5 |
| --- | --- | --- |
| `src/ext/descriptor.ts` | `44f8a0df44c148ab086405f393b2a190b89c9ecbe4abec3d28b76edae88dbfa9` | 变化 |
| `src/ext/edibleSdk.ts` | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` | 不变 |
| `src/ext/itemSdk.ts` | `c6073e08177aba37297ac54762acd0e1e49708c9cda5a7cf91a246cf8ee4fbdd` | 新增 |
| `src/ext/residentSdk.ts` | `d0f37ee4f36d40e4c4cd81571ead6b5ee17bf962a991b0aed81b00e4b8694516` | 不变 |
| `src/ext/structureSdk.ts` | `17c243ec799492f0d1281f8147fd275b039247fbc3ac5a8804d8f13d04864b7f` | 不变 |
| `src/ext/testing/worldHarness.ts` | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` | 不变 |
| `src/ext/types.ts` | `4cc537241931b5672db450c11fdfc788aa8299b7efa51e65677b5497d9adb730` | 变化 |
| `src/ext/worldSdk.ts` | `34695c7a2d845d7de9cb5ea96ed1593ad9269bcda2c7841be2df331a14e5f5ce` | 变化 |

## 状态、知识与预算

C3/C4未增加Game字段；phase6整体U03登记相对9cf8366增加6B4 `pendingEnchantmentScrollId`（run.enchantmentScrollId，成功/取消/新局清空、载入校验卷轴所有权）。不将子步“无字段”外推到整阶段。loot机械行与知识变化经原事务同步失效/物化，纯读零事务/零实质RNG；容量升不补、降钳制。成功/失败均遵守完整写集/引用回滚，非法输入必须保活局。

每件24/provider256、默认11/8/6、四槽31+4cap35，owner4KiB/总moduleData8KiB/depth16/loot state4KiB/operation1KiB；六随机/八固定/四孔、每件64骰/事件512骰。C5/C6根7168/8192保原准入/检查语义，完整save/recording不新增总大小线。

现行配置和操作成本见[loot-config](loot-config.md)与[crafting-config](crafting-config.md)；静态依赖、模块所有权及i18n守卫保持，6Z不为文档整齐改源码守卫。

## 历史九冻结入口逐项复核

沿阶段5清单（phase5c1报告），对9cf8366逐文件原始SHA比较如下；worldSdk/stats/forageFixture实际差量不能隐去。itemSdk为phase6新增独立入口，见上表。

| 文件 | 当前SHA-256 | 对phase5 |
| --- | --- | --- |
| `src/ext/worldSdk.ts` | `34695c7a2d845d7de9cb5ea96ed1593ad9269bcda2c7841be2df331a14e5f5ce` | 变化 |
| `src/ext/edibleSdk.ts` | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` | 不变 |
| `src/ext/worldEdible.ts` | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` | 不变 |
| `src/ext/kindKnowledge.ts` | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` | 不变 |
| `src/ext/actorNeeds.ts` | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` | 不变 |
| `src/ext/stats.ts` | `c828f7b94f48a40273d7fb5320e3228d89f4ef0fc6d7345f9f16667a78ce3ee8` | 变化 |
| `src/ext/testing/worldHarness.ts` | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` | 不变 |
| `src/ext/testing/forageHarness.ts` | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` | 不变 |
| `src/ext/testing/fixtures/forageFixture/index.ts` | `ec090dafc0a24f932d89ae80026f83e983e300c3b8851a237e6ae481587dddcf` | 变化 |
