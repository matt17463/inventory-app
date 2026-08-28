import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import './App.css';
import AuthGate from './AuthGate';

const ActivityPage = lazy(() => import('./ActivityPage'));
const AddItemToBin = lazy(() => import('./AddItemToBin'));
const ApprovalAutomation = lazy(() => import('./ApprovalAutomation'));
const AssetStorageHealth = lazy(() => import('./AssetStorageHealth'));
const ArtworkPluginBridge = lazy(() => import('./ArtworkPluginBridge'));
const ArtworkRequests = lazy(() => import('./ArtworkRequests'));
const AuditMode = lazy(() => import('./AuditMode'));
const AuditTrail = lazy(() => import('./AuditTrail'));
const BarcodeLabelGenerator = lazy(() => import('./BarcodeLabelGenerator'));
const BinContents = lazy(() => import('./BinContents'));
const BinsDashboard = lazy(() => import('./BinsDashboard'));
const BlankInventory = lazy(() => import('./BlankInventory'));
const BulkPairingRepair = lazy(() => import('./BulkPairingRepair'));
const CampaignForecast = lazy(() => import('./CampaignForecast'));
const CapacityPlanning = lazy(() => import('./CapacityPlanning'));
const ColorAliasReview = lazy(() => import('./ColorAliasReview'));
const CreateFinishedFromBlank = lazy(() => import('./CreateFinishedFromBlank'));
const CustomerPortal = lazy(() => import('./CustomerPortal'));
const CustomerPortalAdmin = lazy(() => import('./CustomerPortalAdmin'));
const CustomerPortalPreview = lazy(() => import('./CustomerPortalPreview'));
const CustomerReorderIntelligence = lazy(() => import('./CustomerReorderIntelligence'));
const DailyCommandCenter = lazy(() => import('./DailyCommandCenter'));
const DeploymentHealth = lazy(() => import('./DeploymentHealth'));
const EditBlankItems = lazy(() => import('./EditBlankItems'));
const EmployeeTasks = lazy(() => import('./EmployeeTasks'));
const ExceptionCenter = lazy(() => import('./ExceptionCenter'));
const FinishedMatchSuggestions = lazy(() => import('./FinishedMatchSuggestions'));
const GoogleCalendarIntegration = lazy(() => import('./GoogleCalendarIntegration'));
const Home = lazy(() => import('./Home'));
const InventoryAudit = lazy(() => import('./InventoryAudit'));
const InventoryImport = lazy(() => import('./InventoryImport'));
const InventoryValuation = lazy(() => import('./InventoryValuation'));
const JobCosting = lazy(() => import('./JobCosting'));
const LowStock = lazy(() => import('./LowStock'));
const ManualInvoicedOrders = lazy(() => import('./ManualInvoicedOrders'));
const MockupCustomerReview = lazy(() => import('./MockupCustomerReview'));
const MockupProductionPacket = lazy(() => import('./MockupProductionPacket'));
const MockupStudio = lazy(() => import('./MockupStudio'));
const NfcWriter = lazy(() => import('./NfcWriter'));
const NonInventoryRules = lazy(() => import('./NonInventoryRules'));
const NotFound = lazy(() => import('./NotFound'));
const OrderRiskDashboard = lazy(() => import('./OrderRiskDashboard'));
const ApplicationIntegrityCenter = lazy(() => import('./ApplicationIntegrityCenter'));
const PricingRules = lazy(() => import('./PricingRules'));
const ProductDataHealth = lazy(() => import('./ProductDataHealth'));
const ProductIntegrityCenter = lazy(() => import('./ProductIntegrityCenter'));
const ProductMappingRepair = lazy(() => import('./ProductMappingRepair'));
const ProductBlankMappings = lazy(() => import('./ProductBlankMappings'));
const ProductionBoard = lazy(() => import('./ProductionBoard'));
const ProductionCalendar = lazy(() => import('./ProductionCalendar'));
const ProductionEstimator = lazy(() => import('./ProductionEstimator'));
const ProductionPhotoProof = lazy(() => import('./ProductionPhotoProof'));
const PullSheetDueDateEditor = lazy(() => import('./PullSheetDueDateEditor'));
const PullSheetList = lazy(() => import('./PullSheetList'));
const PullSheetView = lazy(() => import('./PullSheetView'));
const PurchaseOrderGenerator = lazy(() => import('./PurchaseOrderGenerator'));
const PurchaseOrders = lazy(() => import('./PurchaseOrders'));
const Purchasing = lazy(() => import('./Purchasing'));
const QcChecklist = lazy(() => import('./QcChecklist'));
const QuoteBuilder = lazy(() => import('./QuoteBuilder'));
const QuoteToOrder = lazy(() => import('./QuoteToOrder'));
const ReceivePurchaseOrder = lazy(() => import('./ReceivePurchaseOrder'));
const Reservations = lazy(() => import('./Reservations'));
const ReturnFinishedInventory = lazy(() => import('./ReturnFinishedInventory'));
const SampleInventory = lazy(() => import('./SampleInventory'));
const ScanInventory = lazy(() => import('./ScanInventory'));
const ShopTvMode = lazy(() => import('./ShopTvMode'));
const SpoilageTracking = lazy(() => import('./SpoilageTracking'));
const SupplierCatalogImport = lazy(() => import('./SupplierCatalogImport'));
const SupplierCatalogReview = lazy(() => import('./SupplierCatalogReview'));
const TestTag = lazy(() => import('./TestTag'));
const TestingMode = lazy(() => import('./TestingMode'));
const ThemeSettings = lazy(() => import('./ThemeSettings'));
const TransferInventory = lazy(() => import('./TransferInventory'));
const VendorPriceComparison = lazy(() => import('./VendorPriceComparison'));
const WaitingOn = lazy(() => import('./WaitingOn'));
const WarehouseAuditReport = lazy(() => import('./WarehouseAuditReport'));
const WooSync = lazy(() => import('./WooSync'));

function RouteLoading() {
  return <div className="sc-route-loading" role="status" aria-live="polite">Loading page…</div>;
}

function EmployeeRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/inventory" element={<BlankInventory />} />
      <Route path="/edit-blank-items" element={<EditBlankItems />} />
      <Route path="/pull-sheets" element={<PullSheetList />} />
      <Route path="/customer-portal-preview" element={<CustomerPortalPreview />} />
      <Route path="/artwork-bridge" element={<ArtworkPluginBridge />} />
      <Route path="/create-product" element={<Navigate replace to="/inventory/edit-blanks" />} />
      <Route path="/testing-mode" element={<TestingMode />} />
      <Route path="/theme-settings" element={<ThemeSettings />} />
      <Route path="/inventory/blanks" element={<BlankInventory />} />
      <Route path="/inventory/edit-blanks" element={<EditBlankItems />} />
      <Route path="/inventory/import" element={<InventoryImport />} />
      <Route path="/inventory/samples" element={<SampleInventory />} />
      <Route path="/bins" element={<BinsDashboard />} />
      <Route path="/bin/:binId" element={<BinContents />} />
      <Route path="/add-item" element={<AddItemToBin />} />
      <Route path="/scan" element={<ScanInventory />} />
      <Route path="/transfer" element={<TransferInventory />} />
      <Route path="/audit" element={<AuditMode />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="/valuation" element={<InventoryValuation />} />
      <Route path="/low-stock" element={<LowStock />} />
      <Route path="/purchasing" element={<Purchasing />} />
      <Route path="/purchase-orders" element={<PurchaseOrders />} />
      <Route path="/purchase-orders/new" element={<PurchaseOrderGenerator />} />
      <Route path="/purchase-orders/:poId/receive" element={<ReceivePurchaseOrder />} />
      <Route path="/waiting-on" element={<WaitingOn />} />
      <Route path="/campaign-forecast" element={<CampaignForecast />} />
      <Route path="/customer-reorders" element={<CustomerReorderIntelligence />} />
      <Route path="/job-costing" element={<JobCosting />} />
      <Route path="/artwork-requests" element={<ArtworkRequests />} />
      <Route path="/shop-tv" element={<ShopTvMode />} />
      <Route path="/shop-touch" element={<ShopTvMode />} />
      <Route path="/pullsheet-due-dates" element={<PullSheetDueDateEditor />} />
      <Route path="/vendor-prices" element={<VendorPriceComparison />} />
      <Route path="/capacity-planning" element={<CapacityPlanning />} />
      <Route path="/production-calendar" element={<ProductionCalendar />} />
      <Route path="/production-estimator" element={<ProductionEstimator />} />
      <Route path="/pricing-rules" element={<PricingRules />} />
      <Route path="/quote-builder" element={<QuoteBuilder />} />
      <Route path="/spoilage" element={<SpoilageTracking />} />
      <Route path="/finished-suggestions" element={<FinishedMatchSuggestions />} />
      <Route path="/production-board" element={<ProductionBoard />} />
      <Route path="/qc-checklist" element={<QcChecklist />} />
      <Route path="/employee-tasks" element={<EmployeeTasks />} />
      <Route path="/order-risk" element={<OrderRiskDashboard />} />
      <Route path="/command-center" element={<DailyCommandCenter />} />
      <Route path="/supplier-catalog/import" element={<SupplierCatalogImport />} />
      <Route path="/supplier-catalog" element={<SupplierCatalogReview />} />
      <Route path="/labels" element={<BarcodeLabelGenerator />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/woo-sync" element={<WooSync />} />
      <Route path="/color-aliases" element={<ColorAliasReview />} />
      <Route path="/color-pairings" element={<ColorAliasReview />} />
      <Route path="/mapping-repair" element={<ProductMappingRepair />} />
      <Route path="/product-blank-mappings" element={<ProductBlankMappings />} />
      <Route path="/bulk-pairing-repair" element={<BulkPairingRepair />} />
      <Route path="/non-inventory-rules" element={<NonInventoryRules />} />
      <Route path="/exception-center" element={<ExceptionCenter />} />
      <Route path="/customer-portal-admin" element={<CustomerPortalAdmin />} />
      <Route path="/approval-automation" element={<ApprovalAutomation />} />
      <Route path="/audit-trail" element={<AuditTrail />} />
      <Route path="/quote-to-order" element={<QuoteToOrder />} />
      <Route path="/manual-orders" element={<ManualInvoicedOrders />} />
      <Route path="/product-data-health" element={<ProductDataHealth />} />
      <Route path="/product-integrity" element={<ProductIntegrityCenter />} />
      <Route path="/operations-integrity" element={<ApplicationIntegrityCenter />} />
      <Route path="/inventory-audit" element={<InventoryAudit />} />
      <Route path="/production-photo-proof" element={<ProductionPhotoProof />} />
      <Route path="/nfc-writer" element={<NfcWriter />} />
      <Route path="/test-tag" element={<TestTag />} />
      <Route path="/pullsheets" element={<PullSheetList />} />
      <Route path="/pullsheets/:jobId" element={<PullSheetView />} />
      <Route path="/return-finished" element={<ReturnFinishedInventory />} />
      <Route path="/finished/create" element={<CreateFinishedFromBlank />} />
      <Route path="/audit/warehouse" element={<WarehouseAuditReport />} />
      <Route path="/deployment-health" element={<DeploymentHealth />} />
      <Route path="/asset-storage-health" element={<AssetStorageHealth />} />
      <Route path="/google-calendar" element={<GoogleCalendarIntegration />} />
      <Route path="/mockup-studio" element={<MockupStudio />} />
      <Route path="/mockup-studio/:projectId/production-packet" element={<MockupProductionPacket />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/customer-portal" element={<CustomerPortal />} />
          <Route path="/mockup-review" element={<MockupCustomerReview />} />
          <Route
            path="*"
            element={(
              <AuthGate>
                <AppShell>
                  <EmployeeRoutes />
                </AppShell>
              </AuthGate>
            )}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
