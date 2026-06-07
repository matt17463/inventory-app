import { useEffect, useState } from 'react';
import { getTestingModeSettings, testingModeLabel } from './lib/testingMode';

export default function TestingModeBanner() {
  const [settings, setSettings] = useState(getTestingModeSettings());

  useEffect(() => {
    const handler = (event) => setSettings(event.detail || getTestingModeSettings());
    window.addEventListener('sc-testing-mode-change', handler);
    return () => window.removeEventListener('sc-testing-mode-change', handler);
  }, []);

  if (!settings.enabled || !settings.showBanner) return null;

  return (
    <div className="testing-mode-banner" role="status">
      <strong>{testingModeLabel()}</strong>
      <span>{settings.simulateWrites ? 'Supported write actions will be simulated.' : 'Live data can still be changed. Extra confirmations are enabled.'}</span>
    </div>
  );
}
