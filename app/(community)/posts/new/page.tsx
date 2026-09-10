import type { Metadata } from 'next';
import { CommunityRoute } from '@/components/community/route-slot';
export const metadata: Metadata = { title: 'Post a request · NODE' };
export default function Page() {
  return <CommunityRoute />;
}
