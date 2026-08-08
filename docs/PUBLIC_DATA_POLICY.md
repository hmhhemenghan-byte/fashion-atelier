# NÉRA ATELIER — Public Data & Archive Publication Policy

## 1. 概述与核心原则 (Overview & Core Principles)

NÉRA ATELIER 采用**显式正向白名单（Positive Allowlist）**与**服务端数据库级别 404（Server-Side Database 404）**数据隔离策略。

所有向非鉴权公共视角（Public Visitors, Digital Lookbook, Public Archive）暴露的数据，必须经过专门设计的公共适配层（Public Archive Adapters）进行字段白名单过滤。系统严禁直接将数据库原始模型（ORM Entities / Schema Models）透传至前端。

---

## 2. 6 大核心档案实体的发布条件 (Publication Eligibility Criteria)

| 实体类型 | 数据库表 | 唯一判断标准 / 发布条件 | 失败/非公开表现 |
| :--- | :--- | :--- | :--- |
| **Work** | `works` | `status = 'published'` | HTTP 404 (Not Found) |
| **Collection** | `collections` | `status = 'published'` | HTTP 404 (Not Found) |
| **Material** | `materials` | `status = 'approved'` | HTTP 404 (Not Found) |
| **Technical Pack** | `technical_packs` | `status IN ('approved', 'locked')` **且** 关联作品 `work.status = 'published'` | HTTP 404 (Not Found) |
| **Provenance Dossier** | `provenance_dossiers` | `status = 'published'` **且** `production_acceptances.status = 'accepted'` 并且包含 `acceptance_seal` **且** 关联作品 `work.status = 'published'` | HTTP 404 (Not Found) |
| **Conservation Report** | `conservation_reports` | `status IN ('approved', 'closed')` | HTTP 404 (Not Found) |

---

## 3. 字段白名单与隐私保护策略 (Allowlist & Canary Protection)

### 3.1 严格绝不暴露给公共视角的敏感字段 (Never Exposed to Public)
- **内部人员与身份 ID**：`createdBy`, `updatedBy`, `approvedBy`, `reviewedBy`, `publishedBy`, `closedBy`
- **商业与供应商隐私**：`supplierName`, `supplierReference`, `unitCost`, `moq`, `leadTimeDays`, `internalNotes`
- **内部签核与记录细节**：`productionAcceptanceId`, `approvalNote`, `sampleAssetId`, `fittingNotes`
- **技术与对象存储内部键**：私密 R2 对象键、展厅 Token 哈希、内部日志及异常栈

### 3.2 金丝雀保护测试 (Canary Protection & Unit Verification)
所有适配层测试（`tests/public-archive-policy.test.mjs`）均包含** Canary Key Verification**。测试将在源数据中注入预设的敏感 Canary 字符串（如 `SECRET_SUPPLIER_EMAIL`, `PRIVATE_COST_999`, `CONFIDENTIAL_FITTING_NOTE` 等），并验证经过 `toPublicDocument()` 转换后的 JSON 字符串中**绝对不包含**任何 Canary 敏感信息。

---

## 4. 404 语义与安全审计 (404 Semantics & Security Boundary)

1. **统一 404 隐藏**：若请求的实体不存在、处于草稿/退役状态，或未满足发布条件，服务端逻辑统一返回 `null` 并触发 HTTP 404，不给未经授权者暴露“记录存在但拒绝访问”的信息区别（防止资源枚举）。
2. **零前端过滤**：公共 API 与 Server Components 不依赖前端 CSS 隐藏或条件渲染来保护敏感字段；所有白名单过滤必须在 API 路由或服务端适配器逻辑中完成。
