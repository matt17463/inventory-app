import { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import './ArtworkHub.css';

const groups = [
  {
    title: '1 · Intake & approval',
    description: 'Find artwork requests, customer files, approvals, and graphic choices.',
    tools: [
      { name: 'Artwork Requests', path: '/artwork-requests', detail: 'Review requests and approval status', icon: '📬' },
      { name: 'Client Graphics', path: '/client-graphics', detail: 'Manage logos, art variants, and reusable graphics', icon: '🗂️' },
      { name: 'Order Graphics', path: '/order-graphics', detail: 'Assign the right artwork to each order line', icon: '🏷️' },
      { name: 'Artwork Bridge', path: '/artwork-bridge', detail: 'Check WordPress artwork and vault handoffs', icon: '🔁' },
      { name: 'Client Orders', path: '/client-orders', detail: 'Review requests with artwork details', icon: '🧾' },
    ],
  },
  {
    title: '2 · Prepare & design',
    description: 'Clean up source files, create proofs, and prepare for decoration.',
    tools: [
      { name: 'DTF Prep Studio', path: '/dtf-studio', detail: 'Transparency, cleanup, sizing and halftones', icon: '🖼️', marketing: true },
      { name: 'DTF Artwork Preflight', path: '/artwork-preflight', detail: 'Check dimensions, edges, alpha and resolution', icon: '🔎' },
      { name: 'Mockup Studio', path: '/mockup-studio', detail: 'Product mockups and presentation proofs', icon: '👕' },
      { name: 'UV Studio', path: '/uv-studio', detail: 'Dimensional designs and textured patch workflows', icon: '🧩' },
      { name: 'Creative Operations', path: '/creative-operations', detail: 'AI-assisted creative tools and product ideas', icon: '✨', marketing: true },
    ],
  },
  {
    title: '3 · Product & production setup',
    description: 'Connect approved designs to products and production instructions.',
    tools: [
      { name: 'Woo Artwork Mapping', path: '/woo-artwork-mapping', detail: 'Connect WooCommerce product choices to graphics', icon: '🔗' },
      { name: 'Production Readiness', path: '/catalog-production-readiness', detail: 'Certify artwork and variation readiness', icon: '✅', marketing: true },
      { name: 'Manufacturing Recipes', path: '/manufacturing-recipes', detail: 'Save processes, equipment and placements', icon: '🛠️' },
      { name: 'Production Travelers', path: '/production-travelers', detail: 'View saved QR travelers and production assets', icon: '📋' },
      { name: 'Material & Machine Settings', path: '/material-settings', detail: 'Use tested settings for devices and materials', icon: '⚙️' },
    ],
  },
  {
    title: '4 · Review & references',
    description: 'Find reference material and confirm what is ready to produce.',
    tools: [
      { name: 'Product & Event Center', path: '/product-event-center', detail: 'Develop client packages and new products', icon: '💡', marketing: true },
      { name: 'Device & Product Library', path: '/device-product-library', detail: 'Device setup, maintenance and product recipes', icon: '📚' },
      { name: 'Print Center', path: '/print-center', detail: 'Print finished production documents', icon: '🖨️' },
      { name: 'Application Guide', path: '/application-guide', detail: 'Step-by-step help and employee training', icon: '❓', marketing: true },
    ],
  },
];

export default function ArtworkHub() {
  const access = useContext(EmployeeAccessContext);
  const [search, setSearch] = useState('');
  const marketingOnly = access?.role === 'marketing';
  const visibleGroups = useMemo(() => groups.map((group) => ({
    ...group,
    tools: group.tools.filter((tool) =>
      (!marketingOnly || tool.marketing) &&
      `${tool.name} ${tool.detail}`.toLowerCase().includes(search.trim().toLowerCase())
    ),
  })).filter((group) => group.tools.length), [marketingOnly, search]);
  const visibleCount = visibleGroups.reduce((total, group) => total + group.tools.length, 0);

  return (
    <main className="page sc-page-stack sc-artwork-hub">
      <section className="sc-artwork-hub-hero">
        <div>
          <p className="sc-kicker">SKILLED CRAFTING · ARTWORK WORKSPACE</p>
          <h1>Artwork Hub</h1>
          <p>Everything from customer artwork intake to approved production files, organized by the way your shop works.</p>
          <div className="sc-artwork-hub-actions">
            <Link className="sc-btn sc-btn-primary" to="/dtf-studio">Prepare Artwork</Link>
            {!marketingOnly && <Link className="sc-btn" to="/artwork-requests">Review Requests</Link>}
            {!marketingOnly && <Link className="sc-btn" to="/mockup-studio">Build a Mockup</Link>}
          </div>
        </div>
        <div className="sc-artwork-hub-mark" aria-hidden="true">🎨</div>
      </section>

      <section className="sc-artwork-hub-find" aria-label="Find artwork tools">
        <label htmlFor="sc-artwork-hub-search">Find an artwork tool</label>
        <input id="sc-artwork-hub-search" type="search" value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search DTF, graphics, mockups, recipes, UV…" />
        <span>{visibleCount} tools</span>
      </section>

      {visibleGroups.length === 0 && <p className="sc-alert">No artwork tools match this search.</p>}
      {visibleGroups.map((group) => (
        <section className="sc-artwork-hub-group sc-panel" key={group.title}>
          <div className="sc-panel-header"><div><h2>{group.title}</h2><p>{group.description}</p></div></div>
          <div className="sc-artwork-hub-grid">
            {group.tools.map((tool) => (
              <Link to={tool.path} key={tool.path} className="sc-artwork-hub-tool">
                <span className="sc-artwork-hub-tool-icon" aria-hidden="true">{tool.icon}</span>
                <span><strong>{tool.name}</strong><small>{tool.detail}</small></span>
                <span className="sc-artwork-hub-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
