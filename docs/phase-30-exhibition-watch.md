# Phase 30 — Exhibition Watch / 展期监测台

## 目标

把已批准的展陈边界延伸为真实在展事实：按人工设定频率记录环境读数、作品品相、支撑状态、虫害迹象和现场事件，在风险出现时由设计师或养护负责人明确选择继续、限制、暂停、养护复核或立即撤展。

该阶段不做场馆运营、自动传感器接入、短信告警、票务、保险或第三方通知。

## 专业依据

加拿大文物保护研究所指出，光照损伤与强度和暴露时间共同相关，纺织品展陈环境只有通过仪器测量才能确认，并建议保留展示时间、照度和环境条件记录。纺织品还需持续关注不适当温湿度、虫害、物理受力和不当操作。

- [Caring for textiles and costumes](https://www.canada.ca/en/conservation-institute/services/preventive-conservation/guidelines-collections/textiles-costumes.html)
- [Textiles and the Environment — CCI Notes 13/1](https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/canadian-conservation-institute-notes/textiles-environment.html)
- [Environmental Monitoring Equipment Loans Program](https://www.canada.ca/en/conservation-institute/services/preventive-conservation-services/environmental-monitoring-equipment-loans/environmental-monitoring-equipment-loans.html)

系统只把批准方案的范围与现场读数进行透明对照，不把默认值冒充测量结果，也不代替专业修复师判断。

## 唯一入口

- 来源必须是状态为 `approved`、人工决定为 `ready` 或 `ready_with_limits` 的展陈方案；
- 同一展陈方案只能建立一条监测链；
- 遗失或已归档实物不能进入监测；
- 开启时必须记录监测负责人、检查间隔和开场状态；
- 监测不会自动改变实物库位、借调或养护报告。

## 数据结构

### `exhibition_watches`

保存监测编号、展陈方案、实物、状态、人工决定、检查间隔、负责人、开场状态、决定依据、撤展状态、回库位置和关闭事实。

状态按 `active / paused / deinstalled / closed` 推进。关闭后整条监测主档与证据清单冻结。

### `exhibition_watch_observations`

每条现场观察都是不可覆盖的时间点事实，包含：

- 观察时间；
- 照度、紫外线、相对湿度与温度；
- 品相与支撑状态；
- 虫害迹象；
- 物理、环境、光照、安全、虫害或操作事件；
- 观察事实、现场处置与人工去向。

当记录异常、限制、暂停、养护复核或撤展时，观察事实和现场处置必须完整。系统不会删除或改写旧观察，后续状态通过新观察表达。

### `exhibition_watch_images`

每条监测链可保留最多 20 张有效图片，可关联具体观察，类型覆盖整体、品相、支撑、环境、事件与撤展。对象进入 R2 的 `exhibition-watch/` 路径，始终保持 `private, no-store`。

## 人工处置

- `continue`：按现有条件继续；
- `limit`：在记录的限制下继续；
- `pause`：暂停展示；
- `conservator_review`：暂停并进入养护复核；
- `deinstall`：人工决定立即撤展。

系统会透明标记读数超出批准的照度、UV、温湿度范围，但不会自动替代人工处置。选择暂停、养护复核或撤展时，服务端同步更新监测状态，且保留操作者与时间。

## 撤展与关闭

监测状态进入 `deinstalled` 后，关闭前必须同时满足：

- 至少一条现场观察；
- 已记录撤展时的作品状态；
- 已记录回库位置；
- 已记录人工结论依据。

关闭后的新展览必须从新的展陈方案开始，不允许覆盖旧监测事实。

## 接口与导出

```text
GET   /api/studio/exhibition-watch
POST  /api/studio/exhibition-watch
PATCH /api/studio/exhibition-watch/:id
POST  /api/studio/exhibition-watch/:id/observations
POST  /api/studio/exhibition-watch/:id/images
PATCH /api/studio/exhibition-watch/images/:id
```

所有接口要求设计师管理员身份；写操作拒绝跨源请求。总览支持监测 CSV、观察 CSV、证据索引 CSV 和完整 JSON。

## 控制塔与归档

- Season Control Tower 新增第 20 道“展期监测闭环”事实关卡；
- 未开启监测、检查逾期和最新异常进入统一行动议程；
- Studio Map 扩展为 29 个业务工作台；
- 完整交接格式升级为 `nera-archive/21`，包含监测、观察、私密证据索引、快照计数、SHA-256 摘要与变更对比；
- 新增 D1 迁移 `drizzle/0026_glorious_alex_wilder.sql`。

## 边界

- 不接入自动传感器或把缺失读数推测为正常；
- 不自动暂停或撤展；
- 不自动联系场馆、修复师、安保或保险方；
- 不生成票务、合同、费用或场馆任务单；
- 所有继续、限制、暂停、复核、撤展与关闭均由人工明确完成。
