import MarketingProspectDiscovery from "./MarketingProspectDiscovery";
import { useCallback, useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  loadGrowthWorkspace,
  loadGrowthDetail,
  saveGrowthRecord,
  growthRpc,
  growthBlanks,
  growthCustomers,
  growthJobs,
  uploadGrowthMaterial,
  growthMaterialDownload,
  loadGrowthHistory,
  growthPricingRules,
  growthTeam,
  growthTeamAccess,
} from "./lib/marketingApi";
import {
  growthStages,
  growthModels,
  defaultGrowthPricing,
  calculateGrowthPricing,
  suggestedGrowthRetail,
  applyGrowthPricingRule,
  escapeGrowthHtml,
  growthCsv,
  safeGrowthUrl,
  parseGrowthCsv,
} from "./lib/growthPricing";
import "./MarketingWorkspace.css";
import MarketingDocumentStudio from "./MarketingDocumentStudio";

const label = (v) => String(v || "").replaceAll("_", " ");
const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0),
  );
const today = () => new Date().toLocaleDateString("en-CA");
const segments = ["school", "nonprofit", "team", "club", "business", "other"];
const emptyDetail = {
  contacts: [],
  activities: [],
  tasks: [],
  samples: [],
  proposals: [],
  order_links: [],
  jobs: [],
};
const isOpen = (o) => !o.archived_at && !["lost", "live"].includes(o.stage);
function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function External({ url, children }) {
  const safe = safeGrowthUrl(url);
  return safe ? (
    <a href={safe} target="_blank" rel="noreferrer">
      {children || url}
    </a>
  ) : null;
}
function Field({
  name,
  title,
  type = "text",
  value,
  onChange,
  options,
  required = false,
  min,
  max,
  step,
}) {
  return (
    <label className="growth-field">
      <span>{title || label(name)}</span>
      {options ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          required={required}
        >
          {options.map((o) => (
            <option
              key={Array.isArray(o) ? o[0] : o}
              value={Array.isArray(o) ? o[0] : o}
            >
              {Array.isArray(o) ? o[1] : label(o)}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          rows="4"
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          required={required}
        />
      ) : type === "checkbox" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(name, e.target.checked)}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          required={required}
          min={min}
          max={max}
          step={step}
        />
      )}
    </label>
  );
}
function Editor({
  title,
  table,
  initial,
  fields,
  onSave,
  onClose,
  busy,
  children,
}) {
  const [form, setForm] = useState(initial);
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  return (
    <section className="sc-panel growth-editor">
      <h2>{title}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(table, form, initial.id ? initial : null);
        }}
      >
        <div className="growth-grid">
          {fields.map((f) => (
            <Field key={f.name} {...f} value={form[f.name]} onChange={change} />
          ))}
        </div>
        {children?.(form, change)}
        <div className="growth-actions">
          <button
            disabled={busy}
            className="sc-btn sc-btn-primary"
            type="submit"
          >
            Save
          </button>
          <button type="button" className="sc-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
const field = (name, title, type, options, required = false) => ({
  name,
  title,
  type,
  options,
  required,
});
const accountFields = [
  field("organization", "Organization", "text", null, true),
  field("segment", "Client type", "select", segments),
  field("city", "City / territory"),
  field("website", "Website", "url"),
  field("source", "Lead source / referral"),
  field("owner_name", "Relationship owner"),
  field("notes", "Relationship notes", "textarea"),
];
const opportunityFields = [
  field("title", "Opportunity / campaign", "text", null, true),
  field("stage", "Stage", "select", growthStages),
  field("owner_name", "Opportunity owner"),
  field("source", "Campaign source"),
  {
    name: "estimated_value",
    title: "Estimated retail sales",
    type: "number",
    min: 0,
    step: 0.01,
  },
  {
    name: "probability",
    title: "Win probability %",
    type: "number",
    min: 0,
    max: 100,
  },
  field("target_date", "Target launch / close", "date"),
  field("next_action", "Next action"),
  field("next_action_date", "Next action date", "date"),
  field(
    "brief",
    "Design, products, audience, colors, personalization and delivery brief",
    "textarea",
  ),
  field("demo_url", "Demo storefront URL", "url"),
  field("demo_status", "Demo status", "select", [
    "planned",
    "ready",
    "presented",
    "feedback",
    "approved",
  ]),
  field("store_url", "Live storefront URL", "url"),
  field("loss_reason", "Lost / closed reason", "textarea"),
];
const contactFields = [
  field("name", "Contact name", "text", null, true),
  field("job_title", "Role / decision maker"),
  field("email", "Email", "email"),
  field("phone", "Phone"),
  field("contact_permission", "Outreach preference", "select", [
    "unknown",
    "permitted",
    "do_not_contact",
  ]),
  field("is_primary", "Primary contact", "checkbox"),
  field("notes", "Contact notes", "textarea"),
];
function TermsFields({ config, onChange }) {
  return (
    <div className="growth-grid">
      <Field
        name="model"
        title="Commercial model"
        value={config.model}
        onChange={(k, v) => onChange({ ...config, [k]: v })}
        options={Object.entries(growthModels)}
      />
      {config.model?.includes("share") && (
        <Field
          name="share_percent"
          title="Client share %"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={config.share_percent}
          onChange={(k, v) => onChange({ ...config, [k]: v })}
        />
      )}
      <Field
        name="target_margin_percent"
        title="Target company margin %"
        type="number"
        min="0"
        max="99.99"
        step="0.01"
        value={config.target_margin_percent}
        onChange={(k, v) => onChange({ ...config, [k]: v })}
      />
    </div>
  );
}
const blankLine = () => ({
  description: "",
  blank_product_id: null,
  quantity: 24,
  unit_cost: 0,
  decoration_cost: 0,
  labor_cost: 0,
  other_cost: 0,
  setup_fee: 0,
  wholesale_price: 0,
  retail_price: 0,
});
function PricingEditor({
  opportunity,
  account,
  proposal,
  initial,
  versions,
  onSave,
  onClose,
  busy,
  run,
}) {
  const [form, setForm] = useState(
    proposal ||
      initial || {
        title: opportunity.title + " pricing",
        version: Math.max(0, ...versions.map((x) => x.version)) + 1,
        config: { ...defaultGrowthPricing, ...account.pricing_defaults },
        lines: [blankLine()],
        valid_until: "",
        terms:
          "Prices exclude sales tax and shipping. Availability, personalization and launch dates require confirmation.",
      },
  );
  const [query, setQuery] = useState(""),
    [blanks, setBlanks] = useState([]),
    [rules, setRules] = useState([]),
    [ruleId, setRuleId] = useState("");
  useEffect(() => {
    growthPricingRules()
      .then((available) => {
        setRules(available);
        if (!proposal && !initial && available.length) setRuleId(String(available[0].id));
      })
      .catch(() => {});
  }, [proposal, initial]);
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const changeLine = (i, k, v) =>
    setForm((s) => ({
      ...s,
      lines: s.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)),
    }));
  let preview, error;
  try {
    preview = calculateGrowthPricing(form.config, form.lines);
  } catch (e) {
    error = e.message;
  }
  function applyRule() {
    const r = rules.find((x) => String(x.id) === ruleId);
    if (!r) return;
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => applyGrowthPricingRule(line, r)),
    }));
  }
  return (
    <section className="sc-panel growth-editor">
      <h2>{proposal ? "Edit draft" : "New proposal version"}</h2>
      <p>
        Defaults belong to this client. Overrides apply to this version. Manager
        approval is required before operations handoff.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            "proposals",
            { ...form, opportunity_id: opportunity.id, status: "draft" },
            proposal,
          );
        }}
      >
        <div className="growth-grid">
          <Field
            name="title"
            title="Proposal title"
            value={form.title}
            onChange={change}
            required
          />
          <Field
            name="valid_until"
            title="Valid until"
            type="date"
            value={form.valid_until}
            onChange={change}
          />
        </div>
        <TermsFields
          config={form.config}
          onChange={(v) => change("config", v)}
        />
        <p className="growth-help">
          Net-sales share uses item sales before tax/shipping. Profit share uses
          positive sales less blank, decoration, labor, other and setup costs.
          Wholesale lets the client retain retail less wholesale. Company margin
          is profit after the client share divided by sales retained after the
          client share.
        </p>
        <div className="growth-actions">
          <select
            aria-label="Saved pricing rule"
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
          >
            <option value="">Select existing pricing rule</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.rule_name}
              </option>
            ))}
          </select>
          <button type="button" className="sc-btn" onClick={applyRule}>
            Apply rule to lines
          </button>
        </div>
        <div className="growth-actions">
          <input
            aria-label="Find physical blank SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an existing physical blank by SKU"
          />
          <button
            type="button"
            className="sc-btn"
            onClick={() =>
              run(async () => setBlanks(await growthBlanks(query)))
            }
          >
            Find blanks
          </button>
        </div>
        {blanks.length > 0 && (
          <div className="growth-search-results">
            {blanks.map((b) => (
              <button
                key={b.blank_product_id || b.id}
                type="button"
                onClick={() => {
                  change("lines", [
                    ...form.lines,
                    {
                      ...blankLine(),
                      description:
                        b.sku_base ||
                        b.blank_sku_base ||
                        b.product_name ||
                        b.name,
                      blank_product_id: b.blank_product_id || b.id,
                      unit_cost: Number(b.unit_cost || 0),
                    },
                  ]);
                  setBlanks([]);
                }}
              >
                {b.sku_base || b.blank_sku_base || b.product_name || b.name}
              </button>
            ))}
          </div>
        )}
        <div className="growth-table-wrap">
          <table className="sc-table growth-pricing-table">
            <thead>
              <tr>
                <th>Product line</th>
                <th>Qty</th>
                <th>Blank / unit</th>
                <th>Decoration / unit</th>
                <th>Labor / unit</th>
                <th>Other / unit</th>
                <th>Setup / line</th>
                <th>Wholesale / unit</th>
                <th>Retail / unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <input
                      aria-label={"Description " + (i + 1)}
                      value={l.description}
                      onChange={(e) =>
                        changeLine(i, "description", e.target.value)
                      }
                      required
                    />
                    {l.blank_product_id && <small>Linked physical blank</small>}
                  </td>
                  {[
                    "quantity",
                    "unit_cost",
                    "decoration_cost",
                    "labor_cost",
                    "other_cost",
                    "setup_fee",
                    "wholesale_price",
                    "retail_price",
                  ].map((k) => (
                    <td key={k}>
                      <input
                        aria-label={label(k) + " " + (i + 1)}
                        type="number"
                        min={k === "quantity" ? 1 : 0}
                        step={k === "quantity" ? 1 : 0.01}
                        value={l[k] ?? 0}
                        onChange={(e) => changeLine(i, k, e.target.value)}
                        required
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="sc-btn"
                      onClick={() => {
                        const c =
                          Number(l.unit_cost) +
                          Number(l.decoration_cost) +
                          Number(l.labor_cost) +
                          Number(l.other_cost) +
                          Number(l.setup_fee) / Number(l.quantity || 1);
                        const price = suggestedGrowthRetail(c, form.config);
                        if (price === null) return;
                        if (form.config.model === "wholesale_keep_difference") {
                          changeLine(i, "wholesale_price", price);
                          changeLine(
                            i,
                            "retail_price",
                            Math.max(price, Number(l.retail_price || 0)),
                          );
                        } else changeLine(i, "retail_price", price);
                      }}
                    >
                      {form.config.model === "wholesale_keep_difference"
                        ? "Suggest supply"
                        : "Suggest retail"}
                    </button>
                    <button
                      type="button"
                      className="sc-btn"
                      onClick={() =>
                        change(
                          "lines",
                          form.lines.filter((_, j) => j !== i),
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="sc-btn"
          onClick={() => change("lines", [...form.lines, blankLine()])}
          disabled={form.lines.length >= 100}
        >
          Add product line
        </button>
        {preview ? (
          <PricingSummary calculation={preview} />
        ) : (
          <p role="status">{error}</p>
        )}
        <Field
          name="terms"
          title="Client-specific terms, fee treatment and settlement schedule"
          type="textarea"
          value={form.terms}
          onChange={change}
        />
        <div className="growth-actions">
          <button className="sc-btn sc-btn-primary" disabled={busy || !preview}>
            Save draft version {form.version}
          </button>
          <button type="button" className="sc-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
function PricingSummary({ calculation: c }) {
  return (
    <>
      <div className="growth-metrics">
        {[
          ["Retail sales", money(c.revenue)],
          ["Production / other cost", money(c.cost)],
          ["Client benefit", money(c.partner_share)],
          ["Company profit", money(c.business_profit)],
          [
            "Company margin",
            Number(c.business_margin_percent || 0).toFixed(2) + "%",
          ],
        ].map(([k, v]) => (
          <article key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </article>
        ))}
      </div>
      {c.below_target && (
        <p className="growth-warning">
          Below the target margin. Review prices and costs; approval requires a
          manager explanation.
        </p>
      )}
    </>
  );
}
function pricingGuide(p, account, opportunity) {
  const e = escapeGrowthHtml;
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    e(p.title) +
    "</title><style>body{font:16px system-ui;max-width:960px;margin:45px auto;color:#172033;padding:24px}table{border-collapse:collapse;width:100%}th,td{padding:12px;border-bottom:1px solid #ccd4df;text-align:left}small{color:#475569}pre{white-space:pre-wrap;font:inherit}</style></head><body><p>SKILLED CRAFTING</p><h1>" +
    e(p.title) +
    "</h1><h2>" +
    e(account.organization) +
    "</h2><p>" +
    e(opportunity.title) +
    " · Version " +
    p.version +
    " · " +
    e(p.status) +
    " · Valid until " +
    e(p.valid_until || "review before use") +
    "</p><p>" +
    e(growthModels[p.config.model]) +
    (p.config.model.includes("share")
      ? " · Client share " + e(p.config.share_percent) + "%"
      : "") +
    "</p><table><thead><tr><th>Product line</th><th>Quantity</th><th>Retail each</th>" +
    (p.config.model === "wholesale_keep_difference"
      ? "<th>Supply each</th>"
      : "") +
    "<th>Client benefit</th></tr></thead><tbody>" +
    p.calculation.lines
      .map(
        (l) =>
          "<tr><td>" +
          e(l.description) +
          "</td><td>" +
          l.quantity +
          "</td><td>" +
          money(l.retail_price) +
          "</td>" +
          (p.config.model === "wholesale_keep_difference"
            ? "<td>" + money(l.wholesale_price) + "</td>"
            : "") +
          "<td>" +
          money(l.partner_share) +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table><pre>" +
    e(p.terms) +
    "</pre><p><small>Planning quantities and estimated benefits; actual settlement depends on the agreed treatment of sales, returns, costs, fees and discounts. No internal cost or margin fields are included.</small></p></body></html>"
  );
}
export default function MarketingWorkspace() {
  const [params, setParams] = useSearchParams();
  const [team, setTeam] = useState(null);
  const [importText, setImportText] = useState(""),
    [history, setHistory] = useState([]);
  const [data, setData] = useState(null),
    [detail, setDetail] = useState(emptyDetail),
    [selected, setSelected] = useState(params.get("opportunity") || "");
  const [view, setView] = useState("pipeline"),
    [detailTab, setDetailTab] = useState("overview"),
    [editor, setEditor] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    [stage, setStage] = useState("all"),
    [segment, setSegment] = useState("all"),
    [owner, setOwner] = useState("all"),
    [archived, setArchived] = useState(false),
    [approvalNote, setApprovalNote] = useState(""),
    [customerSearch, setCustomerSearch] = useState(""),
    [customers, setCustomers] = useState([]),
    [jobSearch, setJobSearch] = useState(""),
    [jobs, setJobs] = useState([]),
    [materialKind, setMaterialKind] = useState("all"),
    [templateContact, setTemplateContact] = useState("");
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const busyRef = useRef(false);
  const opportunity = data?.opportunities.find((o) => o.id === selected),
    account = data?.accounts.find((a) => a.id === opportunity?.account_id);
  const manager = ["admin", "manager"].includes(data?.role),
    canWrite = ["admin", "manager", "operator", "marketing"].includes(
      data?.role,
    );
  const load = useCallback(async () => {
    const d = await loadGrowthWorkspace();
    setData(d);
    return d;
  }, []);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [load]);
  useEffect(() => {
    let active = true;
    setDetail(emptyDetail);
    if (opportunity)
      loadGrowthDetail(opportunity)
        .then((d) => {
          if (active) setDetail(d);
        })
        .catch((e) => active && setMessage(e.message));
    return () => {
      active = false;
    };
  }, [selected, opportunity?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const changed = () => {
      setSelected("");
      load().catch((e) => setMessage(e.message));
    };
    window.addEventListener("sc-testing-mode-change", changed);
    return () => window.removeEventListener("sc-testing-mode-change", changed);
  }, [load]);
  async function refresh() {
    const d = await load();
    const o = d.opportunities.find((x) => x.id === selected);
    if (o) {
      const next = await loadGrowthDetail(o);
      if (selectedRef.current === o.id) setDetail(next);
    }
  }
  async function run(fn) {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const r = await fn();
      if (r?.simulated) {
        setMessage(
          "Training preview: no marketing records, files or handoffs were changed.",
        );
        return r;
      }
      return r;
    } catch (e) {
      setMessage(e.message || "The action could not be completed.");
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function save(table, form, previous) {
    await run(async () => {
      const payload = { ...form };
      if (payload.occurred_at)
        payload.occurred_at = new Date(payload.occurred_at).toISOString();
      for (const k of Object.keys(payload))
        if (
          payload[k] === "" &&
          !["city", "organization", "title", "name"].includes(k)
        )
          payload[k] = null;
      const r = await saveGrowthRecord(table, payload, previous);
      if (r.simulated) return r;
      setEditor(null);
      await refresh();
      setMessage("Saved.");
      if (table === "opportunities") select(r.id);
      return r;
    });
  }
  function select(id) {
    setSelected(id);
    setParams(id ? { opportunity: id } : {});
    setView("pipeline");
    setDetailTab("overview");
    setEditor(null);
  }
  function edit(table, initial, fields, title) {
    setEditor({ table, initial, fields, title });
  }
  const accounts = data?.accounts || [],
    opportunities = data?.opportunities || [],
    materials = data?.materials || [];
  const filtered = opportunities.filter((o) => {
    const a = accounts.find((x) => x.id === o.account_id);
    return (
      (archived || (!o.archived_at && !a?.archived_at)) &&
      (stage === "all" || o.stage === stage) &&
      (segment === "all" || a?.segment === segment) &&
      (owner === "all" || o.owner_name === owner) &&
      [o.title, a?.organization, o.owner_name, o.source, o.brief]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  const active = opportunities.filter(
      (o) =>
        isOpen(o) && !accounts.find((a) => a.id === o.account_id)?.archived_at,
    ),
    activeIds = new Set(active.map((o) => o.id));
  const dueTasks = (data?.tasks || []).filter(
    (t) =>
      activeIds.has(t.opportunity_id) &&
      !["complete", "cancelled"].includes(t.status) &&
      t.due_date &&
      t.due_date <= today(),
  );
  const followUps = active.filter(
    (o) => o.next_action_date && o.next_action_date <= today(),
  );
  const approved = detail.proposals.find((p) => p.status === "approved");
  let importRows = [],
    importError = "";
  try {
    if (importText.trim()) importRows = parseGrowthCsv(importText);
  } catch (e) {
    importError = e.message;
  }
  const pipelineValue = active.reduce(
      (s, o) => s + Number(o.estimated_value),
      0,
    ),
    weighted = active.reduce(
      (s, o) => s + (Number(o.estimated_value) * o.probability) / 100,
      0,
    );
  function newOpportunity() {
    if (!accounts.some((a) => !a.archived_at)) {
      setMessage("Add a client organization first.");
      return;
    }
    edit(
      "opportunities",
      {
        account_id: accounts.find((a) => !a.archived_at).id,
        title: "",
        stage: "identified",
        probability: 10,
        estimated_value: 0,
        demo_status: "planned",
      },
      [
        field(
          "account_id",
          "Client organization",
          "select",
          accounts
            .filter((a) => !a.archived_at)
            .map((a) => [a.id, a.organization]),
        ),
        ...opportunityFields,
      ],
      "New opportunity",
    );
  }
  function cloneProposal(p) {
    setEditor({
      table: "pricing",
      initial: {
        ...p,
        id: undefined,
        status: "draft",
        version: Math.max(...detail.proposals.map((x) => x.version)) + 1,
        approved_by: undefined,
        approved_at: undefined,
      },
      cloning: true,
    });
  }
  async function handoff(mode) {
    await run(async () => {
      const r = await growthRpc("sc_growth_handoff_v1", {
        p_opportunity_id: opportunity.id,
        p_mode: mode,
        p_proposal_id: mode === "operations" ? approved?.id : null,
        p_expected_updated_at: opportunity.updated_at,
      });
      if (r.simulated) return r;
      await refresh();
      setMessage(
        "Linked drafts and handoff tasks are ready. Repeating this action reuses the same records.",
      );
      return r;
    });
  }
  function csvExport() {
    download(
      "client-opportunity-pipeline.csv",
      growthCsv([
        [
          "Organization",
          "Segment",
          "Campaign",
          "Stage",
          "Owner",
          "Value",
          "Probability",
          "Next action",
          "Due",
        ],
        ...filtered.map((o) => {
          const a = accounts.find((x) => x.id === o.account_id);
          return [
            a?.organization,
            a?.segment,
            o.title,
            o.stage,
            o.owner_name,
            o.estimated_value,
            o.probability,
            o.next_action,
            o.next_action_date,
          ];
        }),
      ]),
      "text/csv;charset=utf-8",
    );
  }
  const proposedRows = detail.proposals
    .slice()
    .sort((a, b) => b.version - a.version);
  const materialRows = materials.filter(
    (m) =>
      (archived || !m.archived_at) &&
      (materialKind === "all" || m.kind === materialKind) &&
      (!search ||
        [m.title, m.segment, m.body]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const visibleContacts = detail.contacts.filter(
    (c) => archived || !c.archived_at,
  );
  const chosenContact = visibleContacts.find((c) => c.id === templateContact);
  const editorNode =
    editor?.table === "pricing" ? (
      <PricingEditor
        key={editor.initial?.id || "new-" + editor.initial?.version}
        opportunity={opportunity}
        account={account}
        initial={editor.cloning ? editor.initial : null}
        proposal={
          editor.cloning ? null : editor.initial?.id ? editor.initial : null
        }
        versions={detail.proposals}
        onSave={(t, f, p) =>
          save(
            t,
            editor.cloning ? { ...editor.initial, ...f, id: undefined } : f,
            p,
          )
        }
        onClose={() => setEditor(null)}
        busy={busy}
        run={run}
      />
    ) : editor ? (
      <Editor
        key={editor.table + (editor.initial.id || "new")}
        {...editor}
        onSave={save}
        onClose={() => setEditor(null)}
        busy={busy}
      >
        {editor.table === "accounts"
          ? (form, change) => (
              <>
                <h3>Client pricing defaults</h3>
                <TermsFields
                  config={{ ...defaultGrowthPricing, ...form.pricing_defaults }}
                  onChange={(v) => change("pricing_defaults", v)}
                />
                <p>
                  Each campaign can override these defaults. Existing approved
                  proposals retain their original terms.
                </p>
              </>
            )
          : null}
      </Editor>
    ) : null;
  return (
    <main className="page sc-page-stack growth-workspace" aria-busy={busy}>
      <section className="sc-page-header-card">
        <div>
          <p className="sc-kicker">Relationships → launch → repeat business</p>
          <h1>Marketing & Client Growth</h1>
          <p>
            One client record, clear owners, approved terms and connected work
            from first introduction through delivery.
          </p>
        </div>
        <div className="growth-actions">
          <button
            className="sc-btn"
            disabled={busy}
            onClick={() => run(refresh)}
          >
            Refresh
          </button>
          {canWrite && (
            <>
              <button
                className="sc-btn"
                onClick={() =>
                  edit(
                    "accounts",
                    {
                      organization: "",
                      segment: "business",
                      city: "",
                      pricing_defaults: { ...defaultGrowthPricing },
                    },
                    accountFields,
                    "New client organization",
                  )
                }
              >
                Add client
              </button>
              <button
                className="sc-btn sc-btn-primary"
                onClick={newOpportunity}
              >
                Add opportunity
              </button>
            </>
          )}
        </div>
      </section>
      {message && (
        <p role="status" className="sc-alert">
          {message}
        </p>
      )}
      <div className="growth-metrics">
        {[
          ["Open pipeline", money(pipelineValue)],
          ["Weighted forecast", money(weighted)],
          ["Follow-ups due", followUps.length],
          ["Tasks due", dueTasks.length],
        ].map(([k, v]) => (
          <article key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </article>
        ))}
      </div>
      <nav className="growth-actions" aria-label="Marketing sections">
        {["pipeline", "clients", "materials", "document_studio", "ai_prospects", "follow_ups", "reports"].map(
          (v) => (
            <button
              key={v}
              className={"sc-btn " + (view === v ? "sc-btn-primary" : "")}
              onClick={() => {
                setView(v);
                setEditor(null);
              }}
            >
              {label(v)}
            </button>
          ),
        )}
      </nav>
      {editorNode}
      <section className="sc-panel">
        <div className="growth-filters">
          <input
            aria-label="Search marketing"
            placeholder="Search organizations, campaigns, owners…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Pipeline stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All stages</option>
            {growthStages.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Client segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            <option value="all">All client types</option>
            {segments.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Opportunity owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="all">All owners</option>
            {[
              ...new Set(
                opportunities.map((x) => x.owner_name).filter(Boolean),
              ),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />{" "}
            Include archived
          </label>
        </div>
      </section>
      {view === "document_studio" && <MarketingDocumentStudio organizations={accounts} manager={manager} />}
      {view === "ai_prospects" && <MarketingProspectDiscovery />}
      {view === "pipeline" && (
        <>
          <section className="sc-panel">
            <div className="growth-actions">
              <h2>Client pipeline</h2>
              <button className="sc-btn" onClick={csvExport}>
                Export current view
              </button>
            </div>
            <div className="growth-stage-counts">
              {growthStages.map((s) => (
                <button className="sc-btn" key={s} onClick={() => setStage(s)}>
                  {label(s)}{" "}
                  <strong>
                    {
                      opportunities.filter(
                        (o) => !o.archived_at && o.stage === s,
                      ).length
                    }
                  </strong>
                </button>
              ))}
            </div>
            <div className="growth-table-wrap">
              <table className="sc-table">
                <thead>
                  <tr>
                    <th>Client / campaign</th>
                    <th>Stage</th>
                    <th>Owner</th>
                    <th>Retail opportunity</th>
                    <th>Next action</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr
                      key={o.id}
                      className={o.id === selected ? "growth-selected" : ""}
                    >
                      <td>
                        <button
                          className="growth-record-link"
                          onClick={() => select(o.id)}
                        >
                          {
                            accounts.find((a) => a.id === o.account_id)
                              ?.organization
                          }{" "}
                          · {o.title}
                        </button>
                        {o.archived_at && <small>Archived</small>}
                      </td>
                      <td>{label(o.stage)}</td>
                      <td>{o.owner_name || "Unassigned"}</td>
                      <td>
                        {money(o.estimated_value)} · {o.probability}%
                      </td>
                      <td>
                        {o.next_action || "Set a next action"}
                        <br />
                        {o.next_action_date || "No date"}
                      </td>
                      <td>{o.target_date || "—"}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan="6">
                        No opportunities match. Add a client and opportunity to
                        start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {opportunity && account && (
            <>
              <section className="sc-panel">
                <div className="growth-actions">
                  <h2>
                    {account.organization} / {opportunity.title}
                  </h2>
                  {canWrite && (
                    <>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit(
                            "opportunities",
                            opportunity,
                            opportunityFields,
                            "Edit opportunity",
                          )
                        }
                      >
                        Edit opportunity
                      </button>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit(
                            "accounts",
                            account,
                            accountFields,
                            "Edit client and defaults",
                          )
                        }
                      >
                        Edit client
                      </button>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          save(
                            "opportunities",
                            {
                              archived_at: opportunity.archived_at
                                ? null
                                : new Date().toISOString(),
                            },
                            opportunity,
                          )
                        }
                      >
                        {opportunity.archived_at ? "Restore" : "Archive"}
                      </button>
                    </>
                  )}
                </div>
                <p>
                  {label(account.segment)} · {label(opportunity.stage)} ·{" "}
                  {opportunity.owner_name || "Assign an owner"} ·{" "}
                  <External url={account.website}>Client website</External>
                </p>
                <nav
                  className="growth-actions"
                  aria-label="Opportunity sections"
                >
                  {[
                    "overview",
                    "contacts",
                    "activity",
                    "pricing",
                    "samples",
                    "handoff",
                    ...(manager ? ["history"] : []),
                  ].map((t) => (
                    <button
                      className={
                        "sc-btn " + (detailTab === t ? "sc-btn-primary" : "")
                      }
                      key={t}
                      onClick={() => {
                        setDetailTab(t);
                        setEditor(null);
                      }}
                    >
                      {label(t)}
                    </button>
                  ))}
                </nav>
              </section>
              {detailTab === "overview" && (
                <section className="sc-panel">
                  <h2>Relationship and campaign brief</h2>
                  <p className="growth-pre">
                    {opportunity.brief ||
                      "Add the audience, product lines, artwork direction, launch date and fulfillment needs."}
                  </p>
                  <p>
                    <strong>Next action:</strong>{" "}
                    {opportunity.next_action || "Not set"} ·{" "}
                    {opportunity.next_action_date || "No date"}
                  </p>
                  <p>
                    <strong>Demo:</strong> {label(opportunity.demo_status)} ·{" "}
                    <External url={opportunity.demo_url}>
                      Open online store demo
                    </External>
                  </p>
                  <p>
                    <strong>Live storefront:</strong>{" "}
                    <External url={opportunity.store_url}>
                      Open storefront
                    </External>
                  </p>
                  <p>{account.notes}</p>
                  <h3>Existing customer record</h3>
                  <p>
                    {account.customer_id
                      ? "Linked customer #" + account.customer_id
                      : "The lead remains separate from the customer catalog until a handoff or explicit link."}
                  </p>
                  {manager && (
                    <>
                      <div className="growth-actions">
                        <input
                          aria-label="Find existing customer"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search existing customer name"
                        />
                        <button
                          className="sc-btn"
                          onClick={() =>
                            run(async () =>
                              setCustomers(
                                await growthCustomers(customerSearch),
                              ),
                            )
                          }
                        >
                          Find customer
                        </button>
                      </div>
                      <div className="growth-search-results">
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() =>
                              save("accounts", { customer_id: c.id }, account)
                            }
                          >
                            {c.name} · {c.code || c.id} — link
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
              {detailTab === "contacts" && (
                <section className="sc-panel">
                  <div className="growth-actions">
                    <h2>Contacts and decision makers</h2>
                    {canWrite && (
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit(
                            "contacts",
                            {
                              account_id: account.id,
                              name: "",
                              contact_permission: "unknown",
                              is_primary: false,
                            },
                            contactFields,
                            "Add client contact",
                          )
                        }
                      >
                        Add contact
                      </button>
                    )}
                  </div>
                  <div className="growth-card-grid">
                    {visibleContacts.map((c) => (
                      <article className="growth-subcard" key={c.id}>
                        <h3>
                          {c.name} {c.is_primary ? "· Primary" : ""}
                        </h3>
                        <p>{c.job_title}</p>
                        <p>
                          {c.email}
                          <br />
                          {c.phone}
                        </p>
                        <p>
                          <strong>{label(c.contact_permission)}</strong>
                        </p>
                        <p>{c.notes}</p>
                        {canWrite && (
                          <div className="growth-actions">
                            <button
                              className="sc-btn"
                              onClick={() =>
                                edit(
                                  "contacts",
                                  c,
                                  contactFields,
                                  "Edit contact",
                                )
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="sc-btn"
                              onClick={() =>
                                save(
                                  "contacts",
                                  {
                                    archived_at: c.archived_at
                                      ? null
                                      : new Date().toISOString(),
                                    is_primary: false,
                                  },
                                  c,
                                )
                              }
                            >
                              {c.archived_at ? "Restore" : "Archive"}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                    {!visibleContacts.length && (
                      <p>
                        Add the organization’s decision makers and outreach
                        preferences.
                      </p>
                    )}
                  </div>
                </section>
              )}
              {detailTab === "activity" && (
                <>
                  <section className="sc-panel">
                    <div className="growth-actions">
                      <h2>Relationship timeline</h2>
                      {canWrite && (
                        <>
                          <button
                            className="sc-btn"
                            onClick={() =>
                              edit(
                                "activities",
                                {
                                  opportunity_id: opportunity.id,
                                  kind: "note",
                                  summary: "",
                                  occurred_at: new Date(
                                    Date.now() -
                                      new Date().getTimezoneOffset() * 60000,
                                  )
                                    .toISOString()
                                    .slice(0, 16),
                                },
                                [
                                  field(
                                    "occurred_at",
                                    "Activity date / time",
                                    "datetime-local",
                                    null,
                                    true,
                                  ),
                                  field("kind", "Activity", "select", [
                                    "note",
                                    "call",
                                    "email",
                                    "meeting",
                                    "demo",
                                    "sample",
                                    "follow_up",
                                  ]),
                                  field(
                                    "summary",
                                    "Summary",
                                    "text",
                                    null,
                                    true,
                                  ),
                                  field("contact_id", "Contact", "select", [
                                    ["", "No contact"],
                                    ...visibleContacts.map((c) => [
                                      c.id,
                                      c.name,
                                    ]),
                                  ]),
                                  field(
                                    "material_id",
                                    "Material used",
                                    "select",
                                    [
                                      ["", "No material"],
                                      ...materials
                                        .filter(
                                          (m) =>
                                            m.status === "approved" &&
                                            !m.archived_at,
                                        )
                                        .map((m) => [
                                          m.id,
                                          m.title + " v" + m.revision,
                                        ]),
                                    ],
                                  ),
                                  field(
                                    "details",
                                    "Discussion / feedback",
                                    "textarea",
                                  ),
                                  field("outcome", "Outcome / response"),
                                ],
                                "Record activity",
                              )
                            }
                          >
                            Record activity
                          </button>
                          <button
                            className="sc-btn"
                            onClick={() =>
                              edit(
                                "tasks",
                                {
                                  opportunity_id: opportunity.id,
                                  title: "",
                                  department: "marketing",
                                  status: "open",
                                  owner_name: opportunity.owner_name,
                                },
                                [
                                  field(
                                    "title",
                                    "Follow-up task",
                                    "text",
                                    null,
                                    true,
                                  ),
                                  field("department", "Department", "select", [
                                    "marketing",
                                    "design",
                                    "catalog",
                                    "storefront",
                                    "purchasing",
                                    "production",
                                    "qc",
                                    "shipping",
                                  ]),
                                  field("owner_name", "Owner"),
                                  field("due_date", "Due", "date"),
                                  field("notes", "Notes", "textarea"),
                                ],
                                "Add task",
                              )
                            }
                          >
                            Add follow-up task
                          </button>
                        </>
                      )}
                    </div>
                    {detail.activities.map((a) => (
                      <article className="growth-timeline" key={a.id}>
                        <small>
                          {new Date(a.occurred_at).toLocaleString()} ·{" "}
                          {label(a.kind)} ·{" "}
                          {visibleContacts.find((c) => c.id === a.contact_id)
                            ?.name || "Team"}
                        </small>
                        <h3>{a.summary}</h3>
                        <p className="growth-pre">{a.details}</p>
                        <p>{a.outcome}</p>
                        {a.material_id && (
                          <p>
                            Material:{" "}
                            {materials.find((m) => m.id === a.material_id)
                              ?.title || "Saved revision"}
                          </p>
                        )}
                      </article>
                    ))}
                    {!detail.activities.length && (
                      <p>No outreach or feedback recorded.</p>
                    )}
                  </section>
                  <Tasks
                    rows={detail.tasks}
                    canWrite={canWrite}
                    onSave={save}
                    onEdit={(t) =>
                      edit(
                        "tasks",
                        t,
                        taskFields,
                        "Edit task owner and readiness",
                      )
                    }
                  />
                </>
              )}
              {detailTab === "pricing" && (
                <section className="sc-panel">
                  <div className="growth-actions">
                    <h2>Pricing guides and commercial terms</h2>
                    {canWrite && (
                      <button
                        className="sc-btn sc-btn-primary"
                        onClick={() =>
                          setEditor({ table: "pricing", initial: {} })
                        }
                      >
                        New pricing proposal
                      </button>
                    )}
                  </div>
                  <p>
                    Client defaults:{" "}
                    {growthModels[account.pricing_defaults?.model || "retail"]}{" "}
                    {account.pricing_defaults?.model?.includes("share")
                      ? ` · client share ${account.pricing_defaults.share_percent || 0}% · `
                      : " · "}
                    target margin{" "}
                    {account.pricing_defaults?.target_margin_percent ?? 40}%.
                    Each proposal can override these percentages.
                  </p>
                  {proposedRows.map((p) => (
                    <article className="growth-subcard" key={p.id}>
                      <h3>
                        {p.title} · v{p.version} · {label(p.status)}
                      </h3>
                      <p>
                        {growthModels[p.config.model]}
                        {p.config.model?.includes("share")
                          ? ` · client share ${p.config.share_percent || 0}%`
                          : ""}{" "}
                        · margin target {p.config.target_margin_percent ?? 40}%
                        · valid {p.valid_until || "until reviewed"}
                      </p>
                      <PricingSummary calculation={p.calculation} />
                      <p className="growth-pre">{p.terms}</p>
                      {p.approval_note && (
                        <p>Manager approval note: {p.approval_note}</p>
                      )}
                      <div className="growth-actions">
                        <button
                          className="sc-btn"
                          onClick={() =>
                            download(
                              "pricing-guide-v" + p.version + ".html",
                              pricingGuide(p, account, opportunity),
                              "text/html;charset=utf-8",
                            )
                          }
                        >
                          Download client pricing guide
                        </button>
                        {canWrite && (
                          <button
                            className="sc-btn"
                            onClick={() => cloneProposal(p)}
                          >
                            Create next version
                          </button>
                        )}
                        {canWrite && p.status === "draft" && (
                          <button
                            className="sc-btn"
                            onClick={() =>
                              setEditor({ table: "pricing", initial: p })
                            }
                          >
                            Edit draft
                          </button>
                        )}
                        {manager && p.status === "draft" && (
                          <button
                            className="sc-btn sc-btn-primary"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const r = await growthRpc(
                                  "sc_growth_approve_proposal_v1",
                                  {
                                    p_id: p.id,
                                    p_expected_updated_at: p.updated_at,
                                    p_note: approvalNote || null,
                                  },
                                );
                                if (!r.simulated) {
                                  await refresh();
                                  setMessage(
                                    "Proposal approved. Previous approved terms are retained as superseded history.",
                                  );
                                }
                                return r;
                              })
                            }
                          >
                            Approve this version
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {manager && (
                    <Field
                      name="approval_note"
                      title="Manager approval / below-target explanation"
                      type="textarea"
                      value={approvalNote}
                      onChange={(_, v) => setApprovalNote(v)}
                    />
                  )}
                  <p className="growth-help">
                    Downloaded client guides omit internal cost and company
                    margin fields. Version status and expiry remain visible.
                    These proposals describe agreed terms; payouts are finalized
                    from actual sales and returns.
                  </p>
                </section>
              )}
              {detailTab === "samples" && (
                <section className="sc-panel">
                  <div className="growth-actions">
                    <h2>Sample requests and promotional cost</h2>
                    {canWrite && (
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit(
                            "samples",
                            {
                              opportunity_id: opportunity.id,
                              description: "",
                              quantity: 1,
                              unit_cost: 0,
                              status: "requested",
                            },
                            sampleFields,
                            "Track sample",
                          )
                        }
                      >
                        Track sample
                      </button>
                    )}
                  </div>
                  <p>
                    Sample tracking records commitments and promotional cost.
                    Use the normal finished-product and sample-inventory
                    workflows for physical stock movements.
                  </p>
                  {data?.role !== "marketing" && (
                    <div className="growth-actions">
                      <Link className="sc-btn" to="/finished/create">
                        Create finished demo / sample
                      </Link>
                      <Link className="sc-btn" to="/inventory/samples">
                        Sample inventory
                      </Link>
                    </div>
                  )}
                  {detail.samples.map((s) => (
                    <article className="growth-subcard" key={s.id}>
                      <h3>
                        {s.description} · {label(s.status)}
                      </h3>
                      <p>
                        {s.quantity} units · {money(s.quantity * s.unit_cost)} ·
                        Due {s.due_date || "—"}
                      </p>
                      <p>{s.notes}</p>
                      <p>Production review: {s.production_review_status || "pending"}</p>
                      {manager && (!s.production_review_status || s.production_review_status==="pending") && (
                        <button type="button" className="sc-btn" disabled={busy}
                          onClick={()=>run(async()=>{
                            const result=await growthRpc("sc_growth_review_sample_v1",{
                              p_sample_id:s.id,p_decision:"approved",p_note:null
                            });
                            if(!result?.simulated){await refresh();setMessage("Sample sent to production review; no stock changed.");}
                            return result;
                          })}>Approve sample for production review</button>
                      )}

                      {canWrite && (
                        <>
                          <button
                            className="sc-btn"
                            onClick={() =>
                              edit(
                                "samples",
                                s,
                                sampleFields,
                                "Edit sample commitment",
                              )
                            }
                          >
                            Edit sample
                          </button>
                          <select
                            aria-label={"Sample status " + s.description}
                            value={s.status}
                            onChange={(e) =>
                              save(
                                "samples",
                                {
                                  status: e.target.value,
                                  delivered_at:
                                    e.target.value === "delivered"
                                      ? today()
                                      : s.delivered_at,
                                },
                                s,
                              )
                            }
                          >
                            {[
                              "requested",
                              "preparing",
                              "ready",
                              "delivered",
                              "return_due",
                              "returned",
                              "retired",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </article>
                  ))}
                  {!detail.samples.length && <p>No sample commitments yet.</p>}
                </section>
              )}
              {detailTab === "history" && manager && (
                <section className="sc-panel">
                  <div className="growth-actions">
                    <h2>Change history</h2>
                    <button
                      className="sc-btn"
                      onClick={() =>
                        run(async () =>
                          setHistory(
                            await loadGrowthHistory([
                              account.id,
                              opportunity.id,
                              ...detail.contacts.map((x) => x.id),
                              ...detail.proposals.map((x) => x.id),
                              ...detail.tasks.map((x) => x.id),
                              ...detail.samples.map((x) => x.id),
                            ]),
                          ),
                        )
                      }
                    >
                      Load latest 100 changes
                    </button>
                  </div>
                  {history.map((h) => (
                    <article className="growth-timeline" key={h.id}>
                      <h3>
                        {label(h.table_name.replace("sc_growth_", ""))} ·{" "}
                        {h.action === "INSERT" ? "Created" : "Updated"}
                      </h3>
                      <p>{new Date(h.created_at).toLocaleString()}</p>
                      <p>
                        {h.new_row?.title ||
                          h.new_row?.organization ||
                          h.new_row?.name ||
                          h.new_row?.summary}
                      </p>
                      <p>
                        {Object.keys(h.new_row || {})
                          .filter(
                            (k) =>
                              ![
                                "updated_at",
                                "created_at",
                                "created_by",
                                "calculation",
                              ].includes(k) &&
                              JSON.stringify(h.old_row?.[k]) !==
                                JSON.stringify(h.new_row[k]),
                          )
                          .map(label)
                          .join(", ")}
                      </p>
                    </article>
                  ))}
                </section>
              )}
              {detailTab === "handoff" && (
                <>
                  <section className="sc-panel">
                    <h2>Connected launch and operations</h2>
                    <p>
                      Preparing design creates or reuses the customer, native
                      artwork brief and Mockup Studio project. Operations
                      handoff adds a linked team-store workflow, a draft partner
                      supply estimate, approved pricing lines and launch tasks.
                      No storefront is published and no purchase order or
                      production movement is submitted by this action.
                    </p>
                    <div className="growth-actions">
                      {manager && (
                        <>
                          <button
                            className="sc-btn"
                            disabled={busy}
                            onClick={() => handoff("design")}
                          >
                            Prepare design handoff
                          </button>
                          <button
                            className="sc-btn sc-btn-primary"
                            disabled={busy || !approved}
                            onClick={() => handoff("operations")}
                          >
                            Prepare operations handoff
                          </button>
                        </>
                      )}
                      {data?.role !== "marketing" &&
                        opportunity.artwork_request_id && (
                          <Link
                            className="sc-btn"
                            to={"/artwork-requests?growth=" + opportunity.id}
                          >
                            Open design brief
                          </Link>
                        )}
                      {data?.role !== "marketing" &&
                        opportunity.mockup_project_id && (
                          <Link
                            className="sc-btn"
                            to={
                              "/mockup-studio?project=" +
                              opportunity.mockup_project_id
                            }
                          >
                            Open linked mockup project
                          </Link>
                        )}
                      {data?.role !== "marketing" &&
                        opportunity.store_workflow_id && (
                          <Link
                            className="sc-btn"
                            to="/operations-integrity?tab=stores"
                          >
                            Team-store launch workflow
                          </Link>
                        )}
                      {data?.role !== "marketing" && opportunity.quote_id && (
                        <Link className="sc-btn" to="/quote-builder">
                          Partner supply estimate #{opportunity.quote_id}
                        </Link>
                      )}
                    </div>
                    <p>
                      Approved proposal:{" "}
                      {approved
                        ? approved.title + " v" + approved.version
                        : "Required for operations"}{" "}
                      · Handoff pricing snapshot:{" "}
                      {opportunity.handoff_proposal_id === approved?.id
                        ? "Current"
                        : opportunity.handed_off_at
                          ? "New approved terms require another handoff"
                          : "Not prepared"}
                    </p>
                    <p>
                      Design:{" "}
                      {detail.snapshot?.artwork?.status || "Not prepared"} ·
                      Mockups:{" "}
                      {detail.snapshot?.mockup?.status || "Not prepared"} ·
                      Store workflow:{" "}
                      {detail.snapshot?.store?.stage || "Not prepared"} · Supply
                      estimate:{" "}
                      {detail.snapshot?.quote?.status || "Not prepared"}
                    </p>
                    {data?.role !== "marketing" && (
                      <div className="growth-actions">
                        <Link to="/new-product-line">Product line setup</Link>
                        <Link to="/catalog-workbench">
                          Catalog and mappings
                        </Link>
                        <Link to="/client-orders">Client order intake</Link>
                        <Link to="/purchasing">Purchasing</Link>
                        <Link to="/production-board">Production & shipping</Link>
                        <Link to="/qc-checklist">QC checklist</Link>
                        </div>
                    )}
                  </section>
                  <Tasks
                    rows={detail.tasks}
                    canWrite={canWrite}
                    onSave={save}
                    onEdit={(t) =>
                      edit(
                        "tasks",
                        t,
                        taskFields,
                        "Edit task owner and readiness",
                      )
                    }
                  />
                  <section className="sc-panel">
                    <h2>Orders and fulfillment</h2>
                    <p>
                      Link the resulting WooCommerce order to this opportunity.
                      Status comes from the existing job; purchasing,
                      reservations, QC and shipping remain in the operational
                      workflow.
                    </p>
                    {data?.role !== "marketing" && (
                      <div className="growth-actions">
                        <input
                          aria-label="Find client order"
                          value={jobSearch}
                          onChange={(e) => setJobSearch(e.target.value)}
                          placeholder="WooCommerce order ID or job name"
                        />
                        <button
                          className="sc-btn"
                          onClick={() =>
                            run(async () =>
                              setJobs(await growthJobs(jobSearch)),
                            )
                          }
                        >
                          Find order
                        </button>
                      </div>
                    )}
                    {canWrite && data?.role !== "marketing" && (
                      <div className="growth-search-results">
                        {jobs.map((j) => (
                          <button
                            key={j.id}
                            onClick={() =>
                              save(
                                "order_links",
                                {
                                  opportunity_id: opportunity.id,
                                  job_id: j.id,
                                },
                                null,
                              )
                            }
                          >
                            {j.job_name} · {j.status} — link
                          </button>
                        ))}
                      </div>
                    )}
                    {detail.jobs.map((j) => (
                      <p key={j.id}>
                        {data?.role === "marketing" ? (
                          <strong>
                            {j.job_name || "Order " + j.woocommerce_order_id}
                          </strong>
                        ) : (
                          <Link to={"/pullsheets/" + j.id}>
                            {j.job_name || "Order " + j.woocommerce_order_id}
                          </Link>
                        )}{" "}
                        · {label(j.status)} · Due {j.due_date || "—"}
                      </p>
                    ))}
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
      {view === "clients" && (
        <section className="sc-panel">
          <h2>Client organizations</h2>
          {canWrite && (
            <details className="growth-subcard">
              <summary>Import a prospect list</summary>
              <p>
                Preview up to 200 organizations. Existing organization + city
                matches remain unchanged. New rows create a contact when
                supplied and an introduction opportunity; outreach preferences
                start as unknown.
              </p>
              <button
                className="sc-btn"
                onClick={() =>
                  download(
                    "prospect-import-template.csv",
                    growthCsv([
                      [
                        "organization",
                        "segment",
                        "city",
                        "website",
                        "source",
                        "owner_name",
                        "contact_name",
                        "email",
                        "phone",
                        "campaign",
                        "brief",
                      ],
                      [
                        "Example School",
                        "school",
                        "Example City",
                        "https://example.org",
                        "Partner referral",
                        "",
                        "",
                        "",
                        "",
                        "School spirit store",
                        "School colors, logo and launch needs",
                      ],
                    ]),
                    "text/csv",
                  )
                }
              >
                Download CSV template
              </button>
              <label className="growth-field">
                CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setImportText(await f.text());
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="growth-field">
                CSV preview
                <textarea
                  rows="5"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </label>
              {importError && <p role="status">{importError}</p>}
              {importRows.length > 0 && (
                <>
                  <p>
                    {importRows.length} valid rows ready. First organizations:{" "}
                    {importRows
                      .slice(0, 8)
                      .map((r) => r.organization)
                      .join(" · ")}
                  </p>
                  <button
                    className="sc-btn sc-btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await growthRpc(
                          "sc_growth_import_accounts_v1",
                          { p_rows: importRows },
                        );
                        if (!r.simulated) {
                          await refresh();
                          setImportText("");
                          setMessage(
                            r.created +
                              " clients imported; " +
                              r.existing_unchanged +
                              " existing clients retained.",
                          );
                        }
                        return r;
                      })
                    }
                  >
                    Import validated prospects
                  </button>
                </>
              )}
            </details>
          )}
          <div className="growth-card-grid">
            {accounts
              .filter(
                (a) =>
                  (archived || !a.archived_at) &&
                  a.organization.toLowerCase().includes(search.toLowerCase()),
              )
              .map((a) => (
                <article className="growth-subcard" key={a.id}>
                  <h3>{a.organization}</h3>
                  <p>
                    {label(a.segment)} · {a.city} ·{" "}
                    {a.owner_name || "Unassigned"}
                  </p>
                  <p>
                    {growthModels[a.pricing_defaults?.model || "retail"]} ·
                    {a.pricing_defaults?.model?.includes("share")
                      ? `Client share ${a.pricing_defaults.share_percent || 0}% · `
                      : ""}
                    Target margin{" "}
                    {a.pricing_defaults?.target_margin_percent ?? 40}%
                  </p>
                  <p>{a.notes}</p>
                  {canWrite && (
                    <div className="growth-actions">
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit("accounts", a, accountFields, "Edit client")
                        }
                      >
                        Edit client
                      </button>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          save(
                            "accounts",
                            {
                              archived_at: a.archived_at
                                ? null
                                : new Date().toISOString(),
                            },
                            a,
                          )
                        }
                      >
                        {a.archived_at ? "Restore" : "Archive"}
                      </button>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit(
                            "opportunities",
                            {
                              account_id: a.id,
                              title: "",
                              owner_name: a.owner_name,
                              stage: "identified",
                              probability: 10,
                              estimated_value: 0,
                              demo_status: "planned",
                            },
                            opportunityFields,
                            "New opportunity for " + a.organization,
                          )
                        }
                      >
                        Add campaign
                      </button>
                    </div>
                  )}
                  {opportunities
                    .filter((o) => o.account_id === a.id && !o.archived_at)
                    .map((o) => (
                      <p key={o.id}>
                        <button
                          className="growth-record-link"
                          onClick={() => select(o.id)}
                        >
                          {o.title} · {label(o.stage)}
                        </button>
                      </p>
                    ))}
                </article>
              ))}
          </div>
        </section>
      )}
      {view === "materials" && (
        <section className="sc-panel">
          <div className="growth-actions">
            <h2>Promotional library</h2>
            <select
              aria-label="Material type"
              value={materialKind}
              onChange={(e) => setMaterialKind(e.target.value)}
            >
              <option value="all">All types</option>
              {[
                "flyer",
                "email",
                "sample",
                "presentation",
                "pricing_guide",
                "demo",
                "other",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            {canWrite && (
              <button
                className="sc-btn"
                onClick={() =>
                  edit(
                    "materials",
                    {
                      title: "",
                      kind: "flyer",
                      segment: "all",
                      status: "draft",
                      revision: 1,
                      cost: 0,
                    },
                    materialFields,
                    "New promotional material",
                  )
                }
              >
                Add material
              </button>
            )}
          </div>
          <p>
            Keep approved versions of flyers, email drafts, presentations and
            demos. Upload private files up to 25 MB or save links and text.
            Retired versions stay in history.
          </p>
          {opportunity && (
            <Field
              name="templateContact"
              title={"Preview email for " + account.organization}
              value={templateContact}
              onChange={(_, v) => setTemplateContact(v)}
              options={[
                ["", "Choose a contact"],
                ...visibleContacts.map((c) => [
                  c.id,
                  c.name + " · " + label(c.contact_permission),
                ]),
              ]}
            />
          )}
          <div className="growth-card-grid">
            {materialRows.map((m) => (
              <article className="growth-subcard" key={m.id}>
                <h3>
                  {m.title} · v{m.revision}
                </h3>
                <p>
                  {label(m.kind)} · {m.segment} · {label(m.status)} ·{" "}
                  {money(m.cost)}
                </p>
                <p className="growth-pre">{m.body}</p>
                <External url={m.url}>Open material / demo</External>
                {m.file_name && (
                  <p>
                    {m.file_name} ·{" "}
                    {m.upload_complete ? "Verified file" : "Upload incomplete"}
                  </p>
                )}
                <div className="growth-actions">
                  {m.upload_complete && (
                    <button
                      className="sc-btn"
                      onClick={() =>
                        run(async () => {
                          const r = await growthMaterialDownload(m.id);
                          window.open(r.url, "_blank", "noopener,noreferrer");
                        })
                      }
                    >
                      Open private file
                    </button>
                  )}
                  {canWrite && m.status === "draft" && (
                    <>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit("materials", m, materialFields, "Edit material")
                        }
                      >
                        Edit draft
                      </button>
                      <label className="sc-btn">
                        Upload file
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.pptx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file)
                              run(async () => {
                                const r = await uploadGrowthMaterial(
                                  m.id,
                                  file,
                                );
                                if (!r.simulated) {
                                  await refresh();
                                  setMessage("File uploaded and verified.");
                                }
                                return r;
                              });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </>
                  )}
                  {manager && m.status === "draft" && (
                    <button
                      className="sc-btn"
                      onClick={() =>
                        save("materials", { status: "approved" }, m)
                      }
                    >
                      Approve material
                    </button>
                  )}
                  {canWrite && (
                    <>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          edit(
                            "materials",
                            {
                              title: m.title,
                              kind: m.kind,
                              segment: m.segment,
                              body: m.body,
                              url: m.url,
                              cost: m.cost,
                              parent_id: m.parent_id || m.id,
                              revision:
                                Math.max(
                                  m.revision,
                                  ...materials
                                    .filter(
                                      (x) =>
                                        (x.parent_id || x.id) ===
                                        (m.parent_id || m.id),
                                    )
                                    .map((x) => x.revision),
                                ) + 1,
                              status: "draft",
                            },
                            materialFields,
                            "New material revision — attach its file after saving",
                          )
                        }
                      >
                        New revision
                      </button>
                      <button
                        className="sc-btn"
                        onClick={() =>
                          save(
                            "materials",
                            {
                              archived_at: m.archived_at
                                ? null
                                : new Date().toISOString(),
                            },
                            m,
                          )
                        }
                      >
                        {m.archived_at ? "Restore" : "Archive"}
                      </button>
                    </>
                  )}
                  {m.kind === "email" && opportunity && (
                    <button
                      className="sc-btn"
                      disabled={
                        !chosenContact ||
                        chosenContact.contact_permission === "do_not_contact" ||
                        m.status !== "approved"
                      }
                      onClick={() =>
                        run(async () => {
                          const text = (m.body || "")
                            .replaceAll(
                              "{{organization}}",
                              account.organization,
                            )
                            .replaceAll("{{contact}}", chosenContact.name)
                            .replaceAll(
                              "{{store_url}}",
                              opportunity.demo_url ||
                                opportunity.store_url ||
                                "",
                            );
                          await navigator.clipboard.writeText(text);
                          setMessage(
                            "Email draft copied. No email was sent. Record outreach in the opportunity timeline after sending it.",
                          );
                        })
                      }
                    >
                      Copy personalized email draft
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {view === "follow_ups" && (
        <section className="sc-panel">
          <h2>Follow-ups and handoff tasks due</h2>
          {followUps.map((o) => (
            <p key={o.id}>
              <button
                className="growth-record-link"
                onClick={() => select(o.id)}
              >
                {accounts.find((a) => a.id === o.account_id)?.organization} ·{" "}
                {o.next_action || o.title}
              </button>{" "}
              · {o.owner_name || "Unassigned"} · {o.next_action_date}
            </p>
          ))}
          {dueTasks.map((t) => (
            <p key={t.id}>
              <button
                className="growth-record-link"
                onClick={() => {
                  select(t.opportunity_id);
                  setDetailTab("activity");
                }}
              >
                {t.title}
              </button>{" "}
              · {t.owner_name || "Unassigned"} · {t.due_date} ·{" "}
              {label(t.status)}
            </p>
          ))}
          {!followUps.length && !dueTasks.length && (
            <p>
              No overdue or due-today follow-ups. Completed and closed work is
              excluded.
            </p>
          )}
        </section>
      )}
      {view === "reports" && (
        <section className="sc-panel">
          <h2>Acquisition and launch reports</h2>
          {data?.role === "admin" && (
            <details className="growth-subcard">
              <summary>Marketing partner access</summary>
              <p>
                Use an existing registered employee account. Marketing access
                covers client acquisition and planning; approvals and shop
                operations remain restricted. No user is invited or changed
                until you choose an access action.
              </p>
              <button
                className="sc-btn"
                onClick={() => run(async () => setTeam(await growthTeam()))}
              >
                Load registered employees
              </button>
              {team?.users.map((u) => (
                <div className="growth-task" key={u.id}>
                  <div>
                    <strong>{u.email}</strong>
                    <p>
                      {u.role?.role || "No active employee role"} ·{" "}
                      {u.role?.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  {!["admin", "manager"].includes(u.role?.role) && (
                    <div className="growth-actions">
                      <button
                        className="sc-btn"
                        onClick={() =>
                          run(async () => {
                            const r = await growthTeamAccess(
                              u,
                              "assign_marketing",
                            );
                            if (!r.simulated) {
                              setTeam(await growthTeam(team.page));
                              setMessage(
                                "Marketing access assigned. The employee should sign in again.",
                              );
                            }
                            return r;
                          })
                        }
                      >
                        Assign Marketing access
                      </button>
                      {u.role?.role === "marketing" && u.role?.is_active && (
                        <button
                          className="sc-btn"
                          onClick={() =>
                            run(async () => {
                              const r = await growthTeamAccess(
                                u,
                                "deactivate_marketing",
                              );
                              if (!r.simulated) {
                                setTeam(await growthTeam(team.page));
                                setMessage("Marketing access deactivated.");
                              }
                              return r;
                            })
                          }
                        >
                          Deactivate Marketing access
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {team && (
                <div className="growth-actions">
                  <button
                    className="sc-btn"
                    disabled={team.page <= 1}
                    onClick={() =>
                      run(async () => setTeam(await growthTeam(team.page - 1)))
                    }
                  >
                    Previous employees
                  </button>
                  <button
                    className="sc-btn"
                    disabled={!team.has_more}
                    onClick={() =>
                      run(async () => setTeam(await growthTeam(team.page + 1)))
                    }
                  >
                    Next employees
                  </button>
                </div>
              )}
            </details>
          )}
          <p>
            Forecasts are planning estimates, separate from invoiced revenue and
            actual partner settlement.
          </p>
          <div className="growth-metrics">
            {[
              [
                "Won / launching / live",
                opportunities.filter(
                  (o) =>
                    !o.archived_at &&
                    ["won", "launching", "live"].includes(o.stage),
                ).length,
              ],
              [
                "Lost",
                opportunities.filter(
                  (o) => !o.archived_at && o.stage === "lost",
                ).length,
              ],
              ["Active clients", accounts.filter((a) => !a.archived_at).length],
              [
                "Ready / approved demos",
                opportunities.filter(
                  (o) =>
                    !o.archived_at &&
                    ["ready", "approved"].includes(o.demo_status),
                ).length,
              ],
            ].map(([k, v]) => (
              <article key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </article>
            ))}
          </div>
          <div className="growth-table-wrap">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Client type</th>
                  <th>Open opportunities</th>
                  <th>Pipeline sales</th>
                  <th>Weighted forecast</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => {
                  const r = active.filter(
                    (o) =>
                      accounts.find((a) => a.id === o.account_id)?.segment ===
                      s,
                  );
                  return (
                    <tr key={s}>
                      <td>{label(s)}</td>
                      <td>{r.length}</td>
                      <td>
                        {money(
                          r.reduce((n, o) => n + Number(o.estimated_value), 0),
                        )}
                      </td>
                      <td>
                        {money(
                          r.reduce(
                            (n, o) =>
                              n +
                              (Number(o.estimated_value) * o.probability) / 100,
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3>Activity and promotional investment</h3>
          <p>
            Sample commitments: {money(data?.dashboard?.sample_cost)} · Material
            preparation costs: {money(data?.dashboard?.material_cost)}. These
            are recorded marketing costs, separate from the inventory ledger.
          </p>
          <p>
            Approved open proposals: client benefit forecast{" "}
            {money(data?.dashboard?.approved_partner_forecast)} · company profit
            forecast {money(data?.dashboard?.approved_profit_forecast)}.
          </p>
          <p>
            Recorded activities in the last 30 days:{" "}
            {Object.entries(data?.dashboard?.activity_counts || {})
              .map(([k, v]) => label(k) + ": " + v)
              .join(" · ") || "None yet"}
          </p>
          <h3>Source and referral performance</h3>
          {[
            ...new Set(opportunities.map((o) => o.source || "Unspecified")),
          ].map((source) => {
            const rows = opportunities.filter(
              (o) => !o.archived_at && (o.source || "Unspecified") === source,
            );
            return (
              <p key={source}>
                <strong>{source}</strong> · {rows.length} opportunities ·{" "}
                {
                  rows.filter((o) =>
                    ["won", "launching", "live"].includes(o.stage),
                  ).length
                }{" "}
                won / launched
              </p>
            );
          })}
          <button className="sc-btn" onClick={csvExport}>
            Export filtered pipeline
          </button>
        </section>
      )}
      {!data && !message && <p role="status">Loading marketing workspace…</p>}
    </main>
  );
}
const materialFields = [
  field("title", "Material title / email subject", "text", null, true),
  field("kind", "Type", "select", [
    "flyer",
    "email",
    "sample",
    "presentation",
    "pricing_guide",
    "demo",
    "other",
  ]),
  field("segment", "Audience", "select", ["all", ...segments]),
  field("url", "External material / demo URL", "url"),
  field(
    "body",
    "Content / email draft (supports {{organization}}, {{contact}}, {{store_url}})",
    "textarea",
  ),
  {
    name: "cost",
    title: "Preparation / print cost",
    type: "number",
    min: 0,
    step: 0.01,
  },
];
function Tasks({ rows, canWrite, onSave, onEdit }) {
  return (
    <section className="sc-panel">
      <h2>Owned tasks and launch readiness</h2>
      {rows.map((t) => (
        <article className="growth-task" key={t.id}>
          <div>
            <strong>{t.title}</strong>
            <p>
              {label(t.department)} · {t.owner_name || "Unassigned"} · Due{" "}
              {t.due_date || "not set"}
            </p>
            <p>{t.notes}</p>
          </div>
          {canWrite ? (
            <>
              <button className="sc-btn" onClick={() => onEdit(t)}>
                Edit task
              </button>
              <select
                aria-label={"Task status " + t.title}
                value={t.status}
                onChange={(e) => onSave("tasks", { status: e.target.value }, t)}
              >
                {[
                  "open",
                  "in_progress",
                  "blocked",
                  "complete",
                  "cancelled",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </>
          ) : (
            <span>{label(t.status)}</span>
          )}
        </article>
      ))}
      {!rows.length && (
        <p>
          Add a follow-up task or prepare operations handoff to generate
          departmental launch tasks.
        </p>
      )}
    </section>
  );
}

const taskFields = [
  field("title", "Task", "text", null, true),
  field("owner_name", "Owner"),
  field("due_date", "Due date", "date"),
  field("status", "Status", "select", [
    "open",
    "in_progress",
    "blocked",
    "complete",
    "cancelled",
  ]),
  field("notes", "Handoff notes / blockers", "textarea"),
];

const sampleFields = [
  field("description", "Sample / kit description", "text", null, true),
  {
    name: "quantity",
    type: "number",
    min: 1,
    step: 1,
  },
  {
    name: "unit_cost",
    title: "Promotional cost per unit",
    type: "number",
    min: 0,
    step: 0.01,
  },
  field("status", "Status", "select", [
    "requested",
    "preparing",
    "ready",
    "delivered",
    "return_due",
    "returned",
    "retired",
  ]),
  field("due_date", "Due / return due", "date"),
  field("delivered_at", "Delivered", "date"),
  field("notes", "Bin reference, recipient and feedback", "textarea"),
];
