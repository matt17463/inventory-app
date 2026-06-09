
export async function syncSupplierCatalogFeedIncremental(feedId, options = {}) {
  const chunkSize = Number(options.chunkSize || 150);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  let offset = 0;
  let complete = false;
  let lastResponse = null;
  let safetyCounter = 0;

  while (!complete) {
    safetyCounter += 1;

    if (safetyCounter > 1000) {
      throw new Error('Supplier catalog sync stopped after too many chunks.');
    }

    const response = await fetch('/.netlify/functions/supplier-catalog-feed-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed_id: feedId, offset, chunk_size: chunkSize }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || body?.success === false) {
      throw new Error(body?.message || `Supplier catalog feed sync failed: HTTP ${response.status}`);
    }

    lastResponse = body;
    complete = Boolean(body.complete) || !body.has_more;
    offset = Number(body.next_offset || offset);

    onProgress({
      offset,
      totalRows: Number(body.total_rows || 0),
      importedThisCall: Number(body.imported_this_call || 0),
      complete,
      message: body.message || '',
      raw: body,
    });

    if (!complete) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return lastResponse;
}
