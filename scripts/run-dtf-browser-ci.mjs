// CI runners already provide the required Linux libraries. Avoid --with-deps, which invokes\n// apt to download optional fonts and fails when Ubuntu package DNS is unavailable.\n// Playwright still installs its version-pinned Chromium binary for browser acceptance.
import {spawnSync} from 'node:child_process';
import process from 'node:process';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Linux'){
 console.log('DTF browser acceptance runs on the isolated GitHub Linux runner; use npm run test:dtf-browser to run explicitly.');
}else{
 for(const args of [['node_modules/playwright/cli.js','install','chromium'],['node_modules/@playwright/test/cli.js','test','--config','playwright.dtf.config.mjs']]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
 }
}
