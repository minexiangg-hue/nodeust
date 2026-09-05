import { getCurrentUser } from '@/lib/auth';
import { PlazaApp } from './plaza-app';
import { Welcome } from './welcome';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <PlazaApp /> : <Welcome />;
}
