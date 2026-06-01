import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import AddItemToBin from './AddItemToBin';
import BinContents from './BinContents';
import BinsDashboard from './BinsDashboard';
import BlankInventory from './BlankInventory';
import Home from './Home';
import NfcWriter from './NfcWriter';
import PullSheetList from './PullSheetList';
import PullSheetView from './PullSheetView';
import ReturnFinishedInventory from './ReturnFinishedInventory';
import TestTag from './TestTag';
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
            <Link to="/inventory/blanks">Blank Inventory</Link>
            <Link to="/bins">Bins</Link>
            <Link to="/add-item">Add Item</Link>
            <Link to="/nfc-writer">NFC</Link>
            <Link to="/pullsheets">Pull Sheets</Link>
            <Link to="/return-finished">Return Finished</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inventory/blanks" element={<BlankInventory />} />
          <Route path="/bins" element={<BinsDashboard />} />
          <Route path="/bin/:binId" element={<BinContents />} />
          <Route path="/add-item" element={<AddItemToBin />} />
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
