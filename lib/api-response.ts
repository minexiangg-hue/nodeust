import { NextResponse } from 'next/server';

/** Parse only JSON objects; malformed client input must not become a 500. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new Error('INVALID_JSON');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('INVALID_JSON');
  return input as Record<string, unknown>;
}

export function apiError(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNAUTHENTICATED')
    return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  if (code === 'BANNED' || code === 'SUSPENDED')
    return NextResponse.json(
      { error: '此账号暂时无法使用。' },
      { status: 403 },
    );
  if (code === 'INVALID_JSON')
    return NextResponse.json(
      { error: '请求必须是有效的 JSON 对象。' },
      { status: 400 },
    );
  return NextResponse.json({ error: fallback }, { status: 500 });
}
