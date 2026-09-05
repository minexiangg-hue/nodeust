import { and, asc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { moderationActions, posts, reports, users } from '@/db/schema';
import { canModerate } from '@/lib/auth';
import { requireMember } from '@/lib/current-member';

const actions = new Set(['remove', 'dismiss', 'warn', 'suspend', 'ban']);

export async function GET() {
  try {
    const member = await requireMember();
    if (!canModerate(member))
      return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 });
    const items = await getDb()
      .select()
      .from(reports)
      .where(orOpen())
      .orderBy(asc(reports.createdAt))
      .limit(100);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: '无法读取审核队列。' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const member = await requireMember();
    if (!canModerate(member))
      return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 });
    const input = (await request.json()) as {
      reportId?: string;
      action?: string;
      reason?: string;
    };
    if (
      !input.reportId ||
      !input.action ||
      !actions.has(input.action) ||
      !input.reason?.trim()
    )
      return NextResponse.json({ error: '处置参数不完整。' }, { status: 400 });
    const [report] = await getDb()
      .select()
      .from(reports)
      .where(and(eq(reports.id, input.reportId), eq(reports.status, 'open')))
      .limit(1);
    if (!report)
      return NextResponse.json(
        { error: '举报不存在或已经处理。' },
        { status: 404 },
      );

    const now = new Date();
    const action = input.action as
      | 'remove'
      | 'dismiss'
      | 'warn'
      | 'suspend'
      | 'ban';
    const reportUpdate = getDb()
      .update(reports)
      .set({
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        assignedTo: member.id,
        resolvedAt: now,
      })
      .where(eq(reports.id, report.id));
    const auditInsert = getDb()
      .insert(moderationActions)
      .values({
        id: crypto.randomUUID(),
        moderatorId: member.id,
        targetType: report.targetType,
        targetId: report.targetId,
        action,
        reason: input.reason.trim(),
        createdAt: now,
      });
    if (action === 'remove' && report.targetType === 'post') {
      await getDb().batch([
        reportUpdate,
        auditInsert,
        getDb()
          .update(posts)
          .set({ status: 'removed', updatedAt: now })
          .where(eq(posts.id, report.targetId)),
      ]);
    } else if (
      (action === 'suspend' || action === 'ban') &&
      report.targetType === 'user'
    ) {
      await getDb().batch([
        reportUpdate,
        auditInsert,
        getDb()
          .update(users)
          .set({
            status: action === 'ban' ? 'banned' : 'suspended',
            updatedAt: now,
          })
          .where(eq(users.id, report.targetId)),
      ]);
    } else {
      await getDb().batch([reportUpdate, auditInsert]);
    }
    return NextResponse.json({
      id: report.id,
      status: action === 'dismiss' ? 'dismissed' : 'resolved',
      action,
    });
  } catch {
    return NextResponse.json({ error: '处置失败。' }, { status: 500 });
  }
}

function orOpen() {
  return eq(reports.status, 'open');
}
