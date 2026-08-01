# Phase 20 — Material Room / 材料室

## 目标

Phase 20 将 Atelier Review Board 之后的设计判断落到真实材料。它不是采购 ERP，也不替设计师自动推荐面料，而是建立一个小型品牌能够维护的单一材料事实来源：

1. 一块材料是什么、来自哪里、具有什么物性；
2. 它处于研究、打样、批准、暂缓还是归档状态；
3. 它被哪些 Look 使用，承担什么作用和部位；
4. 色卡图片、材料档案和 Look 用料关系能否一起导出与迁移。

页面主命题为 `TOUCH. TEST. COMPOSE.`。视觉使用暖灰材料板、黑色档案区、钴蓝决策状态和少量酸性黄绿提示，延续 NÉRA 的编辑网格，同时把材料纹理作为主要视觉证据。

## 设计依据

当前时装产品开发平台普遍把材料、颜色与 BOM 作为原生对象，而不是附在款式备注中的文本：

- [Centric Materials Management](https://www.centricsoftware.com/blog/8-things-you-need-to-know-about-centrics-materials-management-module)：强调集中保存材料规格，并按款式、系列或季节查看材料与批准状态；
- [WFX Fashion PLM](https://www.worldfashionexchange.com/fashion-plm-software.html)：将面料、辅料、成分、供应方、认证和可持续资料放入材料库，并把颜色、尺码与辅料视为服装原生数据；
- [Bamboo Rose PLM & Sourcing](https://bamboorose.com/product-lifecycle-management/)：将多维 BOM、lab dip、strike-off 与样品阶段连接；
- [Backbone / Bamboo Rose](https://backboneplm.com/)：以专用资料库保存 BOM、规格与测量模板，并强调设计团队使用同一实时记录。

NÉRA 当前只吸收其中与独立设计团队直接相关的部分：材料档案、色卡、Look 用料和人工批准。成本核算、采购订单、供应商门户、自动补货和工厂发送不属于本阶段。

## 页面结构

### 1. Material Header

顶部显示：

- 材料总数与已批准材料；
- 打样中材料；
- 当前 Look 用料关系；
- 缺少色卡的材料；
- Look 已选定、但材料档案尚未批准的冲突；
- 材料 CSV、Look BOM CSV 与完整 JSON 导出。

所有数字均由当前 D1 记录即时计算，不写入不可逆评分。

### 2. Register a Material

新材料可保存：

| 字段 | 说明 |
| --- | --- |
| Category | 梭织、针织、皮革、里料、辅料、五金、装饰或其他 |
| Status | 研究、打样、批准、暂缓或归档 |
| Composition / Construction | 成分与组织结构 |
| Color | 颜色名称与内部、Pantone 或十六进制色号 |
| Source | 供应方、供应方编号与产地 |
| Physical | 克重、幅宽、手感、垂坠与后整理 |
| Evidence | 认证依据、备注与材料色卡 |

材料编号由服务端生成，格式为 `MAT-YYYYMMDD-XXXXXX`，建立后保持稳定。

### 3. Swatch Upload

色卡图片支持 JPEG、PNG 与 WebP，单文件不超过 15 MB：

- 新建材料时可以一起上传；
- 已有材料可以无损替换色卡；
- R2 对象键使用 `materials/<year>/<material-id>...`；
- 数据库保存对象键、内容类型、字节数和无障碍描述；
- 替换成功后删除旧对象，数据库失败时回滚新对象；
- 研究、打样、暂缓和归档材料只允许管理员读取；
- `approved` 材料通过媒体路由按公开缓存策略读取。

材料色卡同时进入 Archive Media Manifest，迁移时无需从页面截图中恢复图片。

### 4. Material Dossier

材料详情提供完整规格编辑、状态切换、色卡替换和完整度提示。完整度只检查四项基础事实：

1. 色卡图片；
2. 成分；
3. 颜色名称或色号；
4. 供应方。

它不评价材料质量，也不自动改变状态。

### 5. Look Material Map

材料可以关联系统中的任意 Work，并独立维护：

- 用途：主料、里料、衬料、辅料、五金、装饰、标牌或其他；
- 使用部位；
- Look 色彩；
- 单件用量与单位；
- 执行说明；
- 排序；
- `proposed / selected / approved / dropped` 状态。

同一 Look、材料、用途和部位不能重复建立开放记录。`approved` 用料只能引用 `approved` 材料；移出使用 `dropped` 状态保留事实，不直接删除历史。

材料被批准不代表所有 Look 自动采用它，Look 用料被选定也不会反向批准材料。

## Season Control Tower 接入

第 18 阶段增加：

- 第十项事实关卡“材料批准”；
- `MATERIAL / 批准冲突` 议程；
- Studio Map 中的 `20 / MATERIAL ROOM`；
- `nera:material-updated` 即时刷新事件。

当 `selected` 或 `approved` 的 Look 用料所指材料不是 `approved` 时，作战台提示人工处理。作战台仍然只读，不会改变材料或用料状态。

## 数据结构

### `materials`

保存材料编号、名称、类别、状态、规格、颜色、来源、物性、认证、色卡媒体、备注、创建者和时间戳。

### `work_materials`

保存 Work 与 Material 外键、用途、状态、部位、色彩、用量、单位、说明、排序、创建者和时间戳。删除 Work 或 Material 时数据库级联移除关系；当前产品界面不提供删除材料入口，使用归档与移出状态保留操作事实。

数据库迁移为：

```text
drizzle/0016_smooth_grim_reaper.sql
```

它同时为 Archive Snapshot 增加材料与 Look 用料数量字段。

## 接口

```text
GET   /api/studio/materials
POST  /api/studio/materials
PATCH /api/studio/materials/:id
POST  /api/studio/materials/:id/image
POST  /api/studio/materials/assignments
PATCH /api/studio/materials/assignments/:id
```

导出：

```text
GET /api/studio/materials?format=materials
GET /api/studio/materials?format=bom
GET /api/studio/materials?format=json
```

所有接口要求设计师管理员身份；写请求拒绝跨源调用，读取响应使用 `private, no-store`。

## 归档与迁移

第 20 阶段最初将完整交接格式升级为 `nera-archive/11`；第 21 阶段接入技术包后升级为 `/12`，第 22 阶段接入试身审版后升级为 `/13`，第 23 阶段接入最终封样后升级为 `/14`，第 24 阶段接入生产放行后升级为 `/15`，第 25 阶段接入生产偏差与变更控制后当前格式为 `nera-archive/16`：

- `datasets.materials` 保存材料档案；
- `datasets.workMaterials` 保存 Look 用料；
- 材料色卡进入媒体对象清单；
- Inventory 与不可变快照保存材料和用料数量；
- Delta 显示相对快照新增的材料、用料和媒体；
- 两类数据与色卡清单参与完整交接包的 SHA-256 摘要；
- 源码、D1 迁移、R2 对象键和导出文件可继续整体交付或以后推送 GitHub。
