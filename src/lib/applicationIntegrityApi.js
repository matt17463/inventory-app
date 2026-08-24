import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function action(payload = {}) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/application-integrity', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Application Integrity request failed (HTTP ${response.status}).`);
  }
  return body.data;
}

export const resolveProductIdentity = (input) => action({ action: 'identity.resolve', ...input });
export const previewBlankProduct = (payload) => action({ action: 'product.preview', payload });
export const createBlankProductGuarded = (payload) => action({ action: 'product.create', payload });
export const updateBlankProductGuarded = (id, payload) => action({ action: 'product.update', id, payload });
export const bulkUpdateBlankProductsGuarded = (ids, payload) => action({ action: 'product.bulk_update', ids, payload });
export const rememberProductIdentity = (payload) => action({ action: 'identity.remember', ...payload });
export const getDuplicateReviewCases = (options = {}) => action({ action: 'review.list', ...options });
export const createDuplicateReviewCase = (payload) => action({ action: 'review.create', ...payload });
export const previewDuplicateReviewResolution = (caseId) => action({ action: 'review.preview_resolution', case_id: caseId });
export const applyDuplicateReviewResolution = (resolutionId, confirmation) => action({
  action: 'review.apply_resolution', resolution_id: resolutionId, confirmation,
});
export const updateDuplicateReviewCaseStatus = (caseId, status, notes = '') => action({
  action: 'review.status', case_id: caseId, status, notes,
});
export const getIntegrationJobs = (options = {}) => action({ action: 'jobs.list', ...options });
export const updateIntegrationJob = (id, mode) => action({ action: 'jobs.update', id, mode });
export const getInventoryReconciliation = (options = {}) => action({ action: 'reconciliation', ...options });
export const getTeamStoreWorkflows = () => action({ action: 'workflows', mode: 'list' });
export const saveTeamStoreWorkflow = (payload) => action({ action: 'workflows', mode: 'save', ...payload });
export const createPullSheetGuarded = (payload) => action({ action: 'pullsheet.create', payload });
export const addPullSheetLineGuarded = (payload) => action({ action: 'pullsheet.add_line', payload });
export const updatePullSheetStatusGuarded = (jobId, status, reason = '') => action({ action: 'pullsheet.status', job_id: jobId, status, reason });
export const updatePullSheetLineStatusGuarded = (jobItemId, status, reason = '') => action({ action: 'pullsheet.line_status', job_item_id: jobItemId, status, reason });
export const patchPullSheetLinesGuarded = (jobItemIds, patch, reason = '') => action({ action: 'pullsheet.patch_lines', job_item_ids: jobItemIds, patch, reason });
