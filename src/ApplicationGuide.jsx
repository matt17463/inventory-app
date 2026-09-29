import { useMemo, useState } from 'react';
import { PageHeader } from './components/UIPrimitives';
import { navSections } from './navigationConfig';
import {
  GUIDE_VERSION,
  guideChapters,
  guideSearchText,
} from './application-guide/guideData';
import './application-guide/ApplicationGuide.css';

const normalize = (value) => String(value || '').trim().toLowerCase();

const routeLabelMap = new Map(
  navSections.flatMap((navSection) =>
    navSection.items.map((item) => [item.path, `${navSection.label} → ${item.label}`])
  )
);

function GuideDetail({ chapter, item }) {
  return (
    <article className="sc-guide-detail" id={item.id}>
      <div className="sc-guide-detail-heading">
        <div>
          <p className="sc-guide-kicker">{chapter.title}</p>
          <h3>{item.title}</h3>
        </div>
        <a className="sc-guide-anchor" href={`#${item.id}`} aria-label={`Link to ${item.title}`}>
          #
        </a>
      </div>

      <p className="sc-guide-summary">{item.summary}</p>

      {item.useWhen?.length ? (
        <div className="sc-guide-block">
          <h4>Use this when</h4>
          <ul>
            {item.useWhen.map((value) => <li key={value}>{value}</li>)}
          </ul>
        </div>
      ) : null}

      {item.scenario ? (
        <div className="sc-guide-scenario">
          <strong>Skilled Crafting scenario</strong>
          <p>{item.scenario}</p>
        </div>
      ) : null}

      {item.steps?.length ? (
        <div className="sc-guide-block">
          <h4>How to use it</h4>
          <ol>
            {item.steps.map((value) => <li key={value}>{value}</li>)}
          </ol>
        </div>
      ) : null}

      {item.tips?.length ? (
        <div className="sc-guide-callout sc-guide-callout-info">
          <strong>Business-use notes</strong>
          <ul>
            {item.tips.map((value) => <li key={value}>{value}</li>)}
          </ul>
        </div>
      ) : null}

      {item.warnings?.length ? (
        <div className="sc-guide-callout sc-guide-callout-warning">
          <strong>Important cautions</strong>
          <ul>
            {item.warnings.map((value) => <li key={value}>{value}</li>)}
          </ul>
        </div>
      ) : null}

      {item.relatedRoutes?.length ? (
        <div className="sc-guide-related">
          <strong>Related application pages</strong>
          <div className="sc-guide-route-list">
            {item.relatedRoutes.map((route) => (
              <a key={route} href={route}>
                {routeLabelMap.get(route) || route}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ScreenReference() {
  return (
    <section className="sc-guide-chapter" id="screen-reference">
      <div className="sc-guide-chapter-heading">
        <div>
          <p className="sc-guide-kicker">REFERENCE</p>
          <h2>Complete Application Screen Reference</h2>
          <p>
            This list is generated from the same navigation configuration used by the application.
            It provides a current inventory of visible pages even when the detailed guide text has not
            yet been expanded for a newly added screen.
          </p>
        </div>
      </div>

      <div className="sc-guide-screen-grid">
        {navSections.map((navSection) => (
          <div className="sc-guide-screen-group" key={navSection.id}>
            <h3>{navSection.icon} {navSection.label}</h3>
            <ul>
              {navSection.items.map((item) => (
                <li key={item.path}>
                  <a href={item.path}>{item.label}</a>
                  {item.keywords ? <span>{item.keywords}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ApplicationGuide() {
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState('all');

  const filteredChapters = useMemo(() => {
    const search = normalize(query);

    return guideChapters
      .filter((chapter) => activeChapter === 'all' || chapter.id === activeChapter)
      .map((chapter) => {
        if (!search) return chapter;
        const chapterMatch = normalize(`${chapter.title} ${chapter.description}`).includes(search);
        const sections = chapter.sections.filter((item) =>
          chapterMatch || guideSearchText(chapter, item).includes(search)
        );
        return { ...chapter, sections };
      })
      .filter((chapter) => chapter.sections.length > 0);
  }, [activeChapter, query]);

  const resultCount = filteredChapters.reduce((sum, chapter) => sum + chapter.sections.length, 0);

  return (
    <main className="sc-page sc-guide-page">
      <PageHeader
        eyebrow="HELP, TRAINING & OPERATIONS"
        title="Skilled Crafting Application & Plugin Guide"
        description="Living operating manual for inventory, WooCommerce, purchasing, production, artwork, custom plugins, administration, troubleshooting, and real Skilled Crafting workflows."
      />

      <section className="sc-guide-hero">
        <div>
          <span className="sc-guide-version">Guide v{GUIDE_VERSION}</span>
          <h2>One source of truth for how the system works and how Skilled Crafting uses it.</h2>
          <p>
            Search by task, symptom, screen name, product type, or workflow. Each major section explains
            what the feature does, when to use it, and how it applies to actual work in the business.
          </p>
        </div>
        <div className="sc-guide-hero-stats">
          <div><strong>{guideChapters.length}</strong><span>guide chapters</span></div>
          <div><strong>{guideChapters.reduce((sum, chapter) => sum + chapter.sections.length, 0)}</strong><span>detailed topics</span></div>
          <div><strong>{navSections.reduce((sum, nav) => sum + nav.items.length, 0)}</strong><span>application screens referenced</span></div>
        </div>
      </section>

      <section className="sc-guide-tools" aria-label="Guide search and chapter filter">
        <label className="sc-guide-search">
          <span>Search the guide</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: wrong blank, receiving, R2, packing slip, on-site sales..."
          />
        </label>

        <label className="sc-guide-filter">
          <span>Chapter</span>
          <select value={activeChapter} onChange={(event) => setActiveChapter(event.target.value)}>
            <option value="all">All chapters</option>
            {guideChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
            ))}
          </select>
        </label>

        <div className="sc-guide-results" aria-live="polite">
          {resultCount} topic{resultCount === 1 ? '' : 's'} shown
        </div>
      </section>

      <div className="sc-guide-layout">
        <aside className="sc-guide-sidebar">
          <div className="sc-guide-sidebar-card">
            <strong>Guide chapters</strong>
            <a href="#guide-top" onClick={() => setActiveChapter('all')}>Overview</a>
            {guideChapters.map((chapter) => (
              <a
                key={chapter.id}
                href={`#${chapter.id}`}
                onClick={() => setActiveChapter('all')}
              >
                {chapter.title}
              </a>
            ))}
            <a href="#screen-reference">Application Screen Reference</a>
          </div>

          <div className="sc-guide-sidebar-card sc-guide-sidebar-help">
            <strong>Recommended starting points</strong>
            <a href="#daily-rhythm">Daily manager routine</a>
            <a href="#add-item">Receive inventory</a>
            <a href="#pull-sheets">Correct a pull sheet</a>
            <a href="#purchasing-report">Purchase shortages</a>
            <a href="#mockup-studio">Mockup Studio</a>
            <a href="#plugin-product-options">SC Product Options</a>
            <a href="#plugin-documents">Invoices / packing slips</a>
            <a href="#woo-invalid-json">Woo/API failures</a>
          </div>
        </aside>

        <div className="sc-guide-content" id="guide-top">
          {filteredChapters.length ? (
            filteredChapters.map((chapter) => (
              <section className="sc-guide-chapter" id={chapter.id} key={chapter.id}>
                <div className="sc-guide-chapter-heading">
                  <div>
                    <p className="sc-guide-kicker">CHAPTER</p>
                    <h2>{chapter.title}</h2>
                    <p>{chapter.description}</p>
                  </div>
                  <a className="sc-guide-anchor" href={`#${chapter.id}`} aria-label={`Link to ${chapter.title}`}>#</a>
                </div>

                <div className="sc-guide-topic-list">
                  {chapter.sections.map((item) => (
                    <GuideDetail chapter={chapter} item={item} key={item.id} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <section className="sc-guide-empty">
              <h2>No guide topics matched “{query}”.</h2>
              <p>Try a broader term such as inventory, mapping, artwork, purchasing, WooCommerce, or printing.</p>
              <button type="button" onClick={() => { setQuery(''); setActiveChapter('all'); }}>
                Clear search
              </button>
            </section>
          )}

          {!query && activeChapter === 'all' ? <ScreenReference /> : null}
        </div>
      </div>
    </main>
  );
}
