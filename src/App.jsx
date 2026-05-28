import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Header from './Header';

import CreateProduct from './CreateProduct';
import AssignBin from './AssignBin';
import BinContents from './BinContents';
import BinsDashboard from './BinsDashboard';
import NfcWriter from './NfcWriter';
import TestTag from './TestTag';
import Home from './Home';
import SelectProduct from './SelectProduct';

function App() {
    return (
        <BrowserRouter>
            <Header />

            <div style={{ paddingTop: "20px" }}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/bins" element={<BinsDashboard />} />
                    <Route path="/select-product" element={<SelectProduct />} />
                    <Route path="/create-product" element={<CreateProduct />} />
                    <Route path="/bin/:binId" element={<BinContents />} />
                    <Route path="/assign-bin" element={<AssignBin />} />
                    <Route path="/nfc-writer" element={<NfcWriter />} />
                    <Route path="/test-tag" element={<TestTag />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
