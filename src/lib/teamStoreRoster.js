export const ROSTER_FIELDS=['recipient_name','jersey_number','garment_size','product_note','group_name','qty'];
export function parseRosterCsv(text, maxRows=500){
  const rows=[];let row=[],cell='',quote=false;
  const value=String(text||'').slice(0,300000);
  for(let i=0;i<value.length;i++){
    const c=value[i],next=value[i+1];
    if(c==='"'&&quote&&next==='"'){cell+='"';i++;}
    else if(c==='"')quote=!quote;
    else if(c===','&&!quote){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quote){
      if(c==='\r'&&next==='\n')i++;
      row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
      row=[];cell='';
    }else cell+=c;
  }
  row.push(cell);if(row.some(s=>s.trim()))rows.push(row);
  if(!rows.length)throw Error('The roster CSV is empty.');
  if(rows.length>maxRows+1)throw Error('Roster CSV exceeds the maximum of '+maxRows+' player rows.');
  const normalize=s=>String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
  const headers=rows[0].map(normalize);
  if(!headers.includes('recipient_name')&&!headers.includes('player')&&!headers.includes('name'))
    throw Error('Roster CSV needs a recipient_name column.');
  const indexFor=(aliases)=>headers.findIndex(h=>aliases.includes(h));
  const aliases={
    recipient_name:['recipient_name','player','player_name','name'],
    jersey_number:['jersey_number','number','jersey'],
    garment_size:['garment_size','size'],
    product_note:['product_note','product','item','garment'],
    group_name:['group_name','team','group','class'],
    qty:['qty','quantity'],
  };
  return rows.slice(1).map((cells,i)=>{
    const record=Object.fromEntries(ROSTER_FIELDS.map(key=>{
      const index=indexFor(aliases[key]);
      return [key,index<0?'':String(cells[index]||'').trim().slice(0,180)];
    }));
    record.qty=Number(record.qty||1);
    if(!Number.isSafeInteger(record.qty)||record.qty<1||record.qty>999)throw Error('Invalid quantity on roster row '+(i+2));
    if(!record.recipient_name)return null;
    return record;
  }).filter(Boolean);
}
export function rosterCsv(rows){
  const quote=value=>'"'+String(value??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\'$&')+'"';
  const fields=[...ROSTER_FIELDS,'packing_status','woo_order_id'];
  return [fields.join(','),...(rows||[]).map(row=>fields.map(key=>quote(row[key])).join(','))].join('\r\n');
}
