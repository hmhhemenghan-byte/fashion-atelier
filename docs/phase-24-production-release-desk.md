# Phase 24 — Production Release Desk / 生产放行台

## 目标

Phase 24 把 Final Sample Gate 中“唯一实物参考已经封存”的事实推进为“这份产品定义已经由设计师批准，可以作为生产准备依据”。它不是采购、ERP、供应商门户或订单系统，也不会联系工厂；它只把最终封样、技术包修订、生产范围、质量边界与人工准备核对固化为一份不可改写的放行记录。

页面主命题为 `RELEASE THE DEFINITION.`。视觉继续使用 NÉRA 的高级编辑网格，以黑色控制文件、封签式酸性黄绿、克制钴蓝和生产票据语言组成放行仪式，但不引入工业控制台、自动化流水线或炫技式 3D。

## 设计依据

时装产品进入生产准备时，需要把最终样、版本、材料、尺寸、标签、质量标准和开放风险连接为同一事实：

- [Delogue PLM](https://www.delogue.com/en/)：强调样衣、规格、BOM、文件、团队与供应方之间的单一事实来源和可追溯批准；
- [Delogue Sample Management](https://www.delogue.com/solutions/use-cases/sample-management)：强调从样衣到最终批准的状态、版本与内部交接连续性；
- [Centric PLM Final Inspection App](https://www.centricsoftware.com/webinar-replays/centric-plm-online-demo-final-inspection-app)：将产品级质量检查点、问题反馈和放行前评估连接到产品事实；
- [Docsie Production Handoff](https://www.docsie.io/solutions/templates/fashion-apparel/production-handoff/)：将批准材料、最终规格、制作说明、关键日期、开放风险与人工批准组织为生产交接结构；
- [Fashion Capital — The Sealing Procedure](https://www.fashioncapital.co.uk/tools/the-sealing-procedure/)：把封样视为生产前统一质量标准的实体参考。

NÉRA 只吸收“最终定义清楚、开放风险可见、批准属于人、版本不可混用”的结构，不接入成本预测、采购单、产能承诺、供应商消息、自动放行或生产执行。

## 设计原则

### Release starts from a sealed reference

生产放行只能引用：

- 状态为 `sealed` 且拥有唯一 `NERA-SEAL` 标识的封样；
- 封样类型为 `preproduction / final`；
- 关联技术包仍然处于 `approved / locked`；
- 对应 Look 仍然存在。

同一封样可以保留多次放行序列，用于记录作废或被替代的准备尝试。服务端自动递增序列，并以 `(sample_signoff_id, sequence)` 保证唯一。放行编号格式为：

```text
PROD-YYYYMMDD-<LOOK>-RNN
```

### Eight readiness facts

建立放行包时自动创建八项人工核对：

1. 封样实物与标识；
2. 最终技术包修订；
3. 尺码范围与放码；
4. 材料、辅料与 BOM；
5. 色彩与批次标准；
6. 标识与包装说明；
7. 质量控制点；
8. 时间窗口与风险。

每项分别保存要求、结果与事实观察。关键核对使用：

```text
pending / ready / blocked / na
```

所有关键项只有 `ready` 才能通过。系统不会从观察文字推断结果，也不会因某项填写完整而自动改变状态。

### Approval is not authorization

设计师把放行包推进为 `ready` 前，必须满足：

- 封样和技术包依赖仍保持有效；
- 执行方或版房、尺码范围、生产色组齐全；
- 计划开始和结束日期齐全，且结束日不早于开始日；
- 质量标准、标识包装说明和放行摘要齐全；
- `openRisk` 为空；
- 八项关键核对全部为 `ready`；
- 设计师明确选择 `release`。

批准后，放行包事实与核对项全部冻结。设计师再次确认时生成唯一授权标识：

```text
NERA-GO-YYYYMMDD-XXXXXXXX
```

状态进入 `released` 后不可退回或改写。任何材料、尺寸、工艺、色彩或时间范围变化都必须回到技术包、试身、封样和新的放行序列，让变化本身成为可追溯事实。

### No automatic execution

Production Release Desk 没有：

- 采购单、生产单或 ERP 写入；
- 工厂账号、供应商门户或外部协作链接；
- 邮件、消息、通知或自动发送；
- 数量承诺、价格、成本预测或交期承诺；
- 自动批准、自动授权或自动改变其他工作台状态。

`factoryName` 和 `factoryReference` 只是内部记录。`released` 表示设计师在 NÉRA 内冻结了产品定义，不代表外部工厂已经收到、接受或开始生产。

## 页面结构

### 1. Release Header

顶部显示：

- 全部放行包；
- 草稿与核对中记录；
- 已批准待授权记录；
- 已生成 `NERA-GO` 的放行记录；
- 缺少事实、存在阻塞或封样后尚未建立放行包的数量。

### 2. New Release Pack

入口只列出满足条件的封样来源，并显示：

- `NERA-SEAL` 标识；
- 技术包代码与修订；
- Look、系列和作品图；
- 封样尺码与实物位置；
- 已存在的最新放行序列。

建立时可以预填放行方式、执行方或版房、内部参考、尺码范围、生产色组、计划窗口和内部说明。

### 3. Control Dossier

主档案保存：

- `draft / in_review / ready / released / superseded / void` 状态；
- `pending / release / revise / hold` 设计师结论；
- 工作室制作、小批次、生产准备或参考放行方式；
- 执行方或版房及内部参考；
- 尺码范围与生产色组；
- 计划开始和结束日期；
- 质量标准与标识包装说明；
- 放行摘要、开放风险与内部说明；
- 批准人与批准时间；
- 唯一授权标识与正式放行时间。

### 4. Eight-point Readiness

八张准备卡分别维护结果和观察事实。阻塞项会进入 Season Control Tower；`pending / blocked / na` 都不能通过关键放行关卡。

### 5. Controlled Exports

```text
GET /api/studio/production-releases?format=releases
GET /api/studio/production-releases?format=checks
GET /api/studio/production-releases?format=json
```

CSV 使用 UTF-8 BOM；JSON 保留放行包、封样、技术包、Look、核对项与准备度关系。

## Season Control Tower 接入

第 18 阶段增加：

- 第十四项事实关卡“生产放行”；
- `RELEASE DESK / 放行缺口` 议程；
- `READINESS / 准备阻塞` 议程；
- Studio Map 中的 `24 / PRODUCTION RELEASE`；
- `nera:production-release-updated` 即时刷新事件。

作战台只在当前已公开 Look 的最新技术包存在已封存封样后检查生产放行。封样尚未成立时，不提前制造放行缺口。没有放行包、最新放行尚未授权或存在阻塞核对时才显示为注意事项。

## 数据结构

### `production_releases`

保存放行编号、封样、技术包与 Look 外键、序列、放行方式、状态、设计结论、执行方、内部参考、尺码范围、色组、计划窗口、质量标准、包装说明、放行摘要、开放风险、批准事实、唯一授权标识、内部说明和时间戳。

### `production_release_checks`

保存放行包外键、八项类别、标题、要求、结果、观察、关键标记、排序、创建者和时间戳。`(production_release_id, category)` 保证每个放行包每类只有一项。

数据库迁移为：

```text
drizzle/0020_majestic_doctor_strange.sql
```

它同时为 Archive Snapshot 增加生产放行包与准备核对数量字段。

## 接口

```text
GET   /api/studio/production-releases
POST  /api/studio/production-releases
PATCH /api/studio/production-releases/:id

PATCH /api/studio/production-releases/checks/:id
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。接口不提供自动发送、采购、订单、生产执行、外部批准或物理删除。

## 归档与迁移

第 24 阶段最初将完整交接格式升级为 `nera-archive/15`；第 25 阶段接入生产偏差与变更控制后当前格式为 `nera-archive/16`：

- `datasets.productionReleases` 保存全部放行序列、范围与人工批准事实；
- `datasets.productionReleaseChecks` 保存八项准备核对及人工结果；
- Inventory 与不可变快照保存两类数量；
- Delta 显示相对快照新增的放行包与准备核对；
- 两类数据参与完整交接包的 SHA-256 摘要；
- 源码、D1 迁移、R2 既有对象键与导出文件可继续整体打包或以后推送 GitHub。
