import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './components/UIPrimitives';
import { navSections } from './navigationConfig';
import {
  GUIDE_VERSION,
  guideChapters,
  guideSearchText,
} from './application-guide/guideData';
import { TRAINING_VERSION, trainingRoles, trainingTutorials, tutorialsForRole } from './application-guide/trainingData';
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

const TRAINING_PROGRESS_KEY='sc_employee_training_progress_v1';

function loadTrainingProgress(){
  try{return JSON.parse(window.localStorage.getItem(TRAINING_PROGRESS_KEY)||'{}')||{};}catch{return {};}
}

function TrainingTutorial({tutorial,progress,onToggle}){
  const completedSteps=Object.values(progress?.steps||{}).filter(Boolean).length;
  const complete=Boolean(progress?.complete);
  return (
    <article className={`sc-training-tutorial ${complete?'complete':''}`} id={`training-${tutorial.id}`}>
      <div className="sc-training-title-row">
        <div>
          <div className="sc-training-badges"><span>{tutorial.level}</span><span>{tutorial.minutes} min</span><span>{tutorial.safeMode}</span></div>
          <h3>{tutorial.title}</h3>
          <p>{tutorial.summary}</p>
        </div>
        <div className="sc-training-progress-ring"><strong>{completedSteps}/{tutorial.steps.length}</strong><span>steps</span></div>
      </div>
      <div className="sc-training-outcome"><strong>Training goal</strong><p>{tutorial.outcome}</p></div>
      <ol className="sc-training-steps">
        {tutorial.steps.map((item,index)=>{
          const checked=Boolean(progress?.steps?.[index]);
          return <li key={item.title} className={checked?'done':''}>
            <label className="sc-training-step-check">
              <input type="checkbox" checked={checked} onChange={()=>onToggle(tutorial,index)} />
              <span><strong>Step {index+1}: {item.title}</strong><small>{item.instruction}</small></span>
            </label>
            {item.route&&<a className="sc-training-open" href={item.route}>Open this page →</a>}
            {item.verify&&<div className="sc-training-verify"><strong>Verify:</strong> {item.verify}</div>}
            {item.warning&&<div className="sc-training-warning"><strong>Stop / caution:</strong> {item.warning}</div>}
          </li>;
        })}
      </ol>
      {tutorial.coachNotes?.length?<div className="sc-training-coach"><strong>Trainer notes</strong><ul>{tutorial.coachNotes.map(note=><li key={note}>{note}</li>)}</ul></div>:null}
      <div className="sc-training-finish">
        <label><input type="checkbox" checked={complete} onChange={()=>onToggle(tutorial,'complete')} /><span>Trainer/employee confirms this tutorial is complete</span></label>
      </div>
    </article>
  );
}

function EmployeeTraining(){
  const [role,setRole]=useState('new-employee');
  const [progress,setProgress]=useState(loadTrainingProgress);
  const tutorials=useMemo(()=>tutorialsForRole(role),[role]);
  const completed=tutorials.filter(t=>progress[t.id]?.complete).length;
  const totalSteps=tutorials.reduce((sum,t)=>sum+t.steps.length,0);
  const checkedSteps=tutorials.reduce((sum,t)=>sum+Object.values(progress[t.id]?.steps||{}).filter(Boolean).length,0);

  useEffect(()=>{window.localStorage.setItem(TRAINING_PROGRESS_KEY,JSON.stringify(progress));},[progress]);

  function toggle(tutorial,index){
    setProgress(current=>{
      const record=current[tutorial.id]||{steps:{},complete:false};
      if(index==='complete') return {...current,[tutorial.id]:{...record,complete:!record.complete}};
      return {...current,[tutorial.id]:{...record,steps:{...record.steps,[index]:!record.steps?.[index]}}};
    });
  }

  function reset(){
    if(!window.confirm('Reset all training progress saved in this browser?')) return;
    setProgress({});
  }

  const selectedRole=trainingRoles.find(item=>item.id===role);
  return (
    <section className="sc-training-workspace" id="employee-training">
      <div className="sc-training-hero">
        <div><span className="sc-guide-version">Training v{TRAINING_VERSION}</span><h2>Employee Training Center</h2><p>Role-based, step-by-step instruction for employees who are new to Skilled Crafting. Use the checkboxes as an onboarding checklist. Progress is stored only in this browser.</p></div>
        <div className="sc-training-summary"><div><strong>{completed}/{tutorials.length}</strong><span>tutorials complete</span></div><div><strong>{checkedSteps}/{totalSteps}</strong><span>steps checked</span></div></div>
      </div>
      <div className="sc-training-safety">
        <strong>Training rule: when unsure, stop before changing data.</strong>
        <p>New employees should begin with read-only tutorials. Any tutorial marked supervised-live should be completed with a manager until the employee is signed off. Testing Mode only simulates writes on workflows that explicitly support simulation.</p>
        <div className="sc-guide-route-list"><a href="/testing-mode">Open Testing Mode</a><a href="#safety-rules">Read operational safety rules</a></div>
      </div>
      <div className="sc-training-role-picker">
        <div><strong>Choose the employee's role</strong><p>{selectedRole?.description}</p></div>
        <select value={role} onChange={e=>setRole(e.target.value)}>{trainingRoles.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select>
        <button type="button" className="secondary-button" onClick={reset}>Reset training progress</button>
      </div>
      <div className="sc-training-tutorial-list">{tutorials.map(tutorial=><TrainingTutorial key={tutorial.id} tutorial={tutorial} progress={progress[tutorial.id]} onToggle={toggle}/>)}</div>
      <section className="sc-training-signoff">
        <h3>Recommended employee sign-off</h3>
        <p>Before an employee works independently, have a manager observe one real task in each assigned core workflow and confirm that the employee can explain what data changes, how to verify success, and when to stop and escalate.</p>
      </section>
    </section>
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
  const [guideMode,setGuideMode]=useState('training');

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

      <section className="sc-guide-mode-switch" aria-label="Guide mode">
        <button type="button" className={guideMode==='training'?'active':''} onClick={()=>setGuideMode('training')}><strong>Employee Training</strong><span>Guided onboarding + checklists</span></button>
        <button type="button" className={guideMode==='reference'?'active':''} onClick={()=>setGuideMode('reference')}><strong>Owner / Manager Reference</strong><span>Full application operating manual</span></button>
      </section>

      {guideMode==='reference'&&<section className="sc-guide-tools" aria-label="Guide search and chapter filter">
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
      </section>}

      {guideMode==='training'?<EmployeeTraining/>:<div className="sc-guide-layout">
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
      </div>}
    </main>
  );
}
