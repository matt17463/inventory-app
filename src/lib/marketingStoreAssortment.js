async function pages(query) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await query().order('id').range(offset, offset + 99);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}

export async function loadMarketingAssortment(supabase, accountId, readStoreProduct) {
  const { data: account, error } = await supabase.from('sc_growth_accounts')
    .select('customer_id').eq('id', accountId).single();
  if (error) throw error;
  if (!account?.customer_id) throw Error('Link the marketing account to a customer first.');
  const projects = await pages(() => supabase.from('mockup_projects')
    .select('id,woo_product_id').eq('customer_id_text', String(account.customer_id)));
  const projectsByProduct = new Map();
  const campaigns = [];
  for (const project of projects) {
    campaigns.push(...await pages(() => supabase.from('sc_team_store_workflows')
      .select('id').eq('mockup_project_id_text', project.id).eq('stage', 'live')));
    if (project.woo_product_id) {
      const key = String(project.woo_product_id);
      projectsByProduct.set(key, [...(projectsByProduct.get(key) || []), project]);
    }
  }
  const products = new Map();
  for (const campaign of campaigns) {
    const selected = await pages(() => supabase.from('sc_team_store_products')
      .select('id,woo_product_id,product_name,display_price,currency,product_permalink').eq('campaign_id', campaign.id));
    for (const product of selected) {
      const key = String(product.woo_product_id);
      if (!projectsByProduct.has(key)) throw Error('A selected store product has no matching Mockup Studio project for this customer. Link its project before importing.');
      if (product.currency !== 'USD' || product.display_price == null)
        throw Error('Confirm the USD selling price of each selected product in the store first.');
      products.set(key, product);
    }
  }
  const result = [];
  for (const [key, product] of products) {
    const variants = [];
    for (const project of projectsByProduct.get(key)) {
      const outputs = await pages(() => supabase.from('mockup_outputs')
        .select('id,metadata,woo_position,placement_id').eq('project_id', project.id)
        .in('approval_status', ['customer_approved', 'internal_approved']).eq('is_selected', true));
      for (const output of outputs) {
        let blankId = output.metadata?.blank_asset_id;
        if (!blankId && output.placement_id) {
          const { data: placement, error } = await supabase.from('mockup_placements')
            .select('blank_asset_id').eq('project_id', project.id).eq('id', output.placement_id).maybeSingle();
          if (error) throw error;
          blankId = placement?.blank_asset_id;
        }
        if (!blankId) continue;
        const { data: blank, error } = await supabase.from('mockup_blank_assets')
          .select('product_type,product_color,metadata').eq('project_id', project.id).eq('id', blankId).maybeSingle();
        if (error) throw error;
        if (!blank) continue;
        variants.push({ type: blank.product_type, color: blank.product_color, size: blank.metadata?.catalog_size,
          sku: blank.metadata?.catalog_sku_base, assetId: output.id, position: output.woo_position ?? Number.MAX_SAFE_INTEGER });
      }
    }
    variants.sort((a, b) => a.position - b.position);
    const distinct = key => [...new Set(variants.map(variant => variant[key]).filter(Boolean))].join(', ');
    if (!variants.length) throw Error('Select and approve decorated mockups for each store product before importing.');
    const colorImages = new Map();
    for (const variant of variants) {
      if (!colorImages.has(variant.color)) colorImages.set(variant.color, {
        color: variant.color, assetId: variant.assetId,
      });
    }
    const store = readStoreProduct ? await readStoreProduct(product.woo_product_id) : null;
    const offered = store?.variants || [];
    if (store && !offered.length && Number(product.display_price) !== store.livePrice)
      throw Error('Confirm the USD selling price in the selected store. The published price has changed.');
    const names = values => [...new Set(values.filter(Boolean))];
    const offeredColors = names(offered.map(variant => variant.color));
    const offeredSizes = names(offered.map(variant => variant.size));
    const normalizeColor = color => String(color || '').trim().toLowerCase();
    const offeredByColor = new Map(offeredColors.map(color => [normalizeColor(color), color]));
    const images = offeredColors.length
      ? [...colorImages.values()].filter(image => offeredByColor.has(normalizeColor(image.color)))
        .map(image => ({ ...image, color: offeredByColor.get(normalizeColor(image.color)) }))
      : [...colorImages.values()];
    if (offeredColors.some(color => !images.some(image => image.color === color)))
      throw Error('An offered color is missing a selected and approved mockup.');
    result.push({
      name: product.product_name, sku: store?.sku || distinct('sku'), type: distinct('type'),
      sizes: offeredSizes.join(', ') || distinct('size'), colors: offeredColors.join(', ') || distinct('color'),
      retailPrice: Number(product.display_price), orderUrl: store?.orderUrl || product.product_permalink,
      images, specifications: store?.specifications || [], variants: offered,
    });
  }
  return result.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}
