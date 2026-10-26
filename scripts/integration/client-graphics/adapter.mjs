// Test-only Supabase query adapter over real isolated PostgreSQL. Not PostgREST.
export function adapter(db,{fail}={}){
 const q=s=>{if(!/^[a-z_][a-z0-9_]*$/i.test(s))throw Error('Invalid test identifier');return '"'+s+'"'};
 return {from(table){const state={table,op:'select',columns:'*',filters:[],values:null,returning:false};
 const chain={select(columns='*'){state.columns=columns;if(state.op!=='select')state.returning=true;return chain},eq(k,v){state.filters.push([k,'=',v]);return chain},in(k,v){state.filters.push([k,'in',v]);return chain},order(k,{ascending=true}={}){state.order=[k,ascending];return chain},limit(n){state.limit=n;return chain},or(expression){state.or=expression;return chain},insert(values){state.op='insert';state.values=values;return chain},update(values){state.op='update';state.values=values;return chain},upsert(values,options){state.op='upsert';state.values=values;state.conflict=options.onConflict;return chain},single(){return run(true)},maybeSingle(){return run(true,true)},then(resolve,reject){return run().then(resolve,reject)}};
 async function run(single=false,maybe=false){try{
  if(fail?.(state))return {data:null,error:{message:'Injected transient database error'}};
  const args=[];const val=v=>{args.push(v);return '$'+args.length};
  const where=state.filters.map(([k,op,v])=>op==='in'?q(k)+' in ('+v.map(val).join(',')+')':q(k)+'='+val(v));
  if(state.or){const m=state.or.match(/^job_item_id\.in\.\(([0-9,]+)\)(?:,and\(source\.eq\.woocommerce,external_order_id\.eq\.([0-9]+)\))?$/);if(!m)throw Error('Unsupported fixture OR query');where.push('('+q('job_item_id')+' in ('+m[1].split(',').map(Number).map(val).join(',')+')'+(m[2]?' or ('+q('source')+'='+val('woocommerce')+' and '+q('external_order_id')+'='+val(m[2])+')':'')+')')}
  const suffix=where.length?' where '+where.join(' and '):'';let sql;
  const columns=state.columns==='*'?'*':state.columns.split(',').map(k=>q(k.trim())).join(',');
  if(state.op==='select')sql='select '+columns+' from '+q(table)+suffix+(state.order?' order by '+q(state.order[0])+(state.order[1]?' asc':' desc'):'')+(state.limit?' limit '+Number(state.limit):'');
  else if(state.op==='update')sql='update '+q(table)+' set '+Object.entries(state.values).map(([k,v])=>q(k)+'='+val(v)).join(',')+suffix+' returning *';
  else{const values=state.values;const keys=Object.keys(values);sql='insert into '+q(table)+' ('+keys.map(q).join(',')+') values ('+keys.map(k=>val(values[k])).join(',')+')';if(state.op==='upsert')sql+=' on conflict ('+state.conflict.split(',').map(q).join(',')+') do update set '+keys.filter(k=>!state.conflict.split(',').includes(k)).map(k=>q(k)+'=excluded.'+q(k)).join(',');sql+=' returning *'}
  // UPDATE arguments need the SET values ahead of WHERE parameters; numbered placeholders preserve their order.
  const {rows}=await db.query(sql,args);if(single){if(rows.length===0&&maybe)return {data:null,error:null};if(rows.length!==1)return {data:null,error:{message:'Expected one row'}};return {data:rows[0],error:null}}return {data:rows,error:null};
 }catch(e){return {data:null,error:{message:e.message,code:e.code}}}}
 return chain}};
}
