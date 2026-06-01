import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import AddItemToBin from './AddItemToBin';
import AuditMode from './AuditMode';
import BinContents from './BinContents';
import BinsDashboard from './BinsDashboard';
import BlankInventory from './BlankInventory';
import EditBlankItems from './EditBlankItems';
import Home from './Home';
import InventoryValuation from './InventoryValuation';
import LowStock from './LowStock';
import NfcWriter from './NfcWriter';
import PullSheetList from './PullSheetList';
import PullSheetView from './PullSheetView';
import Reservations from './Reservations';
import ReturnFinishedInventory from './ReturnFinishedInventory';
import ScanInventory from './ScanInventory';
import TestTag from './TestTag';
import TransferInventory from './TransferInventory';
import WooSync from './WooSync';
import ActivityPage from './ActivityPage';
import logo from './assets/logo.png';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="top-nav">
          <Link to="/" className="brand">
            <img src={logo} alt="Skilled Crafting" />
            <span>Skilled Crafting Inventory</span>
          </Link>
          <nav>
            <Link to="/inventory/blanks">Inventory</Link>
            <Link to="/inventory/edit-blanks">Edit Blanks</Link>
            <Link to="/add-item">Add Item</Link>
            <Link to="/bins">Bins</Link>
            <Link to="/scan">Scan</Link>
            <Link to="/transfer">Transfer</Link>
            <Link to="/audit">Audit</Link>
            <Link to="/reservations">Reservations</Link>
            <Link to="/low-stock">Low Stock</Link>
            <Link to="/nfc-writer">NFC</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inventory/blanks" element={<BlankInventory />} />
          <Route path="/inventory/edit-blanks" element={<EditBlankItems />} />
          <Route path="/bins" element={<BinsDashboard />} />
          <Route path="/bin/:binId" element={<BinContents />} />
          <Route path="/add-item" element={<AddItemToBin />} />
          <Route path="/scan" element={<ScanInventory />} />
          <Route path="/transfer" element={<TransferInventory />} />
          <Route path="/audit" element={<AuditMode />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/valuation" element={<InventoryValuation />} />
          <Route path="/low-stock" element={<LowStock />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/woo-sync" element={<WooSync />} />
          <Route path="/nfc-writer" element={<NfcWriter />} />
          <Route path="/test-tag" element={<TestTag />} />
          <Route path="/pullsheets" element={<PullSheetList />} />
          <Route path="/pullsheets/:jobId" element={<PullSheetView />} />
          <Route path="/return-finished" element={<ReturnFinishedInventory />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
