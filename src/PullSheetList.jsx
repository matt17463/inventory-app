import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPullSheets } from './lib/inventoryApi';

export default function PullSheetList() {
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getPullSheets()
      .then(setJobs)
      .catch((err) => setMessage(err.message || 'Failed to load pull sheets.'));
  }, []);

  return (
    <main className="page">
      <h1>Pull Sheets</h1>

      {message && <p className="message">{message}</p>}

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
              <td>{job.status}</td>
              <td>{job.due_date || ''}</td>
              <td><Link to={`/pullsheets/${job.id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
