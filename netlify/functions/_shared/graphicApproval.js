export function productionVariantIssues(variant){
 const issues=[];
 if(!Number.isFinite(Number(variant?.width_inches))||Number(variant?.width_inches)<=0||!Number.isFinite(Number(variant?.height_inches))||Number(variant?.height_inches)<=0)issues.push('Record the verified print width and height before production approval.');
 if(!String(variant?.process||'').trim()||['unspecified','unverified'].includes(String(variant.process).trim().toLowerCase()))issues.push('Select the verified decoration process before production approval.');
 return issues;
}
