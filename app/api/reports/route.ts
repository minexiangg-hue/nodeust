import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { requireMember } from '@/lib/current-member';

const reasons = new Set([
  'illegal',
  'hall_trade',
  'fraud',
  'harassment',
  'hate',
  'sexual',
  'privacy',
  'spam',
  'other',
]);
const targetTypes = new Set(['post', 'message', 'user']);

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = (await request.json()) as Record<string, unknown>;
    const reason = typeof input.reason === 'string' ? input.reason : '';
    const targetType =
      typeof input.targetType === 'string' ? input.targetType : '';
    const targetId =
      typeof input.targetId === 'string' ? input.targetId.trim() : '';
    if (!reasons.has(reason) || !targetTypes.has(targetType) || !targetId)
      return NextResponse.json({ error: '举报信息不完整。' }, { status: 400 });
    const id = crypto.randomUUID();
    await getDb()
      .insert(reports)
      .values({
        id,
        reporterId: member.id,
        targetType:
          targetType as (typeof reports.targetType.enumValues)[number],
        targetId,
        reason: reason as (typeof reports.reason.enumValues)[number],
        details:
          typeof input.details === 'string'
            ? input.details.slice(0, 1000)
            : null,
        createdAt: new Date(),
      });
    return NextResponse.json({ id, status: 'open' }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json(
      {
        error: message === 'UNAUTHENTICATED' ? '请先登录。' : '举报提交失败。',
      },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 },
    );
  }
}
