// Isolated test-only routes. This plugin is absent from the production Vite configuration.
import {createServer} from 'vite';
const entryPath='/__dtf-test-entry.js',virtualId='\0dtf-ui-test';
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
import DTFPrepStudio from '/src/DTFPrepStudio.jsx';import{supabase}from'/src/supabaseClient.js';
supabase.auth.getSession=async()=>({data:{session:{access_token:'test-session'}}});
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(DTFPrepStudio)));`;
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;color-scheme:light dark}</style></head><body><div id="root"></div><script type="module" src="${entryPath}"></script></body></html>`;
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true},plugins:[{name:'isolated-dtf-test-route',resolveId(id){if(id===entryPath)return virtualId;},load(id){if(id===virtualId)return entry;},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!=='/__dtf-test')return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__dtf-test',html));});}}]});
await server.listen();console.log('Isolated DTF test server ready');
