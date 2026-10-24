import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in imports ? imports[name] : require(name), module, module.exports);
  return module.exports;
}
const helpers = load('lib/user-profile.ts');
const photos = load('lib/profile-photo.ts', { '@/lib/user-profile': helpers });
const revision = '733c2bf0-4e61-4f0e-8e3e-d0878eac6264';
const makeUser = (id = 'owner-a') => ({ id, email: 'owner@example.com', created_at: '2026-10-24', user_metadata: { full_name: 'Owner', profile_photo_revision: revision } });
function harness({ user = makeUser(), updateError = false, uploadError = false, removeError = false } = {}) {
  const calls = [];
  const client = {
    auth: { updateUser: async ({ data }) => { calls.push({ update: data }); return { data: { user: updateError ? null : { ...user, user_metadata: { ...user.user_metadata, ...data } } }, error: updateError }; } },
    storage: { from: bucket => {
      calls.push({ bucket });
      return {
        download: async path => { calls.push({ download: path }); return { data: new Blob(['photo']), error: null }; },
        upload: async (path, bytes, options) => { calls.push({ upload: path, bytes, options }); return { error: uploadError }; },
        remove: async paths => { calls.push({ remove: paths }); return { error: removeError }; },
      };
    } },
  };
  const imports = {
    'next/cache': { revalidatePath: path => calls.push({ revalidate: path }) },
    '@/lib/server-viewer': { getServerViewer: async () => ({ supabase: client, user }) },
    '@/lib/user-profile': helpers,
    '@/lib/profile-photo': photos,
  };
  return { account: load('app/api/profile/route.ts', imports), photo: load('app/api/profile/photo/route.ts', imports), calls };
}
function request(method, body, crossSite = false) {
  return new Request('https://stockgpt.pro/api/profile', { method, headers: { Origin: crossSite ? 'https://other.example' : 'https://stockgpt.pro', ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}) }, body });
}
async function imageForm() {
  const bytes = await sharp({ create: { width: 500, height: 300, channels: 3, background: '#ddb159' } }).png().toBuffer();
  const form = new FormData(); form.set('photo', new Blob([bytes], { type: 'image/png' }), 'photo.png');
  form.set('userId', 'victim'); form.set('path', 'victim/private');
  return form;
}

test('profile reads and mutations require a signed-in owner', async () => {
  const h = harness({ user: null });
  for (const result of [await h.account.GET(), await h.account.PATCH(request('PATCH', '{}')), await h.photo.GET(), await h.photo.POST(request('POST', await imageForm())), await h.photo.DELETE(request('DELETE'))]) assert.equal(result.status, 401);
  assert.deepEqual(h.calls, []);
});
test('cross-site name, photo and delete requests cannot mutate accounts', async () => {
  const h = harness();
  for (const result of [await h.account.PATCH(request('PATCH', '{"displayName":"Changed"}', true)), await h.photo.POST(request('POST', await imageForm(), true)), await h.photo.DELETE(request('DELETE', undefined, true))]) assert.equal(result.status, 403);
  assert.deepEqual(h.calls, []);
});
test('name save validates input, updates the dashboard name and ignores privilege fields', async () => {
  const h = harness();
  assert.equal((await h.account.PATCH(request('PATCH', '{"displayName":"  New   Name ","subscription_status":"active","userId":"victim"}'))).status, 200);
  assert.deepEqual(h.calls.find(call => call.update)?.update, { display_name: 'New Name', full_name: 'New Name' });
  for (const displayName of ['', 'a'.repeat(81), ['invalid'], null]) assert.equal((await h.account.PATCH(request('PATCH', JSON.stringify({ displayName })))).status, 400);
  assert.equal((await h.account.PATCH(request('PATCH', '{'))).status, 400);
});
test('successful photo save re-encodes pixels, uses the owner folder and cleans up previous photo only after save', async () => {
  const h = harness(); const result = await h.photo.POST(request('POST', await imageForm()));
  assert.equal(result.status, 200);
  const upload = h.calls.find(call => call.upload);
  assert.match(upload.upload, /^owner-a\/[0-9a-f-]+\.webp$/);
  const metadata = await sharp(upload.bytes).metadata();
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 384); assert.equal(metadata.height, 384); assert.equal(metadata.exif, undefined);
  const updated = h.calls.find(call => call.update).update;
  assert.deepEqual(Object.keys(updated), ['profile_photo_revision']);
  assert.deepEqual(h.calls.find(call => call.remove).remove, [`owner-a/${revision}.webp`]);
  assert.match((await result.json()).profile.avatarUrl, /^\/api\/profile\/photo\?v=/);
});
test('photo GET ignores arbitrary URL owner/path and stays private', async () => {
  const h = harness(); const result = await h.photo.GET(request('GET'));
  assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'private, no-store'); assert.equal(result.headers.get('Vary'), 'Cookie');
  assert.deepEqual(h.calls.find(call => call.download), { download: `owner-a/${revision}.webp` });
});
test('failed uploads preserve metadata; failed metadata saves clean up only new upload', async () => {
  const failedUpload = harness({ uploadError: true });
  assert.equal((await failedUpload.photo.POST(request('POST', await imageForm()))).status, 503);
  assert.ok(!failedUpload.calls.some(call => call.update || call.remove));
  const failedMetadata = harness({ updateError: true });
  assert.equal((await failedMetadata.photo.POST(request('POST', await imageForm()))).status, 503);
  assert.deepEqual(failedMetadata.calls.find(call => call.remove).remove, [failedMetadata.calls.find(call => call.upload).upload]);
});
test('removal clears the current owner photo and returns initials fallback', async () => {
  const h = harness(); const result = await h.photo.DELETE(request('DELETE'));
  assert.equal(result.status, 200); assert.equal((await result.json()).profile.avatarUrl, null);
  assert.deepEqual(h.calls.find(call => call.remove).remove, [`owner-a/${revision}.webp`]);
});
test('malformed, SVG, oversized and oversized multipart inputs cannot reach storage', async () => {
  await assert.rejects(photos.encodeProfilePhoto(new Uint8Array(2 * 1024 * 1024 + 1)));
  await assert.rejects(photos.encodeProfilePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>')));
  const h = harness(); const form = new FormData(); form.set('photo', new Blob(['not an image']), 'bad.png');
  assert.equal((await h.photo.POST(request('POST', form))).status, 400); assert.deepEqual(h.calls, []);
  const tooLarge = request('POST', new Uint8Array(2 * 1024 * 1024 + 65537));
  await assert.rejects(photos.readProfilePhoto(tooLarge));
});
test('metadata never accepts an external photo URL or path', () => {
  const user = makeUser(); user.user_metadata.profile_photo_revision = '../../victim'; user.user_metadata.avatar_url = 'https://external.example/image';
  assert.equal(helpers.userProfile(user).avatarUrl, null);
});

test('failed photo removal reports failure and preserves the current revision', async () => {
  const h = harness({ removeError: true });
  const result = await h.photo.DELETE(request('DELETE'));
  assert.equal(result.status, 503);
  assert.ok(!h.calls.some(call => call.update));
});
test('old photo cleanup failure cannot turn a committed new photo into a false failure', async () => {
  const h = harness({ removeError: true });
  const result = await h.photo.POST(request('POST', await imageForm()));
  assert.equal(result.status, 200);
  assert.match((await result.json()).profile.avatarUrl, /^\/api\/profile\/photo\?v=/);
});
