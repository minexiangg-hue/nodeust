import { NextRequest, NextResponse } from 'next/server';
import { requireMember } from '@/lib/current-member';
import { apiError } from '@/lib/api-response';
import { pageOffset } from '@/lib/pagination';
import { getMemberMatches } from '@/lib/match/service';

export async function GET(request: NextRequest) {
  try {
    const member = await requireMember();
    if (process.env.NODE_MATCHING_ENABLED === 'false')
      return NextResponse.json(
        {
          disabled: true,
          items: [],
          hasMore: false,
          total: 0,
          highConfidenceCount: 0,
          possibleCount: 0,
          ownPostCount: 0,
          needsDetails: [],
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    const category = request.nextUrl.searchParams.get('kind') ?? '';
    const result = await getMemberMatches(member.id, {
      offset: pageOffset(request.nextUrl.searchParams),
      includePossible: request.nextUrl.searchParams.get('possible') === '1',
      kind: ['hall', 'goods', 'study', 'transport', 'other'].includes(category)
        ? category
        : undefined,
    });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error, 'Unable to load matches.');
  }
}
