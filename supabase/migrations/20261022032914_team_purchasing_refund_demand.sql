-- Correct informational team demand; no orders, inventory or purchasing records are mutated.
create or replace function public.sc_team_campaign_purchasing(p_campaign_id uuid)
returns table(blank_product_id uuid, sku text, style text, brand text, color text,
 size text, open_job_lines bigint, open_units numeric, catalog_available numeric,
 purchasing_note text)
language plpgsql security definer set search_path = ''
as $fn$
begin
 if not public.sc_internal_access_allowed(array['admin','manager','operator','marketing']) then
  raise exception 'Production purchasing permission required' using errcode='42501';
 end if;
 return query
 with campaign as (
  select id,order_channel from public.sc_team_store_workflows where id=p_campaign_id
 ), eligible_items as (
  select i.*,j.woocommerce_order_id
  from public.job_items i join public.jobs j on j.id=i.job_id
  where lower(coalesce(j.status,'')) not in
   ('complete','completed','cancelled','canceled','void','voided','returned','removed','released','archived')
   and lower(coalesce(i.status,'')) not in
   ('cancelled','canceled','void','voided','returned','removed','released')
   and coalesce(i.inventory_required,true)=true
 ), woo_sources as (
  -- A refund caps demand across split production rows for the same blank.
  -- Completed rows consume that cap, but never appear as open demand below.
  select i.id,greatest(0,least(greatest(0,i.quantity),
    greatest(0,l.quantity-l.refunded_quantity) - coalesce(sum(greatest(0,i.quantity)) over (
      partition by i.job_id,i.woocommerce_line_item_id,i.blank_product_id,
       coalesce(i.selected_color,i.color,''),coalesce(i.selected_size,i.size,'')
      order by i.id rows between unbounded preceding and 1 preceding),0)))::numeric source_units
  from eligible_items i
  join campaign c on c.order_channel='woocommerce'
  join public.sc_team_store_order_lines l on l.campaign_id=c.id
   and l.woo_order_id=i.woocommerce_order_id
   and l.woo_line_item_id=i.woocommerce_line_item_id
   and l.payment_confirmed=true and l.quantity>l.refunded_quantity
   and coalesce(l.refund_requires_review,false)=false
 ), source_item_ids as (
  select w.id,w.source_units from woo_sources w
  union
  select i.id,greatest(0,i.quantity)::numeric from eligible_items i
  join campaign c on c.order_channel='quickbooks_invoice'
  where exists (select 1 from public.sc_client_order_requests o
   where o.generated_job_id=i.job_id and o.campaign_id=c.id
    and o.payment_received_at is not null)
 ), demand as (
  select i.blank_product_id,coalesce(nullif(i.order_sku,''),nullif(i.sku,''),'Unmapped') demand_sku,
    max(coalesce(i.selected_style,i.name,i.item_name,'')) demand_style,
    max(coalesce(i.selected_brand,i.brand,'')) demand_brand,
    coalesce(i.selected_color,i.color,'') demand_color,
    coalesce(i.selected_size,i.size,'') demand_size,
    count(*) line_count,sum(s.source_units) unit_count
  from public.job_items i join source_item_ids s on s.id=i.id
  where s.source_units>0 and lower(coalesce(i.status,'')) not in
   ('complete','completed','cancelled','canceled','void','voided','returned','consumed','removed','released')
  group by i.blank_product_id,coalesce(nullif(i.order_sku,''),nullif(i.sku,''),'Unmapped'),
    coalesce(i.selected_color,i.color,''),coalesce(i.selected_size,i.size,'')
 ), available as (
  select v.blank_product_id,max(v.available_quantity) as qty
  from public.app_synced_inventory_catalog_v1 v
  where v.blank_product_id is not null group by v.blank_product_id
 )
 select d.blank_product_id,d.demand_sku,d.demand_style,d.demand_brand,d.demand_color,d.demand_size,
   d.line_count,d.unit_count,a.qty,
   case when d.blank_product_id is null then 'Not paired: resolve product mapping'
    when a.qty is null then 'Inventory availability unknown: verify'
    else 'Demand only; verify existing reservations and Purchasing Report before ordering' end
 from demand d left join available a on a.blank_product_id=d.blank_product_id
 order by d.demand_brand,d.demand_style,d.demand_color,d.demand_size;
end $fn$;
revoke all on function public.sc_team_campaign_purchasing(uuid) from public,anon;
grant execute on function public.sc_team_campaign_purchasing(uuid) to authenticated;
