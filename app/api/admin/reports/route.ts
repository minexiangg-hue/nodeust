import { invalidateMatchIndex } from '@/lib/match/cache-state';
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
import { apiError, readJsonObject } from '@/lib/api-response';
import { requireMember } from '@/lib/current-member';
import { canManageUser } from '@/lib/moderation-policy';
import { PAGE_SIZE, pageOffset, pagedItems } from '@/lib/pagination';

const actions = new Set(['remove', 'dismiss', 'warn', 'suspend', 'ban']);

export async function GET(request: NextRequest) {
  try {
    const member = await requireMember();
    if (!canModerate(member))
      return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 });
    const items = await getDb()
      .select()
      .from(reports)
      .where(
        request.nextUrl.searchParams.get('status') === 'processed'
          ? inArray(reports.status, ['resolved', 'dismissed'])
          : eq(reports.status, 'open'),
      )
      .orderBy(asc(reports.createdAt), asc(reports.id))
      .limit(PAGE_SIZE + 1)
      .offset(pageOffset(request.nextUrl.searchParams));

    // Attach human-readable context (post title / user alias / message snippet)
    // plus the reporter's alias so the moderation cards can show what was
    // reported without the moderator hunting for ids.
    const page = pagedItems(items);
    const itemsWithContext = await attachContext(page.items);
    return NextResponse.json({ ...page, items: itemsWithContext });
  } catch (error) {
    return apiError(error, '无法读取审核队列。');
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
  const reporterAlias = new Map(reporterRows.map((row) => [row.id, row.alias]));

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
    const input = await readJsonObject(request);
    if (
      typeof input.reportId !== 'string' ||
      !input.reportId ||
      typeof input.action !== 'string' ||
      !actions.has(input.action) ||
      typeof input.reason !== 'string' ||
      !input.reason.trim() ||
      input.reason.trim().length > 500
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
    if (
      (action === 'remove' && report.targetType !== 'post') ||
      ((action === 'suspend' || action === 'ban') &&
        report.targetType !== 'user')
    )
      return NextResponse.json(
        { error: 'This action does not apply to this report type.' },
        { status: 422 },
      );
    if (action === 'remove' && report.targetType === 'post') {
      await getDb().transaction(async (transaction) => {
        const [resolution] = await transaction
          .update(reports)
          .set({
            status: 'resolved',
            assignedTo: member.id,
            resolvedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, 'open')));
        if (!resolution.affectedRows) throw new Error('REPORT_CHANGED');
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
      const [target] = await getDb()
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, report.targetId))
        .limit(1);
      if (!target)
        return NextResponse.json({ error: '账号不存在。' }, { status: 404 });
      if (!canManageUser(member.role, target.role, action))
        return NextResponse.json(
          { error: '无权处置此账号。' },
          { status: 403 },
        );
      await getDb().transaction(async (transaction) => {
        const [resolution] = await transaction
          .update(reports)
          .set({
            status: 'resolved',
            assignedTo: member.id,
            resolvedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, 'open')));
        if (!resolution.affectedRows) throw new Error('REPORT_CHANGED');
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
        const [resolution] = await transaction
          .update(reports)
          .set({
            status: action === 'dismiss' ? 'dismissed' : 'resolved',
            assignedTo: member.id,
            resolvedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, 'open')));
        if (!resolution.affectedRows) throw new Error('REPORT_CHANGED');
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
    if (action === 'remove' || action === 'suspend' || action === 'ban') invalidateMatchIndex();
    return NextResponse.json({
      id: report.id,
      status: action === 'dismiss' ? 'dismissed' : 'resolved',
      action,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_CHANGED')
      return NextResponse.json(
        { error: 'The report was already processed. Refresh the list.' },
        { status: 409 },
      );
    return apiError(error, '处置失败。');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const input = await readJsonObject(request);
    if (typeof input.id !== 'string' || !input.id)
      return NextResponse.json(
        { error: 'A report id is required.' },
        { status: 400 },
      );
    const [result] = await getDb()
      .delete(reports)
      .where(
        and(
          eq(reports.id, input.id),
          inArray(reports.status, ['resolved', 'dismissed']),
        ),
      );
    if (!result.affectedRows)
      return NextResponse.json(
        {
          error: 'Process the report before deleting it, or refresh the list.',
        },
        { status: 409 },
      );
    // moderationActions is deliberately retained for auditing.
    return NextResponse.json({ id: input.id, status: 'deleted' });
  } catch (error) {
    return apiError(error, 'Unable to delete the report.');
  }
}
