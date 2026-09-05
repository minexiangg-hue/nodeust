import { NextResponse } from 'next/server';

import { getPool } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getPool().query('SELECT 1');
    return NextResponse.json({ status: 'ok', database: 'reachable' });
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable' },
      { status: 503 },
    );
  }
}
