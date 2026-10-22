import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {documentationCoverage} from '../src/application-guide/documentationCoverage.js';
import {navSections} from '../src/navigationConfig.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const dialogs=read('src/application-guide/conditionalDialogs.json');
const wp=read('src/application-guide/wordpressPluginAudits.json');
const screens=navSections.flatMap(s=>s.items.map(i=>({section:s.label,path:i.path,title:i.label,controls:[]})));
const audit=documentationCoverage({screens,dialogs:dialogs.dialogs||[],plugins:wp.plugins||[]});
const failures=[...audit.invalid];
const known=new Set(['unverified','source-only','partial-live-review','live-verified']);
const seenPlugins=new Set();
for(const plugin of wp.plugins||[]){
 if(!plugin.slug||seenPlugins.has(plugin.slug))failures.push('Duplicate/missing WP plugin slug: '+plugin.slug);
 seenPlugins.add(plugin.slug);
 if(!known.has(plugin.reviewStatus))failures.push('Invalid WP audit status: '+plugin.slug);
 if(plugin.reviewStatus==='live-verified'){
  if(!plugin.installedVersion||plugin.activationStatus!=='active')
   failures.push('Live-verified plugin has no verified active version: '+plugin.slug);
  const records=[...(plugin.adminScreens||[]),...(plugin.publicScreens||[])];
  if(!records.length||!records.some(s=>s.verified===true))
   failures.push('Live-verified plugin lacks reviewed live screens: '+plugin.slug);
  if(!plugin.auditEvidence?.reviewedAt||!plugin.auditEvidence?.reviewedBy)
   failures.push('Live-verified plugin lacks reviewer/date evidence: '+plugin.slug);
 }
 for(const screen of [...(plugin.adminScreens||[]),...(plugin.publicScreens||[])]){
  if(screen.verified===true){
   if(!(screen.controls||[]).length)failures.push('Verified WP screen has no field/control audit: '+plugin.slug+'/'+screen.name);
   for(const control of screen.controls||[]){
    if(!control.label||!control.purpose||!control.effect)
     failures.push('Control lacks label, beginner purpose or effect: '+plugin.slug+'/'+screen.name);
   }
  }
  const screenshot=screen.screenshot;
  if(screenshot&&(!/^docs\/wordpress-audit\/sanitized\/[a-z0-9/_-]+\.(png|jpe?g|webp)$/i.test(screenshot)||
     !fs.existsSync(path.join(root,screenshot))))
   failures.push('Screenshot must exist in private sanitized documentation folder: '+plugin.slug+'/'+screen.name);
 }
}
if(wp.auditStatus==='complete'&&(wp.plugins||[]).length===0)
 failures.push('WordPress audit cannot be complete without a plugin inventory.');
if(wp.auditStatus==='complete'&&!(wp.lastAuditedAt))
 failures.push('WordPress complete audit must record lastAuditedAt.');
const summary={status:failures.length?'INVALID':'VALID WITH OPEN LIVE QA',
 dialogs:audit.dialogCount,liveVerifiedDialogs:audit.liveVerifiedDialogs,
 registeredWordPressPlugins:audit.pluginCount,liveVerifiedPlugins:audit.pluginsLive,
 screensAwaitingBrowserReview:audit.missingReview.length,
 incompleteWordPressAudit:wp.auditStatus!=='complete',failures};
process.stdout.write(JSON.stringify(summary,null,2)+'\n');
if(failures.length)process.exitCode=1;
