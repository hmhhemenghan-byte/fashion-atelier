# NÉRA ATELIER 独立 Cloudflare 部署与迁移

这条部署线让同一份源码脱离 ChatGPT Sites 后直接运行在 Cloudflare Workers。默认 `npm run dev`、`npm run build` 和 `.openai/hosting.json` 仍属于 Sites；独立版只在设置 `NERA_DEPLOY_TARGET=cloudflare` 的脚本中读取 `wrangler.cloudflare.json`，两者不会互相覆盖。

## 1. 最终架构

| 能力 | Cloudflare 服务 | 代码绑定 |
| --- | --- | --- |
| Next/Vinext 页面与 API | Workers + Static Assets | `ASSETS` |
| 作品、系列、Studio 业务数据 | D1 | `DB` |
| 原图与私密证据 | R2 | `BUCKET` |
| 响应式图片处理 | Cloudflare Images binding | `IMAGES` |
| 后台登录 | Cloudflare Access | Access JWT |
| 管理员名单 | Worker secret/variable | `ADMIN_EMAILS` |

应用在独立模式下会验证 `Cf-Access-Jwt-Assertion` 的签名、Issuer 和 Audience，不会直接信任客户端可伪造的邮箱 Header。Sites 模式保持原有 ChatGPT 身份流程。

## 2. 推荐域名边界

迁移初期最稳妥的做法，是先用 Cloudflare Access 保护整个预发布域名，确认数据和媒体完整后再开放。

准备公开展示时，建议使用两个主机名指向同一个 Worker：

- `www.example.com`：公开作品展示。
- `studio.example.com`：整个主机名由 Cloudflare Access 保护，设计师从这里进入 `/studio`，私密媒体请求也继续携带 Access 身份。

不要只保护 `/studio` 而忽略同源的私密媒体和 Studio API；那会让后台页面登录成功，但私密 R2 图片请求没有可验证身份。若只使用一个域名，发布前必须逐条设计 Access Path Policy，覆盖后台页面、后台 API 与所有私密媒体请求。

## 3. 准备资源

1. 安装 Node.js `>=22.13.0`，在源码目录执行 `npm ci`。
2. 在 Cloudflare 创建 D1 数据库，建议名称 `nera-atelier-prod`。
3. 创建一个私有 R2 bucket；不要为原图启用公共 `r2.dev` URL。
4. 创建 Worker，或让首次 Wrangler 发布创建它。
5. 在 Zero Trust 创建 Self-hosted Access application，记录 Team domain 与 Application Audience (AUD) Tag。
6. Access Allow policy 只包含实际设计师邮箱或组织身份组。

## 4. 填写独立配置

编辑 `wrangler.cloudflare.json`，替换 D1 UUID、R2 bucket 名称、`TEAM_DOMAIN` 和 `POLICY_AUD`。不要改绑定名 `DB`、`BUCKET`、`ASSETS`、`IMAGES`，业务代码依赖这些稳定名称。然后运行：

```bash
npm run cloudflare:check
```

该命令会检查四个绑定、Access 模式、Sites 配置隔离、迁移目录和占位值。仓库模板本身使用 `npm run cloudflare:check-template` 做非生产检查。

## 5. 管理员邮箱

`ADMIN_EMAILS` 是逗号分隔的管理员邮箱，必须与 Access 验证后的邮箱一致。推荐通过 Worker Settings > Variables and Secrets 设置；不要把真实邮箱名单或任何令牌提交到 Git。

## 6. D1 结构与数据

先备份旧环境，再迁移。仓库 `drizzle/` 中的 SQL 是完整前向迁移历史，不能修改旧文件。新库先执行：

```bash
npx wrangler d1 migrations apply nera-atelier-prod --remote --config wrangler.cloudflare.json
```

随后导入旧 D1 数据。Archive & Handoff JSON 是业务级交接包和核验依据，但当前代码没有提供“把整个交接包一键写回生产库”的危险导入按钮；正式搬迁应使用受审阅的 D1 SQL export/import，或编写一次性、可回滚的导入程序。导入前后比较各业务表行数、关键 ID、发布状态与交接快照摘要。数据库迁移是独立的有状态动作，部署脚本不会自动执行。

## 7. R2 图片迁移

在旧 Studio 的 Archive & Handoff 下载完整 JSON 和媒体 CSV。先检查 JSON：

```bash
npm run handoff:check -- ./nera-full-handoff.json
```

按照 `mediaManifest` 的 `objectKey` 原样复制 R2 对象。不要在复制时重命名、压缩或转码，因为 D1 中保存的是稳定对象键。迁移后核对对象总数、可获得的字节数/ETag，并抽样公开主图、材料色卡、技术图、试身证据和封样证据；私密对象在未通过 Access 时必须不可读取。

## 8. 本地验证与发布

```bash
npm run dev:cloudflare
npm run build:cloudflare
npm run deploy:cloudflare
```

发布脚本顺序是生产配置预检、Vite/Workers 构建、Wrangler 部署。Cloudflare Vite 会生成指向编译产物的输出 Wrangler 配置；发布使用这个输出，而不是把 TypeScript 源入口当成普通 Worker 再打一次包。

## 9. 上线验收

1. 首页、Collection、Lookbook、Press 与作品详情可读取。
2. 未授权账号无法进入 Studio；授权邮箱可以进入并正确退出。
3. 新增草稿、上传、替换图片和发布状态写入正常。
4. 公开媒体可读取，私密媒体只对授权设计师可见。
5. D1 写入后刷新仍存在，R2 对象和 D1 关系一致。
6. Archive & Handoff 可重新生成，媒体清单与迁移前基线相符。
7. Workers Logs 中没有持续的身份或绑定错误。

## 10. 切换与回滚

先用临时域名或低 TTL 子域名验证，再切换正式 DNS。迁移窗口内把旧环境视为只读，避免两边同时写入造成分叉。

若登录失败、私密媒体泄露、关键数据缺失或上传后对象悬空，立即切回旧路由、停止新环境写入，并保留新 D1/R2 快照分析差异，不要直接删除。源码回滚不能代替数据回滚；每次上线记录 Git commit、Worker version、D1 backup 时间、R2 manifest 摘要和 Access policy 版本。

## 11. 仍需要账户内完成的事项

源码已提供双部署入口和安全验证逻辑，但以下值只能由你的 Cloudflare 账户产生：D1 UUID、R2 bucket 名称、Access Team Domain、AUD Tag、允许登录的设计师邮箱，以及最终域名/DNS。没有这些账户级信息，源码包不会自动发布到生产。
