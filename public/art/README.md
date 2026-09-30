# UI 标题美术与字体来源

这三幅标题背景为 2026-09-30 的 BrogueJS UI 方案新生成的游戏美术资源，
使用 OpenAI 内置图像生成工具，未以第三方图片作为编辑输入。
完整生成提示词保存在 [provenance.json](provenance.json)。它们是运行所需的
成品美术资源，不是验收截图或原始测试证据。

这些新美术随本项目按仓库根目录 [AGPL-3.0](../../LICENSE) 分发（在适用权利范围内）。
AI 生成这一来源说明不构成对独占性或可登记版权的保证。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `obsidian-reliquary.png` | 2,056,951 | `fdd6a464fe841bbb768ce12ce493ef5d37e713ce9f22c0802be7748c3f5a0737` |
| `the-cartographer.png` | 3,171,635 | `c5f94949a9a0dc114f261f014b592113a7cda5dd1c9836261a4859e7081d1945` |
| `verdant-abyss.png` | 2,575,561 | `e0211771110753200bc880d5fe56f32af7d27c874a020203c6e768af95b70475` |

## 字体

`../fonts/brogue-hanzi.woff` 是 Noto Sans CJK SC Regular 的地图用字子集，
字体来源项目为 https://github.com/notofonts/noto-cjk 。原版权及 SIL Open Font
License 1.1 全文随附于 `../fonts/NOTO-LICENSE.txt`；字体继续遵守 OFL，
不将其重新许可为 AGPL。WOFF 文件内部保留原字体家族与来源元数据。

## 矢量图标

`src/ui/vectorAtlas.ts` 与 `src/ui/vectorIconSvg.ts` 定义地图和图例的几何图标。
它们是本次 UI 实现的源码绘图，使用本仓库许可证；没有额外的位图图集或线上素材依赖。
