import { AuthPage } from '@/components/auth/auth-page';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Account · NODE',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AuthPage mode="register" searchParams={searchParams} />;
}
