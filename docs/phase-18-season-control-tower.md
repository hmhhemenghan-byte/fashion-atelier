# Phase 18 — Season Control Tower / 季度作战台

## 目标

前 17 个阶段已经覆盖从创作、发布、展厅、样衣、关系到外联的完整链路，但信息分布在不同工作台。第 18 阶段不增加新的业务对象，而是在 Studio 的第一屏建立一个设计师导向的运营首页：

- 先回答“本季现在处于什么状态”；
- 再指出“哪些事实已经阻塞关键路径”；
- 最后把人带回正确的工作台完成判断与操作。

这不是销售仪表盘，也不是自动化决策引擎。系统不预测人物价值、不替设计师决定是否发布或联系，也不会自动外发。

## 设计依据

当前时装 PLM、样衣与展厅工具的共同方向，是把产品资料、关键路径、样衣流转、活动与媒体成果放进统一、实时、可追溯的运营视图。第 18 阶段吸收了这种“单一事实入口 + 关键路径”的结构，但保持 NÉRA 的编辑视觉与小团队工作方式：

- [WFX Fashion PLM](https://www.worldfashionexchange.com/en-us/fashion-plm-software.html)：集中产品资料、时间线与工作流；
- [Launchmetrics Samples & Showroom Management](https://www.launchmetrics.com/resources/category/samples-showroom-management)：连接样衣、展厅、活动和媒体成果；
- [Centric Software — Eileen Fisher](https://www.centricsoftware.com/success-stories/eileen-fisher)：以共享产品事实和可见流程支持跨团队协作。

这些资料只用于信息架构参考。NÉRA 不复制第三方专有评分，也不会把人工填报的触达或影响值包装成第三方指标。

## 页面结构

### 1. 季度总览

顶部以四个实时指标建立上下文：

1. Editorial Operations 准备度；
2. 当前行动议程数量；
3. 进行中的样衣借调与开放展厅；
4. 等待人工批准的外联对象与开放关系机会。

Phase 25 接入后，“`X / 15`”代表十五项明确关卡中已经通过的数量，不是综合商业评分。

### 2. 当前系列脉搏

系统优先选择最近一个尚未完成的 Launch / Press 节点所关联系列；没有未来发布节点时，使用系列系统中排序最前的系列。设计师可以手动切换。

每个系列显示五项等权事实检查：

| 检查 | 通过条件 |
| --- | --- |
| 系列公开 | Collection 状态为 `published` |
| Look 已编排 | 系列至少关联一个 Work |
| Look 已公开 | 系列中所有已编排 Work 均为 `published` |
| 发布包已建立 | 系列存在 Publication |
| 发布已安排 | Publication 为 `scheduled` 或 `published` |

系列准备度为通过项数量除以 5。它只说明资料状态，不评价设计质量、商业潜力或媒体价值。

### 3. 十五项事实关卡

| 关卡 | 清晰条件 | 返回位置 |
| --- | --- | --- |
| 编辑准备度 | Editorial QA 分数至少 85 | Editorial Operations |
| 关键内容缺口 | 没有 `critical` 内容问题 | Editorial Operations |
| 设计评审 | 没有逾期评审、逾期或关键修改任务，以及等待复审的开放结论 | Atelier Review Board |
| 材料批准 | 所有已选定或已批准的 Look 用料都来自已批准材料 | Material Room |
| 技术包批准 | 所有已公开 Look 均有已批准或已锁定的最新技术包，且没有开放的关键工艺风险 | Technical Atelier |
| 试身审版 | 已公开 Look 的最新批准技术包拥有已批准或封存的最新试身，且没有开放的关键版型问题 | Fitting Room |
| 最终封样 | 已公开 Look 的当前批准修订拥有已批准或封存的最终样衣，且没有失败的关键核对 | Final Sample Gate |
| 生产放行 | 已公开 Look 的当前封样拥有已生成标识的生产放行包，且没有阻塞的准备核对 | Production Release Desk |
| 生产偏差闭环 | 没有未关闭的高风险生产偏差或逾期复核 | Production Change Control |
| 关键排期 | 没有逾期日历节点 | Editorial Calendar |
| 展厅回应 | 没有 `submitted` / `reviewing` 请求 | Appointment Response |
| 样衣归还 | 没有超过预计归还时间的进行中借调 | Sample Fulfilment |
| 库存盘点 | 没有 `counting` / `review` 盘点 | Inventory & Audit |
| 关系跟进 | 没有已经到期的联系人、机会或互动行动 | Relationship & Opportunity |
| 外联人工审核 | 没有 `proposed` 外联对象 | Campaign & Outreach |

每张关卡卡片都显示具体数量与原因，并直接跳到负责该事实的工作台。

### 4. 统一行动议程

议程会合并：

- Editorial QA 的 critical / warning 问题；
- 已逾期或未来 14 天内的设计评审；
- 未来 7 天内到期、已逾期或 `critical` 的开放修改任务；
- Look 已经选定、但材料档案尚未批准的用料冲突；
- 已公开 Look 缺少已批准技术包，以及仍未确认的关键工艺说明；
- 当前技术包缺少批准试身，以及仍未解决的关键版型问题；
- 已批准试身尚无最终封样，以及封样核对中的失败项；
- 已封存最终样尚无生产放行，以及准备核对中的阻塞项；
- 已授权生产放行后的高风险偏差与逾期复核；
- 已逾期或未来 14 天内的日历节点；
- 待审核的展厅请求；
- 已逾期的样衣归还；
- 未闭环盘点与近期样衣沟通跟进；
- 已到期或未来 7 天内的联系人、机会与互动行动；
- 等待人工批准的外联对象；
- 已生成、等待在外部渠道手动发送的草稿；
- 仍在整理证据或状态的 Placement。

排序顺序为“逾期 → 今日 → 需要判断 → 将到”，最多返回 18 项。按系列筛选时，保留所有全局运营事项，同时只显示该系列关联的评审、日历与外联事项。

### 5. Studio Map

当前 24 个业务工作台按五个组重新组织，但不改变原工作流或数据所有权。第 18 阶段是承载这张索引的只读作战台，因此不在索引中重复显示：

- CREATE：系列、Lookbook、过程档案、Atelier Review Board、Material Room、Technical Atelier、Fitting Room、Final Sample Gate、Production Release Desk、Production Change Control；
- PUBLISH：Publication、编辑运营、日历、Showroom；
- RELATION：请求、样衣履约、沟通、关系、外联；
- OPERATIONS：库存、使用效能、Placement、Coverage；
- ARCHIVE：交接归档。

每个模块显示一个可解释的实时数值和 `clear / active / attention` 状态。点击后通过页面锚点进入原工作台。

## 数据与接口

只读接口：

```text
GET /api/studio/command
```

接口要求设计师管理员身份，并设置 `Cache-Control: private, no-store`。聚合数据来自现有模块：

- Editorial Operations 与 Editorial Calendar；
- Showrooms 与 Showroom Requests；
- Sample Loans、Correspondence、Assets、Audits 与 Placements；
- Relationship Contacts、Opportunities 与 Activities；
- Outreach Campaigns 与 Recipients；
- Design Reviews 与 Revision Actions；
- Materials 与 Look Material Assignments；
- Technical Packs 与 Construction Notes；
- Fitting Sessions、Issues、Sample Signoffs、Signoff Checks、Production Releases、Release Checks 与 Production Exceptions；
- 最新 Archive Snapshot 摘要。

接口只返回总览需要的安全字段。Showroom 的 `accessTokenHash`、联系人邮箱、电话、外联草稿正文、物流地址与追踪号都不会进入响应。

## 更新机制

页面首次打开时即时读取事实。下列 Studio 事件发生后自动刷新：

```text
nera:inventory-updated
nera:placement-updated
nera:request-updated
nera:loan-updated
nera:loan-closed
nera:relationship-updated
nera:outreach-updated
nera:review-updated
nera:material-updated
nera:tech-pack-updated
nera:fitting-updated
nera:sample-signoff-updated
nera:production-release-updated
nera:production-exception-updated
```

设计师也可以使用“刷新事实”按钮主动同步。

## 决策边界

- 作战台没有写接口；
- 不自动发布 Collection、Work 或 Publication；
- 不自动批准 Showroom 请求或 Outreach 对象；
- 不自动发送邮件、消息、邀约或展厅链接；
- `do_not_contact` 仍由第 17 阶段硬性阻断；
- 人工或第三方填报的影响值保持原有来源标记；
- 任何行动完成后，仍回到对应工作台记录真实状态。

## 归档与迁移

第 18 阶段本身仍是现有事实的即时投影，不新增 D1 表，不写入不可逆汇总。Phase 25 接入后：

- 作战台本身仍无数据库迁移；
- 完整归档结构使用 `nera-archive/16`；
- 原始业务工作台数据仍是唯一事实来源；
- 代码可随仓库直接打包或以后推送到 GitHub；
- 切换托管平台时，只需按既有方案迁移 D1、R2 与运行时适配，不需要迁移单独的“作战台数据”。
