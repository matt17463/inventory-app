-- A CRM-only temporary marketing logo reference, independent of production artwork.
alter table public.sc_growth_accounts add column if not exists marketing_logo_key text;
comment on column public.sc_growth_accounts.marketing_logo_key is 'Private R2 marketing/artwork/<account uuid>/<file uuid> raster; never a production artwork reference.';
