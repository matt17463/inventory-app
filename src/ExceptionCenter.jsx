import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getExceptionCenter } from './lib/phase6Api';

export default function ExceptionCenter() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setItems(await getExceptionCenter()); }
    catch (err) { setError(err.message || 'Failed to load exceptions.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);

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
        <div className="phase6-kpi-card"><span>High severity</span><strong>{items.filter(i => i.severity === 'high').reduce((s, i) => s + Number(i.count || 0), 0)}</strong></div>
        <div className="phase6-kpi-card"><span>OK categories</span><strong>{items.filter(i => Number(i.count || 0) === 0).length}</strong></div>
      </section>

      {loading && <p>Loading…</p>}
      {error && <div className="error-card">{error}</div>}

      <section className="phase6-card-grid">
        {items.map((item) => (
          <article key={`${item.category}-${item.title}`} className={`phase6-card severity-${item.severity || 'ok'}`}>
            <div className="phase6-card-top">
              <span className="phase6-pill">{item.category}</span>
              <span className="phase6-count">{item.count}</span>
            </div>
            <h2>{item.title}</h2>
            <p className="muted">Severity: {item.severity}</p>
            {item.route && <Link className="button button-primary" to={item.route}>Open</Link>}
          </article>
        ))}
      </section>
    </main>
  );
}
