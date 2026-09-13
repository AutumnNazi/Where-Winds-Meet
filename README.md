# 燕云资料站

《燕云十六声》（Where Winds Meet）非商业游戏资料站：心法、武学、技能、词条、配装。

基于 [Astro 5](https://astro.build) 构建的纯静态站，数据驱动（JSON 数据层 + 构建时 zod 校验），可部署到任意静态托管。

## 快速开始

```bash
npm install
npm run dev       # 本地开发 http://localhost:4321
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
```

## 数据流水线

两个数据来源，均由本仓库自己的脚本转换为本站 schema（不复制任何一方的代码）：

**1. 结构化数值（GPL-3.0）**：开源社区项目 [where-builds-meet](https://github.com/greydust/where-builds-meet) 的整理数据，产出心法效果、武学强化树、技能动作、词条数值、配装。

```bash
# 1. 获取参考数据（浅克隆到临时目录即可）
git clone --depth 1 https://github.com/greydust/where-builds-meet.git /tmp/wwm-ref/where-builds-meet

# 2. 转换导入（默认读 /tmp/wwm-ref/where-builds-meet，可传路径参数）
npm run import:ref
```

**2. 心法中文名录（CC BY-SA）**：[灰机 wiki 流派页](https://yy16s.huijiwiki.com/wiki/流派) 的 60 部心法中文名（11 流派 × 4 部 + 通用三档品质）。直连会被 Cloudflare 拦，脚本失败时自动走本机代理 127.0.0.1:7890。

```bash
npm run import:huiji   # 生成 src/data/innerway-zh-catalog.json
```

**3. 中文效果描述（玩家整理文案）**：[17173 全武器攻略](http://news.17173.com/content/01142025/015407897.shtml) 含 24 部心法的分类/基础增益/获取途径、12 套武学的效果描述（游戏内文案的玩家转述）。原文存档于 `docs/source-17173-wuxue.html`。

```bash
npm run parse:17173    # 生成 innerway-zh-desc.json 与 martial-arts-zh-desc.json
```

中英对照表（`innerway-zh-map.json`、`martial-arts-zh-map.json`）为人工核对结果：先用流派锚定（10 个流派 tag 与灰机分组一一对应），再以专属心法关系 + 武器类型交叉验证；`confidence: high` 为直译/关系链完整，`medium` 待游戏内确认，缺失的不得臆填。

## 目录结构

```
scripts/import-ref-data.mjs   # 数据转换脚本（参考仓库 → src/data）
src/data/                     # 生成的心法/武学/技能/词条/配装数据（勿手改，重导入覆盖）
src/lib/schemas.ts            # zod schema，构建时校验数据结构
src/lib/data.ts               # 数据加载与查询助手
src/lib/format.ts             # 名称回落、数值格式化、效果 DSL 尽力转译
src/pages/                    # 心法 / 武学 / 技能 / 词条 / 配装 五大板块
src/styles/global.css         # 水墨暗色主题
```

## 数据现状与缺口（第一版）

已就绪：心法 T0–T6 分层效果、武学强化树、技能动作数据、调律词条与数值上限、装备词条池、流派配装 19 套。

待补录（页面上以「中文名待补」/ 英文原文标注）：

- 心法本名与武学本名的中文（CSV 无覆盖，需对照游戏内文案录入）
- 调律词条、属性 key 的官方中文对照
- 心法/强化效果为机器转译（如「伤害加成 +10%」），复杂结构折叠显示 JSON 原文，需人工撰写描述
- 技能的中文覆盖约 168 条（卸勢、防禦等），仍有缺漏
- 配装的 8 槽装备词条明细未导入，暂只展示心法与套装搭配

## 版权声明

游戏数据与内容版权归《燕云十六声》官方（Everstone Studio）所有。本站为社区整理的非商业资料站，数据基于 GPL-3.0 开源项目的整理成果。
