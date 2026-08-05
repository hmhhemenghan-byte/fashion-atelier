# Phase 35 — Exhibition Installation Gate / 展览装校签核台

## 目标

把已经批准并冻结的展览交付主档带到真实现场，逐项核对入口导语、章节、作品标签、署名、无障碍与权利信息是否按照批准的位置、载体和格式完成安装。

本阶段只保存现场观察、整改动作、私密证据和设计师签核，不自动安装、排版、发布、通知场馆，也不把“签核记录已批准”解释为“展览已经向公众开放”。

## 唯一入口与修订

- 来源必须是 `approved` 或 `closed` 的 `exhibition_delivery_packages`；
- 建立装校签核时，系统按冻结交付项生成一对一现场核对；
- 同一交付主档可建立多个不可覆盖的装校修订；
- 已批准记录只能关闭，现场变化必须建立下一修订。

## 数据结构

### `exhibition_installation_gates`

保存签核编号、交付来源、修订号、现场负责人、现场或展区、装校检查时间、计划开放时间、装校范围、无障碍观察、权利与署名观察、安全说明、现场交接和人工签核依据。

状态按 `draft / in_review / approved / closed / void` 推进；人工决定为 `pending / accept / rework / hold`。

### `exhibition_installation_checks`

每项核对直接绑定一个冻结交付项，保存顺序、`pending / pass / attention / blocked / not_installed` 结果、现场位置、现场格式尺寸、观察依据和整改动作。来源文字与批准要求仍从冻结交付主档读取，不复制成第二份可改写内容。

### `exhibition_installation_images`

每份签核可上传最多 16 张展区整体、墙面文字、作品标签、数字导览、无障碍、权利署名或细节证据。对象进入 R2 的 `exhibition-installation/` 路径，始终保持 `private, no-store`，不会进入公开作品或展览页面。

## 人工签核门槛

批准必须同时满足：

- 来源交付主档仍为已批准或已关闭状态；
- 现场负责人、展区、检查与开放时间、装校范围和五类现场说明齐全；
- 检查发生在计划开放之前；
- 每个冻结交付项都有唯一现场核对；
- 全部现场核对结果均为 `pass`，并记录实际位置、格式和核对依据；
- 至少一张有效私密现场证据；
- 设计师明确选择 `accept`。

存在关注、阻塞或尚未安装项时，只能继续整改、暂缓或退回复验，系统不会自动通过。

## 接口与导出

```text
GET   /api/studio/exhibition-installation
POST  /api/studio/exhibition-installation
PATCH /api/studio/exhibition-installation/:id
PATCH /api/studio/exhibition-installation/checks/:id
POST  /api/studio/exhibition-installation/:id/images
PATCH /api/studio/exhibition-installation/images/:id
```

全部接口要求设计师管理员身份并拒绝跨源写入。支持签核 CSV、核对 CSV、证据索引 CSV 与完整 JSON 导出。

## 控制塔与归档

- Season Control Tower 新增第 25 道“展览装校验收”事实关卡；
- 临近开放、等待整改、核对异常或缺少证据的签核进入行动议程；
- Studio Map 扩展为 34 个业务工作台；
- 完整交接格式升级为 `nera-archive/26`；
- 三类装校数据和私密 R2 对象键进入归档快照、媒体清单、摘要与变更对比。

## 边界

- 不自动安装、排版、改写、翻译或发布任何展览内容；
- 不自动联系场馆、制作方、媒体或观众；
- 不记录虚构的开放、交付或第三方验收事实；
- 不扩展为场馆、票务、预算、采购、保险或合同系统；
- 所有现场验收、整改、暂缓和关闭决定均由设计师明确完成。
