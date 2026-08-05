# NÉRA ATELIER — Fashion Showcase

这是“时装设计展示”的完整源码仓库，包含 Collection 系列策展、Look 编排、全屏 Digital Lookbook、首页主推系列、前台作品展示与沉浸式详情页、Process Dossier 设计过程档案、Atelier Review Board 设计评审台、Material Room 材料室与 Look 用料表、Technical Atelier 技术包与制作规格、Fitting Room 试身审版与私密影像、Final Sample Gate 最终封样签核与私密证据、Production Release Desk 生产放行与准备核对、Production Change Control 生产偏差与变更控制、Edition Acceptance 成衣实物验收、Provenance Dossier 成衣溯源档案、Conservation Atelier 作品养护室、Exhibition Readiness 展陈准备室、Exhibition Watch 展期监测台、Professional Publishing 专业发布中心、Editorial Operations 编辑运营工作台、Editorial Calendar 编辑排期、Archive & Handoff 交接归档中心、Private Showroom 私享展厅、Pull Request 专业回应、Sample Fulfilment 样衣履约、Sample Correspondence 沟通留痕、Sample Inventory & Audit 实物资产与盘点、Sample Performance 样衣使用效能、Placement & Impact 样衣落地与媒体成果、Seasonal Coverage Book 季度媒体覆盖册、Relationship & Opportunity 关系与机会工作台、Campaign & Outreach 专业外联策划台、Season Control Tower 季度作战台、统一视觉素材索引、公开 Press Room、设计师登录、单图与多图批量上传、作品细节图组、无损替换作品主图、草稿与发布管理，以及 JSON/CSV/iCal 数据导出。

## 源码交接与迁移

当前源码同时保留两条部署路径：默认命令继续服务 ChatGPT Sites；`*:cloudflare` 命令使用独立的 Workers、D1、R2、Images 与 Cloudflare Access 配置。完整步骤、数据迁移、权限边界和回滚方法见 [`docs/cloudflare-independent-deployment.md`](docs/cloudflare-independent-deployment.md)。迁移前可以先运行 `npm run cloudflare:check-template` 检查模板结构；填入真实资源 ID 后运行 `npm run cloudflare:check`。

- 整个目录可以直接打包交付，业务代码、样式、数据库结构和迁移文件都在仓库内。
- 也可以推送到 GitHub，再部署到支持 Cloudflare Workers、D1 和 R2 的环境。
- 图片文件位于 R2，作品资料位于 D1；迁移平台时需要另行导出这两部分线上数据。
- 作品后台可以直接导出 JSON 或 CSV 元数据，便于备份、整理和迁移。
- Archive & Handoff 会将作品、细节图、过程档案、系列、编排关系、材料档案、色卡图片、Look 用料、技术包修订、尺寸规格、工艺说明与技术图、试身场次、版型问题、私密试身影像、最终封样、封样核对与证据、生产放行包、准备核对、生产偏差与处置时间线、成衣验收与私密实物证据、溯源档案、作品养护报告与私密状态证据、展陈方案与私密试装证据、展期监测、现场观察与私密监测证据、设计评审及修改任务、Publication、保存的编辑排期、Private Showroom、专业回应、样衣借调、沟通留痕、实物资产、盘点记录、Placement 成果及证据图片、联系人、机会、互动待办、外联活动、对象审核、Editorial QA 和媒体对象清单合并为一份完整 JSON 交接数据包。
- 每个不可变交接快照都会保存当时的完整数据，并以 SHA-256 摘要校验结构化数据与媒体清单；快照只允许新增和下载，不提供修改或删除接口。
- 媒体对象清单可单独导出 UTF-8 CSV，包含稳定 R2 对象键、来源关系、内容类型、尺寸、图片描述、状态与访问路径，便于按清单复制到新的对象存储。
- 交接数据包不会把图片二进制塞进浏览器内生成大型 ZIP；正式迁移时应按媒体清单从 R2 批量复制对象，再将对象键映射到目标存储。
- 批量上传会按文件名创建独立草稿；替换主图不会改变作品链接、文字资料或发布状态。
- 每件作品可添加最多 12 张背面、侧面、工艺或面料细节图，并分别维护标签、无障碍描述与展示顺序。
- 每件作品可添加最多 24 条过程记录，覆盖研究、草图、材料、立裁、打版、试衣、制作与定型；每条可独立维护图片、说明、日期、排序和草稿/公开状态。
- 有公开过程记录的作品会自动获得独立 Process Dossier 页面，并在作品详情页显示入口；纯文字记录也会生成可阅读的编辑视觉。
- 系列与作品分层管理：同一批作品可以编入 Collection，单独维护系列内 Look 编号、排序、精选状态、封面、宣言与发布状态。
- 每个已编排系列自动生成独立 Digital Lookbook，支持方向键、滚轮、触控滑动、缩略图索引、造型进度及作品档案深链。
- 首页主视觉会优先使用已发布且标记为“首页主推”的系列；没有主推系列时继续使用内置的 SECOND SKIN 视觉内容。
- 每个系列可建立一份官方 Publication，统一维护新闻稿、发布日期、城市、制作署名、媒体联系人、SEO 标题及分享摘要。
- 发布前预检会核对系列状态、公开 Look、主视觉、新闻稿长度、发布日期、媒体邮箱、制作署名与 SEO 信息；可保存草稿、预约未来发布时间或立即公开。
- 公开内容进入独立 Press Room，提供媒体友好的发布详情、精选 Look、完整 Credits、打印/存为 PDF，以及纯文本与 JSON Press Kit 下载。
- Editorial Operations 会把作品、系列、过程记录和发布包汇总为四阶段工作管线，自动计算整体准备度并生成按优先级排列的质量检查队列。
- 统一视觉素材索引会聚合作品主图、细节图、过程图片与系列封面，支持按来源、状态和关键词筛选，并可直接回写名称、标签与无障碍描述。
- 素材索引不会复制图片或改变已有 R2 对象；它保留原有内容关系和链接，提供原图链接、来源定位、最近更新及空间占用统计。
- Editorial QA 报告可单独导出为 JSON，便于上线检查、内容交接和后续迁移。
- Editorial Calendar 将试衣、设计审阅、拍摄、Lookbook、媒体交付和正式发布保存为持久化排期，并支持月历、时间线、筛选、优先级、完成状态与逾期提示。
- 每个排期可关联系列、单件作品或 Publication；发布中心的定时发布时间会自动同步为不可重复的发布节点。
- 编辑日历可导出标准 iCal 文件，导入 Apple Calendar、Google Calendar、Outlook 或其他支持 `.ics` 的日历工具。
- Private Showroom 可以从统一作品库建立面向买手、造型师或媒体的独立选辑，维护 Look 顺序、会面专属说明、样衣状态、精选封面、受邀对象和联系信息。
- 每个私享展厅拥有独立的随机访问凭证；数据库只保存 SHA-256 哈希与末尾提示，设计师可轮换凭证使旧链接立即失效，并可设置到期时间、关闭访问和图片下载权限。
- 受邀页面默认禁止搜索引擎索引与外链 Referer，支持响应式浏览和浏览器打印 Line Sheet；系统不包含价格、购物车、下单或支付。
- 受邀方可以从 Private Showroom 选择 Look 并提交试衣、拍摄、媒体或买手需求；设计师在第 09 阶段审核、备注、筛选并导出专业回应。
- 已批准回应可在第 10 阶段转为样衣借调单，逐件维护样衣编号、尺码、状态、出库与归还品相，并记录寄送、签收、预计归还、逾期和异常。
- 第 11 阶段提供借调确认、寄送通知、签收确认、归还提醒、逾期跟进和异常沟通模板；它只生成、复制和记录文案，不会在未接入外部账号时自动发送。
- 沟通记录可区分草稿、已在外部发送、已获回复和已解决，并保存联系人、渠道、方向、沟通时间与下一次跟进日期；完整台账可导出 CSV。
- 第 12 阶段为每件实物样衣建立永久资产编号，并可绑定条码或 RFID 标签、对应作品、尺码、颜色、类别、部门、固定库位、当前位置、品相和可用状态。
- 实物资产可以分配到进行中的借调项；同一资产不能同时占用两条借调，寄出、在外、归还、损坏和遗失状态会同步回资产主表。
- 盘点会话支持按库位或部门限定范围，通过资产编号或标签登记现场位置与品相；结果区分位置一致、借出在外、库位不符、缺失和意外出现。
- 结束扫描后会生成差异队列，只有在确认差异并写回库位或缺失状态后才能完成盘点；库存总表和每次盘点结果均可导出 UTF-8 CSV。
- 第 13 阶段以已绑定实体资产且已经发出的借调项为唯一计算来源，提供 30、90、180、365 天和全部历史范围，不把尚未发生的预约误计为样衣使用。
- 使用效能报告包含样衣使用率、每件平均送出次数、总送出次数、未送出资产、平均归还天数、按时归还率、逾期与品相风险；支持按部门、系列、类别、目的地、颜色和用途交叉筛选。
- 单件排行区分高频流转、低频流转和尚未送出，需求压力以 Look 的送出次数除以实体资产数量计算，并显示当前可用件数，便于判断是否需要补样或调整预约顺序。
- 类别、部门、用途和目的地拆分、送出节奏、自动处置队列与完整 CSV 均由现有借调和资产数据即时生成，不写入新的不可逆分析数据；系统不会据此自动联系外部人员或改变资产状态。
- 详细指标口径与迁移注意事项见 [`docs/phase-13-sample-performance.md`](docs/phase-13-sample-performance.md)。
- 第 14 阶段将借出单和具体借调项连接到编辑大片、红毯、艺人造型、创作者内容、影视与现场活动成果，完整保留媒体/发布方、Voice、渠道、市场、日期和证据链接。
- 每条成果可关联一件或多件实际采用的 Look，并上传刊登截图或现场照片到 R2；证据图片继续受设计师身份保护，同时进入 Archive & Handoff 的媒体迁移清单。
- 借出覆盖率按“有已落地或已发布成果的借出单 ÷ 已送出借出单”计算，并另列每次借出成果数、证据覆盖率、渠道/媒体/Voice 排名与未关联证据。
- 触达、互动和影响值只接受人工或第三方填报，必须标注“填报”或“已核验”口径；已核验值需要来源，不同币种分开汇总，系统不会自行生成或冒充 Launchmetrics 的专有 MIV。
- Placement & Impact 台账及关联 Look 可导出 UTF-8 CSV，并随完整 JSON 归档。详细结构与指标口径见 [`docs/phase-14-placement-impact.md`](docs/phase-14-placement-impact.md)。
- 第 15 阶段把 Placement & Impact 的事实即时编排为 Seasonal Coverage Book，支持最近 90 天、最近一年、全部历史或自定义日期，并可按系列、渠道、成果类型、市场和落地状态交叉筛选。
- 覆盖册同时呈现送出覆盖率、证据覆盖率、Look 出现、已核验指标、填报触达与互动、月度节奏，以及媒体、人物、系列、渠道、类型和市场结构；所有结果均由原始事实即时计算，不新增不可逆汇总表。
- 每条成果以编辑式 Story 页面保留原始证据、媒体 / 人物上下文、关联借出单与 Look、指标来源和完整度提示；交付检查会集中列出缺少证据、日期、发布方、Look、借出关系或指标核验的记录。
- 当前筛选范围可导出 UTF-8 CSV 或完整 JSON，也可打开受设计师身份保护的 A4 覆盖册并直接打印或保存 PDF。详细口径与交付方式见 [`docs/phase-15-seasonal-coverage-book.md`](docs/phase-15-seasonal-coverage-book.md)。
- 第 16 阶段从展厅回应与已落地 Placement 中生成“事实候选”，但只有设计师点击确认后才会进入独立联系人库；来源记录始终保留，不会把曝光或机构自动转化为人物价值评分。
- 联系人档案分别维护类型、机构、市场、层级、联系渠道、联系边界、标签、最近互动与下次跟进；`请勿主动联系` 会在档案中持续以高优先级边界提示。
- 每个联系人可建立多条机会，按信号、确认、可沟通、沟通、样衣、执行、达成、未达成与暂缓阶段人工推进，并独立维护优先级、系列、市场、下一步和时间。
- 互动与待办作为第三类独立记录保存，可区分邮件、电话、会面、引荐、样衣、成果和内部备注；系统只做规划与留痕，不会自动发送邮件、消息或邀约。
- 工作台提供联系人目录、机会管线、逾期与未来七天队列、资料完整度和 CSV / JSON 导出。三类关系数据已纳入 `nera-archive/8` 快照和变更对比，详细结构见 [`docs/phase-16-relationship-opportunity.md`](docs/phase-16-relationship-opportunity.md)。
- 第 17 阶段把系列、Publication、Private Showroom、联系人和机会连接为专业外联活动；每个活动独立维护目标、语言、市场、核心信息、行动请求、保密截止与外联窗口。
- 活动对象必须逐位进入提议、人工批准、草稿、已登记外部发送、回复或跳过状态；`do_not_contact` 无法加入，联系边界未知、渠道缺失或档案停用的对象会被阻断。
- 草稿只在人工批准后按现有事实生成，可在 Studio 内校订与复制；系统没有发送按钮，也不连接邮箱或即时消息。私享展厅访问链接不会进入 API 草稿，必须由设计师在外部发送前手动补充。
- “已发送”和“已回复”都只允许在事实发生后人工登记，并同步为联系人互动记录；活动、对象和草稿可导出 CSV / JSON，完整数据已纳入 `nera-archive/9`。详细工作流与接口见 [`docs/phase-17-campaign-outreach.md`](docs/phase-17-campaign-outreach.md)。
- 第 18 阶段在 Studio 顶部提供 Season Control Tower：把系列、设计评审、发布、日历、展厅请求、样衣归还、盘点、关系行动与外联审核汇成同一张设计师作战图，并可按当前系列切换上下文。
- 二十六项事实关卡只使用明确的状态、数量与截止时间，逐项说明通过或阻塞原因；系列准备度也由“系列公开、Look 编排、Look 公开、发布包、发布安排”五个事实检查等权计算，不使用隐藏权重。
- 统一议程把逾期、今日、未来十四天和需要人工判断的事项排序后深链回原工作台；作战台本身只读，不自动改变状态、不发送外联，也不会向总览接口返回展厅令牌、邮箱或电话。
- 第 18 阶段本身不新增数据库表；当前 Studio Map 汇总 35 个业务工作台，完整归档结构已随第 36 阶段升级为 `nera-archive/27`。详细口径见 [`docs/phase-18-season-control-tower.md`](docs/phase-18-season-control-tower.md)。
- 第 19 阶段提供 Atelier Review Board，将概念、廓形、材料、试衣、工艺、造型与最终编辑评审关联系列或单件 Look，并把评审问题、观察记录、判断依据和明确结论分开保存。
- 每项评审只能由设计师人工选择 `通过 / 修改后复审 / 暂缓 / 退出本季`；非待定结论必须填写判断依据，仍有开放修改任务时不能关闭，系统不会自动评分或批准设计。
- 修改任务独立维护优先级、负责人、截止时间、执行说明和完成事实；近期评审、逾期任务、关键修改与等待复审信号会进入 Season Control Tower。
- 评审台提供评审 CSV、修改任务 CSV 和完整 JSON 导出，并随当前 `nera-archive/23` 快照、SHA-256 校验和变更对比迁移。结构与接口见 [`docs/phase-19-atelier-review-board.md`](docs/phase-19-atelier-review-board.md)。
- 第 20 阶段提供 Material Room，将梭织、针织、皮革、里料、辅料、五金与装饰材料建立为独立档案，分别保存成分、组织、颜色、色号、供应方、产地、克重、幅宽、手感、后整理、认证与设计备注。
- 材料色卡支持从 Studio 直接上传或无损替换到 R2；研究与打样材料的图片保持管理员可见，材料人工批准后可作为公开缓存媒体，全部对象键都会进入 Archive Media Manifest。
- 同一材料可以编入多个 Look，用途、部位、色彩、单件用量和状态独立维护。`Look 用料批准` 只能在材料档案已经批准后发生，选定材料早于档案批准时会进入 Season Control Tower 提醒，但不会被系统自动改变。
- 材料库、Look BOM 与完整 JSON 可分别导出；材料、用料关系与色卡媒体随当前 `nera-archive/23` 快照迁移。详细结构见 [`docs/phase-20-material-room.md`](docs/phase-20-material-room.md)。
- 第 21 阶段提供 Technical Atelier，为每个 Look 建立独立、不可覆盖的技术包修订，保存样衣阶段、基码、单位、版型意图、纸样编号、制作总述、放码、整理、标牌、包装与批准说明。
- 技术平面图可直接上传或替换到 R2；每个修订可维护尺寸点、目标值、正负公差、测量方法，以及缝型、针迹、收边、辅料、标牌、图案与包装工艺。
- 技术包必须拥有技术图、基码、版型意图、至少一个尺寸点和一条有效工艺说明，且没有开放的关键工艺风险，才允许由设计师批准；只有已批准版本可以锁定，系统不自动批准、锁定或覆盖历史修订。
- 技术包、尺寸规格、工艺说明可分别导出 CSV 或完整 JSON；全部记录、技术图对象键与快照数量随 `nera-archive/23` 迁移。详细结构见 [`docs/phase-21-technical-atelier.md`](docs/phase-21-technical-atelier.md)。
- 第 22 阶段提供 Fitting Room，让每一轮试身绑定具体技术包修订，分别记录样衣尺码、试身时间、地点、内部试穿参考、本轮目标、平衡、轮廓、动态、舒适度、审版结论与下轮安排。
- 每轮可上传最多 12 张正面、侧面、背面、细节或动态影像到 R2；全部影像始终保持设计师私密访问，不因试身批准而公开缓存，并以可追溯状态进入归档媒体清单。
- 版型问题分别保存部位、方向、观察事实、修改指令、POM 尺寸点、级别、负责人、截止时间与解决状态；开放的关键问题会阻止批准，并进入 Season Control Tower。
- 试身批准要求时间、尺码、目标、平衡判断、动态判断、结论与至少一张有效证据齐全，技术包至少进入评审，且设计师明确选择通过；批准后不可改写，后续修改必须建立下一轮。
- 试身场次、版型问题、证据清单可分别导出 CSV 或完整 JSON，并随当前 `nera-archive/23` 的快照、摘要与变更对比迁移。详细结构见 [`docs/phase-22-fitting-room.md`](docs/phase-22-fitting-room.md)。
- 第 23 阶段提供 Final Sample Gate：封样只能引用已批准或锁定的技术包及其最新批准试身，并为每个技术包保留不可覆盖的封样轮次。
- 新建封样时自动建立廓形、尺寸、材料、辅料、工艺、整理、颜色和标识八项人工核对；批准要求八项全部通过、技术包进入产前样或最终样、关键事实齐全且至少有两张私密证据。
- 封样批准只由设计师完成；批准后只能进一步生成唯一 `NERA-SEAL` 标识并永久冻结，系统不会创建采购单、生产单或自动通知任何外部人员。
- 签核、核对与证据索引可分别导出 CSV 或完整 JSON，私密证据进入 R2 媒体清单；完整交接格式当前为 `nera-archive/23`。详细结构见 [`docs/phase-23-final-sample-gate.md`](docs/phase-23-final-sample-gate.md)。
- 第 24 阶段提供 Production Release Desk：只能从带 `NERA-SEAL` 标识的产前样或最终样建立生产放行包，并自动创建封样实物、最终修订、放码、BOM、色彩、标识包装、质量与时间风险八项准备核对。
- 放行包分别维护执行方或版房、内部参考、尺码范围、生产色组、计划窗口、质量标准、包装说明、放行摘要与开放风险；八项全部 `ready`、开放风险清零且设计师明确选择 `release` 后，才能批准。
- 已批准放行包只能进一步生成唯一 `NERA-GO` 标识并永久冻结；系统不向任何外部人员发送信息，不生成采购单、生产订单或 ERP 记录。
- 放行包、准备核对可分别导出 CSV 或完整 JSON，并随当前 `nera-archive/23` 快照、摘要和变更对比迁移。详细结构见 [`docs/phase-24-production-release-desk.md`](docs/phase-24-production-release-desk.md)。
- 第 25 阶段提供 Production Change Control：只有已经生成 `NERA-GO` 的放行定义可以建立生产偏差，分别记录材料、色彩、工艺、尺寸、后整理、标识、包装、时间或其他实际变化。
- 每条偏差按 `报告 → 复核 → 决定 → 验证 → 关闭` 人工推进；设计师可以单次接受、要求返工、修改产品定义、拒绝或暂缓，形成决定后不可回写，修改定义必须在关闭前记录后续放行编号。
- 时间线独立保存复核、证据、反馈、决定和验证事实；高风险或逾期记录进入 Season Control Tower。系统不生成采购单、不写入 ERP、不向工厂发送消息，也不会把单次接受静默写回封样或技术包。
- 偏差主档、人工时间线可分别导出 CSV 或完整 JSON，并随 `nera-archive/23` 快照、摘要和变更对比迁移。详细结构见 [`docs/phase-25-production-change-control.md`](docs/phase-25-production-change-control.md)。
- 第 26 阶段提供 Edition Acceptance：只有有效 `NERA-GO` 可以建立成衣验收轮次，分别记录成衣版号、颜色、尺码范围、到达与抽检数量、时间、实物位置和验收标准。
- 新建验收自动生成身份、材料色彩、尺寸、工艺、后整理、标识、包装和数量八项人工核对；通过要求八项全部通过、关键事实齐全、至少一张私密实物证据，且没有未关闭的高风险生产偏差。
- 通过后生成唯一 `NERA-ACCEPT` 标识并永久冻结；返工、暂缓或拒收同样形成不可覆盖的人工结论。系统不生成采购、订单、库存或工厂 ERP 数据。
- 验收主档、核对与证据索引可分别导出 CSV 或完整 JSON，私密证据进入 R2 媒体清单；完整交接格式当前为 `nera-archive/23`。详细结构见 [`docs/phase-26-edition-acceptance.md`](docs/phase-26-edition-acceptance.md)。
- 第 27 阶段提供 Provenance Dossier：只有带 `NERA-ACCEPT` 的已验收实物版本可以建立公开档案修订，分别整理设计故事、材料披露、制作信息、制作地点与日期、护理和修复建议。
- 新建档案自动生成作品身份、签核来源、材料、制作、护理与公开文案六项人工核对；只有资料完整、六项全部通过且设计师明确选择发布时，才会生成公开 `/provenance/[slug]` 页面。
- 公开页只复用作品的公开主图，不读取或暴露验收阶段的私密 R2 证据；已发布修订不可原地改写，只能退役后建立下一版。档案不记录购买者、库存、订单，也不冒充第三方法规认证。
- 溯源档案与核对可导出 CSV 或完整 JSON，并随 `nera-archive/23` 快照、摘要和变更对比迁移。详细结构见 [`docs/phase-27-provenance-dossier.md`](docs/phase-27-provenance-dossier.md)。
- 第 28 阶段提供 Conservation Atelier：从真实样衣资产建立不可覆盖的养护报告修订，记录检查时间与地点、总体状态、处置建议、操作限制、保存环境和下一次复查时间。
- 每份报告自动建立结构、表面、缝线、开合、装饰和标识六项人工检查，可上传最多 12 张始终私密的状态证据；未解决的高风险问题与逾期复查进入 Season Control Tower。
- 报告只有在关键事实、六项检查、至少一张证据与人工决定齐全时才可批准；批准后冻结，后续变化建立新修订。系统不会自动改变资产状态、生成维修订单或扩展到库存与 ERP。
- 报告、检查与证据索引可分别导出 CSV 或完整 JSON，并随 `nera-archive/23` 快照、SHA-256 摘要和变更对比迁移。详细结构见 [`docs/phase-28-conservation-atelier.md`](docs/phase-28-conservation-atelier.md)。
- 第 29 阶段提供 Exhibition Readiness：只有已批准或已关闭的养护事实可以建立展陈方案，并分别记录展示用途、地点、安装与撤展窗口、展示方式、支撑、穿装和应急边界。
- 每份方案自动生成养护准入、支撑受力、光照曝光、温湿度、搬运安装、公众安全和撤展回库七项人工核对，可上传最多 12 张始终私密的试装或环境证据。
- 设计师可以人工选择可展示、限制展示、暂缓或不宜展示；关键条件阻塞、临近安装未批准和逾期撤展进入 Season Control Tower。批准后冻结，不自动更新资产、不生成票务、场馆订单或外部通知。
- 方案、核对与证据索引可分别导出 CSV 或完整 JSON，并随 `nera-archive/23` 快照、SHA-256 摘要和变更对比迁移。详细结构见 [`docs/phase-29-exhibition-readiness.md`](docs/phase-29-exhibition-readiness.md)。
- 第 30 阶段提供 Exhibition Watch：从已批准展陈方案开启在展监测，记录照度、紫外线、温湿度、品相、支撑、虫害、现场事件与人工处置；每条观察不可覆盖。
- 系统只标出超出批准范围、检查逾期或最新异常；继续、限制、暂停、养护复核和立即撤展都必须由设计师或养护负责人明确选择。
- 监测、观察与私密证据可分别导出 CSV 或完整 JSON，并随 `nera-archive/23` 快照、摘要与变更对比迁移。详细结构见 [`docs/phase-30-exhibition-watch.md`](docs/phase-30-exhibition-watch.md)。
- 第 31 阶段提供 Exhibition Recovery：只从已撤展且完成离场状态的监测记录建立展后接收，分别记录包装、运输、开箱、支撑拆除、展后品相、静置、养护分流与最终保存位置。
- 每条复原记录自动建立交接、包装、品相、支撑、稳定化和保存六项人工核对；至少一张私密接收证据、关键事实与去向齐全后，才能人工回库放行或转交养护，并永久冻结结论。
- 复原、核对与私密证据可分别导出 CSV 或完整 JSON，完整交接格式升级为 `nera-archive/23`。详细结构见 [`docs/phase-31-exhibition-recovery.md`](docs/phase-31-exhibition-recovery.md)。
- 第 32 阶段提供 Archive Curation：从真实实物档案建立策展项目，分别维护命题、目标观众、空间场景、叙事结构、选择原则与展期窗口。
- 每件候选作品独立保存纳入、备选、暂缓或排除结论，以及叙事角色、顺序、选择依据和展示意图；最新养护、在展状态与展后复原会形成透明边界，但不会自动选片。
- 策展项目至少包含两件安全可用的纳入作品和一个叙事锚点，事实与人工依据齐全后才能批准并冻结；项目与选择可导出 CSV 或完整 JSON，并随当前归档迁移。详细结构见 [`docs/phase-32-archive-curation.md`](docs/phase-32-archive-curation.md)。
- 第 33 阶段提供 Exhibition Interpretation：只能从已批准或已关闭的冻结策展项目建立不可覆盖的释读修订，并按全部纳入作品生成逐件标签。
- 入口导语、章节叙事、双语文本、作品事实、署名、来源、权利状态和无障碍描述分别保存；系统不自动撰写、翻译、公开或改写原始档案。
- 只有所有章节与作品标签齐全、权利完成核对且设计师明确批准时才会冻结释读修订；释读包、章节和标签可分别导出 CSV 或完整 JSON，并随当前归档迁移。详细结构见 [`docs/phase-33-exhibition-interpretation.md`](docs/phase-33-exhibition-interpretation.md)。
- 第 34 阶段提供 Exhibition Delivery Desk：只能从已批准或已关闭的冻结释读修订建立交付包，并自动展开入口导语、章节、作品标签、署名、无障碍与权利说明的全部来源项。
- 每项交付分别确认语言、载体、位置、版式要求、校样状态、校样依据与交接备注；来源文字始终从冻结释读读取，不复制成可静默改写的第二份文案。
- 所有来源均完成就绪校样、交付标准齐全且设计师明确放行后才能冻结交付主档；交付包与校样项可导出 CSV 或完整 JSON，完整交接格式升级为 `nera-archive/25`。详细结构见 [`docs/phase-34-exhibition-delivery.md`](docs/phase-34-exhibition-delivery.md)。
- 第 35 阶段提供 Exhibition Installation Gate：只能从已批准或已关闭的冻结交付主档建立装校修订，并按全部交付项自动生成现场核对清单。
- 每项现场核对分别记录实际位置、格式尺寸、观察依据、整改动作与人工结果；可上传最多 16 张始终私密的展区整体、墙文、标签、导览、无障碍、权利或细节证据。
- 只有全部交付项均与主档相符、现场事实与证据齐全且设计师明确验收后才能冻结；系统不自动安装、发布、通知场馆或声称展览已开放。装校签核、核对和证据随 `nera-archive/26` 迁移。详细结构见 [`docs/phase-35-exhibition-installation.md`](docs/phase-35-exhibition-installation.md)。
- 第 36 阶段提供 Exhibition Opening Gate：从同一策展项目的已批准装校签核建立开放修订，自动带入全部纳入作品，并要求每件作品绑定同一实物的冻结展陈方案。
- 只有策展、展陈、装校、展期、运行、人员交接、无障碍、事件升级和紧急暂停事实全部成立，且设计师明确选择 `open` 后才能冻结内部开放授权；系统不自动公开网站、售票、通知场馆或声称展览已经对外开放。开放签核与作品核对随 `nera-archive/27` 迁移。详细结构见 [`docs/phase-36-exhibition-opening.md`](docs/phase-36-exhibition-opening.md)。
- 当前 Sites 访问策略仍是设计师本人可访问。要把私享链接发送给外部买手或媒体，需要先由站点所有者明确将站点访问范围调整为可访问；应用层访问凭证仍会继续保护每个展厅。
- JSON 导出同时包含系列、系列内编排、作品图库、完整过程档案和 Publication 发布资料；CSV 包含系列关联字段、过程页链接及过程图片清单，便于迁移到其他 CMS。
- 迁到 GitHub 后继续部署 Cloudflare Workers 是最直接的路径；如果改用 Vercel，前端页面、React 组件、Drizzle 表结构和业务模型可以继续使用，但需要把 D1/R2 运行时绑定替换为目标数据库与对象存储适配器。
- 管理员邮箱通过运行环境中的 `ADMIN_EMAILS` 配置，不写入源码。

本地启动需要 Node.js `>=22.13.0`，执行 `npm ci` 后运行 `npm run dev`。独立 Cloudflare 本地环境使用 `npm run dev:cloudflare`。本地示例环境变量见 `.env.example`。

## 项目规则与开发流程

- [`AGENTS.md`](AGENTS.md)：品牌、设计、架构、数据库、上传、安全、测试与交付规则。
- [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md)：从需求、分支开发、Pull Request、CI 到 Sites 发布、备份和迁移的完整流程。
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml)：GitHub Pull Request 与 `main` 分支的自动质量检查。

## Starter notes

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
