import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  calculateGrowthPricing,
  suggestedGrowthRetail,
  parseGrowthCsv,
  growthCsv,
  safeGrowthUrl,
  escapeGrowthHtml,
} from "../../src/lib/growthPricing.js";
const lines = [
  {
    description: "Shirt",
    quantity: 10,
    unit_cost: 10,
    decoration_cost: 5,
    labor_cost: 2,
    other_cost: 1,
    setup_fee: 20,
    retail_price: 30,
    wholesale_price: 24,
  },
];
test("retail, wholesale, net-sales and profit sharing use explicit bases and retained-sales margins", () => {
  const cases = [
    ["retail", 0, 0, 100, 33.33],
    ["wholesale_keep_difference", 0, 60, 40, 16.67],
    ["revenue_share", 20, 60, 40, 16.67],
    ["profit_share", 25, 25, 75, 27.27],
  ];
  for (const [model, share, benefit, profit, margin] of cases) {
    const r = calculateGrowthPricing(
      { model, share_percent: share, target_margin_percent: 10 },
      lines,
    );
    assert.equal(r.cost, 200);
    assert.equal(r.revenue, 300);
    assert.equal(r.partner_share, benefit);
    assert.equal(r.business_profit, profit);
    assert.equal(r.business_margin_percent, margin);
  }
});
test("client settings remain independent and target-margin pricing accounts for sharing", () => {
  const retail = suggestedGrowthRetail(10, {
    model: "retail",
    target_margin_percent: 40,
  });
  const sales = suggestedGrowthRetail(10, {
    model: "revenue_share",
    share_percent: 20,
    target_margin_percent: 40,
  });
  const profit = suggestedGrowthRetail(10, {
    model: "profit_share",
    share_percent: 20,
    target_margin_percent: 40,
  });
  assert.equal(retail, 16.67);
  assert.equal(sales, 20.84);
  assert.equal(profit, 18.34);
  for (const [model, price] of [
    ["retail", retail],
    ["revenue_share", sales],
    ["profit_share", profit],
  ]) {
    const r = calculateGrowthPricing(
      { model, share_percent: 20, target_margin_percent: 40 },
      [
        {
          description: "Test",
          quantity: 1,
          unit_cost: 10,
          retail_price: price,
        },
      ],
    );
    assert(r.business_margin_percent >= 40);
  }
  assert.equal(
    suggestedGrowthRetail(10, {
      model: "revenue_share",
      share_percent: 100,
      target_margin_percent: 40,
    }),
    null,
  );
});
test("profit sharing never creates a negative client payout on a loss", () => {
  const r = calculateGrowthPricing(
    { model: "profit_share", share_percent: 50, target_margin_percent: 20 },
    [
      {
        description: "Loss case",
        quantity: 1,
        unit_cost: 40,
        retail_price: 30,
      },
    ],
  );
  assert.equal(r.partner_share, 0);
  assert.equal(r.business_profit, -10);
  assert.equal(r.below_target, true);
});
test("invalid percentages, non-whole quantities and reversed wholesale pricing are rejected", () => {
  for (const config of [
    { share_percent: 101 },
    { share_percent: -1 },
    { target_margin_percent: 100 },
    { share_percent: NaN },
  ])
    assert.throws(() => calculateGrowthPricing(config, lines));
  assert.throws(() =>
    calculateGrowthPricing({}, [{ ...lines[0], quantity: 1.5 }]),
  );
  assert.throws(() =>
    calculateGrowthPricing({ model: "wholesale_keep_difference" }, [
      { ...lines[0], wholesale_price: 31 },
    ]),
  );
  assert.throws(() =>
    calculateGrowthPricing({}, [{ ...lines[0], unit_cost: Infinity }]),
  );
});
test("CSV prospect imports preserve quoted commas, newlines, quotes and the BOM", () => {
  const input =
    '\uFEFForganization,segment,city,notes\r\n"School, East",school,Portland,"Line one\nLine ""two"""';
  const r = parseGrowthCsv(input);
  assert.equal(r[0].organization, "School, East");
  assert.equal(r[0].notes, 'Line one\nLine "two"');
  assert.throws(() => parseGrowthCsv("name\nSchool"));
  assert.throws(() =>
    parseGrowthCsv("organization,website\nSchool,javascript:alert(1)"),
  );
  assert.throws(() => parseGrowthCsv("organization,organization\nA,B"));
  assert.throws(() => parseGrowthCsv('organization\n"Unclosed'));
});
test("exports neutralize spreadsheet formulas and client text is escaped", () => {
  const csv = growthCsv([["=SUM(1,2)", "+command", "@formula", "normal"]]);
  assert.match(csv, /'=SUM/);
  assert.match(csv, /'\+command/);
  assert.match(csv, /'@formula/);
  assert.equal(escapeGrowthHtml('<script> & "'), "&lt;script&gt; &amp; &quot;");
  assert.equal(safeGrowthUrl("javascript:alert(1)"), null);
  assert.equal(safeGrowthUrl("https://example.org"), "https://example.org/");
});

process.env.SUPABASE_URL = "https://marketing-fixture.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-marketing-service-key";
test("server clients initialize without a native WebSocket implementation", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    delete globalThis.WebSocket;
    const { createServiceClient } = await import('./netlify/functions/_shared/security.js');
    createServiceClient();
    await import('./netlify/functions/woocommerce-webhook.js');
    await import('./netlify/functions/manual-pullsheet.js');
    await import('./netlify/functions/update-woocommerce-order-status.js');
  `], { cwd: new URL('../../', import.meta.url), env: process.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
const { handler: assetsHandler } = await import(
  "../../netlify/functions/marketing-assets.js"
);
const { handler: integrityHandler } = await import(
  "../../netlify/functions/application-integrity.js"
);
async function authenticatedFixture(
  role,
  body,
  handler = assetsHandler,
  material = { id: "00000000-0000-4000-8000-000000000001", status: "draft" },
) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const u = new URL(String(input));
    calls.push({ path: u.pathname, method: options.method || "GET" });
    let data = u.pathname.endsWith("/user")
      ? { id: "00000000-0000-4000-8000-000000000010" }
      : u.pathname.endsWith("/sc_app_user_roles")
        ? { role, is_active: true }
        : u.pathname.endsWith("/sc_growth_materials")
          ? material
          : [];
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    return {
      response: await handler({
        httpMethod: "POST",
        body: JSON.stringify(body),
        headers: { authorization: "Bearer fixture-session" },
      }),
      calls,
    };
  } finally {
    globalThis.fetch = original;
  }
}
test("the restricted Marketing role can sign in but cannot use operational server mutations", async () => {
  const yes = await authenticatedFixture(
    "marketing",
    { action: "health" },
    integrityHandler,
  );
  assert.equal(yes.response.statusCode, 200);
  const no = await authenticatedFixture(
    "marketing",
    { action: "product.preview", payload: {} },
    integrityHandler,
  );
  assert.equal(no.response.statusCode, 403);
  const viewer = await authenticatedFixture(
    "viewer",
    { action: "health" },
    integrityHandler,
  );
  assert.equal(viewer.response.statusCode, 200);
});
test("material uploads enforce role, type and approved-version boundaries before storage work", async () => {
  const viewer = await authenticatedFixture("viewer", {
    action: "create_upload",
    id: "fixture",
    content_type: "image/png",
    file_size: 10,
  });
  assert.equal(viewer.response.statusCode, 403);
  assert(!viewer.calls.some((c) => c.path.endsWith("/sc_growth_materials")));
  const html = await authenticatedFixture("marketing", {
    action: "create_upload",
    id: "fixture",
    content_type: "text/html",
    file_size: 20,
  });
  assert.equal(html.response.statusCode, 400);
  assert.match(html.response.body, /PDF/);
  assert(!html.calls.some((c) => c.method === "PATCH"));
  const approved = await authenticatedFixture(
    "operator",
    {
      action: "create_upload",
      id: "fixture",
      content_type: "image/png",
      file_size: 10,
    },
    assetsHandler,
    { id: "fixture", status: "approved" },
  );
  assert.equal(approved.response.statusCode, 400);
  assert.match(approved.response.body, /new revision/);
});
test("private material downloads reject unverified or foreign object references", async () => {
  const r = await authenticatedFixture(
    "viewer",
    { action: "download", id: "fixture" },
    assetsHandler,
    {
      id: "fixture",
      status: "approved",
      upload_complete: true,
      storage_path: "another-project/private-file.pdf",
    },
  );
  assert.equal(r.response.statusCode, 400);
  assert.match(r.response.body, /No verified file/);
});
const {handler:teamHandler}=await import('../../netlify/functions/marketing-team.js');
test('partner access administration requires an administrator and prevents self changes',async()=>{
 const blocked=await authenticatedFixture('marketing',{action:'assign_marketing',user_id:'someone'},teamHandler);assert.equal(blocked.response.statusCode,403);
 const self=await authenticatedFixture('admin',{action:'assign_marketing',user_id:'00000000-0000-4000-8000-000000000010'},teamHandler);assert.equal(self.response.statusCode,400);assert.match(self.response.body,/own access/);assert(!self.calls.some(c=>c.method==='PATCH'));
});

test('negative margins round consistently with decimal server calculations',()=>{
 const r=calculateGrowthPricing({model:'retail',target_margin_percent:0},[{description:'Loss rounding',quantity:1,unit_cost:202.01,retail_price:200}]);assert.equal(r.business_margin_percent,-1.01);assert(growthCsv([['  =1+1']]).includes("'  =1"));
});
