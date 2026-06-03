.counter {
  font-size: 16px;
  padding: 5px 10px;
  border-radius: 5px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  transition: border-color 0.3s;
  margin-bottom: 24px;

  &:hover {
    border-color: var(--accent-border);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

.hero {
  position: relative;

  .base,
  .framework,
  .vite {
    inset-inline: 0;
    margin: 0 auto;
  }

  .base {
    width: 170px;
    position: relative;
    z-index: 0;
  }

  .framework,
  .vite {
    position: absolute;
  }

  .framework {
    z-index: 1;
    top: 34px;
    height: 28px;
    transform: perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg)
      scale(1.4);
  }

  .vite {
    z-index: 0;
    top: 107px;
    height: 26px;
    width: auto;
    transform: perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg)
      scale(0.8);
  }
}

#center {
  display: flex;
  flex-direction: column;
  gap: 25px;
  place-content: center;
  place-items: center;
  flex-grow: 1;

  @media (max-width: 1024px) {
    padding: 32px 20px 24px;
    gap: 18px;
  }
}

#next-steps {
  display: flex;
  border-top: 1px solid var(--border);
  text-align: left;

  & > div {
    flex: 1 1 0;
    padding: 32px;
    @media (max-width: 1024px) {
      padding: 24px 20px;
    }
  }

  .icon {
    margin-bottom: 16px;
    width: 22px;
    height: 22px;
  }

  @media (max-width: 1024px) {
    flex-direction: column;
    text-align: center;
  }
}

#docs {
  border-right: 1px solid var(--border);

  @media (max-width: 1024px) {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}

#next-steps ul {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 8px;
  margin: 32px 0 0;

  .logo {
    height: 18px;
  }

  a {
    color: var(--text-h);
    font-size: 16px;
    border-radius: 6px;
    background: var(--social-bg);
    display: flex;
    padding: 6px 12px;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: box-shadow 0.3s;

    &:hover {
      box-shadow: var(--shadow);
    }
    .button-icon {
      height: 18px;
      width: 18px;
    }
  }

  @media (max-width: 1024px) {
    margin-top: 20px;
    flex-wrap: wrap;
    justify-content: center;

    li {
      flex: 1 1 calc(50% - 8px);
    }

    a {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }
  }
}

#spacer {
  height: 88px;
  border-top: 1px solid var(--border);
  @media (max-width: 1024px) {
    height: 48px;
  }
}

.ticks {
  position: relative;
  width: 100%;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: -4.5px;
    border: 5px solid transparent;
  }

  &::before {
    left: 0;
    border-left-color: var(--border);
  }
  &::after {
    right: 0;
    border-right-color: var(--border);
  }
}

.helper-text {
  margin-top: 6px;
  color: #666;
  font-size: 0.9rem;
}

.result-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.result-row {
  appearance: none;
  border: 1px solid #e7dff0;
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  text-align: left;
  color: #171321;
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.result-row:hover,
.result-row.selected {
  border-color: #2478f2;
  box-shadow: 0 0 0 3px rgba(36, 120, 242, 0.12);
}

.result-row span {
  color: #6b6477;
  font-size: 0.95rem;
}

/* Edit Blank Items page */
.edit-blank-layout {
  align-items: start;
  grid-template-columns: minmax(320px, 0.9fr) minmax(420px, 1.1fr);
}

.inline-search-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.inline-search-form input {
  flex: 1;
}

.blank-edit-results {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  max-height: 620px;
  overflow: auto;
  padding-right: 6px;
}

.blank-edit-results .result-row small {
  color: #7b7288;
  font-size: 0.85rem;
}

.edit-blank-form {
  display: grid;
  gap: 10px;
}

.edit-blank-form label {
  font-weight: 700;
  color: #211629;
  margin-top: 6px;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button input {
  flex: 1;
}

@media (max-width: 900px) {
  .edit-blank-layout {
    grid-template-columns: 1fr;
  }

  .inline-search-form,
  .input-with-button {
    flex-direction: column;
    align-items: stretch;
  }
}

/* Bulk edit blank items */
.edit-blank-side-panel {
  display: grid;
  gap: 16px;
}

.bulk-selection-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid #eadff2;
  border-radius: 14px;
  background: #fbf8fd;
}

.bulk-selection-toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 700;
}

.bulk-selection-toolbar span {
  color: #6b6477;
  font-size: 0.9rem;
}

.editable-result-row {
  grid-template-columns: auto 1fr;
  align-items: start;
}

.row-select {
  display: inline-flex;
  align-items: center;
  padding-top: 2px;
  cursor: pointer;
}

.bulk-edit-form {
  display: grid;
  gap: 12px;
}

.bulk-field {
  display: grid;
  gap: 6px;
  padding: 10px;
  border: 1px solid #efe7f5;
  border-radius: 12px;
  background: #fff;
}

.bulk-field > label {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-weight: 800;
  color: #211629;
}

.bulk-field select,
.bulk-field input {
  width: 100%;
}


/* Display fixes for Edit Blank Items / Bulk Edit checkboxes */
.edit-blank-items-page input[type="checkbox"],
.bulk-selection-toolbar input[type="checkbox"],
.bulk-edit-form input[type="checkbox"],
.editable-result-row input[type="checkbox"] {
  width: auto;
  min-width: 18px;
  height: 18px;
  padding: 0;
  margin: 0;
  flex: 0 0 auto;
  accent-color: #4b0082;
}

.edit-blank-layout {
  gap: 18px;
}

.blank-edit-results {
  gap: 8px;
}

.editable-result-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  width: 100%;
  box-sizing: border-box;
}

.editable-result-row > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.editable-result-row strong,
.editable-result-row span,
.editable-result-row small {
  display: block;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.editable-result-row strong {
  font-size: 1rem;
  color: #171321;
}

.editable-result-row span {
  color: #33283f;
  font-size: 0.95rem;
}

.editable-result-row small {
  color: #74667f;
  font-size: 0.86rem;
}

.row-select {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
  width: 24px;
  min-width: 24px;
}

.bulk-selection-toolbar label,
.bulk-field > label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
}

.bulk-field {
  gap: 8px;
}

.bulk-field select,
.bulk-field input:not([type="checkbox"]) {
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 1100px) {
  .edit-blank-layout {
    grid-template-columns: 1fr;
  }
}


/* Pull Sheet restored workflow */
.page-heading-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 20px;
}

.page-heading-row h1 {
  margin-bottom: 4px;
}

.back-link,
.small-link-button {
  color: var(--brand-purple, #32006e);
  font-weight: 800;
  text-decoration: none;
}

.small-link-button {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: #f1e8ff;
}

.pullsheet-page label {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  color: #2b064f;
  font-weight: 800;
}

.pullsheet-page input,
.pullsheet-page select,
.pullsheet-page textarea {
  width: 100%;
  border: 1px solid #e4dcef;
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
  background: #fff;
}

.pullsheet-page textarea {
  min-height: 90px;
  resize: vertical;
}

.inline-action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.inline-action-row button,
.pullsheet-page button {
  border: 0;
  border-radius: 12px;
  padding: 12px 16px;
  font-weight: 900;
  cursor: pointer;
  background: #2176ff;
  color: white;
}

.pullsheet-page button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pullsheet-status-card {
  background: #fbf7ff;
  border: 1px solid #e7daf7;
  border-radius: 18px;
  padding: 14px;
  min-width: 240px;
}

.compact-kpis .kpi-card {
  min-height: 120px;
}

.responsive-table {
  overflow-x: auto;
}

.responsive-table table {
  width: 100%;
  border-collapse: collapse;
}

.responsive-table th,
.responsive-table td {
  border-bottom: 1px solid #eee7f6;
  padding: 12px;
  text-align: left;
  vertical-align: top;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 900;
  background: #f1e8ff;
  color: #32006e;
  white-space: nowrap;
}

.status-completed {
  background: #dcfce7;
  color: #166534;
}

.status-cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.status-pulled,
.status-in_production {
  background: #dbeafe;
  color: #1d4ed8;
}

.search-result-list {
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  margin: 10px 0 14px;
}

.result-card {
  display: grid !important;
  gap: 4px;
  text-align: left;
  background: #fff !important;
  color: #151222 !important;
  border: 1px solid #e4dcef !important;
  border-radius: 14px !important;
}

.result-card.selected {
  border-color: #2176ff !important;
  box-shadow: 0 0 0 3px rgba(33, 118, 255, 0.14);
}

.result-card span {
  color: #6b6178;
  font-weight: 600;
}

.selected-item-note {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 12px;
  padding: 10px 12px;
}

.button-stack {
  display: grid;
  gap: 8px;
  min-width: 160px;
}

.button-stack button {
  padding: 9px 10px;
  font-size: 13px;
}

.danger-button {
  background: #fee2e2 !important;
  color: #991b1b !important;
}

.simple-steps {
  padding-left: 20px;
  color: #4f465e;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .page-heading-row,
  .content-two-column {
    grid-template-columns: 1fr !important;
    display: grid;
  }

  .inline-action-row {
    grid-template-columns: 1fr;
  }
}

/* Finished inventory / pull sheet integration */
.pullsheet-actions {
  min-width: 280px;
  gap: 10px;
}

.finished-match-panel,
.finished-return-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: #f8fafc;
}

.finished-match-panel strong,
.finished-return-panel strong {
  font-size: 0.82rem;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.finished-match-card {
  display: grid;
  gap: 5px;
  padding: 9px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 10px;
  background: #ffffff;
}

.finished-match-card span {
  font-weight: 800;
  color: #0f172a;
}

.finished-match-card small,
.finished-match-panel small {
  color: #64748b;
}

.finished-match-card select,
.finished-return-panel select {
  max-width: 100%;
}


/* Purchasing report */
.purchasing-page .page-header,
.purchasing-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.purchasing-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.purchasing-controls {
  margin: 1rem 0;
}

.segmented-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.segmented-tabs button {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 999px;
  padding: 0.65rem 1rem;
  cursor: pointer;
  font-weight: 700;
}

.segmented-tabs button.active {
  background: #0f3d5e;
  color: #fff;
  border-color: #0f3d5e;
}

.search-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.search-row input {
  flex: 1;
  min-width: 240px;
}

.responsive-table {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.75rem;
  text-align: left;
  vertical-align: top;
}

.data-table th {
  background: #f8fafc;
  color: #334155;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.shortage-row td {
  background: #fff7ed;
}

.guide-card ol {
  margin-left: 1.25rem;
}

.secondary-button {
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #cbd5e1;
}

@media (max-width: 760px) {
  .purchasing-page .page-header,
  .purchasing-header,
  .search-row {
    flex-direction: column;
    align-items: stretch;
  }
}


/* Inventory Import */
.import-page .import-header {
  align-items: flex-start;
  gap: 1rem;
}

.import-instructions-grid {
  align-items: stretch;
}

.import-upload-card {
  display: grid;
  gap: 1rem;
}

.import-upload-card input[type="file"] {
  margin-top: 0.4rem;
}

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
}

.checkbox-line input {
  width: auto;
}

.import-preview-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.import-table td,
.import-table th {
  vertical-align: top;
}

.import-ready-row {
  background: rgba(22, 163, 74, 0.08);
}

.import-error-row {
  background: rgba(220, 38, 38, 0.08);
}

.import-kpis {
  margin-top: 1rem;
}


.warning-card {
  border: 1px solid #f59e0b;
  background: #fffbeb;
  color: #78350f;
  border-radius: 14px;
  padding: 16px 18px;
  margin: 16px 0;
}

.warning-card h2 {
  margin-top: 0;
}

.danger-button {
  border: none;
  border-radius: 10px;
  background: #b91c1c;
  color: #fff;
  font-weight: 700;
  padding: 11px 16px;
  cursor: pointer;
}

.danger-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.danger-check {
  color: #7f1d1d;
  font-weight: 600;
}

.result-json {
  white-space: pre-wrap;
  max-height: 420px;
  overflow: auto;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  padding: 14px;
}
