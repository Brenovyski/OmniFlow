// One-shot helper: registers (or updates) the OmniFlow webhook with Pluggy
// so events flow into our Edge Function with our shared-secret Authorization
// header. Pluggy doesn't HMAC-sign webhook bodies — instead, headers we
// register here are sent verbatim with every delivery.
//
// Usage:
//   node scripts/register-pluggy-webhook.mjs
//
// Reads .env.functions for PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, and
// PLUGGY_WEBHOOK_SECRET. The Supabase project ref is hardcoded to
// mkwncqhhnkhcznauzveq (per CLAUDE.md). Adjust if you point at a different
// project.

import { readFileSync } from "node:fs";

const PROJECT_REF = "mkwncqhhnkhcznauzveq";
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/pluggy-webhook`;

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv(".env.functions");
const { PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_WEBHOOK_SECRET } = env;

if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET || !PLUGGY_WEBHOOK_SECRET) {
  console.error(
    "Missing PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET / PLUGGY_WEBHOOK_SECRET in .env.functions",
  );
  process.exit(1);
}
if (PLUGGY_CLIENT_SECRET === "PASTE_FROM_USER") {
  console.error("PLUGGY_CLIENT_SECRET still has the placeholder value. Update .env.functions first.");
  process.exit(1);
}

// 1. Authenticate with Pluggy to get an apiKey.
const authRes = await fetch("https://api.pluggy.ai/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clientId: PLUGGY_CLIENT_ID,
    clientSecret: PLUGGY_CLIENT_SECRET,
  }),
});
if (!authRes.ok) {
  console.error(`auth failed: ${authRes.status} ${await authRes.text()}`);
  process.exit(1);
}
const { apiKey } = await authRes.json();
console.log("✓ Authenticated with Pluggy");

// 2. List existing webhooks to see if one is already registered for our URL.
const listRes = await fetch("https://api.pluggy.ai/webhooks", {
  headers: { "X-API-KEY": apiKey },
});
if (!listRes.ok) {
  console.error(`list webhooks failed: ${listRes.status} ${await listRes.text()}`);
  process.exit(1);
}
const list = await listRes.json();
const existing = (list.results ?? []).find((w) => w.url === WEBHOOK_URL);

const payload = {
  event: "all",
  url: WEBHOOK_URL,
  headers: { Authorization: `Bearer ${PLUGGY_WEBHOOK_SECRET}` },
};

if (existing) {
  // Pluggy doesn't have a documented PATCH for webhooks — easiest is delete + re-create
  // so the headers update. We log what we're doing.
  console.log(`Existing webhook found (id=${existing.id}). Replacing it…`);
  const delRes = await fetch(`https://api.pluggy.ai/webhooks/${existing.id}`, {
    method: "DELETE",
    headers: { "X-API-KEY": apiKey },
  });
  if (!delRes.ok) {
    console.error(`delete failed: ${delRes.status} ${await delRes.text()}`);
    process.exit(1);
  }
}

const createRes = await fetch("https://api.pluggy.ai/webhooks", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
  body: JSON.stringify(payload),
});
if (!createRes.ok) {
  console.error(`create failed: ${createRes.status} ${await createRes.text()}`);
  process.exit(1);
}
const created = await createRes.json();
console.log("✓ Webhook registered:");
console.log(`   id: ${created.id}`);
console.log(`   url: ${created.url}`);
console.log(`   event: ${created.event}`);
console.log(
  "\nPluggy will now POST every event to the URL with the Authorization header set.",
);
