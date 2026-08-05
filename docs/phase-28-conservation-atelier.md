# Phase 28 — Conservation Atelier / 作品养护室

## 目标

把已经进入实物档案的样衣继续保存为可检查、可处置、可复查的长期作品事实。该阶段记录作品在真实使用与保存中的变化，但不把网站扩展为维修工单、仓储、保险、订单或 ERP 系统。

## 唯一入口与修订

- 每份报告必须绑定一条真实 `sample_assets` 记录；
- `missing` 或 `archived` 实物不能直接建立报告，需先回到实物盘点台确认；
- 同一实物可建立多个不可覆盖的检查轮次，编号格式为 `CARE-日期-资产-Rxx`；
- 作品、实物编号、当前库位与已发布溯源档案仅作只读参考，养护批准不会自动改写资产状态。

## 数据结构

### `conservation_reports`

保存报告编号、来源实物、作品、轮次、状态、人工决定、检查时间与地点、总体状态、状态总结、建议处理、操作限制、保存建议、环境说明、处理完成时间、下一次复查时间，以及批准与关闭事实。

状态按 `draft → in_review → approved → closed` 推进；草稿或复核版本可以作废。已批准版本只能关闭，正文、检查和证据均不能原地改写。

人工决定包含：

- `monitor`：持续观察；
- `treat`：按记录方案处理；
- `ready_for_use`：当前可继续使用；
- `archive`：转入保存或停用判断。

### `conservation_report_checks`

每个轮次自动建立六项人工检查：

1. 整体结构与廓形；
2. 面料表面与色彩；
3. 缝线与内部结构；
4. 开合与五金；
5. 装饰与特殊部件；
6. 标识与档案身份。

每项分别保存 `pending / stable / attention / treatment / resolved / na` 结论、风险级别、观察事实与处理说明。

### `conservation_report_images`

每份报告可上传最多 12 张总体、正面、背面、内部、细节、标签或损伤图片。对象进入 R2 的 `conservation-reports/` 路径，始终使用 `private, no-store`，不会因报告批准或溯源档案公开而变成前台媒体。

## 人工批准门槛

批准要求同时满足：

- 来源实物仍可检查；
- 检查时间、地点、总体状态、状态总结、保存建议、下一次复查与人工结论依据完整；
- 六项检查全部形成结论；
- 至少有一张有效私密证据；
- 没有未解决的 `high` 或 `critical` 风险；
- 设计师明确选择人工养护决定；
- `treat` 必须写明处理方案；
- 仍有 `attention` 或 `treatment` 项时不能决定 `ready_for_use`。

批准人和时间由服务端记录。已批准报告冻结，之后的状态变化应关闭当前轮次并建立下一轮。

## 接口与导出

Studio 接口继续要求管理员身份，写操作拒绝跨源请求，响应使用私有无缓存策略：

```text
GET  /api/studio/conservation-reports
POST /api/studio/conservation-reports
PATCH /api/studio/conservation-reports/:id
PATCH /api/studio/conservation-reports/checks/:id
POST  /api/studio/conservation-reports/:id/images
PATCH /api/studio/conservation-reports/images/:id
```

总览支持报告 CSV、检查 CSV、证据索引 CSV 与完整 JSON 导出。导出包含稳定 R2 对象键，不把图片二进制嵌入 JSON。

## 控制塔与归档

- Season Control Tower 新增第 18 道“作品养护状态”事实关卡；
- 逾期复查与未解决的高风险检查进入统一行动议程；
- Studio Map 扩展为 27 个业务工作台；
- 完整交接格式升级为 `nera-archive/19`，包含报告、检查、私密证据索引、快照计数、SHA-256 摘要与变更对比；
- 新增 D1 迁移 `drizzle/0024_clean_kat_farrell.sql`。

## 边界

- 不自动改变样衣的可用、损坏、遗失或归档状态；
- 不自动安排维修、联系供应商或生成费用；
- 不记录购买者、持有人、订单或保险信息；
- 不把品牌内部判断表述为第三方文物保护认证；
- 所有批准、处理和关闭决定仍由设计师人工完成。
