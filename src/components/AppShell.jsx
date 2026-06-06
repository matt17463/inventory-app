import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { allNavigationItems, navSections, quickActions } from '../navigationConfig';

const STORAGE_KEY = 'sc_inventory_open_nav_sections_v1';

function getInitialOpenSections(pathname) {
  const activeSection = navSections.find((section) =>
    section.items.some((item) => item.path === pathname || (item.path !== '/' && pathname.startsWith(item.path + '/')))
  );

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) {
      return new Set([...saved, activeSection?.id].filter(Boolean));
    }
  } catch {
    // Ignore malformed localStorage.
  }

  return new Set(['dashboard', 'inventory', activeSection?.id].filter(Boolean));
}

function routeMatches(pathname, routePath) {
  if (routePath === '/') return pathname === '/';
  return pathname === routePath || pathname.startsWith(routePath + '/');
}

function SectionLink({ item, onNavigate }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      onClick={onNavigate}
      title={`${item.section || ''} ${item.label} ${item.keywords || ''}`}
    >
      <span>{item.label}</span>
    </NavLink>
  );
}

function SidebarContent({ openSections, toggleSection, onNavigate }) {
  const location = useLocation();

  return (
    <>
      <div className="sidebar-brand-block">
        <Link to="/" className="sidebar-brand" onClick={onNavigate}>
          <img src={logo} alt="Skilled Crafting" />
          <span>Skilled Crafting Inventory</span>
        </Link>
      </div>

      <div className="sidebar-quick-actions" aria-label="Quick actions">
        {quickActions.map((action) => (
          <Link key={action.path} to={action.path} className="sidebar-quick-action" onClick={onNavigate}>
            <span aria-hidden="true">{action.icon}</span>
            <span>{action.label}</span>
          </Link>
        ))}
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navSections.map((section) => {
          const isOpen = openSections.has(section.id);
          const isSectionActive = section.items.some((item) => routeMatches(location.pathname, item.path));
          return (
            <section key={section.id} className={`nav-section ${isSectionActive ? 'section-active' : ''}`}>
              <button type="button" className="nav-section-toggle" onClick={() => toggleSection(section.id)}>
                <span className="nav-section-label">
                  <span aria-hidden="true">{section.icon}</span>
                  <span>{section.label}</span>
                </span>
                <span className="nav-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="nav-section-links">
                  {section.items.map((item) => (
                    <SectionLink key={`${section.id}-${item.path}-${item.label}`} item={item} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </nav>
    </>
  );
}

function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allNavigationItems.slice(0, 12);
    const tokens = term.split(/[^a-z0-9]+/).filter(Boolean);

    return allNavigationItems
      .map((item) => {
        const haystack = `${item.label} ${item.section} ${item.keywords || ''} ${item.path}`.toLowerCase();
        const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : -2), 0);
        return { item, score };
      })
      .filter((entry) => entry.score > -tokens.length)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 20)
      .map((entry) => entry.item);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' && results[0]) {
        event.preventDefault();
        navigate(results[0].path);
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="command-overlay" role="presentation" onMouseDown={onClose}>
      <div className="command-dialog" role="dialog" aria-modal="true" aria-label="Search pages and actions" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search-row">
          <span aria-hidden="true">⌘</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages or actions..."
            aria-label="Search pages or actions"
          />
          <button type="button" onClick={onClose}>Esc</button>
        </div>
        <div className="command-results">
          {results.length === 0 ? (
            <p className="command-empty">No matching pages found.</p>
          ) : results.map((item) => (
            <button
              type="button"
              key={`${item.section}-${item.path}-${item.label}`}
              className="command-result"
              onClick={() => {
                navigate(item.path);
                onClose();
              }}
            >
              <span className="command-result-title">{item.label}</span>
              <span className="command-result-meta">{item.section} · {item.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => getInitialOpenSections(location.pathname));

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => routeMatches(location.pathname, item.path))
    );
    if (activeSection) {
      setOpenSections((previous) => new Set([...previous, activeSection.id]));
    }
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(openSections)));
  }, [openSections]);

  useEffect(() => {
    function handleKeyDown(event) {
      const isMacShortcut = event.metaKey && event.key.toLowerCase() === 'k';
      const isWindowsShortcut = event.ctrlKey && event.key.toLowerCase() === 'k';
      if (isMacShortcut || isWindowsShortcut) {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function toggleSection(sectionId) {
    setOpenSections((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const currentPage = allNavigationItems.find((item) => routeMatches(location.pathname, item.path));

  return (
    <div className="responsive-app-shell">
      <aside className="desktop-sidebar">
        <SidebarContent openSections={openSections} toggleSection={toggleSection} onNavigate={() => {}} />
      </aside>

      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} role="presentation" onClick={() => setDrawerOpen(false)} />
      <aside className={`mobile-drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <SidebarContent openSections={openSections} toggleSection={toggleSection} onNavigate={() => setDrawerOpen(false)} />
      </aside>

      <div className="main-workspace">
        <header className="workspace-topbar">
          <button type="button" className="hamburger-button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu">
            ☰
          </button>
          <div className="workspace-title-group">
            <span className="workspace-eyebrow">{currentPage?.section || 'Skilled Crafting'}</span>
            <strong>{currentPage?.label || 'Inventory Dashboard'}</strong>
          </div>
          <button type="button" className="command-button" onClick={() => setCommandOpen(true)}>
            <span>Search pages/actions</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>

        <main className="workspace-content">
          {children}
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
