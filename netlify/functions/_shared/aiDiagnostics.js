// Never relay upstream messages, request bodies, headers or credentials.
export async function aiFailure(response, label='AI request') {
 let code='';
 try {
  const data=await response.json();
  const allowed=new Set(['invalid_api_key','insufficient_quota','rate_limit_exceeded',
   'model_not_found','unsupported_parameter','unsupported_value','invalid_value',
   'invalid_json_schema','permission_denied','invalid_request_error']);
  if(allowed.has(data?.error?.code))code=data.error.code;
 }catch { /* The upstream may return HTML or an empty body. */ }
 const guidance=response.status===401?'Check the server-side API credential.':
  response.status===403?'Check API project and model permissions.':
  response.status===429?(code==='insufficient_quota'?'Check API billing and available credit.':'API usage limit reached; retry later.'):
  response.status===400?'Check the configured model, endpoint and request format.':
  response.status===404?'Check configured model availability.':
  response.status>=500?'OpenAI service error; retry later.':'Check API project access.';
 return `${label} failed (OpenAI HTTP ${response.status}${code?'; '+code:''}). ${guidance}`;
}

export async function saveDiscoverySources(db, rows) {
 if(!rows.length)throw Error('Candidate has no research source records.');
 const result=await db.from('sc_pdc_sources').insert(rows);
 if(result.error)throw Error('Discovery source records could not be saved. Check the function log and source table constraints.');
}
