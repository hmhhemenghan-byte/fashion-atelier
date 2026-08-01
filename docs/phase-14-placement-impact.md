# Phase 14 — Placement & Impact

Placement & Impact 把 Sample Fulfilment 的样衣寄送继续连接到真实发生的编辑刊登、红毯、艺人造型、创作者内容、影视和现场活动。它是可追溯的成果账本，不是媒体监测平台，也不会自动推断传播价值。

## 数据结构

### `sample_placements`

每行代表一条可独立验证的成果：

- 可选关联 `sample_loans`，保留稳定 `loan_id`。
- 状态区分待确认、已拍摄、已落地、已发布、未采用和已归档。
- 类型区分编辑大片、红毯、艺人造型、创作者内容、影视、活动、买手展示和其他。
- 渠道区分纸媒、线上媒体、社交媒体、广播/影视、现场活动和其他。
- Voice 类型采用媒体、名人、意见领袖、合作方、自有媒体和其他。
- 发布方、Voice、活动、市场、国家/地区、成果日期和证据 URL 均为独立字段，便于筛选、迁移和后续分析。
- 证据图片保存为稳定 R2 对象键、内容类型、字节数和无障碍描述；图片本身不写入 D1。
- 填报触达、互动和影响值均可为空，并保存指标口径、来源、核验人和核验时间。

### `sample_placement_items`

每行代表一件在该成果中出现的 Look 或实物样衣：

- 关联成果、借调项、实物资产和作品的稳定 ID。
- 同时保存资产编号、作品名、Look 编号和图片键快照，避免上游记录删除后失去成果语义。
- 同一成果内同一借调项不会重复。
- 第一件所选 Look 默认标记为 featured，后续可以扩展为更细的版面或穿着层级。

## 核心指标

| 指标 | 计算方式 |
| --- | --- |
| 已送出借出单 | 借出状态进入寄出、签收、使用、归还或关闭阶段的借出单 |
| 成果数 | 状态为“已落地”或“已发布”的成果记录 |
| 借出覆盖率 | 至少有一条成果的唯一借出单数 ÷ 已送出借出单数 |
| 成果 / 借出 | 成果记录数 ÷ 已送出借出单数；一次借出可以产生多条成果 |
| 证据覆盖率 | 带证据 URL 或证据图片的成果数 ÷ 成果数 |
| 已核验指标 | `metric_mode = verified` 且保存来源、核验人和时间的记录数 |

渠道、成果类型、发布方和 Voice 排名只使用“已落地”或“已发布”记录，避免把线索和未采用结果计为有效成果。

## 指标可信度边界

- `not_recorded`：不记录外部指标。
- `reported`：来自媒体后台、代理商、合作方或人工整理的填报值。
- `verified`：设计师已检查证据和来源；这表示来源链路已核验，不表示平台独立审计了第三方算法。
- 填写任何触达、互动或影响值时，口径不能保持 `not_recorded`。
- `verified` 必须填写 `metric_source`。
- 影响值按 ISO 三位币种代码保存为最小货币单位，不同币种不会相加。
- 系统不计算、预测或命名第三方专有 Media Impact Value；若外部报告提供相关值，只能按报告原值和来源作为“填报影响值”记录。

## API 与权限

- `GET /api/studio/sample-placements`：返回指标、拆分、成果工作区和可关联借出单。
- `GET /api/studio/sample-placements?format=csv`：导出成果与关联 Look 的 UTF-8 CSV。
- `POST /api/studio/sample-placements`：以 multipart 表单建立成果并可同时上传证据图片。
- `PATCH /api/studio/sample-placements/:id`：更新元数据、指标口径和关联 Look。
- `POST /api/studio/sample-placements/:id/image`：替换证据图片；数据库更新失败时会删除新对象，成功后再删除旧对象。
- 所有 API 受设计师身份、管理员白名单和同源写入检查保护。
- Placement 证据图片通过统一媒体路由读取，但始终按非公开媒体处理，未授权访问返回 404。

## 归档与迁移

`nera-archive/7` 新增 `samplePlacements` 和 `samplePlacementItems` 数据集。证据图片加入媒体清单，`kind` 为 `placement`，并带有稳定对象键、内容类型、尺寸、描述、成果 ID 和借出单父级 ID。

迁移到其他平台时：

1. 先导出完整 Archive JSON 和媒体 CSV。
2. 按对象键复制 R2 中 `placements/` 下的证据图片。
3. 将 D1 表迁移到目标关系数据库，保持成果、借出、借调项、资产和作品 ID 不变。
4. 替换统一媒体路由和对象存储适配器。
5. 重新计算汇总指标；汇总结果不是不可逆事实，不需要作为独立数据表迁移。

## 行业口径参考

本阶段的数据模型参考了样衣管理工具常见的“send-out → placement → specific sample”链路，以及 print、online、social 渠道和 media、celebrity、influencer、partner、owned media 等 Voice 分类。实现中只采用通用关系和指标原则，没有复制第三方专有算法。

- [Launchmetrics — Calculate the Return of Your Samples](https://www.launchmetrics.com/resources/blog/calculate-return-of-your-samples-with-sample-tracking-software)
- [Launchmetrics — Samples Management](https://www.launchmetrics.com/software/samples-management)
- [Launchmetrics Glossary](https://www.launchmetrics.com/launchmetrics-glossary)
