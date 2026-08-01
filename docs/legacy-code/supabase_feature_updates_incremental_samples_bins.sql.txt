-- Skilled Crafting Inventory App Feature Update
-- Covers:
-- 1) Append-only/incremental blank product spreadsheet import
-- 2) Blank inventory search/view repair
-- 3) Sample inventory table + view
-- 4) Bin display ordering
-- 5) Color alias updated_at column fix

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- Utility helpers
-- =========================================================

CREATE OR REPLACE FUNCTION public.sc_feature_norm(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.sc_feature_sku(p_brand text, p_style text, p_color text, p_size text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(
    upper(concat_ws('-', nullif(trim(p_brand), ''), nullif(trim(p_style), ''), nullif(trim(p_color), ''), nullif(trim(p_size), ''))),
    '[^A-Z0-9]+',
    '-',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.sc_feature_code(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9]+', '', 'g'), '');
$$;

-- =========================================================
-- Color alias updated_at fix
-- =========================================================

ALTER TABLE IF EXISTS public.color_alias_approvals
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.color_alias_approvals
SET updated_at = COALESCE(updated_at, reviewed_at, created_at, now())
WHERE updated_at IS NULL;

-- =========================================================
-- Bin display order
-- =========================================================

ALTER TABLE public.bins
ADD COLUMN IF NOT EXISTS display_order integer;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY coalesce(bin_code, ''), id) AS rn
  FROM public.bins
)
UPDATE public.bins b
SET display_order = COALESCE(b.display_order, numbered.rn)
FROM numbered
WHERE b.id = numbered.id;

CREATE OR REPLACE FUNCTION public.update_bin_display_order(p_orders jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_orders IS NULL OR jsonb_typeof(p_orders) <> 'array' THEN
    RAISE EXCEPTION 'p_orders must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    UPDATE public.bins
    SET display_order = COALESCE(NULLIF(v_item->>'display_order', '')::integer, display_order)
    WHERE id = NULLIF(v_item->>'bin_id', '')::bigint;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', jsonb_array_length(p_orders));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bin_display_order(jsonb) TO anon, authenticated;

-- =========================================================
-- Blank inventory view repair
-- =========================================================
-- Keeps the existing app-facing columns:
-- blank_product_id, sku_base, name, brand, product_type, color, size,
-- quantity_on_hand, reserved_quantity, available_quantity, unit_cost, inventory_value

DROP VIEW IF EXISTS public.blank_inventory_by_product CASCADE;

CREATE VIEW public.blank_inventory_by_product AS
WITH on_hand AS (
  SELECT
    blank_product_id,
    COALESCE(SUM(quantity_change), 0)::integer AS quantity_on_hand
  FROM public.blank_inventory_movements
  GROUP BY blank_product_id
), reserved AS (
  SELECT
    blank_product_id,
    COALESCE(SUM(quantity_reserved), 0)::integer AS reserved_quantity
  FROM public.inventory_reservations
  GROUP BY blank_product_id
)
SELECT
  bp.id AS blank_product_id,
  bp.sku_base,
  bp.name,
  br.name AS brand,
  pt.name AS product_type,
  c.name AS color,
  s.name AS size,
  COALESCE(oh.quantity_on_hand, 0)::integer AS quantity_on_hand,
  COALESCE(r.reserved_quantity, 0)::integer AS reserved_quantity,
  (COALESCE(oh.quantity_on_hand, 0) - COALESCE(r.reserved_quantity, 0))::integer AS available_quantity,
  COALESCE(bp.unit_cost, 0)::numeric AS unit_cost,
  (COALESCE(oh.quantity_on_hand, 0) * COALESCE(bp.unit_cost, 0))::numeric AS inventory_value
FROM public.blank_products bp
LEFT JOIN public.brands br ON br.id = bp.brand_id
LEFT JOIN public.product_types pt ON pt.id = bp.product_type_id
LEFT JOIN public.colors c ON c.id = bp.color_id
LEFT JOIN public.sizes s ON s.id = bp.size_id
LEFT JOIN on_hand oh ON oh.blank_product_id = bp.id
LEFT JOIN reserved r ON r.blank_product_id = bp.id;

GRANT SELECT ON public.blank_inventory_by_product TO anon, authenticated;

-- =========================================================
-- Sample inventory
-- =========================================================

CREATE TABLE IF NOT EXISTS public.sample_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blank_product_id uuid NOT NULL REFERENCES public.blank_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sample_inventory_blank_product_id
ON public.sample_inventory(blank_product_id);

CREATE OR REPLACE FUNCTION public.touch_sample_inventory_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_sample_inventory_updated_at ON public.sample_inventory;
CREATE TRIGGER trg_touch_sample_inventory_updated_at
BEFORE UPDATE ON public.sample_inventory
FOR EACH ROW
EXECUTE FUNCTION public.touch_sample_inventory_updated_at();

DROP VIEW IF EXISTS public.sample_inventory_view CASCADE;

CREATE VIEW public.sample_inventory_view AS
SELECT
  si.id,
  si.blank_product_id,
  bp.sku_base,
  bp.name,
  br.name AS brand,
  pt.name AS product_type,
  c.name AS color,
  s.name AS size,
  si.quantity,
  si.notes,
  si.created_at,
  si.updated_at
FROM public.sample_inventory si
JOIN public.blank_products bp ON bp.id = si.blank_product_id
LEFT JOIN public.brands br ON br.id = bp.brand_id
LEFT JOIN public.product_types pt ON pt.id = bp.product_type_id
LEFT JOIN public.colors c ON c.id = bp.color_id
LEFT JOIN public.sizes s ON s.id = bp.size_id;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_inventory TO anon, authenticated;
GRANT SELECT ON public.sample_inventory_view TO anon, authenticated;

-- =========================================================
-- Append-only blank products import
-- =========================================================
-- This function does NOT delete existing blank_products or inventory movements.
-- Existing rows are skipped by SKU base or exact normalized Brand+Style+Color+Size.

ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS low_stock_threshold integer;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS supplier_sku text;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS master_source text DEFAULT 'manual';
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS master_imported_at timestamptz;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS master_import_file text;
ALTER TABLE public.blank_products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_blank_products_sku_base
ON public.blank_products(sku_base);

CREATE OR REPLACE FUNCTION public.append_blank_products_from_json(
  p_rows jsonb,
  p_source_file_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row jsonb;
  v_brand text;
  v_style text;
  v_color text;
  v_size text;
  v_sku_base text;
  v_name text;
  v_bin_code text;
  v_qty integer;
  v_unit_cost numeric;
  v_low_stock integer;
  v_brand_id public.brands.id%type;
  v_type_id public.product_types.id%type;
  v_color_id public.colors.id%type;
  v_size_id public.sizes.id%type;
  v_bin_id public.bins.id%type;
  v_blank_id public.blank_products.id%type;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_movements integer := 0;
  v_created_bins integer := 0;
  v_created_brands integer := 0;
  v_created_styles integer := 0;
  v_created_colors integer := 0;
  v_created_sizes integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_brand := nullif(trim(coalesce(v_row->>'brand', '')), '');
    v_style := nullif(trim(coalesce(v_row->>'style', '')), '');
    v_color := nullif(trim(coalesce(v_row->>'color', '')), '');
    v_size := nullif(trim(coalesce(v_row->>'size', '')), '');

    IF v_brand IS NULL OR v_style IS NULL OR v_color IS NULL OR v_size IS NULL THEN
      CONTINUE;
    END IF;

    v_sku_base := nullif(trim(coalesce(v_row->>'sku_base', '')), '');
    IF v_sku_base IS NULL THEN
      v_sku_base := public.sc_feature_sku(v_brand, v_style, v_color, v_size);
    ELSE
      v_sku_base := trim(both '-' from regexp_replace(upper(v_sku_base), '[^A-Z0-9]+', '-', 'g'));
    END IF;

    v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
    IF v_name IS NULL THEN
      v_name := concat_ws(' ', v_brand, v_style, v_color, v_size);
    END IF;

    v_bin_code := nullif(trim(coalesce(v_row->>'bin', '')), '');
    v_qty := COALESCE(nullif(v_row->>'quantity','')::numeric, 0)::integer;
    v_unit_cost := COALESCE(nullif(v_row->>'unit_cost','')::numeric, 0);
    v_low_stock := nullif(v_row->>'low_stock_threshold','')::numeric::integer;

    SELECT id INTO v_blank_id
    FROM public.blank_products
    WHERE public.sc_feature_norm(sku_base) = public.sc_feature_norm(v_sku_base)
    LIMIT 1;

    IF v_blank_id IS NULL THEN
      SELECT bp.id INTO v_blank_id
      FROM public.blank_products bp
      LEFT JOIN public.brands br ON br.id = bp.brand_id
      LEFT JOIN public.product_types pt ON pt.id = bp.product_type_id
      LEFT JOIN public.colors co ON co.id = bp.color_id
      LEFT JOIN public.sizes si ON si.id = bp.size_id
      WHERE public.sc_feature_norm(br.name) = public.sc_feature_norm(v_brand)
        AND public.sc_feature_norm(pt.name) = public.sc_feature_norm(v_style)
        AND public.sc_feature_norm(co.name) = public.sc_feature_norm(v_color)
        AND public.sc_feature_norm(si.name) = public.sc_feature_norm(v_size)
      LIMIT 1;
    END IF;

    IF v_blank_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_brand_id FROM public.brands
    WHERE public.sc_feature_norm(name) = public.sc_feature_norm(v_brand)
       OR public.sc_feature_norm(code) = public.sc_feature_norm(v_brand)
    LIMIT 1;
    IF v_brand_id IS NULL THEN
      INSERT INTO public.brands(code, name) VALUES (COALESCE(public.sc_feature_code(v_brand), v_brand), v_brand) RETURNING id INTO v_brand_id;
      v_created_brands := v_created_brands + 1;
    END IF;

    SELECT id INTO v_type_id FROM public.product_types
    WHERE public.sc_feature_norm(name) = public.sc_feature_norm(v_style)
       OR public.sc_feature_norm(code) = public.sc_feature_norm(v_style)
    LIMIT 1;
    IF v_type_id IS NULL THEN
      INSERT INTO public.product_types(code, name) VALUES (COALESCE(public.sc_feature_code(v_style), v_style), v_style) RETURNING id INTO v_type_id;
      v_created_styles := v_created_styles + 1;
    END IF;

    SELECT id INTO v_color_id FROM public.colors
    WHERE public.sc_feature_norm(name) = public.sc_feature_norm(v_color)
       OR public.sc_feature_norm(code) = public.sc_feature_norm(v_color)
    LIMIT 1;
    IF v_color_id IS NULL THEN
      INSERT INTO public.colors(code, name) VALUES (COALESCE(public.sc_feature_code(v_color), v_color), v_color) RETURNING id INTO v_color_id;
      v_created_colors := v_created_colors + 1;
    END IF;

    SELECT id INTO v_size_id FROM public.sizes
    WHERE public.sc_feature_norm(name) = public.sc_feature_norm(v_size)
       OR public.sc_feature_norm(code) = public.sc_feature_norm(v_size)
    LIMIT 1;
    IF v_size_id IS NULL THEN
      INSERT INTO public.sizes(code, name) VALUES (v_size, v_size) RETURNING id INTO v_size_id;
      v_created_sizes := v_created_sizes + 1;
    END IF;

    INSERT INTO public.blank_products(
      sku_base, barcode, name, brand_id, product_type_id, color_id, size_id,
      image_url, unit_cost, low_stock_threshold, supplier, supplier_sku, notes,
      master_source, master_imported_at, master_import_file, is_active
    ) VALUES (
      v_sku_base,
      nullif(trim(coalesce(v_row->>'barcode', '')), ''),
      v_name,
      v_brand_id,
      v_type_id,
      v_color_id,
      v_size_id,
      nullif(trim(coalesce(v_row->>'image_url', '')), ''),
      v_unit_cost,
      v_low_stock,
      nullif(trim(coalesce(v_row->>'supplier', '')), ''),
      nullif(trim(coalesce(v_row->>'supplier_sku', '')), ''),
      nullif(trim(coalesce(v_row->>'notes', '')), ''),
      'spreadsheet-append',
      now(),
      p_source_file_name,
      true
    ) RETURNING id INTO v_blank_id;

    v_inserted := v_inserted + 1;

    IF v_qty > 0 AND v_bin_code IS NOT NULL THEN
      SELECT id INTO v_bin_id FROM public.bins
      WHERE public.sc_feature_norm(bin_code) = public.sc_feature_norm(v_bin_code)
         OR public.sc_feature_norm(label) = public.sc_feature_norm(v_bin_code)
         OR public.sc_feature_norm(location) = public.sc_feature_norm(v_bin_code)
      LIMIT 1;

      IF v_bin_id IS NULL THEN
        INSERT INTO public.bins(bin_code, label, location)
        VALUES (v_bin_code, v_bin_code, 'Imported append-only blank inventory')
        RETURNING id INTO v_bin_id;
        v_created_bins := v_created_bins + 1;
      END IF;

      INSERT INTO public.blank_inventory_movements(bin_id, blank_product_id, quantity_change, notes)
      VALUES (v_bin_id, v_blank_id, v_qty, concat_ws(' | ', 'Append-only blank product import', p_source_file_name, nullif(trim(coalesce(v_row->>'notes', '')), '')));
      v_movements := v_movements + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'append_only',
    'input_rows', jsonb_array_length(p_rows),
    'inserted_blank_products', v_inserted,
    'skipped_existing_blank_products', v_skipped,
    'inserted_inventory_movements', v_movements,
    'created_bins', v_created_bins,
    'created_brands', v_created_brands,
    'created_styles', v_created_styles,
    'created_colors', v_created_colors,
    'created_sizes', v_created_sizes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_blank_products_from_json(jsonb, text) TO anon, authenticated;

-- Compatibility wrapper: existing app builds that still call the old RPC will now append instead of replace.
CREATE OR REPLACE FUNCTION public.replace_blank_product_master_from_json(
  p_rows jsonb,
  p_source_file_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.append_blank_products_from_json(p_rows, p_source_file_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_blank_product_master_from_json(jsonb, text) TO anon, authenticated;
