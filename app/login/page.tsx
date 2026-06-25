import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlanSessionUser, isPlanAuthConfigured, isPlanFormLoginConfigured, sanitizeNextPath } from "@/src/lib/plan-auth";

export const metadata: Metadata = {
  title: "Login | Agent 工程仪表盘",
  description: "规划状态看板登录入口。"
};

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getPlanSessionUser();
  const params = searchParams ? await searchParams : {};

  if (user) {
    redirect(sanitizeNextPath(firstParam(params.next)));
  }

  const nextPath = sanitizeNextPath(firstParam(params.next));
  const error = firstParam(params.error);
  const authConfigured = isPlanAuthConfigured();
  const formLoginConfigured = isPlanFormLoginConfigured();

  return (
    <main className="shell">
      <section className="auth-shell" aria-labelledby="login-title">
        <div className="auth-intro">
          <p className="eyebrow">Private Access</p>
          <h1 id="login-title">
            <span>规划页需要</span>
            <span>登录后访问。</span>
          </h1>
          <p className="hero-lede">
            页面支持 Cloudflare Access 邮箱验证码，也保留服务端邮箱密码校验和 HttpOnly 会话 cookie。
          </p>
        </div>

        <form className="auth-card" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={nextPath} />
          <div className="auth-field">
            <label htmlFor="email">邮箱</label>
            <input id="email" name="email" type="text" inputMode="email" autoComplete="email" required />
          </div>
          <div className="auth-field">
            <label htmlFor="password">密码</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <div className="auth-status" role="status" aria-live="polite">
            {!authConfigured ? (
              <span className="workspace-error">
                缺少 `PLAN_ACCESS_EMAILS`、`PLAN_ACCESS_PASSWORD`、`PLAN_SESSION_SECRET` 或 Cloudflare Access 配置。
              </span>
            ) : null}
            {authConfigured && !formLoginConfigured ? (
              <span>
                已启用 Cloudflare Access 邮箱登录；通过验证码验证后会自动进入规划看板。
              </span>
            ) : null}
            {error === "invalid" ? <span className="workspace-error">邮箱或密码错误。</span> : null}
            {error === "config" ? <span className="workspace-error">登录配置未完成，暂时不能访问。</span> : null}
          </div>
          <button className="workspace-save-button auth-submit-button" type="submit" disabled={!formLoginConfigured}>
            登录规划看板
          </button>
        </form>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
