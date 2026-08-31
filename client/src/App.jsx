import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import AppShell from './components/AppShell.jsx';
import { lazy, Suspense } from 'react';

// Pages
import LoginPage from './pages/Login.jsx';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const SuppliersPage = lazy(() => import('./pages/Suppliers.jsx'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail.jsx'));
const CustomersPage = lazy(() => import('./pages/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'));
const PurchasesPage = lazy(() => import('./pages/Purchases.jsx'));
const PurchaseDetail = lazy(() => import('./pages/PurchaseDetail.jsx'));
const StockPage = lazy(() => import('./pages/Stock.jsx'));
const CoatingJobsPage = lazy(() => import('./pages/CoatingJobs.jsx'));
const CoatingJobDetail = lazy(() => import('./pages/CoatingJobDetail.jsx'));
const EmployeesPage = lazy(() => import('./pages/Employees.jsx'));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail.jsx'));
const OvertimePage = lazy(() => import('./pages/Overtime.jsx'));
const SalaryPage = lazy(() => import('./pages/Salary.jsx'));
const AdvancesPage = lazy(() => import('./pages/Advances.jsx'));
const DispatchPage = lazy(() => import('./pages/Dispatch.jsx'));
const PaymentsPage = lazy(() => import('./pages/Payments.jsx'));
const WhatsAppPage = lazy(() => import('./pages/WhatsApp.jsx'));
const ReportsPage = lazy(() => import('./pages/Reports.jsx'));
const AdminPage = lazy(() => import('./pages/Admin.jsx'));

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-root)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
        <svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Loading ERP</span>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppShell>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/suppliers/:id" element={<SupplierDetail />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/purchases/:id" element={<PurchaseDetail />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/coating-jobs" element={<CoatingJobsPage />} />
                <Route path="/coating-jobs/:id" element={<CoatingJobDetail />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/overtime" element={<OvertimePage />} />
                <Route path="/salary" element={<SalaryPage />} />
                <Route path="/advances" element={<AdvancesPage />} />
                <Route path="/dispatch" element={<DispatchPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/whatsapp" element={<WhatsAppPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
