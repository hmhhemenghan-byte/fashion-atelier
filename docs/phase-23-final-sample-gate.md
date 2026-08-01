# Phase 23 — Final Sample Gate / 封样签核台

## 目标

Phase 23 将 Fitting Room 中“版型已经成立”的结论推进为“这件最终样衣可以作为唯一实物参考”的冻结事实。它不创建采购单、生产单、库存计划或供应商门户，也不替设计师决定是否进入生产；它只把最终样衣与已批准技术包、最新批准试身和八项实物核对连接起来。

页面主命题为 `SEAL THE REFERENCE.`。视觉使用封样纸、黑色控制文件、钴蓝批准信号与酸性黄绿封签，保留 NÉRA 的高级编辑网格，并以圆形印章、编号条和实物档案语言建立不可改写的仪式感。

## 设计依据

当前时装产品开发工具通常把 sample rounds、fit feedback、collection planning 与 final approval 连接在同一个产品事实中：

- [Lifecycle PLM — Sample Management](https://www.lifecycleplm.com/platform/fashion-sample-management)：将 proto、fit 与 pre-production sample 的轮次、图片、尺寸差异和批准事实关联；
- [Lifecycle PLM — Collection Planning](https://www.lifecycleplm.com/platform/collection-planning)：让系列状态和产品开发事实保持同一实时视图；
- [STYLEman365 PLM](https://styleman.com/product-lifecycle-management)：保留不同样衣阶段的实测、试身反馈和完整历史；
- [Delogue Sample Management](https://www.delogue.com/solutions/use-cases/sample-management)：将样衣状态、未完成任务、批准与截止时间绑定到具体款式。

NÉRA 只吸收“版本可追溯、核对可解释、批准属于人”的结构，不引入自动评分、成本预测、供应商执行或大货生产控制。

## 设计原则

### One gate belongs to one approved revision

封样必须同时绑定：

- 已批准或锁定的 Technical Pack；
- 该技术包最新一轮、已经批准或封存的 Fitting Session；
- 对应的 Look。

同一技术包可以建立多轮封样，但服务端自动递增轮次，并以 `(technical_pack_id, round)` 保证唯一。旧轮次不会被覆盖，也没有物理删除入口。

封样编号格式为：

```text
SAMPLE-YYYYMMDD-<LOOK>-GNN
```

### Eight facts before approval

建立封样后，系统自动创建八项关键核对：

1. 廓形与试身结论；
2. 关键尺寸与公差；
3. 主面料与内里；
4. 辅料、五金与装饰；
5. 结构与制作工艺；
6. 整烫与表面完成；
7. 颜色与批次；
8. 品牌、成分与洗护标识。

每项分别保存要求、结果与观察事实。`pending / fail / na` 都不能通过关键封样关卡；只有八项全部为 `pass` 时，系统才接受设计师的批准操作。

### Approval is not sealing

设计师批准最终样衣之前，必须满足：

- Technical Pack 状态为 `approved / locked`；
- Technical Pack 样衣阶段为 `preproduction / final`；
- 关联的最新试身仍为 `approved / closed` 且结论为 `approve`；
- 样衣尺码、收样时间、实物位置、总体核对和批准说明齐全；
- 至少保存两张有效私密证据；
- 八项关键核对全部通过；
- 设计师明确选择 `approve`。

批准后，文本、核对与证据全部冻结。设计师进一步确认实物位置后，可以生成唯一封样标识：

```text
NERA-SEAL-YYYYMMDD-XXXXXXXX
```

`sealed` 状态不可退回。后续任何变化必须建立新的技术包、试身或封样轮次，让变化本身成为新事实。

### Evidence stays private

封样证据包括正面、侧面、背面、细节、标识和封签照片。它们可能暴露未公开工艺、标签和制作细节，因此无论封样状态如何，媒体接口始终要求设计师管理员身份，不会进入公开缓存。

## 页面结构

### 1. Gate Header

顶部即时显示：

- 全部封样轮次；
- 正在核对的记录；
- 已批准待封存记录；
- 已生成封样标识的最终参考样；
- 缺少事实或存在失败核对的记录。

### 2. New Control Gate

入口只列出符合以下条件的来源：

- 技术包已经批准或锁定；
- 技术包的最新试身已经批准或封存；
- 试身结论为通过。

建立记录时保存样衣类型、尺码、收样时间、制作参考、实物位置与内部说明，同时自动生成八项核对。

### 3. Control Dossier

主档案保存：

- `draft / in_review / approved / sealed / void` 状态；
- `pending / approve / revise / hold` 设计结论；
- 产前样、最终样、展厅样或参考样类型；
- 收样与审阅时间；
- 制作参考、实物位置、面料批次和颜色标准；
- 总体观察、批准说明、批准人与时间；
- 唯一封样编号与封存时间。

### 4. Eight-point Control

八张核对卡分别维护 `pending / pass / fail / na` 结果和实物观察。失败项进入 Season Control Tower；系统不会根据文字自动改变结果。

### 5. Private Evidence

每轮最多保留 10 张有效影像：

- JPEG、PNG、WebP；
- 单张最多 15 MB；
- 对象键为 `sample-signoffs/<year>/<signoff-id>/<image-id>.<ext>`；
- 保存角度、说明、无障碍描述、状态、顺序、类型和字节数；
- 数据库写入失败时回滚新上传对象；
- `active / removed` 只改变当前核对使用状态，不抹除对象历史；
- 全部影像进入 Archive Media Manifest，媒体状态始终为私密草稿。

### 6. Controlled Exports

```text
GET /api/studio/sample-signoffs?format=signoffs
GET /api/studio/sample-signoffs?format=checks
GET /api/studio/sample-signoffs?format=images
GET /api/studio/sample-signoffs?format=json
```

CSV 使用 UTF-8 BOM；JSON 保留封样、技术包、试身、Look、核对、证据与准备度关系。

## Season Control Tower 接入

第 18 阶段增加：

- 第十三项事实关卡“最终封样”；
- `SAMPLE GATE / 封样缺口` 议程；
- `SEAL CHECK / 核对失败` 议程；
- Studio Map 中的 `23 / FINAL SAMPLE GATE`；
- `nera:sample-signoff-updated` 即时刷新事件。

对于已公开 Look，只有其最新技术包和最新试身已经批准后，作战台才检查最终封样。没有记录、最新记录尚未批准或存在失败核对都会显示为缺口；作战台本身仍然只读。

## 数据结构

### `sample_signoffs`

保存封样编号、技术包、试身与 Look 外键、轮次、样衣类型、状态、设计结论、尺码、收样与审阅时间、制作参考、实物位置、面料批次、颜色标准、总体观察、批准事实、唯一封样标识、说明和时间戳。

### `sample_signoff_checks`

保存封样外键、八项类别、核对标题、要求、结果、观察、关键标记、排序、创建者和时间戳。`(sample_signoff_id, category)` 保证每轮每类只有一项。

### `sample_signoff_images`

保存封样外键、R2 对象键、类型、尺寸、角度、说明、无障碍描述、状态、排序、创建者和时间戳。

数据库迁移为：

```text
drizzle/0019_chemical_madame_hydra.sql
```

它同时为 Archive Snapshot 增加封样、核对与封样影像数量字段。

## 接口

```text
GET   /api/studio/sample-signoffs
POST  /api/studio/sample-signoffs
PATCH /api/studio/sample-signoffs/:id

PATCH /api/studio/sample-signoffs/checks/:id

POST  /api/studio/sample-signoffs/:id/images
PATCH /api/studio/sample-signoffs/images/:id
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。接口不提供自动批准、自动封样、采购、生产、外部发送或物理删除。

## 归档与迁移

第 23 阶段最初将完整交接格式升级为 `nera-archive/14`；第 24 阶段接入生产放行后升级为 `/15`，第 25 阶段接入生产偏差与变更控制后当前格式为 `nera-archive/16`：

- `datasets.sampleSignoffs` 保存全部封样轮次与批准事实；
- `datasets.sampleSignoffChecks` 保存八项核对及人工结果；
- `datasets.sampleSignoffImages` 保存私密证据元数据与对象键；
- 封样影像进入媒体对象清单并保持私密状态；
- Inventory 与不可变快照保存三类数量；
- Delta 显示相对快照新增的封样、核对、影像与媒体；
- 三类数据与影像清单参与完整交接包的 SHA-256 摘要；
- 源码、D1 迁移、R2 对象键和导出文件可继续整体打包或以后推送 GitHub。
