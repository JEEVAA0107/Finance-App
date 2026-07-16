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
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import './index.css';

function AppRoutes() {
  const { user, loading, isSuperAdmin, isAdmin } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading...</p></div>;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={isSuperAdmin ? <SuperAdminDashboard /> : <Dashboard />} />
        <Route path="customers" element={isSuperAdmin ? <Navigate to="/" replace /> : <CustomersPage />} />
        <Route path="customers/:id" element={isSuperAdmin ? <Navigate to="/" replace /> : <CustomerDetail />} />
        <Route path="loans" element={isSuperAdmin ? <Navigate to="/" replace /> : <LoansPage />} />
        <Route path="loans/create" element={isSuperAdmin ? <Navigate to="/" replace /> : <CreateLoan />} />
        <Route path="loans/:id" element={isSuperAdmin ? <Navigate to="/" replace /> : <LoanDetail />} />
        <Route path="collections" element={isSuperAdmin ? <Navigate to="/" replace /> : <CollectionPage />} />
        <Route path="users" element={isAdmin ? <UsersPage /> : <Navigate to="/" replace />} />
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
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
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
