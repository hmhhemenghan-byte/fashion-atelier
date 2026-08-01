# Phase 15 — Seasonal Coverage Book

Seasonal Coverage Book 将第 14 阶段已经核验的 Placement、借出单与具体 Look 组织为可以筛选、打印和交付的品牌成果册。它是原始事实的只读视图，不建立第二套成果台账，也不把媒体曝光自动解释为销售、收入或第三方专有价值。

## 产品目标

- 让设计师按季度、年度、系列、市场或渠道快速生成一致的成果叙事。
- 让媒体、投资人、合作方或内部团队看到成果的上下文与原始证据，而不只是一组脱离来源的数字。
- 在交付前暴露资料缺口，避免把缺少日期、证据、发布方或 Look 关系的记录排进正式报告。
- 让报告可作为 A4 PDF、CSV 数据表或 JSON 快照带走，同时继续保留设计师身份保护。

## 数据来源与派生原则

覆盖册只读取现有事实：

| 来源 | 用途 |
| --- | --- |
| `sample_placements` | 成果状态、类型、渠道、发布方、人物、市场、日期、证据与填报指标 |
| `sample_placement_items` | 实际出现的 Look、样衣资产、作品快照与 Credit |
| `sample_loans` | 真实送出状态、送出时间与成果关联分母 |
| `sample_loan_items` | 借出单中涉及的作品与系列范围 |
| `works` | 将稳定 `work_id` 映射为 Collection；缺少 ID 时以作品名和 Look 编号快照回退 |

报告不会写入新的汇总表。修改 Placement、借出单或作品关系后，下一次请求会重新计算结果，因此不存在“报表数据”和“业务事实”逐渐不一致的问题。

## 报告范围

### 时间

- 最近 90 天：从当天向前包含 90 个 UTC 日历日。
- 最近一年：从当天向前包含 365 个 UTC 日历日。
- 全部历史：包含所有有效日期以及缺少日期的合格成果；未来日期仍不纳入。
- 自定义：可提供起始日、结束日或两者；结束日按完整日包含。若起止日期反向输入，系统自动交换。

最近 90 天、最近一年和自定义范围不会纳入缺少成果日期的记录，但这类记录仍会在“全部历史”的交付检查中出现。

### 维度

- Collection
- 渠道
- 成果类型
- 市场
- 状态：已落地、已发布或两者

Filter Options 来自全部合格成果，而不是当前筛选后的子集，因此切换维度时不会因为上一个筛选而丢失可选项。

## 核心指标

| 指标 | 计算方式 |
| --- | --- |
| Qualified Placements | 当前范围内状态为 `placed` 或 `published`，并通过筛选的成果数 |
| Published | 当前结果中状态为 `published` 的成果数 |
| Sent Loans | 同时间范围、同系列范围内，已经进入寄出至关闭阶段的唯一借出单 |
| Covered Loans | 当前成果关联且同时属于 Sent Loans 的唯一借出单 |
| Send-out Coverage | Covered Loans ÷ Sent Loans |
| Evidence Coverage | 带来源 URL 或证据图片的成果 ÷ Qualified Placements |
| Look Appearances | 所有成果关联的 Placement Item 行数 |
| Unique Looks | 按 `work_id` 去重；缺少 ID 时按作品名和 Look 编号快照去重 |
| Verified Metrics | 当前成果中 `metric_mode = verified` 的记录数 |
| Reported Reach | 当前成果原始填报 Reach 的求和 |
| Reported Engagements | 当前成果原始填报 Engagements 的求和 |
| Reported Impact | 按 ISO 币种分别汇总最小货币单位 |

渠道、类型、市场或成果状态属于成果结果维度，不会改变 Sent Loans 分母；Collection 会同时限制成果与送出单，确保系列覆盖率具有一致分母。

## 指标边界

- Reach、Engagements 和 Impact 都明确标记为 Reported，不表示平台独立测量。
- `reported` 记录保留在汇总中，同时进入“填报指标未核验”质量队列。
- `verified` 表示设计师核对了来源链，不表示平台审计了第三方测量方法。
- 不同币种按币种代码分别呈现，不换算、不求总计。
- 系统不计算、命名或冒充 Launchmetrics MIV，也不从社交关注数、媒体层级或刊登面积推断价值。
- Send-out Coverage 反映借样转化为记录成果的比例，不等于销售转化率。

## 月度趋势与结构

月度趋势按成果日期的自然月生成：

- Placements：当月全部已落地与已发布成果。
- Published：其中已经公开发布的子集。

结构页分别计算媒体 / 发布方、Voice、渠道、成果类型、市场和 Collection。单条成果可能连接多个系列，因此 Collection Breakdown 的计数可能高于成果总数；其 Share 仍以成果数为基准，用来表达系列在成果中的出现强度，而不是互斥构成。

## Editorial QA

每条成果会检查以下问题：

| 问题 | 条件 |
| --- | --- |
| 缺少证据 | 来源 URL 与证据图片均为空 |
| 缺少日期 | `placement_date` 为空 |
| 缺少媒体 / 发布方 | `outlet_name` 为空 |
| 未关联 Look | 没有 Placement Item |
| 未关联借出单 | `loan_id` 为空 |
| 填报指标未核验 | 至少填写一项外部指标且 `metric_mode != verified` |

QA 是交付完整度提示，不会自动修改、隐藏或删除业务记录。设计师回到 Placement & Impact 补全信息后，覆盖册会即时更新。

## API、导出与打印

- `GET /api/studio/coverage-book`：返回当前筛选的完整报告。
- `GET /api/studio/coverage-book?format=csv`：导出一行一成果的 UTF-8 CSV。
- `GET /api/studio/coverage-book?format=json`：下载带筛选范围、指标、结构、QA 和成果 Story 的 JSON 快照。
- `GET /studio/coverage-book/print`：打开独立 A4 编辑版；浏览器可直接打印或保存为 PDF。

所有路由都要求 ChatGPT 登录并通过 `ADMIN_EMAILS` 白名单。响应使用 `private, no-store`，证据图片继续通过受保护的统一媒体路由读取。打印页没有公开分享令牌，不会绕过当前站点的 owner-only 策略。

## 迁移与可携带性

Seasonal Coverage Book 没有新增 D1 表或 R2 对象，因此 `nera-archive/7` 已经包含重建报告所需的全部事实。迁移时：

1. 导出 Archive JSON 与媒体清单。
2. 保持 Placement、Placement Item、Loan、Loan Item 和 Work 的稳定 ID。
3. 复制 Placement 与 Work 图片对象并保留对象键映射。
4. 在目标运行时替换 D1 与 R2 适配器。
5. 用迁移后的事实重新计算覆盖册，不需要搬运缓存或聚合结果。

前端 React 组件、报告计算函数、CSV / JSON 导出和打印模板均位于源码仓库，可推送到 GitHub。继续使用 Cloudflare Workers、D1 和 R2 是迁移成本最低的路径；迁往 Vercel 时可保留业务层，但需要将 D1 替换为 PostgreSQL / Supabase 等数据库，并把 R2 绑定替换为目标对象存储适配器。
