import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(output.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const owner = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const other = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "33333333-3333-4333-8333-333333333333";
const providerId = "70000000-0000-4000-8000-000000000001";
const firstSecret = "synthetic-local-secret-one";
const secondSecret = "synthetic-local-secret-two";
const vaultName = `broker-user/${providerId}/${userId}`;
const vaultCount = (name) => {
  const sql = `select count(*) as credential_count from vault.secrets where name = '${name}'`;
  const result = execFileSync(process.execPath, [cli, "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8" });
  const parsed = JSON.parse(result.slice(result.indexOf("["), result.lastIndexOf("]") + 1));
  return Number(parsed[0].credential_count);
};

for (const [client, email] of [[owner, "active-subscriber@stockgpt.invalid"], [other, "isolation-user@stockgpt.invalid"]]) {
  const { error } = await client.auth.signInWithPassword({ email, password: "LocalStockGPT!2026" });
  if (error) throw error;
}

try {
  for (const browser of [anon, owner, other]) {
    assert((await browser.rpc("get_broker_user_secret", { p_user_id: userId, p_provider_id: providerId })).error, "Browser retrieved a secret");
    assert((await browser.rpc("store_broker_user_secret", { p_user_id: otherUserId, p_provider_id: providerId, p_provider_user_id: "forged", p_user_secret: "forged" })).error, "Browser overwrote a secret");
    assert((await browser.from("user_provider_credentials").select("*")).error, "Private metadata exposed through Data API");
  }

  const { error: firstError } = await admin.rpc("store_broker_user_secret", {
    p_user_id: userId, p_provider_id: providerId, p_provider_user_id: "stockgpt-11111111-1111-4111-8111-111111111111", p_user_secret: firstSecret,
  });
  if (firstError) throw firstError;
  const read = await admin.rpc("get_broker_user_secret", { p_user_id: userId, p_provider_id: providerId });
  if (read.error) throw read.error;
  assert.equal(read.data.length, 1);
  assert.equal(read.data[0].user_secret, firstSecret);
  assert.equal(vaultCount(vaultName), 1, "Credential metadata did not identify exactly one Vault secret");
  assert.equal((await admin.rpc("get_broker_user_secret", { p_user_id: otherUserId, p_provider_id: providerId })).data?.length, 0, "Exact scope returned another user's secret");

  const { error: rotateError } = await admin.rpc("store_broker_user_secret", {
    p_user_id: userId, p_provider_id: providerId, p_provider_user_id: "stockgpt-11111111-1111-4111-8111-111111111111", p_user_secret: secondSecret,
  });
  if (rotateError) throw rotateError;
  const rotated = await admin.rpc("get_broker_user_secret", { p_user_id: userId, p_provider_id: providerId });
  if (rotated.error) throw rotated.error;
  assert.equal(rotated.data[0].user_secret, secondSecret, "Rotation did not replace usable secret");
  assert.equal(vaultCount(vaultName), 1, "Rotation orphaned a second Vault secret");

  for (const table of ["broker_connections", "broker_accounts", "broker_positions", "broker_cash_balances", "broker_activities", "broker_sync_jobs"]) {
    const { data, error } = await admin.from(table).select("*");
    if (error) throw error;
    assert(!JSON.stringify(data).includes(firstSecret) && !JSON.stringify(data).includes(secondSecret), `Secret leaked into ${table}`);
  }

  const revoked = await admin.rpc("revoke_broker_user_secret", { p_user_id: userId, p_provider_id: providerId });
  if (revoked.error) throw revoked.error;
  assert.equal(revoked.data, true);
  assert.equal((await admin.rpc("get_broker_user_secret", { p_user_id: userId, p_provider_id: providerId })).data?.length, 0);
  assert.equal(vaultCount(vaultName), 0, "Revocation orphaned a usable Vault secret");

  const temporary = await admin.auth.admin.createUser({ email: "broker-secret-cascade@stockgpt.invalid", email_confirm: true, password: "LocalStockGPT!2026" });
  if (temporary.error) throw temporary.error;
  const tempName = `broker-user/${providerId}/${temporary.data.user.id}`;
  try {
    const stored = await admin.rpc("store_broker_user_secret", {
      p_user_id: temporary.data.user.id, p_provider_id: providerId,
      p_provider_user_id: `stockgpt-${temporary.data.user.id}`, p_user_secret: "synthetic-local-cascade-secret",
    });
    if (stored.error) throw stored.error;
    assert.equal(vaultCount(tempName), 1);
    const deleted = await admin.auth.admin.deleteUser(temporary.data.user.id);
    if (deleted.error) throw deleted.error;
    assert.equal(vaultCount(tempName), 0, "Auth/user cascade orphaned a usable Vault secret");
  } finally {
    await admin.auth.admin.deleteUser(temporary.data.user.id);
  }
} finally {
  await admin.rpc("revoke_broker_user_secret", { p_user_id: userId, p_provider_id: providerId });
  await Promise.all([owner.auth.signOut(), other.auth.signOut()]);
}

console.log("Local broker Vault boundary, hostile browser sessions, exact retrieval, rotation and revocation passed.");
