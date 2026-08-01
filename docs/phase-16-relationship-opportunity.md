# Phase 16 — Relationship & Opportunity

Relationship & Opportunity 将 Private Showroom 回应、样衣流转与 Placement 成果之后出现的真实人物线索，整理为设计师可掌控的关系记忆与机会推进工作台。它不是自动营销系统，也不以媒体、职位或机构为人物打分；所有建档、优先级、联系边界、机会阶段与下一步都由设计师明确确认。

## 产品目标

- 把散落在专业回应和成果记录中的人物线索变成可追溯、可维护的关系档案。
- 将“认识谁”和“正在推进什么”拆成联系人、机会、互动 / 待办三类持久化事实。
- 在同一界面看清逾期动作、未来七天节奏、缺少下一步的机会和最近互动。
- 保留来源、同意状态与请勿联系边界，避免用自动化便利覆盖专业判断。
- 让全部关系数据可独立导出，也能随 Archive & Handoff 完整交接。

## 数据模型

### `relationship_contacts`

联系人主档保存：

- 稳定联系人编号、姓名、机构、职务、联系人类型。
- 邮箱、电话、城市、市场与偏好渠道。
- 人工关系层级：重点、核心、培育中、低活跃。
- 档案状态：活跃、暂停、归档。
- 联系边界：待确认、已有业务往来、明确同意联系、请勿主动联系。
- 来源类型与来源 ID、标签、内部备注、最近联系和下次跟进时间。

从 Showroom Request 导入时，即使对方同意就具体需求被联系，也只映射为“已有业务往来”，不会被扩大解释为通用营销订阅。

### `relationship_opportunities`

机会通过 `contact_id` 连接联系人，保存机会名称、类型、阶段、优先级、系列、市场、来源、摘要、下一步、下一步时间与结果。阶段为：

1. `signal`
2. `qualified`
3. `ready`
4. `conversation`
5. `sample`
6. `active`
7. `won`
8. `lost`
9. `on_hold`

`won` 与 `lost` 只代表设计师明确记录的业务结果，不由覆盖、触达或互动数字自动推断。

### `relationship_activities`

互动与待办可选择联系人及机会，记录：

- 类型：备注、邮件、电话、会面、引荐、样衣、成果、跟进或其他。
- 渠道：邮件、电话、即时消息、线下或内部。
- 方向：对方发起、我方发起或内部。
- 状态：计划中、已完成或已取消。
- 主题、记录、到期时间、实际发生时间与完成时间。

已完成记录会更新联系人的最近联系时间。它只表示动作已由用户确认完成，不表示系统代为发送。

## 事实候选

候选来源目前包括：

| 来源 | 候选事实 |
| --- | --- |
| Showroom Request | 姓名、机构、邮箱、市场、需求类型与联系许可 |
| Placement | 联系人 / 人物、发布方、市场、成果状态与来源记录 |

工作台会按邮箱或姓名与机构去重，并排除已经建立的联系人。候选不会自动写入数据库；只有点击“纳入关系库”后才创建联系人，且保存原始 `source_type` 与 `source_id`。

## 工作台指标

| 指标 | 含义 |
| --- | --- |
| Active Relationships | 状态为活跃的联系人 |
| Open Opportunities | 未达成、未失败的机会 |
| Next 7 Days | 七天内到期的联系人跟进、机会动作与计划任务 |
| Overdue | 当前时间之前仍未完成的动作 |
| Recent Touchpoints | 最近 30 天已完成的互动 |
| Profile Completeness | 联系资料、机构 / 市场、边界、标签与节奏字段的平均完整度 |
| Opportunity Without Next Action | 开放机会中缺少动作说明或时间的记录 |
| Fact Candidates | 尚未人工建档的事实候选 |

完整度用于提醒资料缺口，不是人物评分，也不会改变排序之外的业务状态。

## 联系边界与自动化限制

- `do_not_contact` 在联系人档案中以显著警示显示，并随导出与归档保留。
- 系统不自动发送邮件、即时消息、日历邀请或任何外部通知。
- 工作台不会抓取私人联系方式，也不会根据社交资料扩充联系人。
- 不根据机构、媒体层级、关注量、Reach 或 Impact 给人物生成隐藏分数。
- 候选导入、联系人层级、机会阶段和任务完成均要求人工操作。
- 所有 API 写操作继续要求设计师管理员身份并拒绝跨站写请求。

## API 与导出

- `GET /api/studio/relationships`：返回完整工作台概览。
- `GET /api/studio/relationships?format=contacts`：联系人 UTF-8 CSV。
- `GET /api/studio/relationships?format=opportunities`：机会 UTF-8 CSV。
- `GET /api/studio/relationships?format=activities`：互动与待办 UTF-8 CSV。
- `GET /api/studio/relationships?format=json`：三类数据及即时概览 JSON。
- `POST /api/studio/relationships`：创建联系人。
- `PATCH /api/studio/relationships/:id`：更新联系人节奏与边界。
- `POST /api/studio/relationships/opportunities`：创建机会。
- `PATCH /api/studio/relationships/opportunities/:id`：更新机会。
- `POST /api/studio/relationships/activities`：创建互动或待办。
- `PATCH /api/studio/relationships/activities/:id`：更新互动或待办。

所有路由均受 ChatGPT 登录与 `ADMIN_EMAILS` 白名单保护。读取响应不缓存，写操作保存创建人或更新人身份。

## 归档与迁移

Archive 格式升级为 `nera-archive/8`，新增：

- `datasets.relationshipContacts`
- `datasets.relationshipOpportunities`
- `datasets.relationshipActivities`
- 三类数据的 inventory 计数、不可变快照计数和版本差异。

迁移时应保持联系人、机会、互动和来源记录的稳定 ID，先导入联系人，再导入机会与互动。联系边界、来源类型、来源 ID 和时间字段必须原样保留。源码包含 Drizzle schema 与 `0013_nifty_boomerang.sql` 迁移文件，可继续部署到 Cloudflare Workers + D1；迁往 Vercel 时可保留 React、API 业务规则和数据结构，但需要将 D1 适配到 PostgreSQL、Supabase 或其他目标数据库。
