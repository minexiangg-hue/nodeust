import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAccountStats } from '@/lib/account-stats';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: '账号统计 · NODE',
  robots: { index: false, follow: false },
};

export default async function AccountStatsPage() {
  let stats;
  try {
    stats = await getAccountStats();
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHENTICATED', 'FORBIDDEN', 'BANNED', 'SUSPENDED'].includes(
        error.message,
      )
    ) {
      notFound();
    }
    throw error;
  }
  const { summary, daily } = stats;
  const maximum = Math.max(1, ...daily.map((row) => row.count));
  const cards = [
    ['累计账号', summary.accounts, '已排除已知演示及自动测试账号'],
    ['今日新增', summary.today, '香港时间今日 00:00 起'],
    ['近 7 天新增', summary.week, '含今天，共 7 个自然日'],
    ['近 30 天新增', summary.month, '含今天，共 30 个自然日'],
  ] as const;
  return (
    <main lang="zh-CN" className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-primary">NODE · OWNER ONLY</p>
          <h1 className="text-3xl font-semibold">账号统计</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            仅 Owner 可见 · 按香港时间统计
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          {/* A full reload deliberately requests a fresh server-side snapshot. */}
          {/* oxlint-disable-next-line next/no-html-link-for-pages */}
          <a href="/owner/stats" className="rounded-lg border px-4 py-2">
            刷新统计
          </a>
          <Link href="/" className="rounded-lg border px-4 py-2">
            返回主界面
          </Link>
        </div>
      </header>
      <section
        aria-label="账号概览"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map(([label, value, description]) => (
          <article key={label} className="rounded-xl border bg-card p-5">
            <h2 className="text-sm text-muted-foreground">{label}</h2>
            <p className="my-3 text-4xl font-semibold tabular-nums">
              {value.toLocaleString('zh-CN')}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </article>
        ))}
      </section>
      <section
        aria-labelledby="stats-scope"
        className="my-6 rounded-xl border bg-card p-5 text-sm leading-7"
      >
        <h2 id="stats-scope" className="font-semibold">
          统计口径
        </h2>
        <p className="text-muted-foreground">
          统计已进入 NODE 并建立资料的账号，包含
          Owner、管理员及受限账号。账号数不等于页面浏览量、独立访客数或实际人数；仅在登录网关注册、尚未进入
          NODE 的账号不计入。
        </p>
        <p className="text-muted-foreground">
          数据库账号总数：{summary.total}；已知演示／自动测试账号：
          {summary.knownTests}（local-demo-owner 和 node-smoke-
          前缀）。手工创建的测试账号仍会计入。
        </p>
        <p>
          正常状态：{summary.active} · 已暂停：{summary.suspended} · 已封禁：
          {summary.banned}
        </p>
        <p className="text-xs text-muted-foreground">
          “正常状态”仅表示账号未被限制，不代表在线或近期活跃。
        </p>
      </section>
      <section
        aria-labelledby="stats-trend"
        className="rounded-xl border bg-card p-5 sm:p-6"
      >
        <h2 id="stats-trend" className="text-lg font-semibold">
          近 30 天新增账号
        </h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          按首次建立 NODE 资料的日期统计，已排除已知测试账号。
        </p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="pb-3 font-normal">
                日期
              </th>
              <th scope="col" className="pb-3 text-right font-normal">
                新增账号
              </th>
              <th scope="col" className="w-1/2 pb-3 pl-5 font-normal">
                趋势
              </th>
            </tr>
          </thead>
          <tbody>
            {daily.map((row) => (
              <tr key={row.day} className="border-b last:border-0">
                <th scope="row" className="py-2 font-normal tabular-nums">
                  {row.day}
                </th>
                <td className="py-2 text-right tabular-nums">{row.count}</td>
                <td
                  className="py-2 pl-5"
                  aria-label={`新增 ${row.count} 个账号`}
                >
                  <div aria-hidden="true" className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(row.count / maximum) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-5 text-xs text-muted-foreground">
        更新时间：
        {new Date(stats.generatedAt).toLocaleString('zh-CN', {
          timeZone: 'Asia/Hong_Kong',
          hour12: false,
        })}
        （香港时间）。刷新页面获取最新数据。
      </p>
    </main>
  );
}
