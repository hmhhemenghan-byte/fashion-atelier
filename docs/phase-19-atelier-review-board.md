# Phase 19 — Atelier Review Board / 设计评审台

## 目标

Phase 19 把 Studio 的重心重新拉回服装设计本身。它不是通用项目管理器，也不评价“好看”或预测商业表现，而是把一次设计评审拆成四类可追溯事实：

1. 本次评审要回答什么问题；
2. 试衣、比例、材料与工艺中实际观察到什么；
3. 设计师最终做出什么判断，以及依据是什么；
4. 若需修改，谁在何时完成哪一项具体动作。

页面主命题为 `LOOK. QUESTION. DECIDE.`。视觉延续 NÉRA 的黑白编辑网格，以红色校样线和克制的钴蓝状态作为评审语汇，不引入电商卡片、游戏化分数或全站 3D。

## 设计依据

本阶段参考当前时装产品开发工具中三个稳定方向：

- [Centric Software 与 CLO、Browzwear、EFI Optitex 的 3D 集成](https://www.centricsoftware.com/press-releases/centric-software-plm-inks-partnerships-with-clo-browzwear-and-efi-optitex)：设计与版型评审需要围绕同一产品事实交换批注与反馈；
- [Centric Software 的样品与试衣管理方法](https://www.centricsoftware.com/blog/optimizing-order-and-sample-management)：样品、面料、试衣反馈与修改信息应集中记录，减少散落在邮件和表格中的判断；
- [Centric PLM 产品说明](https://www.centricsoftware.com/what-is-centric-plm)：跨角色协作的基础是单一事实来源、版本可见性和明确责任。

NÉRA 只吸收“集中事实、明确结论、闭环任务”的信息结构。系统不复制第三方专有流程，不生成设计评分，也不替代设计师、版师或造型团队的专业判断。

## 页面结构

### 1. Review Header

顶部显示：

- 进行中的评审数量；
- 已逾期和关键修改任务；
- 全部评审、修改后复审、开放任务与闭环比例；
- `Reviews CSV`、`Actions CSV` 与完整 JSON 导出。

闭环比例是 `status = closed` 的评审数量除以全部评审数量，不代表设计质量。

### 2. Open a Review

新评审必须填写主题，可以选择：

- 评审类型；
- 初始状态 `planned` 或 `in_review`；
- 关联系列；
- 关联 Look；
- 评审人或主持；
- 评审时间；
- 需要回答的设计问题。

同时选择系列和 Look 时，该 Look 必须已经编入该系列。评审也可以只关联系列、只关联 Look，或作为 Atelier 全局评审存在。

### 3. Review Dossier

每项评审保存三段彼此独立的内容：

| 字段 | 用途 |
| --- | --- |
| Brief | 需要验证的问题、不可改变的设计意图和评审边界 |
| Observations | 可观察事实、试衣反馈、比例、材料和工艺表现 |
| Conclusion | 最终判断及其依据 |

观察与结论分开，避免把第一印象直接写成不可追溯的决定。

### 4. Design Decision

结论枚举：

| 值 | 中文 | 含义 |
| --- | --- | --- |
| `pending` | 待判断 | 尚未形成设计结论 |
| `approved` | 通过 | 当前方向可以进入下一环节 |
| `revise` | 修改后复审 | 保留意图，但需完成明确修改并再次判断 |
| `hold` | 暂缓 | 当前信息或条件不足，暂停推进 |
| `drop` | 退出本季 | 不进入当前季节线，但保留完整评审记录 |

任何非 `pending` 结论都必须填写 Conclusion。决定由登录的设计师人工选择；系统没有自动批准、自动发布或自动生成结论的路径。

### 5. Revision Actions

修改任务独立保存：

- 名称；
- `low / normal / high / critical` 优先级；
- `open / in_progress / done / cancelled` 状态；
- 负责人；
- 截止时间；
- 执行说明；
- 完成时间。

任务标记为 `done` 时写入 `resolvedAt`；重新打开时清除完成时间。已经关闭或取消的评审不能再新增修改任务。

## 状态与闭环规则

推荐流程：

```text
planned → in_review → decided → closed
```

`cancelled` 用于明确取消但仍需保留记录的评审。关闭评审时执行两项硬性校验：

1. `decision` 不能是 `pending`；
2. 所有修改任务必须为 `done` 或 `cancelled`。

因此，“形成结论”和“完成修改”是两件不同的事实。`revise` 结论不会因为任务建立或完成而自动改为 `approved`，仍需设计师再次确认。

## Season Control Tower 接入

第 18 阶段现在读取评审与修改任务，并增加：

- 第九项事实关卡“设计评审”；
- 未来 14 天内或已逾期的评审；
- 未来 7 天内到期、已逾期或 `critical` 的开放修改任务；
- Studio Map 中的 `19 / REVIEW BOARD` 工作台；
- `nera:review-updated` 即时刷新事件。

以下信号会把 Review Board 标记为 `attention`：

- 评审时间已经逾期；
- 修改任务已经逾期；
- 存在开放的 `critical` 修改任务；
- 存在尚未关闭的 `revise` 结论。

作战台仍然只读，只把设计师带回评审台完成判断。

## 数据结构

### `design_reviews`

保存评审编号、主题、类型、状态、结论、系列与 Look 关系、Brief、Observations、Conclusion、评审人、计划时间、决定时间、创建者和时间戳。

### `design_review_actions`

保存评审外键、任务、优先级、状态、负责人、截止时间、说明、完成时间、创建者和时间戳。删除评审时任务级联删除；当前产品界面和 API 不提供删除评审的入口。

迁移文件：

```text
drizzle/0015_talented_the_twelve.sql
```

该迁移同时为归档快照增加 `design_review_count` 与 `design_review_action_count`。

## 接口

```text
GET   /api/studio/design-reviews
POST  /api/studio/design-reviews
PATCH /api/studio/design-reviews/:id
POST  /api/studio/design-reviews/actions
PATCH /api/studio/design-reviews/actions/:id
```

导出：

```text
GET /api/studio/design-reviews?format=reviews
GET /api/studio/design-reviews?format=actions
GET /api/studio/design-reviews?format=json
```

所有接口要求设计师管理员身份，写请求拒绝跨源调用，读取响应使用 `private, no-store`。接口不提供自动发送、自动发布或批量自动批准。

## 归档与迁移

第 19 阶段最初将完整交接格式升级为 `nera-archive/10`；第 20 阶段接入材料数据后升级为 `/11`，第 21 阶段接入技术包后升级为 `/12`，第 22 阶段接入试身审版后升级为 `/13`，第 23 阶段接入最终封样后升级为 `/14`，第 24 阶段接入生产放行后升级为 `/15`，第 25 阶段接入生产偏差与变更控制后当前格式为 `nera-archive/16`：

- `datasets.designReviews` 保存全部设计评审；
- `datasets.designReviewActions` 保存全部修改任务；
- Inventory 和不可变快照保存两类数量；
- Delta 显示相对快照新增的评审与任务；
- 数据继续参与完整交接包的 SHA-256 摘要；
- CSV 和 JSON 可作为独立交付，也可随整个仓库迁移。

图片仍沿用现有 R2 工作流。Phase 19 当前只关联既有 Collection 与 Work，不复制图片，也不建立新的媒体对象；未来若为评审增加批注图，应继续复用 R2 对象键和 Archive Media Manifest。
