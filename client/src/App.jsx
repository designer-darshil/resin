import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import AppShell from './components/AppShell.jsx';
import { lazy, Suspense } from 'react';

// Pages
import LoginPage from './pages/Login.jsx';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>💎</div>
        <div>Loading…</div>
      </div>
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
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
