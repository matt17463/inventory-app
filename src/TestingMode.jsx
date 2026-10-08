import { useEffect, useState } from 'react';
import { getTestingModeSettings, saveTestingModeSettings, testingModeLabel } from './lib/testingMode';

export default function TestingMode() {
  const [settings, setSettings] = useState(getTestingModeSettings());
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = (event) => setSettings(event.detail || getTestingModeSettings());
    window.addEventListener('sc-testing-mode-change', handler);
    return () => window.removeEventListener('sc-testing-mode-change', handler);
  }, []);

  function update(patch) {
    const next = saveTestingModeSettings({ ...settings, ...patch });
    setSettings(next);
    setMessage('Testing mode settings saved for this browser.');
  }

  return (
    <main className="page testing-mode-page">
      <section className="page-hero compact-hero">
        <span className="eyebrow">Tools & Admin</span>
        <h1>Testing Mode</h1>
        <p>Use testing mode when you want to test workflows without accidentally changing production data.</p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card testing-mode-card">
        <h2>{testingModeLabel()}</h2>
        <p className="muted">These settings are stored in this browser. They do not change Supabase credentials and they do not affect other employees.</p>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          <span><strong>Enable testing mode</strong><small>Shows testing banners and activates extra safeguards.</small></span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.simulateWrites}
            disabled={!settings.enabled}
            onChange={(event) => update({ simulateWrites: event.target.checked })}
          />
          <span><strong>Simulate supported writes</strong><small>Supported actions, including Client Orders conversion and pull sheet cancellation, are simulated instead of changing live production records.</small></span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.requireConfirmation}
            disabled={!settings.enabled}
            onChange={(event) => update({ requireConfirmation: event.target.checked })}
          />
          <span><strong>Require extra confirmation</strong><small>High-impact actions ask for an additional confirmation.</small></span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.showBanner}
            disabled={!settings.enabled}
            onChange={(event) => update({ showBanner: event.target.checked })}
          />
          <span><strong>Show testing banner</strong><small>Displays a visible reminder that this browser is in testing mode.</small></span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(settings.guidedTraining)}
            disabled={!settings.enabled}
            onChange={(event) => update({ guidedTraining: event.target.checked })}
          />
          <span><strong>Guided employee training</strong><small>Marks this browser as being used for onboarding and directs the employee to role-based tutorials. It does not make unsupported workflows non-mutating.</small></span>
        </label>

        {settings.enabled&&settings.guidedTraining&&(
          <label className="sc-field" style={{marginTop:12}}>
            <span>Training role</span>
            <select value={settings.trainingRole||'new-employee'} onChange={(event)=>update({trainingRole:event.target.value})}>
              <option value="new-employee">New Employee</option>
              <option value="warehouse">Receiving / Warehouse</option>
              <option value="production">Production</option>
              <option value="artwork">Artwork / Customer Admin</option>
              <option value="manager">Manager</option>
              <option value="owner-admin">Owner / Admin</option>
            </select>
          </label>
        )}
      </section>

      {settings.enabled&&settings.guidedTraining&&(
        <section className="card elevated-card">
          <h2>Guided training is active</h2>
          <p>Open the Employee Training Center and follow the tutorials for this role. Training progress is saved in this browser.</p>
          <div className="button-row"><a className="primary-button" href="/application-guide#employee-training">Open Employee Training Center</a></div>
          <p className="muted"><strong>Important:</strong> simulated writes currently protect only workflows that explicitly support simulation. A training banner is not a sandbox for the entire production application.</p>
        </section>
      )}

      <section className="card elevated-card">
        <h2>Recommended use</h2>
        <p>For everyday testing, enable testing mode and simulated writes before trying a workflow. Client Orders now supports a fully non-mutating browser simulation through mapping, pricing, approval, payment, and production conversion. For broader application testing, a separate Netlify deploy connected to a separate Supabase test project remains the safest option.</p>
        <ol className="simple-steps">
          <li>Turn on testing mode.</li>
          <li>Turn on simulated writes.</li>
          <li>Run the workflow you want to test.</li>
          <li>Confirm the screen behavior and messages.</li>
          <li>Turn testing mode off before returning to production work.</li>
        </ol>
      </section>
    </main>
  );
}
