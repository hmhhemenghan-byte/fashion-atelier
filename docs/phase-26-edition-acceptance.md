# Phase 26 — Edition Acceptance / 成衣验收台

## 目标

Phase 26 把 `NERA-GO` 之后实际到达的成衣、小批次或工作室版本建立为独立实物事实。它不把生产放行当成“已经生产完成”，也不把聊天、照片或口头结论当成验收；每个到达范围都有自己的轮次、八项核对、私密证据与人工决定。

页面命题为 `RECEIVE THE REAL. SIGN THE STANDARD.`。界面沿用 NÉRA 的黑色控制文件、编辑网格、钴蓝结构线与酸性黄绿签署信号，以“实物真相”区别于放行文件和偏差讨论。

## 产品边界

- 只从 `production_releases.status = released` 且拥有唯一 `NERA-GO` 的放行建立；
- 不生成采购单、生产订单、收货单、成本、付款、库存或 ERP 数据；
- 不向工厂、版房、物流或任何外部人员发送信息；
- 不以抽检数量、通过率或偏差数量自动形成供应方评分；
- 不改写技术包、封样、生产放行或既有偏差决定；
- 通过、返工、暂缓和拒收均由设计师明确操作。

## 数据模型

### `production_acceptances`

保存验收编号、生产放行与 Look 外键、轮次、状态、人工决定、成衣版号、颜色、尺码范围、到达数量、抽检数量、到达与验收时间、实物位置、验收标准、总体观察、处置结论、签署人、签署时间和唯一 `NERA-ACCEPT` 标识。

### `production_acceptance_checks`

新建验收时自动建立八项核对：

1. 版号与放行身份；
2. 材料、色彩与手感；
3. 关键尺寸与尺码递进；
4. 结构与制作工艺；
5. 后整理与外观完成；
6. 品牌、尺码与洗护标识；
7. 包装与保护；
8. 到达与抽检数量。

每项保存要求、人工结果、观察事实、关键性和顺序。系统不从描述文字推断通过。

### `production_acceptance_images`

保存正面、背面、工艺细节、标识、包装、整组或其他实物证据。图片进入 R2 的 `production-acceptances/<year>/<acceptance>/<image>` 路径，D1 只保存对象键、内容类型、字节数、描述、状态和顺序。每轮最多 12 张有效证据，始终保持设计师私密访问。

数据库迁移：

```text
drizzle/0022_giant_cloak.sql
```

## 人工状态

```text
draft → in_review → accepted
                  ↘ rejected
draft / in_review → void
```

- `accepted` 只能搭配 `decision = accept`；
- `rejected` 保存 `rework / hold / reject` 的具体人工决定；
- 形成最终状态前必须填写处置结论；
- `accepted / rejected / void` 永久冻结，后续实物建立下一轮；
- 抽检数量不能超过本次到达数量。

## 通过门槛

只有同时满足以下条件才能生成人工验收标识：

- 关联生产放行仍然有效且保有 `NERA-GO`；
- 没有未关闭的 `high / critical` 生产偏差；
- 成衣版号、颜色、尺码范围、到达与抽检数量、到达与验收时间、验收标准和总体观察齐全；
- 至少一张有效私密实物证据；
- 八项关键核对全部为 `pass`；
- 设计师明确选择 `accept` 并填写处置结论。

通过后服务端生成：

```text
NERA-ACCEPT-YYYYMMDD-XXXXXXXX
```

## 接口与导出

```text
GET   /api/studio/production-acceptances
POST  /api/studio/production-acceptances
PATCH /api/studio/production-acceptances/:id
PATCH /api/studio/production-acceptances/checks/:id
POST  /api/studio/production-acceptances/:id/images
PATCH /api/studio/production-acceptances/images/:id
```

导出：

```text
GET /api/studio/production-acceptances?format=acceptances
GET /api/studio/production-acceptances?format=checks
GET /api/studio/production-acceptances?format=images
GET /api/studio/production-acceptances?format=json
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。私密图片经现有受保护媒体路由读取。

## Season Control Tower

Phase 26 增加：

- 第十六项事实关卡“成衣实物验收”；
- `EDITION ACCEPTANCE / 实物缺口` 议程；
- `PHYSICAL CHECK / 核对失败` 议程；
- Studio Map 中的 `26 / EDITION ACCEPTANCE`；
- `nera:production-acceptance-updated` 即时刷新事件。

关卡只检查有效 NERA-GO 是否已经形成通过验收，以及是否仍有开放的失败核对；它不是成衣质量评分。

## 归档与迁移

完整交接格式升级为 `nera-archive/17`：

- `datasets.productionAcceptances` 保存验收主档、决定与签署事实；
- `datasets.productionAcceptanceChecks` 保存八项人工核对；
- `datasets.productionAcceptanceImages` 保存私密证据索引；
- Inventory、不可变快照和 Delta 保存三类数量；
- 私密证据进入 Archive Media Manifest，并参与 SHA-256 摘要；
- D1 数据与 R2 原始图片仍需在独立 Cloudflare 迁移或灾备时单独导出，源码只包含结构、迁移和读写逻辑。
