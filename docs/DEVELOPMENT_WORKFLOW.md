# NÉRA ATELIER Development Workflow

本文定义从需求进入、开发、评审到 Sites 发布和灾备交接的标准流程。

## 1. 工作流总览

```text
需求与边界确认
  → 影响分析
  → 分支开发
  → 本地验证
  → Pull Request
  → CI 检查
  → 人工评审
  → Sites 版本保存
  → 生产发布
  → 发布后核验与归档
```

所有阶段遵循仓库根目录的 [`AGENTS.md`](../AGENTS.md)。

## 2. 需求进入

每项需求开始前写清：

1. 用户目标和使用者。
2. 涉及页面、API、数据表、D1、R2 或权限的范围。
3. 是否影响公开内容、私密证据、人工审批或线上数据。
4. 验收标准、异常状态和不在本次范围内的内容。

以下变化必须先明确方案再开发：

- 数据删除、字段收缩或历史记录重写。
- 公开范围、身份策略或 Private Showroom 凭证变化。
- 自动发送外部消息、自动批准或连接第三方系统。
- D1/R2 迁移、平台迁移或大批量媒体替换。

## 3. 分支与提交

从最新 `main` 创建分支：

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

分支命名：

- `feature/...`：新功能
- `fix/...`：缺陷修复
- `docs/...`：文档与规则
- `chore/...`：工具、依赖或非业务维护

提交应小而完整，例如：

```text
Add production exception evidence validation
Fix showroom token expiry handling
Document D1 and R2 migration procedure
```

## 4. 本地环境

要求 Node.js `>=22.13.0`，首次安装：

```bash
npm run install:ci
```

准备本地变量：

```bash
cp .env.example .env.local
```

不要把真实邮箱、密钥或生产值写回 `.env.example`。

启动开发环境：

```bash
npm run dev
```

当前项目使用 Cloudflare D1 和 R2 运行时绑定。迁移到 Vercel 之前，必须先替换 D1/R2 适配层，不能把现有部署当作纯静态 Next.js 项目直接迁移。

## 5. 按变更类型开发

### 5.1 页面与视觉

1. 先复用现有页面结构、设计变量和交互模式。
2. 同时实现桌面、移动、键盘焦点、加载、空数据和错误状态。
3. 图片维护准确 `alt`，表单拥有可见标签和错误提示。
4. 涉及视觉的 PR 附带关键页面截图，并说明响应式结果。

### 5.2 API 与业务规则

1. 路由入口执行服务端身份校验。
2. 使用 `lib/` 中的输入解析与业务函数，拒绝未知字段。
3. 明确处理 `400`、`401/403`、`404`、冲突和 `500` 场景。
4. 不把隐私数据、令牌或内部异常栈返回给浏览器。
5. 新增或改变导出结构时同步更新 Archive & Handoff。

### 5.3 D1 数据结构

1. 修改 `db/schema.ts`。
2. 运行：

   ```bash
   npm run db:generate
   ```

3. 审阅新 SQL 和 `drizzle/meta/` 快照。
4. 验证旧数据、空值、默认值、索引和唯一性约束。
5. 不修改历史迁移；纠错使用新的迁移。
6. PR 中写清前向迁移、回填、回滚和备份要求。

### 5.4 R2 图片上传

1. 服务端校验管理员身份、MIME 类型、文件大小和数量。
2. 生成稳定且不会碰撞的对象键。
3. 上传 R2 后再持久化 D1 关系；失败时避免孤立对象或悬空记录。
4. 保存标题、描述、`alt`、排序、业务来源和公开状态。
5. 私密证据保持受保护访问，并进入媒体迁移清单。
6. 替换操作保留作品、Look、技术包或证据关系。

## 6. 本地质量门禁

提交前运行：

```bash
npm run lint
npm test
```

其中 `npm test` 已包含：

- Vinext 生产构建。
- Sites Worker 产物与 hosting manifest 验证。
- 渲染 HTML 测试。

数据库变更还要人工审阅迁移 SQL。上传功能需要验证：

- 合法图片。
- 错误类型与超限文件。
- 未登录和无权限请求。
- R2 或 D1 失败后的数据一致性。
- 图片替换、删除和归档清单。

## 7. Pull Request

PR 描述至少包含：

```markdown
## 目标

## 变更范围

## 不在范围内

## 数据库 / R2 影响

## 权限与隐私影响

## 验证结果

## 界面截图

## 发布与回滚
```

合并条件：

- GitHub CI 通过。
- 需求方或维护者完成人工评审。
- 数据迁移和权限风险已说明。
- 没有调试日志、临时文件、密钥和线上数据。
- 视觉变化经过桌面与移动端检查。

## 8. GitHub CI

`.github/workflows/ci.yml` 会在 Pull Request 和 `main` 推送时：

1. 使用锁定版本的 Node.js。
2. 通过 lockfile 安装依赖。
3. 执行 ESLint。
4. 执行生产构建、Sites 产物验证和渲染测试。

CI 通过表示代码达到合并门槛，不等于已经部署生产环境。

## 9. Sites 发布

发布必须基于已经通过评审和 CI 的确定 commit：

1. 确认工作区无未提交变更。
2. 构建并验证与该 commit 对应的 Sites 产物。
3. 保存不可变 Sites 版本。
4. 将该版本部署到生产环境。
5. 等待部署状态成功后记录版本号、commit 和生产地址。
6. 验证首页、Studio 登录、关键读写接口以及 D1/R2 绑定。

不要从未提交的工作区、不同 commit 的压缩包或未保存版本直接发布。

## 10. 发布后核验

至少检查：

- 首页和公开作品页面可访问。
- Studio 权限仍只授予预期设计师。
- D1 读取与写入正常。
- R2 图片读取、上传和替换正常。
- Private Showroom 仍保持凭证与到期控制。
- 关键导出文件可生成，且不泄露私密字段。
- 没有新增浏览器控制台错误或服务端敏感日志。

若发现严重问题，停止继续写入，回退到上一个已验证 Sites 版本；涉及数据结构时按照迁移方案恢复，而不是只回退前端代码。

## 11. 版本、备份与迁移

源码发布和线上数据备份是两套交付：

### 源码交付

- Git commit 与可选 Git bundle。
- `package.json` 和 `package-lock.json`。
- `.openai/hosting.json`。
- `db/schema.ts`、全部 Drizzle 迁移和元数据。
- 应用、Worker、脚本、测试和文档。

### 线上数据交付

- Archive & Handoff 完整 JSON。
- D1 数据库导出。
- R2 媒体清单。
- 按清单复制的 R2 对象。
- 环境变量名称清单；密钥通过安全渠道单独迁移。

每次重要发布记录源码 commit、Sites 版本、D1 备份时间和 R2 清单摘要，才能形成可恢复的完整版本。

## 12. 完成与交接

功能交付时说明：

- 实现了什么。
- 修改了哪些页面、API 和数据结构。
- 如何验证。
- 是否需要迁移或配置环境变量。
- 如何发布和回滚。
- 哪些工作明确留到下一阶段。

## 13. 独立 Cloudflare 发布线

独立发布不改写 Sites 的 `.openai/hosting.json`，使用单独的
`wrangler.cloudflare.json`。变更独立部署能力时至少执行：

```bash
npm run cloudflare:check-template
npm run build:cloudflare
```

真实资源配置完成后，发布前执行：

```bash
npm run cloudflare:check
npx wrangler d1 migrations apply nera-atelier-prod --remote --config wrangler.cloudflare.json
npm run deploy:cloudflare
```

`deploy:cloudflare` 会先拒绝占位资源 ID，再生成 Cloudflare Vite 的生产产物，最后让 Wrangler 使用构建生成的重定向配置发布。D1 迁移是有状态操作，必须先导出备份并人工确认；部署脚本不会替用户自动执行数据库迁移。
