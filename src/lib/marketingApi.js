import { normalizeRule } from "./clientOrdersApi";
import {
  growthTrainingWorkspace,
  growthTrainingDetail,
} from "./growthTrainingData";
import { supabase } from "../supabaseClient";
import { authenticatedFunctionFetch } from "./netlifyFunctionClient";
import {
  shouldSimulateWrites,
  requireTestingConfirmation,
} from "./testingMode";
const tables = new Set([
  "accounts",
  "contacts",
  "opportunities",
  "materials",
  "activities",
  "tasks",
  "samples",
  "proposals",
  "order_links",
]);
export function growthWriteAllowed() {
  if (shouldSimulateWrites()) return false;
  if (
    requireTestingConfirmation() &&
    !window.confirm(
      "Testing mode permits live writes. Apply this marketing change?",
    )
  )
    throw Error("Change cancelled.");
  return true;
}
async function rows(table, filter) {
  const all = [];
  let page = 0;
  for (;;) {
    let q = supabase
      .from("sc_growth_" + table)
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (filter) q = q.eq(filter[0], filter[1]);
    const r = await q;
    if (r.error) throw r.error;
    all.push(...(r.data || []));
    if ((r.data || []).length < 500) break;
    page++;
  }
  return all;
}
export async function loadGrowthWorkspace() {
  if (shouldSimulateWrites()) return growthTrainingWorkspace();
  const [accounts, opportunities, materials, tasks, role, dashboard] =
    await Promise.all([
      rows("accounts"),
      rows("opportunities"),
      rows("materials"),
      rows("tasks"),
      supabase.rpc("sc_current_app_role"),
      supabase.rpc("sc_growth_dashboard_v1"),
    ]);
  if (role.error) throw role.error;
  if (!role.data) throw Error("Sign in with an active employee account.");
  if (dashboard.error) throw dashboard.error;
  return {
    accounts,
    opportunities,
    materials,
    tasks,
    role: role.data,
    dashboard: dashboard.data,
  };
}
export async function loadGrowthHistory(ids) {
  if (shouldSimulateWrites()) return [];
  const r = await supabase
    .from("sc_growth_audit")
    .select("id,table_name,action,old_row,new_row,created_at")
    .in("record_id", ids)
    .order("created_at", { ascending: false })
    .limit(100);
  if (r.error) throw r.error;
  return r.data || [];
}
export async function loadGrowthDetail(opportunity) {
  if (shouldSimulateWrites()) return growthTrainingDetail();
  const [contacts, activities, tasks, samples, proposals, order_links] =
    await Promise.all([
      rows("contacts", ["account_id", opportunity.account_id]),
      ...["activities", "tasks", "samples", "proposals", "order_links"].map(
        (t) => rows(t, ["opportunity_id", opportunity.id]),
      ),
    ]);
  const snapshot = await supabase.rpc("sc_growth_operational_snapshot_v1", {
    p_opportunity_id: opportunity.id,
  });
  if (snapshot.error) throw snapshot.error;

  return {
    contacts,
    activities,
    tasks,
    samples,
    proposals,
    order_links,
    jobs: snapshot.data?.jobs || [],
    snapshot: snapshot.data,
  };
}
export async function saveGrowthRecord(table, values, previous) {
  if (!tables.has(table)) throw Error("Unknown marketing record.");
  if (!growthWriteAllowed()) return { simulated: true };
  const payload = { ...values };
  for (const k of [
    "id",
    "created_at",
    "created_by",
    "updated_at",
    "calculation",
    "approved_at",
    "approved_by",
  ])
    delete payload[k];
  let q = supabase.from("sc_growth_" + table);
  q = previous?.id
    ? q
        .update(payload)
        .eq("id", previous.id)
        .eq("updated_at", previous.updated_at)
    : q.insert(payload);
  const r = await q.select("*").single();
  if (r.error)
    throw Error(
      r.error.code === "PGRST116"
        ? "This record changed in another session. Refresh before editing."
        : r.error.message,
    );
  return r.data;
}
export async function growthRpc(name, args) {
  if (!growthWriteAllowed()) return { simulated: true };
  const r = await supabase.rpc(name, args);
  if (r.error) throw r.error;
  return r.data;
}
export async function growthBlanks(search) {
  if (shouldSimulateWrites())
    return [
      {
        id: "00000000-0000-4000-8000-000000000509",
        blank_product_id: "00000000-0000-4000-8000-000000000509",
        sku_base: "TRAINING-TEE-BLACK-AM",
        name: "Training tee",
        unit_cost: 5,
      },
    ];
  const r = await supabase.rpc("sc_growth_catalog_search_v1", {
    p_search: search,
  });
  if (r.error) throw r.error;
  return r.data || [];
}
export async function growthCustomers(search) {
  if (shouldSimulateWrites())
    return [{ id: 0, name: "Training customer", code: "TRAINING" }];
  const r = await supabase
    .from("customers")
    .select("id,name,code")
    .ilike("name", "%" + search + "%")
    .order("name")
    .limit(30);
  if (r.error) throw r.error;
  return r.data || [];
}
export async function growthJobs(search) {
  if (shouldSimulateWrites()) return [];
  const id = Number(search);
  let q = supabase
    .from("jobs")
    .select("id,job_name,status,woocommerce_order_id,due_date")
    .order("id", { ascending: false })
    .limit(30);
  q =
    Number.isSafeInteger(id) && id > 0
      ? q.eq("woocommerce_order_id", id)
      : q.ilike("job_name", "%" + search + "%");
  const r = await q;
  if (r.error) throw r.error;
  return r.data || [];
}
async function assetAction(body) {
  const r = await authenticatedFunctionFetch(
    "/.netlify/functions/marketing-assets",
    { method: "POST", body: JSON.stringify(body) },
  );
  const b = await r.json();
  if (!r.ok) throw Error(b.message || "Material file request failed.");
  return b;
}
export async function uploadGrowthMaterial(id, file) {
  if (!growthWriteAllowed()) return { simulated: true };
  const u = await assetAction({
    action: "create_upload",
    id,
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    file_size: file.size,
  });
  const r = await fetch(u.upload_url, {
    method: "PUT",
    headers: { "Content-Type": u.content_type },
    body: file,
  });
  if (!r.ok) throw Error("File upload failed. Retry the upload.");
  return assetAction({ action: "complete_upload", id });
}
export const growthMaterialDownload = (id) =>
  assetAction({ action: "download", id });

export async function growthPricingRules() {
  if (shouldSimulateWrites())
    return [
      {
        id: "training",
        rule_name: "Training apparel rule",
        markup_multiplier: 2,
        decoration_cost: 3,
        setup_fee: 24,
        base_price: 0,
      },
    ];
  const r = await supabase.rpc("sc_growth_pricing_rules_v1");
  if (r.error) throw r.error;
  return (r.data || []).map(normalizeRule).filter((x) => x.active !== false);
}
export async function growthTeam(page = 1) {
  const r = await authenticatedFunctionFetch(
    "/.netlify/functions/marketing-team?page=" + page,
  );
  const b = await r.json();
  if (!r.ok) throw Error(b.message);
  return b;
}
export async function growthTeamAccess(user, action) {
  if (!growthWriteAllowed()) return { simulated: true };
  const r = await authenticatedFunctionFetch(
    "/.netlify/functions/marketing-team",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        action,
        expected_updated_at: user.role?.updated_at || null,
      }),
    },
  );
  const b = await r.json();
  if (!r.ok) throw Error(b.message);
  return b;
}
