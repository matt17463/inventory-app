import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import './themes.css';
import { ThemeProvider } from './ui/ThemeProvider.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
