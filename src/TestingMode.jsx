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
          <span><strong>Simulate supported writes</strong><small>Supported actions, such as pull sheet cancellation, log a test event instead of changing live records.</small></span>
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
      </section>

      <section className="card elevated-card">
        <h2>Recommended use</h2>
        <p>For everyday testing, enable testing mode and simulated writes before trying a workflow. For full end-to-end testing, the safest option is a separate Netlify deploy connected to a separate Supabase test project.</p>
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
