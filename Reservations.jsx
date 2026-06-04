import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPullSheet, getPullSheets, pullSheetStatusLabel } from './lib/inventoryApi';

export default function PullSheetList() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    jobName: '',
    customerName: '',
    orderNumber: '',
    dueDate: '',
    notes: '',
  });

  async function load() {
    setMessage('');
    try {
      const rows = await getPullSheets();
      setJobs(rows);
    } catch (err) {
      setMessage(err.message || 'Failed to load pull sheets.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setCreating(true);
    setMessage('');

    try {
      const job = await createPullSheet(form);
      setForm({ jobName: '', customerName: '', orderNumber: '', dueDate: '', notes: '' });
      navigate(`/pullsheets/${job.id}`);
    } catch (err) {
      setMessage(err.message || 'Failed to create pull sheet.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="page pullsheet-list-page">
      <h1>Pull Sheets</h1>
      <p className="muted">
        Create a pull sheet for a job, add the blank garments needed, then choose whether to use finished stock or pull blanks from inventory.
      </p>

      {message && <p className="message">{message}</p>}

      <section className="content-two-column">
        <form onSubmit={submit} className="card elevated-card">
          <h2>Create Pull Sheet</h2>

          <label>
            Job Name
            <input
              value={form.jobName}
              onChange={(event) => setForm((prev) => ({ ...prev, jobName: event.target.value }))}
              placeholder="North Mason Fastpitch hoodies"
              required
            />
          </label>

          <label>
            Customer
            <input
              value={form.customerName}
              onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
              placeholder="Customer, school, team, or organization"
            />
          </label>

          <label>
            Order Number
            <input
              value={form.orderNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, orderNumber: event.target.value }))}
              placeholder="WooCommerce/order reference if available"
            />
          </label>

          <label>
            Due Date
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </label>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Production notes, decoration method, etc."
            />
          </label>

          <button className="primary-action" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Pull Sheet'}
          </button>
        </form>

        <section className="card elevated-card">
          <h2>How Pull Sheets Work</h2>
          <ol className="simple-steps">
            <li>Create a pull sheet for the job.</li>
            <li>Add each blank item needed by searching your blank inventory.</li>
            <li>For each line, use matching finished stock if available.</li>
            <li>If finished stock is not available, deduct the blank from its bin after pulling it.</li>
            <li>Return decorated extras to a finished-products bin for future orders.</li>
          </ol>
        </section>
      </section>

      <section className="card elevated-card">
        <h2>Existing Pull Sheets</h2>

        {!jobs.length ? (
          <p className="muted">No pull sheets found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.job_name}</td>
                  <td>{job.woocommerce_order_id || ''}</td>
                  <td>{job.customer_name || ''}</td>
                  <td>{pullSheetStatusLabel(job.status)}</td>
                  <td>{job.due_date || ''}</td>
                  <td><Link to={`/pullsheets/${job.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
