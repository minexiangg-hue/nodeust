import { NextRequest, NextResponse } from 'next/server';
import { authConfig, AuthError } from '@/lib/email-auth/config';
import {
  accountEmail,
  passwordInput,
  tokenInput,
  safeNext,
} from '@/lib/email-auth/crypto';
import {
  register,
  login,
  logout,
  confirmVerification,
  requestReset,
  resetPassword,
  rateLimit,
} from '@/lib/email-auth/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function body(request: Request): Promise<Record<string, unknown>> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new AuthError('INVALID_REQUEST');
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError('INVALID_REQUEST');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new AuthError('INVALID_REQUEST', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error();
    return data;
  } catch {
    throw new AuthError('INVALID_REQUEST');
  }
}
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const config = authConfig();
    if (
      request.headers.get('origin') !== config.origin ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new AuthError('INVALID_ORIGIN', 403);
    const { action } = await context.params;
    if (
      ![
        'register',
        'resend',
        'verify',
        'login',
        'logout',
        'forgot-password',
        'reset-password',
      ].includes(action)
    )
      throw new AuthError('NOT_FOUND', 404);
    const ip = request.headers.get('x-real-ip') || 'unknown';
    await rateLimit('global', 'all', 300, 60);
    await rateLimit('ip', ip, 60, 900);
    const input = await body(request);
    let raw: string | undefined;
    if (
      action === 'register' ||
      action === 'resend' ||
      action === 'login' ||
      action === 'forgot-password'
    ) {
      const email = accountEmail(input.email);
      await rateLimit('email-attempts', email, 20, 900);
      if (action === 'login')
        raw = await login(email, passwordInput(input.password));
      else {
        await rateLimit('email-delivery', email, 3, 3600);
        if (action === 'forgot-password') await requestReset(email);
        else await register(email, passwordInput(input.password));
      }
    } else if (action === 'verify')
      await confirmVerification(
        tokenInput(input.token),
        passwordInput(input.password),
      );
    else if (action === 'reset-password')
      await resetPassword(
        tokenInput(input.token),
        passwordInput(input.password),
      );
    else await logout(request.cookies.get(config.cookie)?.value);
    const response = NextResponse.json(
      {
        ok: true,
        ...(action === 'login' ? { next: safeNext(input.next) } : {}),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
    if (raw)
      response.cookies.set(config.cookie, raw, {
        httpOnly: true,
        secure: config.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 86400,
      });
    if (action === 'logout')
      response.cookies.set(config.cookie, '', {
        httpOnly: true,
        secure: config.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
    return response;
  } catch (error) {
    const known = error instanceof AuthError;
    const status = known ? error.status : 503;
    return NextResponse.json(
      { error: known ? error.code : 'UNAVAILABLE' },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          ...(status === 429 ? { 'Retry-After': '900' } : {}),
        },
      },
    );
  }
}
