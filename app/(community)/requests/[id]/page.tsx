import type { Metadata } from 'next';
import { CommunityRoute } from '@/components/community/route-slot';
export const metadata: Metadata = { title: 'Request details · NODE' };
export default function Page() {
  return <CommunityRoute />;
}
