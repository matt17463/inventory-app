import { useEffect, useState } from 'react';
import { getActivityFeed } from './lib/inventoryApi';

export default function ActivityPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getActivityFeed(100).then(setRows).catch((err) => setMessage(err.message || 'Failed to load activity feed.'));
  }, []);

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Audit Trail</p>
          <h1>Activity Feed</h1>
          <p className="helper-text">Every receive, transfer, reservation, audit, and adjustment is logged here.</p>
        </div>
      </div>
      {message && <p className="message">{message}</p>}
      <section className="card wide-card activity-list">
        {rows.map((row) => (
          <div key={row.id} className="activity-row full">
            <strong>{row.activity_type}</strong>
            <span>{row.description}</span>
            <small>{new Date(row.created_at).toLocaleString()}</small>
          </div>
        ))}
        {rows.length === 0 && <p>No activity yet.</p>}
      </section>
    </main>
  );
}
