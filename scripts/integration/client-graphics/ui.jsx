import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import ClientGraphics from '../../../src/ClientGraphics.jsx';
import OrderGraphicAssignment from '../../../src/OrderGraphicAssignment.jsx';
import ProductionTravelers from '../../../src/ProductionTravelers.jsx';
import {EmployeeAccessContext} from '../../../src/lib/employeeAccessContext.js';
createRoot(document.getElementById('root')).render(<EmployeeAccessContext.Provider value={{role:'manager'}}><BrowserRouter><div style={{padding:12,background:'#fff3ce'}}>ISOLATED TEST FIXTURE · fictional data · no production connection <nav><Link to="/client-graphics">Graphics</Link> | <Link to="/order-graphics">Assignments</Link> | <Link to="/production-travelers">Travelers</Link></nav></div><Routes><Route path="/client-graphics" element={<ClientGraphics/>}/><Route path="/order-graphics" element={<OrderGraphicAssignment/>}/><Route path="/production-travelers" element={<ProductionTravelers/>}/><Route path="/production-travelers/:travelerId" element={<ProductionTravelers/>}/></Routes></BrowserRouter></EmployeeAccessContext.Provider>);
