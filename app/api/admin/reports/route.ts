import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import {
  messages,
  moderationActions,
  posts,
  reports,
  users,
} from '@/db/schema';
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

    // Attach human-readable context (post title / user alias / message snippet)
    // plus the reporter's alias so the moderation cards can show what was
    // reported without the moderator hunting for ids.
    const itemsWithContext = await attachContext(items);
    return NextResponse.json({ items: itemsWithContext });
  } catch {
    return NextResponse.json({ error: '无法读取审核队列。' }, { status: 500 });
  }
}

async function attachContext(items: (typeof reports.$inferSelect)[]) {
  if (items.length === 0) return items;
  const targetIds = items.map((report) => report.targetId);
  const reporterIds = items.map((report) => report.reporterId);

  const [postRows, userRows, messageRows, reporterRows] = await Promise.all([
    getDb()
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(inArray(posts.id, targetIds)),
    getDb()
      .select({ id: users.id, alias: users.anonymousAlias })
      .from(users)
      .where(inArray(users.id, targetIds)),
    getDb()
      .select({
        id: messages.id,
        body: messages.body,
        senderId: messages.senderId,
        alias: users.anonymousAlias,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(inArray(messages.id, targetIds)),
    getDb()
      .select({ id: users.id, alias: users.anonymousAlias })
      .from(users)
      .where(inArray(users.id, reporterIds)),
  ]);

  const postTitle = new Map(postRows.map((row) => [row.id, row.title]));
  const userAlias = new Map(userRows.map((row) => [row.id, row.alias]));
  const messageById = new Map(messageRows.map((row) => [row.id, row]));
  const reporterAlias = new Map(
    reporterRows.map((row) => [row.id, row.alias]),
  );

  return items.map((report) => {
    let targetLabel = '';
    let targetAlias = '';
    if (report.targetType === 'post') {
      targetLabel = postTitle.get(report.targetId) ?? '';
    } else if (report.targetType === 'user') {
      targetLabel = userAlias.get(report.targetId) ?? '';
    } else if (report.targetType === 'message') {
      const message = messageById.get(report.targetId);
      if (message) {
        targetAlias = message.alias;
        targetLabel = message.body;
      }
    }
    return {
      ...report,
      targetLabel,
      targetAlias,
      reporterAlias: reporterAlias.get(report.reporterId) ?? '',
    };
  });
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
    const reason = input.reason.trim();
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
    if (action === 'remove' && report.targetType === 'post') {
      await getDb().transaction(async (transaction) => {
        await transaction
          .update(reports)
          .set({
            status: 'resolved',
            assignedTo: member.id,
            resolvedAt: now,
          })
          .where(eq(reports.id, report.id));
        await transaction.insert(moderationActions).values({
          id: crypto.randomUUID(),
          moderatorId: member.id,
          targetType: report.targetType,
          targetId: report.targetId,
          action,
          reason,
          createdAt: now,
        });
        await transaction
          .update(posts)
          .set({ status: 'removed', updatedAt: now })
          .where(eq(posts.id, report.targetId));
      });
    } else if (
      (action === 'suspend' || action === 'ban') &&
      report.targetType === 'user'
    ) {
      await getDb().transaction(async (transaction) => {
        await transaction
          .update(reports)
          .set({
            status: 'resolved',
            assignedTo: member.id,
            resolvedAt: now,
          })
          .where(eq(reports.id, report.id));
        await transaction.insert(moderationActions).values({
          id: crypto.randomUUID(),
          moderatorId: member.id,
          targetType: report.targetType,
          targetId: report.targetId,
          action,
          reason,
          createdAt: now,
        });
        await transaction
          .update(users)
          .set({
            status: action === 'ban' ? 'banned' : 'suspended',
            updatedAt: now,
          })
          .where(eq(users.id, report.targetId));
      });
    } else {
      await getDb().transaction(async (transaction) => {
        await transaction
          .update(reports)
          .set({
            status: action === 'dismiss' ? 'dismissed' : 'resolved',
            assignedTo: member.id,
            resolvedAt: now,
          })
          .where(eq(reports.id, report.id));
        await transaction.insert(moderationActions).values({
          id: crypto.randomUUID(),
          moderatorId: member.id,
          targetType: report.targetType,
          targetId: report.targetId,
          action,
          reason,
          createdAt: now,
        });
      });
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
