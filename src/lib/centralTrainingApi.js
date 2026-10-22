import {authenticatedFunctionFetch} from './netlifyFunctionClient';

async function request(view,options){
 const query=view?'?view='+encodeURIComponent(view):'';
 const response=await authenticatedFunctionFetch('/.netlify/functions/training-certifications'+query,options);
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.success)throw new Error(data.error||'Training service is unavailable.');
 return data;
}
export const getMyTraining=()=>request('mine',{method:'GET'});
export const getTeamTraining=()=>request('team',{method:'GET'});
export const getDocumentationQa=()=>request('qa',{method:'GET'});
export const saveTrainingProgress=(tutorialId,completedSteps,completed)=>request('',{
 method:'POST',body:JSON.stringify({action:'progress',tutorialId,completedSteps,completed})});
export const certifyTraining=(employeeId,tutorialId,note)=>request('',{
 method:'POST',body:JSON.stringify({action:'certify',employeeId,tutorialId,note})});
export const saveDocumentationQa=(targetType,targetId,reviewState,evidenceReference,reviewerNote)=>request('',{
 method:'POST',body:JSON.stringify({action:'qa',targetType,targetId,reviewState,evidenceReference,reviewerNote})});
