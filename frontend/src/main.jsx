import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Initialize Theme Preference
const savedTheme = localStorage.getItem('finova_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
