// Coverage must not imply that source-detected JSX fields were audited in a
// browser. A verified control requires a real screen review and a source/QA record.
export const cleanKey=value=>String(value||'').toLowerCase()
 .replace(/[^a-z0-9]+/g,' ').trim();
export function documentationCoverage({screens=[],dialogs=[],plugins=[]}={}){
 const dialogIds=new Set(),invalid=[];
 for(const d of dialogs){
  if(!d.id||dialogIds.has(d.id))invalid.push('Duplicate or missing dialog ID: '+d.id);
  dialogIds.add(d.id);
  if(!d.route||!d.trigger||!d.fields?.length||!d.result||!d.status)
   invalid.push('Incomplete dialog description: '+d.id);
 }
 const routeRecords=screens.map(s=>{
  const related=dialogs.filter(d=>d.route===s.path);
  const sourceControls=s.controls||[];
  // A reviewed dialog documents its condition, not all controls on its page.
  return {path:s.path,title:s.title,section:s.section||'',
   sourceControls:sourceControls.length,conditionalCases:related.length,
   sourceReviewedCases:related.filter(d=>d.status==='source-reviewed'||d.status==='live-verified').length,
   liveVerifiedCases:related.filter(d=>d.status==='live-verified').length,
   status:related.length?'partial-conditional-reference':'source-inventory-only'};
 });
 const pluginsLive=plugins.filter(p=>p.reviewStatus==='live-verified');
 const pluginScreens=plugins.reduce((sum,p)=>sum+(p.adminScreens||[]).length+(p.publicScreens||[]).length,0);
 const pluginScreensVerified=plugins.reduce((sum,p)=>sum+[...(p.adminScreens||[]),...(p.publicScreens||[])].filter(x=>x.verified===true).length,0);
 return {
  generatedAt:new Date().toISOString(),
  routeCount:screens.length,
  sourceControlCount:screens.reduce((sum,s)=>sum+(s.controls?.length||0),0),
  dialogCount:dialogs.length,
  sourceReviewedDialogs:dialogs.filter(d=>d.status==='source-reviewed'||d.status==='live-verified').length,
  liveVerifiedDialogs:dialogs.filter(d=>d.status==='live-verified').length,
  pluginCount:plugins.length,
  pluginScreens,pluginScreensVerified,pluginsLive:pluginsLive.length,
  unverifiedPluginScreens:pluginScreens-pluginScreensVerified,
  invalid,
  routes:routeRecords,
  missingReview:routeRecords.filter(x=>x.status==='source-inventory-only'||x.liveVerifiedCases===0),
 };
}
