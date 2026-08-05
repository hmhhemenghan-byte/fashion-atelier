# Phase 36 — Exhibition Opening Gate / 展览开放总签核

## 目标

把已经冻结的策展选择、实物展陈方案和现场装校事实合并为一份内部开放授权。它回答“是否已经具备由设计师人工批准开放的完整事实”，不自动公开网站、售票、通知场馆或宣称展览已对外开放。

## 唯一入口与修订

- 来源必须是 `approved` 或 `closed` 的 `exhibition_installation_gates`；
- 装校来源必须能够追溯到同一 `approved` 或 `closed` 策展项目；
- 建立开放签核时，系统按策展项目中全部 `include` 选择生成一对一作品核对；
- 同一策展项目可建立多个不可覆盖的开放修订；
- 已批准记录只能关闭，任何后续变化必须建立下一修订。

## 数据结构

### `exhibition_opening_gates`

保存开放编号、策展项目、装校来源、修订号、负责人、场馆、开放与闭展时间、运行简报、每日检查节奏、人员交接、观众无障碍方案、事件升级路径、紧急暂停规则和人工批准依据。

状态按 `draft / in_review / approved / closed / void` 推进；人工决定为 `pending / open / rework / hold`。

### `exhibition_opening_items`

每项直接绑定一条策展选择和一份同一实物的冻结展陈方案，保存顺序、`pending / ready / attention / blocked` 结果、现场位置、展陈就绪依据和人员交接。

## 人工批准门槛

批准必须同时满足：

- 策展项目与装校签核仍为已批准或已关闭状态，且两者属于同一项目；
- 开放负责人、场馆、有效展期和七类运行边界齐全；
- 每件纳入作品都有唯一开放核对；
- 每件作品都绑定同一实物的已批准或已关闭展陈方案；
- 展陈方案的安装与撤展窗口覆盖开放期；
- 全部作品结果为 `ready`，并记录位置、就绪依据和人员交接；
- 设计师明确选择 `open`。

## 接口与导出

```text
GET   /api/studio/exhibition-opening
POST  /api/studio/exhibition-opening
PATCH /api/studio/exhibition-opening/:id
PATCH /api/studio/exhibition-opening/items/:id
```

全部写接口要求设计师管理员身份并拒绝跨源写入。支持开放签核 CSV、作品核对 CSV 与完整 JSON 导出。

## 控制塔与归档

- Season Control Tower 新增第 26 道“展览开放签核”事实关卡；
- 临近开放、作品未就绪、等待整改或缺少运行边界的签核进入行动议程；
- Studio Map 扩展为 35 个业务工作台；
- 完整交接格式升级为 `nera-archive/27`；
- 开放签核与作品核对进入归档快照、摘要、SHA-256 校验和变更对比。

## 边界

- 不自动公开网站、票务或展览页面；
- 不自动联系场馆、制作方、媒体或观众；
- 不把内部授权写成第三方已经开放或验收的事实；
- 不扩展为场馆、票务、预算、采购、保险或合同系统；
- 所有开放、整改、暂缓和关闭决定均由设计师明确完成。
