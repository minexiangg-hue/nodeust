import { NextResponse, type NextRequest } from 'next/server';
import { emailMode, authConfig } from './lib/email-auth/config';
export function proxy(request: NextRequest) {
  if (emailMode() && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    try {
      if (
        request.headers.get('origin') !== authConfig().origin ||
        request.headers.get('sec-fetch-site') === 'cross-site'
      )
        return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
    } catch {
      return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: '/api/:path*' };
