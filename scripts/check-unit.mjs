import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProfileUpdate } from '../lib/profile-update.ts';
import { canManageUser, isUserAction } from '../lib/moderation-policy.ts';

test('language-only PATCH preserves omitted profile and visibility fields', () => {
  assert.deepEqual(buildProfileUpdate({ preferredLanguage: 'en' }), {
    update: { preferredLanguage: 'en' },
  });
  assert.deepEqual(buildProfileUpdate({}), { update: {} });
});

test('optional profile text can be explicitly cleared and is bounded', () => {
  assert.deepEqual(buildProfileUpdate({ bio: '  ', contactValue: null }), {
    update: { bio: null, contactValue: null },
  });
  assert.equal(
    buildProfileUpdate({ bio: 'x'.repeat(501) }).update.bio.length,
    500,
  );
  assert.equal(
    buildProfileUpdate({ nickname: '  Alice  ' }).update.nickname,
    'Alice',
  );
});

test('invalid profile values are rejected rather than silently clearing data', () => {
  for (const input of [
    { bio: 123 },
    { bio: {} },
    { nickname: null },
    { nickname: '  ' },
    { preferredLanguage: 'fr' },
    { profileVisibility: 'public' },
  ])
    assert.ok(buildProfileUpdate(input).error, JSON.stringify(input));
});

test('profile PATCH cannot assign roles or identity fields', () => {
  assert.deepEqual(
    buildProfileUpdate({ role: 'owner', id: 'other', email: 'other' }),
    { update: {} },
  );
});

test('moderation accepts only supported actions', () => {
  for (const action of [
    'activate',
    'suspend',
    'ban',
    'make_admin',
    'make_moderator',
  ])
    assert.equal(isUserAction(action), true);
  for (const action of [undefined, null, {}, 'delete', '', 'toString'])
    assert.equal(isUserAction(action), false);
});

test('role hierarchy applies to every account action, including reports', () => {
  const roles = ['member', 'moderator', 'admin', 'owner'];
  const actions = [
    'activate',
    'suspend',
    'ban',
    'make_admin',
    'make_moderator',
  ];
  for (let actor = 0; actor < roles.length; actor++) {
    for (let target = actor; target < roles.length; target++) {
      for (const action of actions)
        assert.equal(canManageUser(roles[actor], roles[target], action), false);
    }
  }
});

test('moderators cannot promote themselves or members; only Owner appoints admins', () => {
  assert.equal(canManageUser('moderator', 'member', 'make_moderator'), false);
  assert.equal(canManageUser('moderator', 'member', 'make_admin'), false);
  assert.equal(canManageUser('admin', 'member', 'make_admin'), false);
  assert.equal(canManageUser('admin', 'member', 'make_moderator'), true);
  assert.equal(canManageUser('owner', 'member', 'make_admin'), true);
  assert.equal(canManageUser('owner', 'moderator', 'make_admin'), true);
});

test('moderators retain lower-role suspension and restoration permissions', () => {
  for (const action of ['activate', 'suspend', 'ban'])
    assert.equal(canManageUser('moderator', 'member', action), true);
});

// Keep evaluation and the UI on the exact same existing housing rule.
import { findReciprocalHousingMatches } from '../lib/matching.ts';
import { parseDrafts } from '../lib/drafts.ts';
test('reciprocal matcher preserves its category, ownership and exact-string boundaries', () => {
  const base = { category: 'hall', from: 'Hall I', to: 'Hall II' };
  const own = { ...base, id: 'own', mine: true };
  const reciprocal = { ...base, id: 'yes', from: 'Hall II', to: 'Hall I' };
  const otherCategory = {
    ...reciprocal,
    id: 'transport',
    category: 'transport',
  };
  const alias = { ...reciprocal, id: 'alias', from: 'Hall 2' };
  assert.deepEqual(
    findReciprocalHousingMatches([own, reciprocal, otherCategory, alias]),
    [reciprocal],
  );
  assert.deepEqual(findReciprocalHousingMatches([reciprocal]), []);
});
test('transport drafts survive storage parsing alongside existing categories', () => {
  const draft = {
    id: 'transport-draft',
    updatedAt: '2026-09-11',
    category: 'transport',
    title: 'Share a taxi',
    detail: 'Campus to Hang Hau',
    from: '',
    to: '',
    locationId: 'ug-hall-i',
  };
  assert.deepEqual(parseDrafts(JSON.stringify([draft])), [draft]);
  assert.deepEqual(
    parseDrafts(JSON.stringify([{ ...draft, category: 'invalid' }])),
    [],
  );
});
