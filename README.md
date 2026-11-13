# SAA Studio

一个中文 AWS Certified Solutions Architect – Associate（SAA-C03）学习工作台：把课程、实验、刷题、复盘和打卡放在一起，按可持续的节奏准备考试。

**网站：<https://curtisatiwatt.github.io/saa/>**

默认计划为 **已有 AWS 使用经验，每周 10 小时，8 周完成约 80 小时学习**。这是一条建议路线；是否报考应由实际掌握情况决定。开始日期、每周投入时间和显示姓名可在「计划与数据设置」调整，网站会重新计算阶段日期并保留已完成进度。

## 可以做什么

- **24 课知识课程**：覆盖四大考试领域，每课有正文、场景决策、易错点、自测和 AWS 官方参考。
- **12 个实战实验**：包含 IAM、S3、VPC、Lambda、SQS、CloudWatch，以及数据库恢复、灾备和综合架构项目；每个步骤有验收标准和完成勾选，资源清理也计入完成条件。
- **120 道原创场景练习题**：单选和多选，提供答案、逐选项解析、知识点与官方文档来源；不是考试真题或题库转录。
- **专题练习与错题本**：按领域、主题、难度筛选；错题依据每道题最近一次作答更新，重练答对后自动移出，可写复盘笔记。
- **65 题、130 分钟模拟考试**：按四领域近似权重抽题，支持标记、题号跳转、续答和到时交卷；交卷后统一查看解析。
- **学习计划与进度面板**：任务、课程和实验完成状态，最近正确率、领域表现、连续学习天数及建议目标窗口。
- **本地笔记与 JSON 备份**：导出进度，或预览并确认导入备份。

题库有限，多次模拟可能遇到重复题。本站模拟按全部 65 题计算正确率，不复刻 AWS 的未计分题安排或量表换算。

## 八周学习路线

建议把每周 10 小时拆成工作日短时段与周末实践；前六周围绕概念、实验、练习和复盘分配时间，最后两周把更多时间留给完整模拟与补弱。每周任务合计精确 600 分钟。

| 周 | 重点 | 本周交付 |
| --- | --- | --- |
| 1 | 架构基础、IAM、VPC 与混合连接 | 费用护栏、资源台账、最小权限策略与测试记录 |
| 2 | EC2、负载均衡、伸缩、S3 与文件系统 | S3 版本恢复、双 AZ 网络图与故障推演 |
| 3 | RDS、Aurora、DynamoDB 与缓存 | 无状态伸缩设计、数据库选型与恢复 runbook |
| 4 | Lambda、容器、SQS/SNS 与工作流 | Lambda 成功/失败观察、消息重试和 DLQ 验证 |
| 5 | 全球交付、安全、监控与灾难恢复 | 故障调查记录、RTO/RPO 恢复方案及成本比较 |
| 6 | 分析、迁移、计算与存储成本 | 可展示的可靠订单平台架构项目 |
| 7 | 综合做题法、第一次完整模拟 | 错因清单、两个薄弱主题补课、架构答辩与清理审计 |
| 8 | 第二次模拟、官方未见题与最终补弱 | 有依据的报考或延期决定 |

实验既有少量实际云资源操作，也有无需部署资源的架构练习。**免费额度不作保证**；执行前阅读成本说明，使用专用练习环境，不把真实密钥、客户数据或生产配置写入笔记，完成后按清单清理。AWS Budgets 通知可能延迟，不是实时消费硬上限。

## 如何判断准备好了

网站提供以下学习目标，作为自评参考：

1. 完成学习任务与全部实验验收、资源清理，能解释主要架构取舍。
2. 最近两次完整限时模拟均达到 80% 以上。
3. 四个领域各练至少 10 题，最近作答正确率均达到 75% 以上。
4. 另外做未见过的 AWS 官方练习，检查自己掌握的是推理，而不是答案记忆。

这些标准**不保证通过考试**。如果还不能解释错误选项，或某个领域持续薄弱，建议增加 1–2 周针对性复习。

考试核心事实核对于 **2026-11-13**：SAA-C03 为 65 题、130 分钟，含 50 道计分题及 15 道未标明的不计分题；四领域权重为安全 30%、弹性 26%、高性能 24%、成本优化 20%。官方最低通过量表分为 **720（量表范围 100–1000），不等于答对 72%**。预约前应再次查看最新官方要求。

- [AWS 官方考试指南](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html)
- [考试概览、预约与官方备考入口](https://aws.amazon.com/certification/certified-solutions-architect-associate/)
- [AWS Skill Builder](https://skillbuilder.aws/)（部分课程、练习或实验需登录或付费）
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [AWS Documentation](https://docs.aws.amazon.com/)
- [AWS Pricing Calculator](https://calculator.aws/)

## 数据如何保存

网站使用当前浏览器的 `localStorage`，存储键为 `saa-studio-v1`。任务、课程、实验步骤、笔记、答题记录和未完成练习保存在本机，**不会上传到本站后端，也不会自动同步设备**。网站没有登录系统、云数据库或学习数据分析服务；GitHub Pages 托管方仍可能记录常规网站访问，打开外部 AWS 链接也遵循对应网站的数据政策。

请定期到「计划与数据设置」导出 JSON 备份：

- 换浏览器、换设备、清除站点数据、退出某些隐私浏览环境或浏览器回收存储，都可能让进度无法继续使用。
- 本地预览地址与正式 GitHub Pages 地址属于不同来源，进度不会自动共享；使用导出/导入迁移。
- 导入会替换当前进度，导入前先导出当前备份。恢复文件包含笔记与答题信息，请妥善保管。
- 模拟考试的截止时间也会保存。离开页面、刷新或关闭浏览器不会暂停计时；再次打开时，过期考试会按已保存答案结算。此计时仅用于学习，不是防作弊机制。
- 勾选实验完成属于自我确认；网站不会连接 AWS 账户验证资源是否创建或删除。

## 本地开发与检查

使用 **Node.js 20 或更新版本**。运行时为原生 HTML、CSS 和 JavaScript ES modules，没有第三方运行时或构建依赖，无需 `npm install`。

```bash
npm test
npm run build
npm run dev
```

开发预览地址为 <http://127.0.0.1:4187/saa/>。请通过 HTTP 服务器访问，不要直接双击 `index.html`，因为浏览器对 `file://` 下的模块加载有限制。

构建结果位于 `dist/`，可单独预览部署产物：

```bash
node scripts/serve.mjs --dist
```

两种预览使用同一端口，启动前先停止另一个服务。`npm test` 使用 Node 内置测试运行器；`npm run build` 把网站文件与题库、课程数据复制到 `dist/`，无需打包器。

## GitHub Pages 发布

源码仓库为 [curtisatiwatt/saa](https://github.com/curtisatiwatt/saa)，发布目标为 <https://curtisatiwatt.github.io/saa/>。仓库中的 GitHub Actions 发布流程负责检查、构建、上传 Pages artifact 并部署 `dist/`。

仓库设置应为：

1. **Settings → Pages → Build and deployment → Source：GitHub Actions**。
2. 推送到发布分支 `main` 后，在 **Actions** 查看发布流程及测试、构建、部署结果；也可在流程页面手动触发。
3. 工作流需具备读取源码、写入 Pages 部署和获取 OIDC token 所需权限，部署使用 `github-pages` 环境。
4. 等待部署成功后访问正式网址。若失败，先查看对应 job 日志，检查 Pages 是否启用、环境保护规则与仓库权限。

页面采用相对资源路径和 hash 路由，适用于 `/saa/` 项目子路径，刷新课程或实验链接不需要服务端路由规则。构建中保留 `.nojekyll`。

## 文件结构

```text
index.html                    页面入口
styles.css                    响应式布局与视觉样式
app.js                        页面渲染、交互、学习进度和备份
core.js                       评分、抽题、计划日期与数据校验逻辑
favicon.svg                   网站图标
data/
  curriculum.js               24课、12实验、8周任务与官方资源
  questions-security.js       安全与弹性领域原创题
  questions-performance.js    性能与成本领域原创题
scripts/
  build.mjs                   生成 dist 静态站点
  serve.mjs                   本地 HTTP 预览
tests/                        Node 内置测试
.github/workflows/            检查、构建和 GitHub Pages 发布流程
.nojekyll                     禁用 Jekyll 处理
```

更新知识内容时，优先查阅 AWS 官方文档，保留题目和课程稳定 ID，以减少已有学习进度受影响的可能。新增题目需同时提供正确答案、逐项解析和官方来源；修改考试信息时更新核对日期。

本项目是独立学习工具，与 AWS 无隶属或认证关系。AWS 及相关服务名称属于其各自权利人。
