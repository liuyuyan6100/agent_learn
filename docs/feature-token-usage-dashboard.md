# Token 消耗看板功能说明

## 0. 文档状态

- 模块名称：Token Usage Dashboard
- 所属里程碑：M1 / M2
- 当前状态：MVP 已实现，已公开部署到 `https://agent.aiclawonline.website/`
- 主要数据源：`npx tokscale`
- 公开策略：模型名称公开，客户端名称脱敏，成本默认隐藏
- 关联总规划：`docs/agent-showcase-plan.md`
- 模块流程要求：`docs/module-spec-process.md`
- 实现入口：`app/usage/page.tsx`
- 数据文件：`data/token-usage.json`
- 验证命令：`npm run verify`
- 公开地址：`https://agent.aiclawonline.website/`

## 1. 功能目标

把本地 `tokscale` token 使用记录转成公开可访问的工程仪表盘数据，用于证明真实、持续的 Agent 工程实践投入。

面向用户：

- 技术面试官：快速判断是否有真实 Agent 使用和工程化闭环。
- 同事朋友：理解当前投入强度、模型使用构成和持续学习节奏。
- 自己：持续复盘 token 使用趋势，后续关联实验、文章和日报。

核心原则：

- 展示真实数据，不展示敏感上下文。
- 公开模型名称，方便体现技术栈选择和使用深度。
- 客户端、本机路径、账号、prompt、内部项目名必须脱敏或删除。
- 第一版不强调成本控制，`cost` 默认不公开展示。

## 2. MVP 范围

第一版必须实现：

- 首页指标卡：从第一天到现在的总 token、今日、最近 7 天、最近 30 天。
- 首页趋势图：按日展示 `totalTokens` 和 `directTokens`。
- 模型构成：公开展示模型名称及其 token 占比或列表。
- 数据更新时间：展示 `generatedAt`。
- 数据说明：说明数据来自 `tokscale`，已删除敏感字段。
- 空状态：无数据时页面仍可解释模块目的。

第一版不做：

- 原始 prompt 展示。
- 账号、邮箱、组织 ID、API key 展示。
- 本机路径、session path、workspace path 展示。
- `clients --json` 公开入库。
- 成本排行或成本分析。
- 按内部项目名分类。

## 3. 数据采集设计

推荐采集命令：

```bash
npm run collect:tokens
```

脚本默认从早期日期开始采集，并把公开数据的 `period.start` 归一为第一条真实使用记录。

底层 `tokscale` 命令仍可指定窗口：

```bash
npx tokscale graph --since <start> --until <end> --no-spinner
```

模型聚合数据可从同一时间窗口的 JSON 聚合输出补齐，最终只向 Web 暴露一个归一化后的公开文件：

```text
data/token-usage.json
```

采集脚本职责：

- 执行 `tokscale` 命令并读取 JSON。
- 归一化日期范围和时区。
- 计算 `totalTokens`、`directTokens`、`cacheTokens`、从第一天到现在的累计值和 rolling windows。
- 保留公开模型字段 `modelName`。
- 将客户端名称映射为公开类别 `clientCategory`。
- 删除账号、邮箱、API key、组织 ID、原始 prompt、本机路径、session path、workspace path、内部项目名。
- 写入稳定公开数据文件 `data/token-usage.json`。

## 4. 公开数据接口

### 4.1 文件接口

路径：

```text
data/token-usage.json
```

消费者：

- 首页 token 看板。
- 后续 `/usage` 详情页。
- 后续文章或项目说明中的数据引用。

兼容策略：

- `schemaVersion` 变更时必须更新本文件和测试用例。
- 新增字段允许向后兼容。
- 删除或改名字段必须同步调整 UI 和测试。

### 4.2 JSON 契约

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-22T00:00:00.000Z",
  "period": {
    "start": "2026-05-24",
    "end": "2026-06-22",
    "timezone": "Etc/UTC"
  },
  "source": {
    "tool": "tokscale",
    "sourceCommand": "tokscale graph --since <start> --until <end>",
    "containsRawPrompts": false,
    "containsLocalPaths": false
  },
  "privacy": {
    "modelNames": "public",
    "clientNames": "public_category",
    "costDisplay": "hidden",
    "redactedFields": [
      "account",
      "email",
      "apiKey",
      "organizationId",
      "rawPrompt",
      "sessionPath",
      "workspacePath",
      "internalProject"
    ]
  },
  "totals": {
    "totalTokens": 0,
    "directTokens": 0,
    "cacheTokens": 0,
    "inputTokens": 0,
    "outputTokens": 0,
    "cacheReadTokens": 0,
    "cacheWriteTokens": 0,
    "reasoningTokens": 0,
    "messageCount": 0,
    "activeDays": 0,
    "totalDays": 30,
    "totalCostUsd": null
  },
  "windows": {
    "today": {
      "totalTokens": 0,
      "directTokens": 0,
      "messageCount": 0
    },
    "last7Days": {
      "totalTokens": 0,
      "directTokens": 0,
      "messageCount": 0,
      "activeDays": 0
    },
    "last30Days": {
      "totalTokens": 0,
      "directTokens": 0,
      "messageCount": 0,
      "activeDays": 0
    }
  },
  "models": [
    {
      "modelName": "gpt-5",
      "modelProvider": "openai",
      "modelCategory": "frontier_reasoning",
      "totalTokens": 0,
      "directTokens": 0,
      "messageCount": 0
    }
  ],
  "daily": [
    {
      "date": "2026-06-22",
      "totalTokens": 0,
      "directTokens": 0,
      "cacheTokens": 0,
      "inputTokens": 0,
      "outputTokens": 0,
      "cacheReadTokens": 0,
      "cacheWriteTokens": 0,
      "reasoningTokens": 0,
      "messageCount": 0,
      "activeTimeMs": null,
      "intensity": 0,
      "breakdown": [
        {
          "clientCategory": "coding_agent",
          "modelName": "gpt-5",
          "modelProvider": "openai",
          "modelCategory": "frontier_reasoning",
          "totalTokens": 0,
          "directTokens": 0,
          "messageCount": 0
        }
      ]
    }
  ],
  "milestones": [
    {
      "date": "2026-06-22",
      "type": "token_volume",
      "label": "First 1M-token day",
      "value": 1000000,
      "note": "Optional public note, no raw prompt."
    }
  ]
}
```

### 4.3 字段说明

- `schemaVersion`：公开数据契约版本。
- `generatedAt`：采集脚本生成公开 JSON 的时间。
- `period`：本文件覆盖的数据周期。
- `source.containsRawPrompts`：必须为 `false`。
- `source.containsLocalPaths`：必须为 `false`。
- `privacy.modelNames`：必须为 `public`。
- `privacy.clientNames`：必须为 `public_category`。
- `totalTokens`：`input + output + cacheRead + cacheWrite + reasoning`。
- `directTokens`：`input + output + reasoning`，用于表达真实交互强度。
- `cacheTokens`：`cacheRead + cacheWrite`。
- `models[].modelName`：公开模型名称，必须存在。
- `models[].modelProvider`：公开模型提供方，可为 `unknown`。
- `models[].modelCategory`：可选分组字段，不替代 `modelName`。
- `daily[].breakdown[].clientCategory`：公开客户端类别，不允许写入本机路径或原始客户端路径。
- `totalCostUsd`：第一版固定为 `null` 或不展示。

## 5. UI 模块接口

页面入口：

- `/`：展示 Token Usage 模块入口卡。
- `/usage`：展示完整 token 看板。

推荐组件边界：

- `TokenUsageDashboard`：接收完整 `TokenUsageDataset`，组合指标卡、趋势图、模型构成和说明。
- `TokenMetricCards`：读取 `totals` 和 `windows`。
- `TokenTrendChart`：读取 `daily[]`。
- `TokenModelBreakdown`：读取 `models[]`，展示公开模型名称。
- `TokenDataNotice`：读取 `generatedAt`、`source` 和 `privacy`，说明数据来源与脱敏边界。

推荐 TypeScript 数据接口：

```ts
export interface TokenUsageDataset {
  schemaVersion: 1;
  generatedAt: string;
  period: {
    start: string;
    end: string;
    timezone: string;
  };
  source: {
    tool: "tokscale";
    sourceCommand: string;
    containsRawPrompts: false;
    containsLocalPaths: false;
  };
  privacy: {
    modelNames: "public";
    clientNames: "public_category";
    costDisplay: "hidden" | "visible";
    redactedFields: string[];
  };
  totals: TokenUsageTotals;
  windows: {
    today: TokenUsageWindow;
    last7Days: TokenUsageWindow;
    last30Days: TokenUsageWindow;
  };
  models: TokenUsageModel[];
  daily: TokenUsageDay[];
  milestones?: TokenUsageMilestone[];
}

export interface TokenUsageTotals {
  totalTokens: number;
  directTokens: number;
  cacheTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  messageCount: number;
  activeDays: number;
  totalDays: number;
  totalCostUsd: number | null;
}

export interface TokenUsageWindow {
  totalTokens: number;
  directTokens: number;
  messageCount: number;
  activeDays?: number;
}

export interface TokenUsageModel {
  modelName: string;
  modelProvider: string;
  modelCategory?: string;
  totalTokens: number;
  directTokens: number;
  messageCount: number;
}

export interface TokenUsageDay {
  date: string;
  totalTokens: number;
  directTokens: number;
  cacheTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  messageCount: number;
  activeTimeMs: number | null;
  intensity: number;
  breakdown: TokenUsageBreakdown[];
}

export interface TokenUsageBreakdown {
  clientCategory: string;
  modelName: string;
  modelProvider: string;
  modelCategory?: string;
  totalTokens: number;
  directTokens: number;
  messageCount: number;
}

export interface TokenUsageMilestone {
  date: string;
  type: "token_volume" | "practice_streak" | "manual_note";
  label: string;
  value: number;
  note?: string;
}
```

## 6. 测试用例

| ID | 类型 | 场景 | 期望 |
| --- | --- | --- | --- |
| TUD-001 | Schema | 加载最小合法 `token-usage.json` | 通过校验，页面可渲染 |
| TUD-002 | Schema | `models[]` 缺少 `modelName` | 校验失败，不进入公开数据 |
| TUD-003 | Schema | `privacy.modelNames` 不是 `public` | 校验失败 |
| TUD-004 | 隐私 | JSON 中出现 `rawPrompt`、`apiKey`、`email`、`sessionPath`、`workspacePath` | 测试失败并提示敏感字段 |
| TUD-005 | 隐私 | `clientCategory` 包含 `/home/`、`C:\\`、`.config` 等路径特征 | 测试失败 |
| TUD-006 | 计算 | 单日 `input/output/cache/reasoning` 均有值 | `totalTokens`、`directTokens`、`cacheTokens` 计算正确 |
| TUD-007 | 计算 | 最近 7 天和最近 30 天窗口 | `windows.last7Days` 和 `windows.last30Days` 与 `daily[]` 聚合一致 |
| TUD-008 | 计算 | 某天无 cache token | `cacheTokens` 为 `0`，图表不中断 |
| TUD-009 | UI | `models[]` 有多个模型 | 页面展示公开模型名称和 token 占比 |
| TUD-010 | UI | `totalCostUsd` 为 `null` | 页面不展示成本金额 |
| TUD-011 | UI | `daily[]` 为空 | 展示空状态和数据说明，不崩溃 |
| TUD-012 | UI | `generatedAt` 超过预设新鲜度 | 展示数据可能过期的提示 |
| TUD-013 | CLI | `tokscale` 输出不是合法 JSON | 采集脚本失败退出，不覆盖上一份有效公开数据 |
| TUD-014 | CLI | `tokscale` 输出包含未知模型名 | 保留原始公开 `modelName`，`modelCategory` 置为 `unknown` |
| TUD-015 | 构建 | 运行构建后扫描静态产物 | 不包含敏感字段或本机路径 |

## 7. 验收标准

- `data/token-usage.json` 符合本文件 JSON 契约。
- 首页展示从第一天到现在的总 token、今日、7 天、30 天指标。
- 首页趋势图来自 `daily[]`，且日期排序正确。
- 首页模型构成展示 `modelName`，不是只展示 `modelCategory`。
- 页面和公开 JSON 不包含账号、邮箱、API key、组织 ID、原始 prompt、本机路径、session path、workspace path、内部项目名。
- 成本字段第一版不展示，公开 JSON 中可为 `null`。
- 测试用例 TUD-001 至 TUD-015 有对应自动化或明确手工验证记录。

## 7.1 验证记录

验证日期：2026-06-22。

已通过命令：

```bash
npm run verify
```

覆盖结果：

- `validate:data`：公开 JSON schema、计算口径和隐私边界通过。
- `test`：TUD-001 至 TUD-014 自动化测试通过。
- `typecheck`：TypeScript 严格检查通过。
- `build`：Next.js 生产构建通过，首页静态预渲染成功。
- `scan:public`：TUD-015 公开构建产物隐私扫描通过，扫描 56 个公开 artifact。

部署验证：

- `https://agent.aiclawonline.website/` 返回 `HTTP/2 200`。
- Cloudflare 代理已启用，响应头包含 `server: cloudflare`。
- 页面内容包含 `Agent Engineering Dashboard`、`Token Usage Dashboard` 和公开模型名 `gpt-5`。

## 8. 实现任务清单

1. 已完成：初始化 Next.js + TypeScript 项目。
2. 已完成：创建样例 `data/token-usage.json`。
3. 已完成：定义 `TokenUsageDataset` 类型和 schema 校验。
4. 已完成：实现首页 token 指标卡。
5. 已完成：实现按日趋势图。
6. 已完成：实现模型构成展示，使用公开 `modelName`。
7. 已完成：实现空状态，移除首页数据说明卡片。
8. 已完成：创建 `scripts/collect-token-usage.ts`。
9. 已完成：为 schema、计算、隐私扫描和 UI 状态补测试。
10. 已完成：更新 README 和总规划文档中的接续状态。

## 9. 后续确认

- 采集真实数据时确认 `tokscale graph` 与 `tokscale --json` 的同周期输出是否完全一致；当前采集脚本已经读取两份输出以补齐模型维度。
- 首页是否需要更突出展示 `modelProvider`；当前第一版以 `modelName` 为主。
- `generatedAt` 超过多久算过期，建议第一版用 48 小时。
