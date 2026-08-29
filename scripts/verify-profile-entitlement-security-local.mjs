import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const localPassword = "LocalStockGPT!2026";
const users = {
  active: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "active-subscriber@stockgpt.invalid",
  },
  isolation: {
    id: "33333333-3333-4333-8333-333333333333",
    email: "isolation-user@stockgpt.invalid",
  },
};
const hostileInsertId = "44444444-4444-4444-8444-444444444444";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSupabase(args, options = {}) {
  const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function localStatus() {
  const output = runSupabase(["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return Object.fromEntries(
    output
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter(Boolean)
      .map((match) => {
        const value = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2];
        return [match[1], value];
      }),
  );
}

async function authenticatedClient(apiUrl, anonKey, user) {
  const client = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: localPassword,
  });
  if (error) throw new Error(`Local Auth sign-in failed for ${user.email}: ${error.message}`);
  assert(data.user?.id === user.id, `Local Auth returned the wrong user for ${user.email}`);
  return client;
}

async function requiredSingle(query, message) {
  const { data, error } = await query.single();
  if (error) throw new Error(`${message}: ${error.message}`);
  return data;
}

async function expectPermissionFailure(query, message) {
  const { error } = await query;
  assert(error, `${message}: hostile write unexpectedly succeeded`);
  assert(
    /permission denied|privilege|row-level security/iu.test(error.message),
    `${message}: unexpected failure: ${error.message}`,
  );
}

runSupabase(
  ["db", "query", "--local", "--file", "supabase/tests/verify_profile_entitlement_permissions.sql"],
  { stdio: "inherit" },
);

const status = localStatus();
const adminKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
assert(status.API_URL && status.ANON_KEY && adminKey, "Local Supabase API configuration is unavailable");

const activeClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.active);
const isolationClient = await authenticatedClient(status.API_URL, status.ANON_KEY, users.isolation);
const admin = createClient(status.API_URL, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const originalActive = await requiredSingle(
  admin
    .from("profiles")
    .select(
      "id,full_name,date_of_birth,phone,email_news_digests,email_portfolio_alerts,email_watchlist_alerts,preferred_currency,subscription_status,stripe_customer_id",
    )
    .eq("id", users.active.id),
  "Could not read the active synthetic profile as service role",
);
const originalIsolation = await requiredSingle(
  admin.from("profiles").select("id,full_name").eq("id", users.isolation.id),
  "Could not read the isolation synthetic profile as service role",
);

try {
  const ownProfile = await requiredSingle(
    activeClient.from("profiles").select("id,subscription_status").eq("id", users.active.id),
    "Authenticated owner could not select its profile",
  );
  assert(ownProfile.id === users.active.id, "Authenticated owner selected the wrong profile");

  const { data: otherProfiles, error: otherProfileError } = await activeClient
    .from("profiles")
    .select("id")
    .eq("id", users.isolation.id);
  if (otherProfileError) throw new Error(`Cross-user SELECT failed unexpectedly: ${otherProfileError.message}`);
  assert(otherProfiles.length === 0, "Authenticated user selected another user's profile");

  const approvedUpdate = {
    full_name: "Avery Approved Update",
    date_of_birth: "1991-04-05",
    phone: "+44 7700 900000",
    email_news_digests: false,
    email_portfolio_alerts: false,
    email_watchlist_alerts: true,
    preferred_currency: "GBP",
  };
  const updatedProfile = await requiredSingle(
    activeClient
      .from("profiles")
      .update(approvedUpdate)
      .eq("id", users.active.id)
      .select(Object.keys(approvedUpdate).join(",")),
    "Authenticated owner could not update approved profile fields",
  );
  for (const [column, expected] of Object.entries(approvedUpdate)) {
    assert(updatedProfile[column] === expected, `Approved profile field ${column} was not updated`);
  }

  await expectPermissionFailure(
    activeClient
      .from("profiles")
      .update({ subscription_status: "premium" })
      .eq("id", users.active.id),
    "Authenticated subscription_status update",
  );
  await expectPermissionFailure(
    activeClient
      .from("profiles")
      .update({ stripe_customer_id: "cus_local_hostile_attempt" })
      .eq("id", users.active.id),
    "Authenticated stripe_customer_id update",
  );

  const afterHostileUpdates = await requiredSingle(
    admin
      .from("profiles")
      .select("subscription_status,stripe_customer_id")
      .eq("id", users.active.id),
    "Could not verify protected profile fields",
  );
  assert(
    afterHostileUpdates.subscription_status === originalActive.subscription_status,
    "Failed hostile subscription update changed the stored value",
  );
  assert(
    afterHostileUpdates.stripe_customer_id === originalActive.stripe_customer_id,
    "Failed hostile Stripe customer update changed the stored value",
  );

  const { data: crossUserRows, error: crossUserError } = await isolationClient
    .from("profiles")
    .update({ full_name: "Cross-user hostile update" })
    .eq("id", users.active.id)
    .select("id");
  if (crossUserError) throw new Error(`Cross-user owner-field update failed unexpectedly: ${crossUserError.message}`);
  assert(crossUserRows.length === 0, "Authenticated user updated another user's approved field");
  const afterCrossUserUpdate = await requiredSingle(
    admin.from("profiles").select("full_name").eq("id", users.active.id),
    "Could not verify cross-user update isolation",
  );
  assert(
    afterCrossUserUpdate.full_name === approvedUpdate.full_name,
    "Cross-user update changed the active user's profile",
  );

  await expectPermissionFailure(
    activeClient.from("profiles").insert({
      id: hostileInsertId,
      email: "hostile-insert@stockgpt.invalid",
      subscription_status: "premium",
      stripe_customer_id: "cus_local_hostile_insert",
    }),
    "Authenticated paid-profile INSERT",
  );
  const { count: hostileInsertCount, error: hostileInsertCheckError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("id", hostileInsertId);
  if (hostileInsertCheckError) throw new Error(`Could not verify hostile INSERT: ${hostileInsertCheckError.message}`);
  assert(hostileInsertCount === 0, "Failed hostile INSERT created a profile row");

  const trustedUpdate = await requiredSingle(
    admin
      .from("profiles")
      .update({
        subscription_status: "premium",
        stripe_customer_id: "cus_local_trusted_server",
      })
      .eq("id", users.active.id)
      .select("subscription_status,stripe_customer_id"),
    "Trusted service-role billing update failed",
  );
  assert(trustedUpdate.subscription_status === "premium", "Service role did not update subscription_status");
  assert(
    trustedUpdate.stripe_customer_id === "cus_local_trusted_server",
    "Service role did not update stripe_customer_id",
  );
} finally {
  await admin
    .from("profiles")
    .update({
      full_name: originalActive.full_name,
      date_of_birth: originalActive.date_of_birth,
      phone: originalActive.phone,
      email_news_digests: originalActive.email_news_digests,
      email_portfolio_alerts: originalActive.email_portfolio_alerts,
      email_watchlist_alerts: originalActive.email_watchlist_alerts,
      preferred_currency: originalActive.preferred_currency,
      subscription_status: originalActive.subscription_status,
      stripe_customer_id: originalActive.stripe_customer_id,
    })
    .eq("id", users.active.id);
  await admin
    .from("profiles")
    .update({ full_name: originalIsolation.full_name })
    .eq("id", users.isolation.id);
  await admin.from("profiles").delete().eq("id", hostileInsertId);
  await Promise.all([activeClient.auth.signOut(), isolationClient.auth.signOut()]);
}

console.log("Local profile entitlement, column privilege and owner-isolation assertions passed.");
