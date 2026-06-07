import React from 'react';
import { PageHeader, HelpPanel, SectionCard, ActionButton, FieldGrid, FormField } from './components/UIPrimitives';
import { useTheme } from './ui/ThemeProvider';
import DarkModeToggle from './components/DarkModeToggle';

export default function ThemeSettings() {
  const { theme, setDensity, setShowHelp } = useTheme();
  return (
    <main className="sc-page sc-theme-settings-page">
      <PageHeader
        eyebrow="APP SETTINGS"
        title="Display & Layout Settings"
        description="Adjust the app appearance for shop floor use, office work, and low-light production areas."
        actions={<DarkModeToggle />}
      />
      <HelpPanel>
        <p>Dark mode is saved in the browser on this device. It is useful on shop computers, wall displays, and production stations where bright screens are distracting.</p>
      </HelpPanel>
      <SectionCard title="Layout Preferences" description="Choose how dense the app should feel and whether help panels should be visible.">
        <FieldGrid>
          <FormField label="Page density">
            <select value={theme.density || 'comfortable'} onChange={(e) => setDensity(e.target.value)}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
              <option value="spacious">Spacious</option>
            </select>
          </FormField>
          <FormField label="Help panels">
            <select value={theme.showHelp === false ? 'hidden' : 'visible'} onChange={(e) => setShowHelp(e.target.value === 'visible')}>
              <option value="visible">Show help panels</option>
              <option value="hidden">Hide help panels</option>
            </select>
          </FormField>
        </FieldGrid>
      </SectionCard>
      <SectionCard title="Preview" description="This is how cards, buttons, and fields will appear.">
        <div className="sc-button-row">
          <ActionButton tone="primary">Primary Action</ActionButton>
          <ActionButton tone="secondary">Secondary Action</ActionButton>
          <ActionButton tone="warning">Needs Review</ActionButton>
          <ActionButton tone="danger">Cancel/Delete</ActionButton>
        </div>
      </SectionCard>
    </main>
  );
}
