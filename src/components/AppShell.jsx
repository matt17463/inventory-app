import React, { useContext, useEffect, useMemo, useState } from 'react';
import { EmployeeAccessContext, marketingPaths } from '../lib/employeeAccessContext';
import { Link, NavLink, useLocation } from 'react-router-dom';
import * as navConfig from '../navigationConfig';
import DarkModeToggle from './DarkModeToggle';
import GuidedTrainingOverlay from './GuidedTrainingOverlay';
import { supabase } from '../supabaseClient';
import { NavigationContext } from '../lib/navigationContext';
import { defaultNavigationLayout, materializeNavigation, navigationStorageKey, sanitizeNavigationLayout } from '../lib/navigationPreferences';

function normalizeNavigation(raw) {
  const candidate = raw?.navigationSections || raw?.NAVIGATION_SECTIONS || raw?.sections || raw?.navSections || raw?.default || raw;
  const arr = Array.isArray(candidate) ? candidate : [];
  return arr.map((section) => ({
    id: section.id || (section.title || section.label || section.name || 'Section').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: section.title || section.label || section.name || 'Section',
    icon: section.icon || '',
    items: Array.isArray(section.items) ? section.items.map((item) => ({
      label: item.label || item.title || item.name || item.path || 'Page',
      path: item.path || item.href || item.to || '/',
      icon: item.icon || '',
    })) : [],
  })).filter((section) => section.items.length);
}

const fallbackNav = [
  { title: 'Dashboard', items: [{ label: 'Home', path: '/' }, { label: 'Command Center', path: '/command-center' }] },
  { title: 'Inventory', items: [
    { label: 'Inventory Overview', path: '/inventory/blanks' },
    { label: 'Add Item to Bin', path: '/add-item' },
    { label: 'Edit Blank Items', path: '/inventory/edit-blanks' },
    { label: 'Bins', path: '/bins' },
    { label: 'Bins', path: '/bins' },
    { label: 'Inventory Audit', path: '/inventory-audit' },
    { label: 'Product Data Health', path: '/product-data-health' },
  ]},
  { title: 'Production', items: [
    { label: 'Pull Sheets', path: '/pullsheets' },
    { label: 'Production Board', path: '/production-board' },
    { label: 'QC Checklist', path: '/qc-checklist' },
    { label: 'Production Calendar', path: '/production-calendar' },
    { label: 'Capacity Planning', path: '/capacity-planning' },
  ]},
  { title: 'Purchasing', items: [
    { label: 'Purchase Orders', path: '/purchase-orders' },
    { label: 'Recommended Orders', path: '/purchase-orders/new' },
    { label: 'Waiting On', path: '/waiting-on' },
  ]},
  { title: 'Sales & Customers', items: [
    { label: 'Manual Orders', path: '/manual-orders' },
    { label: 'Pricing Rules', path: '/pricing-rules' },
    { label: 'Customer Portal Preview', path: '/customer-portal-preview' },
    { label: 'Artwork Bridge', path: '/artwork-bridge' },
  ]},
  { title: 'Tools', items: [
    { label: 'Labels', path: '/labels' },
    { label: 'Mapping Repair', path: '/mapping-repair' },
    { label: 'Product-to-Blank Mappings', path: '/product-blank-mappings' },
    { label: 'Testing Mode', path: '/testing-mode' },
    { label: 'Google Calendar', path: '/google-calendar' },
    { label: 'Theme Settings', path: '/theme-settings' },
  ]},
];


// Daily work is organized by user intent; specialist tools stay available in Advanced mode.
const SIMPLE_NAV = [
  {id:'daily-work',title:'Start Here',icon:'🏠',items:[
    {label:'Work Hub — My Orders',path:'/work-hub'},
    {label:'Orders Needing Attention',path:'/exception-center'},
    {label:'Print an Order',path:'/print-center'},
  ]},
  {id:'orders-simple',title:'Orders',icon:'🧾',items:[
    {label:'Production Queue',path:'/production-board'},
    {label:'New Manual Order',path:'/manual-orders'},
    {label:'Customer Order Requests',path:'/client-orders'},
    {label:'Order Calendar',path:'/operations-calendar'},
  ]},
  {id:'products-simple',title:'Products & Setup',icon:'📦',items:[
    {label:'Product Setup & Readiness · Start Here',path:'/catalog-production-readiness'},
    {label:'Map Existing Woo Artwork',path:'/woo-artwork-mapping'},
    {label:'Production Instructions',path:'/manufacturing-recipes'},
    {label:'Product Catalog',path:'/catalog-workbench'},
  ]},
  {id:'artwork-simple',title:'Artwork & Approval',icon:'🎨',items:[
    {label:'Client Graphics',path:'/client-graphics'},
    {label:'Artwork Requests',path:'/artwork-requests'},
    {label:'Mockups',path:'/mockup-studio'},
    {label:'Order Artwork',path:'/order-graphics'},
  ]},
  {id:'fulfillment-simple',title:'Production & Delivery',icon:'🏭',items:[
    {label:'Pull Sheets & Inventory',path:'/pullsheets'},
    {label:'Buy Missing Blanks',path:'/purchasing'},
    {label:'Receive Blanks',path:'/add-item'},
    {label:'Production Work Orders',path:'/production-travelers'},
    {label:'Quality Check',path:'/qc-checklist'},
  ]},
  {id:'growth-simple',title:'Customers & Growth',icon:'👥',items:[
    {label:'Marketing & Customers',path:'/marketing'},
    {label:'Quotes',path:'/quote-builder'},
    {label:'Team Stores',path:'/team-stores'},
  ]},
  {id:'admin-simple',title:'Help & Settings',icon:'⚙️',items:[
    {label:'Application Guide',path:'/application-guide'},
    {label:'Equipment & Remote Access',path:'/equipment-center'},
    {label:'Device & Product Library',path:'/device-product-library'},
    {label:'Menu Manager',path:'/menu-manager'},
    {label:'User Management',path:'/user-management'},
    {label:'Advanced Diagnostics',path:'/deployment-health'},
  ]},
];

export default function AppShell({ children }) {
  const employeeAccess=useContext(EmployeeAccessContext);
  const location = useLocation();
  const returnJob = new URLSearchParams(location.search).get('returnJob');
  const returnJobId = /^[1-9][0-9]*$/.test(returnJob||'') ? returnJob : null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [advancedNav, setAdvancedNav] = useState(() => { try { return window.localStorage.getItem('sc_navigation_advanced_v1') === 'true'; } catch { return false; } });
  const toggleAdvancedNav = () => setAdvancedNav(current => { const next = !current; try { window.localStorage.setItem('sc_navigation_advanced_v1', String(next)); } catch { /* optional preference */ } return next; });
  const baseNav = useMemo(() => {
    const configured = normalizeNavigation(navConfig);
    return configured.length ? configured : fallbackNav;
  }, []);
  const [layout, setLayout] = useState(() => defaultNavigationLayout(baseNav));
  const [accountId, setAccountId] = useState('');
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const userId = data?.user?.id || '';
      setAccountId(userId);
      try {
        const saved = userId ? JSON.parse(window.localStorage.getItem(navigationStorageKey(userId)) || 'null') : null;
        setLayout(sanitizeNavigationLayout(baseNav, saved));
      } catch {
        setLayout(defaultNavigationLayout(baseNav));
      }
    });
    return () => { active = false; };
  }, [baseNav]);
  const updateLayout = (updater) => setLayout((current) => {
    const candidate = typeof updater === 'function' ? updater(current) : updater;
    const safe = sanitizeNavigationLayout(baseNav, candidate);
    if (accountId) {
      try { window.localStorage.setItem(navigationStorageKey(accountId), JSON.stringify(safe)); } catch { /* private browser mode */ }
    }
    return safe;
  });
  const resetLayout = () => {
    if (accountId) {
      try { window.localStorage.removeItem(navigationStorageKey(accountId)); } catch { /* storage restricted */ }
    }
    setLayout(defaultNavigationLayout(baseNav));
  };
  const nav = useMemo(() => {
    const result=materializeNavigation(baseNav, layout);
    return employeeAccess?.role==='marketing' ? result.map(s=>({...s,items:s.items.filter(i=>marketingPaths.has(i.path))})).filter(s=>s.items.length) : result;
  }, [baseNav, layout, employeeAccess?.role]);

  const visibleNav = employeeAccess?.role === 'marketing' ? nav : advancedNav ? nav : SIMPLE_NAV;
  const allItems = nav.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title })));
  const filtered = search.trim()
    ? allItems.filter((item) => `${item.label} ${item.section}`.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : [];

  useEffect(() => {
    setDrawerOpen(false);
    setSearch('');
  }, [location.pathname]);

  const sidebar = (
    <aside className="sc-sidebar" aria-label="Main navigation">
      <Link to="/" className="sc-sidebar-brand">
        <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <span>Skilled Crafting</span>
      </Link>
      <div style={{padding:"8px 16px"}}><button type="button" onClick={toggleAdvancedNav} aria-pressed={advancedNav} style={{width:"100%",cursor:"pointer"}}>{advancedNav ? "✓ Advanced tools · Show simple menu" : "Simple menu · Show all tools"}</button></div>
      <nav className="sc-sidebar-nav">
        {visibleNav.map((section) => (
          <details className="sc-nav-section" key={`${section.id}-${location.pathname}`} open={section.items.some((item) => item.path === location.pathname)}>
            <summary className="sc-nav-section-title">{section.icon ? `${section.icon} ` : ''}{section.title} <small>({section.items.length})</small></summary>
            {section.items.map((item) => (
              <NavLink
                key={`${section.title}-${item.path}-${item.label}`}
                to={item.path}
                className={({ isActive }) => `sc-nav-link ${isActive ? 'active' : ''}`}
              >
                <span>{item.icon || '•'}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </details>
        ))}
      </nav>
    </aside>
  );

  return (
    <NavigationContext.Provider value={{ layout, updateLayout, resetLayout, baseNav }}>
    <div className="sc-app-shell">
      <GuidedTrainingOverlay />
      <div className="sc-desktop-sidebar">{sidebar}</div>
      {drawerOpen && <div className="sc-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
      <div className={`sc-mobile-drawer ${drawerOpen ? 'open' : ''}`}>{sidebar}</div>

      <div className="sc-main-shell">
        <header className="sc-topbar sc-topbar-polished">
          <div className="sc-topbar-left">
            <button className="sc-icon-button sc-mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">☰</button>
            <div className="sc-topbar-title-block">
              <div className="sc-kicker">Skilled Crafting</div>
              <h1>{location.pathname === '/' ? 'Operations Home' : allItems.find((i) => i.path === location.pathname)?.label || 'Operations'}</h1>
              <p>Orders → Artwork → Inventory → Production → Delivery</p>
            </div>
          </div>
          <div className="sc-topbar-actions">
            <div className="sc-command-search sc-command-search-polished">
              <span aria-hidden="true" className="sc-search-icon">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools and pages..."
                aria-label="Search tools and pages"
              />
              {filtered.length > 0 && (
                <div className="sc-command-results">
                  {filtered.map((item) => (
                    <Link key={`${item.section}-${item.path}`} to={item.path}>
                      <strong>{item.label}</strong>
                      <small>{item.section}</small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link className="sc-theme-settings-link" to="/menu-manager" aria-label="Customize left navigation">☷ Menu</Link>
            <Link className="sc-theme-settings-link" to="/theme-settings" aria-label="Open visual theme settings">
              <span aria-hidden="true">🎨</span>
              <span>Themes</span>
            </Link>
            <DarkModeToggle />
          </div>
        </header>
        <main className="sc-page-shell">{returnJobId&&location.pathname!=='/work-hub'&&<div role="navigation" aria-label="Return to current Work Hub job" style={{padding:'10px 16px',marginBottom:12,background:'var(--sc-surface,#f0f5fa)',border:'1px solid var(--sc-border,#ccd7e3)',borderRadius:10}}><Link to={'/work-hub?job='+returnJobId} style={{fontWeight:700}}>← Return to Work Hub · Job #{returnJobId}</Link></div>}{children}</main>
        <footer aria-label="Legal information" style={{ marginTop: 'auto', padding: '16px 24px 24px', display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--sc-muted)' }}>
          <a href="/privacy-policy.html" style={{ textDecoration: 'underline' }}>Privacy Policy</a>
          <a href="/eula.html" style={{ textDecoration: 'underline' }}>End User License Agreement</a>
          <a href="https://skilledcrafting.com/policies/" style={{ textDecoration: 'underline' }}>Order Policies</a>
        </footer>
      </div>
    </div>
    </NavigationContext.Provider>
  );
}
