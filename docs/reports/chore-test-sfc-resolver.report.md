# SFC 测试依赖解析迁移报告

日期：2026-10-04。工作区：`BrogueJS-newtheme`；分支：`chore/test-sfc-resolver`；起点：`d8d0756c9b657c8c509a18da06d9b46ec251484d`。

按 [任务书](../tasks/chore-test-sfc-resolver.md) 完成公共工具和 main 上现有测试的迁移。没有修改生产代码、依赖版本、Vitest 配置、生成基线或黄金 trace；没有 commit/push。开工时已有未跟踪任务书，保留原样。

## 1. 迁移范围与结果

检索全仓库测试中的 `@vue/compiler-sfc`、`compileScript`、`transpileModule`、`new Function`、`require` 和依赖映射访问，找到以下 8 个手写 SFC 编译/模块映射测试。迁移前先运行原文件，迁移后按同样入口运行，并比较 JSON 报告的逐项 `fullName` 与 `status`。

| 文件（均在 `src/test/`） | 迁移前 | 迁移后 | 用例名与结果 |
|---|---:|---:|---|
| `dialog_host.test.ts` | 23 通过 | 23 通过 | 完全一致，含 D1–D4 |
| `dpad_hold_input.test.ts` | 26 通过 | 26 通过 | 完全一致 |
| `immersive_polish.test.ts` | 11 通过 | 11 通过 | 完全一致 |
| `search_progress_hud.test.ts` | 19 通过 | 19 通过 | 完全一致 |
| `theme_shell_fixes.test.ts` | 19 通过 | 19 通过 | 完全一致 |
| `ui_4_glyph_feedback.test.ts` | 23 通过 | 23 通过 | 完全一致 |
| `ux_1a_end_ui.test.ts` | 6 通过 | 6 通过 | 完全一致 |
| `x3_u5_ui.test.ts` | 7 通过 | 7 通过 | 完全一致 |
| **合计** | **134 通过** | **134 通过** | **0 失败，0 skip/todo** |

另用 TypeScript AST 提取这 8 个文件在 HEAD 和工作区的全部 `describe` / `it` / `test` 调用，逐段文本精确比较：所有测试定义相同，包含断言、容差、超时、参数化表和 skip。修改集中在 import 与 SFC 加载的 `beforeAll` 布置；未修订任何旧守卫前提，不涉及反事实或基线重录。

任务书候选中的 `map_touch_input`、`ui_1_rendering`、`gameplay_layout` 没有手写 SFC 依赖映射，无需迁移；`main_menu_replay_seek`、`ext_growth_ui` 不存在于本分支。`u24_hardcoded_text` 和 `immersive_polish` 保留用于静态源码断言的 SFC `parse`，它们不是依赖白名单。复查后，客户端 SFC 编译、CommonJS 转译和执行仅存在于公共工具。

## 2. 公共工具及使用方法

新增 [`src/test/support/sfcHarness.ts`](../../src/test/support/sfcHarness.ts)。它为 Vue 自定义 host renderer 编译客户端 script/template，普通 TS/JS、JSON、目录入口、包依赖经 Vitest 模块运行器加载，继续使用测试自身导入的单例和 Vitest mocks；真实 `.vue` 子依赖递归编译。无需登记普通新增 import。

公共路径和替身键都相对调用方的 `baseURL` 解析；组件内部依赖相对其实际文件位置解析，再统一到实际文件路径。同一替身因此适用于 `../`、`../../` 等不同导入深度，无需重复列键。支持省略扩展名、目录 `index`，以及不存在的 `.js` 路径对应 `.ts` / `.tsx` 文件。

```ts
import { createSfcHarness } from './support/sfcHarness';

const harness = createSfcHarness({
    baseURL: import.meta.url,
    stubs: { '../engine/Core/Game': { activeGame: gameStub } },
});
const TargetBar = await harness.load('../components/TargetBar.vue');
```

接口：

- `load(path)` 返回组件，`loadModule<T>(path)` 返回包含 `default` 和命名导出的模块；UI-4 通过后者继续读取 `commandOverflowPosition`。
- `stubs` 注入真正的模块替身，如可变的 `gameModule.activeGame`、派发 spy。键指向真实依赖文件或包；值采用模块 exports 形态。默认导出的替身使用 `{ default: value, __esModule: true }`。
- `components` 接受组件本身，公共工具负责默认导出封装；用于事件发射夹具、Canvas 和需要保留的真实子组件。
- `stubComponents` 是可选的子 SFC 默认替身，只在隔离 App 子树时使用，显式 `components` 优先。显式 `load` 的根组件仍编译真实代码。三个 App 测试用此选项代替逐一枚举所有空子组件的列表。
- `globals` 提供编译 SFC 的词法全局；X3-U5 保留原手工轮询的 `setInterval` / `clearInterval`。

模块互操作保留 ESM 的实时绑定，不复制引擎单例。编译缓存属于各 harness 实例，互不共享替身/全局设置。解析失败提示请求组件及依赖；循环 SFC 导入直接报出链路，不在自身缓存上等待。支持 `<script setup>`、普通 `<script>` 和纯 template 组件。

替身和 `globals` 作用于经工具编译的 SFC；普通 TS 依赖内部的替换仍使用 `vi.mock`。工具沿用本仓库文件路径及包导入，没有引入自定义 Vite alias 解析或浏览器 CSS/几何验收。

## 3. 新增回归与套件登记

新增 [`src/test/sfc_harness.test.ts`](../../src/test/sfc_harness.test.ts)，10 项全部通过，并登记到 `scripts/test-suites.json` 的常规组。夹具临时写入系统临时目录，测试结束清理，不增加生产组件。

覆盖：TS 目录入口和 re-export、JSON/包默认导出、Vitest 单例身份、递归子 SFC 客户端事件与缓存、普通 script/纯 template、跨深度及 `.js` / `.ts` 替身归一、可变替身与 ESM 实时绑定、显式子替身优先级、根组件真实加载、实例隔离与计时器、缺依赖/循环/损坏 SFC/非 SFC 入口错误。

## 4. 门禁

| 命令或检查 | 结果 |
|---|---|
| `npx vue-tsc -b` | exit 0 |
| `npm run build` | exit 0；既有大 chunk 提示 |
| 8 个迁移文件 + `sfc_harness` 定向运行 | exit 0；9 文件 / 144 项通过 |
| gen 组独立源码守卫筛选 | exit 0；5 文件 / 10 项通过 |
| `blueprint_center` 含源码断言的全局扫描用例 | exit 0；1 项通过，45 种子 × 26 层 = 1170 层 |
| `npm test`（含常规组全部源码守卫及 `test_suite_membership`） | exit 0；252 文件 / 4593 项通过，既有 8 skip / 5 todo 未改 |
| `npm run test:drift`（补充日常门禁） | exit 0；2 文件 / 2 项通过 |
| `git diff --check`、LF 与门禁输入散列复核 | 通过；567 个输入散列一致 |

gen 组单独执行的守卫：`b_1a_identification` 的 InventoryOverlay 免费方法墓碑；`c_4a_0_layer_model` 的地形写入白名单和 Grid 属性表守卫；`c_4a_terrain_catalog` 的 promote/fire/mechFlags 读者白名单；`v_1a_blueprint_items` 的 T1 墓碑；`v_2b_4_altars` 的 D1/D2/D3/D5/E4。定向筛选产生的未选用例不算新增 skip。`blueprint_center` 的源码断言在生成扫描 helper 内，因此按原门限运行真实扫描用例。

独立源码守卫的可复现入口（实际运行另加 JSON reporter，将输出写到上述临时目录）：

```sh
npx vitest run src/test/c_4a_0_layer_model.test.ts \
  src/test/c_4a_terrain_catalog.test.ts src/test/b_1a_identification.test.ts \
  src/test/v_1a_blueprint_items.test.ts src/test/v_2b_4_altars.test.ts \
  -t 'setTerrainLayer 调用点|Grid.ts 未引入|promote/fire 类字段|InventoryOverlay 不再|T1 墓碑|D[1235] |E4 直投守卫' \
  --maxWorkers=1
npx vitest run src/test/blueprint_center.test.ts -t 'b\) 全局扫描' --maxWorkers=1
```

完整 `npm test`、独立源码守卫和 drift 均直接退出 0，没有中止、超时放宽、种子削减或以定向复跑代替完整命令。纯测试基础设施不涉及 CE 规则变更，按任务档位未运行 `test:full` 或整组 `test:gen`。

## 5. 本地证据

原始输出统一保存在 `/tmp/brogue-sfc-resolver/`，不收入仓库：

- `before.json` / `after.json`：逐文件、逐用例迁移前后结果。
- `test-definition-audit.json`：旧测试定义原样保留的 AST 比较汇总。
- `typecheck.log`、`build.log`、`gen-source-guards.json`、`blueprint-source-guard.json`、`npm-test.json`、`drift.json` 和相应日志：门禁输出。
- `validated-inputs.json`：生产、测试、脚本与配置 567 个输入文件的 SHA-256，用于最终核对门禁期间无代码变化。

初轮迁移检查发现两处仍被旧用例使用的 import 被误删，已恢复；最终定向门禁全绿，没有修改用例来规避失败。
