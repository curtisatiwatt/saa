// Original Chinese study material. Official references checked 2026-11-13.
const ref = (title, url) => ({ title, url });
const s = (title, body) => ({ title, body });
const d = (when, choose, why) => ({ when, choose, why });
const lesson = (n, title, subtitle, domain, topics, sections, decisions, pitfalls, checks, sources) => ({ id: `lesson-${String(n).padStart(2, '0')}`, title, subtitle, domain, minutes: 45, topics, sections, decisions, pitfalls, checks, sources });

export const lessons = [
  lesson(1, '从需求到架构：先读懂题目', '把业务约束翻译成技术选择', 2, ['Region', 'AZ', 'Well-Architected'], [
    s('画出约束，再选择服务', '先圈出可用性、延迟、数据一致性、恢复目标、预算和运维能力。题目问“最少运维”时，能完成相同任务的托管服务通常优于自己维护集群；问“最具成本效益”时，仍须满足所有硬性条件。每次选择都写下服务解决的具体约束。'),
    s('Region、AZ 与边缘位置', 'Region 是地理区域；一个 Region 内有多个隔离的可用区 AZ。跨 AZ 部署用于承受单个可用区故障，跨 Region 部署用于更大范围灾难、合规或全球访问。边缘位置把内容和连接靠近用户，不能代替数据库的数据恢复策略。'),
    s('共享责任与六大支柱', 'AWS 负责云本身的设施安全；客户仍需对身份权限、数据分类和应用配置负责，责任范围随服务改变。用卓越运营、安全性、可靠性、性能效率、成本优化、可持续性六个维度检查方案。托管不代表无需备份、监控或最小权限。')
  ], [d('只有一个数据中心故障也要继续服务', '跨 AZ 冗余', '隔离基础设施故障，不必无条件升级为跨 Region。'), d('要求灾区之外恢复业务', '跨 Region 备份或复制', '恢复范围必须超出故障范围。')], ['“高持久性”不等于“始终可访问”。', '先满足硬性需求，再比较成本和运维。'], ['能区分扩展性、弹性、可用性与持久性。', '能为一个三层应用列出三个单点故障。'], [ref('AWS Well-Architected Framework', 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html')]),
  lesson(2, 'IAM：谁可以做什么', '身份、角色、策略与跨账户访问', 1, ['IAM', 'STS', 'Organizations', 'Identity Center'], [
    s('临时凭证优先', '人通过联合身份或 IAM Identity Center 登录；工作负载使用 IAM Role。角色的信任策略决定谁可以 AssumeRole，权限策略决定角色能做什么。EC2、Lambda 等服务应取得临时凭证，避免把长期 Access Key 写入代码、镜像或配置文件。'),
    s('策略判定与限制边界', '默认不授予权限，适用的显式 Deny 优先。身份策略和资源策略的组合还受请求主体、跨账户关系及限制策略影响。SCP 和 permissions boundary 不会自行授予权限：前者约束组织成员账户，后者限制身份策略能授予的范围。资源策略直接授权用户或会话时有特殊规则，不能把所有场景机械套成简单交集。'),
    s('最小权限与跨账户', '先限定 Action 和 Resource，再用 Condition 限制来源、标签、加密或组织条件。跨账户 AssumeRole 需要调用方具有相应授权，目标角色信任调用方。第三方访问可使用 ExternalId 降低 confused deputy 风险。root 用户仅用于必须的账户管理操作，并启用 MFA。')
  ], [d('应用读取 S3，不想保存密钥', '为运行环境附加 IAM Role', 'SDK 使用短期凭证并自动刷新。'), d('统一禁止成员账户关闭审计', 'Organizations SCP 配合权限策略', '组织层限制不会被成员账户中的普通 Allow 覆盖。')], ['SCP 不是授予权限的 IAM Policy。', '信任关系与服务访问权限是两件事。'], ['能解释 Allow、隐式拒绝、显式 Deny。', '能设计一个只读指定 S3 前缀的角色。'], [ref('IAM policies', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html'), ref('Policy evaluation', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html')]),
  lesson(3, 'VPC：跟着一个数据包走', '子网、路由、安全组与 NACL', 1, ['VPC', 'Subnet', 'Security Group', 'NACL'], [
    s('公网与私网由路由决定', '子网属于单个 AZ；VPC 可以覆盖多个 AZ。公共子网的路由表具有指向 Internet Gateway 的默认路由。EC2 要直接通过 IPv4 与互联网通信，还需要公网 IPv4、合适的安全组及 NACL。仅把实例放入公共子网，并不会自动让它可访问。'),
    s('两层网络访问控制', 'Security Group 作用于关联的网络接口，只包含允许规则，并对连接状态进行跟踪。NACL 作用于子网，按规则号从小到大匹配，可允许或拒绝，回包也要匹配规则。排障时同时检查请求路径和临时端口的返回路径。'),
    s('私有出站不等于公开入口', '私有 IPv4 工作负载可经 NAT Gateway 主动访问互联网，外部不能通过 NAT 主动建立入站连接。多 AZ 架构要考虑 NAT 的可用区故障与跨 AZ 流量。IPv6 的仅出站互联网访问使用 egress-only Internet Gateway；不要把 NAT 当成安全组或应用防火墙。')
  ], [d('数据库只接受应用层连接', '数据库 SG 以应用 SG 为来源', '引用工作负载身份边界，避免维护动态 IP 列表。'), d('必须拒绝某个网段进入子网', 'NACL Deny 规则', '安全组不能配置显式拒绝。')], ['安全组允许回包不代表 NACL 也允许。', '有公网 IP、IGW、路由及访问规则，网络路径才完整。'], ['能画出客户端到 ALB 到应用到数据库的路径。', '能解释私有实例为何访问不了外网。'], [ref('VPC security controls', 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html')]),
  lesson(4, '私网连接与混合网络', 'Endpoints、Peering、Transit Gateway、VPN 与 Direct Connect', 3, ['VPC Endpoint', 'Transit Gateway', 'VPN', 'Direct Connect'], [
    s('访问 AWS 服务不一定需要 NAT', 'S3 与 DynamoDB 可使用 Gateway Endpoint，让匹配的服务流量通过路由表走私有路径。Interface Endpoint 使用 PrivateLink，在子网内提供私有网络接口，适用于支持的 AWS 或自建服务。选择前核对服务、DNS、端点策略和费用。'),
    s('网络互联的规模', '少量 VPC 之间可以使用 VPC Peering，但它不提供传递路由，且 CIDR 不可重叠。大量 VPC 与本地网络互联时，Transit Gateway 提供集中式路由枢纽。PrivateLink 用于提供私有服务访问，通常不需要向消费者暴露整个提供方网络。'),
    s('专线与加密分别判断', 'Site-to-Site VPN 通过加密隧道连接网络，适合快速建立或作为备份。Direct Connect 提供专用连接，但不能把“专用”直接等同于端到端加密；若有加密要求，应选择受支持的加密方案或 VPN 组合。高可用连接需要冗余线路、设备和位置。')
  ], [d('私有 EC2 大量访问同 Region 的 S3', 'Gateway Endpoint', '可减少对 NAT 的依赖与相应处理费。'), d('数十个 VPC 需要集中连接本地网络', 'Transit Gateway', '集中路由比维护全互联 peering 简单。')], ['Peering 不提供 A→B→C 的传递路由。', 'Direct Connect 不自动解决加密与冗余。'], ['能根据规模选择 peering 或 Transit Gateway。', '能解释 Gateway 与 Interface Endpoint 的区别。'], [ref('VPC endpoints', 'https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html'), ref('Direct Connect security', 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/encryption-in-transit.html')]),
  lesson(5, 'EC2 与存储性能', '根据瓶颈选择计算和磁盘', 3, ['EC2', 'EBS', 'Instance Store'], [
    s('先测瓶颈再选实例', 'CPU 密集任务关注计算优化实例；大缓存、内存数据库关注内存优化；高吞吐本地临时数据处理关注存储优化。评估 vCPU、内存、网络和 EBS 带宽的组合，不能只增加磁盘 IOPS 就假设性能会提升。'),
    s('EBS 是持久块存储', 'EBS 卷位于单个 AZ，可作为文件系统或数据库的块设备。gp3 可分别配置容量、IOPS 与吞吐量；io2 面向高性能和较高耐久性要求。快照用于备份及跨 AZ/Region 迁移，恢复到新卷还应考虑初始化读取性能。'),
    s('临时存储与可重建工作负载', 'Instance Store 提供本机临时块存储；不能把它作为无法重建数据的唯一副本。停止、终止或宿主机故障等事件可能丢失数据。适合有副本的缓存、临时计算和中间文件，业务数据应写入持久化服务。')
  ], [d('数据库需要稳定且高 IOPS', '按实测需求选择 Provisioned IOPS SSD', '同时确认实例的 EBS 限制。'), d('可重建的高速中间数据', 'Instance Store', '降低对持久盘的依赖，但必须接受数据丢失。')], ['EBS 不能直接跨 AZ 挂载。', '快照不是一个可直接挂载的磁盘。'], ['能解释 IOPS 与吞吐量适用的负载差异。', '能描述从快照恢复到另一 AZ 的过程。'], [ref('EBS volume types', 'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html'), ref('Instance store', 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/InstanceStorage.html')]),
  lesson(6, '负载均衡与自动伸缩', '让应用应对增长与故障', 2, ['ALB', 'NLB', 'Auto Scaling'], [
    s('按协议选择负载均衡', 'ALB 理解 HTTP/HTTPS，可按路径、主机名等规则分发请求。NLB 面向 TCP、UDP、TLS 等连接级负载，适用于需要静态 IP 等网络特征的场景。选择从协议与客户端需求出发，而不是认为某一种总是更快或更便宜。'),
    s('伸缩与健康检查形成闭环', 'Auto Scaling Group 维持实例数量并根据策略调整容量。将目标组健康检查与实例替换结合，跨多个 AZ 放置实例。目标跟踪适合维持某指标水平；可预测的流量可以使用计划伸缩。启动耗时、预热和冷却会影响响应速度。'),
    s('先消除有状态瓶颈', '把会话存入共享数据库或缓存，把上传文件存入 S3/EFS，实例才能被替换。Sticky session 不能代替可靠的会话存储。设定最小容量、伸缩上限和优雅终止，避免扩展出大量实例后仍被单个数据库或外部 API 限制。')
  ], [d('按 /api 与 /images 分发 HTTP 请求', 'ALB listener rules', '在应用层进行路由。'), d('队列积压增长，需要更多消费者', '按每实例 backlog 等工作量指标伸缩', '指标应与处理能力和等待时间相关。')], ['伸缩策略无法修复应用中的共享单点。', '实例健康与应用健康并不总一致。'], ['能解释 min、desired、max capacity。', '能设计实例被终止后仍可继续的用户会话。'], [ref('Application Load Balancer', 'https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html'), ref('Dynamic scaling', 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scale-based-on-demand.html')]),
  lesson(7, 'S3：安全、版本与生命周期', '把对象存储用对', 1, ['S3', 'Versioning', 'Lifecycle', 'Object Lock'], [
    s('对象与访问边界', 'S3 使用 bucket、key 与对象元数据组织数据，适合静态资源、备份和数据湖，不是传统可挂载块磁盘。默认保持 Block Public Access。使用 IAM、bucket policy、访问点或短期 presigned URL 授权；加密不能替代访问控制。'),
    s('版本控制与恢复', 'Versioning 保存同一个 key 的多个版本。普通删除通常创建 delete marker，并未清除历史数据。恢复旧版本可以复制旧内容成当前版本；清理费用时必须关注非当前版本。Object Lock 用于 WORM 保留，合规保留模式不能随意缩短。'),
    s('用访问模式选择存储层', '经常读取使用 Standard；不可预测访问考虑 Intelligent-Tiering；长期冷数据可考虑适合恢复窗口的归档层。Lifecycle 让对象迁移或过期，须分别考虑当前、非当前版本、删除标记及未完成 multipart upload。检索费、最短存储期与小对象开销会影响真实成本。')
  ], [d('仅临时允许下载一个私有对象', 'Presigned URL', '用到期时间限制授权窗口，仍受签名凭证权限约束。'), d('误删文件需要恢复', 'Versioning 加恢复流程', '版本提供恢复材料，流程才能验证可恢复。')], ['删除当前对象不代表所有版本都被删除。', 'S3 静态网站端点与私有 S3 REST origin 的安全模型不同。'], ['能恢复一个旧版本。', '能解释为何归档最便宜的单价不一定代表总成本最低。'], [ref('S3 versioning', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html'), ref('Lifecycle rules', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html')]),
  lesson(8, '共享文件与专用文件系统', 'EFS、FSx 和存储网关', 3, ['EFS', 'FSx', 'Storage Gateway'], [
    s('根据协议与共享方式选择', 'EFS 提供 NFS 文件共享，适合多个 Linux 计算节点共同访问。Regional EFS 与 One Zone 的故障范围和成本不同。Windows 应用需要 SMB、Windows 权限与相关集成时，可评估 FSx for Windows File Server。'),
    s('高性能文件系统', 'FSx for Lustre 面向需要并行文件访问的高性能计算，也可与 S3 数据集集成。不能因为服务名字都包含文件系统就互换：协议、应用兼容性、部署模式、吞吐需求和备份要求都应明确。'),
    s('本地系统接入云存储', 'Storage Gateway 让本地应用通过熟悉的文件、卷或虚拟磁带接口使用云存储。缓存帮助保留热点数据，但网络断开、缓存容量和同步延迟仍要纳入设计。数据搬迁与长期混合接入是不同需求。')
  ], [d('多台 Linux Web 服务器共享文件', 'Amazon EFS', '提供共享 NFS 文件系统。'), d('Windows 应用依赖 SMB 与 Windows 文件权限', 'FSx for Windows File Server', '保留应用所需的文件服务能力。')], ['EFS 不能作为所有 Windows SMB 应用的直接替代。', '共享文件不等于自动实现应用级数据一致性。'], ['能按对象、块、文件区分 S3/EBS/EFS。', '能为遗留磁带备份提出云接入方案。'], [ref('EFS overview', 'https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html'), ref('Amazon FSx', 'https://docs.aws.amazon.com/fsx/'), ref('Storage Gateway', 'https://docs.aws.amazon.com/storagegateway/latest/userguide/WhatIsStorageGateway.html')]),
  lesson(9, 'RDS 与 Aurora：可用性和读取扩展', '准确区分备库、只读副本和集群', 2, ['RDS', 'Aurora', 'Multi-AZ'], [
    s('关系型数据库的适用范围', '复杂关联查询、事务和关系约束常适合 RDS/Aurora。托管服务减少补丁、备份等基础运维，但仍要设计索引、连接池、容量、故障重试和凭证轮换。应用通过数据库端点连接，不应硬编码底层 IP。'),
    s('不同部署的副本作用不同', 'RDS Multi-AZ DB instance 的 standby 用于故障切换，不服务读流量；Read Replica 用于读取扩展，可能有复制延迟。RDS Multi-AZ DB cluster 与 Aurora 的读取能力另有设计，不可把传统 standby 的限制套在所有 Multi-AZ 产品上。'),
    s('扩展与恢复分别测试', '只读副本分担读负载，不能直接解决写入瓶颈；异步复制意味着读取可能落后。备份和 PITR 应演练恢复到新数据库，再验证连接和数据。跨 Region 副本或备份需要同时考虑延迟、成本、数据驻留与恢复操作。')
  ], [d('数据库实例故障要自动恢复服务', '适合引擎的 Multi-AZ 部署', '备用节点或集群支持故障切换。'), d('大量报表导致主库读取压力', 'Read Replica 或 Aurora Reader', '把允许延迟的查询从写入节点分离。')], ['传统 Multi-AZ standby 不接受只读查询。', '有备份不等于已经证明能在 RTO 内恢复。'], ['能解释复制延迟对订单查询的影响。', '能说明数据库连接池为何重要。'], [ref('RDS Multi-AZ DB instance', 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html'), ref('RDS read replicas', 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html')]),
  lesson(10, 'DynamoDB 与缓存', '从访问模式设计数据', 3, ['DynamoDB', 'DAX', 'ElastiCache'], [
    s('先写查询，再设计键', 'DynamoDB 适合已知访问模式的键值与文档数据。Partition key 的分布影响流量是否均匀，sort key 帮助组织同一分区内的数据。需要替代查询路径时设计索引；对整个表 Scan 通常不是高效查询方案。'),
    s('吞吐与一致性', '未知或剧烈变化的工作负载可评估 on-demand；可预测流量可评估 provisioned 配合自动伸缩。读一致性、索引支持和跨 Region 复制语义要按所选特性核对。TTL 用于异步过期，不能当作到点立即删除的业务定时器。'),
    s('缓存解决热点，也引入失效问题', 'ElastiCache 可存放热点查询结果、会话等；DAX 面向 DynamoDB 读取加速。缓存命中率、TTL、缓存穿透和失效策略决定实际收益。应用必须能处理缓存不可用，并明确哪些请求不能接受过期数据。')
  ], [d('按用户 ID 查询购物车，流量不可预测', 'DynamoDB on-demand', '访问模式清晰，降低容量规划工作。'), d('重复读取昂贵的关系型查询结果', 'ElastiCache 加合适失效策略', '减少数据库负载，但不能盲目缓存强实时结果。')], ['添加缓存不自动保证一致性。', 'TTL 不保证在指定秒数立即删除。'], ['能为订单设计 partition/sort key。', '能说明 DAX 和通用 Redis/Valkey 缓存的区别。'], [ref('DynamoDB best practices', 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html'), ref('DynamoDB TTL', 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html')]),
  lesson(11, 'Serverless API', 'API Gateway、Lambda 与权限边界', 3, ['Lambda', 'API Gateway', 'Cognito'], [
    s('一次请求的完整路径', 'API Gateway 负责 API 入口、路由、授权及流量控制，Lambda 执行业务逻辑，持久数据写入数据库或存储。函数执行环境可以被复用，但不能把内存中的状态作为可靠的共享数据源。认证回答是谁，授权回答能做什么。'),
    s('延迟、并发与下游容量', 'Lambda 的冷启动、函数超时、并发额度及下游连接数会影响请求。Reserved concurrency 可限制函数最大并发并预留配额；Provisioned concurrency 可降低初始化带来的延迟。增加并发可能把压力转移到数据库，应配合连接复用、缓存或队列。'),
    s('网络与失败语义', '函数连接到 VPC 并不自动获得互联网出口，需设计路由与端点。同步、异步和事件源映射具有不同失败处理行为，重试需要业务幂等性。Cognito 可为面向用户的应用提供身份服务，不代替服务到服务的 IAM 最小权限。')
  ], [d('短时、事件驱动、变化较大的处理任务', 'Lambda', '按调用执行，减少服务器管理。'), d('保护数据库免受突发函数并发冲击', '并发限制、连接管理或缓冲队列', '计算层扩展不能超出下游承受能力。')], ['在 VPC 内运行的函数不天然拥有公网访问。', '重试可能导致重复扣款或重复写入。'], ['能区分 reserved 与 provisioned concurrency。', '能设计一次重复请求不会重复创建订单的 API。'], [ref('Lambda concurrency', 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html'), ref('API Gateway', 'https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html')]),
  lesson(12, '容器与批处理', 'ECS、EKS、Fargate 和 Batch', 3, ['ECS', 'EKS', 'Fargate', 'Batch'], [
    s('编排与运行方式分开选', 'ECS 和 EKS 负责容器编排，Fargate 是无需管理底层服务器的计算方式。需要 Kubernetes API、已有 Kubernetes 生态或迁移兼容性时评估 EKS；希望简化 AWS 原生容器运行时可评估 ECS。镜像通常存放在 ECR。'),
    s('无状态容器与角色', '容器随时可能重建；持久数据放入外部存储，凭证通过任务或工作负载角色获得。区分 ECS task role（应用权限）与 task execution role（拉镜像、写日志等代理操作）。健康检查、部署回滚和多 AZ 调度决定可用性。'),
    s('按作业运行的计算', 'AWS Batch 管理排队作业和计算环境，适合批量渲染、分析等任务。可中断、可重试的批处理可使用 Spot；任务需要保存检查点或容忍从头重跑。长期运行服务与离线作业具有不同伸缩指标。')
  ], [d('运行容器但不管理节点', 'ECS 或 EKS 配合 Fargate', '把底层服务器运维交给托管计算。'), d('大量可重试的离线作业', 'AWS Batch 配合适合的容量', '队列和调度匹配批处理模式。')], ['Fargate 不是另一套容器编排 API。', 'execution role 不等于应用的 task role。'], ['能解释容器镜像与运行实例的区别。', '能给 Spot 批处理设计失败恢复点。'], [ref('ECS task IAM role', 'https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html'), ref('AWS Batch', 'https://docs.aws.amazon.com/batch/latest/userguide/what-is-batch.html')]),
  lesson(13, 'SQS 与 SNS：解耦和扇出', '理解交付语义，才不会重复处理', 2, ['SQS', 'SNS', 'DLQ'], [
    s('队列缓冲生产与消费速率', 'SQS 保存待处理消息，消费者拉取并处理，再删除成功完成的消息。Standard queue 提供至少一次交付，顺序尽力而为；FIFO 在消息组范围保证顺序并提供去重机制，业务副作用仍应设计为幂等。'),
    s('可见性超时与失败重试', '消费者收到消息后，visibility timeout 暂时隐藏消息，处理失败或未删除时可能再次出现。超时应覆盖处理时间，并为失败设置 DLQ 和最大接收次数。长轮询可以减少空请求。DLQ 需要监控、调查和安全重放。'),
    s('每个订阅者都要收到一份', 'SNS 把事件推送到多个订阅目标。SNS 加多个 SQS 队列可以让各下游独立消费、重试与扩展。一个 SQS 队列的多个消费者是在竞争工作，不能确保每个消费者都获得同一条消息。')
  ], [d('支付后通知库存、邮件和分析，各自可靠处理', 'SNS → 独立 SQS 队列', '扇出并隔离下游故障。'), d('同一订单事件必须顺序处理', 'FIFO 与合适 MessageGroupId', '顺序边界与业务实体一致。')], ['收到消息不等于消息已经删除。', 'FIFO 不消除业务幂等性的需求。'], ['能说明 visibility timeout 太短的后果。', '能区分 fan-out 与 competing consumers。'], [ref('SQS queue types', 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-types.html'), ref('Lambda and SQS', 'https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html')]),
  lesson(14, '事件与工作流', 'EventBridge、Step Functions 与流式数据', 2, ['EventBridge', 'Step Functions', 'Kinesis'], [
    s('路由业务事件', 'EventBridge 根据事件内容匹配规则并路由到目标，适合跨服务或 SaaS 的事件集成。事件总线帮助解耦来源与消费者，仍须考虑失败目的地、权限和重复事件。需要持续积压工作给消费者时，队列通常是重要组件。'),
    s('编排多步流程', 'Step Functions 把任务、分支、等待、重试与错误处理表达为状态机。它适合可观察的多步骤业务流程，而不是让一个函数长时间轮询另一个服务。不同工作流类型有各自的执行语义和适用约束，应按需要核对。'),
    s('流式处理与缓冲交付', 'Kinesis Data Streams 适合持续有序的数据流及多个消费者，顺序和吞吐与分区相关。Amazon Data Firehose 适合把流式数据缓冲后投递到存储或分析目的地。需要实时自定义处理还是托管投递，是选型的关键。')
  ], [d('订单要依次执行付款、库存、补偿', 'Step Functions', '显式管理步骤和失败路径。'), d('匹配业务事件内容后触发不同处理', 'EventBridge', '规则路由比点对点调用更易扩展。')], ['事件总线不代替所有队列和流。', '跨服务重试需要统一的业务关联 ID。'], ['能画出一条包含重试和补偿的工作流。', '能解释 Data Streams 与 Firehose 的差异。'], [ref('EventBridge', 'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html'), ref('Step Functions', 'https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html')]),
  lesson(15, '全球交付与 DNS', 'Route 53、CloudFront 和 Global Accelerator', 3, ['Route 53', 'CloudFront', 'Global Accelerator'], [
    s('DNS 是决策，不是连接代理', 'Route 53 根据简单、加权、延迟、故障转移等策略返回 DNS 结果。缓存和 TTL 意味着切换并非所有客户端瞬间生效。健康检查与目标类型配合才能支持合理故障转移；域名注册、托管区和记录是不同概念。'),
    s('缓存离用户更近', 'CloudFront 在边缘交付内容，可缓存静态和适当配置的动态响应。Cache key 决定哪些请求共享缓存，过多 cookie、header 或 query 参数会降低命中率。私有 S3 origin 可使用 Origin Access Control，限制用户绕过分发直接访问。'),
    s('网络加速和内容缓存不同', 'Global Accelerator 使用静态 anycast IP 和 AWS 全球网络，把流量导向健康的区域端点，适用于 TCP/UDP 等场景；它不是对象缓存。CloudFront 更偏向 HTTP 内容交付。选择依据是协议、缓存需求、静态 IP 与故障切换行为。')
  ], [d('全球用户读取大量相同图片', 'CloudFront + S3', '边缘缓存减少延迟及源站读取。'), d('全球 TCP 服务需要稳定入口 IP', 'Global Accelerator', '提供静态全球入口并导向健康端点。')], ['降低 TTL 不能替代健康检查与应用恢复。', 'CloudFront 缓存键配置错误可能泄露或混淆个性化内容。'], ['能解释一次 cache miss 的路径。', '能选择加权与故障转移 DNS 的适用场景。'], [ref('CloudFront OAC', 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html'), ref('Route 53 routing', 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html')]),
  lesson(16, '可观察性与安全检测', 'CloudWatch、CloudTrail、Config 与防护服务', 1, ['CloudWatch', 'CloudTrail', 'Config', 'GuardDuty', 'WAF'], [
    s('指标、日志和 API 审计', 'CloudWatch 聚合运行指标、日志及告警；CloudTrail 记录支持的 API 活动，用于追踪谁在何时做了什么。AWS Config 记录资源配置及其变化，并评估规则符合性。看到 CPU 高、谁改了策略、资源是否合规，是三类不同问题。'),
    s('检测与阻止分开思考', 'GuardDuty 分析信号发现潜在威胁；Macie 帮助发现 S3 敏感数据；Security Hub 聚合安全发现与状态。WAF 在应用层检查 Web 请求，Shield 关注 DDoS 防护。检测服务不会自动修复所有安全问题，应有响应流程。'),
    s('监控必须能够行动', '告警阈值应对应业务 SLO 或明确响应，例如队列最老消息持续增长、错误率上升。设置合适评估窗口，处理缺失数据，并避免把每个瞬时峰值都当故障。日志包含敏感信息时需限制访问、控制保留期并考虑加密。')
  ], [d('追查安全组由谁修改', 'CloudTrail', '查找管理 API 活动。'), d('阻挡常见 Web 注入与恶意 HTTP 请求', 'AWS WAF', '在受支持的 Web 入口使用规则过滤。')], ['CloudWatch 与 CloudTrail 不是同义服务。', '开启告警但无人响应不算可靠运维。'], ['能为一个 API 选三项有意义指标。', '能区分 GuardDuty、Macie 与 Config 的用途。'], [ref('CloudTrail concepts', 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html'), ref('CloudWatch', 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html')]),
  lesson(17, '加密、密钥与秘密', 'KMS、Secrets Manager 与 ACM', 1, ['KMS', 'Secrets Manager', 'ACM'], [
    s('传输中与静态加密', 'TLS 保护传输过程，服务端加密保护存储数据，两者解决不同风险。KMS 通过密钥策略及相关授权控制密钥使用。信封加密使用数据密钥加密数据，再保护数据密钥；应用不应把主密钥材料随数据一起明文保存。'),
    s('密钥权限是独立关卡', '拥有 S3 读取权限并不一定能读取 SSE-KMS 对象，调用者还须获得适当解密授权。跨账户访问涉及资源权限与密钥权限。客户管理密钥能提供更多策略与生命周期控制，也带来管理工作和费用。安排删除密钥可能使加密数据不可恢复。'),
    s('秘密与证书管理', 'Secrets Manager 适合存放和轮换数据库等秘密；Parameter Store 适合配置与参数，也支持加密参数。ACM 管理受支持服务的 TLS 证书。证书、密码、Access Key 和数据加密密钥不能混为一谈。')
  ], [d('数据库密码需要托管轮换', 'Secrets Manager 配合支持的轮换方案', '集中管理秘密与更新流程。'), d('ALB 提供 HTTPS', 'ACM 证书和 HTTPS listener', '在入口终止 TLS，后端是否加密仍按要求配置。')], ['能读 S3 不一定能解密 KMS 对象。', '不要在练习中删除生产密钥。'], ['能画出一次信封加密流程。', '能解释为什么密钥策略要单独检查。'], [ref('KMS key policies', 'https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html'), ref('Secrets Manager rotation', 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html')]),
  lesson(18, '备份与灾难恢复', '用 RTO/RPO 选择恢复方案', 2, ['AWS Backup', 'RTO', 'RPO', 'DR'], [
    s('两个指标，两个问题', 'RTO 是允许业务中断多久，RPO 是允许丢失多长时间窗口内的数据。先确定故障范围与业务影响，再选择技术。每小时备份不代表一小时恢复完成；频繁复制也不保证应用能立即接管。'),
    s('四类常见策略', 'Backup and restore 平时维护备份，故障后建立恢复环境；Pilot light 保持关键核心与数据，故障后补齐容量；Warm standby 保持可工作的缩小环境；Multi-site active/active 同时服务流量。一般越短恢复目标，需要越多持续运行资源和更复杂的一致性设计。'),
    s('恢复能力通过演练证明', '备份应与原数据故障域和权限风险隔离。AWS Backup 可集中策略与恢复点，但仍要检查支持范围、保留和跨账户/Region 条件。恢复演练应验证数据完整性、DNS、秘密、依赖服务和切回步骤，并记录实际恢复时间。')
  ], [d('低优先级系统可接受较长恢复时间', '备份与恢复', '成本较低，但恢复流程和时间必须实测。'), d('需要较快接管且能接受小规模待机成本', 'Warm standby', '保持可运行系统，故障时扩容。')], ['同步复制会同步误删，不能替代历史备份。', 'Multi-AZ 不能覆盖所有 Region 级灾难。'], ['能分别为 RTO 与 RPO 提问。', '能写出恢复后验证数据的具体方法。'], [ref('Disaster recovery options', 'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html'), ref('AWS Backup', 'https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html')]),
  lesson(19, '分析与数据湖', 'Athena、Glue、Redshift 与 OpenSearch', 3, ['Athena', 'Glue', 'Redshift', 'OpenSearch'], [
    s('先区分分析与交易', '交易系统关注小范围读写和事务，分析系统常扫描大量历史数据。S3 可作为数据湖存储，Glue Data Catalog 保存表结构等元数据。Schema-on-read 不意味着无需治理：分区、格式、权限和质量决定可用性。'),
    s('按查询方式选择', 'Athena 适合直接对 S3 数据执行按需 SQL；Redshift 面向数据仓库和持续复杂分析；OpenSearch 用于搜索、日志分析等索引检索场景。Glue 提供数据发现和 ETL 能力，它不是取代所有数据存储的数据库。'),
    s('减少扫描就是减少浪费', '将数据转换成 Parquet 等列式格式，压缩并按常见过滤字段合理分区，可降低 Athena 扫描量。大量极小文件、无筛选的 SELECT *、错误分区都会拖慢查询并增加成本。保留原始层与处理层，方便重算及追溯。')
  ], [d('偶尔查询 S3 中的日志', 'Athena', '无需常驻查询集群，费用与使用相关。'), d('集中式企业分析和复杂聚合', 'Redshift', '数据仓库模型适合持续分析负载。')], ['Athena 查询成本不能只看结果行数。', 'Glue Catalog 的表定义不是原始数据副本。'], ['能给日志设计一个日期分区。', '能说明列式格式为何适合只读少量字段的查询。'], [ref('Athena performance', 'https://docs.aws.amazon.com/athena/latest/ug/performance-tuning.html'), ref('AWS Glue', 'https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html')]),
  lesson(20, '迁移与混合存储', '选择传输工具，规划切换窗口', 3, ['DMS', 'DataSync', 'Transfer Family'], [
    s('数据库迁移是持续过程', 'AWS DMS 可执行数据库完整加载及支持场景下的变更数据捕获，以减少最终停机窗口。异构迁移还需要评估 schema、SQL 和应用兼容性。复制任务成功不代表应用已经通过业务验证。'),
    s('文件传输与长期协议入口', 'DataSync 用于搬迁或同步支持的存储之间的数据，适合自动化传输与验证。Transfer Family 为依赖 SFTP 等协议的伙伴或客户端提供托管入口。Storage Gateway 让现有本地系统持续使用云后端，解决的不是同一类问题。'),
    s('先计算时间，再选网络路径', '数据量除以可用有效带宽只是传输下限，还应预留协议开销、变更速度和重试。对受限网络考虑 AWS 当前可提供的离线迁移选项与区域可用性，不能依赖旧产品名称。最终切换要有数据校验、冻结窗口、回退及权限审查。')
  ], [d('持续复制数据库变更，最后短暂停写切换', 'DMS full load + CDC', '在迁移期间缩小源和目标的数据差距。'), d('伙伴必须用 SFTP 上传文件到云存储', 'Transfer Family', '保留协议兼容并减少服务器管理。')], ['数据迁移完成不等于应用迁移完成。', '评估离线设备服务时核对当前供应和区域。'], ['能给迁移写出回退触发条件。', '能区分 DMS、DataSync 与 Transfer Family。'], [ref('AWS DMS', 'https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html'), ref('AWS DataSync', 'https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html'), ref('Transfer Family', 'https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html')]),
  lesson(21, '计算成本优化', '按稳定程度与中断容忍度购买容量', 4, ['Savings Plans', 'Reserved Instances', 'Spot', 'Budgets'], [
    s('先减少浪费，再做承诺', '先看 CPU、内存、网络、磁盘及业务周期，缩减闲置和过大的资源。开发环境定时关闭、服务自动伸缩和使用托管服务可能降低总成本。低 CPU 不一定代表实例过大，还须看内存或吞吐瓶颈。'),
    s('匹配购买方式', 'On-Demand 适合短期和不确定需求；Savings Plans 或适合的 Reserved Instances 适合稳定基线，但承诺范围与灵活性不同。Spot 适合可以中断、检查点恢复或重试的工作。不能为了折扣让不容中断的单一关键节点依赖 Spot。'),
    s('把成本变成可观察指标', 'Cost Explorer 用于分析消费趋势；Budgets 可针对费用或使用量设置通知；Cost Anomaly Detection 帮助发现异常模式。预算通知不是实时硬性消费上限，账单数据和告警可能延迟。标签和成本分配让团队知道费用属于谁。')
  ], [d('稳定全天运行的计算基线', '先 rightsizing，再评估承诺折扣', '避免把不需要的容量长期锁定。'), d('可重跑的夜间渲染任务', 'Spot 与多实例类型策略', '以可中断能力换取容量价格优势。')], ['预留实例折扣与容量预留不是所有场景下的一回事。', '预算告警不会自动阻止所有消费。'], ['能解释为什么先优化后购买承诺。', '能为可中断任务设计恢复机制。'], [ref('Savings Plans', 'https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html'), ref('EC2 Spot', 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html'), ref('AWS Budgets', 'https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html')]),
  lesson(22, '存储与流量成本', '从总账单看架构取舍', 4, ['S3 Lifecycle', 'NAT', 'Data Transfer', 'Pricing Calculator'], [
    s('每 GB 单价只是账单一部分', '存储费用还包括请求、检索、最低计费对象大小、最短存储期、复制及数据传输。日志只有少量访问不代表一定适合最深归档，恢复时间必须符合要求。过多小对象可能让监控费或请求费占据主要成本。'),
    s('追踪每一次数据移动', '画出用户、AZ、Region、NAT、端点和服务之间的路径，确认哪些流量产生费用。S3 Gateway Endpoint 可减少适合流量经过 NAT 的处理费；Interface Endpoint 本身也有计费。跨 AZ 或 Region 的方案不能只比较实例费用。'),
    s('做可审查的成本估算', '使用 Pricing Calculator 记录 Region、运行小时、容量、请求和传输量。给出常态和高峰两组假设，再比较。成本优化必须保留可用性、安全和性能要求，删除备份或单 AZ 化前先验证业务容忍度。')
  ], [d('历史审计数据需长期保留，允许等待恢复', '符合恢复窗口的归档类和 lifecycle', '结合检索频率和最短存储期选择。'), d('私有子网访问 S3 的 NAT 处理费高', '评估 Gateway Endpoint', '优化数据路径而非只减少实例。')], ['最低存储单价不等于最低总成本。', '削减冗余可能违反高可用要求。'], ['能列出一条 S3 方案至少四个成本维度。', '能解释一个有假设、有范围的成本估算。'], [ref('S3 storage classes', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html'), ref('AWS Pricing Calculator', 'https://calculator.aws/'), ref('VPC pricing', 'https://aws.amazon.com/vpc/pricing/')]),
  lesson(23, '架构综合题的方法', '排除可行但不合适的选项', 2, ['Architecture', 'Trade-offs', 'Well-Architected'], [
    s('四步做题法', '第一步写出目标，第二步列硬性约束，第三步排除违反约束的方案，第四步在剩余选项中比较题目要求的成本、性能或运维。不要因为看到熟悉服务名就选择；一个方案技术上可行，也可能不符合“最少运维”。'),
    s('常见的边界对比', '把容易混淆的服务两两比较：SNS/SQS、Multi-AZ/Read Replica、CloudFront/Global Accelerator、EFS/EBS、KMS/Secrets Manager、CloudWatch/CloudTrail。每组各写一个“应该选”和“不应该选”的场景，比背功能清单更能迁移到新题。'),
    s('为每个架构写一条失败路径', '正常路径之外，考虑节点失效、AZ 失效、慢消费者、重复消息、凭证泄露和误删。写出检测信号、自动处理和人工恢复步骤。将不可逆业务操作与幂等键、审计和补偿联系起来。')
  ], [d('多个选项都能工作', '回到题目的首要约束排序', '考试考的是最适合场景的设计。'), d('选择了复杂自建方案', '检查是否存在等价托管服务', '最少运维通常是关键判断维度之一。')], ['不要只靠“永远选 serverless”之类口诀。', '多选题必须每个选项都满足要求，组合也要完整。'], ['能在一分钟内口述一个方案的取舍。', '能解释每个错误选项为什么不适合当前场景。'], [ref('Well-Architected review', 'https://docs.aws.amazon.com/wellarchitected/latest/framework/the-review-process.html')]),
  lesson(24, '考试策略与就绪检查', '用证据决定报考，而不是只看日历', 4, ['SAA-C03', 'Practice Exam', 'Readiness'], [
    s('考试信息与练习定位', '截至 2026-11-13，SAA-C03 为 65 题、130 分钟，包括单选与多选；其中 50 题计分，15 题不计分但不会标明。官方合格线为 720 分（100–1000 的量表分），不能换算成“答对 72%”。本站题目为原创练习，正确率不等于官方分数。'),
    s('在时间限制内建立节奏', '第一遍先处理能判断的题，难题标记后继续，避免某一道消耗大量时间。给最终检查留下时间，核对多选数量、否定词和“最少”“最高”等限定词。模拟时禁止查资料，结束后再逐项复盘，包括猜对的题。'),
    s('就绪信号与延期规则', '建议连续两次限时整套模拟达到 80% 以上、各领域达到 75% 以上，并能解释错因和完成实验清理。重复做过的题会高估掌握度，再用未见过的 AWS 官方练习校准。未达到就延长 1–2 周补弱；这些是学习建议，不保证通过。')
  ], [d('总分不错但某领域持续薄弱', '按领域补课并重新验证', '总分可能掩盖覆盖缺口。'), d('对本站题目已记住答案', '切换未见过的官方练习并口述推理', '检验迁移能力，而不是答案记忆。')], ['模拟正确率不是 AWS 量表分。', '重复题高分不能作为唯一报考依据。'], ['完成两次限时模拟并记录错因。', '确认考试当日规则、证件、语言和预约信息。'], [ref('SAA-C03 exam guide', 'https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html'), ref('AWS exam overview and preparation', 'https://aws.amazon.com/certification/certified-solutions-architect-associate/')])
];

const step = (title, detail, verify) => ({ title, detail, verify });
const lab = (n, title, subtitle, minutes, level, services, cost, goal, steps, cleanup, deliverable, sources) => ({ id: `lab-${String(n).padStart(2, '0')}`, title, subtitle, minutes, level, services, cost, goal, steps, cleanup, deliverable, sources });

export const labs = [
  lab(1, '建立实验边界与费用护栏', '先知道自己在哪个账户、哪个区域工作', 60, '入门', ['IAM', 'Budgets'], '仅使用账户检查与预算通知；部分预算功能可能收费。费用数据有延迟，预算通知不是消费硬上限。', '建立可重复的实验准备、命名和清理习惯。', [
    step('选择专用练习环境', '使用你有权限的 sandbox 账户；不要在生产账户中试验。记录账户别名、账户 ID 与一个固定 Region。日常操作使用个人联合身份或适当角色，不使用 root。', '能明确说出当前身份、账户与 Region。'),
    step('检查登录保护', '检查高权限身份启用 MFA；查看是否有不再使用的长期访问密钥，但不要删除不确定用途的现有凭证。创建本次实验资源时统一使用 saa-lab- 前缀。', '记录使用的登录方式与资源命名规则，不记录秘密。'),
    step('设置预算通知', '在 Billing 的 Budgets 中查看预算类型与当前计费说明，建立适合自己的小额月费用预算和实际/预测费用通知；通知地址使用本人邮箱。', '预算详情显示正确范围、阈值和收件人。'),
    step('建立资源台账', '创建一个本地表，包含资源名称、Region、创建时间、用途、删除顺序和已清理状态。以后每次实验先登记。', '台账至少有六列，并有下一次实验的空白模板。'),
    step('记录恢复与暂停规则', '约定每次实验最长运行时间，遇到不明费用立即停止新增资源并排查。标明费用页检查时间，不假设免费额度一定适用。', '能在两分钟内找到费用页面和本次资源列表。')
  ], ['保留有用的个人费用预算；不再需要时删除本次创建的预算。', '确认没有意外创建计算、数据库或 NAT 资源。'], '一页实验守则与资源台账，包含账户/区域、预算阈值及清理流程。', [ref('Managing costs with AWS Budgets', 'https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html')]),
  lab(2, '最小权限策略推演', '不创建真实数据，先验证 Allow 与 Deny', 90, '入门', ['IAM'], '可在本地完成，不需要创建收费 AWS 资源。使用 IAM Policy Simulator 时须有相应权限。', '为指定 bucket 前缀设计读权限，并解释拒绝原因。', [
    step('定义需求', '假设 bucket 为 saa-lab-example，仅允许读取 reports/ 前缀。列出 s3:ListBucket（bucket ARN）与 s3:GetObject（对象 ARN）分别针对的资源。', '能写出 arn:aws:s3:::saa-lab-example 与 arn:aws:s3:::saa-lab-example/reports/*。'),
    step('写最小策略', '在本地写 JSON：GetObject 仅允许 reports/*；ListBucket 用 s3:prefix 条件限制为 reports/ 及其子路径。不要使用 s3:* 或全资源 *。', 'JSON 可解析，Action 与 Resource 层级匹配。'),
    step('做四个用例', '测试读取 reports/a.txt、读取 private/a.txt、删除 reports/a.txt、列举 reports/。先写出预期，再使用 IAM Policy Simulator 的自定义策略模式或按策略逐条推演。', '预期分别为允许、拒绝、拒绝、允许。'),
    step('加入显式拒绝', '增加 Deny s3:GetObject 到 reports/confidential/*，再次测试该路径。记录为什么原有 Allow 不足以覆盖 Deny。', '能说明适用显式 Deny 的优先级。'),
    step('解释模拟边界', '记录模拟器不等于真实环境，跨账户、资源策略、上下文与组织限制可能影响结果。此次不向任何现有身份附加策略。', '报告包含“尚未进行真实访问验证”的边界说明。')
  ], ['删除本地不再需要的临时策略副本。', '若另外创建了测试策略且未使用，确认无附件后删除；不要改动已有角色。'], '最小权限 JSON 与五项测试结果、拒绝原因表。', [ref('IAM policy simulator', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html')]),
  lab(3, 'S3 版本恢复与私有下载', '亲手恢复误删的对象', 90, '入门', ['S3'], '少量对象仍可能产生存储、请求与传输费；不要创建 Object Lock 合规保留，不依赖免费额度。', '验证版本控制、删除标记和临时下载权限。', [
    step('创建专用 bucket', '在固定 Region 创建全球唯一名称的 saa-lab- bucket，保留 Block Public Access，启用 Versioning，使用默认服务器端加密。上传不含个人数据的小文本文件 note.txt。', 'bucket 未公开，Versioning 为 Enabled。'),
    step('创建第二个版本', '修改 note.txt 内容并再次上传同一个 key。在对象版本列表中记录两个 version ID 和各自内容。', '能下载两个不同内容的版本。'),
    step('模拟误删并恢复', '正常删除对象，查看 delete marker。只删除该删除标记以重新暴露旧版本，或复制所需旧版本为新的当前版本。', '不指定 version ID 下载时能得到恢复后的正确内容。'),
    step('创建短期下载链接', '使用控制台或 AWS CLI 生成有效期很短的 presigned URL。用私人浏览窗口测试。链接本身含授权信息，不要提交 Git 或分享。', '有链接时可下载，未签名的私有对象 URL 被拒绝。'),
    step('设计生命周期', '在草稿中分别规划当前版本、非当前版本和未完成分段上传的清理。解释为什么只过期当前版本不能清空历史。', '草稿包含三类对象状态及保留理由。'),
    step('清空并删除', '使用控制台 Empty 功能清除本次 bucket 的全部版本和删除标记，确认空后删除 bucket。', '资源台账标记已删除，bucket 不再出现在列表。')
  ], ['删除所有对象版本及 delete marker，再删除本次 bucket。', '移除本地保存的 presigned URL；不要留下公开策略。'], '版本恢复前后证据和一段“普通删除为何仍计费”的解释。', [ref('S3 versioning', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html'), ref('Delete object versions', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeletingObjectVersions.html')]),
  lab(4, '双 AZ 网络设计与路由验证', '零计算资源，也能练清楚 VPC', 120, '入门', ['VPC', 'Route Table', 'Security Group'], '仅创建 VPC、子网、路由表、安全组和 IGW 通常不产生这些资源本身的小时费用；不要创建 NAT、Interface Endpoint、EC2 或公网 IPv4。可全程本地画图。', '完成一个双 AZ 的三层网络，并逐跳解释流量。', [
    step('规划 CIDR', '设计 VPC 10.20.0.0/16，AZ-A/B 各分配一个公共和一个私有 /24 子网。保证不重叠，标注每个子网用途。', '四个子网都在 VPC 范围内且互不重叠。'),
    step('建立网络骨架', '选择仅 VPC 的创建方式，手动添加四个子网，避免使用会自动创建 NAT 的快捷配置。也可用本地架构图替代真实创建。', '资源清单中没有 NAT Gateway、EC2 或收费端点。'),
    step('设置路由关系', '为公共子网关联具有 0.0.0.0/0 → IGW 的路由表；私有子网暂仅保留 local 路由。图中注明未来如需出站将如何配置 NAT 或端点。', '能指出私有实例此时为何不能访问公网。'),
    step('设计安全组链', '设计 ALB SG 接受 HTTPS，app SG 仅接受 ALB SG 的应用端口，db SG 仅接受 app SG 的数据库端口。不实际启动服务器。', '没有数据库向 0.0.0.0/0 开放的规则。'),
    step('做故障推演', '分别删去图中的 IGW 路由、app 入站规则及 NACL 回包规则，预测症状并说明修复点。写出一个 AZ 失效后的剩余路径。', '四个场景都有清晰的断点与检查顺序。'),
    step('清理骨架', '若创建了资源，先删除自建安全组与子网、非默认路由表，分离并删除 IGW，再删除专用 VPC。', '仅本次资源被删除，原有默认 VPC 保持不变。')
  ], ['确认未创建 NAT Gateway、收费端点、EC2 或公网 IPv4。', '删除本次专用 VPC 及其自建依赖，不删除已有网络。'], '带 CIDR、路由、安全组和故障路径的双 AZ 架构图。', [ref('VPC subnet routing', 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html')]),
  lab(5, '无状态应用与伸缩推演', '从单台机器改为可替换实例', 120, '进阶', ['ALB', 'Auto Scaling', 'S3', 'RDS'], '本实验为本地设计练习，不启动 ALB、EC2、RDS 或 NAT，不产生 AWS 资源费用。', '设计可替换、跨 AZ 的应用，并确定伸缩指标。', [
    step('描述原系统', '假设一台 EC2 保存本地上传、内存登录会话并连接单台数据库。写出故障时会丢失或不可用的东西。', '至少列出实例、会话、上传文件、数据库四个风险。'),
    step('拆分状态', '把上传文件移到 S3，把会话移到合适的共享存储；实例仅运行应用。解释是否还需要 sticky session。', '任意实例被替换不会丢失已持久化用户数据。'),
    step('规划负载均衡', '画出 ALB、两个 AZ 中的 ASG 实例与私有数据库。设定 min/desired/max 示例值，解释容量如何满足单 AZ 失效。', '图中有健康检查和故障后的流量路径。'),
    step('选择伸缩指标', '为 HTTP 应用比较 CPU 与每目标请求量；为队列消费者比较 CPU 与每实例 backlog。记录指标、目标和观察窗口。', '指标与业务处理能力相关，而非只因容易获取。'),
    step('演练三个故障', '模拟一台实例坏、一整个 AZ 坏、数据库连接耗尽。分别写出自动恢复、剩余风险和需要的告警。', '能解释为什么 ASG 不能自动消除数据库瓶颈。'),
    step('完成决策记录', '用一页表写出 ALB/NLB、EFS/S3、Multi-AZ/Read Replica 的选择与拒绝理由。', '每个选择都能关联到原始需求。')
  ], ['无 AWS 资源需要删除。', '检查设计文档不含真实密码、账户秘密或生产地址。'], '三层架构图、伸缩指标表和三份故障推演。', [ref('Auto Scaling design', 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html')]),
  lab(6, '数据库选型与恢复桌面演练', '把高可用、读扩展和备份分开验证', 120, '进阶', ['RDS', 'Aurora', 'DynamoDB'], '本地设计练习，不创建数据库实例或集群，不产生 AWS 资源费用。', '对三种数据需求做选型，并写出可执行的恢复检查清单。', [
    step('建立三个场景', '分别设定关系型订单交易、按用户 ID 访问购物车、读取密集的 BI 报表；写下查询模式、一致性和恢复要求。', '每个场景都有明确查询与约束。'),
    step('比较服务', '为每个场景选择 RDS/Aurora、DynamoDB 或分析方案，写出为何其他候选不合适。不要只按数据量大小选择。', '关系模型与访问模式支撑选择。'),
    step('区分三类副本', '画出 RDS Multi-AZ DB instance standby、read replica、Aurora reader 的作用。标明哪些服务读流量、哪些用于故障切换。', '没有把传统 standby 当作报表读取节点。'),
    step('写恢复脚本式清单', '假设误删订单，按确定恢复点、恢复新数据库、检查样本/行数、验证权限、切换应用、监控、回退写步骤。', '恢复完成的判定包括业务数据而不只是实例可用。'),
    step('测算目标', '设定 RPO 15 分钟、RTO 60 分钟，为每一步预留时间，并指出哪些耗时尚需真实演练验证。', '总步骤预算不超过目标，未知项明确标记。')
  ], ['无 AWS 数据库资源需要删除。', '仅使用虚构数据，不复制真实客户记录。'], '三个选型决策、数据库副本对比图与恢复 runbook。', [ref('RDS backups', 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html')]),
  lab(7, '创建一个可观察的 Lambda', '部署、调用、失败与清理', 90, '入门', ['Lambda', 'CloudWatch Logs', 'IAM'], '函数调用、日志和保存均可能收费；限制调用次数与日志保留，不创建公网 API、VPC NAT 或并发预置。', '用最小代码观察成功与失败，并理解执行角色。', [
    step('创建专用函数', '在固定 Region 创建 saa-lab-hello，选择控制台支持的 Node.js 运行时，创建仅含基本日志权限的专用执行角色。不连接 VPC。', '函数角色没有 AdministratorAccess。'),
    step('写可测试处理器', '使用处理器代码：export const handler = async (event) => { if (event.fail) throw new Error("intentional-lab-failure"); console.log(JSON.stringify({lab:true,request:event.name ?? "learner"})); return {message:`Hello ${event.name ?? "learner"}`}; };', '部署成功，handler 文件格式与所选运行时配置一致。'),
    step('运行成功与失败用例', '测试 {"name":"SAA"} 和 {"fail":true}，每种只调用一两次。记录返回值、错误与 duration。', '成功返回问候，失败显示预期错误。'),
    step('找到日志', '打开关联 CloudWatch log group，找到本次日志流；设置较短保留期，例如 1 天。不要打印凭证或个人信息。', '日志能对应到本次调用，保留期已设置。'),
    step('说明权限与重试', '写下执行角色与调用函数权限的区别；记录此次同步测试与异步触发失败处理不同。', '报告没有把手动调用失败自动当成 SQS 重试。'),
    step('清理', '删除函数，删除本次专用日志组；确认角色只用于此实验后删除角色及其专用策略。', '函数、日志组和专用角色均完成清理。')
  ], ['删除 Lambda 函数及其本次专用日志组。', '删除只属于本实验的执行角色/策略；不要删除共享角色。'], '成功/失败测试记录、日志证据和执行角色解释。', [ref('Lambda console getting started', 'https://docs.aws.amazon.com/lambda/latest/dg/getting-started.html')]),
  lab(8, 'SQS 的重复交付与死信', '看到消息消失、重现和进入 DLQ', 90, '入门', ['SQS'], '少量 API 请求可能收费；只发送几条无敏感数据的消息，不持续运行消费者。', '亲自验证 visibility timeout、删除与死信转移。', [
    step('创建两个专用队列', '建立 Standard 主队列 saa-lab-main 与 DLQ saa-lab-dlq。主队列 visibility timeout 设为便于观察的 30 秒；设置 redrive 到 DLQ，maxReceiveCount 设为 2。', '主队列详情显示正确 DLQ；消息保留期足够完成实验。'),
    step('发送带业务 ID 的消息', '发送 {"orderId":"demo-001","action":"reserve"}，记录消息 ID，另说明业务 ID 用于幂等而非依赖传输 ID。', '消息体没有真实个人信息。'),
    step('接收但不删除', '在控制台接收一次，不点击删除。等待可见性超时，再次接收，观察同一业务消息重新出现。', '能解释消息临时不可见而不是已完成。'),
    step('观察 DLQ', '按配置重复接收并等待；转移可能不是即时的。停止额外轮询后检查 DLQ 中消息。', 'DLQ 出现原始业务消息，或记录计数/等待状态和排查路径。'),
    step('成功处理对照', '再发送 demo-002，接收并删除，等待超时后确认不再出现。写一个用 orderId 记录已处理状态的幂等设计。', '删除成功的消息不会因可见性超时再次可见。'),
    step('清理队列', '删除主队列和 DLQ，确认没有本次 Lambda event source mapping 或其他消费者。', '两个专用队列均不存在。')
  ], ['删除主队列与 DLQ。', '停止轮询，不保留本次消息或长期消费者。'], '消息生命周期图、DLQ 证据和幂等伪代码。', [ref('SQS visibility timeout', 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html'), ref('SQS DLQ', 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html')]),
  lab(9, '用日志发现并解释一次故障', '从现象到指标，再到响应动作', 90, '进阶', ['CloudWatch', 'Lambda'], '复用或临时创建少量 Lambda 调用；CloudWatch 日志、查询和告警可能收费，练习后删除。不配置高频自定义指标。', '建立“问题—信号—响应”的最小闭环。', [
    step('复用专用测试函数', '复用实验 7 的测试代码，若已清理则重新建立专用函数和基本执行角色。分别调用成功、失败两次，不连接外部系统。', '能在日志中找到 intentional-lab-failure。'),
    step('比较指标与日志', '查看 Invocations、Errors、Duration；解释指标适合趋势，日志适合单次上下文。允许指标出现延迟，不持续大量触发。', '能把错误次数与实际测试对应。'),
    step('做一次受限日志查询', '在 Logs Insights 中只选本次日志组和最近短时间窗口，查询 fields @timestamp, @message | filter @message like /intentional-lab-failure/ | sort @timestamp desc | limit 20。', '查询仅返回本次失败记录并查看扫描量。'),
    step('设计告警与响应', '可仅在本地写告警草稿：错误数/错误率阈值、窗口、缺失数据行为、负责人和响应步骤。若创建实际告警，限定本函数且使用本人通知渠道。', '每条告警都有明确动作，避免只写“通知”。'),
    step('清理并总结', '删除本次实际创建的告警、函数、日志组与专用角色。写出 CloudTrail 是否能替代此次应用日志以及原因。', '台账中的所有本次资源均有清理状态。')
  ], ['删除本次告警、Lambda、日志组与专用 IAM 角色。', '若创建 SNS 通知主题，删除本次主题与订阅。'], '一次故障调查记录和可执行告警响应卡。', [ref('CloudWatch Logs Insights', 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html')]),
  lab(10, '灾难恢复演练与成本对比', '让 RTO/RPO 成为可核查的目标', 120, '进阶', ['AWS Backup', 'Route 53', 'Pricing Calculator'], '仅做桌面演练与公开价格计算，不创建跨 Region 数据库、复制或托管区，不产生 AWS 资源费用。', '为同一系统选择恢复策略并量化取舍。', [
    step('写业务需求', '虚构一个订单 API：RPO 15 分钟、RTO 60 分钟、允许单 Region 失效，平时流量中等。列出数据库、对象、秘密、DNS 和部署配置。', '覆盖应用以外的恢复依赖。'),
    step('比较三种方案', '分别设计 backup/restore、pilot light、warm standby；说明平时运行组件、故障后需要创建的组件和数据复制方式。', '三种方案的差别不是只写“快、中、慢”。'),
    step('进行计时桌面推演', '按检测、决策、基础设施、数据、验证、切流、观测划分步骤。假设部分步骤失败，增加回退分支。', '总预计时间可与 RTO 比较，未验证的估计单独标注。'),
    step('估算相对费用', '使用 Pricing Calculator 录入一致 Region、容量与运行时间；保留假设。不要把计算器估价当最终账单或忽略复制/传输。', '每个方案都包含常驻计算、存储及流量假设。'),
    step('选择并写风险', '选择满足目标的较低复杂度方案，写出还需真实恢复测试的部分，以及业务目标改变时何时升级策略。', '决策由 RTO/RPO 与证据支撑。')
  ], ['无 AWS 资源需要删除。', '保存估算日期和假设，移除可能含真实内部信息的草稿。'], '恢复 runbook、时间预算和三方案成本对比。', [ref('Disaster recovery', 'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html'), ref('AWS Pricing Calculator', 'https://calculator.aws/')]),
  lab(11, '综合项目：可靠的订单平台', '一张架构图，覆盖四个考试领域', 180, '综合', ['CloudFront', 'S3', 'API Gateway', 'Lambda', 'DynamoDB', 'SQS'], '本实验提交设计与伪代码，不要求部署整套系统，因此不产生 AWS 资源费用。若自行部署，应另行估价并安排完整清理。', '独立完成一个有安全、扩展、重试、监控和成本说明的方案。', [
    step('明确验收标准', '设定：静态前端、登录用户创建订单、峰值突增、通知允许异步、禁止重复扣款、数据需备份。写出延迟、一致性及 RTO/RPO 的假设。', '至少六条可验证要求，不用“高性能”代替数字或范围。'),
    step('画请求与事件路径', '设计 CloudFront/S3 前端，API Gateway/Lambda 入口，合适数据库存订单，SQS 缓冲异步任务；注明何处需要 SNS 扇出。', '同步响应与异步处理分开标记。'),
    step('设计安全边界', '列出用户认证、最小权限角色、私有对象访问、TLS、密钥/秘密管理及审计点。不要把凭证写入前端。', '每条数据路径均有身份或访问边界说明。'),
    step('定义重复与失败处理', '写 createOrder(orderId) 幂等伪代码；给消费者设计重试、visibility timeout、DLQ、重放与告警。', '同一业务请求重放不会创建第二笔订单。'),
    step('应对故障与成本', '说明下游变慢、单组件失败、误删数据、流量翻倍时的行为；列出前三项费用驱动与优化方式。', '优化没有违反既定可靠性与一致性约束。'),
    step('自我架构评审', '按安全、韧性、性能、成本四个领域各提出两条问题，修改设计。用五分钟向假想同事解释取舍。', '交付物有图、决策、失败路径和未验证事项。')
  ], ['确认未意外部署云资源；如果额外部署，按依赖顺序清理并核查账单。', '文档不含真实秘密或用户数据。'], '可展示的架构方案：图、决策记录、幂等伪代码、监控和成本表。', [ref('Serverless applications lens', 'https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html')]),
  lab(12, '考前架构答辩与资源审计', '用讲清楚和做干净收尾', 120, '综合', ['Well-Architected', 'Billing', 'Resource Review'], '以本地口述与账户只读检查为主；不要为验证知识重新启动收费资源。', '证明自己理解架构取舍，并确认实验已清理。', [
    step('盲讲六组对比', '不查资料，各用两分钟解释 SQS/SNS、ALB/NLB、Multi-AZ/Read Replica、S3/EFS/EBS、CloudFront/Global Accelerator、KMS/Secrets Manager。', '每组给出选用场景、限制和一个容易误判的题目。'),
    step('抽查三条失败路径', '从综合项目随机选实例/区域故障、重复消息、数据误删中的三项，口述检测、恢复和剩余风险。', '能区分可用性、备份与灾难恢复。'),
    step('复核所有实验台账', '逐 Region 核查本次创建的计算、数据库、NAT、端点、负载均衡、存储版本、日志组、队列及专用 IAM 资源。只处理明确属于本次的资源。', '每项均标记已删除、明确保留原因或待处理。'),
    step('检查费用与知识缺口', '查看费用趋势，记住数据可能延迟；把仍解释不清的主题加入错题复习。不要因为当天余额为零就认定所有资源已清理。', '有下一次费用复查日期及未决事项。'),
    step('做报考决策', '结合两次限时模拟、各领域表现、未见官方练习、实验完成情况判断。未达标则计划 1–2 周补弱；达标后再核对官方考试要求。', '决策注明依据，不以“已学满八周”作为唯一理由。')
  ], ['完成所有实验资源的逐项清理核对。', '保留必要的学习笔记和预算通知，清除临时下载链接与凭证痕迹。'], '考前就绪表、六组服务对比口述记录和最终资源清理台账。', [ref('Official SAA preparation', 'https://aws.amazon.com/certification/certified-solutions-architect-associate/')])
];

const task = (id, title, kind, minutes, detail, target = {}) => ({ id, title, kind, minutes, detail, ...target });
export const weeks = [
  { id: 1, title: '校准基础，建立安全边界', focus: 'IAM · VPC · 费用护栏', hours: 10, lessonIds: ['lesson-01','lesson-02','lesson-03','lesson-04'], labIds: ['lab-01','lab-02'], tasks: [
    task('w1-learn', '梳理架构基础、IAM 与网络', 'learn', 180, '四课各约45分钟。做服务对比笔记，圈出不熟悉的概念。', {lessonIds:['lesson-01','lesson-02','lesson-03','lesson-04']}),
    task('w1-guardrails', '完成实验边界与费用护栏', 'lab', 60, '登记账户、区域和清理台账，配置适合自己的预算通知。', {labId:'lab-01'}),
    task('w1-iam', '推演最小权限策略', 'lab', 90, '编写策略并完成允许/拒绝用例。', {labId:'lab-02'}),
    task('w1-lab-review', '整理实验证据与清理记录', 'lab', 30, '为两项实验保存交付物，不记录秘密。'),
    task('w1-practice', '安全与网络专题练习', 'practice', 180, '先做20–30道题并逐题解释；剩余时间读错题来源、重做薄弱场景。题量以理解为准。'),
    task('w1-review', '周复盘：策略与数据包路径', 'review', 60, '不看笔记口述IAM判断及公网/私网区别，设置下一周优先复习项。')
  ], milestone: '能解释角色、显式拒绝、路由、安全组与 NACL；完成费用护栏。' },
  { id: 2, title: '让计算和存储真正可靠', focus: 'EC2 · ALB/ASG · S3 · 文件系统', hours: 10, lessonIds: ['lesson-05','lesson-06','lesson-07','lesson-08'], labIds: ['lab-03','lab-04'], tasks: [
    task('w2-learn', '学习计算伸缩与存储选型', 'learn', 150, '阅读四课并重点比较EBS/EFS/S3与ALB/NLB。', {lessonIds:['lesson-05','lesson-06','lesson-07','lesson-08']}),
    task('w2-s3', '完成 S3 版本恢复', 'lab', 90, '验证私有访问、版本与删除标记，最后清空所有版本。', {labId:'lab-03'}),
    task('w2-vpc', '完成双 AZ 网络设计', 'lab', 120, '画路由与安全组，做四个故障推演。', {labId:'lab-04'}),
    task('w2-practice', '计算与存储专题练习', 'practice', 180, '完成约25–35题并复盘；记录为何其他存储或负载均衡不适合场景。'),
    task('w2-review', '周复盘与资源清理', 'review', 60, '复习第1周错题；确认S3历史版本和网络实验资源已清理。')
  ], milestone: '能从协议、状态、性能和恢复需求选择计算/存储方案。' },
  { id: 3, title: '掌握数据层和扩展边界', focus: 'RDS · Aurora · DynamoDB · 缓存', hours: 10, lessonIds: ['lesson-09','lesson-10'], labIds: ['lab-05','lab-06'], tasks: [
    task('w3-learn', '学习数据库与缓存，补读官方文档', 'learn', 120, '重点区分Multi-AZ、read replica与缓存一致性。', {lessonIds:['lesson-09','lesson-10']}),
    task('w3-scaling', '完成无状态伸缩推演', 'lab', 120, '从单实例改为可替换应用，指定指标和故障路径。', {labId:'lab-05'}),
    task('w3-data', '完成数据库选型与恢复演练', 'lab', 120, '比较三个数据场景，完成恢复runbook。', {labId:'lab-06'}),
    task('w3-practice', '数据库与韧性专题练习', 'practice', 180, '做题后分别写出高可用、读取扩展、数据恢复的需求关键词。'),
    task('w3-review', '周复盘：恢复不只看数据库启动', 'review', 60, '回顾第1–2周错题，口述数据库恢复后的验证步骤。')
  ], milestone: '能解释复制延迟、分区键、缓存失效和数据库恢复流程。' },
  { id: 4, title: '连接服务，处理失败', focus: 'Lambda · 容器 · SQS/SNS · 工作流', hours: 10, lessonIds: ['lesson-11','lesson-12','lesson-13','lesson-14'], labIds: ['lab-07','lab-08'], tasks: [
    task('w4-learn', '学习 Serverless、容器和事件系统', 'learn', 180, '读四课，画同步API与异步消息两条路径。', {lessonIds:['lesson-11','lesson-12','lesson-13','lesson-14']}),
    task('w4-lambda', '部署并观察 Lambda', 'lab', 90, '执行成功与失败用例，检查角色及日志后清理。', {labId:'lab-07'}),
    task('w4-sqs', '验证 SQS 重复交付和 DLQ', 'lab', 90, '观察可见性超时，写出幂等设计。', {labId:'lab-08'}),
    task('w4-practice', '事件与解耦专题练习', 'practice', 180, '重点练SQS/SNS/EventBridge/Step Functions选择与重试语义。'),
    task('w4-review', '周复盘：画出消息完整生命周期', 'review', 60, '复习旧错题，核对Lambda日志与队列均已清理。')
  ], milestone: '能设计幂等消费者、死信处理和可观测的异步流程。' },
  { id: 5, title: '全球交付、安全与恢复', focus: 'CloudFront · KMS · 监控 · DR', hours: 10, lessonIds: ['lesson-15','lesson-16','lesson-17','lesson-18'], labIds: ['lab-09','lab-10'], tasks: [
    task('w5-learn', '学习边缘、安全和恢复策略', 'learn', 150, '对比CloudFront/Global Accelerator及各安全检测服务。', {lessonIds:['lesson-15','lesson-16','lesson-17','lesson-18']}),
    task('w5-observe', '完成一次日志故障调查', 'lab', 90, '连接指标、日志与响应动作，并完成清理。', {labId:'lab-09'}),
    task('w5-dr', '比较恢复策略与成本', 'lab', 120, '用RTO/RPO推导方案，记录尚未验证的假设。', {labId:'lab-10'}),
    task('w5-practice', '安全、边缘与恢复混合练习', 'practice', 180, '做多领域混合题，记录因忽略约束导致的错题。'),
    task('w5-review', '周复盘：一项信号对应一个行动', 'review', 60, '回顾服务对比，检查KMS权限、恢复目标和监控职责。')
  ], milestone: '能按RTO/RPO选择恢复方案，区分审计、监控、检测和阻断。' },
  { id: 6, title: '完成可展示的架构项目', focus: '分析 · 迁移 · 成本 · 综合设计', hours: 10, lessonIds: ['lesson-19','lesson-20','lesson-21','lesson-22'], labIds: ['lab-11'], tasks: [
    task('w6-learn', '学习分析、迁移与成本优化', 'learn', 180, '读四课，比较DMS/DataSync/Transfer Family及购买方式。', {lessonIds:['lesson-19','lesson-20','lesson-21','lesson-22']}),
    task('w6-project', '完成可靠订单平台设计', 'lab', 180, '提交架构图、决策、幂等逻辑、监控与成本说明。', {labId:'lab-11'}),
    task('w6-practice', '四领域混合练习', 'practice', 180, '按领域观察弱项，优先解释陌生场景和猜对的题。'),
    task('w6-review', '项目评审与费用审查', 'review', 60, '用四大领域检查项目，核对所有已创建资源的清理状态。')
  ], milestone: '有一份能讲清取舍的完整架构项目；核心课程完成22课。' },
  { id: 7, title: '第一次完整模拟与补弱', focus: '限时 65 题 · 错因分类 · 架构答辩', hours: 10, lessonIds: ['lesson-23','lesson-24'], labIds: ['lab-12'], tasks: [
    task('w7-learn', '学习综合做题法与考试策略', 'learn', 90, '阅读最后两课，明确量表分与练习正确率的区别。', {lessonIds:['lesson-23','lesson-24']}),
    task('w7-mock', '完成第一次 130 分钟模拟', 'practice', 130, '独立完成65题，不查资料；标记猜测题并保留检查时间。'),
    task('w7-analyze', '逐题复盘与错因分类', 'review', 150, '将错误分为知识缺口、忽略约束、服务混淆和时间管理；猜对也复盘。'),
    task('w7-remediate', '补齐最弱的两个主题', 'learn', 110, '回到课程和官方文档，用新场景重新解释，不只重记答案。'),
    task('w7-defense', '完成架构答辩与资源审计', 'lab', 120, '盲讲服务对比，完成所有实验的清理检查。', {labId:'lab-12'})
  ], milestone: '获得一份真实弱项清单，能说明错因；实验全部完成并清理。' },
  { id: 8, title: '校准就绪度，决定报考', focus: '第二次模拟 · 未见题校准 · 最终复习', hours: 10, lessonIds: ['lesson-24'], labIds: [], tasks: [
    task('w8-mock', '完成第二次限时整套模拟', 'practice', 130, '尽量选不同题；本站题库有限，重复题成绩仅作参考。'),
    task('w8-analyze', '复盘并按领域对照目标', 'review', 120, '目标为连续两次模拟≥80%、各领域≥75%；这些是建议而非官方通过线。'),
    task('w8-official', '使用未见过的官方练习校准', 'practice', 120, '从AWS官方备考页进入Skill Builder练习，可能需登录或付费；不依赖记住本站答案。'),
    task('w8-remediate', '最终补弱与服务对比', 'learn', 120, '重点复习仍无法口述理由的主题，查看官方最新考试信息。'),
    task('w8-ready', '完成就绪、清理与考试安排检查', 'review', 110, '核对实验台账、费用、证件和考试规则；未达目标则延长1–2周针对性学习。')
  ], milestone: '用模拟、未见官方练习和实验成果决定是否报考；未达标则明确延期补弱。' }
];

export const resources = [
  { id:'exam-guide', category:'考试', title:'SAA-C03 官方考试指南', description:'考试范围、四大领域、题型与量表分。本站内容核对日期：2026-11-13。', url:'https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html' },
  { id:'exam-overview', category:'考试', title:'官方考试与备考入口', description:'65题、130分钟；确认最新考试信息、语言、价格、预约和官方练习入口。', url:'https://aws.amazon.com/certification/certified-solutions-architect-associate/' },
  { id:'skill-builder', category:'练习', title:'AWS Skill Builder', description:'官方课程、练习和实验；部分内容需登录或付费。使用未见题校准学习效果。', url:'https://skillbuilder.aws/' },
  { id:'well-architected', category:'架构', title:'Well-Architected Framework', description:'用六个支柱评审架构，理解业务约束与技术取舍。', url:'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html' },
  { id:'aws-docs', category:'文档', title:'AWS Documentation', description:'查证服务边界、配置和变动；以当前官方文档为准。', url:'https://docs.aws.amazon.com/' },
  { id:'workshops', category:'实验', title:'AWS Workshops', description:'官方动手工作坊。执行前检查资源、区域、费用和清理章节。', url:'https://workshops.aws/' },
  { id:'calculator', category:'成本', title:'AWS Pricing Calculator', description:'按区域、用量和运行时间估算架构费用；估算不是最终账单。', url:'https://calculator.aws/' },
  { id:'free-tier', category:'成本', title:'AWS Free Tier 当前条款', description:'免费计划、额度与资格可能变化；不要假设实验一定免费。', url:'https://aws.amazon.com/free/' },
  { id:'dr', category:'架构', title:'AWS 灾难恢复白皮书', description:'从RTO/RPO选择备份恢复、pilot light、warm standby或多站点方案。', url:'https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html' }
];
