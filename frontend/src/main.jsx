import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA functionality with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update();
      console.log('PWA ServiceWorker registered with scope:', registration.scope);
    }).catch((error) => {
      console.error('PWA ServiceWorker registration failed:', error);
    });
  });
}

