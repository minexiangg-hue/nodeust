export const sectionPaths = {
  home: '/',
  explore: '/explore',
  matches: '/matches',
  chats: '/messages',
  saved: '/saved',
  posts: '/posts',
  create: '/posts/new',
  profile: '/profile',
  settings: '/settings',
  announcements: '/announcements',
  moderation: '/moderation',
} as const;
export type CommunitySection =
  | keyof typeof sectionPaths
  | 'request'
  | 'conversation'
  | 'edit';
export function sectionFromPath(path: string): CommunitySection {
  if (/^\/messages\/[^/]+$/.test(path)) return 'conversation';
  if (/^\/posts\/[^/]+\/edit$/.test(path)) return 'edit';
  if (/^\/requests\/[^/]+$/.test(path)) return 'request';
  return (
    (Object.entries(sectionPaths).find(
      ([, value]) => value === path,
    )?.[0] as CommunitySection) ?? 'home'
  );
}
