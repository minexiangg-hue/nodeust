import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/current-member';
import { CommunityRoute } from '@/components/community/route-slot';
export const metadata: Metadata = {
  title: 'Moderation · NODE',
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (process.env.NODE_MAINTENANCE_MODE === 'true') return null;
  let role: string;
  try {
    role = (await requireMember()).role;
  } catch {
    notFound();
  }
  if (!['owner', 'admin', 'moderator'].includes(role)) notFound();
  return <CommunityRoute />;
}
