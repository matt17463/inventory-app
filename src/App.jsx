import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
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
import ProductionBoard from './ProductionBoard';
import FinishedMatchSuggestions from './FinishedMatchSuggestions';
import SpoilageTracking from './SpoilageTracking';
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
import logo from './assets/logo.png';
import './App.css';
import AuthGate from './AuthGate';
import CreateFinishedFromBlank from './CreateFinishedFromBlank';
import WarehouseAuditReport from './WarehouseAuditReport';

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
      <div className="app-shell">
        <header className="top-nav">
          <Link to="/" className="brand">
            <img src={logo} alt="Skilled Crafting" />
            <span>Skilled Crafting Inventory</span>
          </Link>
          <nav>
            <Link to="/inventory/blanks">Inventory</Link>
            <Link to="/inventory/edit-blanks">Edit Blanks</Link>
            <Link to="/inventory/import">Import</Link>
            <Link to="/inventory/samples">Samples</Link>
            <Link to="/add-item">Add Item</Link>
            <Link to="/bins">Bins</Link>
            <Link to="/scan">Scan</Link>
            <Link to="/transfer">Transfer</Link>
            <Link to="/audit">Audit</Link>
            <Link to="/audit/warehouse">Warehouse Audit</Link>
            <Link to="/pullsheets">Pull Sheets</Link>
            <Link to="/return-finished">Finished Products</Link>
            <Link to="/reservations">Reservations</Link>
            <Link to="/low-stock">Low Stock</Link>
            <Link to="/purchasing">Purchasing</Link>
            <Link to="/purchase-orders">POs</Link>
            <Link to="/waiting-on">Waiting On</Link>
            <Link to="/production-board">Production</Link>
            <Link to="/finished-suggestions">Finished Matches</Link>
            <Link to="/spoilage">Spoilage</Link>
            <Link to="/color-aliases">Color Aliases</Link>
            <Link to="/nfc-writer">NFC</Link>
          </nav>
        </header>

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
          <Route path="/production-board" element={<ProductionBoard />} />
          <Route path="/finished-suggestions" element={<FinishedMatchSuggestions />} />
          <Route path="/spoilage" element={<SpoilageTracking />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/woo-sync" element={<WooSync />} />
          <Route path="/color-aliases" element={<ColorAliasReview />} />
          <Route path="/nfc-writer" element={<NfcWriter />} />
          <Route path="/test-tag" element={<TestTag />} />
          <Route path="/pullsheets" element={<PullSheetList />} />
          <Route path="/pullsheets/:jobId" element={<PullSheetView />} />
          <Route path="/return-finished" element={<ReturnFinishedInventory />} />
                  <Route path="/finished/create" element={<CreateFinishedFromBlank />} />
                  <Route path="/audit/warehouse" element={<WarehouseAuditReport />} />
        </Routes>
      </div>
      </AuthGate>
    </BrowserRouter>
  );
}