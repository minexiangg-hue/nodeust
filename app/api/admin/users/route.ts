import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { moderationActions, users } from '@/db/schema';
import { canModerate } from '@/lib/auth';
import { requireMember } from '@/lib/current-member';

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireMember();
    if (!canModerate(actor))
      return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 });
    const input = (await request.json()) as {
      userId?: string;
      action?: 'activate' | 'suspend' | 'ban' | 'make_moderator' | 'make_admin';
      reason?: string;
    };
    if (!input.userId || !input.action || !input.reason?.trim())
      return NextResponse.json({ error: '处置参数不完整。' }, { status: 400 });
    const reason = input.reason.trim();
    const [target] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!target)
      return NextResponse.json({ error: '账号不存在。' }, { status: 404 });
    if (target.role === 'owner')
      return NextResponse.json(
        { error: '不能通过此接口修改 Owner。' },
        { status: 409 },
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
  } catch {
    return NextResponse.json({ error: '账号操作失败。' }, { status: 500 });
  }
}
