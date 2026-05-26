import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
            <Routes>

                <Route path="/" element={<Home />} />


                {/* Bins dashboard */}
                <Route path="/bins" element={<BinsDashboard />} />

                <Route path="/select-product" element={<SelectProduct />} />
                <Route path="/create-product" element={<CreateProduct />} />



                {/* View bin contents */}
                <Route path="/bin/:binId" element={<BinContents />} />

                {/* Assign a product to a bin */}
                <Route path="/assign-bin" element={<AssignBin />} />

                {/* NFC tag writer */}
                <Route path="/nfc-writer" element={<NfcWriter />} />

                {/* NFC tag tester */}
                <Route path="/test-tag" element={<TestTag />} />

                {/* Create product (home) */}
                <Route path="/" element={<CreateProduct />} />

            </Routes>
        </BrowserRouter>
    );
}

export default App;
