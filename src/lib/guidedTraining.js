import { navSections } from '../navigationConfig';
import { trainingRoles, tutorialsForRole } from '../application-guide/trainingData';
import { getTestingModeSettings, saveTestingModeSettings } from './testingMode';

const SESSION_KEY='sc_guided_training_session_v2';
const EVENT_NAME='sc-guided-training-change';

function emit(session){
  if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:session}));
  return session;
}

export function fullApplicationTour(){
  const steps=[];
  for(const section of navSections){
    steps.push({
      title:`${section.icon||'•'} ${section.label} section`,
      instruction:`This section groups the ${section.label.toLowerCase()} tools. The guided tour will open each page so you can see where it lives and what it is for.`,
      route:section.items[0]?.path||'/',
      verify:`You can locate the ${section.label} section in the left navigation.`,
      target:'.sc-sidebar-nav',
      readOnly:true,
    });
    for(const item of section.items){
      steps.push({
        title:item.label,
        instruction:`Open and identify the purpose of ${item.label}. Key concepts: ${item.keywords||'review the page title, controls, and status information'}.`,
        route:item.path,
        verify:`You can explain when you would use ${item.label} and where to find it again.`,
        target:'main h1, main h2, .page-hero h1, .sc-page-header h1',
        readOnly:true,
      });
    }
  }
  return {
    id:'full-application-tour',
    title:'Full Application Screen Tour',
    level:'Required',
    minutes:75,
    safeMode:'guided-read-only',
    summary:'A page-by-page tour of every employee-facing screen in the application.',
    outcome:'The employee can navigate the entire application and explain the purpose of each major screen.',
    steps,
  };
}

export function guidedProgramForRole(role='new-employee'){
  const roleTutorials=tutorialsForRole(role).map((tutorial)=>({
    ...tutorial,
    steps:(tutorial.steps||[]).map((trainingStep)=>({
      ...trainingStep,
      readOnly: trainingStep.readOnly
        || !['read-only','read-only-first','simulated-supported'].includes(tutorial.safeMode),
    })),
  }));
  return [...roleTutorials,fullApplicationTour()];
}

export function trainingRoleLabel(role){
  return trainingRoles.find(item=>item.id===role)?.label||'New Employee';
}

export function getGuidedTrainingSession(){
  if(typeof window==='undefined') return {active:false};
  try{
    const raw=window.localStorage.getItem(SESSION_KEY);
    return raw?JSON.parse(raw):{active:false};
  }catch{return {active:false};}
}

export function saveGuidedTrainingSession(session){
  if(typeof window==='undefined') return session;
  window.localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  return emit(session);
}

export function startGuidedTraining(role='new-employee'){
  const settings=getTestingModeSettings();
  saveTestingModeSettings({
    ...settings,
    enabled:true,
    simulateWrites:true,
    requireConfirmation:true,
    showBanner:true,
    guidedTraining:true,
    trainingRole:role,
  });
  return saveGuidedTrainingSession({
    active:true,
    role,
    tutorialIndex:0,
    stepIndex:0,
    completed:[],
    startedAt:new Date().toISOString(),
  });
}

export function stopGuidedTraining({leaveTestingMode=true}={}){
  const current=getGuidedTrainingSession();
  const next={...current,active:false,endedAt:new Date().toISOString()};
  saveGuidedTrainingSession(next);
  if(!leaveTestingMode){
    const settings=getTestingModeSettings();
    saveTestingModeSettings({...settings,guidedTraining:false});
  }
  return next;
}

export function advanceGuidedTraining(session,direction=1){
  const program=guidedProgramForRole(session.role);
  let tutorialIndex=Number(session.tutorialIndex||0);
  let stepIndex=Number(session.stepIndex||0);
  const currentTutorial=program[tutorialIndex];
  if(!currentTutorial) return saveGuidedTrainingSession({...session,active:false,completedAt:new Date().toISOString()});

  if(direction<0){
    if(stepIndex>0) stepIndex-=1;
    else if(tutorialIndex>0){tutorialIndex-=1;stepIndex=Math.max(0,program[tutorialIndex].steps.length-1);}
  }else{
    const key=`${currentTutorial.id}:${stepIndex}`;
    const completed=Array.from(new Set([...(session.completed||[]),key]));
    if(stepIndex<currentTutorial.steps.length-1) stepIndex+=1;
    else if(tutorialIndex<program.length-1){tutorialIndex+=1;stepIndex=0;}
    else return saveGuidedTrainingSession({...session,completed,active:false,completedAt:new Date().toISOString()});
    return saveGuidedTrainingSession({...session,completed,tutorialIndex,stepIndex});
  }
  return saveGuidedTrainingSession({...session,tutorialIndex,stepIndex});
}

export { EVENT_NAME as GUIDED_TRAINING_EVENT };
