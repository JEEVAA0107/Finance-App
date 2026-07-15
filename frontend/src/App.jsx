import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/CustomersPage';
import CustomerDetail from './pages/CustomerDetail';
import LoansPage from './pages/LoansPage';
import LoanDetail from './pages/LoanDetail';
import CreateLoan from './pages/CreateLoan';
import CollectionPage from './pages/CollectionPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import './index.css';

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading...</p></div>;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/create" element={<CreateLoan />} />
        <Route path="loans/:id" element={<LoanDetail />} />
        <Route path="collections" element={<CollectionPage />} />
        <Route path="reports" element={isAdmin ? <ReportsPage /> : <Navigate to="/" replace />} />
        <Route path="users" element={isAdmin ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="audit" element={isAdmin ? <AuditPage /> : <Navigate to="/" replace />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) CapacitorApp.exitApp();
        else window.history.back();
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '13px',
              maxWidth: '90vw',
              wordBreak: 'break-word',
            },
          }}
          containerStyle={{ top: 60 }}
          visibleToasts={2}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
