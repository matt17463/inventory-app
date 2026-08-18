import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './MockupStudio.css';

export default function MockupCustomerReview() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [data, setData] = useState(null);
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [form, setForm] = useState({ reviewer_name: '', reviewer_email: '', notes: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setMessage('This review link is incomplete.'); return; }
    fetch(`/.netlify/functions/mockup-customer-review?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || payload.message || 'The review link could not be opened.');
        return payload;
      })
      .then((payload) => { setData(payload); setSelectedOutputId(payload.outputs?.[0]?.id || ''); })
      .catch((error) => setMessage(error.message));
  }, [token]);

  async function submit(decision) {
    if (!selectedOutputId) { setMessage('Choose a mockup first.'); return; }
    if (decision === 'changes_requested' && !form.notes.trim()) { setMessage('Describe the requested change.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/.netlify/functions/mockup-customer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, output_id: selectedOutputId, decision, ...form }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Feedback could not be saved.');
      setMessage(decision === 'approved' ? 'Thank you. Your approval has been recorded.' : 'Thank you. Your requested changes have been sent to Skilled Crafting.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return (
    <main className="mockup-review-page">
      <header className="mockup-review-header">
        <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" />
        <div><p>Private Mockup Review</p><h1>{data?.project?.project_name || 'Loading your mockups…'}</h1><span>{data?.project?.customer_name || ''}</span></div>
      </header>
      {message ? <p className="message">{message}</p> : null}
      {data ? (
        <>
          <p className="mockup-review-intro">Select a mockup, then approve it or request a specific change. This link displays only the mockups prepared for this project.</p>
          <div className="mockup-review-grid">
            {data.outputs.map((output) => (
              <button type="button" key={output.id} className={selectedOutputId === output.id ? 'selected' : ''} onClick={() => setSelectedOutputId(output.id)}>
                <img src={output.signed_url} alt={output.caption_text || output.output_name} />
                <strong>{output.caption_text || output.output_name}</strong>
              </button>
            ))}
          </div>
          <section className="mockup-review-form">
            <label>Name<input value={form.reviewer_name} onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })} /></label>
            <label>Email<input type="email" value={form.reviewer_email} onChange={(e) => setForm({ ...form, reviewer_email: e.target.value })} /></label>
            <label>Comments or requested changes<textarea rows="5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="mockup-review-actions"><button type="button" className="approve" disabled={busy} onClick={() => submit('approved')}>Approve Selected Mockup</button><button type="button" className="changes" disabled={busy} onClick={() => submit('changes_requested')}>Request Changes</button></div>
          </section>
        </>
      ) : null}
    </main>
  );
}
