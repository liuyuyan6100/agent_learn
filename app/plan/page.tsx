import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanBoard } from "@/src/components/plan-board";
import { getPlanBoardStats } from "@/src/lib/plan-board";
import { getPlanLoginPath, getPlanSessionUser } from "@/src/lib/plan-auth";
import { readPlanBoardState } from "@/src/lib/plan-board-state";

export const metadata: Metadata = {
  title: "Plan Board | Agent 工程仪表盘",
  description: "登录后可访问的规划状态看板，用于在线查看和调整条目状态。"
};

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const user = await getPlanSessionUser();
  if (!user) {
    redirect(getPlanLoginPath("/plan"));
  }

  const board = await readPlanBoardState();
  const stats = getPlanBoardStats(board.statuses);
  const total = Object.keys(board.statuses).length;
  const completion = total === 0 ? 0 : Math.round((stats.done / total) * 100);

  return (
    <main className="shell">
      <section className="subpage-hero" aria-labelledby="plan-page-title">
        <div>
          <Link className="text-link" href="/">
            返回首页
          </Link>
          <p className="eyebrow">Private Plan</p>
          <h1 id="plan-page-title">
            <span>把条目状态</span>
            <span>直接放进页面。</span>
          </h1>
          <p className="hero-lede">
            这个看板只对登录用户开放。这里只保存每个条目的状态映射，不改动规划正文。
          </p>
        </div>
        <div className="subpage-stat-card plan-page-stat-card" aria-label="规划看板状态概览">
          <p className="eyebrow">当前登录</p>
          <strong>{completion}%</strong>
          <span>{user.email}</span>
          <span>共 {total} 条状态</span>
          <span>最后同步 {formatUpdatedAt(board.updatedAt)}</span>
          <form action="/api/auth/logout" method="post" className="logout-form">
            <button className="text-link logout-button" type="submit">
              退出登录
            </button>
          </form>
        </div>
      </section>

      <div className="plan-page-state-note" role="note">
        <span>保存路径固定为状态文件，页面不会写回文档正文。</span>
        <span>状态按钮点击后直接更新服务器端看板。</span>
        <span>刷新部署时会保留 `/var/lib/agent-learn` 下的交互状态。</span>
      </div>

      <PlanBoard initialBoard={board} />
    </main>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(date);
}
