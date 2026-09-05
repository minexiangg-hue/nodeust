import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const startUrl = process.env.HKUST_SSO_START_URL;
  if (!startUrl) {
    return new NextResponse(
      'HKUST SSO 尚未配置。请先向 ITSO 注册应用并设置 HKUST_SSO_START_URL。',
      {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
    );
  }
  const target = new URL(startUrl);
  target.searchParams.set('return_to', new URL('/', request.url).toString());
  return NextResponse.redirect(target);
}
