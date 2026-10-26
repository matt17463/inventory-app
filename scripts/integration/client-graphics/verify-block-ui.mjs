import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../../../wordpress/skilled-crafting-graphic-choices/assets/graphic-block.js',import.meta.url),'utf8');
function fixture({selected='',nonce='fixture-nonce',status=200}={}){
 let clicked,request,events=[];
 const select={value:selected,focus(){this.focused=true}};
 const button={disabled:false,addEventListener(name,cb){assert.equal(name,'click');clicked=cb}};
 const msg={textContent:''};
 const root={dataset:{productId:'700',storeNonce:nonce,apiUrl:'/wp-json/wc/store/v1/cart/add-item'},querySelector(q){
  return {'[data-sc-graphic-choice]':select,'[data-sc-graphic-submit]':button,'[data-sc-graphic-message]':msg}[q];
 }};
 class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;this.bubbles=options.bubbles}}
 const context={document:{querySelectorAll:()=>[root],body:{dispatchEvent(e){events.push(e)}}},
  CustomEvent,fetch:async(url,opts)=>{request={url,opts};return {ok:status>=200&&status<300,json:async()=>status===200?{items:[]}:{message:'Rejected by cart'}}}};
 vm.runInNewContext(source,context);
 return {select,button,msg,events,click:async()=>clicked(),request:()=>request};
}
test('requires exact graphic selection before Store API call',async()=>{
 const ui=fixture();await ui.click();assert.equal(ui.request(),undefined);assert.match(ui.msg.textContent,/Choose a graphic/);
});
test('uses Store API nonce and selected family ID without accepting label',async()=>{
 const ui=fixture({selected:'00000000-0000-4000-8000-000000000021'});
 await ui.click();const {url,opts}=ui.request();
 assert.equal(url,'/wp-json/wc/store/v1/cart/add-item');
 assert.equal(opts.headers.Nonce,'fixture-nonce');
 const body=JSON.parse(opts.body);
 assert.equal(body.id,700);assert.equal(body.quantity,1);
 assert.equal(body.sc_graphic_family_id,'00000000-0000-4000-8000-000000000021');
 assert.equal(body.sc_graphic_label,undefined);
 assert.equal(ui.events[0].type,'wc-blocks_added_to_cart');
 assert.equal(ui.button.disabled,false);
});
test('rejected request does not tell Blocks the item was added',async()=>{
 const ui=fixture({selected:'some-choice',status:409});
 await ui.click();assert.equal(ui.events.length,0);assert.match(ui.msg.textContent,/Rejected/);
});
test('missing nonce prevents submission',async()=>{
 const ui=fixture({selected:'some-choice',nonce:''});
 await ui.click();assert.equal(ui.request(),undefined);assert.match(ui.msg.textContent,/token/);
});
