// Server-only carrier interface. Never import into browser bundles.
const API='https://api.easypost.com/v2';
export function carrierConfig(){
 const test=String(process.env.SC_EASYPOST_TEST_KEY||'').trim();
 const live=String(process.env.SC_EASYPOST_PRODUCTION_KEY||'').trim();
 const mode=String(process.env.SC_EASYPOST_MODE||'test')==='production'?'production':'test';
 return {mode,enabled:mode==='test'?Boolean(test):Boolean(live),
  canBuy:mode==='test'||process.env.SC_EASYPOST_LIVE_BUY_ENABLED==='true',
  key:mode==='test'?test:live,
  maxCost:Number(process.env.SC_EASYPOST_MAX_LABEL_USD||'40')};
}
const limit=(value,max=140)=>String(value||'').trim().slice(0,max);
export function normalizeAddress(raw){
 const src=raw||{};
 const address={
  name:limit(src.name,100),company:limit(src.company,100),
  street1:limit(src.street1,100),street2:limit(src.street2,100),
  city:limit(src.city,80),state:limit(src.state,20).toUpperCase(),
  zip:limit(src.zip,12),country:'US',
  phone:limit(src.phone,32)
 };
 if(!address.name||!address.street1||!address.city||!address.state||!address.zip||!address.phone)
  throw Error('Shipping recipient needs name, street, city, state, ZIP and phone.');
 if(!/^[A-Z]{2}$/.test(address.state)||!/^\d{5}(?:-\d{4})?$/.test(address.zip))
  throw Error('First release supports US domestic addresses only (two-letter state and ZIP).');
 if(!/^[0-9+ ()-]{7,32}$/.test(address.phone))throw Error('Confirm the contact phone number.');
 return address;
}
export function shipFrom(){
 return normalizeAddress({
  name:process.env.SC_SHIP_FROM_NAME||'Skilled Crafting',
  company:process.env.SC_SHIP_FROM_COMPANY||'Skilled Crafting',
  street1:process.env.SC_SHIP_FROM_STREET1,
  street2:process.env.SC_SHIP_FROM_STREET2,
  city:process.env.SC_SHIP_FROM_CITY,
  state:process.env.SC_SHIP_FROM_STATE,
  zip:process.env.SC_SHIP_FROM_ZIP,
  phone:process.env.SC_SHIP_FROM_PHONE
 });
}
export function normalizeParcel(input){
 const src=input||{},out={};
 for(const prop of ['length','width','height']){
  const n=Number(src[prop]);
  if(!Number.isFinite(n)||n<=0||n>72)throw Error('Parcel '+prop+' must be 0–72 inches.');
  out[prop]=Number(n.toFixed(2));
 }
 const ounces=Number(src.weight);
 if(!Number.isFinite(ounces)||ounces<=0||ounces>2400)throw Error('Parcel weight must be 0–2400 ounces (150 lb).');
 out.weight=Number(ounces.toFixed(2));
 return out;
}
export function formatRates(shipment){
 const rates=(shipment?.rates||[]).filter(x=>x.id&&x.currency==='USD'&&Number.isFinite(Number(x.rate))&&Number(x.rate)>0)
  .map(x=>({id:String(x.id),carrier:String(x.carrier||''),service:String(x.service||''),
   amount:Number(Number(x.rate).toFixed(2)),currency:'USD',
   days:x.delivery_days??null,carrier_account_id:String(x.carrier_account_id||'')}));
 return rates.sort((a,b)=>a.amount-b.amount).slice(0,60);
}
export async function easypost(path,{method='GET',body,config=carrierConfig()}={}){
 if(!config.key)throw Error('EasyPost '+config.mode+' key is not configured in Netlify.');
 if(!/^\/(?:shipments|addresses)(?:\/[a-zA-Z0-9_-]+)?(?:\/(?:buy|label))?$/.test(path))
  throw Error('Invalid carrier endpoint.');
 const headers={'Authorization':'Basic '+Buffer.from(config.key+':').toString('base64'),
  'Accept':'application/json','Content-Type':'application/json'};
 const response=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(30000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){
  const err=result?.error;
  const reason=typeof err==='string'?err:err?.message||'Carrier rejected the request.';
  throw Error('EasyPost '+response.status+': '+limit(reason,300));
 }
 return result;
}
export async function verifyDestination(address,config=carrierConfig()){
 const result=await easypost('/addresses',{method:'POST',body:{address,verify_strict:true},config});
 if(result.verifications?.delivery?.success===false)throw Error('Destination address could not be delivered to. Check the location.');
 return result;
}
export async function quoteParcel({from,to,parcel,jobId,packageIndex},config=carrierConfig()){
 const shipment=await easypost('/shipments',{method:'POST',body:{
  shipment:{from_address:from,to_address:to,parcel,reference:'SC-JOB-'+jobId+'-PACKAGE-'+packageIndex,
   options:{label_format:'PDF'}},
 },config});
 if(!shipment.id||!/^shp_[\w-]+$/.test(shipment.id))throw Error('Carrier did not return a usable shipment ID.');
 const rates=formatRates(shipment);
 if(!rates.length)throw Error('Carrier returned no purchasable USD rates for this parcel.');
 return {id:shipment.id,rates,mode:shipment.mode};
}
export async function buyParcel(shipmentId,rateId,config=carrierConfig()){
 if(!/^shp_[\w-]+$/.test(shipmentId)||!/^rate_[\w-]+$/.test(rateId))throw Error('Invalid carrier shipment/rate selection.');
 return easypost('/shipments/'+shipmentId+'/buy',{method:'POST',body:{rate:{id:rateId}},config});
}
export async function fetchShipment(shipmentId,config=carrierConfig()){
 if(!/^shp_[\w-]+$/.test(shipmentId))throw Error('Invalid carrier shipment ID.');
 return easypost('/shipments/'+shipmentId,{config});
}
export function boughtDetails(s){
 const label=String(s?.postage_label?.label_url||'');
 const tracking=String(s?.tracking_code||'');
 if(!s?.selected_rate||!tracking||!/^https:\/\//i.test(label))return null;
 const rate=s.selected_rate;
 return {label_url:label,tracking_code:tracking,carrier:rate.carrier||'',service:rate.service||'',
  amount_usd:Number(rate.rate||0),carrier_account_id:rate.carrier_account_id||''};
}
