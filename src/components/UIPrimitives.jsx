import React, { useRef, useState } from 'react';
import { useTheme } from '../ui/themeContext';

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="sc-page-header">
      <div>
        {eyebrow ? <div className="sc-page-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="sc-page-actions">{actions}</div> : null}
    </header>
  );
}

export function HelpPanel({ title = 'How to use this page', children }) {
  const { theme } = useTheme();
  if (theme.showHelp === false) return null;
  return (
    <section className="sc-help-panel">
      <div className="sc-help-panel__icon">?</div>
      <div>
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    </section>
  );
}

export function SectionCard({ title, description, actions, children, tone = 'default' }) {
  return (
    <section className={`sc-section-card sc-section-card--${tone}`}>
      {(title || description || actions) && (
        <div className="sc-section-card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="sc-section-card__actions">{actions}</div> : null}
        </div>
      )}
      <div className="sc-section-card__body">{children}</div>
    </section>
  );
}

export function StatusBadge({ status, tone }) {
  const normalized = String(status || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const derivedTone = tone || (
    /cancel|delete|error|failed|critical|over/.test(normalized) ? 'danger' :
    /review|warning|missing|waiting|blocked|needs/.test(normalized) ? 'warning' :
    /complete|matched|ready|approved|paid|passed/.test(normalized) ? 'success' :
    /manual|override|info|reserved|pulled/.test(normalized) ? 'info' : 'muted'
  );
  return <span className={`sc-status-badge sc-status-badge--${derivedTone}`}>{String(status || 'Unknown').replace(/_/g, ' ')}</span>;
}

export function ActionButton({
  children,
  tone = 'secondary',
  size = 'md',
  status,
  progress,
  completedLabel = 'Completed',
  workingLabel = 'Working…',
  onClick,
  ...props
}) {
  const [internalStatus, setInternalStatus] = useState('');
  const completionTimerRef = useRef(null);
  const effectiveStatus = status || internalStatus;
  const numericProgress = Number(progress);
  const hasProgress = Number.isFinite(numericProgress) && numericProgress >= 0;
  const clampedProgress = hasProgress ? Math.min(100, Math.max(0, numericProgress)) : null;

  async function handleClick(event) {
    if (!onClick) return;
    clearTimeout(completionTimerRef.current);
    setInternalStatus('working');
    try {
      const result = onClick(event);
      if (result && typeof result.then === 'function') await result;
      setInternalStatus('completed');
      completionTimerRef.current = setTimeout(() => setInternalStatus(''), 4500);
    } catch (error) {
      setInternalStatus('error');
      completionTimerRef.current = setTimeout(() => setInternalStatus(''), 6000);
      throw error;
    }
  }

  const disabled = props.disabled || effectiveStatus === 'working';

  return (
    <span className="sc-action-status-wrap">
      <button
        type="button"
        className={`sc-action-button sc-action-button--${tone} sc-action-button--${size}`}
        {...props}
        disabled={disabled}
        onClick={onClick ? handleClick : undefined}
      >
        {children}
      </button>
      {effectiveStatus ? (
        <span
          className={`sc-action-status sc-action-status--${effectiveStatus}`}
          role="status"
          aria-live="polite"
        >
          {effectiveStatus === 'working' ? (
            <>
              <span className="sc-action-status__spinner" aria-hidden="true" />
              <span>{hasProgress ? `${workingLabel} ${Math.round(clampedProgress)}%` : workingLabel}</span>
            </>
          ) : effectiveStatus === 'completed' ? (
            <><span aria-hidden="true">✓</span><span>{completedLabel}</span></>
          ) : effectiveStatus === 'error' ? (
            <><span aria-hidden="true">!</span><span>Needs attention</span></>
          ) : (
            <span>{effectiveStatus}</span>
          )}
          {effectiveStatus === 'working' && hasProgress ? (
            <span className="sc-action-status__bar" aria-hidden="true">
              <span style={{ width: `${clampedProgress}%` }} />
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function MetricCard({ label, value, note, tone = 'default' }) {
  return (
    <div className={`sc-metric-card sc-metric-card--${tone}`}>
      <div className="sc-metric-card__value">{value}</div>
      <div className="sc-metric-card__label">{label}</div>
      {note ? <div className="sc-metric-card__note">{note}</div> : null}
    </div>
  );
}

export function EmptyState({ title = 'Nothing to show', description, action }) {
  return (
    <div className="sc-empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function FieldGrid({ children }) {
  return <div className="sc-field-grid">{children}</div>;
}

export function FormField({ label, help, children, required }) {
  return (
    <label className="sc-form-field">
      <span>{label}{required ? <strong> *</strong> : null}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function ResponsiveTable({ children }) {
  return <div className="sc-responsive-table"><table>{children}</table></div>;
}

export function InlineEditorPanel({ title, description, children, className = '' }) {
  return (
    <section className={`sc-inline-editor ${className}`.trim()} aria-label={title}>
      <div className="sc-inline-editor__pointer" aria-hidden="true" />
      <div className="sc-inline-editor__header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        <span className="sc-inline-editor__badge">Editing this item</span>
      </div>
      <div className="sc-inline-editor__body">{children}</div>
    </section>
  );
}

export function TableInlineEditorRow({ colSpan, title, description, children, className = '' }) {
  return (
    <tr className={`sc-inline-editor-row ${className}`.trim()}>
      <td colSpan={colSpan}>
        <InlineEditorPanel title={title} description={description}>{children}</InlineEditorPanel>
      </td>
    </tr>
  );
}
