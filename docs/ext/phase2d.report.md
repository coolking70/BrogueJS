# 2d 刻符对话与立绘占位报告

## 范围与候选状态

从 `f4213be81dc86e9e1b128318d41453ea77a01fb3` 在 `ext/foundation` 实施维护者授权的2d，与2c联合验收。2c不回滚；停止于2d，不进入2e，不合回main、不打tag、不部署。本轮云端最终门禁及限定浏览器检查已完成，详细结果和未覆盖项见末节；代码交付仍待维护者2c+2d联合验收，不将测试通过等同于产品验收。

## main 选择性复用

准确读取 `dc0b78bd3a877a89f9b514ac325280cfce583342` 的实际源码，而非只依据设计说明。按生产/测试依赖选择性移植：

- `189559d` D1：DialogService/DialogHost/DialogInput、ACK与物品适配、同一输入capture所有者
- `53bd160` D2：原生命令显式generator续体、同命令decisions、陈旧答复与取消边界
- `371e75c` D3：已完成模拟的只读presentation timeline与显示投影
- `26ad9c43732c02ec3ce5bb0c3585ab38defa2922`：只将window自身blur视为失焦，不因按钮焦点切换吞第一次点击
- `b7193fc` D4：闪现跨熔岩的界面内确认
- `f3cbe65`：共享SFC harness与对应真实组件测试

仅补D1所需的终局未读消息显示前置合同；不引入同一旧提交的麻痹/死亡规则修复，不引入main的过量HP修改。没有直接覆盖ext Game事务/模块接口。通用源码、测试清单和状态合同作为复用整体登记，独立narrative/growth仍可物理删除。

## 正式叙事显示

- 当前NPC/名字/正文/立绘ID、可见选项及已知禁用原因、revision、只读状态和已公开日志沿模块纯投影进入视图。组件只接收DTO与显示参数，不取得Game、activeGame、模块定义AST、隐藏flags、未来节点或写能力。命令能力只在会话适配器内，以当前session/revision/node校验后调用executeCommand。
- 同一DialogHost渲染模块贡献的内容，未新建Teleport或独立backdrop。桌面宽两栏；390宽单栏72×96头像，320宽48×64头像；正文/选项/日志独立滚动，关闭和页脚常驻，按钮最小44px。日志与大图是同Host的显示页，返回保留正文scroll容器。
- live open/choose/close仍是已提交模块命令；0tick冻结仍由引擎interaction gate所有，不依赖图片、DOM或显示暂停。回放只读inline公开当前节点和日志，既不提交close也不制造DialogService等待，seek不等待图片。
- 立绘只使用已有项目内glyph占位；显示manifest仍为schema1/displayVersion1.0.0。包内assets/portraits下png/webp以静态白名单解析，未知ID、缺文件或加载失败降级占位。异步错误只改组件局部状态，旧图迟到错误不能清空新图；不进入规则/RNG/存档/录像。

## 单一输入所有权

旧 `Input.ts` 的keybMap、blockedUntilRelease及捕获keyup屏障已移除；其cancelHeldKeys只转交DialogInput。旧2b useNarrativeUi的escapeHeld、window keyup监听和guardDismissal同位置定时屏障一并移除。DialogInput统一处理held键直到真实释放、窗口blur、失去pointer capture、匹配按下/释放、拖动取消及跨关闭pointer cluster。

dialogue新增当前动作白名单和可见选项索引：↑↓在可用选项间移动焦点，Enter执行当前焦点，数字1–9只按当前投影索引且不执行禁用项，Escape在子页返回、主对话关闭。Tab只留在可见可用控件及正文/日志可聚焦滚动区。外点被消费而不暗中提交close。开框的第二次touch/click及关闭后的兼容click由同一输入所有者隔离，未重新引入模块屏障。

## 必要兼容适配与待决项

D2 generator与扩展同步受控动作事务存在真实合同差异，不能靠headless默认确认或直接跨await保存写context处理。维护者已明确授权成长酸蚀/失和友军攻击及危险地形/突进连枷确认的有限prepared-command整合；现已按main设计§4.5完成实现与专项验证，最终整体门禁及浏览器覆盖见末节，不得扩大为未执行用例全部通过。普通原生确认迁移与该边界必须一并证明，不牺牲已验收技能行为。

narrative机械包/状态/输入和持久规则数据未改变；立绘显示版本独立。最终版本兼容结论须由受控动作适配及录像对等验证后确认，不先声称旧格式已兼容。

## D3 与模块显示的补充适配

第一冻结树 `fe1282d92ee1481dbbc35f577132aa8c6e1f74d3624b0428ba322cae92c3e11c`（2082输入）正常type/build/boundary/65文件1275项ext及默认四子集smoke均通过，分别22.52/28.59/3.87/302.31/6.54s。随后在删除副本预构建阶段主动中断（外层exit130、未完成的单项不杜撰退出码），完整npm test从未启动；中断时输入hash仍与冻结相同。此树被明确可达的D3整合修复取代，不能冒充最终候选通过。

复现是已学习/装备brace的成长角色，在无食物、nutrition=HUNGER_THRESHOLD+1且slowed时使用技能：模拟完成后，旧饥饿MORE后仍有显示延迟。旧通用模块插槽会在旧画面后显示最终focus/CD；GameCanvas的displayModalOpen早退又跳过timeline.tick，角色页持续打开可使显示后缀停住。

修复仅属显示：

- ModuleUiHost提供通用isPresentationBusy；useModuleUi按DialogService的同步source更新保留的slot/controller/component，以presentationHidden、visibility/inert/aria-hidden隐藏HUD/bar，屏蔽过期按钮回调与提示glyph。模块自有属性在idle保留；不是卸载模块、重建会话或复制规则状态到timeline。
- Teleport/multi-root插槽须在实际显示根接受保留prop `presentationHidden`；成长角色页因此隐藏真正的portal，保留草稿/标签/实例。隐藏时拒绝重新获取焦点，恢复时不抢其他dialog/alertdialog的焦点。
- GameCanvas在现有display-modal分支仍只完成已提交的advancement，并排空presentation timeline；不调用tickReplay或自动行动。ACK等待仍由timeline自身保持，后台不累加阅读时间。
- 隐藏解除前先刷新当前模型，立即显示最终正确值；readonly replay不受live display-busy可见性约束，load/seek仍可进行。没有Game、模块state或RNG写集变更。

实际可达复现、挂载/草稿/标签保留、alertdialog焦点优先级、readonly replay/load/seek与真实canvas闭包均有专测；最终冻结门禁另列。

## 受控命令准备接口（单独验收）

依据main `dc0b78b` 的 `docs/design/in-app-dialogs.md` §4.5，本次授权严格限定为纯数据计划：原ext:command payload、受控primitive、actor/target ID、revision及只读风险事实。不得保存模块context或业务回调越过UI等待，不把Runtime.command改成Promise，不先执行再rollback作预检。

回答先进入本次命令的suppliedAnswers，尚不进入录像decisions。全部答案收集完成（遇No即停止继续提问）后校验计划/目标/revision，再进入原同步模块命令恰好一次；原requestConfirm按同一风险顺序消费答案、各记录一次。No也走原同步拒绝路径，保留原生命令前缀/取消语义，不扣focus、不写cooldown、不创建actionId/效果、不推进时间或实质RNG。等待冻结由外层待决命令所有，不由模块可写scope所有。

实际接口：

```ts
type ControlledCommandPreparationContext = Pick<ExtensionContext,
  'playerId' | 'state' | 'getComponent' | 'creature' | 'canManageCharacter' | 'validateAction'>;
interface ControlledCommandPreparation {
  readonly revision: number;
  readonly request: ControlledActionRequest;
}
ExtensionModule.prepareControlledCommand?(action: string, payload: Json,
  context: ControlledCommandPreparationContext): ControlledCommandPreparation | null;
ExtensionRuntime.prepareControlledCommand(data: unknown): PreparedControlledCommand | null;
// PreparedControlledCommand = { command: string, revision: number, request }
// Game 再附加 readonly risks: { kind, target, message }[]，全部冻结。
```

写集与边界：

- `ext/types.ts/runtime.ts`：纯准备接口、只读窄context、同步/JSON/原语校验、深复制冻结结果。所有accessor在finally撤销；没有transaction/command handler/RNG权限进入准备阶段，不把Context保存成计划。
- `growth/module.ts`：仅use-skill与有原生耗时的equip-skills复用已有planSkillCommand，返回revision与request；旧commitSkillCommand、beforeCommit/afterResolve仍在同一同步作用域内完整闭合。
- `Game.ts`：prepared风险、临时suppliedAnswers与递增消费游标归session WeakMap。原生普通攻击/移动和prepared路径共享preparePlayerAttackRisks/prepareAcidicAttackRisk/preparePlayerMoveRisks及鞭/矛命中列表准备；范围覆盖斧横扫、刺剑突进/连枷移动攻击。原语原有限制不变，混乱位移/释放俘虏不开放。
- 外层命令归一化只执行一次。prepared yield标记不向decisions追加，最终原requestConfirm核验完整kind/target/message与顺序，消费并记录一次；未提供、额外问题、未消费答案或不匹配request均拒绝。未提供纯准备合同的未来模块不能在已有异步UI环境里走同步默认Yes。
- 待决guard同时检查runtime身份、扩展完整快照、双RNG与既有原生目标/装备/地形事实；每次答复及最终执行前复核。陈旧或生命周期取消不冒充No事件；明确No则完成原命令并记录拒绝答案。
- `growth/ui/useGrowthUi.ts`：仅保留ownerCommandId、原命令字串、记录偏移和显示动作，不保留规则context/回调；待答保持提交态。结束后依据新记录的同一命令显示成功/已取消，不因等待中revision未变误报失败，也不因外部revision变化宣称成功。No保留原分配草稿。

与§4.5逐项对应：纯plan先于可写scope；同一原生风险准备；suppliedAnswers/decisions分离；确认后同一同步Runtime.command恰好一次（含No）；原成本/效果提交点不移动。没有保存业务回调跨等待，没有预执行+回滚，没有新增技能取消协议。新字段均为会话状态，无新持久字段；新增onCommandConfirmRequest按main登记U03 session-only。底座3、narrative1.2.0/state3/input2、growth1.5.0保持。

独立审查发现一条system/headless同步辅助入口可把prepared答案重复写入decisions并绕过UI等待；现明确拒绝将prepared boundary用于该辅助drain，补公开system入口回归。正常executeCommand UI路径与回放原路径未受该缺陷影响。最后专项为5文件150项通过（新基础16项、成长41项），88.89s，Node24.19.0/3GiB/2workers；vue-tsc通过。风险每类Yes/No、多问链、次要命中目标、seized/web/vomit前置退出、能力撤销、陈旧guard与命令前缀对等均覆盖。录像风险用例使用登记的诊断成长包（起始点数/equipTime测试配置）与固定房间布景，实际记录创建/学习/装备/使用ext命令并在同一诊断配置逐条replay/seek/save续录；不编辑事件checkpoint，不冒称自然生成或默认生产浏览器证据。正常默认包子集smoke与浏览器另列。上述专项不替代冻结候选门禁。

## 检查状态

开发专项已覆盖只读DTO、重复/中断、runtime替换、held释放、拖动/重复点击、当前选项数字键/焦点、资产失败与同页返回。共享SFC renderer只证明组件与事件合同，不证明浏览器CSS几何或真实触摸。

开发期第二轮完整扩展专项为63文件、1215 passed、0 skipped/todo/fail、exit0、272.32s；这是未冻结开发树，执行期间仍有显示/测试小修，不冒称最终候选通过。首轮为4文件失败：两份旧growth UI自写SFC import表不能解析新增DialogHost，两份提取displayFrame的fixture缺少新显示依赖，以及在并发改动窗口中读到尚未更新的narrative blocked断言；随后将三份growth测试迁到共享harness/真实显示依赖，原330处expect均保留，47/47通过。首轮43项skip来自suite setup失败，不是新增skip配置。

独立审查发现并修复：dialogue内pointerdown后以Escape关闭会漏掉物理release、旧timeline帧后露出实时附近NPC/日志、长文缺少键盘滚动与Tab从正文回到首按钮、换节点沿用旧scrollTop。补同一DialogInput的关闭/卸载隔离、显示busy过滤、PageUp/PageDown/Home/End及包含正文的Tabtrap、以session/node重置正文。另修异步组件焦点、开框touch cluster、陈旧图onload/onerror、拒绝命令反馈与shell打断后不可重建旧对话。相关4文件80项、后续输入/适配器47项及当前适配器13项分别通过；这些数字是各次实际范围，非拼接最终全绿。

上列为开发期证据；最终冻结门禁与真实浏览器结果以末节为准，不沿用2b截图，不拿单测冒充browser passed。

最终差异核对确认本次未改地图生成器、地形生成、生成RNG或放置规则；按本分支当前门禁政策不加drift。原始日志、构建/QA归档、截图在仓库外，不提交。


### 第二候选实测及窄屏修正（第三候选待复核）

第二冻结输入 `44c5156ada4f95da99d65a6997b8f2762eb7bf1585c936dbe80072269dd4febe` 的正常类型/构建/边界通过，完整ext为65文件1281项通过，默认四子集engine smoke通过。三份物理删除副本各完成边界/类型/构建/剩余ext/剩余子集save、load、replay、seek、续录：保留growth为58文件1100项，保留narrative为33文件666项，全删为26文件494项，均0skip/todo/fail。此候选未启动完整正常npm test，不能将其记为full通过。

维护者Mac实际浏览器检查已覆盖六布局几何、自然对话零tick/双RNG、原生食物No、诊断成长酸蚀No及酸蚀Yes后友军No、五事件自然录像step/seek、D3真实MORE隐藏及恢复、D4目标取消和其余五种删除构建/组合的新开局与休息。截图像素检查发现英文诊断长名字在320×844头像行被右侧裁切：caption继承`flex:0 0 auto`，虽然允许换行，仍按325px固有宽度布局并超出对话边界。六种自然布局、中文及图片失败像素无此问题。第二候选因此撤销最终冻结；按实际组件进行通用响应式caption收缩/换行修正，新增合同回归并重建第三候选，需窄范围Mac像素复核后再执行full。

这些浏览器结果不包含真实触摸、可靠物理held/window-blur、D4熔岩aim后No或九组完整UI持久化循环；不能把对应单测、engine smoke或诊断场景声称为这些浏览器用例通过。截图仅保存在Mac本地，不入库。一次只读浏览器工具调用阻塞147.5分钟后恢复，属工具证据缺口而非产品失败。

窄屏回归首次类型检查发现PostCSS父节点遍历推断过窄（Document父节点未纳入），类型门禁失败；改用实际AnyNode联合后重新冻结。失败日志保留，首次失败不算通过。


## 最终第三候选门禁与浏览器结论

冻结输入：`6dcc754edbeb222d7f43eb21688f34c629a50557d9ee4e5db2e641891fdc019a`，2082份文件；2026-10-04 UTC。正常与所有删除构建均为同一输入派生。Node24.19.0，NODE_OPTIONS=--max-old-space-size=3072，TZ=UTC，Vitest最多2workers。最终门禁后只补充本报告结果文字；非Markdown输入hash `033164007ddfb2c15cff0b1bf71ef24d2bbbf233cc4195ff365807d15aba0978`，全部代码、配置、测试和资源与已测冻结树逐文件一致。

| 范围 | 命令/证据 | 实际结果 | 秒 | exit |
|---|---|---|---:|---:|
| 正常 | `vue-tsc -b` | pass | 22.84 | 0 |
| 正常 | `npm run build` | pass；既有large-chunk warning | 30.44 | 0 |
| 正常 | `check-module-boundaries.mjs` | pass | 3.99 | 0 |
| 正常 | `npm run test:ext -- --maxWorkers=2` | 65文件1282 passed；0 skip/todo/fail | 321.84 | 0 |
| 正常 | `npm test -- --maxWorkers=2` | 316文件5885 passed，8历史skip、5历史todo；0 fail | 2347.62 | 0 |
| 正常 | `check-module-composition-smoke.mjs --engine-only` | 四子集start/save/load/replay/seek/continue通过 | 6.95 | 0 |

完整正常npm首个启动在14:43:28被执行环境monitor的automatic approval review cancelled中断；没有任何test结果或退出码，后续原session已不存在，单独保存为基础设施中断，不记产品失败或成功。经确认后14:45:12重新执行同一命令，15:24:20 exit0；这是唯一完成的正常full。没有在删除副本重复正常full，没有隐藏失败或以专项代替full。

物理删除副本各完成boundary/type/build/全部剩余ext及engine-only子集smoke，所有gate exit0。smoke含新建、保存、加载、逐事件录像、seek、续录和缺模块拒绝；不是九组浏览器完整UI持久化循环。

| 保留模块 | 删除文件/自有测试 | 剩余ext | boundary/type/build/ext/smoke秒 | 剩余子集 |
|---|---:|---|---|---:|
| growth | 35/7 | 58文件1100 passed，0skip/todo/fail | 3.74 / 21.30 / 35.73 / 296.85 / 5.92 | 2 |
| narrative | 62/32 | 33文件667 passed，0skip/todo/fail | 9.17 / 25.31 / 26.98 / 205.62 / 4.65 | 2 |
| 无 | 97/39 | 26文件494 passed，0skip/todo/fail | 3.67 / 17.01 / 29.42 / 207.82 / 4.52 | 1 |

删除矩阵工具返回partial-browser-not-verified，含义是命令明确选择engine-only；三行引擎gate全部passed，不能把该状态改写为工具已做浏览器。最终四份production dist逐文件与Mac包manifest一致。报告、原始log、删除copy哈希、QA归档与截图均分别保留；大型原始证据不入Git。

### 实际浏览器证据及限制

维护者Mac任务`01a10676-c80f-73c1-9ffc-62383855002c`使用云构建归档，无Mac安装/构建/full tests。第二候选完成1440×900、390×844、320×844普通/沉浸六布局几何，六种自然截图像素实际查看通过；自然seed8201对话/日志/禁用项/占位、零tick/双RNG、食物No、诊断成长酸蚀No与酸蚀Yes后友军No的focus/CD/actionId/time/RNG保持、真实菜单五事件录像step/seek0/end及无未来线索、D3诊断brace饥饿MORE隐藏且恢复同技能页与正确focus/CD、D4目标取消、其余五种删除构建/组合的新开局与休息均有实际浏览器证据。

像素检查实际发现并修复320宽英文长名字右裁切。第三候选归档SHA256 `1436ba6f8633f6de4e45886d946ba0900506217231172d5a488c0b797a57f7b9` 已重新检查英文完整caption的320/390/desktop、自然320、中文及失败降级；七张保存图片实际查看（六张要求项加一张过程图），无新阻塞。版本1归档内115个manifest覆盖文件与归档均校验一致；新包仅组件CSS、其既有测试、报告三个输入有变，移除narrative的两份构建逐字节未变。此次限于CSS复核，不伪称全部旧机械矩阵重跑。

证据保存在Mac本地`/tmp/broguejs-phase2d-44c5156-qa/report.json`及`/tmp/broguejs-phase2d-6dcc754-regression/report.json`，同目录截图索引和integrity记录。原始浏览器只读调用曾阻塞147.5分钟后恢复，属工具延迟，未归为产品bug。

未覆盖/不能声称通过：真实物理触摸、可靠held/window-blur事件序列、D4熔岩aim后No、九组完整UI save/load/replay/seek/续录循环。相应自动测试与engine smoke覆盖单列；手工快照/内容fixture不等于自然seed录像证明。长文/缺图fixture不构造世界，不证明RNG或规则。没有真实立绘资产，美术接入仍由维护者后续提供。

### 立绘后续接入合同

维护者将本地图放在`src/ext/modules/narrative/assets/portraits/`下png/webp，在`data/portraits.json`登记相对asset、尺寸、contain/bottom-center、altKey/fallbackGlyph，并补模块locale。只接受静态白名单命中的本地文件，不由NPC ID构造外链。图片变更仅增加显示displayVersion；不改变module/rules/state/input、RNG、save或replay身份。未知ID、加载中、缺失、失败均立即保留占位，不阻塞命令或seek；旧图迟到事件不能改新图。当前schema1/displayVersion1.0.0，只有占位，无外部图片授权依赖。

### 版本及停止点

foundation3、manifest.schema1、narrative module/rules1.2.0/state3/input2、growth module/rules1.5.0、存档/录像schema2均不变；纯显示与临时prepared答案不持久化。已有版本严格校验，不做迁移。D4新增录像action `arcana:risk-confirm`需要理解该action的新引擎，不能宣称任意旧引擎可读；旧answerless批准confirm_target保留main解释。新prepared分支的答案仍只记入原ext命令decisions一次，诊断风险测试与默认包smoke均无OOS。

不执行test:drift（没有生成器/生成随机数/放置规则改动）；不执行旧CE全档/ce:fetch/test:gen（当前ext政策不要求且不改CE缓存）。停止2d，等待2c+2d联合验收；不含2e、主线合并、tag或部署。

## main移植文件清单

下列为选择性main复用起点；标记并不表示最终文件与main逐字节相同，ext事务、模块插槽和对话适配按本报告做了有界修改。

- scripts/test-suites.json
- scripts/u03-state-contract.json
- src/App.vue
- src/components/ContextPanel.vue
- src/components/DialogHost.vue
- src/components/GameCanvas.vue
- src/components/GameEndOverlay.vue
- src/components/InventoryOverlay.vue
- src/components/MessageAcknowledgment.vue
- src/components/MessageJournal.vue
- src/components/ReferenceOverlay.vue
- src/components/Sidebar.vue
- src/components/TargetBar.vue
- src/components/theme/ThemeNearby.vue
- src/engine/Core/Game.ts
- src/engine/Core/PresentationObserver.ts
- src/engine/Core/TimeCoordinator.ts
- src/engine/Input.ts
- src/engine/Systems/Logger.ts
- src/locales/zh_CN.json
- src/test/dialog_continuations.test.ts
- src/test/dialog_d4_blink.test.ts
- src/test/dialog_host.test.ts
- src/test/dialog_service_input.test.ts
- src/test/dpad_hold_input.test.ts
- src/test/immersive_polish.test.ts
- src/test/map_touch_input.test.ts
- src/test/presentation_timeline.test.ts
- src/test/search_progress_hud.test.ts
- src/test/sfc_harness.test.ts
- src/test/support/commandConfirmation.ts
- src/test/support/dialogD3Scene.ts
- src/test/support/dialogD4Scene.ts
- src/test/support/sfcHarness.ts
- src/test/theme_shell_fixes.test.ts
- src/test/ui_1_rendering.test.ts
- src/test/ui_4_glyph_feedback.test.ts
- src/test/ux_1a_end_ui.test.ts
- src/test/w_7_arcana_enchantment.test.ts
- src/test/x3_u5_ui.test.ts
- src/test/x3_u6_messages.test.ts
- src/ui/dialogAcknowledgments.ts
- src/ui/dialogInput.ts
- src/ui/dialogService.ts
- src/ui/displayProjection.ts
- src/ui/messageAcknowledgment.ts
- src/ui/nearbyInspection.ts
- src/ui/playerHudStatus.ts
- src/ui/presentationTimeline.ts
- src/ui/useGameHud.ts

## 本次相对2c完整变更文件

共79个路径（A新增/M修改/D删除）：

- `M` `docs/ext/README.md`
- `M` `docs/ext/architecture.md`
- `M` `docs/ext/phase2-narrative.md`
- `M` `scripts/test-suites.json`
- `M` `scripts/u03-state-contract.json`
- `M` `src/App.vue`
- `M` `src/components/ContextPanel.vue`
- `M` `src/components/GameCanvas.vue`
- `M` `src/components/GameEndOverlay.vue`
- `M` `src/components/InventoryOverlay.vue`
- `D` `src/components/MessageAcknowledgment.vue`
- `M` `src/components/MessageJournal.vue`
- `M` `src/components/ReferenceOverlay.vue`
- `M` `src/components/Sidebar.vue`
- `M` `src/components/TargetBar.vue`
- `M` `src/components/theme/ThemeNearby.vue`
- `M` `src/engine/Core/Game.ts`
- `M` `src/engine/Core/TimeCoordinator.ts`
- `M` `src/engine/Input.ts`
- `M` `src/engine/Systems/Logger.ts`
- `M` `src/ext/modules/growth/locales/zh_CN.json`
- `M` `src/ext/modules/growth/module.ts`
- `M` `src/ext/modules/growth/test-suites.json`
- `M` `src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts`
- `M` `src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts`
- `M` `src/ext/modules/growth/tests/ext_growth_ui.test.ts`
- `M` `src/ext/modules/growth/ui/GrowthCharacterPanel.vue`
- `M` `src/ext/modules/growth/ui/useGrowthUi.ts`
- `M` `src/ext/modules/narrative/locales/zh_CN.json`
- `M` `src/ext/modules/narrative/test-suites.json`
- `M` `src/ext/modules/narrative/tests/narrative_ui.test.ts`
- `M` `src/ext/modules/narrative/ui/NarrativeInteractionBar.vue`
- `M` `src/ext/modules/narrative/ui/useNarrativeUi.ts`
- `M` `src/ext/modules/narrative/ui/view.ts`
- `M` `src/ext/runtime.ts`
- `M` `src/ext/types.ts`
- `M` `src/ext/ui/types.ts`
- `M` `src/ext/ui/useModuleUi.ts`
- `M` `src/locales/zh_CN.json`
- `M` `src/test/dpad_hold_input.test.ts`
- `M` `src/test/ext_module_ui.test.ts`
- `M` `src/test/immersive_polish.test.ts`
- `M` `src/test/map_touch_input.test.ts`
- `M` `src/test/search_progress_hud.test.ts`
- `M` `src/test/theme_shell_fixes.test.ts`
- `M` `src/test/ui_1_rendering.test.ts`
- `M` `src/test/ui_4_glyph_feedback.test.ts`
- `M` `src/test/ux_1a_end_ui.test.ts`
- `M` `src/test/w_7_arcana_enchantment.test.ts`
- `M` `src/test/x3_u5_ui.test.ts`
- `M` `src/test/x3_u6_messages.test.ts`
- `M` `src/ui/messageAcknowledgment.ts`
- `M` `src/ui/nearbyInspection.ts`
- `M` `src/ui/useGameHud.ts`
- `A` `docs/ext/phase2d.report.md`
- `A` `src/components/DialogHost.vue`
- `A` `src/engine/Core/PresentationObserver.ts`
- `A` `src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts`
- `A` `src/ext/modules/narrative/tests/narrative_dialogue.test.ts`
- `A` `src/ext/modules/narrative/ui/NarrativeDialogue.vue`
- `A` `src/ext/modules/narrative/ui/NarrativePortrait.vue`
- `A` `src/ext/modules/narrative/ui/portraits.ts`
- `A` `src/test/dialog_continuations.test.ts`
- `A` `src/test/dialog_d4_blink.test.ts`
- `A` `src/test/dialog_host.test.ts`
- `A` `src/test/dialog_service_input.test.ts`
- `A` `src/test/ext_prepared_controlled_commands.test.ts`
- `A` `src/test/presentation_timeline.test.ts`
- `A` `src/test/sfc_harness.test.ts`
- `A` `src/test/support/commandConfirmation.ts`
- `A` `src/test/support/dialogD3Scene.ts`
- `A` `src/test/support/dialogD4Scene.ts`
- `A` `src/test/support/sfcHarness.ts`
- `A` `src/ui/dialogAcknowledgments.ts`
- `A` `src/ui/dialogInput.ts`
- `A` `src/ui/dialogService.ts`
- `A` `src/ui/displayProjection.ts`
- `A` `src/ui/playerHudStatus.ts`
- `A` `src/ui/presentationTimeline.ts`
