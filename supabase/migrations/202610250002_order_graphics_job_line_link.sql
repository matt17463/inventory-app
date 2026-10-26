-- Opt-in canonical mapping from financial/manual order line to the actual production job line.
alter table public.sc_order_graphic_selections
 add column if not exists job_item_id bigint references public.job_items(id) on delete restrict;
create unique index if not exists sc_order_graphic_selections_job_item_unique
 on public.sc_order_graphic_selections(job_item_id) where job_item_id is not null;
create index if not exists sc_order_graphic_selections_job_item_idx on public.sc_order_graphic_selections(job_item_id);
