# phase6 发布说明草稿（未发布）

候选 `06682d5` 加本次6Z文档与限定修复，拟合入 `ext/foundation`。当前未提交、未推送、未合并、未部署，无tag/Release/package大版本升级；验收与阻断见[6Z报告](phase6z.report.md)。

两轮修复后，影响面首轮仍有22文件138项失败未关闭，尚不满足收口通过；以下为拟发布功能说明。

新增可选loot系统：三档新局预设、随机/唯一装备、四槽比较与可知性、过滤/批量分解/碎片鉴定、强化/精炼及原生符文；growth软推荐与实际属性贡献；两套套装、四插槽符文及两符文之语；锻炉拆卸/重铸、两制作配方与≤magic的可信craft来源；两种大型body的一次性可信part来源。模块可关闭或物理删除，缺能力沿公开fallback。

同版本支持保存/载入、完整回放、seek和续录；旧格式严格拒绝、不迁移。当前foundation20、itemSdk4/worldSdk2、world6、loot0.9.0/实例6、crafting1.1.0、growth1.10.0，whole-run7/recording4/origin2。

site无真实产出入口，延期至世界任务；数值平衡/M4、唯一品扩编/T7、新职业流派树、真机/D22+/最大世界压力均未完成。B4离线freeze限制及C2已接受前缀回归保留；C3/C4性能结论待维护者补录。三档U01–U18仍待维护者，不将自动引擎通过当视觉/触控通过。

发布后预期沿现有Pages工作流：仅ext/foundation push，Node24，`npm run build -- --base /BrogueJS/`。部署SHA、run ID、URL与实际成功结果必须在获授权执行后另补；不顺带合main。
