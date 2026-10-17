# 6Z 任务单：phase6 普通集成收口

> 执行裁定（2026-10-17）：维护者已接受 Z-D1…Z-D7 全部推荐；本次候选 `ext/phase6` / `06682d538084d552e40ba192c9f1e2e896b3e13d`。本单下列精简门禁覆盖原完整 npm/ext/drift、256 组合及新增性能运行要求。最多两轮修复；不提交、不推送、不合并、不部署。
>
> 原起草基线为 `07d7c97`；执行候选见上。6A1–6C4功能已提交；C3/C4云端run已登记§6；本次查询C3超时、C4取消，完整性能结论待维护者补录。本文件不授权发布。
>
> **C-D8 已裁定：普通 phase6 收口，影响面测试 / 精选七组合 + 静态依赖 / 全删 1 行；不做发布矩阵、不打大版本 tag。** 本次授权执行 Z0–Z6；Z7 仍须后续明确授权。

> 最终执行状态：两轮修复已用完，自动门禁尚有22文件138项失败未关闭；七组合通过，全删首败定向关闭。详见[6Z报告](phase6z.report.md)。本任务单保留执行规范，不表示验收通过。

## 1 依据、顺序与停点

主依据为 [6C 任务单 §9 Z1–Z7](phase6c.task.md#9-phase-6-收尾建议6z)、[C-D8](phase6c.task.md#102-维护者裁定2026-10-16c-d1c-d8-全部采用推荐) 和 [ext 当前测试政策](README.md#扩展分支测试门禁政策2026-10-13-即日生效)。先读根 AGENTS、[交接](../HANDOFF.md)、[开发指南](../development.md)、[架构](../architecture.md)。扩展分支采用当前 ext 政策；不执行已移除的 `ce:fetch` / `test:full` / `test:gen`。若将来改为合 main，另定主线门禁，不套用本单。

执行顺序：

1. **Z0 前置**：核对分支、候选、C3/C4 云端结果、site 延期及各步审查状态。可先整理文档和清单；C3/C4 未出结果时报告待维护者补录，不阻塞其余收口工作，不冒称性能通过或可发布。
2. **Z5/Z6 先整理**：完成 §7 文档/合同及遗留登记，再冻结待验候选。历史报告保留原始身份与失败，新增当前状态说明，不重写历史为通过。
3. **Z1**：Node24 / 3072MiB / maxWorkers=2，受影响文件去重单次运行；有逐文件字节与原样通过证据的沿用。boundary、静态测试依赖、vue-tsc、build 各一次；drift 按源码影响决定。
4. **Z2/Z3**：发现器精选七启用组合；一个全删布局、全部剩余 ext、全关生命周期和真实缺包拒绝。不做单删/单留，不执行 `--release-matrix`。
5. **Z4**：既有性能身份/冻结预算核对，仅补 0/1/4 孔与100次只读计数/体积小见证；维护者完成统一三档浏览器清单。
6. 有问题按 §4 最多两轮审查→修复→复核；冻结修复后身份，按影响复验，不覆盖首败。无问题不制造第二轮。
7. 交 Z1–Z6 最终报告、候选/目标差异、发布说明草案；**Z7 只有维护者明确授权后执行**。

前置通过条件：C1/C2 已采用预算及例外可追溯；C3/C4 云端结果按实际状态记录，缺结果待维护者补录；site 无入口的延期有明确记录；各步已确认缺陷关闭或由维护者具名裁定。提交存在、工作流绿灯、限定测试通过，均不代替以上条件。当前 `07d7c97` 仍缺 C3/C4 冻结预算/route/source，注册为 `accepted:false`；不得在本次文档起草中假填通过。

## 2 Z1：环境、冻结与完整门禁

### 2.1 环境及证据目录

以下命令从仓库根执行，使用同一个 Bash 会话。Node24 路径为本机已核实的 runtime；异机只替换 `P6Z_NODE_BIN`，必须实际验证主版本。3072MiB 指 Node old-space 上限，不宣称进程 RSS 总量被限制在 3GiB。测试、构建、smoke、性能不同时运行；同机无其它重负载，长任务必须保留真实退出码。不要粘贴未经确认的私有 detached 工具路径。

```bash
bash
export P6Z_NODE_BIN=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
export PATH="$P6Z_NODE_BIN:$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
export P6Z_ROOT="$PWD"
export P6Z_EVIDENCE="$(mktemp -d /private/tmp/phase6z-XXXXXX)"
node -e 'if (process.versions.node.split(".")[0] !== "24") process.exit(1)'
node --version
npm --version
git branch --show-current
git rev-parse HEAD
git status --short
```

Node 检查失败即停止；不得沿用系统 Node25。确认是 `ext/phase6`，记录完整 HEAD、上游、Node/npm、OS/CPU、起止时间；若 HEAD 已变，逐文件登记相对 `07d7c97` 的差量及授权，不把旧 hash 当当前候选。证据目录每轮唯一，原始日志/截图/录像/CPU profile 留仓外；报告仅放小型摘要、hash、位置、run id/attempt。

使用以下日志包装器，**每次调用后查看 rc**。它保留失败并允许继续采集不依赖该成功结果的门禁，不会自动授权进入下一停点。不要用 `tee` 的退出码代替测试退出码，也不要用 `set -e` 丢掉后续结果登记。

```bash
run_gate() {
  local gate="$1" rc
  shift
  printf '%q ' "$@" > "$P6Z_EVIDENCE/$gate.command"
  printf '\n' >> "$P6Z_EVIDENCE/$gate.command"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$P6Z_EVIDENCE/$gate.started"
  "$@" > "$P6Z_EVIDENCE/$gate.log" 2>&1
  rc=$?
  printf '%s\n' "$rc" > "$P6Z_EVIDENCE/$gate.exit"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$P6Z_EVIDENCE/$gate.ended"
  printf '%s exit=%s\n' "$gate" "$rc"
  return "$rc"
}
 # 已有依赖且 lockfile 未变时沿用；仅依赖缺失才 npm ci，避免重复安装。
```

依赖缺失导致安装失败时先处理环境，不开始门禁。不得为安装或通过测试擅改 lockfile。Z5 文档/必要修复就绪后冻结：

```bash
node --input-type=module <<'JS' > "$P6Z_EVIDENCE/source-before.json"
import {sourceSnapshot} from './scripts/ext-perf-source-snapshot.mjs';
import {hashCandidate} from './scripts/check-module-removal.mjs';
console.log(JSON.stringify({src:sourceSnapshot(process.cwd()),candidate:hashCandidate(process.cwd())},null,2));
JS
git diff --binary HEAD > "$P6Z_EVIDENCE/candidate.patch"
git ls-files --others --exclude-standard > "$P6Z_EVIDENCE/untracked.txt"
```

`sourceSnapshot` 的 src 清单包含测试和新增源文件；`hashCandidate` 还覆盖脚本/配置/文档，排除 dist/依赖/缓存。另登记未跟踪文件的内容 hash，不能只留文件名。最终 build 后对 dist 按排序相对路径逐文件 SHA256、再对清单求 SHA256；保留算法/完整清单。规则/静态 pack/各有效能力目录及配置指纹从真实运行会话导出，不手写模拟。SDK 字节、性能工具/manifest/route/source 的 hash 分列，不将 src hash 等同于工具或构建身份。

### 2.2 精简门禁（维护者本次授权，替换原 Z1/Z2）

1. 从 `git diff 9cf8366 HEAD -- src scripts` 建立源码影响集。用 `scripts/test-suites.json` / 模块清单的发现器及 `analyzeTestDependencies` 的传递 imports、required/optional、读源码守卫补充依赖，逐文件生成选择依据。测试自身及夹具变化也计入。动态目录发现和读源码字符串不能被静态 imports 漏掉。
2. 已在各步审查原样整文件通过，且测试/夹具/传递依赖/动态能力依赖在该证据之后字节不变者，登记原日志、身份、通过数、依赖核对和沿用理由，不重跑。无法证明者进入单次去重批次；不另跑完整 npm test/test:ext。
3. 批次命令为 `node node_modules/vitest/vitest.mjs run <选择文件> --maxWorkers=2`，Node24、`NODE_OPTIONS=--max-old-space-size=3072`；记录 JSON reporter、原始日志及退出码。超时先原 timeout 单文件单 worker 复核，再按已接受 Z-D3 因果关闭，不为全绿重跑全集。
4. 正常候选 boundary、静态测试依赖检查、`vue-tsc -b`、`vite build` 各一次。build 用 Vite 直接入口，避免 npm build 再次隐式运行 vue-tsc。已有依赖沿用。
5. drift 仅在上述 diff 触及 drift 测试的实际依赖源码时运行；与影响面批次去重（单列 drift 成员结果即算实际执行），否则逐依赖登记跳过理由。不以版本或模块标签猜测无影响。
6. 不并发多个重门禁；首败、复核、历史 skip/todo、未选/沿用、unhandled 分列。

```bash
run_gate 01-boundaries node scripts/check-module-boundaries.mjs
run_gate 02-test-dependencies node scripts/check-test-dependencies.mjs
run_gate 03-types node node_modules/vue-tsc/bin/vue-tsc.js -b
run_gate 04-build node node_modules/vite/bin/vite.js build
# 文件清单在选择报告中冻结后，单次运行；不直接粘贴占位。
run_gate 05-impact node node_modules/vitest/vitest.mjs run <选择文件> --maxWorkers=2
```

冻结 src、依赖工具与 SDK 字节，运行期间不得改变实质输入；纯文档更新单列，不因此重复门禁。

## 3 Z2/Z3：精选启用组合与全删一行

### 3.1 正常树精选组合

只跑 **全开、全关、loot+growth、仅 loot、仅 growth、全开去掉 loot、全开去掉 growth**，engine-only。发现八模块后以模块 ID 生成这七个唯一集合；不跑 256 全组合。复用原 smoke 的实际 new/play/save/load/full replay/seek/续录、初始命令及自然贡献断言；如现有 CLI 不支持七集合，可用仓外副本仅替换输入选择，记录副本差量/hash，不削减断言。浏览器保持 not-run，交维护者 U01–U18。

### 3.2 一个真实删除布局

先按 §3.3 完成仓外探针，再在正常候选导出同版本真实输入，随后删除；按下面顺序执行：

```bash
run_gate 10b-real-capture node "$P6Z_EVIDENCE/real-missing-inputs.mjs" capture "$P6Z_ROOT" "$P6Z_EVIDENCE/real-inputs"
run_gate 11-all-deleted npm run check:module-removal -- --profile=removal --retain=none --engine-only --maxWorkers=1 --output="$P6Z_EVIDENCE/all-deleted"
```

核对 `module-removal-results.json`：只有 keep-none 一行；8 个模块目录物理缺席；模块自有测试随所有权删除，非模块剩余源文件与冻结候选一致；boundary、测试依赖、types、build、**全部剩余 test:ext** 及全关生命周期均实际执行。全删 endpoint 去重为1，不做256种删除布局。runner 遇失败会停止该行后续门禁，未执行项保持 not-run；修复后在同一逻辑布局复验影响项，旧目录/日志不覆盖，不因多次尝试宣称做了多行布局。

全删 skip 只允许静态声明缺 required 模块所生成的具名跳过，记录文件、组名、required、缺失集合及原因。原本存在的 skip/todo 另列；正常树模块齐全应执行原断言。不能删除未归属测试、留下模块类型桩或临时扩大白名单。`prepared-not-verified` 不能验收，C 子步的限定全删测试不能替代此处完整剩余 ext。

### 3.3 必补真实缺包输入，不能只用现有 smoke 的合成负例

当前 `check-module-composition-smoke.mjs` 的负例会给 manifest 添加 unavailable 模块，仅作附加边界。**它不能独自证明真实含 loot 存档/录像的缺包拒绝。** 后续执行者须在仓外准备 `real-missing-inputs.mjs`，不改生产源码；这是 Z2 必须交付的探针，不是假定仓库已有该脚本。固定 CLI 和执行顺序如下：

```bash
# 第11步完成后读取真实副本路径；不猜临时目录名。
export P6Z_REMOVED="$(node --input-type=module -e 'import fs from "node:fs"; const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(r.cases.length!==1) throw Error("Expected one row"); console.log(r.cases[0].temporaryCopy)' "$P6Z_EVIDENCE/all-deleted/module-removal-results.json")"
run_gate 12-real-missing node "$P6Z_EVIDENCE/real-missing-inputs.mjs" reject "$P6Z_REMOVED" "$P6Z_EVIDENCE/real-inputs"
```

探针实现与验收合同（报告附脚本 hash、命令、完整结果，不只附“pass”）：

- `capture` 用指定 root 的 Vite SSR/真实 Game 和发现器，分别创建 loot、loot+growth、loot+crafting、loot+giants、all，走合法初始命令及至少两个已结算玩家动作，导出未经编辑的 `toSaveSnapshot()` / `exportRecording()`。在完整候选先成功 load、逐事件 replay、seek、续录并校验检查点；不修改 manifest/版本，不把手造缺包对象当真实输入。输出每组模块/规则身份、事件数、文件 hash、合法载入结果。
- `reject` 必须从物理删除副本加载实现，先创建可游玩的全关活局；逐份读入上述原文件，`loadSnapshot` / `loadReplay` 均返回 false，原因确为缺包（不是旧 foundation/格式）。每次拒绝前后核对活局完整对象图和引用、双 RNG、实体/机器 allocator、runtime/模块状态、当前录像与时钟不变；用独立完整图 oracle（`src/test/support/fullGenerationCheckpointOracle.ts`）及外部 allocator 读数，不只比较存档投影。最后继续行动并验证可保存/回放。
- 所有输入在正常树成功、删除树失败，才算通过。稀有物品/工单/part 自然链另外由 §5 核验；这组短输入只证明真实缺包边界。保存探针源码和结果于仓外，以便复核，不把缺失脚本误报为已执行。

## 4 首次失败、复核、skip 与最多两轮修复

每个门禁使用下列列头，按**命令和候选身份**分行；原始计数不互相覆盖，不累计重叠测试：

| 门禁/候选 | 首次完整执行（命令、exit、pass/fail、耗时） | 复核（原因、原门限、范围、exit） | skip / 未选 / todo（逐项理由） | unhandled / 环境中断 | 最终裁定/责任人 |
| --- | --- | --- | --- | --- | --- |
| 待执行 | 未执行 | 未执行 | 待实际发现 | 未执行 | 待裁定 |

1. **首次失败**：保存日志、失败名、seed、堆栈、信号、source hash；先区分生产缺陷、测试前提、环境/超时、缺依赖和未执行。不把 OOM/进程中断算“剩余通过”，不把时间污染样本静默丢掉。
2. **复核**：超时/争用按原 seed、原断言、原 timeout，单文件/单 worker/禁文件并行执行，例如 `run_gate R1-file node node_modules/vitest/vitest.mjs run <确切失败文件> --maxWorkers=1 --no-file-parallelism`；先将占位替换为首败实际文件。记录文件中的全部结果，不只截取通过项。禁止提高 timeout、减少样本/组合、放宽预算、关 OOS 或改守卫求过。
3. **测试与基线**：真实正确性失败修生产。旧测试若确因本次修复失效，按根 AGENTS 先做只回退本次生产文件的单变量反事实，再仅修前提，不改断言语义；逐项登记。纯身份/格式差量沿 ext 政策按原捕获法重录并说明版本原因；含玩法/RNG/未知差量仍做单变量归因、按 [testing §3](../testing.md) 逐字段登记。不把格式升级用作改随机结果的解释。
4. **skip**：历史 skip、todo、`-t` 未选项、全删声明缺依赖分列；具名声明 skip 不是测试通过。正常树新增 skip 或任何 unhandled 必须解释并裁定，不能以进程 exit0 掩盖。未经批准的产品失败不得“移到skip”。
5. **两轮上限**：R1 审查→一批必要修复→原失败复验及直接影响回归；仍有问题才 R2。每次冻结新候选并同步全删副本的相应剩余源文件，复验受影响静态/类型/构建/测试/组合/输入/性能/UI。改生成、RNG、持久协议或影响范围不清时，重新评估影响闭包，复验失效证据与组合/全删相关项；不得默认恢复三套冗余全量门禁；纯文档不重复重测生产。R2 后剩余问题单列给维护者，不自动 R3、不无限循环；末次修复只经作者复验的明确标记，不能称独立关闭。
6. **通过措辞**：首轮 exit1 永久保留。所有失败有充分证据关闭时可由维护者接受“完整首轮失败、定向复核关闭”；不得称“一次完整全绿”。推荐先完成已有完整执行和有因果的复核，不为漂亮数字反复跑全套。若维护者要求一次新完整全绿，另用新日志目录按 §2 全命令重跑。
7. **阻断**：未关闭的同版本确定性、丢物/重复发放、非法输入保活局、预算硬错误、核心 UI 无法操作均阻断发布。非阻断差异需具名决定、理由、影响范围与下一任务；“最多两轮”不等于剩余缺陷自动豁免。

## 5 Z4：统一浏览器与真实功能清单

**以下所有浏览器格均需维护者执行（可由维护者指定验收会话），实施者负责可复现路径、当前输入和构建。** 来源：[B2 最终十项](phase6b2.report.md)、[B3 九项](phase6b3.browser-checklist.md)、[B4 D7](phase6b4.manual-checklist.md)、[C1](phase6c1.report.md)、[C2](phase6c2.report.md)、[C3 §9](phase6c3.report.md#9-浏览器三档清单待维护者逐项执行)、[C4 三档](phase6c4.report.md)。不因已合入关闭待验，不把SSR/SFC/引擎smoke写成浏览器通过。

先在 §2 的真实生产构建启动；若最终选 Pages 基础路径构建，改用 §9 的 URL，记录不同 dist 身份，不能混用。

```bash
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

普通构建 URL 为 `http://127.0.0.1:4173/`。每格记：通过/失败/未执行+原因、日期/执行人、候选/source/dist hash、URL、浏览器版本、CSS viewport/DPR、seed、模式、预设/模块、操作序列、实际结果及仓外截图/控制台。320 不以390代替。当前全部 **待维护者执行**，表中“待”不表示可省略。

| ID / 来源 | 操作与通过条件（三档均检查） | 320×568 | 800×900 | 1440×900 |
| --- | --- | --- | --- | --- |
| U01 B2/B3/B4/C1 创建 | scarce/standard/bountiful；键盘/触屏选预设，创建后一致且不可改。先关growth再开loot自动推荐；再显式关growth、切换/返回仍保留选择，恢复推荐有效，关loot不强关growth。取消/失败重试/忙态/重开正常，无重复create | 待 | 待 | 待 |
| U02 B2 入口/知识 | 背包→详情→比较→返回；装备、可见地面、可达箱子；未知戒指、部分已知稀有/唯一、长铭文、空列表、记忆/幻觉。只投影可知信息，无gallery/fixture生产入口，稀有色可辨（浅色只局部抽样） | 待 | 待 | 待 |
| U03 B2/B3/B4 四槽 | 武/甲/左右戒实际替换、卸下、双空/单空/双满及native↔loot比较；大型目标条件行、无强度作用提示正确；未知下游不泄露，角色来源与详情一致，卸装/否定无残留 | 待 | 待 | 待 |
| U04 B2/C1 过滤 | 五档过滤草稿经历轮询仍可编辑，取消/默认/应用正确；成功只记一次0tick命令，自动拾取受影响，手动拾取可越过；保存/回放保持 | 待 | 待 | 待 |
| U05 B2 分解/鉴定 | 单件及1–26件批量、费用/产量区间、唯一No/Yes；装备/粘装禁用、满包/CAS陈旧失败零部分扣费且错误不被刷新清掉。十碎片/100tick鉴定；缺片/全已知拒绝；否定后未知种类戒指/仅符文未知仍可鉴定，余额及知识同步 | 待 | 待 | 待 |
| U06 B2/B3 首次触发/成长 | 非符文真实触发只揭示匹配装备行；sage/adept装备提交揭示，scholar真实正XP揭示，备用不揭示。实际升级、加点草稿增减/取消/确认/不足/陈旧反馈；连点一次提交，预览与确认一致 | 待 | 待 | 待 |
| U07 B3 来源/内容 | 等级、永久投入、身份/初始来源、已知装备及cap可读；敏捷概率不混称命中值。原4职业/4血统/4信仰可创建，无测试职业/空树按钮。最小外部贡献仅引用受控证据，不冒充正式职业内容 | 待 | 待 | 待 |
| U08 B4 强化/精炼 | 武/甲/戒各一卷轴；前后等级/双戒槽/属性/比较一致，非loot原生行为保持。上限前→上限→精炼→全满拒绝；未知/部分已知/唯一/腐化文案正确，负面保留，解咒不混淆知识；取消/无目标/CAS失败不提前耗卷轴/回合/growth收据 | 待 | 待 | 待 |
| U09 B4 原生符文 | 固定及随机武/甲符文触发前后，仅匹配行揭示；slaying/immunity目标在允许时才可见，不匹配/失败/无收益不误揭示。与后续插槽符文明确区分 | 待 | 待 | 待 |
| U10 C1 套装 | 两套×四件，未知→单行已知→完整鉴定；1/2/3/4件累计阈值、换下/恢复、混套；同件双戒不重计、不同件计两件，库存/地面/箱内不计。比较含整组阈值损益，未知成员不透露奖励；升HP/focus上限不补、降限钳制；+4上限，分解不退收据 | 待 | 待 | 待 |
| U11 C2 符文/词 | 自然符文获取、拾取、99堆叠/拆堆、0/1/4孔、顺序追加；余烬/锋芒、反序/错类/四孔前缀、匹配/不匹配，整词替换单符文不双加。No/Yes、100tick/一枚、满孔/强化/装备中禁用；主动符文已知而底材秘密保留，否定后来源效果按合同保持 | 待 | 待 | 待 |
| U12 C1/C2 损失确认 | 套装、镶嵌物、符文之语分解分别警告损失；取消/重复输入/CAS陈旧无损，确认消耗恰一次；分解不返符文，套装不返获得资格 | 待 | 待 | 待 |
| U13 C3 工位 | 真实建锻炉→接单No/Yes→劳动锁定→中断退款→再接单完成；末枚/全部拆卸返符文、词退normal且保留底材ID；重铸稳定rowId选行/取消/重选，10碎片/100tick及可能变差提示，保留其它/负面/固定行 | 待 | 待 | 待 |
| U14 C3 软联动/容器 | 无工位/非工作位/缺料/满输出有解释；仅loot无工位操作；仅crafting两配方+0已知且不抽loot骰；双开craft至多magic；无settlement背包操作可用。箱内筛选只读→原取回→再改造，不绕过所有权；多批制造/取消仅退未完成投入，已耗时不退、无重发 | 待 | 待 | 待 |
| U15 C4 来源 | 两种body真实直接击破→拾取→未知详情→鉴定；只在已知时显示“部位破坏”，幻觉/记忆无秘密。part/kill/encounter各自幂等，跨层/存读/seek不重发；无giants无死按钮；site无产出/空入口，不能把延期协议当玩法 | 待 | 待 | 待 |
| U16 全部 只读/输入 | 展开/比较/排序/过滤预览/滚动/切页不耗时、不获XP/回复/鉴定；方向/背包字母/i/d/a/j/./x不穿地图，Tab/Enter/Space有效，Esc逐层返回。触屏滚动/长按/双击恰一次提交；ACK/确认/动画忙/营地面板互斥，关闭恢复输入 | 待 | 待 | 待 |
| U17 全部 生命周期 | 从实际UI创建并操作→当前save/load→完整replay→seek→续录，过滤/装备/知识/材料/工单/收据一致、0 OOS。load/seek/死亡/换局清目标/草稿/监听/回调，回放只读，控制台无新错误/未处理拒绝 | 待 | 待 | 待 |
| U18 全部 布局 | 320无横溢、长词缀/件名/序列换行、双戒纵排、末行/成本/确认/取消/返回可达且触控≥44×44；800列表/详情各自滚动、侧栏/工位不遮动作，旋转/缩放/容器切换不误投旧ID；1440键鼠均完成、条件/来源可读，另查1024×768创建/加载入口 | 待 | 待 | 待 |

复现种子只能作导航：B2/B3 seed26；C1 seed110/bountiful/loot单开、D4自然套装；C2 seed26/bountiful/wizard，旧报告D1白装(73,12)、D4符文；C3 seed51020001/easy/standard，loot+crafting，箱子加settlement；C4 seed3/wizard/loot+giants、D5铜触须自然链。**必须在最终规则重新验证路线**；旧版本存档直接拒绝，不编辑头部。四件齐套/特定词/四孔/满包等可用合法当前受控场景，明确标注受控，不能替代至少一条真实获取链。C2旧清单的“无拆卸按钮”仅是当时停点；最终版本改为无工位/缺crafting不显示，有合法C3工位则显示。

通过条件：全部格有实际结果；核心闭环无阻断，所有未执行/失败给维护者裁定。三档浏览器模拟尺寸不等于手机真机性能；真机/失焦/移动端压力未测单列，不自动扩成平台矩阵。

## 6 Z4：既有性能证据与有界补充（不新跑性能）

核对冻结 manifest、来源说明、route/source、接受状态与报告；云端 run 分别为 6B4 `38860207834`、6C1 `38920592958`、6C2 `38960940396`、6C3 `38996836519`、6C4 `39006896716`。只读查询已有 run，**不 dispatch、不再生成/回放 A/B、不跑 final-budget 或各步 profile**。C2 既有前缀回归按维护者原接受结论保留，核对其独立冻结预算来源，不扩展特批。B4 无第四次独立回放的限制保持。

C3/C4 尚无结果或本机无法取得时标“待维护者补录”，不阻塞其余收口；未采用的预算仍 accepted:false，不能修改标志伪造通过。制品7天到期前由维护者持久归档，仓外临时目录不是长期唯一副本。

Z-D5 只补受控合法 **0/1/4孔、匹配/不匹配**，每场景100次只读，报告事务/随机流/allocator/完整对象图不变及有限体积、属性贡献计数；不是新增性能基准，不用毫秒数裁定。其余负载沿用各步已冻结合同/证据，真实手机、D22+、最大居民/结构等列延期，不增测。

## 7 Z5：文档、合同与身份收口

下列为本次6Z执行的文档清单。只更正现行说明；冻结C0和历史审查报告保持原身份，必要追加后续差量链接。

| 文件/合同 | 必须补齐或核对 |
| --- | --- |
| 新建 `docs/ext/loot-config.md` | 完整配置/schema与目录位置：bases/affixes/tiers/uniques/sets/runes/runewords/sockets/dropTables/runeDrops/ilvl/salvage/stationOperations/预设等；scarce/standard/bountiful，默认关闭/standard及loot推荐growth但可单开；四槽、鉴定/过滤/分解/强化/精炼/镶嵌/工位/craft/part全操作和成本；来源资格/收据、知识、软依赖/fallback、能力指纹、配置扩展方法、硬预算及性能限制。以实际schema为准，不照抄设计示例 |
| `loot-core-contract.md`、`loot-ui-contract.md` | 去除现行0.3.0、随机符文未开放、C功能仍预留等过期描述；来源/只读DTO/命令/CAS/未知/四槽/失败回滚与最终UI一致；已实现原生随机符文、插槽符文分清 |
| `phase6a-contract.md`（C6）、`phase6b3-contract.md`、`phase6b4-contract.md`、`phase6c0-contract.md` | 用明确后续差量映射已冻结合同到当前版本，不修改冻结数值；补itemSdk4、body目录/part事实/可信资格、WorldWork托管与roll、完整写集/预算/严格拒旧的现行入口 |
| `growth-config.md`、`stats-config.md`、扩展 `architecture.md` | 真实属性键、L2贡献/cap、已知比较、容量升不补降钳制、知识/机械失效；职业/树目录框架与未实现内容边界；可选能力fallback不私引包 |
| `crafting-config.md`、WorldWork/C5现行合同（`phase5a2.task.md`、`phase5a2.report.md`等引用入口）、`settlement-config.md` | 锻炉建造、两配方、lootRoll≤magic、plain +0已知分支；worldSdk2/schema6，原生装备escrow单所有权、预留、取消/跨层/死亡/provider异常退款、rowId/CAS，箱内只读与原取回。历史C5报告加后继入口，不改历史通过数 |
| item/world/edible/stats及其余冻结SDK清单 | 逐入口hash、真实差量和版本、类型见证；item4/world2/edible保持，不能沿用“九冻结全不变”掩盖实际变更；列调用方及存读/回放身份 |
| i18n、U03、测试登记 | `docs/i18n.md`及locale键无硬编码/孤立按钮；`scripts/u03-state-contract.json`与实际Game字段对应（C3/C4报告称无新增Game字段，核实后写无差量）；套件发现/测试依赖、模块所有权和读源码守卫登记无漏项，不为文档整齐改守卫 |
| `docs/HANDOFF.md`、`docs/ext/README.md`、`commander-status.md`、文档索引/发布说明 | 顶部更新到最终候选，区分实现、限定门禁、完整门禁、浏览器、性能、延期和发布；旧8模块前的128/15行只保历史，现行描述使用发现器；链接本任务及最终6Z报告 |
| `docs/release.md` 与实际 `.github/workflows/pages.yml` | ext流程写明由 `ext/foundation` push触发、Node24、base `/BrogueJS/`；现文档中main/Node22属于旧经典流程，明确区分。此次无tag、无Release、无package大版本升级 |

最终版本核对起点：foundation20 / itemSdk4 / worldSdk2 / world schema6 / edibleSdk1；loot module/rules0.9.0、pack0.6.0、包schema5、实例6/state2、dropTables schema2；crafting1.1.0/definitions schema2、growth1.10.0；whole-run7/recording4/origin2。从实现及真实导出再次核对，若后续修复改变身份则逐项登记原因，不照表强填。旧版本拒绝、不迁移；**同版本**完整存读/replay/seek/续录及非法输入保活局必须通过。

## 8 Z6：遗留/延期与维护者决定

每项遗留登记责任人、前置、下一任务、验收方法、是否阻断。以下既定范围不重新讨论为6Z隐性功能任务：

| 遗留 | 当前归属与后续条件 |
| --- | --- |
| M4怪物侧平衡、14项统计标记、TTK/EHP/曲线 | 整体延期，保留M1–M3；[B2报告](phase6b2.report.md)与[历史数据](evidence/phase6b2-m4.json)只作样本。后续另冻结正常搜刮/装配/力量/深度与无loot对照、测量预算及目标；6Z不调掉率、曲线/cap或宣称数值平衡通过 |
| site来源 | C4已核查无真实可达产出入口，只有协议及拒绝边界；siteIlvl=1无深度语义保留，玩法接线待世界/地点来源任务。推荐接受为phase6范围延期，不补地图或空provider |
| 唯一品扩编/T7 | 当前8唯一保留；扩到16另立内容任务，T7关闭，不以框架可扩展冒称内容完成 |
| 职业/流派/树内容 | B3通用贡献与现有4职业/4血统/4信仰保留；新职业/流派通过公开键/标签/目录后续立项，不增职业专用宿主分支 |
| 未测负载/平台 | D22+、手机真机性能、最大居民/结构/长局压力、真实失焦等逐项注明未测；浏览器尺寸复核不覆盖这些，扩测需另定场景/预算 |
| 已接受性能限制 | B4无第四次独立回放、C2已知前缀回归及本地复核范围；C3/C4新限制只按实际结果登记，不预先豁免 |
| 历史未关闭事项 | 对照 commander/5Z遗留，仅搬运仍相关且未被后续覆盖的事项，注明历史来源；不把整份phase5积压自动扩为本次工作，也不静默删除 |

下列 Z-D1…Z-D7 维护者已全部采用推荐（2026-10-17），不再重复询问；其中性能按本次精简裁定执行，发布仍未授权：

| 编号 | 待决定问题 | 推荐及停点 |
| --- | --- | --- |
| Z-D1 | C3/C4在途run id、artifact归档与最终性能裁决 | 提供实际run/attempt及control/A/B SHA；先采纳C3再完成C4正式freeze/独立复核。未齐全允许准备文档，不称收口/可发布 |
| Z-D2 | site协议与玩法延期是否作为本阶段正式范围结论 | 接受C4“无入口，玩法延期至世界前置”并在最终报告/发布说明注明；不扩世界功能 |
| Z-D3 | 首次完整失败经原门限复核关闭后是否要求再次完整全绿 | 推荐保留首次及复核、按因果充分关闭；生产广泛改变/影响不清必须重跑完整。仍有失败不能以此选项豁免 |
| Z-D4 | 三档浏览器执行人/时段及稀有场景 | 沿C-D7由维护者执行U01–U18，实施者提供当前版自然/受控输入；未执行保持待验。推荐核心功能/知识/输入问题关闭后再发布，非阻断视觉遗留单独签认 |
| Z-D5 | C2补充孔/匹配性能场景及未测平台 | 推荐补有界0/1/4孔与100次只读计数/体积见证；真实手机/D22+/最大居民等后置。不以旧套装profile声称C2专场已完成 |
| Z-D6 | 两轮后剩余非阻断项、外部证据存放点 | 推荐明确接受范围/责任人/下一任务，证据在7天到期前持久归档；正确性硬阻断不延期为通过 |
| Z-D7 | 最终合入及Pages授权、目标是否有新提交 | 推荐只合 `ext/foundation`、沿现有Pages、无tag/Release；审核具体候选和目标差异后一次授权。目标并行变化则验实际合并树；不顺带合main |

## 9 Z7：授权后的合入 ext/foundation 与 Pages

本节是待执行发布步骤；**当前无提交、推送、合并、部署授权**。先把全部结果和拟发布内容准备到可审阅状态：`phase6z.report.md`、版本/源码/dist/SDK/配置/性能身份清单、小型证据索引、统一浏览器逐格结果、遗留/例外、发布说明、候选与远端foundation差异。本次创建报告/清单/草稿，停在提交发布之前。

1. 审阅通过并明确授权提交/推送后，用确切路径暂存6Z实际交付文件，先检查暂存差异；不 `git add -A`，不自动升package版本。提交后绑定完整候选SHA。若云端性能需要先推修复候选，须单独取得该候选发布到phase6的授权，不能借最终发布条款提前推送。

   ```bash
   git diff --check
   # 将下方占位替换为本次报告列出的逐个实际文件，禁止直接照抄占位。
   git add -- <逐个已审阅文件路径>
   git diff --cached --stat
   git diff --cached --check
   git commit -m "docs(6Z): close phase6 integration and record acceptance"
   git rev-parse HEAD
   ```

   若含获批生产修复，commit信息按实际范围改写，不伪装纯文档。测试结果已确认后才单独执行 `git push origin ext/phase6`。

2. 更新远端视图并准备隔离集成树，核对目标变化：

   ```bash
   git fetch origin
   export P6Z_RELEASE_SHA="$(git rev-parse ext/phase6)"
   git log --left-right --oneline origin/ext/foundation..."$P6Z_RELEASE_SHA"
   git diff --stat origin/ext/foundation..."$P6Z_RELEASE_SHA"
   export P6Z_INTEGRATION="$(mktemp -d /private/tmp/phase6z-integration-XXXXXX)"
   git worktree add --detach "$P6Z_INTEGRATION" origin/ext/foundation
   cd "$P6Z_INTEGRATION"
   git merge --ff-only "$P6Z_RELEASE_SHA"
   ```

   可快进且实际生产/工具/依赖输入与已验候选相同，可引用原证据并核对hash；不能仅凭“纯文档”口头判断。快进失败时停止这条命令链，在该隔离树审阅三方合并，解决冲突后检查冲突标记/JSON；对实际合并候选按本任务Z1–Z4补验受影响范围，广泛变化重跑完整。禁止force、整文件覆盖或把未验merge直接推远端。

3. 在集成树按Node24/3072MiB、串行准备Pages实际构建（测试与push分开）：

   ```bash
   npm ci
   npm run build -- --base /BrogueJS/
   npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
   ```

   维护者抽查 `http://127.0.0.1:4173/BrogueJS/`：资源加载、创建/保存/回放入口、U清单受base影响部分；记录新dist hash。若原统一U清单已使用同一Pages构建，可直接引用其身份。只有构建/检查通过、候选与授权一致且远端未出现未审变更才继续。

4. **单独推送实际已验集成SHA**，触发现有Pages；无tag、无GitHub Release，无main更新：

   ```bash
   git rev-parse HEAD
   git push origin HEAD:refs/heads/ext/foundation
   gh run list --repo coolking70/BrogueJS --workflow pages.yml --branch ext/foundation --limit 5 --json databaseId,headSha,status,conclusion,url
   ```

   按刚推送的SHA选择实际run id，不能随便取列表首行：`gh run view <实际Pages_run_id> --repo coolking70/BrogueJS`。核对deploy成功、environment URL和部署SHA；维护者访问实际Pages，验证基础资源/新局/核心入口/存录链。正式报告补集成SHA、Pages run id/URL/结果；本地dist与云端dist受环境影响时分别记录，不强称字节一致。

5. push被拒说明远端前进，重新核对合并/门禁，不force。Pages失败保留日志及候选，标“合入完成、部署失败”，不冒称发布成功；若需回滚，由维护者授权回滚具体提交/部署，不重写历史。任何最终报告未关闭的阻断阻止发布步骤继续。

最终交付明确区分：功能已提交、完整首轮/复核结果、动态组合、全删及真实缺包、三档浏览器、性能自动判定/维护者例外、延期范围、是否已获发布授权、实际部署状态。只有实际执行过的项目填通过。
