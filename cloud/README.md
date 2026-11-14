# 加密进度同步后端

Cloudflare Worker 为静态 GitHub Pages 网站提供可选的密文进度存储。浏览器通过私人配对码派生独立的认证令牌和 AES-256-GCM 密钥；Worker 不接收配对码或加密密钥，也不能读取课程笔记或答案。

**状态：本次文档更新时，生产部署尚未验证。** 下面是配置资料和部署检查步骤，不能据此认定服务已经上线。

## 配置与部署

预期 Worker 名称：`saa-progress-sync`。预期公开地址：`https://saa-progress-sync.curtis-atiwatt.workers.dev`；应以 Cloudflare 实际部署返回的地址为准。

现有 Cloudflare 资源标识如下，均为非秘密的资源 ID：

| 项目 | 值 |
| --- | --- |
| Account ID | `062cd27f59034e0d8a8c78d3e127eb39` |
| D1 database ID | `fec07a3b-56c4-4e96-b116-b923cfb35d28` |
| Worker D1 binding | `DB` |
| Compatibility date | `2026-11-13` |

通过 Cloudflare 控制台或已授权连接器执行：

1. 在对应 D1 数据库执行 [schema.sql](schema.sql)，创建 `progress`、`create_limits` 及窗口索引。脚本使用 `IF NOT EXISTS`，可重复执行创建步骤；它不是已有不同 schema 的迁移工具。
2. 将 [worker.js](worker.js) 作为 ES module Worker 部署，设置兼容日期 `2026-11-13`。运行代码不依赖 Node.js built-ins，不需要 `nodejs_compat`。
3. 将上表 D1 数据库以准确名称 `DB` 绑定到 Worker。开启 Workers Logs 和 Traces；代码仅写固定结构的故障事件，不记录请求头、令牌、IP、密文或数据库错误正文。
4. 确认公开路由实际启用，验证 `/health`、真实 D1 创建/读取/CAS 更新、允许来源的 CORS，以及浏览器两设备配对。
5. 将验证后的服务基础地址写入前端 `sync-config.js` 的 `SYNC_ENDPOINT`，然后正常构建并发布 GitHub Pages。

后端工具链隔离在 `cloud/` 子项目，使用 `cloudflare.config.ts` 和 cf CLI，不创建 Wrangler 配置。`cloud/package-lock.json` 固定工具版本，构建只产生 API Worker，不包含网站静态资源。GitHub Pages Actions 不部署 Worker，也不会初始化 D1。不要向 Git、Pages 静态文件或 Worker 源码添加账户 API token、配对码或加密密钥。

### CLI 构建与发布

cf 工具链要求 **Node.js 22.18.0+**；根目录前端/单元测试要求仍为 22.13.0+。从仓库根目录运行：

```bash
npm ci --prefix cloud
CF_SEND_TELEMETRY=false npm --prefix cloud run build
CF_SEND_TELEMETRY=false npm --prefix cloud run check:deploy
```

已在本地完成构建与 dry run：单个 Worker bundle 约 12 KiB，配置仅绑定上表 D1 数据库。Dry run 不上传文件、不调用部署 API，也不能证明真实账户权限或运行状态。产物在 `cloud/.cloudflare/output/v0/`，未跟踪到 Git。

当前 cf 0.15.0 自带的本地 workerd 最高支持 `2026-09-30`，因此直接对 `2026-11-13` 运行本地 startup check 会报兼容日期过新。已用临时产物副本和旧日期验证代码能够启动；生产配置及正式产物保持 `2026-11-13`。这项临时检查不替代生产运行验证。

当维护者需要授权发布时，可以使用单独命名的 cf OAuth profile，并在浏览器亲自确认权限：

```bash
cd cloud
CF_SEND_TELEMETRY=false ./node_modules/.bin/cf auth create saa-deploy --no-browser --scopes account-settings.read workers-scripts.read workers-scripts.write d1.write workers-observability.write
```

CLI 自动附加 `offline_access` 以续期授权。这些权限服务于账户识别、Worker 读取/发布、D1 绑定与可观察性配置，不需要 GitHub 安装或仓库授权。授权应在 Cloudflare 页面完成，不要复制令牌到聊天或源文件。完成授权后，发布已经检查的同一份产物：

```bash
CF_SEND_TELEMETRY=false ./node_modules/.bin/cf deploy --prebuilt --mode production --profile saa-deploy
```

生产验证完成前，不要将文档中的“尚未验证”改为“已上线”。

## API 协议

除健康检查和预检外，使用 `Authorization: Bearer <token>`。令牌必须是规范的无填充 base64url 编码，43 字符，解码后 32 字节。数据库主键是令牌文本的 SHA-256 十六进制摘要；数据库不保存原始令牌。令牌提供空间读写授权，加密密钥是独立派生值。

| 方法与路径 | 请求 | 成功响应 |
| --- | --- | --- |
| `GET /health` | 无需认证 | `200`，`{ok:true,service:"saa-progress",version:1}` |
| `GET /v1/progress` | Bearer token | `200`，`{revision,payload,updatedAt}` |
| `POST /v1/progress` | JSON `{payload}` | `201`，初始 `revision:1` |
| `PUT /v1/progress` | JSON `{payload,revision}` | `200`，匹配当前版本时更新并返回版本加一 |
| `OPTIONS` | 合法跨域预检 | `204` |

密文结构为 `{version:1,iv:"...",ciphertext:"..."}`：IV 是 12 字节的规范无填充 base64url；密文同样使用 base64url，至少包含 16 字节 AES-GCM 认证标签。服务端只能验证结构和大小，无法验证密文是否能解密；真实性在浏览器解密时校验。

错误均为 JSON `{error,code}`。主要状态：无效认证 `401`、字段/编码校验失败 `400`、未允许来源 `403`、不存在空间 `404`、创建冲突或旧 revision 写入 `409`、大小超限 `413`、不支持媒体类型/压缩 `415`、限流 `429`、存储不可用或总容量满 `503`。`429` 带 `Retry-After` 秒数；存储故障与容量错误也给出重试提示。`409` 客户端应读取最新密文、解密合并后再次按新 revision 更新，不能直接覆盖。

所有进度响应设置 `Cache-Control: no-store`；不使用 Cookie 或 credentialed CORS。CORS 只允许以下精确来源：

- `https://curtisatiwatt.github.io`
- `http://127.0.0.1:4187`
- `http://localhost:4187`

没有 `Origin` 的非浏览器请求仍可携带合法 Bearer token 访问。CORS 是浏览器来源约束，不是身份认证，也不把 GitHub 同一来源下的不同项目路径隔离为不同安全主体。

## 限制和存储行为

- 请求体按实际流式字节数限制为 1.5 MiB，不只信任 `Content-Length`。
- 密文解码后最多 1 MiB（含认证标签），IV 固定 12 字节。
- 每个已存在空间最多 120 次请求/固定分钟窗口，创建计一次。不存在空间的 GET/PUT 不插入占位或限流行。
- 每 IP 每固定小时最多 5 次有效创建尝试。应用仅保存与小时窗口关联的 SHA-256 IP 标识，并在下一次有效创建时清理旧窗口；不保存原始 IP。
- 最多 1000 个空间。创建限流更新和带容量条件的 INSERT 位于一个 D1 batch 事务中，防止并发超限。
- PUT 使用 `UPDATE ... WHERE revision = ?`，并检查 `meta.changes`，防止两个客户端同时覆盖同一版本。

IP 哈希不是不可逆匿名化保证。应用层限流也不代替 Cloudflare 平台的流量保护、额度和费用管理。没有账户登录、找回配对码或空间删除 API；断开客户端不会删除密文或使已泄露的配对码失效。这个服务以持有码为授权模型，不应存放 AWS 密钥或其他高敏感信息。

## 测试与部署后验证

需要 Node.js **22.13.0+**，无需第三方依赖：

```bash
node --test tests/worker.test.js
node --test tests/sync-crypto.test.js tests/sync-merge.test.js tests/sync-client.test.js
npm test
```

Worker 测试使用 D1 API 形状的适配器，底层执行真实内存 SQLite：覆盖 schema、事务回滚、并发 CAS、IP/空间限流、1000 空间并发容量检查、CORS、认证、严格 JSON 校验和流式大小边界。这些测试不访问 Cloudflare，也不证明实际部署成功。

部署后应使用专用测试空间检查：

1. 健康路径返回 `200`，错误来源不能获得允许跨域响应头。
2. 浏览器生成配对码并 POST 密文，随后 GET 能解密还原；数据库无配对码、原始 token 或明文笔记。
3. 两次使用同一 revision 的 PUT 中只有一次成功，另一次返回 `409`；客户端读取后能够合并重试。
4. 第二个浏览器使用同一码配对；离线修改不同任务后联网可合并，同一场考试截止时间保持不变。
5. 在浏览器设置中确认同步成功后，再把服务状态更新为已部署。

生产验证会创建真实空间；测试应使用专用配对码，不输出或提交这些值。没有删除 API，需要清理验证空间时由账户维护者在 D1 中针对已确认的测试空间摘要删除，避免清理真实学习记录。

参考：[D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)、[D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[D1 result metadata](https://developers.cloudflare.com/d1/worker-api/return-object/)。
