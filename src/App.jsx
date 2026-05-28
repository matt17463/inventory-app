import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from './Header';
import PullSheetList from './PullSheetList';

import CreateProduct from './CreateProduct';
import AssignBin from './AssignBin';
import BinContents from './BinContents';
import BinsDashboard from './BinsDashboard';
import NfcWriter from './NfcWriter';
import PullSheetView from './PullSheetView';

import TestTag from './TestTag';
import Home from './Home';
import SelectProduct from './SelectProduct';

function App() {
    return (
        <BrowserRouter>
            {/* Global Header (logo + menu) */}
            <Header />

            {/* Page content */}
            <div style={{ paddingTop: "20px" }}>
                <Routes>

                    {/* Home */}
                    <Route path="/" element={<Home />} />

                    {/* Bins */}
                    <Route path="/bins" element={<BinsDashboard />} />
                    <Route path="/bin/:binId" element={<BinContents />} />

                    {/* Products */}
                    <Route path="/select-product" element={<SelectProduct />} />
                    <Route path="/create-product" element={<CreateProduct />} />

                    {/* Assign product to bin */}
                    <Route path="/assign-bin" element={<AssignBin />} />

                    {/* NFC */}
                    <Route path="/nfc-writer" element={<NfcWriter />} />
                    <Route path="/test-tag" element={<TestTag />} />

                    {/* Pullsheet builder (HTML inside iframe) */}
                    <Route path="/pullsheet/:jobId" element={<PullSheetView />} />
<Route path="/pullsheets" element={<PullSheetList />} />

                    <Route
                        path="/pullsheet"
                        element={
                            <iframe
                                src="/pullsheet.html"
                                style={{
                                    width: "100%",
                                    height: "100vh",
                                    border: "none"
                                }}
                            />
                        }
                    />

                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
