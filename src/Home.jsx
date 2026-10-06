import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import HomeClientOrderNotice from './HomeClientOrderNotice';
import HomeUpcomingCommitments from './HomeUpcomingCommitments';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));

const artworkEventLabels = {
  artwork_request_created: 'New artwork request',
  artwork_request_updated: 'Artwork request updated',
  artwork_status_changed: 'Artwork status changed',
  artwork_mockup_uploaded: 'Mockup uploaded',
  artwork_mockup_updated: 'Mockup details updated',
  artwork_mockup_replaced: 'Mockup replaced',
  artwork_mockup_deleted: 'Mockup deleted',
  artwork_changes_requested: 'Artwork changes requested',
  artwork_approved: 'Artwork approved',
  approved_artwork: 'Artwork approved',
  artwork_saved_to_vault: 'Artwork saved to vault',
};

function artworkActivityLabel(row) {
  return artworkEventLabels[row?.event_type] || String(row?.event_type || 'Artwork activity').replace(/_/g, ' ');
}

function HomeLogo() {
  return (
    <div className="sc-home-logo-wrap" aria-label="Skilled Crafting logo">
      <img
        className="sc-home-logo-img"
        src="/skilled-crafting-logo.png"
        alt="Skilled Crafting"
      />
    </div>
  );
}


export default function Home() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [artworkActivity, setArtworkActivity] = useState([]);
  const [artworkSeenAt, setArtworkSeenAt] = useState('');

  async function loadStats() {
    setLoading(true);
    setError('');
    const [statsResult, activityResult] = await Promise.all([
      supabase.rpc('sc_home_dashboard_stats'),
      supabase
        .from('sc_artwork_system_handoffs')
        .select('id,event_type,source_type,source_id,received_at,payload')
        .eq('source_type', 'request')
        .order('received_at', { ascending: false })
        .limit(8),
    ]);

    if (statsResult.error) {
      setError(statsResult.error.message);
      setStats({});
    } else {
      setStats(statsResult.data || {});
    }

    if (activityResult.error) {
      setError((current) => current || `Artwork activity could not load: ${activityResult.error.message}`);
      setArtworkActivity([]);
    } else {
      setArtworkActivity(activityResult.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    try { setArtworkSeenAt(window.localStorage.getItem('sc-artwork-activity-seen-at') || ''); } catch (_) { /* local storage is optional */ }
    loadStats();
  }, []);

  const unreadArtworkActivity = artworkActivity.filter((row) => !artworkSeenAt || new Date(row.received_at).getTime() > new Date(artworkSeenAt).getTime()).length;

  function markArtworkActivityViewed() {
    const newest = artworkActivity[0]?.received_at || new Date().toISOString();
    setArtworkSeenAt(newest);
    try { window.localStorage.setItem('sc-artwork-activity-seen-at', newest); } catch (_) { /* local storage is optional */ }
  }

  const cards = [
    {
      label: 'Bins',
      value: number(stats.bins_count),
      help: 'Active storage locations available for blanks, finished goods, samples, and receiving.',
      tone: 'bins',
      to: '/bins',
    },
    {
      label: 'Units on Hand',
      value: number(stats.units_on_hand),
      help: 'Blank + finished units currently counted as on hand.',
      tone: 'onhand',
      to: '/inventory/blanks',
    },
    {
      label: 'Blank Units on Hand',
      value: number(stats.blank_units_on_hand),
      help: 'Undecorated blanks currently counted in inventory.',
      tone: 'blank',
      to: '/inventory/blanks',
    },
    {
      label: 'Reserved Units',
      value: number(stats.reserved_units),
      help: 'Only active reservations. Released/cancelled reservations are excluded.',
      tone: 'reserved',
      to: '/reservations',
    },
    {
      label: 'Low Stock Items',
      value: number(stats.low_stock_count),
      help: 'Blank products at or below their reorder threshold.',
      tone: 'warning',
      to: '/purchase-orders/new',
    },
    {
      label: 'Inventory Value',
      value: money(stats.inventory_value),
      help: 'Estimated blank inventory value using unit cost.',
      tone: 'value',
      to: '/job-costing',
    },
    {
      label: 'Open Pull Sheets',
      value: number(stats.open_pull_sheets),
      help: 'Active jobs that still need production attention.',
      tone: 'pullsheets',
      to: '/pullsheets',
    },
    {
      label: 'Pending Artwork',
      value: number(stats.pending_artwork_projects),
      help: 'Customer artwork projects that are not complete, cancelled, rejected, or archived.',
      tone: 'artwork',
      to: '/artwork-requests',
    },
  ];

  return (
    <div className="sc-home-page sc-page-stack">
      <section className="sc-home-hero">
        <div className="sc-home-hero-accent" aria-hidden="true" />
        <div className="sc-home-logo-card">
          <HomeLogo />
        </div>
        <div className="sc-home-hero-copy">
          <div className="sc-kicker">Skilled Crafting Operations</div>
          <h2>Run inventory, artwork, purchasing, and production from one place.</h2>
          <p>
            Start here each day to check active work, receive inventory, review production, and catch issues before they slow down the shop.
          </p>
          <div className="sc-hero-actions">
            <Link className="sc-btn sc-btn-primary" to="/pullsheets">Open Pull Sheets</Link>
            <Link className="sc-btn sc-btn-green" to="/add-item">Receive Inventory</Link>
            <Link className="sc-btn sc-btn-purple" to="/artwork-requests">Artwork Queue</Link>
            <Link className="sc-btn" to="/production-board">Production Board</Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="sc-alert sc-alert-warning">
          Dashboard values could not load: {error}. Confirm that the latest home color/artwork SQL has been run in Supabase.
        </div>
      )}

      <HomeClientOrderNotice />
      <HomeUpcomingCommitments />

      {artworkActivity.length > 0 && (
        <section className="sc-panel sc-panel-color-left">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Artwork Notifications</div>
              <h3>{unreadArtworkActivity > 0 ? `${unreadArtworkActivity} artwork update${unreadArtworkActivity === 1 ? '' : 's'} need attention` : 'Recent artwork activity'}</h3>
              <p>New requests and meaningful Artwork System changes appear here as soon as WordPress sends the webhook.</p>
            </div>
            <div className="sc-hero-actions">
              <Link className="sc-btn sc-btn-purple" to="/artwork-requests">Open Artwork Queue</Link>
              {unreadArtworkActivity > 0 && <button className="sc-btn" type="button" onClick={markArtworkActivityViewed}>Mark viewed</button>}
            </div>
          </div>
          <div className="sc-workflow-list sc-workflow-list-colored">
            {artworkActivity.slice(0, 5).map((row) => {
              const request = row.payload?.artwork_request || {};
              const project = request.organization || request.customer_name || request.project_type || `Artwork request #${row.source_id}`;
              const isUnread = !artworkSeenAt || new Date(row.received_at).getTime() > new Date(artworkSeenAt).getTime();
              return (
                <div key={row.id} style={{ padding: '10px 0' }}>
                  <strong>{isUnread ? 'NEW · ' : ''}{artworkActivityLabel(row)}</strong>
                  <span style={{ display: 'block' }}>{project} · WordPress #{row.source_id} · {new Date(row.received_at).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="sc-stat-grid sc-stat-grid-home">
        {cards.map((card) => (
          <Link className={`sc-stat-card sc-stat-card-color sc-stat-${card.tone}`} key={card.label} to={card.to || '#'}>
            <div className="sc-stat-topline">
              <span>{card.label}</span>
              <i aria-hidden="true" />
            </div>
            <strong>{loading ? '…' : card.value}</strong>
            <small>{card.help}</small>
          </Link>
        ))}
      </section>

      <section className="sc-dashboard-grid">
        <div className="sc-panel sc-panel-color-left">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Daily Workflow</div>
              <h3>Recommended Operating Order</h3>
              <p>Use this checklist as your morning rhythm before production starts.</p>
            </div>
          </div>
          <ol className="sc-workflow-list sc-workflow-list-colored">
            <li><strong>Check artwork and approvals.</strong><span>Clear pending artwork requests before jobs move too far into production.</span></li>
            <li><strong>Open pull sheets.</strong><span>Confirm ordered finished products and paired blanks before anything is pulled.</span></li>
            <li><strong>Review shortages and low stock.</strong><span>Generate purchase orders before production is blocked.</span></li>
            <li><strong>Receive new blanks.</strong><span>Add multiple sizes into bins as shipments arrive.</span></li>
            <li><strong>Move jobs through production.</strong><span>Use the Production Board, QC, and photo proof tools to keep work visible.</span></li>
          </ol>
        </div>

        <div className="sc-panel sc-panel-color-right">
          <div className="sc-panel-header">
            <div>
              <div className="sc-kicker">Quick Actions</div>
              <h3>Common Tasks</h3>
              <p>Jump directly into the screens most often used during daily operations.</p>
            </div>
          </div>
          <div className="sc-quick-grid sc-quick-grid-colored">
            <Link to="/inventory/edit-blanks">Edit Blank Items</Link>
            <Link to="/manual-orders">Manual Invoiced Order</Link>
            <Link to="/purchase-orders/new">Generate PO</Link>
            <Link to="/pricing-rules">Pricing Rules</Link>
            <Link to="/customer-portal-preview">Customer Portal Preview</Link>
            <Link to="/artwork-bridge">Artwork Bridge</Link>
            <Link to="/product-data-health">Product Data Health</Link>
            <Link to="/capacity-planning">Capacity Planning</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
