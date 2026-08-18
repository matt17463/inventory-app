# Application Usability and Workflow Review — v0.6.28

## Outcome

The complete v0.6.27 application was reviewed route-by-route and component-by-component for detached editors, forced page jumps, oversized vertical spacing, table/action proximity, and single-record versus bulk workflow placement.

The review covered **77 configured route entries representing 76 unique path patterns**, including compatibility aliases and the public customer portal. Source scanning also identified **52 table-bearing page components** and **36 form-bearing page components**.

The governing behavior in v0.6.28 is:

- A change affecting one saved item opens immediately beneath that selected row.
- A change affecting multiple selected items appears after the complete collection.
- New-record forms may remain above a collection because no saved row exists yet.
- Confirmation, image-preview, and destructive-action dialogs remain overlays because they are short, blocking interactions.
- Reusable-rule actions scroll only the minimum needed to reveal their target.
- Headers, panels, fields, buttons, table rows, and sidebar spacing use a denser shared layout while maintaining practical click/touch targets.

## Material workflow corrections

| Workflow | Before | v0.6.28 |
|---|---|---|
| Manual Invoiced Orders | Editing an existing order reused a long form above the order history and forced a page-top jump. | The complete editor renders directly beneath the selected order row. Creating a new order remains at the top. |
| Edit Blank Items | Single-item and multi-item editors were detached above the result set. | A single item edits beneath its row; the bulk editor follows the table. |
| Pricing Rules | Editing a saved rule reused the new-rule form above the table. | Existing rules edit beneath the selected rule; new rules start above the table. |
| Non-Inventory Rules | Editing a saved rule forced a jump to a detached form. | Existing rules edit beneath their row; create remains a separate top action. |
| Job Costing | Cost-entry controls were detached from the selected job. | The cost editor opens beneath the selected job row. |
| Pull Sheet Due Dates | Multi-item controls preceded the pull-sheet list. | Individual dates remain in their rows; the bulk due-date control appears after the table. |
| Production Time Estimator | “Use Rule” forced the window to the page top. | The minimum nearest-target scroll is used to reveal the estimate controls. |
| Shared shell and pages | Large headers, panel gaps, and table rows increased scroll distance. | Shared compact density reduces vertical travel across the application. |

## Safety boundaries retained

- Pull-sheet viewing remains database read-only.
- Pull-sheet completion remains idempotent.
- Cancelled historical duplicate lines remain filtered.
- The Inventory Overview universal SKU/name/description search remains intact.
- The non-inventory purchasing-report toggle remains intact.
- Image preview and explicit confirm/cancel dialogs remain modal.
- No database schema or Supabase SQL change is included.

## Route-by-route review

| Route | Component | Review disposition |
|---|---|---|
| `/` | Home | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/inventory` | BlankInventory | Reviewed — compatibility alias/alternate entry; inherits the destination layout. |
| `/edit-blank-items` | EditBlankItems | Changed — existing single-record edit opens directly beneath the selected row. |
| `/pull-sheets` | PullSheetList | Reviewed — compatibility alias/alternate entry; inherits the destination layout. |
| `/customer-portal-preview` | CustomerPortalPreview | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/artwork-bridge` | ArtworkPluginBridge | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/create-product` | Navigate | Reviewed — compatibility alias/alternate entry; inherits the destination layout. |
| `/testing-mode` | TestingMode | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/theme-settings` | ThemeSettings | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/inventory/blanks` | BlankInventory | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/inventory/edit-blanks` | EditBlankItems | Changed — existing single-record edit opens directly beneath the selected row. |
| `/inventory/import` | InventoryImport | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/inventory/samples` | SampleInventory | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/bins` | BinsDashboard | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/bin/:binId` | BinContents | Reviewed — detail workflow; local controls retained and shared density applied. |
| `/add-item` | AddItemToBin | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/scan` | ScanInventory | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/transfer` | TransferInventory | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/audit` | AuditMode | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/reservations` | Reservations | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/valuation` | InventoryValuation | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/low-stock` | LowStock | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/purchasing` | Purchasing | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/purchase-orders` | PurchaseOrders | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/purchase-orders/new` | PurchaseOrderGenerator | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/purchase-orders/:poId/receive` | ReceivePurchaseOrder | Reviewed — detail workflow; local controls retained and shared density applied. |
| `/waiting-on` | WaitingOn | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/campaign-forecast` | CampaignForecast | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/customer-reorders` | CustomerReorderIntelligence | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/job-costing` | JobCosting | Changed — existing single-record edit opens directly beneath the selected row. |
| `/artwork-requests` | ArtworkRequests | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/shop-tv` | ShopTvMode | Reviewed — compatibility alias/alternate entry; inherits the destination layout. |
| `/shop-touch` | ShopTvMode | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/pullsheet-due-dates` | PullSheetDueDateEditor | Changed — individual dates remain row-local; multi-select due-date action moved below the table. |
| `/vendor-prices` | VendorPriceComparison | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/capacity-planning` | CapacityPlanning | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/production-calendar` | ProductionCalendar | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/production-estimator` | ProductionEstimator | Changed — loading a reusable rule uses nearest-target scrolling instead of forcing page top. |
| `/pricing-rules` | PricingRules | Changed — existing single-record edit opens directly beneath the selected row. |
| `/quote-builder` | QuoteBuilder | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/spoilage` | SpoilageTracking | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/finished-suggestions` | FinishedMatchSuggestions | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/production-board` | ProductionBoard | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/qc-checklist` | QcChecklist | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/employee-tasks` | EmployeeTasks | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/order-risk` | OrderRiskDashboard | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/command-center` | DailyCommandCenter | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/supplier-catalog/import` | SupplierCatalogImport | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/supplier-catalog` | SupplierCatalogReview | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/labels` | BarcodeLabelGenerator | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/activity` | ActivityPage | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/woo-sync` | WooSync | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/color-aliases` | ColorAliasReview | Reviewed — compatibility alias/alternate entry; inherits the destination layout. |
| `/color-pairings` | ColorAliasReview | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/mapping-repair` | ProductMappingRepair | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/bulk-pairing-repair` | BulkPairingRepair | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/non-inventory-rules` | NonInventoryRules | Changed — existing single-record edit opens directly beneath the selected row. |
| `/exception-center` | ExceptionCenter | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/customer-portal-admin` | CustomerPortalAdmin | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/approval-automation` | ApprovalAutomation | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/audit-trail` | AuditTrail | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/quote-to-order` | QuoteToOrder | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/manual-orders` | ManualInvoicedOrders | Changed — existing single-record edit opens directly beneath the selected row. |
| `/product-data-health` | ProductDataHealth | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/inventory-audit` | InventoryAudit | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/production-photo-proof` | ProductionPhotoProof | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/nfc-writer` | NfcWriter | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/test-tag` | TestTag | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/pullsheets` | PullSheetList | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/pullsheets/:jobId` | PullSheetView | Reviewed — line controls already remain with each pull-sheet item; completion overlays retained. |
| `/return-finished` | ReturnFinishedInventory | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/finished/create` | CreateFinishedFromBlank | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/audit/warehouse` | WarehouseAuditReport | Reviewed — focused task/form page; shared compact spacing applied, no detached record editor found. |
| `/deployment-health` | DeploymentHealth | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `*` | NotFound | Reviewed — fallback/not-found route; no workflow editor. |
| `/customer-portal` | CustomerPortal | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |
| `/customer-portal` | CustomerPortal | Reviewed — list, dashboard, or report; shared compact headers/tables applied, no detached record editor found. |

## Validation

- Netlify JavaScript function ESM validation: passed.
- Static application contracts: 17 passed.
- Security helper tests: 3 passed.
- ESLint: 0 errors; 39 pre-existing warnings.
- Vite production build: passed.
- Production bundle feature verification: passed.
- Large-bundle notice: warning only; no deployment failure.

## Recommended acceptance checks

1. Edit a manual invoice order near the bottom of a long history and confirm the editor opens under that row.
2. Edit one blank product and confirm its editor opens under the selected result.
3. Select multiple blank products and confirm the bulk editor remains below the table.
4. Edit a pricing rule, non-inventory rule, and job-costing record without a page-top jump.
5. Change one pull-sheet due date in place, then select multiple pull sheets and use the bulk control below the list.
6. Recheck pull sheets 165 and 170, the universal Inventory Overview search, and the non-inventory purchasing toggle.
