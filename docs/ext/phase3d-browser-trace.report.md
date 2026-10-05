# 3d 普通帧防御：精确数值复核与 DEV 观察工具

## 结论

本轮没有复现普通帧下 NPC 调度停滞，**没有修改规则、调度、计时或窗口**。新增内容是诊断与回归，不能称为已修复用户浏览器问题。

在已有真实 Game + combat UI/确认服务 + 条件帧测试中，先执行七次普通 wait，再执行原 DEV 布景付费 slash，精确得到玩家 (38,20)、tick700、体力22、敌人 phase0/remaining10、HP30。NW 弹反后 tick800、体力19、窗口60/恢复100；推进完成后体力22、窗口/恢复0、敌人仍 remaining10、HP30。三种子与1×1 fallback共四场均为：

- 原 actionId2 已结束，`notifyActorParried` 成功调用一次；当前 warning 属于 actionId3
- 再次弹反结束 actionId3，出现 actionId4，成功调用累计两次
- 后续普通 wait 不享有已经耗尽的保护，玩家受伤
- 每次真实 `advanceActionTime` 合计100tick，NPC原生 ticksUntilTurn 最终同为10

所以用户给出的全部数值**同时兼容成功弹反后出现新攻击**。只有当前 actionId/防御事实能区分它与原攻击停滞，不能由 remaining10 单独裁决。

## 引用与显示差异

回归同时保留 live state、NPC对象、live bundle和脱离状态的JSON快照。两次结算后，live state和NPC对象保持身份；旧live bundle的remaining变为0并退出当前列表。旧JSON快照始终保留remaining10，它是历史证据，不会自行更新。

`actorActionBinding().state` 返回当前live state；`snapshot()`/公开投影为脱离数据。采样必须每次重新查找当前bundle。HUD使用 actionId 作为Vue key，却不显示该编号，因此新旧攻击具有相同phase/remaining时文字完全一样。

`timeSystem.currentTick` 是命令录像簿记，不是NPC推进权威。GameCanvas正常分支与模态分支均调用`tickAdvancement`；普通≤100tick命令在下一帧零yield完成模拟，展示时间线另外播放捕获帧。窗口/恢复与体力的消耗发生在真实elapsed处理里，不由currentTick的直接累加完成。本轮不据此更改簿记逻辑。

## DEV工具使用

仅开发版且启用了combat时可用。先正常建立需要检查的预警，再在浏览器控制台执行：

```js
window.debug_combat_trace('start')
```

返回值包含即时before快照。保持窗口可见，用原来的按钮正常弹反/闪避，等待展示完成，然后执行：

```js
JSON.stringify(window.debug_combat_trace('stop'))
```

复制返回JSON给维护者。中途可用`window.debug_combat_trace('read')`查询；默认调用也为read。重复start停止旧观察器；stop可重复，模块卸载也停止并还原方法。

字段：

- current/live bundles的actionId、源实体ID、phase、remaining、elapsed、对象身份编号
- NPC当前原生集合成员资格、位置、HP、ticksUntilTurn、空间数据、可见性
- 玩家资源、锁、动画开关、最后异常，当前捕获Game是否就是window.activeGame
- liveTelegraphs与displayedTelegraphs，展示队列/游标/等待状态
- 最近256个requestAnimationFrame快照与原生墙钟参数，最近256条成功弹反事实、累计defendedCount

工具只观察浏览器自己的requestAnimationFrame，**不调用**tickAdvancement/stepAdvancement/advanceTime，不执行命令，不改clock/RNG/持久状态。临时包裹notifyActorParried并原样传递receiver/参数/返回/异常；只有原调用正常返回才计数。该计数专指parry成功通知，**不是dodge成功计数**，也不把nextEffectId当作防御证据。记录增加采样开销，因此不能用它作FPS性能基准；不是无观察者效应的测量。观察器和GameCanvas的rAF顺序可能不同，单帧内完成的全部模拟边界不会逐个出现在samples里；defendedFacts由真实成功通知补足证据。每条样本在捕获时深拷贝，旧空间字段不会随live数据漂移。

工具关闭时原方法还原。一个runtime只容许一个活跃trace，旧stop不能撤掉新trace。没有Game字段、存档/录像格式、版本或默认开关变化。

## 浏览器验证边界

本轮实际浏览器挂载未完成。云Chromium/Playwright启动在访问页面之前遭遇socket权限与crashpad错误；确认同项目此前官方云浏览器localhost已被阻止后，没有绕过限制重试、切换浏览器或使用CDP。没有真实GameCanvas/Pixi挂载、像素或用户本机正常FPS的成功声明。

现有条件帧测试不是实际浏览器；它仍不能排除用户会话的模块实例、渲染投影或其他挂载条件差异。因此本次交付诊断工具，让实际浏览器日志直接给出action identity及成功事实。不能把手动驱动测试冒称为修复了普通浏览器失败。

## 验证与范围

精确tick700四场回归通过。观察工具开启/关闭的parry和dodge最终完整世界、双RNG、完整录像一致（仅正常归零保存/导出墙钟）；原方法恢复、原异常传播、样本边界、重复启动/乱序停止、历史空间快照均有专门回归。新测试开发和审查发现过重复观察器恢复链及浅引用样本问题，已修正工具，不涉及游戏规则。

最终门禁结果见交付记录补充。未运行完整npm test、全部test:ext、removal、CE full/gen/drift或giants长录像。没有推送main、标签或部署。底座实际fetch确认foundation和phase3均为98f9d15，phase4为980600c；保留既有4d历史，未触碰3e工作区。

新增历史空间样本测试的开发过程中，两种不适用的布景前提分别撞上原有空间能力守卫与DEV布景禁止保存守卫；改用原生生产注册的2×2 rat布景后通过，未修改任何守卫、旧断言或门限。

### 最终门禁

- 最终代码15个完整相关测试文件：169通过，0跳过，exit0，138.84秒。包含完整13项动画/诊断文件、防御UI/决策、warning/display、P2-4、presentation、i18n/硬编码/仓库/唯一归属守卫、u27/x2a/x3b录像。
- 真实Game组合smoke：9通过、22项名称过滤，exit0，20.62秒；包含empty及全部含combat的已安装模块组合（包括giants/growth/narrative）。没有运行长giants录像。
- 最终module boundaries/测试归属、vue-tsc+build、diff-check通过；仅既有大chunk提示。新鲜生产dist中搜索debug_combat_trace/defendedFacts/诊断专有错误文本均无结果，DEV工具未进入生产包。
- 完成前重新fetch并merge foundation为Already up to date；远程foundation/phase3仍98f9d15，phase4仍980600c。

原始最终日志：browser-defense-final-gates.log、browser-defense-final-build.log、browser-defense-smoke.log。数值诊断与引用专项日志：browser-defense-exact700.log、browser-defense-retained-reference.log。之前的smoke过滤表达式曾只选中1项，因此重新选择并实际完成上述9项；不把首次1项误报为全部组合。

## 发布前底座更新（取代前节的远程版本记录）

首次候选cecb2fb交付后，实际foundation前进到81c82a023c4052f73f41c503d822dc6a8898e7ef（4d-3 Shale Weaver里程碑和原98f9d15的合并）。已在隔离分支以真正merge保留双方历史，合并提交7c62e48；无冲突。新增上游包含整组生成预检、外围成员击杀计数、公开组投影/HUD与数据/回归；本次诊断相关文件没有被覆盖。相对新foundation的候选变更仍仅为诊断、测试和本报告。

需要连续两次动作证据时，可将起始与结束副本都保留在变量中：

```js
const beforeDefense = window.debug_combat_trace('start')
// 用正常UI完成第一次防御；等待展示结束，再正常完成第二次。
const afterDefense = window.debug_combat_trace('stop')
JSON.stringify({ before: beforeDefense, after: afterDefense })
```

stop已经解除观察。afterDefense是独立JSON数据，可稍后重复导出，不会继续被游戏改写。256帧环形缓冲只保留最近帧；起始副本与累计成功次数仍可用于判断两次攻击身份，不必把采样间隔当作模拟tick。

### 新底座合并后的最终门禁

- 18个完整相关文件：190通过、0跳过，exit0，158.07秒。除原15文件外，补跑上游giants_composite、giants_composite_sfc、giants_contract三个完整文件。
- 真实Game组合smoke：9通过、22项名称过滤，exit0，23.67秒。
- 新底座module boundary/唯一归属、vue-tsc+build、diff-check通过；生产包再次确认不含DEV trace。仍只存在既有大chunk提示。
- 最后ls-remote确认foundation/phase4均81c82a0、phase3仍98f9d15。没有推送。完整保留81c82a0及原诊断提交cecb2fb两条祖先历史。
- 新门禁日志为browser-defense-merge-gates.log、browser-defense-merge-build.log、browser-defense-merge-smoke.log；旧日志保留为合并前证据，不与新底座结果混称。
