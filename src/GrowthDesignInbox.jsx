import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { growthWriteAllowed } from "./lib/marketingApi";
import { safeGrowthUrl } from "./lib/growthPricing";
import "./MarketingWorkspace.css";

export default function GrowthDesignInbox({ opportunityId }) {
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await supabase
      .from("sc_growth_opportunities")
      .select(
        "id,title,brief,mockup_project_id,sc_growth_accounts(organization),phase5_artwork_requests(*)",
      )
      .not("artwork_request_id", "is", null)
      .is("archived_at", null)
      .order("target_date");
    if (r.error) throw r.error;
    setRows(r.data || []);
    setSelected(
      (current) =>
        (r.data || []).find((x) => x.id === (current?.id || opportunityId)) ||
        null,
    );
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (!growthWriteAllowed()) {
      setMessage("Training preview: the design brief was not changed.");
      return;
    }
    setBusy(true);
    try {
      const art = selected.phase5_artwork_requests;
      const r = await supabase
        .from("phase5_artwork_requests")
        .update({
          request_details: art.request_details,
          status: art.status,
          approved_asset_url: art.approved_asset_url || null,
          notes: art.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", art.id)
        .eq("updated_at", art.updated_at)
        .select("id")
        .single();
      if (r.error)
        throw Error(
          "The brief changed or could not be saved. Refresh and review before retrying.",
        );
      await load();
      setMessage(
        "Design brief updated. The linked marketing and mockup records remain connected.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  function change(k, v) {
    setSelected((s) => ({
      ...s,
      phase5_artwork_requests: { ...s.phase5_artwork_requests, [k]: v },
    }));
  }
  const art = selected?.phase5_artwork_requests;
  return (
    <main className="page sc-page-stack growth-workspace">
      <section className="sc-page-header-card">
        <div>
          <p className="sc-kicker">Client acquisition → design</p>
          <h1>Marketing Design Briefs</h1>
          <p>
            Native artwork briefs share the client, campaign and product
            direction from Marketing & Client Growth.
          </p>
        </div>
        <Link className="sc-btn" to="/artwork-requests">
          WordPress artwork requests
        </Link>
      </section>
      {message && (
        <p className="sc-alert" role="status">
          {message}
        </p>
      )}
      <section className="sc-panel">
        <h2>Design queue</h2>
        {rows.map((r) => (
          <p key={r.id}>
            <button className="sc-btn" onClick={() => setSelected(r)}>
              {r.sc_growth_accounts?.organization} · {r.title} ·{" "}
              {r.phase5_artwork_requests?.status}
            </button>
          </p>
        ))}
        {!rows.length && (
          <p>
            No marketing briefs yet. Prepare a design handoff from an
            opportunity.
          </p>
        )}
      </section>
      {art && (
        <section className="sc-panel">
          <h2>{selected.title}</h2>
          <p>Due {art.deadline || "not set"}</p>
          <div className="growth-grid">
            <label className="growth-field">
              Design brief
              <textarea
                rows="8"
                value={art.request_details || ""}
                onChange={(e) => change("request_details", e.target.value)}
              />
            </label>
            <label className="growth-field">
              Status
              <select
                value={art.status}
                onChange={(e) => change("status", e.target.value)}
              >
                {[
                  "new",
                  "prompt_ready",
                  "in_design",
                  "sent_for_approval",
                  "revision_requested",
                  "approved",
                  "completed",
                  "cancelled",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="growth-field">
              Approved asset URL
              <input
                type="url"
                value={art.approved_asset_url || ""}
                onChange={(e) => change("approved_asset_url", e.target.value)}
              />
            </label>
            <label className="growth-field">
              Design notes
              <textarea
                value={art.notes || ""}
                onChange={(e) => change("notes", e.target.value)}
              />
            </label>
          </div>
          <div className="growth-actions">
            <button
              className="sc-btn sc-btn-primary"
              disabled={busy}
              onClick={save}
            >
              Save design brief
            </button>
            <Link
              className="sc-btn"
              to={"/marketing?opportunity=" + selected.id}
            >
              Return to client opportunity
            </Link>
            {selected.mockup_project_id && (
              <Link
                className="sc-btn"
                to={"/mockup-studio?project=" + selected.mockup_project_id}
              >
                Open linked mockup project
              </Link>
            )}
            {safeGrowthUrl(art.approved_asset_url) && (
              <a
                href={safeGrowthUrl(art.approved_asset_url)}
                target="_blank"
                rel="noreferrer"
              >
                Approved artwork
              </a>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
