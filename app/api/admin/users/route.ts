import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { moderationActions, users } from '@/db/schema';
import { apiError, readJsonObject } from '@/lib/api-response';
import { canModerate } from '@/lib/auth';
import { requireMember } from '@/lib/current-member';
import { canManageUser, isUserAction } from '@/lib/moderation-policy';

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireMember();
    if (!canModerate(actor))
      return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 });
    const input = await readJsonObject(request);
    if (
      typeof input.userId !== 'string' ||
      !input.userId ||
      !isUserAction(input.action) ||
      typeof input.reason !== 'string' ||
      !input.reason.trim() ||
      input.reason.trim().length > 500
    )
      return NextResponse.json({ error: '处置参数不完整。' }, { status: 400 });
    const reason = input.reason.trim();
    const [target] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!target)
      return NextResponse.json({ error: '账号不存在。' }, { status: 404 });
    if (!canManageUser(actor.role, target.role, input.action))
      return NextResponse.json(
        { error: '无权修改此账号或授予此角色。' },
        { status: 403 },
      );
    const now = new Date();
    const action = input.action;
    const userUpdate =
      action === 'make_moderator'
        ? { role: 'moderator' as const, updatedAt: now }
        : action === 'make_admin'
          ? { role: 'admin' as const, updatedAt: now }
          : {
              status:
                action === 'activate'
                  ? ('active' as const)
                  : action === 'ban'
                    ? ('banned' as const)
                    : ('suspended' as const),
              updatedAt: now,
            };
    await getDb().transaction(async (transaction) => {
      await transaction
        .update(users)
        .set(userUpdate)
        .where(eq(users.id, target.id));
      await transaction.insert(moderationActions).values({
        id: crypto.randomUUID(),
        moderatorId: actor.id,
        targetType: 'user',
        targetId: target.id,
        action:
          action === 'make_moderator' ||
          action === 'make_admin' ||
          action === 'activate'
            ? 'restore'
            : action,
        reason,
        createdAt: now,
      });
    });
    return NextResponse.json({ userId: target.id, action, status: 'updated' });
  } catch (error) {
    return apiError(error, '账号操作失败。');
  }
}
