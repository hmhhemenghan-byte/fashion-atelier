# Phase 33 — Exhibition Interpretation / 展览释读室

## 目标

把已经批准并冻结的策展选择转化为可审阅、可交付的展览文字体系：入口导语、章节叙事、作品标签、署名、来源、权利状态与无障碍描述分别留痕。

本阶段不自动撰写、翻译、公开或发送内容，也不改写原始作品、养护或策展事实。

## 数据结构

### `interpretation_packages`

每个释读包绑定一个已批准或已关闭的策展项目，并按修订号保存负责人、主语言、可选第二语言、展览标题、入口导语、策展署名、鸣谢、无障碍说明、权利说明和人工批准依据。

状态按 `draft / in_review / approved / closed / void` 推进；人工决定为 `pending / approve / revise / hold`。批准后不可改写，新的文字变化必须建立下一修订。

### `interpretation_sections`

保存章节顺序、主语言标题与正文，以及启用第二语言时的对应标题与正文。

### `interpretation_labels`

建立释读包时，系统按冻结策展中所有 `include` 作品生成标签骨架。每条标签保存：

- 展示顺序和标题；
- 主语言与第二语言正文；
- 作品事实、署名和来源依据；
- 无障碍描述；
- `unchecked / cleared / restricted / not_required` 权利状态。

## 人工批准

批准前必须满足：

- 释读负责人、主语言、展览标题、入口导语、策展署名、无障碍说明、权利说明和批准依据齐全；
- 至少一个完整叙事章节；
- 冻结策展中的每件纳入作品都有完整标签；
- 启用第二语言时，所有章节与标签都有对应文本；
- 每件作品的事实、署名、来源和无障碍描述齐全；
- 每件作品权利状态为 `cleared` 或 `not_required`；
- 设计师明确选择 `approve`。

系统只检查事实是否齐全，不评价文字风格、翻译质量或作品价值。

## 接口与导出

```text
GET   /api/studio/exhibition-interpretation
POST  /api/studio/exhibition-interpretation
PATCH /api/studio/exhibition-interpretation/:id
POST  /api/studio/exhibition-interpretation/sections
PATCH /api/studio/exhibition-interpretation/sections/:id
PATCH /api/studio/exhibition-interpretation/labels/:id
```

全部接口要求设计师管理员身份并拒绝跨源写入。支持释读包、章节、作品标签 CSV 和完整 JSON 导出。

## 控制塔与归档

- Season Control Tower 新增第 23 道“展览释读评审”事实关卡；
- 等待补齐或要求修改的释读修订进入行动议程；
- Studio Map 扩展为 32 个业务工作台；
- 完整交接格式升级为 `nera-archive/24`；
- 新增 D1 迁移 `drizzle/0029_famous_gertrude_yorkes.sql`。

## 边界

- 不自动生成、改写或翻译展览文字；
- 不自动公开、发送、排版印刷或创建外部发布事实；
- 不改写冻结策展选择和原始档案；
- 不扩展为场馆、票务、保险、预算或合同系统；
- 所有文字决定与批准均由设计师明确完成。
