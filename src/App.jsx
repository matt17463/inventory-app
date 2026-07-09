import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AddItemToBin from './AddItemToBin';
import AuditMode from './AuditMode';
import BinContents from './BinContents';
import BinsDashboard from './BinsDashboard';
import BlankInventory from './BlankInventory';
import EditBlankItems from './EditBlankItems';
import Home from './Home';
import InventoryImport from './InventoryImport';
import InventoryValuation from './InventoryValuation';
import LowStock from './LowStock';
import NfcWriter from './NfcWriter';
import PullSheetList from './PullSheetList';
import Purchasing from './Purchasing';
import PurchaseOrderGenerator from './PurchaseOrderGenerator';
import PurchaseOrders from './PurchaseOrders';
import ReceivePurchaseOrder from './ReceivePurchaseOrder';
import WaitingOn from './WaitingOn';
import SupplierCatalogImport from './SupplierCatalogImport';
import SupplierCatalogReview from './SupplierCatalogReview';
import BarcodeLabelGenerator from './BarcodeLabelGenerator';
import PullSheetView from './PullSheetView';
import Reservations from './Reservations';
import ReturnFinishedInventory from './ReturnFinishedInventory';
import SampleInventory from './SampleInventory';
import ScanInventory from './ScanInventory';
import TestTag from './TestTag';
import TransferInventory from './TransferInventory';
import WooSync from './WooSync';
import ActivityPage from './ActivityPage';
import ColorAliasReview from './ColorAliasReview';
import CampaignForecast from './CampaignForecast';
import CustomerReorderIntelligence from './CustomerReorderIntelligence';
import JobCosting from './JobCosting';
import SpoilageTracking from './SpoilageTracking';
import FinishedMatchSuggestions from './FinishedMatchSuggestions';
import ProductionBoard from './ProductionBoard';
import ArtworkRequests from './ArtworkRequests';
import ShopTvMode from './ShopTvMode';
import VendorPriceComparison from './VendorPriceComparison';
import CapacityPlanning from './CapacityPlanning';
import ProductionCalendar from './ProductionCalendar';
import ProductionEstimator from './ProductionEstimator';
import PricingRules from './PricingRules';
import QuoteBuilder from './QuoteBuilder';
import QcChecklist from './QcChecklist';
import EmployeeTasks from './EmployeeTasks';
import OrderRiskDashboard from './OrderRiskDashboard';
import DailyCommandCenter from './DailyCommandCenter';
import ProductMappingRepair from './ProductMappingRepair';
import BulkPairingRepair from './BulkPairingRepair';
import ExceptionCenter from './ExceptionCenter';
import CustomerPortalAdmin from './CustomerPortalAdmin';
import CustomerPortal from './CustomerPortal';
import ApprovalAutomation from './ApprovalAutomation';
import AuditTrail from './AuditTrail';
import QuoteToOrder from './QuoteToOrder';
import ProductDataHealth from './ProductDataHealth';
import InventoryAudit from './InventoryAudit';
import ProductionPhotoProof from './ProductionPhotoProof';
import ManualInvoicedOrders from './ManualInvoicedOrders';
import AppShell from './components/AppShell';
import './App.css';
import AuthGate from './AuthGate';
import CreateFinishedFromBlank from './CreateFinishedFromBlank';
import WarehouseAuditReport from './WarehouseAuditReport';

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
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
          <Route path="/bulk-pairing-repair" element={<BulkPairingRepair />} />
          <Route path="/exception-center" element={<ExceptionCenter />} />
          <Route path="/customer-portal-admin" element={<CustomerPortalAdmin />} />
          <Route path="/customer-portal" element={<CustomerPortal />} />
          <Route path="/approval-automation" element={<ApprovalAutomation />} />
          <Route path="/audit-trail" element={<AuditTrail />} />
          <Route path="/quote-to-order" element={<QuoteToOrder />} />
          <Route path="/manual-orders" element={<ManualInvoicedOrders />} />
          <Route path="/product-data-health" element={<ProductDataHealth />} />
          <Route path="/inventory-audit" element={<InventoryAudit />} />
          <Route path="/production-photo-proof" element={<ProductionPhotoProof />} />
          <Route path="/nfc-writer" element={<NfcWriter />} />
          <Route path="/test-tag" element={<TestTag />} />
          <Route path="/pullsheets" element={<PullSheetList />} />
          <Route path="/pullsheets/:jobId" element={<PullSheetView />} />
          <Route path="/return-finished" element={<ReturnFinishedInventory />} />
                  <Route path="/finished/create" element={<CreateFinishedFromBlank />} />
                  <Route path="/audit/warehouse" element={<WarehouseAuditReport />} />
        </Routes>
      </AppShell>
      </AuthGate>
    </BrowserRouter>
  );
}