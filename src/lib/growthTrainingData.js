import { calculateGrowthPricing } from "./growthPricing";
export const growthTrainingOpportunityId =
  "00000000-0000-4000-8000-000000000502";
const accountId = "00000000-0000-4000-8000-000000000501";
const stamp = "2026-10-16T12:00:00Z";
const base = { created_at: stamp, updated_at: stamp, archived_at: null };
const config = {
  model: "wholesale_keep_difference",
  share_percent: 15,
  target_margin_percent: 35,
};
const lines = [
  {
    description: "School spirit tee — training example",
    quantity: 48,
    unit_cost: 5,
    decoration_cost: 3,
    labor_cost: 2,
    other_cost: 0.5,
    setup_fee: 24,
    wholesale_price: 18,
    retail_price: 25,
  },
];
export function growthTrainingWorkspace() {
  return {
    role: "manager",
    accounts: [
      {
        ...base,
        id: accountId,
        organization: "Training Example School",
        segment: "school",
        city: "Practice workspace",
        owner_name: "Partner — training",
        source: "Training referral",
        pricing_defaults: config,
        notes: "Simulated client. No real customer or outreach.",
      },
    ],
    opportunities: [
      {
        ...base,
        id: growthTrainingOpportunityId,
        account_id: accountId,
        title: "Fall spirit store — practice",
        stage: "proposal",
        owner_name: "Partner — training",
        source: "Training referral",
        estimated_value: 1200,
        probability: 60,
        next_action: "Review demo and pricing with the school",
        next_action_date: "2026-10-16",
        target_date: "2026-11-01",
        brief:
          "Black and navy spirit tees. Exact school artwork, family ordering, individual pickup. This record exists only in the training browser view.",
        demo_status: "ready",
        demo_url: "https://example.org",
        store_url: null,
      },
    ],
    materials: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000504",
        title: "School introduction email — practice",
        kind: "email",
        segment: "school",
        status: "approved",
        revision: 1,
        cost: 0,
        body: "Hello {{contact}},\nWe would love to help {{organization}} with a spirit store. Here is our demo: {{store_url}}.\nSkilled Crafting",
      },
    ],
    tasks: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000505",
        opportunity_id: growthTrainingOpportunityId,
        title: "Confirm decision maker and next meeting",
        department: "marketing",
        owner_name: "Partner — training",
        status: "open",
        due_date: "2026-10-16",
      },
    ],
    dashboard: {
      activity_counts: { meeting: 1, email: 1 },
      sample_cost: 22,
      material_cost: 0,
      approved_partner_forecast: 336,
      approved_profit_forecast: 336,
    },
  };
}
export function growthTrainingDetail() {
  return {
    contacts: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000503",
        account_id: accountId,
        name: "Jordan Example",
        job_title: "School coordinator — training",
        email: "training@example.invalid",
        contact_permission: "permitted",
        is_primary: true,
      },
    ],
    activities: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000506",
        opportunity_id: growthTrainingOpportunityId,
        kind: "meeting",
        summary: "Training introduction and launch discussion",
        details:
          "Discuss school colors, desired products, ordering window and pickup needs.",
        occurred_at: stamp,
      },
    ],
    proposals: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000507",
        opportunity_id: growthTrainingOpportunityId,
        title: "Spirit store pricing — practice",
        version: 1,
        status: "draft",
        config,
        lines,
        calculation: calculateGrowthPricing(config, lines),
        terms: "Training terms only. Excludes tax and shipping.",
      },
    ],
    tasks: growthTrainingWorkspace().tasks,
    samples: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000508",
        opportunity_id: growthTrainingOpportunityId,
        description: "Spirit tee sample — practice",
        quantity: 2,
        unit_cost: 11,
        status: "preparing",
      },
    ],
    order_links: [],
    jobs: [],
  };
}
