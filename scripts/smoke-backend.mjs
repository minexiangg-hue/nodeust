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
      ],
      testMemberId: bobProfile.profile.id,
    },
    null,
    2,
  ),
);
