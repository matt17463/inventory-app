// Isolated test-only route. This plugin is never part of the production Vite configuration.
import {createServer} from 'vite';
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif;color-scheme:light dark}</style></head><body><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';
import DTFPrepStudio from '/src/DTFPrepStudio.jsx';import{supabase}from'/src/supabaseClient.js';
supabase.auth.getSession=async()=>({data:{session:{access_token:'test-session'}}});
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(DTFPrepStudio)));
</script></body></html>`;
const server=await createServer({server:{host:'127.0.0.1',port:5178,strictPort:true},plugins:[{name:'isolated-dtf-test-route',configureServer(server){server.middlewares.use('/__dtf-test',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__dtf-test',html));});}}]});
await server.listen();console.log('Isolated DTF test server ready');
