# Phase 25 — Production Change Control / 生产变更控制

## 目标

Phase 25 处理 `NERA-GO` 生成之后出现的生产偏差。它不把生产现场变成另一套消息流，也不会允许任何变化静默覆盖封样、技术包或既有放行；每条材料、色彩、工艺、尺寸、后整理、标识、包装或时间偏差都成为独立案件，由设计师人工复核、决定、验证和关闭。

页面命题为 `HOLD THE LINE. PROTECT THE INTENT.`。视觉继续使用 NÉRA 的编辑网格、黑色控制文件、钴蓝决策线与酸性黄绿签核提示，并以醒目的 `Δ` 表达“变化必须被看见”，不使用传统 ERP 表格或自动化工业监控界面。

## 设计依据

- [Delogue PLM](https://www.delogue.com/en/)：强调样衣、规格、BOM、文件和批准处于同一可追溯事实源，并减少版本混乱与后期返工；
- [Wave PLM](https://waveplm.com/)：强调生产过程中的例外管理、早期质量问题处理和管理层人工复核；
- [Pulse PLM Quality Management](https://www.pulseplm.com/modules/qms)：强调不符合项、纠正行动、验证和闭环追溯；
- [Axind](https://axind.com/)：强调在问题进入后续生产前记录缺陷、处置和纠正行动。

NÉRA 只吸收“偏差独立建案、决定可追溯、处置需验证、变更不覆盖旧定义”的结构。它不接入采购订单、成本、产能、工厂门户、自动通知、自动质量评分或 ERP 写入。

## 入口边界

只有同时满足以下条件的生产放行可以建立偏差：

- `production_releases.status = released`；
- 存在唯一 `NERA-GO` 授权编号；
- 关联 Look 仍然存在。

建立偏差时服务端生成：

```text
DEV-YYYYMMDD-<LOOK>-NN
```

同一放行可以存在多个独立偏差。每条偏差拥有自己的类别、严重程度、事实、影响范围、责任人与期限，不共享或覆盖判断。

## 人工控制流程

状态只能按以下顺序推进：

```text
open → in_review → decided → verified → closed
```

`open / in_review` 可以人工撤回为 `withdrawn`。`closed / withdrawn` 永久冻结。

### 1. Report

保存偏差标题、类别、严重程度、来源、内部参考、影响范围、实际观察、证据引用、负责人、发现日期与复核期限。建立时自动追加第一条 `reported` 时间线记录。

### 2. Review

设计师补齐：

- 建议处置；
- 对设计意图的影响；
- 质量风险；
- 相关证据和人工复核记录。

系统不会从文字内容、严重程度或期限自动生成决定。

### 3. Decide

设计师必须明确选择：

```text
accept_once / rework / revise_definition / reject / hold
```

进入 `decided` 前，影响范围、偏差事实、建议处置、设计影响、质量风险、负责人和发现日期必须齐全。决定形成时保存决定人和决定时间，之后不可改变。

`accept_once` 只允许当前案件的一次性偏差，不会回写封样、技术包或生产放行。

`revise_definition` 表示产品定义必须重新建立。旧放行仍然保留；关闭案件前必须记录后续放行编号。

### 4. Verify

实际返工、替换、接受或其他处置完成后，由设计师填写验证记录并推进为 `verified`。系统保存验证人和验证时间，不会因为时间线中出现“完成”等文字自动推进。

### 5. Close

关闭前必须填写最终闭环结论。若决定为 `revise_definition`，还必须记录后续生产放行编号。关闭后主档和时间线均冻结。

## 时间线

`production_exception_actions` 独立保存：

```text
reported / review_note / evidence / response / decision / verification / closure
```

每条记录包含事实正文、可选证据引用、发生时间、创建人和创建时间。主档状态不会从时间线内容自动推断。

## Season Control Tower

Phase 25 增加：

- 第十五项事实关卡“生产偏差闭环”；
- `CHANGE CONTROL / 高风险偏差` 议程；
- `CHANGE CONTROL / 逾期复核` 议程；
- Studio Map 中的 `25 / CHANGE CONTROL`；
- `nera:production-exception-updated` 即时刷新事件。

关卡只检查未关闭的 `high / critical` 偏差和已经逾期的复核，不把低风险记录隐藏，也不把案件数量转化为供应方评分。

## 数据结构

### `production_exceptions`

保存偏差编号、生产放行与 Look 外键、类别、严重程度、状态、设计决定、事实内容、影响范围、来源、证据引用、负责人、期限、决定事实、验证事实、闭环结论、后续放行编号与时间戳。

### `production_exception_actions`

保存偏差外键、记录类型、事实正文、证据引用、发生时间、创建人与创建时间。

数据库迁移：

```text
drizzle/0021_reflective_cerise.sql
```

它同时为 Archive Snapshot 增加偏差案件与人工处置记录数量字段。

## 接口

```text
GET   /api/studio/production-exceptions
POST  /api/studio/production-exceptions
PATCH /api/studio/production-exceptions/:id
POST  /api/studio/production-exceptions/:id/actions
```

导出：

```text
GET /api/studio/production-exceptions?format=exceptions
GET /api/studio/production-exceptions?format=actions
GET /api/studio/production-exceptions?format=json
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。没有删除、自动批准、自动外发、采购、订单、供应方账户或生产执行接口。

## 归档与迁移

完整交接格式升级为 `nera-archive/16`：

- `datasets.productionExceptions` 保存偏差主档、设计决定与闭环事实；
- `datasets.productionExceptionActions` 保存完整人工时间线；
- Inventory、不可变快照和 Delta 保存两类数量；
- 两类数据参与完整交接包的 SHA-256 摘要；
- 源码、D1 迁移、R2 既有对象键与导出文件仍可整体打包或以后推送 GitHub。
