import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initAutoSync } from './services/sheetsSync';

// Start auto-sync listener (syncs when internet becomes available)
initAutoSync();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
