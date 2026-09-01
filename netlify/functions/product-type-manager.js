import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { wooCollection, wooRequest } from './_shared/mockupUtils.js';

const clean = (value) => String(value ?? '').trim();
const normalized = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

function codeFromName(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function allRows(supabase, table, select, configure = (query) => query) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const query = configure(supabase.from(table).select(select)).range(from, from + pageSize - 1);
    const result = await query;
    if (result.error) throw result.error;
    rows.push(...(result.data || []));
    if ((result.data || []).length < pageSize) break;
  }
  return rows;
}

function nested(row, key) {
  const value = row?.[key];
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function loadCatalog(supabase) {
  const [itemTypes, mappings, blanks] = await Promise.all([
    allRows(supabase, 'sc_blank_item_types', 'id,name,code,sort_order,is_active', (query) => query.order('sort_order').order('name')),
    allRows(supabase, 'sc_brand_style_item_types', 'brand_id,product_type_id,item_type_id,updated_at'),
    allRows(
      supabase,
      'blank_products',
      'id,brand_id,product_type_id,sc_is_archived,brands:brand_id(id,name,code),product_types:product_type_id(id,name,code,sc_item_type_id)',
      (query) => query.or('sc_is_archived.is.null,sc_is_archived.eq.false'),
    ),
  ]);
  const typeById = new Map(itemTypes.map((row) => [String(row.id), row]));
  const mappingByPair = new Map(mappings.map((row) => [`${row.brand_id}|${row.product_type_id}`, row]));
  const groups = new Map();
  for (const row of blanks) {
    if (!row.brand_id || !row.product_type_id) continue;
    const brand = nested(row, 'brands');
    const style = nested(row, 'product_types');
    if (!brand || !style) continue;
    const key = `${row.brand_id}|${row.product_type_id}`;
    if (!groups.has(key)) {
      const mapping = mappingByPair.get(key);
      const itemTypeId = mapping?.item_type_id || style.sc_item_type_id || null;
      const itemType = itemTypeId ? typeById.get(String(itemTypeId)) : null;
      groups.set(key, {
        key,
        brand_id: row.brand_id,
        brand_name: brand.name || '',
        brand_code: brand.code || '',
        style_id: row.product_type_id,
        style_name: style.name || '',
        style_code: style.code || '',
        item_type_id: itemTypeId,
        item_type_name: itemType?.name || '',
        mapping_source: mapping ? 'brand_style' : (style.sc_item_type_id ? 'legacy_style' : 'unclassified'),
        blank_count: 0,
      });
    }
    groups.get(key).blank_count += 1;
  }
  return {
    item_types: itemTypes.filter((row) => row.is_active !== false),
    groups: [...groups.values()].sort((a, b) => a.brand_name.localeCompare(b.brand_name) || a.style_name.localeCompare(b.style_name)),
  };
}

function attributeValue(product, pattern) {
  const attribute = (product?.attributes || []).find((row) => pattern.test(clean(row?.name)));
  if (!attribute) return '';
  return clean((attribute.options || [])[0]);
}

function metaEntry(product, key) {
  return (product?.meta_data || []).find((row) => clean(row?.key) === key) || null;
}

function productIdentity(product) {
  const brand = clean(metaEntry(product, '_sc_brand')?.value) || attributeValue(product, /^brand$/i);
  const style = clean(metaEntry(product, '_sc_style')?.value) || attributeValue(product, /^(style|product style)$/i);
  return { brand, style };
}

async function allWooProducts() {
  const rows = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = wooCollection(await wooRequest(`products?status=any&per_page=100&page=${page}&orderby=id&order=asc`), 'WooCommerce products');
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

function groupIdentityKeys(group) {
  const brands = [group.brand_name, group.brand_code].map(normalized).filter(Boolean);
  const styles = [group.style_name, group.style_code].map(normalized).filter(Boolean);
  return { brands: new Set(brands), styles: new Set(styles) };
}

function matchesGroup(product, group) {
  const identity = productIdentity(product);
  if (!identity.brand || !identity.style) return false;
  const keys = groupIdentityKeys(group);
  return keys.brands.has(normalized(identity.brand)) && keys.styles.has(normalized(identity.style));
}

function writableWooAttribute(row) {
  const common = {
    position: Number(row?.position || 0),
    visible: row?.visible !== false,
    variation: row?.variation === true,
    options: Array.isArray(row?.options) ? row.options : [],
  };
  return Number(row?.id || 0) > 0
    ? { id: Number(row.id), ...common }
    : { name: clean(row?.name), ...common };
}

function itemTypeAttribute(attributes, itemTypeName) {
  const source = Array.isArray(attributes) ? attributes : [];
  const current = source.map(writableWooAttribute);
  const index = source.findIndex((row) => /^item type$/i.test(clean(row?.name)));
  const next = index >= 0
    ? { ...current[index], options: [itemTypeName], visible: false, variation: false }
    : { name: 'Item Type', position: current.length, options: [itemTypeName], visible: false, variation: false };
  if (index >= 0) current[index] = next;
  else current.push(next);
  return current;
}

function typeMeta(product, itemTypeName) {
  const existing = metaEntry(product, '_sc_blank_item_type');
  return existing?.id
    ? { id: existing.id, key: '_sc_blank_item_type', value: itemTypeName }
    : { key: '_sc_blank_item_type', value: itemTypeName };
}

async function wooMatchSummary(groups) {
  const products = await allWooProducts();
  return groups.map((group) => {
    const matched = products.filter((product) => matchesGroup(product, group));
    return {
      key: group.key,
      woo_count: matched.length,
      woo_products: matched.slice(0, 10).map((product) => ({ id: product.id, name: product.name, status: product.status })),
    };
  });
}

async function syncWooProducts(groups, itemTypeName) {
  const products = await allWooProducts();
  const selectedProducts = new Map();
  for (const group of groups) {
    for (const product of products) {
      if (matchesGroup(product, group)) selectedProducts.set(String(product.id), product);
    }
  }
  const updates = [...selectedProducts.values()].map((product) => ({
    id: product.id,
    attributes: itemTypeAttribute(product.attributes, itemTypeName),
    meta_data: [typeMeta(product, itemTypeName)],
  }));
  let updated = 0;
  const failures = [];
  for (let index = 0; index < updates.length; index += 25) {
    const chunk = updates.slice(index, index + 25);
    try {
      const response = await wooRequest('products/batch', { method: 'POST', body: { update: chunk } });
      const returned = Array.isArray(response?.update) ? response.update : [];
      updated += returned.filter((row) => row && !row.error).length;
      for (const row of returned) if (row?.error) failures.push({ id: row.id || null, message: row.error?.message || 'WooCommerce update failed.' });
      if (!returned.length && chunk.length) updated += chunk.length;
    } catch (error) {
      failures.push({ id: null, message: error.message || 'WooCommerce batch update failed.' });
      break;
    }
  }
  return { matched: updates.length, updated, failures };
}

async function createType(supabase, body) {
  const name = clean(body.name);
  if (!name) throw new Error('Enter a product type name.');
  const code = codeFromName(body.code || name);
  if (!code) throw new Error('The product type needs at least one letter or number.');
  const existingRows = await allRows(supabase, 'sc_blank_item_types', 'id,name,code,sort_order,is_active');
  const same = existingRows.find((row) => normalized(row.name) === normalized(name) || normalized(row.code) === normalized(code));
  if (same) {
    if (same.is_active === false) {
      const restored = await supabase.from('sc_blank_item_types').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', same.id).select('*').single();
      if (restored.error) throw restored.error;
      return { type: restored.data, created: false, restored: true };
    }
    return { type: same, created: false, restored: false };
  }
  const maximum = await supabase.from('sc_blank_item_types').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  if (maximum.error) throw maximum.error;
  const inserted = await supabase.from('sc_blank_item_types').insert({
    name,
    code,
    sort_order: Number(maximum.data?.sort_order || 0) + 10,
    is_active: true,
  }).select('*').single();
  if (inserted.error) throw inserted.error;
  return { type: inserted.data, created: true, restored: false };
}

async function assignType(supabase, userId, body) {
  const itemTypeId = Number(body.item_type_id || 0);
  if (!Number.isInteger(itemTypeId) || itemTypeId <= 0) throw new Error('Choose a product type to apply.');
  const pairs = Array.isArray(body.pairs) ? body.pairs : [];
  if (!pairs.length) throw new Error('Select at least one Brand + Style row.');
  const typeResult = await supabase.from('sc_blank_item_types').select('id,name,code,is_active').eq('id', itemTypeId).maybeSingle();
  if (typeResult.error) throw typeResult.error;
  if (!typeResult.data || typeResult.data.is_active === false) throw new Error('The selected product type is not active.');
  const catalog = await loadCatalog(supabase);
  const byKey = new Map(catalog.groups.map((row) => [row.key, row]));
  const selected = [];
  for (const pair of pairs) {
    const key = `${Number(pair.brand_id)}|${Number(pair.product_type_id)}`;
    const group = byKey.get(key);
    if (!group) throw new Error(`Brand + Style pair ${key} is no longer available. Refresh and retry.`);
    selected.push(group);
  }
  const now = new Date().toISOString();
  const payload = selected.map((group) => ({
    brand_id: group.brand_id,
    product_type_id: group.style_id,
    item_type_id: itemTypeId,
    actor_id: userId,
    updated_at: now,
  }));
  const saved = await supabase.from('sc_brand_style_item_types').upsert(payload, { onConflict: 'brand_id,product_type_id' });
  if (saved.error) {
    if (/does not exist|schema cache|could not find/i.test(saved.error.message || '')) throw new Error('Product Type Manager SQL is not installed. Run deployment SQL 56 and retry.');
    throw saved.error;
  }

  let woo = { matched: 0, updated: 0, failures: [] };
  if (body.sync_woo !== false) woo = await syncWooProducts(selected, typeResult.data.name);
  return {
    assigned_pairs: selected.length,
    item_type: typeResult.data,
    woo,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  const auth = await authorizeEmployee(event, { functionName: 'product-type-manager', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, message: auth.message }, event);
  try {
    const query = event.queryStringParameters || {};
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const action = clean(event.httpMethod === 'POST' ? body.action : query.action) || 'summary';
    let data;
    if (action === 'summary') data = await loadCatalog(auth.supabase);
    else if (action === 'woo-scan') {
      const catalog = await loadCatalog(auth.supabase);
      data = { matches: await wooMatchSummary(catalog.groups) };
    } else if (action === 'create-type') data = await createType(auth.supabase, body);
    else if (action === 'assign') data = await assignType(auth.supabase, auth.user.id, body);
    else throw new Error('Unsupported Product Type Manager action.');
    return jsonResponse(200, { success: true, data }, event);
  } catch (error) {
    console.error('Product Type Manager failed:', error);
    return jsonResponse(500, { success: false, message: error.message || 'Product Type Manager request failed.' }, event);
  }
}
