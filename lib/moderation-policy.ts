const roleRank = { member: 0, moderator: 1, admin: 2, owner: 3 } as const;
type Role = keyof typeof roleRank;
const userActions = [
  'activate',
  'suspend',
  'ban',
  'make_moderator',
  'make_admin',
] as const;
export type UserAction = (typeof userActions)[number];

export function isUserAction(value: unknown): value is UserAction {
  return (
    typeof value === 'string' && userActions.some((action) => action === value)
  );
}

/** No self/peer management. Only Owner can appoint an admin. */
export function canManageUser(
  actor: Role,
  target: Role,
  action: UserAction,
): boolean {
  if (roleRank[actor] <= roleRank[target]) return false;
  if (action === 'make_admin') return actor === 'owner';
  if (action === 'make_moderator')
    return actor === 'owner' || actor === 'admin';
  return actor !== 'member';
}
