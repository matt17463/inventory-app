import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import AddItemToBin from './AddItemToBin';
import BlankInventory from './BlankInventory';
import PullSheetList from './PullSheetList';
import PullSheetView from './PullSheetView';
import ReturnFinishedInventory from './ReturnFinishedInventory';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="top-nav">
          <Link to="/" className="brand">Skilled Crafting Inventory</Link>
          <nav>
            <Link to="/">Blank Inventory</Link>
            <Link to="/add-item">Add Item</Link>
            <Link to="/pullsheets">Pull Sheets</Link>
            <Link to="/return-finished">Return Finished</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<BlankInventory />} />
          <Route path="/inventory/blanks" element={<BlankInventory />} />
          <Route path="/add-item" element={<AddItemToBin />} />
          <Route path="/pullsheets" element={<PullSheetList />} />
          <Route path="/pullsheets/:jobId" element={<PullSheetView />} />
          <Route path="/return-finished" element={<ReturnFinishedInventory />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
