import { redirect } from 'next/navigation';
import { emailMode } from '@/lib/email-auth/config';
import { safeNext } from '@/lib/email-auth/crypto';
import { AuthForm, type AuthMode } from './auth-form';
export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: AuthMode;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = safeNext(query?.next);
  if (!emailMode())
    redirect(
      mode === 'logout'
        ? '/__gateway/logout'
        : `/__gateway/login?next=${encodeURIComponent(next)}`,
    );
  return <AuthForm mode={mode} next={next} />;
}
