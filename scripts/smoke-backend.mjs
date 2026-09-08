const baseUrl = process.env.NODE_SMOKE_URL ?? 'http://localhost:3000';
const target = new URL(baseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname))
  throw new Error('The backend smoke test is restricted to a local server.');
const runId = Date.now().toString(36);

const alice = identityHeaders(`node-smoke-a-${runId}`);
const bob = identityHeaders(`node-smoke-b-${runId}`);

function identityHeaders(uid) {
  return {
    'x-hkust-uid': uid,
    'x-hkust-email': `${uid}@connect.ust.hk`,
    'x-hkust-affiliation': 'student',
    'x-hkust-full-name': `NODE Smoke ${uid.slice(-4)}`,
  };
}

async function request(path, options = {}, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(
      `${options.method ?? 'GET'} ${path}: expected ${expected}, received ${response.status} ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function json(method, headers, body) {
  return {
    method,
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Initialize the development Owner before creating ordinary test members.
await request('/api/profile');
await request('/api/profile', { headers: alice });
const bobProfile = await request('/api/profile', { headers: bob });
await request(
  '/api/profile',
  json('PATCH', alice, {
    contactMethod: 'email',
    contactValue: alice['x-hkust-email'],
    preferredLanguage: 'en',
  }),
);
await request(
  '/api/profile',
  json('PATCH', bob, {
    contactMethod: 'email',
    contactValue: bob['x-hkust-email'],
    preferredLanguage: 'en',
  }),
);
await request(
  '/api/location',
  json('PATCH', alice, { locationId: 'ug-hall-vii' }),
);

await request(
  '/api/profile',
  json('PATCH', alice, { preferredLanguage: 'zh-HK' }),
);
const savedProfile = await request('/api/profile', { headers: alice });
if (savedProfile.profile.contactValue !== alice['x-hkust-email'])
  throw new Error('A partial profile update cleared an omitted contact field.');
await request('/api/profile', json('PATCH', alice, null), 400);

const post = await request(
  '/api/posts',
  json('POST', alice, {
    category: 'goods',
    title: `Backend smoke ${runId}`,
    body: 'Temporary integration-check record.',
    locationId: 'ug-hall-vii',
  }),
  201,
);
const conversation = await request(
  '/api/conversations',
  json('POST', bob, { postId: post.id }),
  201,
);
await request(
  `/api/conversations/${conversation.id}/messages`,
  json('POST', bob, { body: `Anonymous message ${runId}` }),
  201,
);
const messageList = await request(
  `/api/conversations/${conversation.id}/messages`,
  { headers: alice },
);
if (
  !messageList.items?.some((item) => item.body === `Anonymous message ${runId}`)
)
  throw new Error(
    'The persisted anonymous message was not returned to the recipient.',
  );
const senderMessages = await request(
  `/api/conversations/${conversation.id}/messages`,
  { headers: bob },
);
const receivedMessage = messageList.items.find(
  (item) => item.body === `Anonymous message ${runId}`,
);
const sentMessage = senderMessages.items.find(
  (item) => item.id === receivedMessage.id,
);
if (
  receivedMessage.isMine !== false ||
  sentMessage?.isMine !== true ||
  'senderId' in receivedMessage ||
  'senderId' in sentMessage
)
  throw new Error(
    'Message ownership must be boolean and must not expose sender IDs.',
  );
await request(
  `/api/conversations/${conversation.id}/messages`,
  json('POST', bob, { body: 123 }),
  422,
);

await request(
  `/api/conversations/${conversation.id}/contact`,
  { method: 'POST', headers: bob },
  201,
);
const exchange = await request(
  `/api/conversations/${conversation.id}/contact`,
  { method: 'PATCH', headers: alice },
);
if (exchange.status !== 'accepted' || exchange.contacts?.length !== 2)
  throw new Error('Mutual contact exchange did not return both participants.');

const report = await request(
  '/api/reports',
  json('POST', bob, {
    targetType: 'post',
    targetId: post.id,
    reason: 'other',
    details: 'Temporary smoke-test report.',
  }),
  201,
);
await request('/api/admin/reports', { headers: bob }, 403);
await request('/api/admin/reports');
await request(
  '/api/admin/reports',
  json(
    'PATCH',
    {},
    {
      reportId: report.id,
      action: 'remove',
      reason: 'Automated smoke-test cleanup.',
    },
  ),
);
const afterRemoval = await request(
  `/api/posts?q=${encodeURIComponent(`Backend smoke ${runId}`)}`,
  { headers: alice },
);
if (afterRemoval.items?.some((item) => item.id === post.id))
  throw new Error('The moderated post is still visible in active results.');

// Keep these against a disposable local MySQL database. They touch only records
// created by this run and exercise persistence, not the stubbed unit executor.
await request(
  `/api/posts/${post.id}`,
  json('PATCH', alice, { action: 'reopen' }),
  409,
);
await request(
  '/api/admin/reports',
  json('DELETE', bob, { id: report.id }),
  403,
);
await request('/api/admin/reports', json('DELETE', {}, { id: report.id }));
const ownPost = await request(
  '/api/posts',
  json('POST', alice, {
    category: 'goods',
    title: `Manage smoke ${runId}`,
    body: 'Temporary owner-management test.',
    locationId: 'ug-hall-vii',
  }),
  201,
);
await request(`/api/posts/${ownPost.id}`, json('DELETE', bob, {}), 404);
await request(
  `/api/posts/${ownPost.id}`,
  json('PATCH', alice, { action: 'close' }),
);
const ownList = await request(
  `/api/posts?mine=1&q=${encodeURIComponent(`Manage smoke ${runId}`)}`,
  { headers: alice },
);
if (
  !ownList.items?.some(
    (item) =>
      item.id === ownPost.id &&
      item.status === 'closed' &&
      item.isMine === true,
  )
)
  throw new Error(
    'The closed post is missing from its owner’s management list.',
  );
const otherList = await request(
  `/api/posts?mine=1&q=${encodeURIComponent(`Manage smoke ${runId}`)}`,
  { headers: bob },
);
if (otherList.items?.some((item) => item.id === ownPost.id))
  throw new Error('My posts leaked another member’s post.');
await request(
  `/api/posts/${ownPost.id}`,
  json('PATCH', alice, { action: 'reopen' }),
);
await request(`/api/posts/${ownPost.id}`, json('DELETE', alice, {}));
await request(
  `/api/posts/${ownPost.id}`,
  json('PATCH', alice, { action: 'reopen' }),
  409,
);
const retainedChat = await request(
  `/api/conversations/${conversation.id}/messages`,
  { headers: alice },
);
if (
  !retainedChat.items?.some(
    (item) => item.body === `Anonymous message ${runId}`,
  )
)
  throw new Error('Removing a post broke its existing conversation.');

const note = await request(
  '/api/announcements',
  json(
    'POST',
    {},
    {
      title: `Announcement smoke ${runId}`,
      body: 'Temporary announcement cleanup test.',
      kind: 'info',
    },
  ),
  201,
);
await request('/api/announcements?manage=1', { headers: bob }, 403);
await request('/api/announcements', json('DELETE', bob, { id: note.id }), 403);
await request('/api/announcements', json('DELETE', {}, { id: note.id }));
const board = await request('/api/announcements');
if (board.items?.some((item) => item.id === note.id))
  throw new Error('Deleted announcement remains public.');

const feedback = await request(
  '/api/feedback',
  json('POST', bob, {
    category: 'bug',
    body: 'Temporary feedback cleanup test.',
  }),
  201,
);
await request('/api/feedback', json('DELETE', bob, { id: feedback.id }), 403);
await request('/api/feedback', json('DELETE', {}, { id: feedback.id }), 409);
await request(
  '/api/feedback',
  json('PATCH', {}, { id: feedback.id, action: 'resolve' }),
);
await request('/api/feedback', json('DELETE', {}, { id: feedback.id }));
await request(
  '/api/feedback',
  json('PATCH', {}, { id: feedback.id, action: 'reopen' }),
  409,
);

console.log(
  JSON.stringify(
    {
      status: 'passed',
      checks: [
        'member provisioning',
        'profile persistence',
        'manual location persistence',
        'post persistence',
        'conversation creation',
        'anonymous message persistence and participant access',
        'mutual contact reveal',
        'member moderation denial',
        'owner report review and post removal',
        'own-post scope, close/reopen/delete and conversation retention',
        'Owner-only announcement and completed-record cleanup',
      ],
      testMemberId: bobProfile.profile.id,
    },
    null,
    2,
  ),
);
