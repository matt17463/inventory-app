-- Client graphics foundation: additive, no storefront or historic-order writes.
create table if not exists public.sc_client_graphic_families (
 id uuid primary key default gen_random_uuid(),
 customer_id bigint null,
 name text not null,
 internal_name text,
 storefront_label text,
 storefront_visibility text not null default 'internal' check(storefront_visibility in ('internal','fixed','selectable')),
 state text not null default 'draft' check(state in ('draft','approved','retired')),
 parent_family_id uuid references public.sc_client_graphic_families(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.sc_client_graphic_variants (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.sc_client_graphic_families(id) on delete restrict,
 artwork_asset_id uuid references public.mockup_artwork_assets(id) on delete restrict,
 label text not null,
 process text not null default 'DTF',
 width_inches numeric(9,3) check(width_inches>0),
 height_inches numeric(9,3) check(height_inches>0),
 finish text,
 version integer not null default 1 check(version>0),
 state text not null default 'draft' check(state in ('draft','approved','retired')),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(id,family_id)
);
create table if not exists public.sc_client_graphic_rules (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.sc_client_graphic_families(id) on delete restrict,
 variant_id uuid not null,
 priority integer not null default 100,
 garment_type text,
 garment_style text,
 garment_color text,
 color_group text,
 size_group text,
 placement_name text,
 process text,
 effective_from timestamptz,
 effective_until timestamptz,
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 foreign key (variant_id,family_id) references public.sc_client_graphic_variants(id,family_id),
 check (effective_until is null or effective_from is null or effective_until>effective_from)
);
create table if not exists public.sc_client_graphic_product_bindings (
 id uuid primary key default gen_random_uuid(),
 woo_product_id bigint not null check(woo_product_id>0),
 graphic_family_id uuid not null references public.sc_client_graphic_families(id) on delete restrict,
 mode text not null check(mode in ('fixed','selectable','internal')),
 allowed boolean not null default false,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 unique(woo_product_id,graphic_family_id)
);
create table if not exists public.sc_client_graphic_transfer_reviews (
 id uuid primary key default gen_random_uuid(),
 woo_product_id bigint not null,
 woo_variation_id bigint,
 source_kind text not null,
 source_key text,
 source_value text,
 proposed_family_id uuid references public.sc_client_graphic_families(id),
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 evidence jsonb not null default '{}'::jsonb,
 verified_by uuid,
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.sc_order_graphic_selections (
 id uuid primary key default gen_random_uuid(),
 source text not null check(source in ('woocommerce','quickbooks','manual')),
 external_order_id text not null,
 external_line_id text not null,
 family_id uuid references public.sc_client_graphic_families(id),
 selected_label text,
 selected_payload jsonb not null default '{}'::jsonb,
 resolution_snapshot jsonb,
 created_at timestamptz not null default now(),
 unique(source,external_order_id,external_line_id)
);
create index if not exists sc_graphic_rules_family_idx on public.sc_client_graphic_rules(family_id,enabled);
create index if not exists sc_graphic_variants_family_idx on public.sc_client_graphic_variants(family_id);
create index if not exists sc_graphic_transfer_woo_idx on public.sc_client_graphic_transfer_reviews(woo_product_id,status);
alter table public.sc_client_graphic_families enable row level security;
alter table public.sc_client_graphic_variants enable row level security;
alter table public.sc_client_graphic_rules enable row level security;
alter table public.sc_client_graphic_product_bindings enable row level security;
alter table public.sc_client_graphic_transfer_reviews enable row level security;
alter table public.sc_order_graphic_selections enable row level security;
-- Deliberately no browser RLS policies or public grants until role-scoped API is connected.
-- Service-role server functions only, subject to employee authorization.
