import test from 'node:test';
import assert from 'node:assert/strict';
import {backupReportPatch} from '../../netlify/functions/_shared/nasBackupReport.js';
const now = new Date('2026-10-24T22:00:00Z');
test('running and failed reports preserve previous successful backup and independent restore evidence', () => {
  const previous = {object_count: 42, bytes_stored: 5000, last_backup_at: '2026-10-23T22:00:00Z', last_restore_test_at: '2026-10-23T23:00:00Z'};
  for (const status of ['running', 'failed', 'configured']) {
    const patch = backupReportPatch({site:'business', status, object_count:0, bytes_stored:0, last_backup_at:null}, now);
    for (const key of Object.keys(previous)) assert.equal(Object.hasOwn(patch,key),false);
  }
});
test('agents cannot submit independent restore assertions, including null that would erase evidence', () => {
  for (const value of [null, '2026-10-24T22:00:00Z']) assert.throws(()=>backupReportPatch({site:'home',status:'running',last_restore_test_at:value},now),/cannot certify/);
});
test('successful copies require exact nonnegative totals and a real completion timestamp', () => {
  const input={site:'home',status:'success',object_count:12,bytes_stored:100,last_backup_at:'2026-10-24T21:59:00Z'};
  assert.equal(backupReportPatch(input,now).object_count,12);
  for(const bad of [null, '12', -1, NaN, 1.5, Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>backupReportPatch({...input,object_count:bad},now));
  for(const bad of [null,'invalid','2026-10-25T00:00:00Z']) assert.throws(()=>backupReportPatch({...input,last_backup_at:bad},now));
});

import {nasBackupStatus} from '../../src/lib/nasBackupStatus.js';
test('seed rows are not reports and stale or overdue backups need attention',()=>{
 assert.equal(nasBackupStatus({status:'unconfigured',reported_at:now.toISOString()},now.getTime()),'Unconfigured');
 const site={agent_version:'v2',status:'success',reported_at:'2026-10-24T21:00:00Z',last_backup_at:'2026-10-24T20:00:00Z'};
 assert.equal(nasBackupStatus(site,now.getTime()),'success');
 assert.equal(nasBackupStatus({...site,reported_at:'2026-10-17T22:00:00Z',last_backup_at:'2026-10-17T22:00:00Z'},now.getTime()),'success');
 assert.match(nasBackupStatus({...site,reported_at:'2026-10-15T20:00:00Z'},now.getTime()),/Stale/);
 assert.match(nasBackupStatus({...site,status:'running',last_backup_at:'2026-10-15T20:00:00Z'},now.getTime()),/overdue/);
 assert.match(nasBackupStatus({...site,last_backup_at:null},now.getTime()),/no successful/);
});
