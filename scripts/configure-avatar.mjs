// Administrator-only, opt-in Storage API configuration. Never called by PR CI.
// SUPABASE_SERVICE_ROLE_KEY is read from the environment, never arguments or logs.
const { SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
const apply = process.argv.includes('--apply');
if (!origin || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)) throw new Error('A hosted HTTPS SUPABASE_URL and service role environment key are required');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${origin}/storage/v1${path}`, { ...options, headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Storage configuration failed (${response.status}); inspect privately in the dashboard`);
  return response.json();
}
const buckets = await request('/bucket');
const existing = buckets.find(b => b.id === 'avatar');
const desired = { id: 'avatar', name: 'avatar', public: false, file_size_limit: 2097152, allowed_mime_types: ['image/webp'] };
if (!apply) {
  console.log(JSON.stringify({ action: existing ? 'update' : 'create', desired }, null, 2));
  console.log('Dry run. Review the access change and rerun with --apply. Historical public avatars need owner-authorized re-upload.');
} else {
  await request(existing ? '/bucket/avatar' : '/bucket', { method: existing ? 'PUT' : 'POST', body: JSON.stringify(desired) });
  const actual = await request('/bucket/avatar');
  if (actual.public !== false || Number(actual.file_size_limit) !== desired.file_size_limit || actual.allowed_mime_types?.join(',') !== 'image/webp') throw new Error('Bucket verification failed');
  console.log('Private avatar bucket limits verified. Apply avatar-rls.sql and run the two-account staging acceptance checks.');
}
