# 5D2 有限生产实施任务

基线：`ext/phase5`，`e0fa39a225428d36e6e342f6585f57f45960e6ba`，干净，5D1/5G已推送。授权等待已满足，直接实施；单执行者，不派代理，不commit/push。完成后交父独立审查，最多两轮修复。

## 独立维护者决策清单

无新增需裁定事项。沿用已批准的1000tick周期、每单32周期、厨师500有效tick与5菌/3作物/2肉、农夫≤6格/格每日1作物、猎人每日≤2肉。推荐选择已呈用户：settlement自有灶台/食物循环；crafting同步只读软目录；world5唯一持久订单与绝对日配额，最小升版。常规参数由实施者记录；重大难回退的新合同才另报。

## 实施与验收

交付公开order-work/resupply-work/cancel-order、真实escrow与容量预留、共享原生调度劳动、有限离场核、日粮优先/次周期库存、农田/猎人/厨师及可选crafting真实生产；保home需求与foraging排他合同。所有写入经过原命令/确认/CAS，失败完整回滚，load/seek/查看不生产。纯规划仅值对象。唯一持久根为world5订单、票据、容器、offline及现有居民引用，版本拒旧，不迁移；九冻结SDK不变。

相关测试覆盖公开命令、配额与劳动、三种食材/原生口粮、可选模块、边界/极长尾、分段、在离场同票据、同周期隔离/日粮、生命周期退款、坏provider/writer、严格保存/回放及只读UI。开发只相关测试+boundary/types/build及必要实际drift，Node24.19绝对PATH/3GiB/≤2workers串行；完整阶段门禁、组合/删除与大浏览器留5Z。报告命令与实际exit，失败只最小修复/受影响复测，不弱断言/skip/延timeout。每步更新commander-status顶部≤5行，交外部READY后停止写入。

## 常规可逆参数记录

猎人每份1000有效tick；基础灶台木4/石4、300tick；订单数量1…16批，订单总寿命32周期；生产完成次经济周期才进入目标箱。版本按实际写集：foundation12、world5schema3、经济合同1.2.0、settlement1.2.0；settlementstate2/whole-run6/recording4/origin2保持（状态新增在world5）。
