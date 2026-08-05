# Phase 29 — Exhibition Readiness / 展陈准备室

## 目标

把已批准的作品养护事实转化为可安装、可限制、可撤展的展示边界。该阶段服务展览、编辑拍摄、媒体展示、专业呈现和档案研究，不扩展为票务、场馆订单、展览营销或外部通知系统。

## 设计依据

加拿大文物保护研究所关于纺织品与服装的预防性保护指南指出：状况不佳的纺织品不应直接展示；服装需要合适的定制支撑；光照损伤具有累积性；展示时长、环境、公众接触和撤展后的保存均需要明确控制。

- [Basic care – Textiles](https://www.canada.ca/en/conservation-institute/services/care-objects/textiles-costumes/basic-care-textiles.html)
- [Caring for textiles and costumes](https://www.canada.ca/en/conservation-institute/services/preventive-conservation/guidelines-collections/textiles-costumes.html)
- [Design considerations for collection facilities](https://www.canada.ca/en/conservation-institute/services/preventive-conservation/design-considerations.html)

这些资料只用于结构与风险边界参考。NÉRA 的默认数值是方案起点，不替代场馆测量、材料测试或专业纺织品修复师判断。

## 唯一入口与修订

- 来源必须是一份 `approved` 或 `closed` 的 `conservation_reports` 记录；
- 来源养护报告与实物资产必须一致；
- `missing` 或 `archived` 实物不能建立方案；
- 同一实物可建立多个不可覆盖的方案轮次，编号格式为 `DISPLAY-日期-资产-Rxx`；
- 展陈批准不会自动修改 `sample_assets` 的位置、状态或品相。

## 数据结构

### `exhibition_readiness_plans`

保存方案编号、养护来源、实物、作品、修订、展示标题、地点、用途、安装与撤展时间、展示方式、支撑与穿装要求、最高照度、紫外限制、温湿度范围、最大展示天数、操作团队、安全屏障、应急说明、安装备注，以及人工决定、批准和关闭事实。

状态按 `draft → in_review → approved → closed` 推进；草稿或复核版本可以作废。已批准版本只能在撤展后关闭，正文、限制、核对和证据均不能原地改写。

人工决定包含：

- `ready`：按记录条件可展示；
- `ready_with_limits`：仅在明确限制下展示；
- `hold`：暂缓安装；
- `not_for_display`：当前不宜展示。

### `exhibition_readiness_checks`

每份方案自动建立七项人工核对：

1. 养护状态与展示准入；
2. 模特台、支撑与受力；
3. 光照与累计曝光；
4. 温湿度与展柜环境；
5. 搬运、穿装与安装路径；
6. 公众距离与应急防护；
7. 撤展与回库复查。

结果区分 `pending / pass / attention / blocked / na`，并独立记录是否为关键条件和现场观察事实。

### `exhibition_readiness_images`

每份方案可上传最多 12 张整体、支撑、正背面、细节、安装或环境证据。对象进入 R2 的 `exhibition-readiness/` 路径，始终使用 `private, no-store`，不会进入公开作品页或溯源页。

## 人工批准门槛

批准要求同时满足：

- 来源养护事实仍有效，实物仍可检查；
- 方案标题、地点、安装方式、支撑、穿装、操作团队、安全屏障、应急说明和人工决定依据完整；
- 七项核对全部形成结论；
- 至少一张有效私密试装或环境证据；
- `ready` 不允许存在 `attention`；
- `ready` 与 `ready_with_limits` 不允许存在关键 `blocked`；
- 放行展示必须具有有效安装与撤展窗口，且时长不超过人工设定的最大展示天数；
- 温度与湿度上下限必须有效。

批准人和时间由服务端记录。限制变化、重新安装或下一次展示应关闭当前方案并建立新轮次。

## 接口与导出

```text
GET  /api/studio/exhibition-readiness
POST /api/studio/exhibition-readiness
PATCH /api/studio/exhibition-readiness/:id
PATCH /api/studio/exhibition-readiness/checks/:id
POST  /api/studio/exhibition-readiness/:id/images
PATCH /api/studio/exhibition-readiness/images/:id
```

所有 Studio 接口要求管理员身份；写操作拒绝跨源请求，响应使用私有无缓存策略。总览支持方案 CSV、核对 CSV、证据索引 CSV 与完整 JSON 导出。

## 控制塔与归档

- Season Control Tower 新增第 19 道“展陈安全放行”事实关卡；
- 关键条件阻塞、未来十四天内未批准安装和逾期撤展进入统一行动议程；
- Studio Map 扩展为 28 个业务工作台；
- 完整交接格式升级为 `nera-archive/20`，包含方案、核对、私密证据索引、快照计数、SHA-256 摘要与变更对比；
- 新增 D1 迁移 `drizzle/0025_right_venom.sql`。

## 边界

- 不自动改变样衣状态、库位或借调事实；
- 不自动联系场馆、媒体、策展人或安装团队；
- 不生成合同、票务、保险、费用或场馆订单；
- 不把默认环境数值冒充现场测量或第三方认证；
- 所有展示、限制、暂缓和不宜展示决定均由设计师人工完成。
