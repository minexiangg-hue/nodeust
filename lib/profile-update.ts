const optionalFields = {
  department: 100,
  programme: 100,
  yearOfStudy: 30,
  bio: 500,
  avatarSeed: 80,
  contactMethod: 30,
  contactValue: 120,
} as const;

type ProfileUpdate = Partial<
  Record<keyof typeof optionalFields, string | null>
> & {
  nickname?: string;
  preferredLanguage?: 'en' | 'zh-CN' | 'zh-HK';
  profileVisibility?: 'private' | 'mutual';
};

/** An omitted PATCH field is unchanged; null/blank explicitly clears optional text. */
export function buildProfileUpdate(
  input: Record<string, unknown>,
):
  | { update: ProfileUpdate; error?: never }
  | { error: string; update?: never } {
  const update: ProfileUpdate = {};
  for (const field of Object.keys(
    optionalFields,
  ) as (keyof typeof optionalFields)[]) {
    if (!Object.hasOwn(input, field)) continue;
    const value = input[field];
    if (value !== null && typeof value !== 'string')
      return { error: `${field} must be text or null.` };
    update[field] = value?.trim().slice(0, optionalFields[field]) || null;
  }
  if (Object.hasOwn(input, 'nickname')) {
    if (typeof input.nickname !== 'string' || !input.nickname.trim())
      return { error: 'Nickname cannot be empty.' };
    update.nickname = input.nickname.trim().slice(0, 50);
  }
  if (Object.hasOwn(input, 'preferredLanguage')) {
    const language = input.preferredLanguage;
    if (language !== 'en' && language !== 'zh-CN' && language !== 'zh-HK')
      return { error: 'Unsupported language.' };
    update.preferredLanguage = language;
  }
  if (Object.hasOwn(input, 'profileVisibility')) {
    const visibility = input.profileVisibility;
    if (visibility !== 'private' && visibility !== 'mutual')
      return { error: 'Unsupported profile visibility.' };
    update.profileVisibility = visibility;
  }
  return { update };
}
