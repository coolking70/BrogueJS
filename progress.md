Original prompt: 按 docs/tasks/ux-1-playtest-remediation.md 整改八项人工试玩问题；用户在 2026-09-29 明确要求停止定时任务并启动合适子进程开发。

- 自动化 broguejs 已暂停。
- 原门禁已结束，三个超时项及 drift 串行复核均通过于独立 playtest-remediation 工作树，源码前后哈希相同；证据 /tmp/broguejs-ux1-baseline-20260929/state.json。
- 开发在本 playtest-fixes 工作树、codex/playtest-fixes 分支进行。
- 开发期间不并行跑重门禁。主线程负责 App/MainMenu/翻译、浏览器验证与集成；子进程按分配文件实现。

- A/B/C/D/E 首轮实现已集成；实际Vue/Pixi浏览器保存/导出/导入/读档与双横竖屏模拟麻痹死亡流程通过。36组窗口/指针/UI大小组合日志末行可达；有效CSS视口缩小模拟重排，未声称控制原生浏览器工具栏缩放。
- 寻路纯网格长路径约2.1–6.1倍；3248网格完整回调/路径等价。D1/D3/D4/D5完整应用采样无证据将D4卡顿归咎于渲染。
- 交叉review发现并处理菜单反馈对自动行动的扰动（实际浏览器反例true→false）及幻觉显示RNG污染（UI子进程处理中）。
- 构建和32项源码/i18n/显示/导出边界定向检查已过。最终完整门禁待生产冻结后串行执行；不并跑重套件。
- 幻觉绘制改用独立显示流，改前新回归2/2红、改后含旧seeded RNG/R1守卫53/53绿；实际浏览器双流不变且显示流前进。生产已冻结，最终runner会话34201，状态/tmp/broguejs-ux1-final-20260929/state.json；请只跟进这一轮，不重复启动。

- 首轮完整npmtest退出1：244文件通过/2失败；4478测试通过/2失败/89 skipped/5todo，2946.44s。生产哈希前后相同。p2_2_real_speed两处输入事件计数失败由录制有效性标志误兼作收集开关导致，recording_impl修复；x3_u5_ui旧手编译SFC夹具缺新Input依赖，death_perf_audit做单变量反事实后仅修前提。原日志保留/tmp/broguejs-ux1-final-20260929/。修复后用同一完整Vitest集合的test:full（启用CE）统一复验，再drift，不另重复同集合的普通npmtest。
- 首轮失败已修：runtime.origin仅控制输入收集，complete来源独立控制导出；原p2_2 D1/D2不改，小套39过/2历史skip。X3-U5仅补真实Input模块映射和document.querySelector前提，7过；单变量反事实日志已保存。真实UI再验放大后的点击移动/投掷、8事件续录独立回放零OOS、存储失败回退及触屏死亡全部通过。
- 最终CE完整复验已启动，会话62586，/tmp/broguejs-ux1-recheck-20260929/state.json；build→ce:fetch→test:full(同npmtest完整集合，CE强制启用)→drift，3worker，无并行其他重测试。源码再次冻结。

- 最终验收完成：build/ce:fetch/test:full/drift全部exit0。CE完整套件246文件、4563passed/8历史skip/5todo；drift1/1。最终源码前后哈希fd39aa0ccebbe81b6ad2e5ebf68976c47389f3b54629c917066c591c29d1f52a。首轮全部失败已在完整套件中恢复，不是定向拼接通过。
- 本轮无需继续实施；剩余非阻塞验证是原手机现场、自然长局D4卡顿和原生浏览器工具栏缩放实机普查，详见known-issues及汇总报告。自动化保持暂停，未提交/推送/发布。开发预览http://127.0.0.1:5393。
- 最后标准客户端Canvas读回偶现全黑，属于采证路径缺口；已用浏览器页面合成截图再次跑完整集成流程，全通过且已查看正常地图截图，证据/tmp/broguejs-ux1-browser/final-integration/。基线对照Vite5394已停止；开发Vite5393保留供用户试玩。
