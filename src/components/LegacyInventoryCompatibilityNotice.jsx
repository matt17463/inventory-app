import { Link } from 'react-router-dom';

export default function LegacyInventoryCompatibilityNotice({
  title = 'Legacy inventory screen retired',
  description = 'This older screen used a separate direct-to-bin inventory model. It has been disabled to protect the inventory and order data already in use.',
}) {
  return (
    <div className="page">
      <section className="card" style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1>{title}</h1>
        <p>{description}</p>
        <p>
          Use the current blank receiving workflow to create or receive missing blank products. Use Edit Blank Items to correct an existing blank product without changing its inventory history.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
          <Link className="button" to="/add-item">Receive or create blank items</Link>
          <Link className="button secondary" to="/inventory/edit-blanks">Edit blank products</Link>
          <Link className="button secondary" to="/inventory/blanks">View blank inventory</Link>
        </div>
      </section>
    </div>
  );
}
