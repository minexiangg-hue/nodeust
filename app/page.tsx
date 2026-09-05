import { getCurrentUser } from '@/lib/auth';
import { MaintenanceScreen } from './maintenance-screen';
import { PlazaApp } from './plaza-app';
import { Welcome } from './welcome';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (process.env.NODE_MAINTENANCE_MODE === 'true')
    return <MaintenanceScreen />;
  const user = await getCurrentUser();
  return user ? <PlazaApp /> : <Welcome />;
}
