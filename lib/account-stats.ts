import { and, count, eq, gte, lt, not, or, like, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireMember } from '@/lib/current-member';

const DAY = 86_400_000;
const HONG_KONG_OFFSET = 8 * 60 * 60 * 1000;

/** Calendar days in Hong Kong, independent of the server's local timezone. */
export function accountStatsWindow(now: Date) {
  const today = new Date(now.getTime() + HONG_KONG_OFFSET)
    .toISOString()
    .slice(0, 10);
  const start = new Date(`${today}T00:00:00+08:00`).getTime();
  return {
    today: new Date(start),
    week: new Date(start - 6 * DAY),
    month: new Date(start - 29 * DAY),
    tomorrow: new Date(start + DAY),
    days: Array.from({ length: 30 }, (_, index) =>
      new Date(start + HONG_KONG_OFFSET - (29 - index) * DAY)
        .toISOString()
        .slice(0, 10),
    ),
  };
}

export async function getAccountStats(now = new Date()) {
  const member = await requireMember();
  if (member.role !== 'owner') throw new Error('FORBIDDEN');

  const window = accountStatsWindow(now);
  const knownTest = or(
    eq(users.identityId, 'local-demo-owner'),
    like(users.identityId, 'node-smoke-%'),
  )!;
  const regular = not(knownTest);
  const tally = (condition: ReturnType<typeof eq>) =>
    sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(
      Number,
    );
  const since = (start: Date) =>
    and(
      regular,
      gte(users.createdAt, start),
      lt(users.createdAt, window.tomorrow),
    )!;
  const db = getDb();
  const [summaryRows, dailyRows] = await Promise.all([
    db
      .select({
        total: count(),
        accounts: tally(regular),
        knownTests: tally(knownTest),
        today: tally(since(window.today)),
        week: tally(since(window.week)),
        month: tally(since(window.month)),
        active: tally(and(regular, eq(users.status, 'active'))!),
        suspended: tally(and(regular, eq(users.status, 'suspended'))!),
        banned: tally(and(regular, eq(users.status, 'banned'))!),
      })
      .from(users),
    db
      .select({
        day: sql<string>`date_format(date_add(${users.createdAt}, interval 8 hour), '%Y-%m-%d')`,
        count: count(),
      })
      .from(users)
      .where(since(window.month))
      .groupBy(
        sql`date_format(date_add(${users.createdAt}, interval 8 hour), '%Y-%m-%d')`,
      ),
  ]);
  const dailyCounts = new Map(dailyRows.map((row) => [row.day, row.count]));
  return {
    summary: summaryRows[0],
    daily: window.days.map((day) => ({
      day,
      count: dailyCounts.get(day) ?? 0,
    })),
    generatedAt: now.toISOString(),
  };
}
