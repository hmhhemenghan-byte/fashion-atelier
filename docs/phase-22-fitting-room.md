# Phase 22 — Fitting Room / 试身审版室

## 目标

Phase 22 把 Technical Atelier 中的技术意图推进到真实穿着验证。系统不替设计师评价廓形，也不使用自动评分决定通过；它只让每一轮试身拥有明确的技术包上下文、可复核证据、结构化问题和不可覆盖的批准事实。

页面主命题为 `VERIFY THE LINE.`。视觉沿用 NÉRA 的高级编辑网格，以黑色镜面空间、纸样白、钴蓝审版信号和酸性黄绿批准状态构成近似试衣镜、人体中线与修改台的工作面。

## 设计原则

### Every fitting belongs to a revision

每一轮试身必须绑定一个现有技术包修订，同时保存对应 Look。系统在同一技术包内自动递增轮次，以 `(technical_pack_id, round)` 保证唯一，不允许新记录覆盖旧试身。

试身编号格式为：

```text
FIT-YYYYMMDD-<LOOK>-SNN
```

### Observation before judgement

试身记录将事实拆为：

- 本轮目标；
- 平衡判断；
- 轮廓判断；
- 动态判断；
- 穿着反馈；
- 审版结论；
- 独立的版型问题与修改指令；
- 正面、侧面、背面、细节和动态影像。

系统不根据这些文本生成审美评分，也不会自动改写技术包尺寸或工艺。

### Approval is immutable

设计师只有在以下事实齐全时才能批准：

- 已记录试身时间；
- 已记录样衣尺码；
- 已填写本轮目标；
- 已填写平衡判断；
- 已填写动态判断；
- 已填写审版结论；
- 至少存在一张有效试身影像；
- 没有开放或修改中的关键版型问题；
- 关联技术包至少已进入评审；
- 设计结论由设计师明确设为 `approve`。

批准或封存后的场次不可再编辑，也不能修改问题或影像状态。若批准后仍需调整，必须针对当前或新技术包修订建立下一轮试身，让改变本身成为新事实。

### Evidence stays private

试身影像可能包含人物、身体线条和未公开样衣，因此无论场次状态如何，媒体接口始终要求设计师管理员身份。批准不会把试身影像变成公开缓存资源。

## 页面结构

### 1. Fitting Header

顶部即时显示：

- 全部试身轮次；
- 正在审版的场次；
- 已批准或封存场次；
- 事实尚未补齐的场次；
- 开放的关键版型问题。

所有指标由 D1 中的当前事实即时计算，不写入不可逆评分。

### 2. New Session

新场次保存：

| 字段 | 说明 |
| --- | --- |
| Technical Pack | 被验证的具体技术包修订 |
| Sample Size | 当前样衣尺码，默认带入技术包基码 |
| Fitting At | 真实或计划试身时间 |
| Location | 工作室、试衣空间或其他地点 |
| Wearer Reference | 建议使用内部代号，不采集不必要的个人信息 |
| Objective | 本轮要验证的体量、长度、平衡、动态或工艺 |
| Notes | 准备条件、参与角色与内部说明 |

### 3. Fit Assessment

审版事实包含：

- `planned / in_review / approved / closed / cancelled` 状态；
- `pending / approve / revise / hold` 设计结论；
- 平衡、轮廓、动态、舒适度与最终结论；
- 下轮试身时间；
- 人工批准说明、批准者与批准时间。

已批准场次只能进一步封存，不能退回编辑。

### 4. Private Evidence

每轮最多保留 12 张有效影像：

- JPEG、PNG、WebP；
- 单张最多 15 MB；
- 对象键为 `fittings/<year>/<session-id>/<image-id>.<ext>`；
- 保存角度、说明、无障碍描述、状态、顺序、类型和字节数；
- 数据库写入失败时回滚新上传对象；
- `active / removed` 只改变当前审版使用状态，不抹除历史对象；
- 所有影像进入 Archive Media Manifest，但媒体状态始终为私密草稿。

### 5. Alteration Log

每条版型问题独立保存：

- 类别：平衡、比例、松量、长度、轮廓、活动度、工艺、造型或其他；
- 部位与正面、背面、左右侧、内部方向；
- 可复核观察事实；
- 明确修改指令；
- 关联 POM 编号；
- `note / important / critical` 级别；
- `open / in_progress / resolved / removed` 状态；
- 负责人、截止时间、解决时间和排序。

`critical` 问题只有进入 `resolved / removed` 才不再阻止批准。

### 6. Controlled Exports

```text
GET /api/studio/fittings?format=sessions
GET /api/studio/fittings?format=issues
GET /api/studio/fittings?format=images
GET /api/studio/fittings?format=json
```

CSV 使用 UTF-8 BOM，便于表格核对；JSON 保留场次、技术包、Look、问题、影像和准备度关系。

## Season Control Tower 接入

第 18 阶段增加：

- 第十二项事实关卡“试身审版”；
- `FITTING / 审版缺口` 议程；
- `FIT ISSUE / 关键修改` 议程；
- Studio Map 中的 `22 / FITTING ROOM`；
- `nera:fitting-updated` 即时刷新事件。

对于已公开 Look，只有其最新技术包已经批准或锁定后，作战台才检查该技术包的最新试身轮次。没有场次或最新场次尚未批准都会显示为缺口；作战台本身仍然只读。

## 数据结构

### `fitting_sessions`

保存试身编号、技术包与 Look 外键、轮次、状态、设计结论、尺码、时间、地点、内部试穿参考、目标、各类判断、结论、下轮时间、批准事实、备注、创建者和时间戳。

### `fitting_issues`

保存场次外键、类别、部位、方向、观察事实、修改指令、POM、级别、状态、负责人、截止时间、解决时间、排序、创建者和时间戳。

### `fitting_images`

保存场次外键、R2 对象键、类型、尺寸、角度、说明、无障碍描述、状态、排序、创建者和时间戳。

数据库迁移为：

```text
drizzle/0018_calm_natasha_romanoff.sql
```

它同时为 Archive Snapshot 增加试身场次、版型问题和试身影像数量字段。

## 接口

```text
GET   /api/studio/fittings
POST  /api/studio/fittings
PATCH /api/studio/fittings/:id

POST  /api/studio/fittings/issues
PATCH /api/studio/fittings/issues/:id

POST  /api/studio/fittings/:id/images
PATCH /api/studio/fittings/images/:id
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。接口不提供自动批准、自动改技术包、自动发布、自动发送或物理删除。

## 归档与迁移

第 22 阶段最初将完整交接格式升级为 `nera-archive/13`；第 23 阶段接入最终封样后升级为 `/14`，第 24 阶段接入生产放行后升级为 `/15`，第 25 阶段接入生产偏差与变更控制后当前格式为 `nera-archive/16`：

- `datasets.fittingSessions` 保存全部试身轮次；
- `datasets.fittingIssues` 保存全部版型问题与状态；
- `datasets.fittingImages` 保存影像元数据与对象键；
- 试身影像进入媒体对象清单并保持私密状态；
- Inventory 与不可变快照保存三类数量；
- Delta 显示相对快照新增的场次、问题、影像与媒体；
- 三类数据与影像清单参与完整交接包的 SHA-256 摘要；
- 源码、D1 迁移、R2 对象键和导出文件可继续整体打包或以后推送 GitHub。
