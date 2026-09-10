import { getCurrentUser } from '@/lib/auth';
import { MaintenanceScreen } from '@/app/maintenance-screen';
import { Welcome } from '@/app/welcome';
import { PlazaApp } from '@/app/plaza-app';
export const dynamic = 'force-dynamic';
export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_MAINTENANCE_MODE === 'true')
    return <MaintenanceScreen />;
  const user = await getCurrentUser();
  if (!user) return <Welcome />;
  return <PlazaApp>{children}</PlazaApp>;
}
