import type { Metadata } from 'next';
import { CommunityRoute } from '@/components/community/route-slot';
export const metadata: Metadata = { title: 'My posts · NODE' };
export default function Page() {
  return <CommunityRoute />;
}
