# 版本与发布

## 1. 版本号

- `package.json` 的 `version` 与 git tag 一致（`v0.2.0` 等）。
- 版本说明写在 `RELEASE_NOTES.md`（新版本放最上面，旧版本保留在下面）。
- 小版本：一批可感知的对齐/修复完成；补丁版本：单独的 bug 修复。

## 2. 发布步骤

1. 主分支上完整门禁（全量兜底，含 CE 一致性检查）：

```bash
npm ci
npm run ce:fetch
npx vue-tsc -b && npm run build
npm run test:full
BROGUE_REQUIRE_CE=1 npm run test:gen
npm run test:drift
```

2. 更新 `RELEASE_NOTES.md` 与 `package.json` / `package-lock.json` 的版本号，提交。
3. 打标签并推送：`git tag -a vX.Y.Z -m "…"`，`git push origin main vX.Y.Z`。
4. 在 GitHub 创建 Release（`gh release create vX.Y.Z --notes-file <说明>`），正文取 `RELEASE_NOTES.md` 当前版本一节。

## 3. GitHub Pages 在线试玩

公开试玩地址：<https://coolking70.github.io/BrogueJS/>。

`.github/workflows/pages.yml` 在每次推送 `main` 时自动执行以下流程：Node.js 22 安装依赖、以 `/BrogueJS/` 为资源基础路径构建、上传 `dist/` 并部署 GitHub Pages。也可以在 GitHub Actions 页面手动触发。

本地复现 Pages 构建：

```bash
npm ci
npm run build -- --base /BrogueJS/
```

普通本地开发仍使用 `npm run dev`，不带 `/BrogueJS/` 前缀。

如仓库改名或绑定自定义域名，需要同步修改工作流中的 `--base`：仓库 Pages 使用 `/<仓库名>/`，自定义域名使用 `/`。

历史上的 Claude Artifact 测试构建继续保留，但不再作为当前公开版本的发布入口。旧仓库 BrogueCE-chs 的 GitHub Pages 是更早的 C/WASM 版本，与本项目无关。

## 4. 许可

AGPL-3.0（沿用 Brogue CE）。发布构建时保留 `LICENSE`；对外提供网络服务时须按 AGPL 提供对应源码（本仓库即是）。
