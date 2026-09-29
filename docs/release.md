# 版本与发布

## 1. 版本号

- `package.json` 的 `version` 与 git tag 一致（`v0.2.0` 等）。
- 版本说明写在 `RELEASE_NOTES.md`（新版本放最上面，旧版本保留在下面）。
- 小版本：一批可感知的对齐/修复完成；补丁版本：单独的 bug 修复。

## 2. 发布步骤

1. 主分支上完整门禁（全量兜底）：

```bash
npm ci
npm run ce:fetch
npx vue-tsc -b && npm run build
npm run test:full
npm run test:drift
```

2. 更新 `RELEASE_NOTES.md` 与 `package.json` / `package-lock.json` 的版本号，提交。
3. 打标签并推送：`git tag -a vX.Y.Z -m "…"`，`git push origin main vX.Y.Z`。
4. 在 GitHub 创建 Release（`gh release create vX.Y.Z --notes-file <说明>`），正文取 `RELEASE_NOTES.md` 当前版本一节。

## 3. 试玩构建

构建为静态站点，任意静态托管都可以：

```bash
npx vite build --base ./ --outDir <输出目录>
```

`--base ./` 让资源用相对路径，便于放在子目录或 Artifact 中。

之前的公开试玩以 Claude Artifact 形式发布（https://claude.ai/artifact/SeidsFwF48F7J4BGf59bHb ，由所有者账号管理，设为"任何有链接的人"可访问）。更新方式是把上面的构建产物重新发布到同一个 Artifact；也可以改用 GitHub Pages 等托管（旧仓库 BrogueCE-chs 的 GitHub Pages 上是更早的 C/WASM 版本，与本项目无关）。

## 4. 许可

AGPL-3.0（沿用 Brogue CE）。发布构建时保留 `LICENSE`；对外提供网络服务时须按 AGPL 提供对应源码（本仓库即是）。
