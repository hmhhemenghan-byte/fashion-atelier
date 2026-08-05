# Phase 32 — Archive Curation / 档案策展室

## 目标

把作品的设计、养护、展示和复原历史重新转化为下一轮策展语言。设计师先建立命题，再逐件决定作品之间的关系、叙事角色、顺序和展示意图。

本阶段不是自动推荐系统，也不生成场馆、物流、保险、预算、票务或借展合同。

## 数据结构

### `curatorial_projects`

保存策展编号、标题、负责人、空间场景、目标观众、展期窗口、策展命题、叙事结构、空间编排、选择原则、人工决定和批准事实。

状态按 `draft / in_review / approved / closed / void` 推进；人工决定为 `pending / approve / revise / hold`。批准或关闭后不可改写。

### `curatorial_selections`

同一实物在单个项目中只能出现一次，每条选择独立保存：

- `proposed / include / alternate / hold / exclude` 人工结论；
- `anchor / dialogue / context / transition / finale` 叙事角色；
- 展示顺序、选择依据、展示意图与养护边界备注。

## 透明边界

系统对每件实物聚合：

- 最新已批准养护报告与是否明确 `ready_for_use`；
- 当前实物状态与位置；
- 是否仍处于展期监测；
- 最新展后复原是否已经回库放行。

这些事实只形成警示和批准门槛，不自动把作品加入、排除或排序。

## 人工批准

项目批准前必须满足：

- 策展负责人、空间、观众、命题、叙事、空间编排、选择原则和判断依据齐全；
- 至少两件作品明确纳入；
- 至少一件作品承担叙事锚点；
- 每件纳入作品都有选择依据与展示意图；
- 所有纳入作品的最新养护、实物、在展与复原状态均允许进入下一轮展示；
- 设计师明确选择 `approve`。

批准后项目与所有选择冻结，后续策展变化建立新项目。

## 接口与导出

```text
GET   /api/studio/archive-curation
POST  /api/studio/archive-curation
PATCH /api/studio/archive-curation/:id
POST  /api/studio/archive-curation/selections
PATCH /api/studio/archive-curation/selections/:id
```

所有接口要求设计师管理员身份并拒绝跨源写入。支持项目 CSV、选择 CSV 与完整 JSON 导出。

## 控制塔与归档

- Season Control Tower 新增第 22 道“档案策展评审”事实关卡；
- 实物状态阻塞、缺少依据或等待修改的开放评审进入行动议程；
- Studio Map 扩展为 31 个业务工作台；
- 完整交接格式升级为 `nera-archive/23`；
- 新增 D1 迁移 `drizzle/0028_square_ronan.sql`。

## 边界

- 不自动评价设计质量或商业价值；
- 不自动推荐、纳入、排除或排列作品；
- 不改变实物库存、养护结论或展后复原事实；
- 不生成场馆、运输、保险、合同、预算或票务记录；
- 所有策展决定与批准均由设计师明确完成。
