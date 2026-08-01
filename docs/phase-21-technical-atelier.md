# Phase 21 — Technical Atelier / 技术工艺室

## 目标

Phase 21 将设计评审与 Material Room 中已经明确的创作事实推进到“可制作、可复核、可交接”的技术语言。它不是工厂 ERP，也不会替设计师自动决定版型或工艺，而是为每个 Look 建立受控的技术包修订：

1. 明确当前修订对应哪件作品、哪个样衣阶段；
2. 保存基码、单位、版型意图、纸样编号与制作总述；
3. 用结构化尺寸点记录数值、公差和测量方法；
4. 用可确认、可移除但不可直接抹除的工艺说明记录制作要求；
5. 让技术图、结构化数据和人工批准状态一起归档。

页面主命题为 `MAKE IT BUILDABLE.`。视觉继续使用 NÉRA 的编辑网格，并把黑色制作底稿、钴蓝批准信号和酸性黄绿完成提示组合成一张接近纸样台与技术蓝图的工作面。

## 设计原则

### Revision is a fact

同一 Look 可以建立多个修订。新修订由服务端自动计算下一个版本号，并使用 `(work_id, revision)` 唯一约束。旧修订不被覆盖，也不提供删除入口。

### Approval is human

系统只检查事实是否齐全，不评价设计质量。技术包只有满足以下条件时才允许由设计师手动批准：

- 已上传技术平面图；
- 已填写基码；
- 已填写版型意图；
- 至少存在一个有效尺寸点；
- 至少存在一条有效工艺说明；
- 没有仍处于 `open` 的关键工艺风险。

只有 `approved` 技术包可以进入 `locked`。已批准或已锁定版本都必须先退回 `review`，才能继续修改技术图、尺寸点、工艺说明或其他技术事实。

### Removal is traceable

尺寸点使用 `active / removed`，工艺说明使用 `open / confirmed / removed`。界面不直接删除记录，避免交接时无法解释技术事实为何消失。

## 页面结构

### 1. Technical Header

顶部即时显示：

- 技术包修订总数；
- 正在评审的修订；
- 已批准与已锁定修订；
- 尚未补齐的修订；
- 开放的关键工艺风险；
- 尚未建立技术包的 Look。

所有指标由当前 D1 数据即时计算，不写入不可逆评分。

### 2. New Revision

建立修订时可保存：

| 字段 | 说明 |
| --- | --- |
| Work | 对应作品 / Look |
| Revision | 服务端按 Look 自动生成下一修订 |
| Sample Stage | 概念、白坯、初样、试身样、产前样或最终样 |
| Base Size / Unit | 基码与厘米或英寸 |
| Fit Intent | 贴合度、体量、长度、落点和穿着感 |
| Pattern Reference | 纸样、Block 或内部编号 |
| Construction Summary | 结构、层次与关键制作顺序 |
| Technical Flat | 正背面技术平面图 |
| Notes | 修订原因和需要验证的问题 |

技术包编号格式为：

```text
TP-YYYYMMDD-<LOOK>-RNN
```

### 3. Technical Flat Upload

技术图支持 JPEG、PNG 和 WebP，沿用现有单文件 15 MB 限制：

- 建立技术包时可同时上传；
- 未锁定版本可无损替换；
- R2 对象键使用 `technical-packs/<year>/<technical-pack-id>...`；
- 数据库保存对象键、类型、字节数和无障碍描述；
- 替换成功后删除旧对象，数据库失败时回滚新对象；
- 草拟与评审版本的技术图只允许管理员读取；
- 已批准或已锁定版本使用公开缓存媒体策略；
- 所有技术图进入 Archive Media Manifest。

### 4. Points of Measure

每个尺寸点保存：

- POM 编号；
- 尺寸点名称；
- 基码目标值；
- 正公差与负公差；
- 测量方法；
- 展示顺序；
- `active / removed` 状态。

数值以文本形式保存，允许小数、分数或品牌内部写法；实际单位由技术包统一声明。

### 5. Construction Protocol

工艺说明分为：

- 缝型；
- 针迹；
- 收边；
- 辅料；
- 标牌；
- 图案；
- 包装；
- 其他。

每条说明独立维护标题、详细指令、标准 / 重要 / 关键优先级与 `open / confirmed / removed` 状态。关键说明未确认时会阻止技术包批准并进入 Season Control Tower。

### 6. Controlled Exports

技术工艺室提供：

```text
GET /api/studio/technical-packs?format=packs
GET /api/studio/technical-packs?format=measurements
GET /api/studio/technical-packs?format=construction
GET /api/studio/technical-packs?format=json
```

CSV 使用 UTF-8 BOM，适合表格核对与迁移；JSON 保留完整关系、状态与引用。

## Season Control Tower 接入

第 18 阶段增加：

- 第十一项事实关卡“技术包批准”；
- `TECH PACK / 批准缺口` 议程；
- `CONSTRUCTION / 关键工艺` 议程；
- Studio Map 中的 `21 / TECHNICAL ATELIER`；
- `nera:tech-pack-updated` 即时刷新事件。

已公开 Look 的最新技术包不是 `approved / locked` 时，关卡会提示人工处理。作战台仍然只读，不会自动建立、批准或锁定技术包。

## 数据结构

### `technical_packs`

保存稳定编号、Work 外键、修订号、状态、样衣阶段、基码、单位、版型与制作说明、技术图媒体、批准信息、创建者和时间戳。

### `tech_pack_measurements`

保存技术包外键、POM 编号、名称、目标值、正负公差、测量方法、状态、排序、创建者和时间戳。

### `tech_pack_construction_notes`

保存技术包外键、工艺类别、标题、指令、优先级、确认状态、排序、创建者和时间戳。

数据库迁移为：

```text
drizzle/0017_graceful_greymalkin.sql
```

它同时为 Archive Snapshot 增加技术包、尺寸点与工艺说明数量字段。

## 接口

```text
GET   /api/studio/technical-packs
POST  /api/studio/technical-packs
PATCH /api/studio/technical-packs/:id
POST  /api/studio/technical-packs/:id/image

POST  /api/studio/technical-packs/measurements
PATCH /api/studio/technical-packs/measurements/:id

POST  /api/studio/technical-packs/construction
PATCH /api/studio/technical-packs/construction/:id
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。接口不提供自动批准、自动锁定、自动发布、自动发送或物理删除。

## 归档与迁移

第 21 阶段最初将完整交接格式升级为 `nera-archive/12`；第 22 阶段接入试身审版后升级为 `/13`，第 23 阶段接入最终封样后升级为 `/14`，第 24 阶段接入生产放行后升级为 `/15`，第 25 阶段接入生产偏差与变更控制后当前格式为 `nera-archive/16`：

- `datasets.technicalPacks` 保存全部修订；
- `datasets.techPackMeasurements` 保存尺寸规格；
- `datasets.techPackConstructionNotes` 保存工艺说明；
- 技术平面图进入媒体对象清单；
- Inventory 与不可变快照保存三类数量；
- Delta 显示相对快照新增的技术包、尺寸点、工艺说明和媒体；
- 三类数据与技术图清单参与完整交接包的 SHA-256 摘要；
- 源码、D1 迁移、R2 对象键和导出文件可继续整体交付或以后推送 GitHub。
