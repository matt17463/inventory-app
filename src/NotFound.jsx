import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();
  return (
    <main className="page sc-page-stack">
      <section className="card elevated-card">
        <p className="eyebrow">Navigation</p>
        <h1>Page not found</h1>
        <p>The address <code>{location.pathname}</code> does not match an active application page.</p>
        <div className="button-row">
          <Link className="button" to="/">Dashboard</Link>
          <Link className="button secondary" to="/inventory/blanks">Blank Inventory</Link>
          <Link className="button secondary" to="/pullsheets">Pull Sheets</Link>
        </div>
      </section>
    </main>
  );
}
