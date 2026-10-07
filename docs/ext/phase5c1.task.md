# 5C1：可独立游玩的地牢远征营地

> 状态：任务书草稿已备，尚未派发；按交接顺序在 5G 回执验收和本地集成后启动。
> 维护者侧指挥任务书，2026-10-07。依据本轮用户授权按交接顺序推进。工作树 BrogueJS-p5 / ext/phase5；正式开工时记录 HEAD。不要 commit/push。5G 在 dot 独立目录并行开发，本任务不读取或假定 foraging 已存在。

## 1 必读与优先级

AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、docs/ext/README.md、docs/ext/commander-handoff.md；完整读 phase5-settlement-world.md，重点 §4、§6、§8.3a、§11–14；phase5-foraging.md §10；phase5a3.report.md §6/§7；phase5a4.report.md §8；phase5b-integration.report.md。当前新产品合同优先于历史 CE 限制；本任务开发期门禁优先于旧文档 full 档。

本步交付 settlement 单独启用的闭环：采集基础建材 → 在任意合法地牢层建营地并存入 2 份真实 FOOD → 扩张/施工/床箱/存取/原生休息 → 徒步跨层后持久恢复 → 逐件拆除与撤营退还。必须在生产 catalog 可发现，defaultEnabled=false。无居民也能储存补给。

不实施 5C2 地表、居民/离线生产/厨师/袭击（5D/5E）、传送、Worker 摘要管线。不要顺便改其他模块玩法；修窄屏合成抽屉相机问题是本步明确范围。

## 2 模块和底座接线

生产自有目录 src/ext/modules/settlement/**：descriptor、schema、definitions/data、state、module、commands、projection、ui、locales、tests、test-suites.json、配置手册。module/rules 1.0.0、state schema 1、payload v1；严格未知键/非 JSON/非安全整数/ID/引用/上限拒绝，机械数据指纹单一真相。

先审计 5A3 真实代码：src/ext/structureTypes.ts、src/engine/Map/StructureWorld.ts 与 StructureValidation.ts、Rooms/CellProperties、runtime、fixture。底座已有 region/structure/rest planner 与 commit，不要重造地图、房间或调度。开放可信生产适配器，不能注册 DEV fixture 作为生产实现，不能让模块任意写 Game。共用提交必须将模块状态、region、结构、容器、物品/ID、账本/消息和耗时保持原子。

原 worldSdk.ts SDK 1 逐字节冻结；需要的结构/营地能力用独立窄接口或既有可信适配器，不能在 UI/module 导入并修改 Game。新 Game 字段登记 u03，生成/世界事务新增写集同时登记 checkpoint 并做对象图回滚验证。确需改格式时基于开工 HEAD 分配下一版本并记录；不要为了 UI 改动升版本，不迁移旧档。foraging 5G 冻结 API 不破坏。

居民查询预留 settlement.resident-status.v1，输入 {actorId}；5C1 无居民时合法查询返回 {resident:false}，只读、不推进时间。5D 再落实居民。本模块无 growth/crafting/narrative/combat/giants/foraging 硬依赖，不 import 其他模块数据。

## 3 可逆数值裁定（先执行，报告列“待用户确认”）

设计已定数值沿用：每层 1 营地、全局 8、最小空闲 slot 0…7、高水位不回退；初始 9×9、扩张最大 24×20；施工草稿最多 16 格；每营地 384 结构格/16 箱、每箱最多 64 槽，服从现有底座更严格的总预算。

缺失内容按以下初版样例：自有 wood/stone/fiber，标签 basic.wood/basic.stone/basic.fiber，maxStack=99。木/石/纤维源均徒手100 tick取1、容量20；木2000 tick回1、纤维1000 tick回1，石不再生。按现有可达放置合同在 D1…40 各尝试少量节点，失败留收据，不修改天然地形保证落位；建议每类每层1个，服从总节点预算。新局一次启动材料 wood12/stone8/fiber6，按现有有收据且不复制物品的启动流程；不额外白送 FOOD，不增加玩家制造食物配方。

建营地 wood4+stone2、300 tick，另存入2份原生 FOOD（口粮/芒果）；扩张 wood2+stone2、300 tick/次。木地板 wood1/100tick、石地板 stone1/100、木墙 wood2/100、石墙 stone2/100、门 wood2/200、窗 wood2/200、屋顶 wood1+fiber1/200、床 wood4+fiber2/300、箱 wood6/300。其余 HP/抗性/显示样式采用底座/设计相应机制合理初值，写进数据与报告裁定表。先完成这些必要设施，不加装饰目录。

建材来源必须明确选定，禁止隐式全球扫箱。crafting 装着时按已批准通用标签/kit.bed/kit.chest 作可选明确消费选择，不合并物品身份、不导入它的 JSON、不能互转凭空增值。若基础接口缺口，应补最小底座能力并回归，而非伪造另一包物品。无 crafting 的自有材料闭环同样完整。

## 4 营地、储粮和存取（重点）

所有操作经 executeCommand/executeItemCommand 录制；payload 严格 revision/CAS。建营地需已探索、当前可见、可达、无直接已知敌情与完整合法区域；底座唯一 region/slot/管理层政策。标记带补给堆容器。FOOD 从玩家选择的背包 Item 真转移，单位计 quantity；不能只减数再造匿名粮食。必须同时验证材料、2份粮、落位/容量/预算；失败和确认 No 零时间/料/ID/RNG。

锁定储粮记录对真实容器 Item 的必要数量引用/权限，不另存可消费的库存副本。营地存在期间玩家不可取出锁定剩余粮；额外存粮/其他补给可正常转移。任何通用转移入口也不能绕过锁，拆标记/毁坏/合并 stack/换箱/读档必须守住单一所有权。5D 居民将优先吃锁定粮；本步不消费日粮、不启动生产，给出后续可信消费接口或明确扩展点。撤营在同一事务退还剩余真实粮，背包/地面/容器无合法接收位置则拒绝，不能吞粮/复制/强制塞超限。

箱子保留非堆叠装备的真实实体 ID/附魔/诅咒/鉴定，批量转移100 tick，查看0 tick；箱内不自动充能、食用或恢复。毁坏沿底座掉落/残骸规则，满箱/满地/死亡终局不能丢物；锁定粮及标记被毁的最终策略需明确测试，优先保留可回收残骸与营地归属，禁止免费解除储备锁。

拆结构逐件付时，按剩余耐久返还50%向下取整；撤营先拆/搬空必要关联，最后释放名额/管理政策，保留已访问层、资源账本、slot高水位和有界收据。生成节点不妨碍撤营。跨层只能真实走楼梯，无暗中转移/免费补给。远方营地仅显示上次已知数据，不因查看结算。

## 5 施工、休息和界面

复用 5A3 cellProperties/房间/逃生/结构损毁所有合同；不覆盖危险地形、机关、楼梯、保护格、全足迹、生物/地面物品/箱/唯一工作位，不泄漏未见信息。门开关计时唯一，既有 P1 关门自锁修复保持。屋顶只提供定义资格，无回血/防毒/覆盖人物承诺。

实际可用的营地面板与建造目录/选格/预览/确认；编辑草稿0时间，最多16格按稳定顺序逐条付费提交，危险/缺料/失效立即停止后续，已建保留、未开工不扣；退出/blur/load/seek清显示队列。原生确认与 DialogService/DialogHost/DialogInput 为唯一模态输入屏障。

床/通用 RestPoint 使用原生耗时回血/饥饿/环境/打断，无补满、免饥饿、保命或篝火重置。死亡不可继续施工或转移。四地图模式显示能识别墙/门窗/屋顶/床箱，保留火/楼梯/人物/预警；纯读视图不消耗规则随机，不看未来 ACK 帧。

1440×900 / 390×844 / 320×844，普通/沉浸：窄屏抽屉限高、保留可用地图，建造选择可操作，长名字/满包不横向溢出。明确修复既有“合成抽屉打开时地图不跟随玩家”：基于实际可用地图视口重算镜头与输入坐标，不能通过关抽屉规避。桌面、收起、普通/沉浸及四种模式不回归。

## 6 验证与独立审查

环境 Node24.19.0（runtime bin放PATH首）、NODE_OPTIONS=--max-old-space-size=3072、vitest --maxWorkers=2。每个里程碑仅相关测试+boundary+vue-tsc+build；改生成/地形加 test:drift。不跑完整 npm test、全部 test:ext、全组合或删除矩阵（留5Z）。不放宽断言/skip/超时；旧前提须单变量反事实后最小调整。

必测：严格包/state/输入校验；D1/D5公开命令完整闭环及两层存读/replay/seek/续录；D1…40合法边界；同层/8营地上限、重建高水位；不足2粮/材料/容量/过期/No与回滚；锁粮所有入口、部分stack、不同FOOD、额外粮、撤营退剩；重复确认/连点/死亡；施工16格中断、逃生/保护/房间；容器装备身份/满箱/损毁；原生休息；不开settlement生产零启用；仅settlement及settlement+crafting/combat/giants相关组合。结合已有底座测试，不用定向拼接冒充全量。

真实浏览器验收上述视口、长内容、建造/存取/休息/撤营和抽屉相机；模拟触摸与真实设备分别标注。浏览器不可用须如实记录交接指挥，不把组件测试当像素验收。截图与大证据在仓库外。性能至少记录新增普通命令P95（目标≤5ms）与一层合理施工后的界面情况，256命令摘要峰值单列既有债务，不能把它误报已解决。

## 7 交付和边界

写 docs/ext/phase5c1.report.md、docs/ext/settlement-config.md；更新 README 只添加准确当前记录，保留历史。报告列：功能与数据决策、版本/冻结SHA、共享文件/所有权/注册表变动、每条任务验收证据、命令退出码数量耗时、反事实/基线逐叶变化、性能与浏览器、待用户确认及5D交接。

完成后停止实现并给指挥检查，不commit/push；独立审查将另起进程，随后resume你修复。不要提前实现5D，不修改dot分支。
