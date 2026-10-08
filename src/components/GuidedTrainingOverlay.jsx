import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  advanceGuidedTraining,
  getGuidedTrainingSession,
  guidedProgramForRole,
  GUIDED_TRAINING_EVENT,
  stopGuidedTraining,
  trainingRoleLabel,
} from '../lib/guidedTraining';

function routePath(route=''){
  return String(route).split('#')[0].split('?')[0]||'/';
}

export default function GuidedTrainingOverlay(){
  const location=useLocation();
  const navigate=useNavigate();
  const [session,setSession]=useState(getGuidedTrainingSession());

  useEffect(()=>{
    const handler=(event)=>setSession(event.detail||getGuidedTrainingSession());
    window.addEventListener(GUIDED_TRAINING_EVENT,handler);
    return ()=>window.removeEventListener(GUIDED_TRAINING_EVENT,handler);
  },[]);

  const program=useMemo(()=>guidedProgramForRole(session.role||'new-employee'),[session.role]);
  const tutorial=program[session.tutorialIndex||0];
  const step=tutorial?.steps?.[session.stepIndex||0];

  useEffect(()=>{
    if(!session.active||!step) return undefined;
    const selector=step.target||'main h1, main h2, .page-hero h1, .sc-page-header h1';
    const target=document.querySelector(selector);
    if(!target) return undefined;
    target.classList.add('sc-guided-training-target');
    target.scrollIntoView({behavior:'smooth',block:'center'});
    return ()=>target.classList.remove('sc-guided-training-target');
  },[session.active,session.tutorialIndex,session.stepIndex,location.pathname,step]);

  if(!session.active||!tutorial||!step) return null;

  const expectedPath=routePath(step.route);
  const onExpectedPage=!step.route||location.pathname===expectedPath;
  const stepCount=tutorial.steps.length;
  const tutorialCount=program.length;
  const overallDone=(session.completed||[]).length;
  const overallTotal=program.reduce((sum,item)=>sum+item.steps.length,0);

  function goToStep(){
    if(!step.route) return;
    navigate(step.route);
  }

  function previous(){ setSession(advanceGuidedTraining(session,-1)); }
  function next(){ setSession(advanceGuidedTraining(session,1)); }
  function exit(){
    if(!window.confirm('Exit guided training? Your progress will stay saved in this browser.')) return;
    setSession(stopGuidedTraining({leaveTestingMode:true}));
  }

  return (
    <>
      <div className="sc-guided-training-bar">
        <strong>🎓 Guided Training</strong>
        <span>{trainingRoleLabel(session.role)}</span>
        <span>Test mode + simulated writes enabled</span>
        <span>{overallDone}/{overallTotal} steps</span>
        <button type="button" onClick={exit}>Exit training</button>
      </div>
      <aside className="sc-guided-training-coach" aria-live="polite">
        <div className="sc-guided-training-meta">
          <span>Module {Number(session.tutorialIndex||0)+1} of {tutorialCount}</span>
          <span>Step {Number(session.stepIndex||0)+1} of {stepCount}</span>
        </div>
        <h2>{tutorial.title}</h2>
        <h3>{step.title}</h3>
        <p>{step.instruction}</p>
        {step.verify&&<div className="sc-guided-training-verify"><strong>Before continuing:</strong> {step.verify}</div>}
        {step.warning&&<div className="sc-guided-training-warning"><strong>Important:</strong> {step.warning}</div>}
        {step.readOnly&&<div className="sc-guided-training-readonly"><strong>Training step:</strong> Explore this page without changing live data.</div>}
        {!onExpectedPage&&step.route&&(
          <button type="button" className="sc-guided-training-open" onClick={goToStep}>Open the page for this step →</button>
        )}
        <div className="sc-guided-training-actions">
          <button type="button" onClick={previous} disabled={(session.tutorialIndex||0)===0&&(session.stepIndex||0)===0}>← Back</button>
          <button type="button" className="primary-button" onClick={next}>{overallDone+1>=overallTotal?'Finish training':'I completed this step →'}</button>
        </div>
        <details>
          <summary>Why test mode is on</summary>
          <p>Guided training automatically enables Testing Mode, simulated writes, and extra confirmations. Only workflows that explicitly support simulation are guaranteed not to write. Steps marked read-only should be observed rather than submitted.</p>
        </details>
      </aside>
    </>
  );
}
