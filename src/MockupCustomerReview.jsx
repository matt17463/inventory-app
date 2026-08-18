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
  const [submittedDecision, setSubmittedDecision] = useState('');

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
    if (!selectedOutputId) { setSubmittedDecision('error'); setMessage('Choose a mockup first.'); return; }
    if (decision === 'changes_requested' && !form.notes.trim()) { setSubmittedDecision('error'); setMessage('Describe the requested change.'); return; }
    setBusy(true); setMessage(''); setSubmittedDecision('');
    try {
      const response = await fetch('/.netlify/functions/mockup-customer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, output_id: selectedOutputId, decision, ...form }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Feedback could not be saved.');
      setSubmittedDecision(decision);
      setData((current) => current ? {
        ...current,
        project: {
          ...current.project,
          status: decision === 'approved' ? 'approved' : 'changes_requested',
        },
        outputs: current.outputs.map((output) => output.id === selectedOutputId ? {
          ...output,
          approval_status: decision === 'approved' ? 'customer_approved' : 'changes_requested',
        } : output),
      } : current);
      setMessage(decision === 'approved' ? 'Thank you. Your approval has been recorded.' : 'Thank you. Your requested changes have been sent to Skilled Crafting.');
    } catch (error) { setSubmittedDecision('error'); setMessage(error.message); }
    finally { setBusy(false); }
  }

  const selectedOutput = data?.outputs?.find((output) => output.id === selectedOutputId) || null;
  const approvalComplete = submittedDecision === 'approved'
    || data?.project?.status === 'approved'
    || selectedOutput?.approval_status === 'customer_approved';
  const changesComplete = submittedDecision === 'changes_requested';

  return (
    <main className="mockup-review-page">
      <header className="mockup-review-header">
        <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" />
        <div><p>Private Mockup Review</p><h1>{data?.project?.project_name || 'Loading your mockups…'}</h1><span>{data?.project?.customer_name || ''}</span></div>
      </header>
      {message && !data ? <p className="message" role="alert">{message}</p> : null}
      {data ? (
        <>
          <p className="mockup-review-intro">Select a mockup, then approve it or request a specific change. This link displays only the mockups prepared for this project.</p>
          <div className="mockup-review-grid">
            {data.outputs.map((output) => (
              <button type="button" key={output.id} className={selectedOutputId === output.id ? 'selected' : ''} onClick={() => { setSelectedOutputId(output.id); setMessage(''); setSubmittedDecision(''); }}>
                <img src={output.signed_url} alt={output.caption_text || output.output_name} />
                <strong>{output.caption_text || output.output_name}</strong>
              </button>
            ))}
          </div>
          <section className="mockup-review-form">
            <label>Name<input value={form.reviewer_name} onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })} /></label>
            <label>Email<input type="email" value={form.reviewer_email} onChange={(e) => setForm({ ...form, reviewer_email: e.target.value })} /></label>
            <label>Comments or requested changes<textarea rows="5" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            {message ? <p className={`mockup-review-feedback ${submittedDecision === 'error' ? 'error' : 'success'}`} role={submittedDecision === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p> : null}
            <div className="mockup-review-actions">
              <button type="button" className="approve" disabled={busy || approvalComplete || changesComplete} onClick={() => submit('approved')}>{busy ? 'Saving…' : approvalComplete ? 'Mockup Approved ✓' : 'Approve Selected Mockup'}</button>
              <button type="button" className="changes" disabled={busy || approvalComplete || changesComplete} onClick={() => submit('changes_requested')}>{busy ? 'Saving…' : changesComplete ? 'Changes Submitted ✓' : 'Request Changes'}</button>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

