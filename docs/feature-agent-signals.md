# Agent 开发日报功能说明

## 0. 文档状态

- 模块名称：Agent Signals / Agent 开发日报
- 所属里程碑：M3
- 当前状态：MVP 已实现，首页模块入口卡和 `/signals` 页面已接入；公开数据已扩展到 26 条并启用分页浏览
- 主要数据源：人工维护记录；自动搜索、抓取和提炼后的人工确认结果；飞书聊天每日脱敏候选
- 公开策略：只展示公开来源、中文侦察摘要、侦察价值判断、能力要求和后续行动；不展示账号、私密面试记录、内部项目名或未审阅原文
- 关联总规划：`docs/agent-showcase-plan.md`
- 模块流程要求：`docs/module-spec-process.md`
- 计划数据文件：`data/agent-signals.json`
- 计划页面入口：`/signals`
- 首页入口：`app/page.tsx` 展示模块入口卡
- 验证命令：`npm run verify`

## 1. 功能目标

持续收集 Agent 工程方向的招聘需求、技术趋势、开源项目、产品更新、论文和人工复盘，形成一个公开可读的学习雷达。这个模块在定位上相当于军队中的侦察兵，是后续周报、文章、项目说明和能力判断的信息源头。

面向用户：

- 技术面试官：快速看到我如何追踪 Agent 工程要求，并把外部信号转成学习行动。
- 同事朋友：理解我近期关注的 Agent 方向主题和工程判断。
- 自己：沉淀每日/每周观察，后续可复用到文章、项目说明和简历表达。

证明能力：

- 持续学习和信息筛选能力。
- 从市场/技术信号提炼工程能力要求的能力。
- 把搜索结果、文章和产品更新提炼成中文情报摘要和判断的能力。
- 把观察转化为行动项和项目演进的能力。
- 对公开展示边界和隐私风险的控制能力。

## 2. MVP 范围

第一版必须实现：

- 新增公开数据文件 `data/agent-signals.json`。
- 支持首批 5-20 条人工维护或人工确认后的 Agent 信号记录，并通过分页承载后续持续归档。
- 首页展示 Agent Signals 模块入口卡。
- `/signals` 页面展示完整列表，并支持分页、按来源类型和能力标签浏览。
- 每条记录展示日期、来源类型、标题、公开链接、中文侦察摘要、侦察价值判断、能力要求、当前差距、后续行动。
- 提供空状态、过期提示和数据来源说明。
- 提供 schema、排序、隐私扫描和 UI 状态测试。

第一版不做：

- 不自动原样发布搜索结果。
- 不展示原始网页全文、原始招聘 JD 全文或抓取 HTML。
- 不展示私密面试细节、公司内部信息、账号、邮箱、API key、本机路径、prompt 或内部项目名。
- 不做完整博客系统。
- 不做复杂推荐算法或热度评分。
- 不做登录、后台编辑器或数据库。

## 3. 数据来源与隐私边界

数据来源：

- 手工添加的公开文章、开源项目、产品更新和论文记录。
- 手工添加的招聘需求观察，只保留公开链接和脱敏摘要。
- 后续自动搜索产生的候选记录，但必须经过人工确认后才能进入公开 JSON。
- 文章候选搜索按 70% 国外著名 Agent 论坛社区、30% 中国 Agent 论坛社区配比执行。
- 招聘候选搜索按 20% 国外岗位、80% 国内岗位配比执行，国内岗位必须覆盖 BOSS 直聘和 51job / 前程无忧。
- 飞书聊天候选每天采集一次，只保留 Agent 主题、公开 URL、计数和脱敏摘要，原始聊天内容不进入公开 JSON。
- 面试中遇到的问题只能以抽象能力要求记录，不能包含公司、人员、题目原文或可识别上下文。

公开字段：

- 日期和记录 ID。
- 来源类型。
- 标题。
- 公开 URL。
- 来源名称。
- 中文脱敏摘要。
- 中文侦察价值判断。
- 能力标签。
- 提炼出的工程师能力要求。
- 与当前能力的公开差距描述。
- 后续行动。
- 可选状态：`planned`、`in_progress`、`done`、`skipped`。

禁止字段：

- 账号、邮箱、API key、组织 ID。
- 原始 prompt、会话路径、本机路径、workspace 路径。
- 内部项目名、客户名、未公开公司信息。
- 私密面试题原文、面试官姓名、候选岗位内部信息。
- 未审阅的抓取正文、HTML、cookie、认证信息。

脱敏规则：

- 招聘或面试信号必须抽象为能力要求，不保留可识别细节。
- 手工记录中的个人差距只能写成公开可接受的学习方向。
- 自动采集结果先进入草稿区或本地临时文件，公开文件只写入人工确认后的记录。
- 自动流程需要把原始文章或网页信息压缩成中文摘要和中文判断，不能把英文原文段落直接当公开结果。
- URL 必须是公开可访问链接；没有公开链接时 `url` 设为 `null`，并说明来源类型。
- 飞书候选输出不能包含 `message_id`、`chat_id`、发送人、原始聊天文本或可识别对话上下文。

## 4. 接口文档

### 4.1 文件接口

路径：

```text
data/agent-signals.json
```

生产方：

- 第一版：人工维护。
- 后续：自动搜索脚本生成候选记录，提炼为中文侦察摘要和侦察判断后，再经人工确认写入公开文件。

消费方：

- 首页 Agent Signals 模块入口卡。
- `/signals` 列表页。
- 后续周总结或文章模块。

兼容策略：

- `schemaVersion` 固定为 `1`。
- 新增可选字段允许向后兼容。
- 删除或重命名字段必须同步更新类型、测试、页面和文档。

错误处理：

- 文件缺失、JSON 非法或 schema 校验失败时，页面展示错误状态，不渲染部分可信数据。
- `signals[]` 为空时展示空状态和模块目的。
- `generatedAt` 超过 7 天时展示数据可能过期提示。

### 4.2 JSON 契约

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-25T15:20:00.000Z",
  "period": {
    "start": "2026-06-17",
    "end": "2026-06-25",
    "timezone": "Asia/Shanghai"
  },
  "source": {
    "mode": "automated_candidates_reviewed",
    "containsRawScrapes": false,
    "containsPrivateInterviewDetails": false,
    "containsLocalPaths": false,
    "collectionPolicy": {
      "articleSearchWeights": {
        "overseasFamousAgentCommunities": 70,
        "chinaAgentCommunities": 30
      },
      "jobSearchWeights": {
        "overseasJobs": 20,
        "chinaJobs": 80
      },
      "requiredChinaJobBoards": ["BOSS 直聘", "51job / 前程无忧"],
      "dailyLarkDigest": {
        "enabled": true,
        "cadence": "daily",
        "queryKeywords": ["agent", "AI Agent", "智能体", "多智能体", "MCP", "workflow"],
        "output": "reviewed_signal_candidates",
        "privacyMode": "summary_only_no_raw_chat"
      }
    }
  },
  "privacy": {
    "publicUrlsOnly": true,
    "redactedFields": [
      "account",
      "email",
      "apiKey",
      "organizationId",
      "rawPrompt",
      "rawScrape",
      "html",
      "cookie",
      "sessionPath",
      "workspacePath",
      "internalProject",
      "privateInterviewDetail"
    ]
  },
  "signals": [
    {
      "id": "2026-06-22-agentic-coding-evals",
      "date": "2026-06-22",
      "sourceType": "article",
      "sourceName": "Public engineering blog",
      "title": "Agentic coding evals are becoming part of engineering workflows",
      "url": "https://example.com/public-article",
      "summary": "公开文章指出，编码 Agent 要稳定进入工程流程，必须依赖评估驱动的迭代机制。",
      "intelValue": "这类内容的侦察价值在于帮助判断外部趋势是否已经从 demo 进入工程治理阶段。",
      "capabilityTags": ["evals", "agentic_coding", "observability"],
      "requirements": [
        "定义可重复执行的编码 Agent 任务集。",
        "跟踪模型和提示词变化后的失败模式。"
      ],
      "currentGap": "还缺一个和 dashboard 打通的轻量公开 eval 示例。",
      "nextAction": "Signals 页面稳定后，设计小型 eval 记录格式。",
      "status": "planned"
    }
  ]
}
```

### 4.3 字段说明

- `schemaVersion`：公开数据契约版本。
- `generatedAt`：公开文件生成或最后人工更新的时间。
- `period`：信号记录覆盖周期。
- `source.mode`：第一版使用 `manual_reviewed`，后续可增加 `automated_candidates_reviewed`。
- `source.containsRawScrapes`：必须为 `false`。
- `source.containsPrivateInterviewDetails`：必须为 `false`。
- `source.containsLocalPaths`：必须为 `false`。
- `source.collectionPolicy.articleSearchWeights`：文章候选搜索权重，固定为国外著名 Agent 论坛社区 70、中国 Agent 论坛社区 30。
- `source.collectionPolicy.jobSearchWeights`：招聘候选搜索权重，固定为国外岗位 20、国内岗位 80。
- `source.collectionPolicy.requiredChinaJobBoards`：国内招聘必须覆盖 BOSS 直聘和 51job / 前程无忧。
- `source.collectionPolicy.dailyLarkDigest`：飞书每日候选配置，只允许输出人工复核候选和脱敏摘要。
- `signals[].id`：稳定 ID，建议用日期加短 slug。
- `signals[].date`：信号日期，格式 `YYYY-MM-DD`。
- `signals[].sourceType`：`job`、`article`、`open_source`、`paper`、`product`、`manual` 之一。
- `signals[].sourceName`：公开来源名称，可为站点、项目、产品或 `Manual note`。
- `signals[].title`：公开标题，不包含私密上下文。
- `signals[].url`：公开链接；没有公开链接时为 `null`。
- `signals[].summary`：中文脱敏摘要，用来回答“这条外部信息在说什么”。
- `signals[].intelValue`：中文侦察价值判断，用来回答“这条信息对 Agent 工程判断有什么价值”。
- `signals[].capabilityTags`：能力标签，用于筛选和后续经验地图关联。
- `signals[].requirements`：提炼出的工程能力要求，建议也使用中文表述。
- `signals[].currentGap`：公开可接受的个人差距描述，建议使用中文表述。
- `signals[].nextAction`：下一步学习、实验或产出动作，建议使用中文表述。
- `signals[].status`：`planned`、`in_progress`、`done`、`skipped` 之一。

## 5. UI 状态

- 正常：首页展示模块入口卡，`/signals` 展示分页列表、来源类型筛选和能力标签筛选。
- 空状态：说明模块用于沉淀 Agent 工程信号，并提示等待第一批记录。
- 错误：数据文件缺失、格式错误或 schema 校验失败时展示数据暂不可用。
- 过期：`generatedAt` 超过 7 天时提示数据可能需要刷新。
- 加载：如果页面后续改成客户端筛选，筛选控件加载时保持列表区域稳定高度。

## 6. 测试用例

| ID | 类型 | 场景 | 期望 |
| --- | --- | --- | --- |
| SIG-001 | Schema | 加载最小合法 `agent-signals.json` | 通过校验，页面可渲染 |
| SIG-002 | Schema | `signals[]` 缺少 `id`、`date`、`title` 或 `summary` | 校验失败 |
| SIG-003 | Schema | `sourceType` 不在允许枚举内 | 校验失败 |
| SIG-004 | Schema | `url` 不是公开 HTTP(S) URL 且不为 `null` | 校验失败 |
| SIG-005 | 隐私 | JSON 中出现邮箱、API key、cookie、本机路径、原始 prompt 或 raw HTML | 测试失败 |
| SIG-006 | 隐私 | `source.containsRawScrapes` 或 `source.containsPrivateInterviewDetails` 为 `true` | 测试失败 |
| SIG-007 | 排序 | 多条记录日期无序 | 页面按日期倒序展示 |
| SIG-008 | UI | 记录超过 5 条 | 首页模块卡只展示摘要指标，完整列表在 `/signals` |
| SIG-009 | UI | `signals[]` 为空 | 展示空状态，不崩溃 |
| SIG-010 | UI | `generatedAt` 超过 7 天 | 展示过期提示 |
| SIG-011 | 筛选 | 按来源类型筛选 | 只展示匹配记录，并保留空结果状态 |
| SIG-012 | 筛选 | 按能力标签筛选 | 只展示匹配记录，标签来自公开字段 |
| SIG-013 | Schema | `summary` 或 `intelValue` 不是中文叙述 | 校验失败 |
| SIG-014 | 覆盖面 | 招聘、文章、产品和开源信号都至少有两条 | 持续沉淀不偏向单一来源或单点样例 |
| SIG-015 | 分页 | 记录超过单页容量 | 首页预览稳定，`/signals` 可分页浏览并保留筛选条件 |
| SIG-016 | 去重 | 已审阅公开 URL 重复入库 | 测试失败，避免持续沉淀变成重复来源堆叠 |
| SIG-017 | 来源策略 | 文章和招聘候选权重发生偏移，或国内招聘缺少 BOSS / 51job | 测试失败 |
| SIG-018 | 来源策略 | 飞书每日候选不是脱敏摘要模式 | 测试失败 |
| SIG-019 | 构建 | 运行构建后扫描静态产物 | 不包含敏感字段、本机路径或原始抓取内容 |

## 7. 验收标准

- `data/agent-signals.json` 符合本文件 JSON 契约。
- 首页能展示 Agent Signals 模块入口卡，不影响现有 token 看板详情页。
- `/signals` 页面能浏览完整信号列表并进行基础筛选。
- 页面和公开 JSON 不包含账号、邮箱、API key、cookie、原始 prompt、本机路径、workspace path、内部项目名、私密面试详情或未审阅抓取正文。
- 空状态、错误状态和过期状态都有明确展示。
- 测试用例 SIG-001 至 SIG-019 有对应自动化或明确手工验证记录。
- `npm run verify` 通过，并扩展到 Agent Signals 相关校验。

## 7.1 验证记录

验证日期：2026-06-25。

已通过命令：

```bash
npm run verify
```

覆盖结果：

- `validate:data`：公开 token JSON 和 Agent Signals JSON schema、隐私边界通过。
- `test`：SIG-001 至 SIG-018、TUD-001 至 TUD-019 自动化测试通过。
- `typecheck`：TypeScript 严格检查通过。
- `build`：Next.js 生产构建通过，首页和 `/signals` 页面可构建。
- `scan:public`：SIG-019 公开构建产物隐私扫描通过，扫描 110 个公开 artifact。

## 8. 实现任务清单

1. 已完成：创建 `data/agent-signals.json` 样例数据。
2. 已完成：定义 Agent Signals TypeScript 类型和 schema 校验函数。
3. 已完成：新增 `scripts/validate-agent-signals.ts`。
4. 已完成：补充 SIG-001 至 SIG-016 测试。
5. 已完成：实现首页 Agent Signals 模块入口卡。
6. 已完成：实现 `/signals` 列表页和筛选控件。
7. 已完成：把 Agent Signals 校验纳入 `npm run verify`。
8. 已完成：更新 README 和总规划文档中的接续状态。
9. 已完成：运行 `npm run verify` 并记录验证结果。
10. 已完成：把文章 70/30、招聘 20/80 的候选来源权重写入公开数据契约。
11. 已完成：新增飞书每日 Agent 候选采集脚本和 systemd timer 模板。

## 9. 待确认问题

- 第一批公开信号记录已从 6 条扩展到 26 条，并补齐招聘、文章、产品和开源来源的多条覆盖。
- 首页已改为模块入口卡，完整列表只在 `/signals` 展示。
- `/signals` 首版使用 URL query 做服务端筛选，客户端筛选作为后续增强。
- `/signals` 已支持分页；继续超过 20 条后优先保持归档体验，而不是压缩历史记录。
- `currentGap` 已公开展示，但只写成抽象学习方向。
- 自动搜索已经用于候选发现，但公开 JSON 仍只接收人工确认后的中文摘要、价值判断和行动项。
- 飞书每日候选已验证可通过用户身份搜索聊天消息；公开页面只显示采集策略，不展示原始聊天。
