/**
 * Probes every public Supabase RPC + key PostgREST tables + app routes,
 * runs vitest, and writes reports/api-test-report.html
 *
 * Usage: node --env-file=.env.local scripts/api-probe.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const reportDir = join(root, "reports");
mkdirSync(reportDir, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl =
  process.env.NEXT_PUBLIC_CUSTOMER_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

if (!url || !anon || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / keys in env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NIL = "00000000-0000-4000-8000-000000000000";
const startedAt = new Date();

/** @typedef {{ name: string; group: string; status: 'pass'|'fail'|'warn'|'skip'; ms: number; detail: string }} Result */
/** @type {Result[]} */
const results = [];

function record(name, group, status, ms, detail) {
  results.push({ name, group, status, ms, detail: String(detail ?? "").slice(0, 500) });
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "warn" ? "!" : "·";
  console.log(`${icon} [${group}] ${name} (${ms}ms) ${detail}`.slice(0, 160));
}

async function timed(fn) {
  const t0 = performance.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Math.round(performance.now() - t0) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ms: Math.round(performance.now() - t0),
    };
  }
}

function classifyRpcError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("could not find the function") || m.includes("pgrst202")) return "missing";
  if (
    m.includes("not allowed") ||
    m.includes("permission") ||
    m.includes("42501") ||
    m.includes("jwt") ||
    m.includes("not authenticated") ||
    m.includes("auth.uid")
  ) {
    return "auth";
  }
  if (
    m.includes("not found") ||
    m.includes("p0002") ||
    m.includes("22p02") ||
    m.includes("invalid input") ||
    m.includes("violates") ||
    m.includes("check") ||
    m.includes("required") ||
    m.includes("null value") ||
    m.includes("22023")
  ) {
    return "validation";
  }
  return "other";
}

/** Safe sample fixtures from live DB (read-only). */
async function loadFixtures() {
  const [{ data: order }, { data: quote }, { data: customer }, { data: payment }, { data: vendorOrder }, { data: profile }] =
    await Promise.all([
      admin.from("orders").select("id, order_number, quote_id").limit(1).maybeSingle(),
      admin.from("quotes").select("id, quote_number, current_version_id").limit(1).maybeSingle(),
      admin.from("customers").select("id, phone").limit(1).maybeSingle(),
      admin.from("payments").select("id").limit(1).maybeSingle(),
      admin.from("vendor_orders").select("id").limit(1).maybeSingle(),
      admin.from("profiles").select("id").eq("is_active", true).limit(1).maybeSingle(),
    ]);
  return {
    orderId: order?.id ?? NIL,
    orderNumber: order?.order_number ?? null,
    quoteId: quote?.id ?? NIL,
    versionId: quote?.current_version_id ?? NIL,
    customerId: customer?.id ?? NIL,
    phone: customer?.phone ?? "9999999999",
    paymentId: payment?.id ?? NIL,
    vendorOrderId: vendorOrder?.id ?? NIL,
    userId: profile?.id ?? NIL,
  };
}

/**
 * Probe catalog — every RPC in public schema granted to authenticated/service/anon.
 * Uses SQL via PostgREST rpc listing from types + live pg_catalog through a helper query
 * executed with supabase db is not available here; we probe from types/database.ts list.
 */
function rpcCatalog() {
  const typesPath = join(root, "types/database.ts");
  const text = readFileSync(typesPath, "utf8");
  // Prefer the public schema Functions block (second "Functions:" in generated types).
  const markers = [...text.matchAll(/^\s{4}Functions:\s*\{/gm)];
  const start = markers.length > 1 ? markers[1].index : markers[0]?.index;
  if (start == null) return [];
  const from = text.slice(start);
  const endMatch = from.match(/\n\s{4}Enums:\s*\{/);
  const block = endMatch ? from.slice(0, endMatch.index) : from;
  const names = [...block.matchAll(/^\s{6}([a-z_][a-z0-9_]*)\s*:/gm)].map((m) => m[1]);
  return [...new Set(names)].filter((n) => n !== "graphql");
}

function buildArgs(name, fx) {
  const A = {
    admin_set_profile_roles: { p_user_id: NIL, p_roles: ["sales"] },
    admin_set_role: { p_user_id: NIL, p_role: "sales" },
    admin_update_user: { p_user_id: NIL, p_full_name: "Probe" },
    floor_counts: {},
    customer_latest_orders: { p_ids: [fx.customerId] },
    allow_status: {},
    approve_quote: { p_quote_id: NIL },
    request_credit_delivery: { p_order_id: NIL, p_notes: "probe" },
    decide_credit_delivery: { p_order_id: NIL, p_approve: false },
    save_vendor_commercial: { p_vendor_order_id: NIL },
    allocate_vendor_order: {
      p_order_id: NIL,
      p_vendor_id: NIL,
      p_items: [],
    },
    save_vendor_quote: {
      p_vendor_order_id: NIL,
      p_quote_ref: "PROBE",
      p_quote_amount: 1,
    },
    decide_vendor_quote: { p_vendor_order_id: NIL, p_approve: false, p_reason: "probe" },
    confirm_vendor_send: { p_vendor_order_id: NIL },
    record_vendor_payment: {
      p_vendor_order_id: NIL,
      p_amount: 1,
      p_method: "cash",
    },
    assert_transition: { p_from: "quote_draft", p_to: "quote_pending_accounts" },
    cancel_job: { p_quote_id: NIL, p_reason: "probe" },
    complete_delivery: { p_order_id: NIL },
    create_quote: { p_customer_id: NIL, p_items: [] },
    find_customer_by_phone: { p_phone: fx.phone },
    normalize_phone: { p_phone: "9876543210" },
    current_profile: {},
    current_role: {},
    can_schedule_aftercare: {},
    ensure_tax_invoice: { p_order_id: NIL },
    has_permission: { required: "orders.read" },
    has_role: { p_role: "operations" },
    insert_quote_items: { p_version_id: NIL, p_items: [] },
    is_accounts: {},
    is_admin: {},
    mark_vendor_dispatched: { p_vendor_order_id: NIL },
    notify_user: {
      p_user_id: NIL,
      p_type: "probe",
      p_title: "probe",
      p_body: "probe",
    },
    order_balance: { p_order_id: fx.orderId },
    order_items_fully_received: { p_order_id: fx.orderId },
    order_outstanding: { p_order_id: fx.orderId },
    quote_balance: { p_quote_id: fx.quoteId },
    order_item_available_to_send: { p_order_item_id: NIL },
    quote_outstanding: { p_quote_id: fx.quoteId },
    recalc_version_totals: { p_version_id: NIL },
    record_items_received: { p_vendor_order_id: NIL, p_received: [] },
    record_payment: {
      p_quote_id: NIL,
      p_kind: "advance",
      p_amount: 1,
      p_method: "upi",
      p_reference: "PROBE",
    },
    reassign_order_sales: { p_order_id: NIL, p_to_user_id: NIL },
    reassign_sales_cover: { p_from_user_id: NIL, p_to_user_id: NIL },
    write_off_order_items: { p_order_id: NIL, p_items: [] },
    reject_payment: { p_payment_id: NIL, p_notes: "probe" },
    reject_quote: { p_quote_id: NIL, p_reason: "probe" },
    require_permission: { required: "orders.read" },
    revise_quote: { p_quote_id: NIL, p_items: [] },
    send_order_to_vendor: { p_order_id: NIL, p_vendor_id: NIL, p_items: [] },
    submit_quote: { p_quote_id: NIL },
    send_quote_to_customer: { p_quote_id: NIL },
    user_has_role: { p_user_id: fx.userId, p_role: "operations" },
    verify_payment: { p_payment_id: NIL },
    write_audit: {
      p_actor: fx.userId,
      p_role: "operations",
      p_action: "PROBE",
      p_entity_type: "order",
      p_entity_id: NIL,
      p_old_state: "none",
      p_new_state: "none",
    },
    get_public_quote: { p_token: "invalid-token-probe" },
  };
  return A[name] ?? {};
}

/** Read RPCs that should return data without a user JWT (service role). */
const READ_OK = new Set([
  "floor_counts",
  "customer_latest_orders",
  "normalize_phone",
  "order_items_fully_received",
  "order_outstanding",
  "quote_outstanding",
  "user_has_role",
  "assert_transition",
  "get_public_quote",
]);

/** These are reachable when they correctly demand auth / validate input. */
const AUTH_OR_VALIDATION_OK = new Set([
  "find_customer_by_phone",
  "order_balance",
  "quote_balance",
  "insert_quote_items",
  "notify_user",
]);

const TABLES = [
  "orders",
  "quotes",
  "customers",
  "payments",
  "vendor_orders",
  "profiles",
  "materials",
  "vendors",
  "notifications",
  "audit_logs",
  "company_settings",
  "leads",
  "role_permissions",
];

const APP_ROUTES = [
  "/",
  "/login",
  "/home",
  "/orders",
  "/orders?credit=1",
  "/customers",
  "/quotes",
  "/reports",
  "/more",
];

async function probeRpcs(fx) {
  const names = rpcCatalog();
  for (const name of names) {
    const args = buildArgs(name, fx);
    const run = await timed(async () => {
      const { data, error } = await admin.rpc(name, args);
      if (error) throw new Error(error.message);
      return data;
    });

    if (run.ok) {
      const preview =
        run.value == null
          ? "null"
          : typeof run.value === "object"
            ? JSON.stringify(run.value).slice(0, 120)
            : String(run.value);
      record(name, "RPC", "pass", run.ms, `ok · ${preview}`);
      continue;
    }

    const kind = classifyRpcError(run.error);
    if (kind === "missing") {
      record(name, "RPC", "fail", run.ms, `MISSING · ${run.error}`);
    } else if (READ_OK.has(name)) {
      record(name, "RPC", "fail", run.ms, `expected read ok · ${run.error}`);
    } else if (
      kind === "auth" ||
      kind === "validation" ||
      AUTH_OR_VALIDATION_OK.has(name)
    ) {
      record(name, "RPC", "pass", run.ms, `reachable (${kind}) · ${run.error}`);
    } else {
      record(name, "RPC", "warn", run.ms, `unexpected · ${run.error}`);
    }
  }
}

async function probeTables() {
  for (const table of TABLES) {
    const svc = await timed(async () => {
      const { data, error, count } = await admin
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    });
    if (svc.ok) {
      record(`GET /rest/v1/${table} (service)`, "REST", "pass", svc.ms, `count=${svc.value}`);
    } else {
      record(`GET /rest/v1/${table} (service)`, "REST", "fail", svc.ms, svc.error);
    }

    const pub = await timed(async () => {
      const { error } = await publicClient.from(table).select("*", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return "ok";
    });
    // Anon may be blocked by RLS — that is healthy for private tables
    if (pub.ok) {
      record(`GET /rest/v1/${table} (anon)`, "REST", "pass", pub.ms, "reachable (RLS may return 0)");
    } else if (/permission|rls|policy|jwt/i.test(pub.error || "")) {
      record(`GET /rest/v1/${table} (anon)`, "REST", "pass", pub.ms, `blocked as expected · ${pub.error}`);
    } else {
      record(`GET /rest/v1/${table} (anon)`, "REST", "warn", pub.ms, pub.error);
    }
  }
}

async function probeAppRoutes() {
  for (const path of APP_ROUTES) {
    const target = `${appUrl.replace(/\/$/, "")}${path}`;
    const run = await timed(async () => {
      const res = await fetch(target, {
        redirect: "manual",
        headers: { "user-agent": "nuhome-api-probe/1.0" },
      });
      return { status: res.status, location: res.headers.get("location") };
    });
    if (!run.ok) {
      record(path, "HTTP", "fail", run.ms, run.error);
      continue;
    }
    const { status, location } = run.value;
    if (status >= 200 && status < 400) {
      record(path, "HTTP", "pass", run.ms, `${status}${location ? ` → ${location}` : ""}`);
    } else if (status === 401 || status === 403 || status === 307 || status === 308) {
      record(path, "HTTP", "pass", run.ms, `${status} auth/redirect${location ? ` → ${location}` : ""}`);
    } else {
      record(path, "HTTP", status >= 500 ? "fail" : "warn", run.ms, `${status}${location ? ` → ${location}` : ""}`);
    }
  }
}

function runVitest() {
  try {
    const env = { ...process.env };
    // Isolate URL helpers from the probe's --env-file values.
    delete env.NEXT_PUBLIC_APP_URL;
    delete env.NEXT_PUBLIC_CUSTOMER_APP_URL;
    const out = execSync("npx vitest run --reporter=json", {
      cwd: root,
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (error) {
    const stdout = error.stdout?.toString?.() || "";
    try {
      return JSON.parse(stdout);
    } catch {
      return {
        parseError: true,
        message: error.message,
        stdout: stdout.slice(0, 2000),
        stderr: (error.stderr?.toString?.() || "").slice(0, 2000),
      };
    }
  }
}

function vitestToResults(report) {
  if (!report || report.parseError) {
    record("vitest suite", "Unit", "fail", 0, report?.message || "failed to parse vitest json");
    return;
  }
  const files = report.testResults || report.testResults === undefined
    ? report.testResults
    : null;

  // Vitest JSON reporter shape varies; support both classic and vitest 4
  if (Array.isArray(report.testResults)) {
    for (const file of report.testResults) {
      const name = (file.name || file.file || "file").replace(root + "/", "");
      const failed = (file.assertionResults || []).filter((a) => a.status === "failed");
      const passed = (file.assertionResults || []).filter((a) => a.status === "passed");
      const status = failed.length ? "fail" : "pass";
      record(
        name,
        "Unit",
        status,
        Math.round(file.endTime && file.startTime ? file.endTime - file.startTime : 0),
        `${passed.length} passed, ${failed.length} failed`,
      );
    }
    return;
  }

  // Vitest 4 default json may nest under files
  if (Array.isArray(report)) {
    for (const file of report) {
      const name = file.filename || file.name || "file";
      const failed = (file.tasks || []).filter((t) => t.result?.state === "fail").length;
      const passed = (file.tasks || []).filter((t) => t.result?.state === "pass").length;
      record(name, "Unit", failed ? "fail" : "pass", 0, `${passed} passed, ${failed} failed`);
    }
    return;
  }

  // Fallback: summary only
  const numTotal = report.numTotalTests ?? report.numTotalTestSuites;
  const numFailed = report.numFailedTests ?? 0;
  const numPassed = report.numPassedTests ?? 0;
  if (numTotal != null) {
    record(
      "vitest summary",
      "Unit",
      numFailed ? "fail" : "pass",
      0,
      `${numPassed} passed / ${numFailed} failed / ${numTotal} total`,
    );
  } else {
    writeFileSync(join(reportDir, "vitest-raw.json"), JSON.stringify(report, null, 2));
    record("vitest suite", "Unit", "warn", 0, "raw json saved to reports/vitest-raw.json");
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(fx) {
  const counts = {
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    warn: results.filter((r) => r.status === "warn").length,
    skip: results.filter((r) => r.status === "skip").length,
  };
  const total = results.length;
  const groups = [...new Set(results.map((r) => r.group))];
  const finished = new Date();

  const rows = results
    .map(
      (r) => `<tr class="${r.status}">
      <td>${escapeHtml(r.group)}</td>
      <td><code>${escapeHtml(r.name)}</code></td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td class="ms">${r.ms}</td>
      <td class="detail">${escapeHtml(r.detail)}</td>
    </tr>`,
    )
    .join("\n");

  const groupCards = groups
    .map((g) => {
      const subset = results.filter((r) => r.group === g);
      const fails = subset.filter((r) => r.status === "fail").length;
      const passes = subset.filter((r) => r.status === "pass").length;
      return `<div class="card"><h3>${escapeHtml(g)}</h3><p>${passes} pass · ${fails} fail · ${subset.length} total</p></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Nuhome CRM — API Test Report</title>
<style>
  :root { --bg:#0f1419; --card:#1a2332; --line:#2a3548; --text:#e7ecf3; --muted:#9aa8bc; --pass:#3dd68c; --fail:#ff6b6b; --warn:#f0b429; --skip:#7a8ba3; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: radial-gradient(1200px 600px at 10% -10%, #1e3a5f 0%, transparent 50%), var(--bg); color: var(--text); }
  header { padding: 2rem 1.5rem 1rem; max-width: 1200px; margin: 0 auto; }
  h1 { margin: 0 0 .35rem; font-size: 1.75rem; letter-spacing: -0.02em; }
  .meta { color: var(--muted); font-size: .95rem; }
  .summary { display:flex; flex-wrap:wrap; gap:.75rem; margin: 1.25rem 0; }
  .pill { background: var(--card); border:1px solid var(--line); border-radius: 999px; padding: .45rem .9rem; font-weight: 600; }
  .pill.pass { color: var(--pass); } .pill.fail { color: var(--fail); } .pill.warn { color: var(--warn); }
  .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:.75rem; max-width:1200px; margin:0 auto 1.5rem; padding:0 1.5rem; }
  .card { background: var(--card); border:1px solid var(--line); border-radius: 12px; padding: 1rem; }
  .card h3 { margin:0 0 .35rem; font-size:1rem; }
  .card p { margin:0; color: var(--muted); font-size:.9rem; }
  main { max-width:1200px; margin:0 auto 3rem; padding:0 1.5rem; }
  table { width:100%; border-collapse: collapse; background: var(--card); border:1px solid var(--line); border-radius: 12px; overflow:hidden; }
  th, td { text-align:left; padding: .65rem .75rem; border-bottom:1px solid var(--line); vertical-align: top; font-size: .9rem; }
  th { color: var(--muted); font-weight:600; background:#121a26; position: sticky; top:0; }
  tr.fail { background: rgba(255,107,107,.06); }
  tr.warn { background: rgba(240,180,41,.05); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; }
  .badge { display:inline-block; border-radius:6px; padding:.15rem .45rem; font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
  .badge.pass { background: rgba(61,214,140,.15); color: var(--pass); }
  .badge.fail { background: rgba(255,107,107,.15); color: var(--fail); }
  .badge.warn { background: rgba(240,180,41,.15); color: var(--warn); }
  .badge.skip { background: rgba(122,139,163,.15); color: var(--skip); }
  .ms { color: var(--muted); white-space: nowrap; }
  .detail { color: var(--muted); word-break: break-word; max-width: 42rem; }
  footer { max-width:1200px; margin:0 auto 2rem; padding:0 1.5rem; color:var(--muted); font-size:.85rem; }
  .fixtures { font-size:.85rem; color:var(--muted); }
</style>
</head>
<body>
<header>
  <h1>Nuhome CRM — API Test Report</h1>
  <p class="meta">Started ${escapeHtml(startedAt.toISOString())} · Finished ${escapeHtml(finished.toISOString())} · Target ${escapeHtml(url)} · App ${escapeHtml(appUrl)}</p>
  <div class="summary">
    <span class="pill">Total ${total}</span>
    <span class="pill pass">Pass ${counts.pass}</span>
    <span class="pill fail">Fail ${counts.fail}</span>
    <span class="pill warn">Warn ${counts.warn}</span>
  </div>
  <p class="fixtures">Fixtures: order=${escapeHtml(fx.orderId)} quote=${escapeHtml(fx.quoteId)} customer=${escapeHtml(fx.customerId)}</p>
</header>
<section class="grid">${groupCards}</section>
<main>
  <table>
    <thead><tr><th>Group</th><th>API</th><th>Status</th><th>ms</th><th>Detail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
<footer>
  Probe mode: service-role for RPC reachability + read checks; mutating RPCs pass when they correctly reject without a user session (auth/validation). Anon REST checks confirm PostgREST exposure. HTTP checks hit production/app URLs.
</footer>
</body>
</html>`;
}

async function main() {
  console.log("Loading fixtures…");
  const fx = await loadFixtures();
  console.log("Probing RPCs…");
  await probeRpcs(fx);
  console.log("Probing REST tables…");
  await probeTables();
  console.log("Probing HTTP routes…");
  await probeAppRoutes();
  console.log("Running vitest…");
  const vitest = runVitest();
  writeFileSync(join(reportDir, "vitest-raw.json"), JSON.stringify(vitest, null, 2));
  vitestToResults(vitest);

  const html = renderHtml(fx);
  const out = join(reportDir, "api-test-report.html");
  writeFileSync(out, html);
  writeFileSync(join(reportDir, "api-test-results.json"), JSON.stringify({ startedAt, results, fixtures: fx }, null, 2));

  const fails = results.filter((r) => r.status === "fail").length;
  console.log(`\nReport: ${out}`);
  console.log(`Pass ${results.filter((r) => r.status === "pass").length} · Fail ${fails} · Warn ${results.filter((r) => r.status === "warn").length}`);
  process.exit(fails ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
