import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProspectResponse,prospectResponseFormat} from '../../netlify/functions/_shared/marketingProspectResponse.js';

const prospect={name:'Sample Team',website:'https://public-club.example.org',location:'Washington',reason:'Official club site'};
const response=(text)=>({status:'completed',output:[
 {type:'web_search_call',status:'completed'},
 {type:'message',content:[{type:'output_text',text}]}
]});

test('API format requires a schema-conforming prospects object',()=>{
 assert.equal(prospectResponseFormat.type,'json_schema');
 assert.equal(prospectResponseFormat.strict,true);
 assert.equal(prospectResponseFormat.schema.type,'object');
 assert.equal(prospectResponseFormat.schema.additionalProperties,false);
 assert.deepEqual(prospectResponseFormat.schema.required,['prospects']);
 assert.deepEqual(prospectResponseFormat.schema.properties.prospects.items.required,['name','website','location','reason']);
});

test('parses schema output after the web search call',()=>{
 assert.deepEqual(parseProspectResponse(response(JSON.stringify({prospects:[prospect]}))),{ok:true,code:'ok',rows:[prospect]});
});

test('keeps legacy array-shaped output support',()=>{
 assert.deepEqual(parseProspectResponse(response(JSON.stringify([prospect]))).rows,[prospect]);
});

test('treats an empty prospect list as a valid search result',()=>{
 assert.deepEqual(parseProspectResponse(response('{"prospects":[]}')),{ok:true,code:'ok',rows:[]});
});

test('rejects markdown-wrapped or unstructured output',()=>{
 assert.equal(parseProspectResponse(response('```json\n{"prospects":[]}\n```')).code,'invalid_json');
 assert.equal(parseProspectResponse(response('{"different":[]}')).code,'invalid_shape');
});

test('identifies incomplete and missing responses without exposing results',()=>{
 assert.equal(parseProspectResponse({...response('{"prospects":['),status:'incomplete'}).code,'incomplete');
 assert.equal(parseProspectResponse({status:'completed',output:[]}).code,'empty_output');
});

test('supports the optional SDK convenience output field',()=>{
 assert.equal(parseProspectResponse({status:'completed',output_text:'{"prospects":[]}'}).ok,true);
});
