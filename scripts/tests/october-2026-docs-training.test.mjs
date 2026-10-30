import test from 'node:test';
import assert from 'node:assert/strict';
import {guideChapters,GUIDE_VERSION} from '../../src/application-guide/guideData.js';
import {trainingTutorials,TRAINING_VERSION,trainingRoles} from '../../src/application-guide/trainingData.js';
import {october2026GuideChapters} from '../../src/application-guide/october2026Guide.js';
import {october2026Tutorials} from '../../src/application-guide/october2026Training.js';
import {navSections} from '../../src/navigationConfig.js';

test('new technical guide has distinct IDs, valid navigation, scenarios and safe steps',()=>{
 assert.equal(GUIDE_VERSION,'2.0.0');
 const routes=new Set(navSections.flatMap(s=>s.items.map(x=>x.path)));
 assert(navSections.flatMap(s=>s.items).length>=104);
 assert(october2026GuideChapters.length>=10);
 const ids=new Set();
 let scenarios=0;
 for(const chapter of october2026GuideChapters){
  assert(chapter.description.length>35);
  for(const item of chapter.sections){
   assert(!ids.has(item.id),'duplicate topic: '+item.id);ids.add(item.id);
   assert(item.summary.length>30);
   assert(item.steps?.length>=2,'short topic: '+item.id);
   if(item.scenario)scenarios++;
   for(const route of item.relatedRoutes||[])assert(routes.has(route),'route no longer exists: '+route);
  }
 }
 assert(scenarios>=12);
 assert(guideChapters.some(x=>x.id==='oct-scenarios'));
});

test('updated employee lessons cover major integrations with real verification boundaries',()=>{
 assert.equal(TRAINING_VERSION,'2.0.0');
 assert(october2026Tutorials.length>=10);
 const roleIds=new Set(trainingRoles.map(x=>x.id));
 const ids=trainingTutorials.map(x=>x.id);
 assert.equal(ids.length,new Set(ids).size,'duplicate lesson IDs');
 for(const course of october2026Tutorials){
  assert(course.safeMode==='guided-read-only');
  assert(course.outcome.length>35);
  assert(course.steps.length>=4);
  assert(course.roles.every(role=>roleIds.has(role)));
  assert(course.steps.every(s=>s.title&&s.instruction));
 }
});
