import React from 'react';
import {
  ActionButton,
  FieldGrid,
  FormField,
  HelpPanel,
  PageHeader,
  SectionCard,
  StatusBadge,
} from './components/UIPrimitives';
import DarkModeToggle from './components/DarkModeToggle';
import { THEME_PRESETS, getThemePreset } from './themePresets';
import { useTheme } from './ui/ThemeProvider';

function ThemePreviewCard({ preset, selected, onSelect }) {
  const previewStyle = {
    '--preview-background': preset.preview.background,
    '--preview-panel': preset.preview.panel,
    '--preview-sidebar': preset.preview.sidebar,
    '--preview-primary': preset.preview.primary,
    '--preview-accent': preset.preview.accent,
    '--preview-text': preset.preview.text,
  };

  return (
    <article
      className={`sc-theme-choice ${selected ? 'selected' : ''}`}
      style={previewStyle}
      aria-current={selected ? 'true' : undefined}
    >
      <button
        type="button"
        className={`sc-theme-choice__preview sc-theme-choice__preview--${preset.visualStyle}`}
        onClick={() => onSelect(preset.id)}
        aria-label={`Apply ${preset.name} theme`}
      >
        <span className="sc-theme-choice__mini-sidebar">
          <span className="brand-mark" />
          <span />
          <span />
          <span />
        </span>
        <span className="sc-theme-choice__mini-main">
          <span className="sc-theme-choice__mini-topbar">
            <span className="mini-title" />
            <span className="mini-control" />
          </span>
          <span className="sc-theme-choice__mini-content">
            <span className="sc-theme-choice__mini-card wide">
              <span className="mini-kicker" />
              <span className="mini-heading" />
            </span>
            <span className="sc-theme-choice__mini-grid">
              <span className="sc-theme-choice__mini-card">
                <span className="mini-metric" />
              </span>
              <span className="sc-theme-choice__mini-card accent">
                <span className="mini-metric" />
              </span>
            </span>
            <span className="sc-theme-choice__mini-footer">
              <span className="sc-theme-choice__mini-chip" />
              <span className="sc-theme-choice__mini-button" />
            </span>
          </span>
        </span>
      </button>

      <div className="sc-theme-choice__body">
        <div className="sc-theme-choice__heading">
          <div>
            <span className="sc-theme-choice__icon" aria-hidden="true">{preset.icon}</span>
            <div>
              <small className="sc-theme-choice__category">{preset.category}</small>
              <h3>{preset.name}</h3>
            </div>
          </div>
          {selected ? <StatusBadge status="Selected" tone="success" /> : null}
        </div>
        <p>{preset.description}</p>
        <small><strong>Best for:</strong> {preset.bestFor}</small>
        <div className="sc-theme-traits" aria-label={`${preset.name} graphical traits`}>
          {preset.traits.map((trait) => <span key={trait}>{trait}</span>)}
        </div>
        <div className="sc-theme-swatches" aria-label={`${preset.name} color palette`}>
          {Object.entries(preset.preview).map(([name, color]) => (
            <span
              key={name}
              title={`${name}: ${color}`}
              style={{ background: color }}
            />
          ))}
        </div>
        <ActionButton
          tone={selected ? 'secondary' : 'primary'}
          onClick={() => onSelect(preset.id)}
          disabled={selected}
        >
          {selected ? 'Theme Applied' : 'Apply Theme'}
        </ActionButton>
      </div>
    </article>
  );
}

function ModeChoice({ value, active, icon, label, description, onSelect }) {
  return (
    <button
      type="button"
      className={`sc-display-option ${active ? 'active' : ''}`}
      onClick={() => onSelect(value)}
      aria-pressed={active}
    >
      <span className="sc-display-option__icon" aria-hidden="true">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

export default function ThemeSettings() {
  const {
    theme,
    setPreset,
    setMode,
    setDensity,
    setShowHelp,
    setReduceMotion,
    resetTheme,
  } = useTheme();
  const activePreset = getThemePreset(theme.preset);

  const handleReset = () => {
    const confirmed = window.confirm(
      'Reset the display to Professional Enterprise, system appearance, comfortable spacing, and visible help panels?',
    );
    if (confirmed) resetTheme();
  };

  return (
    <main className="sc-page sc-theme-settings-page">
      <PageHeader
        eyebrow="APP SETTINGS"
        title="Visual Themes & Interface Styles"
        description="Change the full visual language of the application—including typography, button geometry, cards, tables, backgrounds, navigation, and decorative graphics—without changing workflow functionality."
        actions={<DarkModeToggle />}
      >
        <div className="sc-theme-current-summary">
          <span>Current theme</span>
          <strong>{activePreset.name}</strong>
          <span>•</span>
          <strong>{theme.mode === 'system' ? `System (${theme.effectiveMode})` : theme.mode}</strong>
          <span>•</span>
          <strong>{theme.density}</strong>
        </div>
      </PageHeader>

      <HelpPanel title="Themes change appearance only">
        <p>
          These settings change typography, button shapes, card construction, table treatments,
          navigation styling, backgrounds, decorative graphics, color, and spacing. They do not
          change Supabase data, WooCommerce synchronization, pull-sheet behavior,
          purchasing calculations, routes, or permissions. Preferences are saved only in this browser.
        </p>
      </HelpPanel>

      <SectionCard
        title="Choose a visual theme"
        description="Each preset has its own graphical design language. Select one for an immediate live preview; every preset supports light, dark, and system appearance modes."
      >
        <div className="sc-theme-choice-grid">
          {THEME_PRESETS.map((preset) => (
            <ThemePreviewCard
              key={preset.id}
              preset={preset}
              selected={theme.preset === preset.id}
              onSelect={setPreset}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Appearance mode"
        description="System follows the light or dark preference configured on this computer."
      >
        <div className="sc-display-option-grid">
          <ModeChoice
            value="light"
            active={theme.mode === 'light'}
            icon="☀️"
            label="Light"
            description="Bright surfaces for office and daytime use."
            onSelect={setMode}
          />
          <ModeChoice
            value="dark"
            active={theme.mode === 'dark'}
            icon="🌙"
            label="Dark"
            description="Reduced glare for evening and low-light areas."
            onSelect={setMode}
          />
          <ModeChoice
            value="system"
            active={theme.mode === 'system'}
            icon="◐"
            label="System"
            description="Automatically follows this device."
            onSelect={setMode}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Layout preferences"
        description="Use compact spacing for information-heavy screens or spacious controls for touch use."
      >
        <FieldGrid>
          <FormField
            label="Page density"
            help="Changes spacing and control size; it does not hide data."
          >
            <select
              value={theme.density}
              onChange={(event) => setDensity(event.target.value)}
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </FormField>

          <FormField
            label="Help panels"
            help="Help panels can be restored at any time from this page."
          >
            <select
              value={theme.showHelp ? 'visible' : 'hidden'}
              onChange={(event) => setShowHelp(event.target.value === 'visible')}
            >
              <option value="visible">Show help panels</option>
              <option value="hidden">Hide help panels</option>
            </select>
          </FormField>

          <FormField
            label="Animation"
            help="Reduced motion removes decorative transitions and movement."
          >
            <select
              value={theme.reduceMotion ? 'reduced' : 'full'}
              onChange={(event) => setReduceMotion(event.target.value === 'reduced')}
            >
              <option value="full">Standard animation</option>
              <option value="reduced">Reduce animation</option>
            </select>
          </FormField>
        </FieldGrid>
      </SectionCard>

      <SectionCard
        title="Live component preview"
        description="Use this area to compare the active theme’s typography, control geometry, status treatments, card construction, and table styling."
      >
        <div className="sc-theme-live-preview">
          <div className="sc-theme-live-preview__metrics">
            <div className="sc-metric-card sc-metric-card--default">
              <div className="sc-metric-card__value">248</div>
              <div className="sc-metric-card__label">Units On Hand</div>
              <div className="sc-metric-card__note">Normal inventory metric</div>
            </div>
            <div className="sc-metric-card sc-metric-card--warning">
              <div className="sc-metric-card__value">7</div>
              <div className="sc-metric-card__label">Pending Stock</div>
              <div className="sc-metric-card__note">Purchasing attention required</div>
            </div>
          </div>

          <div className="sc-button-row">
            <ActionButton tone="primary">Primary Action</ActionButton>
            <ActionButton tone="secondary">Secondary Action</ActionButton>
            <ActionButton tone="warning">Needs Review</ActionButton>
            <ActionButton tone="danger">Cancel/Delete</ActionButton>
          </div>

          <div className="sc-theme-preview-statuses">
            <StatusBadge status="Ready to Pull" />
            <StatusBadge status="Pending Stock" />
            <StatusBadge status="Completed" />
            <StatusBadge status="Failed" />
          </div>

          <div className="sc-responsive-table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>BC-3001-NVY-AL</td>
                  <td>Performance Tee / Navy / Adult Large</td>
                  <td><StatusBadge status="In Stock" /></td>
                  <td>12</td>
                </tr>
                <tr>
                  <td>PC-8500-BLK-AM</td>
                  <td>Cotton Tee / Black / Adult Medium</td>
                  <td><StatusBadge status="Pending Stock" /></td>
                  <td>3</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Reset display settings"
        description="Returns this browser to Professional Enterprise with system appearance and comfortable spacing."
        actions={(
          <ActionButton tone="danger" onClick={handleReset}>
            Reset to Default
          </ActionButton>
        )}
      >
        <p className="helper-text">
          Resetting a theme does not modify application records or remove saved inventory data.
        </p>
      </SectionCard>
    </main>
  );
}
