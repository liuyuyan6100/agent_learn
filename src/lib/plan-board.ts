export type PlanStatus = "done" | "doing" | "optimize" | "todo" | "blocked";

export interface PlanBoardItem {
  id: string;
  title: string;
  note: string;
  status: PlanStatus;
}

export interface PlanBoardSection {
  id: string;
  title: string;
  summary: string;
  items: PlanBoardItem[];
}

export interface PlanBoardSnapshot {
  version: number;
  updatedAt: string;
  statuses: Record<string, PlanStatus>;
}

export const PLAN_STATUSES: Array<{
  id: PlanStatus;
  label: string;
  symbol: string;
  tone: string;
}> = [
  { id: "done", label: "完成", symbol: "✓", tone: "done" },
  { id: "doing", label: "进行中", symbol: "○", tone: "doing" },
  { id: "optimize", label: "优化中", symbol: "◌", tone: "optimize" },
  { id: "todo", label: "待办", symbol: "·", tone: "todo" },
  { id: "blocked", label: "待确认", symbol: "!", tone: "blocked" }
];

export const PLAN_STATUS_ORDER: PlanStatus[] = ["done", "doing", "optimize", "todo", "blocked"];

const PLAN_STATUS_SET = new Set<PlanStatus>(PLAN_STATUS_ORDER);

export const PLAN_BOARD_SECTIONS: PlanBoardSection[] = [
  {
    id: "current-progress",
    title: "当前进展",
    summary: "先把已经落地的内容钉住，方便人一眼看清现状。",
    items: [
      {
        id: "plan-page-deployed",
        title: "规划文档已部署到页面",
        note: "README、路由和生产域名已经可访问。",
        status: "done"
      },
      {
        id: "dvp-deploy-command",
        title: "部署接入 dvp",
        note: "以后用 `dvp service agent-learn deploy` 维护。",
        status: "done"
      },
      {
        id: "plan-login-access",
        title: "登录访问已启用",
        note: "目前走 `dvp secret` 管理的邮箱密码，并兼容 Cloudflare Access 邮箱头。",
        status: "done"
      },
      {
        id: "email-login-eval",
        title: "邮箱登录方案",
        note: "参考 DVP 的 Cloudflare Access 邮箱验证码模式，应用侧已支持邮箱身份。",
        status: "done"
      }
    ]
  },
  {
    id: "mvp-modules",
    title: "MVP 模块",
    summary: "围绕展示证据的两个核心模块和它们的完成度。",
    items: [
      {
        id: "resume-highlights",
        title: "简历亮点区",
        note: "Agent 工程方向、成果卡片、能力说明。",
        status: "done"
      },
      {
        id: "token-dashboard",
        title: "token 消耗看板",
        note: "真实使用强度、趋势图、模型构成。",
        status: "done"
      },
      {
        id: "agent-signals-module",
        title: "Agent 开发日报",
        note: "招聘、文章、产品和开源信号的持续沉淀。",
        status: "todo"
      }
    ]
  },
  {
    id: "future-modules",
    title: "后续模块",
    summary: "把规划从展示页面扩展到更完整的工程叙事。",
    items: [
      {
        id: "writing-module",
        title: "文章与项目说明",
        note: "把技术叙事、复盘和简历表达放到页面里。",
        status: "todo"
      },
      {
        id: "knowledge-map",
        title: "经验地图",
        note: "Tool Calling、Evals、Observability 等能力矩阵。",
        status: "todo"
      },
      {
        id: "weekly-summary",
        title: "周总结自动生成",
        note: "把日报、文章和项目说明串成周视图。",
        status: "doing"
      }
    ]
  },
  {
    id: "stack-quality",
    title: "技术与质量",
    summary: "把实现方式、校验和隐私边界也直接放进页面。",
    items: [
      {
        id: "stack-nextjs",
        title: "Next.js + TypeScript",
        note: "当前 Web 栈已经落地。",
        status: "done"
      },
      {
        id: "stack-json",
        title: "本地 JSON 数据流",
        note: "token、signals、board state 都走文件驱动。",
        status: "done"
      },
      {
        id: "privacy-boundary",
        title: "脱敏边界",
        note: "账号、API key、原始 prompt 都不公开。",
        status: "done"
      },
      {
        id: "verification-coverage",
        title: "验证覆盖",
        note: "测试、构建、隐私扫描都通过。",
        status: "done"
      }
    ]
  },
  {
    id: "milestones-risks",
    title: "里程碑与风险",
    summary: "用状态表达阶段成果和仍需确认的问题。",
    items: [
      {
        id: "milestone-m0",
        title: "M0 规划完成",
        note: "接续文档和 MVP 范围已经明确。",
        status: "done"
      },
      {
        id: "milestone-m1",
        title: "M1 脚手架",
        note: "首页、基础页面结构和视觉系统已就位。",
        status: "done"
      },
      {
        id: "milestone-m2",
        title: "M2 token 看板闭环",
        note: "采集、脱敏、图表和部署链路已完成。",
        status: "done"
      },
      {
        id: "milestone-m3",
        title: "M3 Agent Signals",
        note: "日报和趋势信号已上线。",
        status: "done"
      },
      {
        id: "risk-curation",
        title: "日报质量控制",
        note: "搜索范围太大会变成噪音流，需要继续收口。",
        status: "optimize"
      },
      {
        id: "risk-mail-login",
        title: "邮箱登录",
        note: "应用侧已完成邮箱身份接入；Cloudflare Access 路径保护启用后即可免表单登录。",
        status: "optimize"
      }
    ]
  },
  {
    id: "next-actions",
    title: "下一步行动",
    summary: "把下一步具体化，方便直接打勾推进。",
    items: [
      {
        id: "collect-real-token-data",
        title: "接入真实 tokscale 数据",
        note: "把计划里的采集链路继续向前推。",
        status: "done"
      },
      {
        id: "route-writing-about",
        title: "补 `/writing` 与 `/about`",
        note: "把文章入口和项目说明补成可访问页面。",
        status: "todo"
      },
      {
        id: "followup-agent-signals",
        title: "扩展 Agent Signals",
        note: "继续补招聘、开源、产品和复盘来源。",
        status: "doing"
      },
      {
        id: "visual-polish",
        title: "视觉收口",
        note: "让页面更像给人看的 HTML 看板，而不是表单页。",
        status: "optimize"
      }
    ]
  }
];

export function createDefaultPlanBoardState(now = new Date()): PlanBoardSnapshot {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    statuses: buildDefaultStatusMap()
  };
}

export function buildDefaultStatusMap(): Record<string, PlanStatus> {
  const statuses: Record<string, PlanStatus> = {};

  for (const section of PLAN_BOARD_SECTIONS) {
    for (const item of section.items) {
      statuses[item.id] = item.status;
    }
  }

  return statuses;
}

export function normalizePlanBoardSnapshot(input: unknown): PlanBoardSnapshot {
  const base = createDefaultPlanBoardState();
  if (!input || typeof input !== "object") {
    return base;
  }

  const candidate = input as Partial<PlanBoardSnapshot> & { statuses?: Record<string, unknown> };
  const statuses: Record<string, PlanStatus> = { ...base.statuses };

  if (candidate.statuses && typeof candidate.statuses === "object") {
    for (const [key, value] of Object.entries(candidate.statuses)) {
      if (isPlanStatus(value) && hasPlanBoardItem(key)) {
        statuses[key] = value;
      }
    }
  }

  const updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : base.updatedAt;

  return {
    version: 1,
    updatedAt,
    statuses
  };
}

export function hasPlanBoardItem(itemId: string): boolean {
  return PLAN_BOARD_SECTIONS.some((section) => section.items.some((item) => item.id === itemId));
}

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === "string" && PLAN_STATUS_SET.has(value as PlanStatus);
}

export function getPlanStatusMeta(status: PlanStatus): { label: string; symbol: string; tone: string } {
  return PLAN_STATUSES.find((item) => item.id === status) ?? PLAN_STATUSES[3];
}

export function getPlanBoardStats(statuses: Record<string, PlanStatus>): Record<PlanStatus, number> {
  const stats: Record<PlanStatus, number> = {
    done: 0,
    doing: 0,
    optimize: 0,
    todo: 0,
    blocked: 0
  };

  for (const status of Object.values(statuses)) {
    if (isPlanStatus(status)) {
      stats[status] += 1;
    }
  }

  return stats;
}

export function getPlanBoardCompletion(statuses: Record<string, PlanStatus>): number {
  const total = Object.keys(statuses).length;
  if (total === 0) {
    return 0;
  }

  return Math.round((getPlanBoardStats(statuses).done / total) * 100);
}

export function applyBoardStatus(
  statuses: Record<string, PlanStatus>,
  itemId: string,
  status: PlanStatus
): Record<string, PlanStatus> {
  if (!hasPlanBoardItem(itemId)) {
    return statuses;
  }

  return {
    ...statuses,
    [itemId]: status
  };
}
