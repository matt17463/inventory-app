import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getExceptionCenter, getProductDataHealthReport } from './lib/phase6Api';

function isProductDataException(item) {
  const text = `${item?.category || ''} ${item?.title || ''} ${item?.route || ''}`.toLowerCase();
  return text.includes('product') || text.includes('data health') || text.includes('productdata');
}

function value(...items) {
  return items.find((v) => v !== undefined && v !== null && String(v).trim() !== '') || '—';
}

export default function ExceptionCenter() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedKey, setExpandedKey] = useState('');
  const [detailRows, setDetailRows] = useState({});
  const [detailLoading, setDetailLoading] = useState('');
  const [detailError, setDetailError] = useState('');

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.count || 0), 0), [items]);
  const highSeverityTotal = useMemo(() => items
    .filter((item) => item.severity === 'high')
    .reduce((sum, item) => sum + Number(item.count || 0), 0), [items]);

  const loadDetails = useCallback(async (item, key, options = {}) => {
    if (!isProductDataException(item)) return;
    if (detailRows[key]?.length) return;

    setDetailLoading(key);
    if (!options.silent) setDetailError('');

    try {
      const rows = await getProductDataHealthReport('all');
      setDetailRows((current) => ({ ...current, [key]: rows.slice(0, 100) }));
    } catch (err) {
      setDetailError(err.message || 'Failed to load product data health details.');
    } finally {
      setDetailLoading('');
    }
  }, [detailRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setDetailError('');

    try {
      const nextItems = await getExceptionCenter();
      setItems(nextItems);

      const firstProductData = nextItems.find((item) => Number(item.count || 0) > 0 && isProductDataException(item));
      if (firstProductData) {
        const key = `${firstProductData.category}-${firstProductData.title}`;
        setExpandedKey(key);
        loadDetails(firstProductData, key, { silent: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to load exceptions.');
    } finally {
      setLoading(false);
    }
  }, [loadDetails]);

  async function toggleDetails(item) {
    const key = `${item.category}-${item.title}`;
    const isExpanded = expandedKey === key;

    setExpandedKey(isExpanded ? '' : key);
    if (!isExpanded) await loadDetails(item, key);
  }

  useEffect(() => { load(); }, [load]);

  return (
    <main className="page phase6-page">
      <div className="page-header-row">
        <div>
          <h1>Exception Center</h1>
          <p className="muted">One place to find problems that need attention before they affect production or customers.</p>
        </div>
        <button className="button" onClick={load}>Refresh</button>
      </div>

      <section className="phase6-kpi-grid">
        <div className="phase6-kpi-card"><span>Total exceptions</span><strong>{total}</strong></div>
        <div className="phase6-kpi-card"><span>High severity</span><strong>{highSeverityTotal}</strong></div>
        <div className="phase6-kpi-card"><span>OK categories</span><strong>{items.filter((item) => Number(item.count || 0) === 0).length}</strong></div>
      </section>

      {loading && <p>Loading…</p>}
      {error && <div className="error-card">{error}</div>}
      {detailError && <div className="error-card">{detailError}</div>}

      <section className="phase6-card-grid">
        {items.map((item) => {
          const key = `${item.category}-${item.title}`;
          const rows = detailRows[key] || [];
          const expanded = expandedKey === key;
          const canShowDetails = Number(item.count || 0) > 0 && isProductDataException(item);

          return (
            <article key={key} className={`phase6-card severity-${item.severity || 'ok'}`}>
              <div className="phase6-card-top">
                <span className="phase6-pill">{item.category}</span>
                <span className="phase6-count">{item.count}</span>
              </div>
              <h2>{item.title}</h2>
              <p className="muted">Severity: {item.severity}</p>

              <div className="sc-button-row">
                {item.route && <Link className="button button-primary" to={item.route}>Open full report</Link>}
                {canShowDetails ? (
                  <button className="button" type="button" onClick={() => toggleDetails(item)}>
                    {expanded ? 'Hide details' : 'Show first 100 issues'}
                  </button>
                ) : null}
              </div>

              {expanded ? (
                <div className="sc-responsive-table-wrap" style={{ marginTop: 12 }}>
                  {detailLoading === key ? <p>Loading issue details…</p> : null}
                  {!detailLoading && !rows.length ? <p className="muted">No detailed rows were returned for this category.</p> : null}
                  {rows.length ? (
                    <table className="sc-table">
                      <thead>
                        <tr>
                          <th>Issue</th>
                          <th>SKU</th>
                          <th>Product</th>
                          <th>Brand</th>
                          <th>Style</th>
                          <th>Color</th>
                          <th>Size</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={`${row.issue_type}-${row.product_id}-${index}`}>
                            <td>{value(row.issue_type)}</td>
                            <td>{value(row.sku, row.sku_base)}</td>
                            <td>{value(row.product_name, row.name)}</td>
                            <td>{value(row.brand_name, row.brand)}</td>
                            <td>{value(row.style_name, row.product_type, row.style)}</td>
                            <td>{value(row.color_name, row.color)}</td>
                            <td>{value(row.size_name, row.size)}</td>
                            <td>{value(row.detail, row.message)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {Number(item.count || 0) > rows.length ? (
                    <p className="muted">Showing first {rows.length} of {item.count}. Open the full report to work through all issues.</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
