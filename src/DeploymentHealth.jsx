import { useEffect, useMemo, useState } from 'react';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';

function statusClass(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'pass') return 'health-pass';
  if (['warn', 'warning', 'review'].includes(value)) return 'health-warning';
  return 'health-fail';
}

export default function DeploymentHealth() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [deep, setDeep] = useState(false);

  async function loadHealth(nextDeep = deep) {
    setBusy(true);
    setMessage('Running deployment checks...');
    try {
      const response = await authenticatedFunctionFetch(`/.netlify/functions/deployment-health?deep=${nextDeep ? 'true' : 'false'}`, { method: 'GET' });
      const payload = await response.json().catch(() => ({}));
      setResult(payload);
      setMessage(response.ok ? 'Health check completed.' : (payload?.error || 'One or more checks failed.'));
    } catch (error) {
      setResult(null);
      setMessage(error.message || 'Health check failed.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadHealth(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const check of result?.checks || []) {
      const category = check.category || 'other';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(check);
    }
    return [...groups.entries()];
  }, [result]);

  return (
    <main className="page sc-page-stack deployment-health-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Tools &amp; Admin</p>
          <h1>Deployment Health</h1>
          <p>Checks configuration presence, required database objects, private storage, release markers, and optional WooCommerce connectivity. Secret values are never displayed.</p>
        </div>
        <div className="button-row">
          <label className="checkbox-line">
            <input type="checkbox" checked={deep} onChange={(event) => setDeep(event.target.checked)} />
            Include WooCommerce connection test
          </label>
          <button disabled={busy} onClick={() => loadHealth(deep)}>{busy ? 'Checking…' : 'Run Checks'}</button>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      {result?.summary && (
        <section className="card summary-pills">
          <span>{result.summary.total} checks</span>
          <span className="health-pass">{result.summary.passed} passed</span>
          <span className="health-warning">{result.summary.warnings} warnings</span>
          <span className="health-fail">{result.summary.failed} failed</span>
        </section>
      )}

      {grouped.map(([category, checks]) => (
        <section className="card table-card" key={category}>
          <h2>{category.replaceAll('_', ' ')}</h2>
          <div className="responsive-table">
            <table className="data-table">
              <thead><tr><th>Status</th><th>Check</th><th>Detail</th></tr></thead>
              <tbody>
                {checks.map((check, index) => (
                  <tr key={`${check.check_name}-${index}`}>
                    <td><strong className={statusClass(check.status)}>{check.status}</strong></td>
                    <td>{check.check_name}</td>
                    <td>{check.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <style>{`.deployment-health-page .health-pass{color:#166534}.deployment-health-page .health-warning{color:#9a3412}.deployment-health-page .health-fail{color:#b91c1c}.deployment-health-page h2{text-transform:capitalize}.deployment-health-page code{overflow-wrap:anywhere}`}</style>
    </main>
  );
}
