import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import FiscalSettings from './pages/FiscalSettings';
import Invoices from './pages/Invoices';
import BankReconciliation from './pages/BankReconciliation';
import Exports from './pages/Exports';
import BankAccounts from './pages/BankAccounts';
import AccountsPayable from './pages/AccountsPayable';
import AccountingBackup from './pages/AccountingBackup';
import DRE from './pages/DRE';
import FinanceDashboard from './pages/FinanceDashboard';
import Oficios from './pages/Oficios';
import CompanySettings from './pages/CompanySettings';
import CashFlow from './pages/CashFlow';
import RecurringTemplates from './pages/RecurringTemplates';
import Budget from './pages/Budget';
import TechnicianPlanning from './pages/TechnicianPlanning';
import EmployeeOnboarding from './pages/EmployeeOnboarding';
import LeaveCalendar from './pages/LeaveCalendar';
import PerformanceReviews from './pages/PerformanceReviews';
import FiscalPositions from './pages/FiscalPositions';
import CostCenters from './pages/CostCenters';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = Pages[mainPageKey];

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}

const AuthenticatedApp = () => {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/logout-success" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Até breve!</h2>
            <p className="text-gray-600">Você saiu do sistema com sucesso.</p>
            <button onClick={() => window.location.href = '/login'} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
              Fazer login novamente
            </button>
          </div>
        </div>
      } />

      {/* Rota principal */}
      <Route path="/" element={
        <ProtectedRoute>
          <LayoutWrapper currentPageName={mainPageKey}>
            {MainPage && <MainPage />}
          </LayoutWrapper>
        </ProtectedRoute>
      } />

      {/* Rotas das páginas config (exclui AcceptInvite que já tem rota pública) */}
      {Object.entries(Pages).filter(([path]) => path !== 'AcceptInvite').map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <ProtectedRoute>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </ProtectedRoute>
          }
        />
      ))}

      {/* Rotas extras com caminhos personalizados */}
      <Route path="/fiscal" element={<ProtectedRoute><LayoutWrapper currentPageName="fiscal"><FiscalSettings /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><LayoutWrapper currentPageName="invoices"><Invoices /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/bank-reconciliation" element={<ProtectedRoute><LayoutWrapper currentPageName="bank-reconciliation"><BankReconciliation /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/exports" element={<ProtectedRoute><LayoutWrapper currentPageName="exports"><Exports /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/bank-accounts" element={<ProtectedRoute><LayoutWrapper currentPageName="bank-accounts"><BankAccounts /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/accounts-payable" element={<ProtectedRoute><LayoutWrapper currentPageName="accounts-payable"><AccountsPayable /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/accounting-backup" element={<ProtectedRoute><LayoutWrapper currentPageName="accounting-backup"><AccountingBackup /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/dre" element={<ProtectedRoute><LayoutWrapper currentPageName="DRE"><DRE /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/finance-dashboard" element={<ProtectedRoute><LayoutWrapper currentPageName="Financial"><FinanceDashboard /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/cash-flow" element={<ProtectedRoute><LayoutWrapper currentPageName="CashFlow"><CashFlow /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/Oficios" element={<ProtectedRoute><LayoutWrapper currentPageName="Oficios"><Oficios /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/company-settings" element={<ProtectedRoute><LayoutWrapper currentPageName="CompanySettings"><CompanySettings /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/recorrencias" element={<ProtectedRoute><LayoutWrapper currentPageName="RecurringTemplates"><RecurringTemplates /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/orcamento" element={<ProtectedRoute><LayoutWrapper currentPageName="Budget"><Budget /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/planejamento-tecnico" element={<ProtectedRoute><LayoutWrapper currentPageName="TechnicianPlanning"><TechnicianPlanning /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><LayoutWrapper currentPageName="EmployeeOnboarding"><EmployeeOnboarding /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/ferias-ausencias" element={<ProtectedRoute><LayoutWrapper currentPageName="LeaveCalendar"><LeaveCalendar /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/avaliacao-desempenho" element={<ProtectedRoute><LayoutWrapper currentPageName="PerformanceReviews"><PerformanceReviews /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/regras-fiscais" element={<ProtectedRoute><LayoutWrapper currentPageName="FiscalPositions"><FiscalPositions /></LayoutWrapper></ProtectedRoute>} />
      <Route path="/centros-de-custo" element={<ProtectedRoute><LayoutWrapper currentPageName="CostCenters"><CostCenters /></LayoutWrapper></ProtectedRoute>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
