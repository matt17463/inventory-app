import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./scripts/e2e',testMatch:'dtf-studio.spec.mjs',timeout:90000,workers:1,retries:0,outputDir:'test-results/dtf',reporter:'list',use:{baseURL:'http://127.0.0.1:5178',browserName:'chromium',acceptDownloads:true},
 webServer:{command:'node scripts/start-dtf-test-server.mjs',url:'http://127.0.0.1:5178/__dtf-test',timeout:30000,reuseExistingServer:false,env:{VITE_SUPABASE_URL:'https://dtf-test.invalid',VITE_SUPABASE_ANON_KEY:'test-public-key'}},
 projects:['light','dark'].flatMap(colorScheme=>[{name:'desktop-'+colorScheme,use:{viewport:{width:1440,height:1050},colorScheme}},{name:'mobile-'+colorScheme,use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme}}])});
