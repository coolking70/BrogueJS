# 远征营地 5C1 配置手册

生产目录 `src/ext/modules/settlement/`；入口 `descriptor.ts` 由 catalog 自动发现，`defaultEnabled=false`。新局扩展选择中单独勾选「远征营地」即可使用，不依赖其他内容模块。启用后按原有启动收据发放建材，寻找第二份原生食物，再在合法地牢区域建营地。不开启时没有本模块定义、启动材料、采集节点或营地逻辑。

## 数据和身份

`data/definitions.json` 是机械数据唯一来源。外层键为 `schema,moduleVersion,rulesVersion,world,camp`；外层 schema=1、module/rules=1.0.0，内层 world schema/worldSdk=1。`definitions.ts` 对整个包计算一个 `extensionDataFingerprint`，同时包含营地政策和 world 定义。调整机械数据须同步 rules 身份并遵循存档/录像匹配；本步不迁移旧档。

`schema.ts` 和中性 `ext/constructionSchema.ts` 拒绝未知键、非法 JSON、getter、非安全整数、非法 owner/ID、缺失定义引用、预算越界；`WorldDefinitions.ts` 保留可信入口并继续调用既有 edible 校验。内容模块只声明数据和接收 detached/frozen DTO，不导入 Game，不注册结构 DEV fixture。

| 内容 | 数量/时间/规则 |
| --- | --- |
| wood / stone / fiber | material；`basic.wood/basic.stone/basic.fiber`；maxStack=99 |
| 新局建材 | wood12、stone8、fiber6；一次启动收据；溢出沿底座 floor-then-skip；不额外发 FOOD |
| 木、石、纤维源 | 徒手100 tick取1，容量20；D1…40每类每层最多尝试1个，全局每类40个；落位失败有收据，不改天然地形 |
| 再生 | 木2000 tick回1，纤维1000 tick回1，石无再生；查看虚拟投影，工作提交才实体结算 |
| 建营地 | wood4+stone2；300 tick；背包明确选择2份真实口粮/芒果 |
| 扩张 | wood2+stone2；300 tick/次；保留 region ID、增加 revision |
| 撤营 | 100 tick；关联结构/居民/订单必须先处理；剩余补给须能合法放入背包，否则整笔拒绝 |
| 门开关 / 拆卸 / 批量转移 | 100 tick/条公开命令；查看和编辑0 tick |

结构材料账单以 JSON 为准：

| 定义 ID（settlement. 前缀） | 材料 | tick | HP | 物理/火抗性 | 资格 |
| --- | --- | --- | --- | --- | --- |
| wood-floor | wood1 | 100 | 100 | 0/0 | floor，易燃 |
| stone-floor | stone1 | 100 | 200 | 25/100 | floor，不燃 |
| wood-wall | wood2 | 100 | 150 | 0/0 | wall，易燃 |
| stone-wall | stone2 | 100 | 300 | 25/100 | wall，不燃 |
| door | wood2 | 200 | 150 | 0/0 | door，易燃 |
| window | wood2 | 200 | 100 | 0/0 | window，易燃 |
| roof | wood1+fiber1 | 200 | 100 | 0/0 | roof，易燃；仅房间覆盖资格 |
| bed | wood4+fiber2 | 300 | 100 | 0/0 | fixture + RestPoint，易燃 |
| chest | wood6 | 300 | 150 | 0/0 | fixture，64槽，易燃 |

床的原生休息上限30000 tick、交互距离1、HP策略 `native-over-time`、可选战斗资源 `none`、重置 `none`。休息依原生 auto_step 推进；饥饿、环境、敌情/受伤/消息打断照常，不补满、不产生 FOOD、不重置篝火。

## 所有权、预算与收据

每层1营地、全局8营地，使用最小空闲 slot0…7；重建时该 slot 的 ordinal 高水位递增。初始9×9、最大24×20，每营地384结构格/16箱，每箱64槽，遵守底座更严格的全局预算。补给堆也计入箱预算，所以另建箱最多15个；全局 chest 预算112。施工草稿最多16格，不持久化。

`state.ts` 的 schema1 保存 `revision,camps,constructions,history`。营地只引用 region、slot/ordinal、补给容器和标记；`locked` 引用实际 Item ID 和数量，两份储备之和必须为2。`reportItems` 是有时间戳的显示快照，不能消费；history最多128条。退款收据只记录 component ID 与真实已付材料定义/数量，不复制库存或HP；每个存续组件必须有且只有一份合法账单，读档拒绝删账单或伪造数目。

FOOD 整堆转移保留 Item 对象和 ID，部分堆拆出新的真实 Item，实际库存只存在于补给容器一次。额外食物可合入锁定堆，取出只能取未锁定后缀；共用 `WorldMaterialTransfer` 同样检查锁，不能借别的模块转移入口绕过。非堆叠装备保持 ID、附魔、诅咒和鉴定字段；容器内不自动食用、充能或回血。

5C1 补给标记采用**不接受结构攻击或拆卸**的非战斗交互实体，只有明确撤营可解除锁；这是本步可逆策略，并非已经实现补给堆战斗残骸。普通箱沿底座掉落/残骸路径保存真实内容。撤营同一事务返回剩余 Item、移除补给/标记/空账本、释放 slot/region并恢复 native政策，保留访问层、节点/资源账本、高水位和有界收据。满背包拒绝撤营；本版未新增地面退粮降级路径。

建材来源只能是明确选择的背包或单个当前可见且可达的箱。选择的是**实际物品定义**；可使用已安装其他模块的匹配 `basic.*` 标签，床/箱可明确选择一件 `kit.bed/kit.chest`。不读 crafting JSON、不合并定义身份、不自动扫箱。实际付款账单用于 `floor(count × hp/maxHp × 1/2)` 退款；一件 kit 的全耐久拆卸仍退0件，不转换成免费原料。

## 公开命令与事务

结构操作统一入口为 `game.executeCommand('ext:command', JSON.stringify({module:'settlement',action,payload}))`。外壳仅 `module,action,payload`，payload v=1。适配器先纯验证，原生确认后重新验证 CAS，以 `transactStructureWorld` 原子提交模块状态、region/组件、容器/Item/ID、收据/消息和正耗时；No、过期、失败无机械成本。UI 不持有计划句柄，不直接写 Game。

| action | payload 在 v/stateRevision 基础上的键 |
| --- | --- |
| establish | inventoryStamp,x,y,bounds,food,sourceContainerId,sourceRevision,materials |
| expand | inventoryStamp,regionId,regionRevision,bounds,sourceContainerId,sourceRevision,materials |
| build | inventoryStamp,regionId,regionRevision,definitionId,x,y,sourceContainerId,sourceRevision,materials |
| retire | inventoryStamp,regionId,regionRevision |
| dismantle | inventoryStamp,componentId,componentRevision |
| door | inventoryStamp,componentId,componentRevision,open |
| transfer | inventoryStamp,containerId,containerRevision,direction,items |
| rest | restPointId,restPointRevision（无 inventoryStamp） |

`bounds={x,y,width,height}`；`food/items=[{itemId,quantity}]`；`materials=[{itemDefinitionId,count}]`；背包来源的 sourceContainerId/sourceRevision 均为 null。transfer 一笔可含多个实际 Item，direction 为 deposit/withdraw。harvest 与 cancel-work 继续使用冻结 WorldWork SDK1：前者 `v,nodeId,nodeRevision,inventoryStamp,destinationId,destinationRevision`，后者 `v,ticketId,ticketRevision`，没有营地 stateRevision。

管理矩形和实际工作足迹分别校验。bounds 可包围天然岩石或被墙遮挡的未知格，不要求全矩形当前可见；尺寸、范围边界、region 唯一性、全局预算与巨兽预留不重叠继续检查。实际标记须当前可见、已探索或有记忆、邻近可达且安全；实际施工仍检查当前可见、机器/楼梯/终局/impregnable、危险、全足迹与逃生。扩张不得切开既有工作实体或演员足迹；隐藏边界冲突统一返回 C5_BLOCKED，可见冲突才返回 C5_PROTECTED，不揭示隐藏实体/机器详情。

正式床边休息只提交 `v,stateRevision,restPointId,restPointRevision`。面板在原生确认完成且 RestPoint 已启动后关闭；No、过期或距离拒绝保留面板并显示结果。原生满血休息可以立即停止而不耗时；需要恢复时通过原生 auto_step 正常耗时/饥饿/回血，Escape 可中断，不为验收注入伤害。

`StructureReadSDK` 是独立窄只读端口，worldSdk.ts/edibleSdk.ts 未扩展。只投影当前可见组件/箱/节点、可见完整房间、背包和自有营地引用。远方营地或当前未见补给只显示最后可见报告，查看/读档不触发离线结算、不推进规则 RNG。

## UI 与后续扩展点

面板含营地、建造、库存、采集四页；可选择实际材料来源/kit、两份食物、地图/方向光标、设施、存取/休息/撤营。草稿按 y,x、floor/barrier/roof/fixture、定义ID稳定排序，每格各发一条公开命令和原生确认；遇 No/危险/失效/缺料停止，已建保留。关闭/blur/load/seek/session替换清空显示队列；DialogService/DialogHost/DialogInput仍是模态屏障，ACK忙时由宿主隐藏根，保留旧DTO和显示队列但暂停施工；恢复展示边界后才重验/独立确认下一格，不展示未来状态。

无本层营地时，营地页可直接输入标记坐标、用方向按钮或地图选址，并预览初始9×9范围。标记有界 x=1…77/y=1…27，矩形在地图内截取；展示、轮廓、确认与付费命令使用同一 campTarget，切页不受建造 cursor 影响。选址/草稿只改显示状态，失败不扣料/粮/时间。

营地/合成是非模态抽屉：展开或收起时抽屉外原生键盘/DPad移动沿唯一命令入口，不自动关面板；施工选格只拥有其方向键，表单键不漏给玩家。合成仅拥有抽屉内控件键与 Escape；原生 SELECT 默认操作保留。打开抽屉取消长按并公开中断正在进行的自动行动，抽屉打开期间暂停自动调度；真实 DialogInput/确认/ACK 仍优先。已提交的推进/展示后缀继续完成，相机仍更新。

普通和沉浸共用实际可用地图视口与同一逆变换。移动端抽屉最大min(36dvh,320px)，收起52px；桌面右栏370px；建造/合成抽屉均预留 shell 空间。四模式从最终已显示字符映射墙/门窗/顶/床箱的汉字与纯矢量，不查隐藏绑定；后发火/楼梯优先于结构。画布固定测量原点，图层自身居中/跟随；本地纯函数验证不等于真实像素验收。

折叠按推荐仅支持≤700px，桌面隐藏营地收起按钮，与合成一致；窄屏收起状态由 UI session 管理，清选格/草稿并恢复地图空间，展开后恢复当前页选格。此为可逆显示选择；真实桌面/窄屏几何仍须指挥固定构建验收。

预留只读查询 `settlement.resident-status.v1`：严格 `{actorId:正安全整数}` → `{resident:false}`。5C1 没有居民/日粮消费/生产/厨师/袭击。空经济账本仅使已有管理层政策合法，在真实离层/入层更新边界；5D必须用批准内核替换，并在**同一可信事务**中消费实际锁定 Item、降低锁数量和引用、登记消耗/居民/订单，升级本模块的 schema/校验及退款/撤营约束。本步不开放内容/UI解锁函数；不得通过把 schema1 的 locked 清空来模拟日粮消耗。

开发门禁与当前证据见 [5C1执行报告](phase5c1.report.md)。全量 npm test、全部test:ext、全组合/删除矩阵留5Z；真实浏览器和真实手机设备验收必须另列结果。
