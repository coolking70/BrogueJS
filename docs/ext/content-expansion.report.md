# 原创 NPC 与立绘内容扩充

## 范围与基线

本轮承接已验收 `ext/foundation` / `6f837dbf094b42571cd4072ea6ff578a923d7b84`（tree `f5c4ca2f4892c118b3d461e53216a6d03e8d2b02`），只实施维护者的第1项：数据驱动NPC、分支对话、剧情事件与真实立绘。第2项阶段3仅设计另在 `ext/phase3`、本项完成报告以后开始。本次不合main、不tag、不部署。

云环境首次恢复为旧2c与未提交2d工作；未覆盖该旧工作区。在新兄弟工作区先复制已提交2c，再按顺序导入Library中已验收2d与2e bundle，校验两份SHA256、bundle prerequisites、快进提交及最终准确tree，得到干净基线。所有开发和门禁在云端；Mac仅接收相同构建字节作浏览器验收。

## 内容与完整路径

保留档案守卫 `archive.keeper` 的现有行为与日志，新增两位固定、可穿行、不参与战斗的原创NPC。三位都使用既有交互目标/命令/冻结/存档合同，不向Game增加字段，不增加脚本效果、背包、传送、地图改写或跨模块直接导入。

| NPC | 性格与关键物件 | 放置 | 对话 |
|---|---|---|---|
| `bell.mender` 缄钟匠 | 务实、克制的银发女匠；煤灰围裙、裂铜铃 | D1–D2，首访、每局一次、入口8格内，无位defer | 六节点，响铃/静音两个互斥结局 |
| `wick.listener` 听烬人 | 耐心而略显异样的旅人；灰蓝兜帽、熄灭提灯 | 同上 | 六节点，记下/放下名字两个互斥结局 |

路径（每节点另有恒真无效果退出）：

- 缄钟匠 `hello → ask-bell → decision`；`bell-toll → toll-ending → finish-toll` 或 `bell-hush → hush-ending → finish-hush`
- `decision → read-inscription → inscription → return-decision` 是档案残页联动旁支，要求 `archive.read=true`；否则禁用并解释原因。未读残页不阻挡两个结局
- 已结局时 `hello → recall-bell → remember → finish-remember`；最初询问禁用，回顾不再发奖
- 听烬人 `hello → listen-wick → memory`；`wick-keep → keep-ending → finish-keep` 或 `wick-release → release-ending → finish-release`
- `memory → ask-listener → reason → return-memory` 为可重复旁支；已结局时 `hello → recall-wick → remember → finish-wick-remember`
- `bell.verdict` 初值unresolved，结局值toll/hush；`wick.verdict` 初值unresolved，结局值keep/release。选择结局后立即写flag、独立journal并emit `bell.settled` / `wick.settled`；进入结局节点时已完成提交，关闭结局页不回滚该决定
- 各事件由 `bell.reward` / `wick.reward` once-per-run触发器处理，记录同名奖励收据；重复开口、回顾、读档与seek不能额外累积奖励

所有名字、正文、选项、禁用原因、日志和alt均走模块locale。入口没有强制自动分支，符合既有条件选项模型。每节点都有无需状态或奖励的安全离开路径。

## 可选成长与版本

| 身份 | 本轮 | 理由 |
|---|---|---|
| narrative module/rules | 1.2.0 → 1.3.0 | 新NPC、flags、节点、事件、引用与placement改变机械包 |
| growth module/rules | 1.5.0 → 1.6.0 | 新增自身报价 `bell.settled`、`wick.settled`，各5XP |
| portrait displayVersion | 1.0.0 → 1.1.0 | 三张真实图与显示元数据 |
| narrative state/input | 3 / 2，不变 | 沿用既有字段与命令协议 |
| foundation/manifest | 3 / 1，不变 | 没有底座协议变化 |
| save/recording | 2，不变 | 精确manifest继续阻挡不匹配旧规则 |

“只改displayVersion”适用于立绘资产本身；本轮独立的机械内容变更仍更新其module/rules及规范化指纹，不把新剧情伪装成旧规则。旧规则存档/录像不迁移，应开新局。纯图片更换、显示清单和locale文案不进入机械指纹。

实际生产growth `config.experience.sources.story` **仍为false**，不静默开启默认经验来源。报价保存在growth自己的 `data/definitions.json`，内容作者可调amount并显式启用story后另开新局。默认narrative-only记录absent；默认组合记录disabled；启用且没有相应报价记录unsupported-key；启用并保留报价则同条结局命令applied 5XP。前三者均是持久skip，不会以后补发。新正常Game测试另用显式启用的真实growth验证，不能把该测试配置称为生产默认。

## 原创立绘与出处

实际文件均在 `src/ext/modules/narrative/assets/portraits/`，manifest沿用既有ID或新增对应ID，不拼远程URL：

- `archive-keeper.png` → `archive.keeper.neutral`
- `bell-mender.png` → `bell.mender.neutral`
- `wick-listener.png` → `wick.listener.neutral`

三张均由本轮OpenAI内置GPT imagegen生成，原创暗黑奇幻、简洁人物轮廓、蚀刻插画与克制琥珀/灰蓝色。没有使用商业角色/原作图像，不模仿Lost Flame或其它特定作品。生成原图1086×1448 RGBA；等比LANCZOS缩小为288×384 RGBA（72×96的4倍），保留真实alpha，没有重绘或占位替代。原图与小尺寸联系表在仓库外；仓库只含最终PNG，不提交截图。

清单width/height均288/384、contain、bottom-center。当前桌面240×320、窄屏72×96/48×64及全屏查看沿用既有布局。加载失败仍保留已验证字形降级与离开控制；真实默认图应完成加载后退出fallback。

### 图像提示词

**archive-keeper**

Use case: stylized-concept. Create one original dark-fantasy NPC portrait raster asset for a compact roguelike dialogue UI, a weathered adult quiet traveler known as the Archive Keeper. Ochre-brown hooded cloak, parchment folio held close, reserved readable face. Bust-to-waist portrait, centered, strong simple silhouette, subject fits fully inside a portrait 3:4 frame with small transparent margins, face occupies enough space to remain legible when reduced to 72x96 and 48x64. Original etched illustration with painterly edges and restrained engraved-UI visual language. Shared palette: muted amber, ash, charcoal, parchment, no saturated colors. Clear planes of shadow, limited fine detail, warm soft edge light. Transparent background with real alpha, no scenery, no text, no letters, no logo, no border, no watermark. Original design only, do not imitate an existing game, commercial artwork, or character. Keep cloak and hands cohesive and anatomically plausible. Output high-quality PNG at native resolution.

最终PNG SHA256：`e65ca0f1909d1b7ad20b6c46eef3e5ede9a73d00b0559c662d9d3025cb7275bb`

**bell-mender**

Use case: stylized-concept. Create one original dark-fantasy NPC portrait raster asset for a compact roguelike dialogue UI, a practical older woman known as the Bell Mender. Short silver hair, lined steady face, soot-grey apron over charcoal work clothes, holding a copper cracked handbell and cord. Broad grounded silhouette. Bust-to-waist portrait, centered, subject fits fully inside a portrait 3:4 frame with small transparent margins, readable face large enough to remain legible reduced to 72x96 and 48x64. Original etched illustration with painterly edges and restrained engraved-UI visual language. Shared palette: muted amber, ash, charcoal, parchment, no saturated colors. Clear planes of shadow, limited fine detail, warm soft edge light. Transparent background with real alpha, no scenery, no text, no letters, no logo, no border, no watermark. Original design only, do not imitate an existing game, commercial artwork, or character. Hands cohesive and anatomically plausible. Output high-quality PNG at native resolution.

最终PNG SHA256：`7fd247ded1843b1fc8d8de6074568548b3da4a3c48fc9f81bc944ea994a0d824`

**wick-listener**

Use case: stylized-concept. Create one original dark-fantasy NPC portrait raster asset for a compact roguelike dialogue UI, a lean patient uncanny adult known as the Wick Listener. Ash-blue cowl, pale face partly in shadow, holding an extinguished dark metal lantern with visibly unlit wick. Narrow silhouette. Quiet watchful expression, subtle uncanny stillness without gore. Bust-to-waist portrait, centered, subject fits fully inside a portrait 3:4 frame with small transparent margins, readable face large enough to remain legible reduced to 72x96 and 48x64. Original etched illustration with painterly edges and restrained engraved-UI visual language. Shared palette: muted amber, ash, charcoal, parchment, ash-blue cloth, no saturated colors. Clear planes of shadow, limited fine detail, warm soft edge light. Transparent background with real alpha, no scenery, no text, no letters, no logo, no border, no watermark. Original design only, do not imitate an existing game, commercial artwork, or character. Hands cohesive and anatomically plausible. Output high-quality PNG at native resolution.

最终PNG SHA256：`7c756db3bf9301510cd9c3fba58014b2156cb07e04e4df1d5055e16ccd9734bb`

## 测试调整与验证状态

新增正常Game每个剧情结局、每节点退出、条件旁支/回顾、持久切点及逐条录像测试；新增growth自有的发现式真实组合测试验证显式启用报价5XP及unsupported-key，保持模块可删除。新测试均登记到所属模块清单。

既有纯schema/kernel/session/reward测试原来把生产单NPC包当作单例夹具，新增数据会改变稀疏数组索引、固定预览预算和收据计数等前提；本轮将这些有意单例用例隔离成keeper-only fixture，保持原断言和攻击面。真实安装/持久/展示测试继续使用完整生产包并按数据验证所有NPC。成长身份断言随实际1.6.0升级。实际文件与最后结果见下文门禁记录。

以下分别列出实际完成的正常门禁、删除门禁、Mac像素验收和完整npm结果，不把自动引擎测试当作手工浏览器证据。

## 未覆盖与限制

- NPC无位时defer至D2，仍不保证每个种子出现；不为剧情重试地图生成，不耗RNG。seed8201 normal三人都在出生点交谈距离内
- 未改变地图生成或规则随机消耗；只增加已有placement的静态内容，不运行CE full/gen或ce:fetch。独立审查确认不需drift：没有地图生成变更；扩展世界状态和分配的实体ID确实变化，由版本化真实Game持久/录像验证，不能称为所有模拟字节不变
- 真实设备held/touch/window-blur物理序列不因本次数据/图片补充而新增覆盖；既有自动输入测试仍保留
- 阶段3设计、类魂战斗、移动NPC、任务物品/商店和跨层世界修改不属于本轮

## 本轮实际门禁

Node24.19.0，3GiB堆，maxWorkers=2，TZ=UTC。保留并复制既有4.9MiB CE缓存，不隐藏缓存制造skip。未运行ce:fetch、CE test:full、test:gen；test:drift未运行（没有地图生成变更）。正常代码/数据/资源/测试冻结后运行；后续仅补写本报告实测结果。

正常与删除门禁初始输入SHA256 `16619e343598722fa2d5de3327389caa686675cc666fde55ebb737acba53415d`，2092文件；整段正常pre-full与删除结束hash相同。

| 正常树命令 | 实际结果 | 秒 | exit |
|---|---|---:|---:|
| `node scripts/check-module-boundaries.mjs` | 模块边界/测试归属通过 | 3.1 | 0 |
| `npx vue-tsc -b` | 通过 | 15.59 | 0 |
| `npm run build` | 通过；既有大chunk警告 | 20.95 | 0 |
| `npm run test:ext -- --maxWorkers=2` | 68文件1307passed，0skip/todo/fail | 303.35 | 0 |
| `node scripts/check-module-composition-smoke.mjs --engine-only --output=/workspace/scratch/db2caf941a8f/cloud-extension-evidence/content-expansion/composition.json` | 四模块子集真实Game新局/游玩/save-load/逐条replay/seek/续录通过 | 5.64 | 0 |

物理删除：`node scripts/check-module-removal.mjs --profile=removal --engine-only --maxWorkers=2 --output=<外部证据目录>`，647.90秒，exit0；三行都真实删除模块全目录、数据、资源与自有测试，清理TS/Vite缓存，以剩余目录重新发现测试。每行boundary/type/build/allremainingext/smoke全部exit0，没有重复完整npm test。

| 保留目录 | 删除文件数 | 剩余ext | 子集smoke | 删除后输入hash |
|---|---:|---|---|---|
| growth | 41 | 59文件1101passed，0skip/todo/fail | 空/growth | `0e5fb6be6d5d7b743d6489ce0447449d1a8bd007a1bef4b370549a36532a7e43` |
| narrative | 63 | 35文件675passed，0skip/todo/fail | 空/narrative | `b3802a73efaa054cf9621de800ebb2de4409c2f4950ab016a69a134ef88aa36e` |
| none | 104 | 26文件494passed，0skip/todo/fail | 空 | `93505b5451ed613cc88aec4ee728fc8d99ecf19c5699a5f88945b610e17c4050` |

每行门禁后输入仍等于自身删除后hash。工具状态partial-browser-not-verified准确表示engine-only，Mac正常产品像素验收另列，不能把它改写为删除工具自身运行了浏览器。

补充正常树原样生成的四组normal seed8201存档/录像（narrative局保存于缄钟匠活跃对话），在正常和三份删除构建读取：4×4=16组合，每格save与recording共32次，所需模块在场9格接受、缺失7格拒绝；拒绝保持player/runtime引用、完整非logger世界与录制状态、RNG不变。该补证不是手改manifest的探针替代。全部exit0，原始输入/结果在云端仓库外。

独立审查提出删除narrative后新growth测试文件会空、两处当前文档仍写旧版本/阶段的缺陷，均已修复；复核无未解决生产/测试缺陷。growth无narrative时仍执行其真实默认开关/两项报价/独立调价与指纹用例，不靠skip/exclude绕门禁。旧单NPC夹具适配专项12文件314passed，新增branch14passed；这些只是开发定位结果，最终ext包含全部。

## 相同构建字节的 Mac 浏览器像素验收

QA包 `BrogueJS-content-QA.tar.gz` SHA256 `bf73269f5f4b733fbb79a0fe89e12020cf20300e62dcfe42f9b63d3c41970d45`（1339028bytes），构建集合hash `99740bcd3da7b07b5e52e43c735484369590c5db2f754060e3e1031e19583e3c`。云端最终build与该包逐文件相同；Mac对35个归档文件再hash不变，仅静态托管，不安装/构建/跑本机完整测试。

2026-10-04 18:03 UTC完成，IAB Chrome154.0.0.0 / DPR1。实际查看16张本地截图：三位真实立绘、1440×900/390×844/320×844普通与沉浸六布局、全部大图和短横屏通过；图片正常载入，无默认fallback、无不当裁切、contain合同符合。四结局与四次重复开口实际UI通过；对话期间自然世界两RNG/tick/turn未推进。另独立引擎save/load及14事件replay/seek通过，不冒称完整手工菜单流程。

未覆盖：强制图片失败浏览器路径、显式开启5XP的浏览器结算、全部手工存读档菜单循环；加载失败/late-event由SFC测试覆盖，真实启用5XP由growth正常Game测试覆盖，全部分支多切点存读续录由narrative正常Game测试覆盖。截图仅Mac本地，不入仓库、不上传。浏览器任务结束关闭临时端口5440/标签页并恢复视口与沉浸偏好。

Mac报告 SHA256 `7cbcec873dffdadc31e03da7a68304d51a2fba04921ad12b9546fce4c9f106a7`；浏览器通过不代替下列完整npm test。

### 完整正常 npm test 最终结果

在Mac浏览器无源代码修改阻断后，于2026-10-04 18:04:49 UTC启动且只运行一次：`NODE_OPTIONS=--max-old-space-size=3072 TZ=UTC npm test -- --maxWorkers=2`。实际319文件全部通过，5910 passed、8历史skipped、5历史todo、0fail，exit0；总命令1918.19秒（Vitest1917.28秒）。没有用定向拼接或串行复核冒充完整全绿。

完整npm前后输入hash均 `4e3fcc869d0da07541d45541a99b4cd32959f9fc7594212a3573f1f9109db5dd`，2092文件。它与pre-full/removal hash的差异仅为本报告追加已完成的门禁和Mac实测记录；生产、数据、资源、测试、脚本、手册和配置未变。完整npm结束后仅在本报告追加这一结果段，另行验证diff/check与输入差异，不因写测试结果重新跑第二次完整npm。

## 交付总结

本项实现完成：两位原创NPC、四个互斥剧情结局、两份可配置但默认关闭的5XP报价、三张真实GPT立绘；完整正常门禁、真实目录删除门禁、全部子集与真实输入拒绝矩阵、独立代码复核及相同字节六布局浏览器验收均完成。机械和显示身份独立版本化。真实物理输入/强制失败/完整手工持久化菜单的覆盖限制按上文保留。

仅提交 `ext/foundation` 本项变更，基线限定bundle以已验收 `6f837dbf094b42571cd4072ea6ff578a923d7b84` 为唯一前提；不含旧脏工作区，不包含阶段3，不合main、不tag、不部署。第2项阶段3设计仍须在本项向维护者报告后由协调方开始。
