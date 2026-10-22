// Pure validation shared by the secure training API and its regression tests.
// This module MUST NOT depend on any production database or browser context.
const clean=(value,max=120)=>String(value||'').trim().slice(0,max);
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const allowedReviewStates=new Set(['needs-review','in-progress','evidence-captured','blocked']);
export const allowedTargetTypes=new Set(['wordpress-plugin','conditional-dialog','application-route']);
export function validateSteps(input,total){
 if(!Array.isArray(input)||input.length>total||total<1||total>500)throw new Error('Invalid completed step count.');
 const indices=input.map(x=>Number(x));
 if(indices.some(x=>!Number.isInteger(x)||x<0||x>=total)||new Set(indices).size!==indices.length)
  throw new Error('Completed steps must be unique valid step indices.');
 return indices.sort((a,b)=>a-b);
}
export function validateReview(input){
 const targetType=clean(input?.targetType,40);
 const targetId=clean(input?.targetId,200);
 const state=clean(input?.reviewState,30);
 const evidence=clean(input?.evidenceReference,500);
 const note=clean(input?.reviewerNote,2000);
 if(!allowedTargetTypes.has(targetType)||!/^[a-zA-Z0-9_./-]{1,200}$/.test(targetId)||!allowedReviewStates.has(state))
  throw new Error('Unrecognized documentation QA target or triage status.');
 if(String(input?.reviewerNote||'').length>2000||String(input?.evidenceReference||'').length>500)
  throw new Error('QA notes are too long.');
 return {target_type:targetType,target_id:targetId,review_state:state,evidence_reference:evidence,reviewer_note:note};
}
export function certificationCurrent(progress,certificate,currentVersion){
 if(!progress||!certificate)return false;
 if(!progress.completed||progress.curriculum_version!==currentVersion||certificate.curriculum_version!==currentVersion)return false;
 return Date.parse(certificate.signed_off_at||'')>=Date.parse(progress.updated_at||'');
}
