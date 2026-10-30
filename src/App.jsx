import QuickBooksConnection from './QuickBooksConnection';
import { lazy, Suspense, useContext } from 'react';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
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
const ClientGraphics = lazy(() => import('./ClientGraphics'));
const OrderGraphicAssignment = lazy(() => import('./OrderGraphicAssignment'));
const AuditMode = lazy(() => import('./AuditMode'));
const AuditTrail = lazy(() => import('./AuditTrail'));
const BarcodeLabelGenerator = lazy(() => import('./BarcodeLabelGenerator'));
const BinContents = lazy(() => import('./BinContents'));
const BinsDashboard = lazy(() => import('./BinsDashboard'));
const BlankInventory = lazy(() => import('./BlankInventory'));
const BulkPairingRepair = lazy(() => import('./BulkPairingRepair'));
const CampaignForecast = lazy(() => import('./CampaignForecast'));
const CapacityPlanning = lazy(() => import('./CapacityPlanning'));
const ClientOrders = lazy(() => import('./ClientOrders'));
const ColorAliasReview = lazy(() => import('./ColorAliasReview'));
const CreateFinishedFromBlank = lazy(() => import('./CreateFinishedFromBlank'));
const CustomerPortal = lazy(() => import('./CustomerPortal'));
const PublicDesignConfigurator = lazy(() => import('./PublicDesignConfigurator'));
const CustomerPortalAdmin = lazy(() => import('./CustomerPortalAdmin'));
const CustomerPortalPreview = lazy(() => import('./CustomerPortalPreview'));
const CustomerReorderIntelligence = lazy(() => import('./CustomerReorderIntelligence'));
const DailyCommandCenter = lazy(() => import('./DailyCommandCenter'));
const CreativeOperationsSuite = lazy(() => import('./CreativeOperationsSuite'));
const DeploymentHealth = lazy(() => import('./DeploymentHealth'));
const EditBlankItems = lazy(() => import('./EditBlankItems'));
const EmployeeTasks = lazy(() => import('./EmployeeTasks'));
const ExceptionCenter = lazy(() => import('./ExceptionCenter'));
const FinishedMatchSuggestions = lazy(() => import('./FinishedMatchSuggestions'));
const GoogleCalendarIntegration = lazy(() => import('./GoogleCalendarIntegration'));
const Home = lazy(() => import('./Home'));
const WorkHub = lazy(() => import('./WorkHub'));
const PrintCenter = lazy(() => import('./PrintCenter'));
const TeamStoreLaunchpad = lazy(() => import('./TeamStoreLaunchpad'));
const PublicTeamStore = lazy(() => import('./PublicTeamStore'));
const CoordinatorDashboard = lazy(() => import('./CoordinatorDashboard'));
const ManufacturingRecipes = lazy(() => import('./ManufacturingRecipes'));
const ProductionTravelers = lazy(() => import('./ProductionTravelers'));
const CatalogProductionReadiness = lazy(() => import('./CatalogProductionReadiness'));
const WooArtworkMapping = lazy(() => import('./WooArtworkMapping'));
const CatalogModernization = lazy(() => import('./CatalogModernization'));
const CatalogPairingWorkbench = lazy(() => import('./CatalogPairingWorkbench'));

const ArtworkPreflight = lazy(() => import('./ArtworkPreflight'));
const DTFPrepStudio = lazy(() => import('./DTFPrepStudio'));
const InventoryAudit = lazy(() => import('./InventoryAudit'));
const InventoryImport = lazy(() => import('./InventoryImport'));
const InventoryValuation = lazy(() => import('./InventoryValuation'));
const JobCosting = lazy(() => import('./JobCosting'));
const LowStock = lazy(() => import('./LowStock'));
const ManualInvoicedOrders = lazy(() => import('./ManualInvoicedOrders'));
const MockupCustomerReview = lazy(() => import('./MockupCustomerReview'));
const MockupProductionPacket = lazy(() => import('./MockupProductionPacket'));
const MockupStudio = lazy(() => import('./MockupStudio'));
const NewProductLineSetup = lazy(() => import('./NewProductLineSetup'));
const NfcWriter = lazy(() => import('./NfcWriter'));
const NonInventoryRules = lazy(() => import('./NonInventoryRules'));
const NotFound = lazy(() => import('./NotFound'));
const OrderRiskDashboard = lazy(() => import('./OrderRiskDashboard'));
const OnsiteSales = lazy(() => import('./OnsiteSales'));
const OperationsCalendar = lazy(() => import('./OperationsCalendar'));
const ApplicationGuide = lazy(() => import('./ApplicationGuide'));
const WordPressCommerceIntegrity = lazy(() => import('./WordPressCommerceIntegrity'));
const ApplicationIntegrityCenter = lazy(() => import('./ApplicationIntegrityCenter'));
const PricingRules = lazy(() => import('./PricingRules'));
const ProductDataHealth = lazy(() => import('./ProductDataHealth'));
const ProductIntegrityCenter = lazy(() => import('./ProductIntegrityCenter'));
const ProductMappingRepair = lazy(() => import('./ProductMappingRepair'));
const ProductTypeManager = lazy(() => import('./ProductTypeManager'));
const ProductBlankMappings = lazy(() => import('./ProductBlankMappings'));
const ProductColorReplacement = lazy(() => import('./ProductColorReplacement'));
const ProductionBoard = lazy(() => import('./ProductionBoard'));
const ProductionCalendar = lazy(() => import('./ProductionCalendar'));
const ProductionEstimator = lazy(() => import('./ProductionEstimator'));
const ProductionPhotoProof = lazy(() => import('./ProductionPhotoProof'));
const PublicClientOrderForm = lazy(() => import('./PublicClientOrderForm'));
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
const CatalogWorkbench = lazy(() => import('./CatalogWorkbench'));
const MarketingWorkspace = lazy(() => import('./MarketingWorkspace'));
const MarketingClientReview = lazy(() => import('./MarketingClientReview'));
const ShopTvMode = lazy(() => import('./ShopTvMode'));
const SpoilageTracking = lazy(() => import('./SpoilageTracking'));
const SupplierCatalogImport = lazy(() => import('./SupplierCatalogImport'));
const SupplierCatalogReview = lazy(() => import('./SupplierCatalogReview'));
const TestTag = lazy(() => import('./TestTag'));
const TestingMode = lazy(() => import('./TestingMode'));
const ThemeSettings = lazy(() => import('./ThemeSettings'));
const EquipmentCenter = lazy(() => import('./EquipmentCenter'));
const MaterialSettings = lazy(() => import('./MaterialSettings'));
const DeviceProductLibrary = lazy(() => import('./DeviceProductLibrary'));
const ProductDevelopmentCenter = lazy(() => import('./ProductDevelopmentCenter'));
const UVStudio = lazy(() => import('./UVStudio'));
const MenuManager = lazy(() => import('./MenuManager'));
const UserManagement = lazy(() => import('./UserManagement'));
const ContractorHours = lazy(() => import('./ContractorHours'));
const TransferInventory = lazy(() => import('./TransferInventory'));
const VendorPriceComparison = lazy(() => import('./VendorPriceComparison'));
const WaitingOn = lazy(() => import('./WaitingOn'));
const WarehouseAuditReport = lazy(() => import('./WarehouseAuditReport'));
const WooSync = lazy(() => import('./WooSync'));

function PublicLegalFooter() {
  return (
    <footer aria-label="Skilled Crafting legal information" style={{ textAlign: 'center', padding: '18px 24px 26px', fontSize: 13, color: '#526276', background: '#f8fafc' }}>
      <a href="/privacy-policy.html" style={{ marginRight: 18, textDecoration: 'underline' }}>Privacy Policy</a>
      <a href="/eula.html" style={{ marginRight: 18, textDecoration: 'underline' }}>End User License Agreement</a>
      <a href="https://skilledcrafting.com/policies/" style={{ textDecoration: 'underline' }}>Order Policies</a>
    </footer>
  );
}

function publicPage(element) {
  return <>{element}<PublicLegalFooter /></>;
}

function RouteLoading() {
  return <div className="sc-route-loading" role="status" aria-live="polite">Loading page…</div>;
}

function EmployeeRoutes() {
  const access=useContext(EmployeeAccessContext);
  if(access?.role==='marketing') return <Routes>
    <Route path="/marketing" element={<MarketingWorkspace />} />
    <Route path="/product-event-center" element={<ProductDevelopmentCenter />} />
    <Route path="/creative-operations" element={<CreativeOperationsSuite />} />
    <Route path="/dtf-studio" element={<DTFPrepStudio />} />
    <Route path="/catalog-production-readiness" element={<CatalogProductionReadiness />} />
      <Route path="/catalog-modernization" element={<CatalogModernization />} />
      <Route path="/catalog-pairing" element={<CatalogPairingWorkbench />} />
    <Route path="/team-stores" element={<TeamStoreLaunchpad />} />
    <Route path="/application-guide" element={<ApplicationGuide />} />
    <Route path="/testing-mode" element={<TestingMode />} />
    <Route path="/theme-settings" element={<ThemeSettings />} />
    <Route path="/menu-manager" element={<MenuManager />} />
    <Route path="*" element={<Navigate to="/marketing" replace />} />
  </Routes>;
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
      <Route path="/equipment-center" element={<EquipmentCenter />} />
      <Route path="/material-settings" element={<MaterialSettings />} />
       <Route path="/device-product-library" element={<DeviceProductLibrary />} />
      <Route path="/product-event-center" element={<ProductDevelopmentCenter />} />
      <Route path="/creative-operations" element={<CreativeOperationsSuite />} />
      <Route path="/uv-studio" element={<UVStudio />} />
      <Route path="/menu-manager" element={<MenuManager />} />
      <Route path="/user-management" element={<UserManagement />} />
      <Route path="/contractor-hours" element={<ContractorHours />} />
      <Route path="/inventory/blanks" element={<BlankInventory />} />
      <Route path="/inventory/edit-blanks" element={<EditBlankItems />} />
      <Route path="/inventory/import" element={<InventoryImport />} />
      <Route path="/inventory/samples" element={<SampleInventory />} />
      <Route path="/bins" element={<BinsDashboard />} />
      <Route path="/bin/:binId" element={<BinContents />} />
      <Route path="/add-item" element={<AddItemToBin />} />
      <Route path="/new-product-line" element={<NewProductLineSetup />} />
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
      <Route path="/client-orders" element={<ClientOrders />} />
      <Route path="/job-costing" element={<JobCosting />} />
      <Route path="/artwork-requests" element={<ArtworkRequests />} />
      <Route path="/catalog-workbench" element={<CatalogWorkbench />} />
      <Route path="/shop-equipment" element={<EquipmentCenter />} />
      <Route path="/shop-tv" element={<ShopTvMode />} />
      <Route path="/shop-touch" element={<ShopTvMode />} />
      <Route path="/pullsheet-due-dates" element={<PullSheetDueDateEditor />} />
      <Route path="/vendor-prices" element={<VendorPriceComparison />} />
      <Route path="/capacity-planning" element={<CapacityPlanning />} />
      <Route path="/production-calendar" element={<ProductionCalendar />} />
      <Route path="/operations-calendar" element={<OperationsCalendar />} />
      <Route path="/production-estimator" element={<ProductionEstimator />} />
      <Route path="/pricing-rules" element={<PricingRules />} />
      <Route path="/quote-builder" element={<QuoteBuilder />} />
      <Route path="/spoilage" element={<SpoilageTracking />} />
      <Route path="/finished-suggestions" element={<FinishedMatchSuggestions />} />
      <Route path="/production-board" element={<ProductionBoard />} />
      <Route path="/qc-checklist" element={<QcChecklist />} />
      <Route path="/employee-tasks" element={<EmployeeTasks />} />
      <Route path="/order-risk" element={<OrderRiskDashboard />} />
      <Route path="/onsite-sales" element={<OnsiteSales />} />
      <Route path="/command-center" element={<DailyCommandCenter />} />
      <Route path="/work-hub" element={<WorkHub />} />
      <Route path="/print-center" element={<PrintCenter />} />
      <Route path="/quickbooks" element={<QuickBooksConnection />} />
      <Route path="/manufacturing-recipes" element={<ManufacturingRecipes />} />
      <Route path="/client-graphics" element={<ClientGraphics />} />
      <Route path="/woo-artwork-mapping" element={<WooArtworkMapping />} />
      <Route path="/order-graphics" element={<OrderGraphicAssignment />} />
      <Route path="/catalog-production-readiness" element={<CatalogProductionReadiness />} />
      <Route path="/catalog-modernization" element={<CatalogModernization />} />
      <Route path="/catalog-pairing" element={<CatalogPairingWorkbench />} />
      <Route path="/production-travelers" element={<ProductionTravelers />} />
      <Route path="/production-travelers/:travelerId" element={<ProductionTravelers />} />
      <Route path="/team-stores" element={<TeamStoreLaunchpad />} />
      <Route path="/artwork-preflight" element={<ArtworkPreflight />} />
      <Route path="/dtf-studio" element={<DTFPrepStudio />} />
      <Route path="/supplier-catalog/import" element={<SupplierCatalogImport />} />
      <Route path="/supplier-catalog" element={<SupplierCatalogReview />} />
      <Route path="/labels" element={<BarcodeLabelGenerator />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/woo-sync" element={<WooSync />} />
      <Route path="/color-aliases" element={<ColorAliasReview />} />
      <Route path="/color-pairings" element={<ColorAliasReview />} />
      <Route path="/mapping-repair" element={<ProductMappingRepair />} />
      <Route path="/product-blank-mappings" element={<ProductBlankMappings />} />
      <Route path="/product-color-replacement" element={<ProductColorReplacement />} />
      <Route path="/product-type-manager" element={<ProductTypeManager />} />
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
      <Route path="/wordpress-integrity" element={<WordPressCommerceIntegrity />} />
      <Route path="/marketing" element={<MarketingWorkspace />} />
      <Route path="/inventory-audit" element={<InventoryAudit />} />
      <Route path="/production-photo-proof" element={<ProductionPhotoProof />} />
      <Route path="/nfc-writer" element={<NfcWriter />} />
      <Route path="/test-tag" element={<TestTag />} />
      <Route path="/pullsheets" element={<PullSheetList />} />
      <Route path="/pullsheets/:jobId" element={<PullSheetView />} />
      <Route path="/return-finished" element={<ReturnFinishedInventory />} />
      <Route path="/finished/create" element={<CreateFinishedFromBlank />} />
      <Route path="/audit/warehouse" element={<WarehouseAuditReport />} />
      <Route path="/application-guide" element={<ApplicationGuide />} />
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
          <Route path="/customer-portal" element={publicPage(<CustomerPortal />)} />
          <Route path="/team-order" element={publicPage(<PublicClientOrderForm />)} />
          <Route path="/design" element={publicPage(<PublicDesignConfigurator />)} />
          <Route path="/stores/:slug" element={publicPage(<PublicTeamStore />)} />
          <Route path="/coordinator/:token" element={publicPage(<CoordinatorDashboard />)} />
          <Route path="/mockup-review" element={publicPage(<MockupCustomerReview />)} />
          <Route path="/marketing-review" element={publicPage(<MarketingClientReview />)} />
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
