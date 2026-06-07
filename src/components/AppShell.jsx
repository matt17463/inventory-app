import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as navModule from '../navigationConfig';

const QUICK_ACTIONS = [
  { label: 'Scan', path: '/scan' },
  { label: 'Receive', path: '/add-item' },
  { label: 'Pull Sheets', path: '/pull-sheets' },
  { label: 'Command', path: '/command-center' },
];

function firstArrayExport(mod) {
  const candidates = [
    mod.navigationSections,
    mod.NAVIGATION_SECTIONS,
    mod.navSections,
    mod.sections,
    mod.default,
    mod.navigation,
    mod.navItems,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && Array.isArray(c.sections)) return c.sections;
    if (c && Array.isArray(c.navigationSections)) return c.navigationSections;
    if (c && Array.isArray(c.items)) return c.items;
  }
  return [];
}

function normalizePath(item) {
  return item?.path || item?.to || item?.href || item?.route || '#';
}

function normalizeLabel(item) {
  return item?.label || item?.name || item?.title || item?.text || 'Untitled';
}

function normalizeIcon(item) {
  return item?.icon || item?.emoji || '';
}

function normalizeSections(raw) {
  if (!Array.isArray(raw)) return [];

  const sections = raw.map((section, index) => {
    if (section?.items || section?.links || section?.children || section?.pages) {
      const items = section.items || section.links || section.children || section.pages || [];
      return {
        id: section.id || section.key || section.label || section.name || `section-${index}`,
        label: section.label || section.name || section.title || `Section ${index + 1}`,
        icon: normalizeIcon(section),
        items: Array.isArray(items)
          ? items.map((item, itemIndex) => ({
              id: item.id || item.key || item.label || item.name || `${index}-${itemIndex}`,
              label: normalizeLabel(item),
              path: normalizePath(item),
              icon: normalizeIcon(item),
            }))
          : [],
      };
    }

    return {
      id: section?.id || section?.key || `standalone-${index}`,
      label: index === 0 ? 'Main' : `Section ${index + 1}`,
      icon: '',
      items: [
        {
          id: section?.id || section?.key || section?.label || `${index}`,
          label: normalizeLabel(section),
          path: normalizePath(section),
          icon: normalizeIcon(section),
        },
      ],
    };
  });

  return sections.filter((section) => section.items.length > 0);
}

function flattenSections(sections) {
  return sections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
}

function isActivePath(currentPath, itemPath) {
  if (!itemPath || itemPath === '#') return false;
  if (itemPath === '/') return currentPath === '/';
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function ThemeButton() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('sc-theme-mode') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('sc-dark', dark);
    document.body.classList.toggle('sc-dark', dark);
    try {
      localStorage.setItem('sc-theme-mode', dark ? 'dark' : 'light');
    } catch {
      // ignore localStorage failures
    }
  }, [dark]);

  return (
    <button type="button" className="sc-shell-theme-button" onClick={() => setDark((v) => !v)}>
      {dark ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}

export default function AppShell({ children }) {
  const location = useLocation();
  const sections = useMemo(() => normalizeSections(firstArrayExport(navModule)), []);
  const allItems = useMemo(() => flattenSections(sections), [sections]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => {
    const initial = {};
    sections.forEach((section) => {
      initial[section.id] = true;
    });
    return initial;
  });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const filteredItems = query.trim()
    ? allItems.filter((item) => `${item.label} ${item.section}`.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <div className="sc-shell-root">
      {open && <button className="sc-shell-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <aside className={`sc-shell-sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sc-shell-brand">
          <div className="sc-shell-brand-mark">SC</div>
          <div>
            <div className="sc-shell-brand-title">Skilled Crafting</div>
            <div className="sc-shell-brand-subtitle">Operations App</div>
          </div>
        </div>

        <div className="sc-shell-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.path} to={action.path} className="sc-shell-quick-action">
              {action.label}
            </Link>
          ))}
        </div>

        <nav className="sc-shell-nav">
          {sections.map((section) => {
            const isExpanded = expanded[section.id] !== false;
            return (
              <div className="sc-shell-section" key={section.id}>
                <button
                  type="button"
                  className="sc-shell-section-button"
                  onClick={() => setExpanded((state) => ({ ...state, [section.id]: !isExpanded }))}
                >
                  <span>{section.icon ? `${section.icon} ` : ''}{section.label}</span>
                  <span>{isExpanded ? '▾' : '▸'}</span>
                </button>

                {isExpanded && (
                  <div className="sc-shell-section-items">
                    {section.items.map((item) => (
                      <Link
                        key={`${section.id}-${item.id}-${item.path}`}
                        to={item.path}
                        className={`sc-shell-nav-link ${isActivePath(location.pathname, item.path) ? 'is-active' : ''}`}
                      >
                        {item.icon && <span className="sc-shell-nav-icon">{item.icon}</span>}
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="sc-shell-main">
        <header className="sc-shell-topbar">
          <button type="button" className="sc-shell-menu-button" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>

          <div className="sc-shell-search-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sc-shell-search"
              placeholder="Search pages or actions..."
            />
            <span className="sc-shell-shortcut">Ctrl K</span>
            {filteredItems.length > 0 && (
              <div className="sc-shell-search-results">
                {filteredItems.slice(0, 12).map((item) => (
                  <Link key={`${item.section}-${item.path}-${item.label}`} to={item.path} className="sc-shell-search-result" onClick={() => setQuery('')}>
                    <span>{item.label}</span>
                    <small>{item.section}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <ThemeButton />
        </header>

        <main className="sc-shell-content">{children}</main>
      </div>
    </div>
  );
}
