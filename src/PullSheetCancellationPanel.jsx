import { useEffect, useState } from 'react';
import { cancelPullSheet, getPullSheetCancelPreview } from './lib/pullSheetCancelApi';
import { requireTestingConfirmation, testingModeLabel } from './lib/testingMode';

export default function PullSheetCancellationPanel({ jobId, currentStatus, onCancelled }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('Customer cancelled order');
  const [notes, setNotes] = useState('');
  const [releaseReservations, setReleaseReservations] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open || !jobId) return;
    getPullSheetCancelPreview(jobId)
      .then(setPreview)
      .catch((err) => setMessage(err.message || 'Could not load cancellation preview.'));
  }, [open, jobId]);

  async function handleCancel() {
    if (!reason.trim()) {
      setMessage('Enter a cancellation reason before cancelling.');
      return;
    }

    if (requireTestingConfirmation()) {
      const confirmed = window.confirm(`${testingModeLabel()}\n\nContinue with this cancellation workflow?`);
      if (!confirmed) return;
    }

    const confirmed = window.confirm('Cancel this pull sheet? This will mark the job cancelled and can release open reservations.');
    if (!confirmed) return;

    setBusy(true);
    setMessage('');
    try {
      const result = await cancelPullSheet({
        jobId,
        reason,
        notes,
        releaseReservations,
        cancelledBy: 'Inventory app user',
      });
      setMessage(result?.message || 'Pull sheet cancelled.');
      if (onCancelled) await onCancelled(result);
      setOpen(false);
    } catch (err) {
      setMessage(err.message || 'Failed to cancel pull sheet.');
    } finally {
      setBusy(false);
    }
  }

  if (currentStatus === 'cancelled') {
    return <div className="cancelled-pullsheet-note">This pull sheet is cancelled.</div>;
  }

  return (
    <div className="pullsheet-cancel-panel">
      <button type="button" className="danger-outline-button" onClick={() => setOpen((value) => !value)}>
        {open ? 'Close Cancellation' : 'Cancel Pull Sheet'}
      </button>

      {open && (
        <section className="cancel-panel-card">
          <h3>Cancel Pull Sheet</h3>
          <p className="muted">Cancelling keeps the history but removes the job from active production. Open reservations can be released so blanks become available again.</p>
          {message && <p className="message">{message}</p>}
          {preview && (
            <div className="cancel-preview-grid">
              <div><strong>Status</strong><span>{preview.current_status || 'Unknown'}</span></div>
              <div><strong>Lines</strong><span>{preview.job_item_count || 0}</span></div>
              <div><strong>Completed lines</strong><span>{preview.completed_item_count || 0}</span></div>
              <div><strong>Open reservations</strong><span>{preview.open_reservation_count || 0}</span></div>
            </div>
          )}
          {preview?.warning && <p className="warning-note">{preview.warning}</p>}

          <label>Cancellation reason
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option>Customer cancelled order</option>
              <option>Duplicate pull sheet</option>
              <option>Created by mistake</option>
              <option>Order changed / will regenerate</option>
              <option>Payment issue</option>
              <option>Other</option>
            </select>
          </label>
          <label>Cancellation notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional details for the audit log" />
          </label>
          <label className="toggle-row compact-toggle">
            <input type="checkbox" checked={releaseReservations} onChange={(event) => setReleaseReservations(event.target.checked)} />
            <span><strong>Release/cancel open reservations</strong><small>Recommended unless you intentionally want inventory to remain reserved.</small></span>
          </label>
          <button type="button" className="danger-button" disabled={busy || preview?.can_cancel === false} onClick={handleCancel}>
            {busy ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </section>
      )}
    </div>
  );
}
