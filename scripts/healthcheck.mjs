const baseUrl = process.env.NODE_HEALTH_URL ?? 'http://127.0.0.1:3000';
const response = await fetch(`${baseUrl}/api/health`);
const payload = await response.json().catch(() => ({}));

if (!response.ok || payload.status !== 'ok') {
  console.error(JSON.stringify(payload));
  process.exit(1);
}

console.log(JSON.stringify(payload));
