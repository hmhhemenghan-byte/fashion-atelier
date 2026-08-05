# Phase 31 — Exhibition Recovery / 展后复原室

## 目标

把展期监测结束后的撤展交接、开箱、支撑拆除、静置与回库变成一条独立事实链。它回答的不是“展览是否结束”，而是“作品是否以可确认的状态回到长期保存，还是已经明确转入养护或隔离”。

本阶段不接入物流、保险、仓储计费、运输订单、维修工单或财务系统，也不会自动改变实物资产状态。

## 唯一入口

- 来源必须是 `deinstalled` 或 `closed` 的 Exhibition Watch；
- 撤展时间、离场品相和返回位置必须已经记录；
- 同一条展期监测只能建立一条复原记录；
- 建立时必须填写接收负责人、接收时间和接收地点；
- 旧监测、展陈方案和养护报告保持不可覆盖。

## 数据结构

### `exhibition_recoveries`

保存复原编号、来源监测与实物、接收时间和责任人、包装与运输状态、开箱观察、支撑拆除、展后品相、静置截止、养护需求、保存位置、人工结论和最终签核事实。

状态按 `intake / stabilizing / in_review / released / referred / void` 推进。`released`、`referred` 和 `void` 都是冻结状态。

人工去向包括：

- `return_to_storage`：直接回库；
- `rest_then_store`：完成静置后回库；
- `conservation_review`：转养护复核；
- `quarantine`：隔离观察。

### `exhibition_recovery_checks`

建立复原记录时自动生成六项人工核对：撤展交接与身份、包装与运输状态、展后品相、支撑拆除、稳定化分流、保存位置。每项分别保存 `pending / pass / attention / blocked / na` 与观察依据。

### `exhibition_recovery_images`

每条复原记录最多保存 12 张有效证据，覆盖接收、开箱、品相、支撑、包装和回库状态。对象进入 R2 的 `exhibition-recovery/` 路径，始终使用私密、不可缓存的读取策略，不进入公开作品页。

## 人工放行

回库或转养护前，必须确认来源撤展有效、关键事实齐全、六项核对没有未完成或阻塞、至少一张私密证据，并满足静置或养护分流条件。签核后保存操作者和时间，主档、核对与证据清单冻结。

## 接口与导出

```text
GET   /api/studio/exhibition-recovery
POST  /api/studio/exhibition-recovery
PATCH /api/studio/exhibition-recovery/:id
PATCH /api/studio/exhibition-recovery/checks/:id
POST  /api/studio/exhibition-recovery/:id/images
PATCH /api/studio/exhibition-recovery/images/:id
```

所有接口要求设计师管理员身份；写操作拒绝跨源请求。总览支持复原 CSV、核对 CSV、证据索引 CSV 和完整 JSON。

## 控制塔与归档

- Season Control Tower 新增第 21 道“展后复原闭环”事实关卡；
- 未接收撤展、未闭环复原、关键核对阻塞和到期静置进入统一行动议程；
- Studio Map 扩展为 30 个业务工作台；
- 完整交接格式升级为 `nera-archive/22`；
- 新增 D1 迁移 `drizzle/0027_clammy_spiral.sql`。

## 边界

- 不自动决定回库、隔离或转养护；
- 不自动联系场馆、运输方、修复师或保险方；
- 不生成运输、仓储、维修、采购或财务单据；
- 不把私密品相证据公开；
- 所有接收、核对、放行与转交结论均由人工明确完成。
