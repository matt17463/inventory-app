// Scheduled official supplier-color image refresh for exact-matched blank products.
// Netlify scheduled functions cannot be invoked by public URL.
import { createServiceClient } from './_shared/security.js';
import { syncSupplierPhotoBatch } from './supplier-photo-sync.js';

export default async () => {
 const day=Math.floor(Date.now()/86400000);
 const cursor=(day*5)%100;
 try {
  const report=await syncSupplierPhotoBatch(createServiceClient(),{cursor,limit:5});
  console.info('Scheduled supplier photo enrichment',JSON.stringify({
   updated:report.updated,colorsMatched:report.colorsMatched,
   groupStart:cursor,totalEligibleGroups:report.totalEligibleGroups,
   unmatched:report.results.filter((item)=>item.error).map((item)=>item.brand+' '+item.style),
  }));
 } catch(error) {
  console.error('Scheduled supplier photo enrichment unavailable:',error.message);
  throw error;
 }
};
