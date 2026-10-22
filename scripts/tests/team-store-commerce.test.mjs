import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileWooOrderLines,verifiedWooProduct} from '../../netlify/functions/_shared/teamStoreCommerce.js';
import {parseRosterCsv,rosterCsv} from '../../src/lib/teamStoreRoster.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const campaign={id:'a3d164c5-ccbf-442e-aa6f-f426ba96d1ff',fundraiser_model:'percent_of_eligible_sales',fundraiser_percent:10};
const products=[{woo_product_id:100}];
const paid={id:501,status:'processing',date_paid:'2026-10-20T18:00:00',date_created_gmt:'2026-10-20T17:00:00',
  line_items:[{id:12,product_id:100,quantity:3,total:'75.00'},{id:13,product_id:200,quantity:1,total:'60.00'}],refunds:[]};
test('paid Woo product lines accrue only matched campaign product sales, after discounts',()=>{
 const lines=reconcileWooOrderLines(paid,[],products,campaign);
 assert.equal(lines.length,1);
 assert.equal(lines[0].net_eligible_sales,75);
 assert.equal(lines[0].fundraiser_estimated,7.5);
 assert.equal(lines[0].woo_order_id,501);
});
test('unpaid Woo orders never accrue eligible sales or fundraiser amounts',()=>{
 const lines=reconcileWooOrderLines({...paid,status:'pending',date_paid:null},[],products,campaign);
 assert.equal(lines[0].net_eligible_sales,0);assert.equal(lines[0].fundraiser_estimated,0);
});
test('product line refunds reduce eligible sales and per-unit fundraisers',()=>{
 const order={...paid,refunds:[{id:21}]};
 const refund=[{amount:'25.00',line_items:[{quantity:-1,total:'-25.00',meta_data:[{key:'_refunded_item_id',value:12}]}]}];
 const result=reconcileWooOrderLines(order,refund,products,{...campaign,fundraiser_model:'fixed_per_eligible_item',fundraiser_flat_amount:4});
 assert.equal(result[0].refunded_quantity,1);
 assert.equal(result[0].net_eligible_sales,50);
 assert.equal(result[0].fundraiser_estimated,8);
});
test('ambiguous unmatched refunds are excluded rather than overstating fundraiser earnings',()=>{
 const order={...paid,refunds:[{id:21}]};
 const result=reconcileWooOrderLines(order,[{amount:'25',line_items:[]}],products,campaign);
 assert.equal(result[0].refund_requires_review,true);
 assert.equal(result[0].net_eligible_sales,0);
 assert.equal(result[0].fundraiser_estimated,0);
});
test('only same-origin published Woo products can be offered on public store',()=>{
 const input={id:100,name:'Custom Hoodie',price:'37.95',permalink:'https://skilledcrafting.com/product/hoodie',status:'publish',type:'variable',catalog_visibility:'visible'};
 assert.equal(verifiedWooProduct(input,'https://skilledcrafting.com').woo_product_id,100);
 assert.throws(()=>verifiedWooProduct({...input,permalink:'https://example.com/bad'},'https://skilledcrafting.com'),/configured HTTPS shop origin/);
 assert.throws(()=>verifiedWooProduct({...input,status:'draft'},'https://skilledcrafting.com'),/published/);
});
test('roster CSV preserves quoted names and exports safe fields',()=>{
 const rows=parseRosterCsv('recipient_name,jersey_number,garment_size,qty\n"Smith, Taylor",12,YL,2\n');
 assert.deepEqual(rows[0].recipient_name,'Smith, Taylor');
 assert.equal(rows[0].qty,2);
 assert.match(rosterCsv([{recipient_name:'=SUM(1,2)',qty:1}]),/'=SUM/);
});
test('separate recurring Woo and occasional QBO channels preserve original order conversion',()=>{
 const sql=read('../../supabase/migrations/202610220004_team_campaign_dual_channels.sql');
 const launch=read('../../src/TeamStoreLaunchpad.jsx');
 const group=read('../../src/GroupInvoiceWorkflow.jsx');
 const form=read('../../src/PublicClientOrderForm.jsx');
 const endpoint=read('../../netlify/functions/client-order-submit.js');
 assert.match(sql,/order_channel in \('woocommerce','quickbooks_invoice'\)/);
 assert.match(sql,/sc_group_campaign_requests/);
 assert.match(sql,/sc_client_order_requests_campaign_idx/);
 assert.match(launch,/GroupInvoiceWorkflow/);
 assert.match(launch,/TeamCampaignCommerce/);
 assert.match(launch,/QuickBooks invoic/i);
 assert.match(group,/\/client-orders/);
 assert.match(form,/campaign_code:campaignCode/);
 assert.match(endpoint,/source: campaign\?'group_invoice_order_form'/);
 assert.match(endpoint,/sc_team_store_workflows/);
});
test('public browsing cannot access admin campaign financial tables or payment processing',()=>{
 const sql=read('../../supabase/migrations/202610220003_team_store_commerce.sql');
 const publicApi=read('../../netlify/functions/team-store-public.js');
 const publicUi=read('../../src/PublicTeamStore.jsx');
 const admin=read('../../netlify/functions/team-store-admin.js');
 assert.match(sql,/revoke all[\s\S]*?from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant .* to anon;/i);
 assert.match(publicApi,/select\('woo_product_id,product_name,product_permalink,image_url,display_price,currency'\)/);
 assert.doesNotMatch(publicApi,/woo_order_id|contact_email|payment_token/);
 assert.match(publicUi,/WooCommerce/);
 assert.doesNotMatch(admin,/method:'PUT',body:\{status:'draft'\}/);
});
