CREATE OR REPLACE FUNCTION public.sc_receive_finished_product_v2(p_existing_finished_product_id uuid DEFAULT NULL::uuid, p_blank_product_id uuid DEFAULT NULL::uuid, p_finished_bin_id bigint DEFAULT NULL::bigint, p_quantity integer DEFAULT 1, p_customer_name text DEFAULT NULL::text, p_logo_name text DEFAULT NULL::text, p_customer_id bigint DEFAULT NULL::bigint, p_logo_id bigint DEFAULT NULL::bigint, p_decoration_type text DEFAULT NULL::text, p_placement text DEFAULT NULL::text, p_decoration_size text DEFAULT NULL::text, p_production_source text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_deduct_blank boolean DEFAULT false, p_blank_bin_id bigint DEFAULT NULL::bigint, p_woocommerce_product_id bigint DEFAULT NULL::bigint, p_woocommerce_variation_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = ''
AS $function$
DECLARE
  v_blank record;
  v_finished_id uuid;
  v_finished_sku text;
  v_finished_name text;
  v_match_method text := 'created_new';
  v_source_on_hand integer := 0;
BEGIN
  IF coalesce(public.sc_current_app_role() in ('admin','manager','operator'),false) = false THEN RAISE EXCEPTION 'Employee permission required'; END IF;
  IF p_production_source = 'customer_return' AND p_deduct_blank THEN RAISE EXCEPTION 'A return cannot deduct another blank'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bins WHERE id = p_finished_bin_id AND lower(coalesce(bin_code,'') || ' ' || coalesce(label,'')) NOT LIKE '%pending stock%' AND lower(coalesce(bin_code,'')) <> 'pending-stock') THEN RAISE EXCEPTION 'Choose a physical destination bin'; END IF;
  IF p_finished_bin_id IS NULL THEN
    RAISE EXCEPTION 'Finished bin is required.';
  END IF;

  IF COALESCE(p_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero.';
  END IF;

  IF p_existing_finished_product_id IS NOT NULL THEN
    SELECT id INTO v_finished_id
    FROM public.finished_products
    WHERE id = p_existing_finished_product_id;

    IF v_finished_id IS NULL THEN
      RAISE EXCEPTION 'Selected existing finished product was not found.';
    END IF;

    v_match_method := 'manual_existing_finished_product_selection';
  END IF;

  IF p_blank_product_id IS NULL AND (v_finished_id IS NULL OR p_deduct_blank = true) THEN
    RAISE EXCEPTION 'Blank product is required.';
  END IF;

  IF p_blank_product_id IS NOT NULL THEN
    SELECT bp.id, bp.sku_base, bp.name, br.name AS brand, pt.name AS style, c.name AS color, s.name AS size
    INTO v_blank
    FROM public.blank_products bp
    LEFT JOIN public.brands br ON br.id = bp.brand_id
    LEFT JOIN public.product_types pt ON pt.id = bp.product_type_id
    LEFT JOIN public.colors c ON c.id = bp.color_id
    LEFT JOIN public.sizes s ON s.id = bp.size_id
    WHERE bp.id = p_blank_product_id FOR UPDATE OF bp;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Blank product not found.';
    END IF;
  END IF;

  IF p_deduct_blank = true THEN
    IF p_blank_bin_id IS NULL THEN
      RAISE EXCEPTION 'Blank source bin is required when deducting blank inventory.';
    END IF;

    SELECT COALESCE(SUM(quantity_change), 0)::integer
    INTO v_source_on_hand
    FROM public.blank_inventory_movements
    WHERE bin_id = p_blank_bin_id
      AND blank_product_id = p_blank_product_id;

    IF COALESCE(v_source_on_hand, 0) <= 0 THEN
      RAISE EXCEPTION 'Selected blank product does not exist in the chosen source bin.';
    END IF;

    IF COALESCE(v_source_on_hand, 0) < p_quantity THEN
      RAISE EXCEPTION 'Selected source bin only has % of this blank item, but quantity % was requested.', v_source_on_hand, p_quantity;
    END IF;
  END IF;

  -- If no existing finished product was manually selected, try automatic matching.
  IF v_finished_id IS NULL THEN
    IF NULLIF(trim(COALESCE(p_customer_name, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Customer is required.';
    END IF;

    IF NULLIF(trim(COALESCE(p_logo_name, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Logo/design is required.';
    END IF;

    v_finished_sku :=
      public.sc_finished_norm(p_customer_name)
      || '-' || public.sc_finished_norm(p_logo_name)
      || '-' || public.sc_finished_norm(COALESCE(p_decoration_type, 'DECORATED'))
      || '-' || public.sc_finished_norm(COALESCE(p_placement, 'NA'))
      || '-' || public.sc_finished_norm(COALESCE(v_blank.sku_base, v_blank.brand || '-' || v_blank.style || '-' || v_blank.color || '-' || v_blank.size));

    v_finished_name := concat_ws(' / ',
      NULLIF(trim(p_customer_name), ''),
      NULLIF(trim(p_logo_name), ''),
      NULLIF(trim(p_decoration_type), ''),
      NULLIF(trim(p_placement), ''),
      v_blank.brand || ' ' || v_blank.style || ' ' || v_blank.color || ' ' || v_blank.size
    );

    IF p_woocommerce_variation_id IS NOT NULL THEN
      SELECT id INTO v_finished_id
      FROM public.finished_products
      WHERE woocommerce_variation_id = p_woocommerce_variation_id
      LIMIT 1;

      IF v_finished_id IS NOT NULL THEN
        v_match_method := 'matched_existing_by_woocommerce_variation_id';
      END IF;
    END IF;

    IF v_finished_id IS NULL AND p_woocommerce_product_id IS NOT NULL THEN
      SELECT id INTO v_finished_id
      FROM public.finished_products
      WHERE woocommerce_product_id = p_woocommerce_product_id
        AND blank_product_id = p_blank_product_id
      LIMIT 1;

      IF v_finished_id IS NOT NULL THEN
        v_match_method := 'matched_existing_by_woocommerce_product_id_and_blank';
      END IF;
    END IF;

    IF v_finished_id IS NULL THEN
      SELECT id INTO v_finished_id
      FROM public.finished_products
      WHERE blank_product_id = p_blank_product_id
        AND public.sc_finished_match_norm(customer_name) = public.sc_finished_match_norm(p_customer_name)
        AND public.sc_finished_match_norm(logo_name) = public.sc_finished_match_norm(p_logo_name)
        AND public.sc_finished_match_norm(COALESCE(decoration_type, '')) = public.sc_finished_match_norm(COALESCE(p_decoration_type, ''))
        AND public.sc_finished_match_norm(COALESCE(placement, '')) = public.sc_finished_match_norm(COALESCE(p_placement, ''))
      ORDER BY
        CASE WHEN woocommerce_product_id IS NOT NULL OR woocommerce_variation_id IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
      LIMIT 1;

      IF v_finished_id IS NOT NULL THEN
        v_match_method := 'matched_existing_by_customer_logo_blank_decoration';
      END IF;
    END IF;

    IF v_finished_id IS NULL THEN
      SELECT id INTO v_finished_id
      FROM public.finished_products
      WHERE finished_sku = v_finished_sku
         OR sku = v_finished_sku
      LIMIT 1;

      IF v_finished_id IS NOT NULL THEN
        v_match_method := 'matched_existing_by_finished_sku';
      END IF;
    END IF;

    IF v_finished_id IS NULL THEN
      INSERT INTO public.finished_products (
        sku,
        finished_sku,
        name,
        customer_name,
        logo_name,
        customer_id,
        logo_id,
        decoration_type,
        placement,
        decoration_size,
        blank_product_id,
        woocommerce_product_id,
        woocommerce_variation_id,
        production_source,
        source,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        v_finished_sku,
        v_finished_sku,
        v_finished_name,
        trim(p_customer_name),
        trim(p_logo_name),
        p_customer_id,
        p_logo_id,
        NULLIF(trim(COALESCE(p_decoration_type, '')), ''),
        NULLIF(trim(COALESCE(p_placement, '')), ''),
        NULLIF(trim(COALESCE(p_decoration_size, '')), ''),
        p_blank_product_id,
        p_woocommerce_product_id,
        p_woocommerce_variation_id,
        COALESCE(NULLIF(trim(COALESCE(p_production_source, '')), ''), 'manual_production'),
        'manual_from_blank',
        p_notes,
        now(),
        now()
      )
      RETURNING id INTO v_finished_id;
    ELSE
      UPDATE public.finished_products
      SET
        customer_name = COALESCE(NULLIF(trim(p_customer_name), ''), customer_name),
        logo_name = COALESCE(NULLIF(trim(p_logo_name), ''), logo_name),
        customer_id = COALESCE(p_customer_id, customer_id),
        logo_id = COALESCE(p_logo_id, logo_id),
        decoration_type = COALESCE(NULLIF(trim(COALESCE(p_decoration_type, '')), ''), decoration_type),
        placement = COALESCE(NULLIF(trim(COALESCE(p_placement, '')), ''), placement),
        decoration_size = COALESCE(NULLIF(trim(COALESCE(p_decoration_size, '')), ''), decoration_size),
        blank_product_id = COALESCE(p_blank_product_id, blank_product_id),
        woocommerce_product_id = COALESCE(p_woocommerce_product_id, woocommerce_product_id),
        woocommerce_variation_id = COALESCE(p_woocommerce_variation_id, woocommerce_variation_id),
        production_source = COALESCE(NULLIF(trim(COALESCE(p_production_source, '')), ''), production_source),
        updated_at = now()
      WHERE id = v_finished_id;
    END IF;
  ELSE
    -- Existing finished product selected. Do not overwrite its Woo/customer/logo/decoration data.
    UPDATE public.finished_products
    SET
      blank_product_id = COALESCE(blank_product_id, p_blank_product_id),
      production_source = COALESCE(NULLIF(trim(COALESCE(p_production_source, '')), ''), production_source),
      updated_at = now()
    WHERE id = v_finished_id;
  END IF;

  INSERT INTO public.finished_inventory_movements (
    bin_id,
    finished_product_id,
    quantity_change,
    notes
  )
  VALUES (
    p_finished_bin_id,
    v_finished_id,
    p_quantity,
    concat_ws(' | ', 'Finished inventory received', v_match_method, p_notes)
  );

  IF p_deduct_blank = true THEN
    INSERT INTO public.blank_inventory_movements (
      bin_id,
      blank_product_id,
      quantity_change,
      notes
    )
    VALUES (
      p_blank_bin_id,
      p_blank_product_id,
      -p_quantity,
      concat_ws(' | ', 'Used to create/receive finished product', v_match_method, p_notes)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'finished_product_id', v_finished_id,
    'quantity_added', p_quantity,
    'deducted_blank', p_deduct_blank,
    'match_method', v_match_method
  );
END;
$function$

;
revoke all on function public.sc_receive_finished_product_v2(uuid,uuid,bigint,integer,text,text,bigint,bigint,text,text,text,text,text,boolean,bigint,bigint,bigint) from public, anon;
grant execute on function public.sc_receive_finished_product_v2(uuid,uuid,bigint,integer,text,text,bigint,bigint,text,text,text,text,text,boolean,bigint,bigint,bigint) to authenticated;
notify pgrst, 'reload schema';
