import { lazy, Suspense } from 'react';
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
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const FiscalSettings = lazy(() => import('./pages/FiscalSettings'));
const Invoices = lazy(() => import('./pages/Invoices'));
const BankReconciliation = lazy(() => import('./pages/BankReconciliation'));
const Exports = lazy(() => import('./pages/Exports'));
const BankAccounts = lazy(() => import('./pages/BankAccounts'));
const AccountsPayable = lazy(() => import('./pages/AccountsPayable'));
const AccountingBackup = lazy(() => import('./pages/AccountingBackup'));
const DRE = lazy(() => import('./pages/DRE'));
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));
const CashFlow = lazy(() => import('./pages/CashFlow'));
const RecurringTemplates = lazy(() => import('./pages/RecurringTemplates'));
const Budget = lazy(() => import('./pages/Budget'));
const LeaveCalendar = lazy(() => import('./pages/LeaveCalendar'));
const FiscalPositions = lazy(() => import('./pages/FiscalPositions'));
const CostCenters = lazy(() => import('./pages/CostCenters'));
const Privacy = lazy(() => import('./pages/Privacy'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = Pages[mainPageKey];

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

// O Suspense fica dentro do Layout para que menu e cabeçalho continuem
// visíveis enquanto o código da página é baixado.
const LayoutWrapper = ({ children, currentPageName }) => {
  const content = <Suspense fallback={<PageLoader />}>{children}</Suspense>;
  return Layout
    ? <Layout currentPageName={currentPageName}>{content}</Layout>
    : content;
};

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" role="status" aria-live="polite">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="sr-only">Verificando sessão…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    const target = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />;
  }

  return children;
}

const protectedPage = (Page, currentPageName) => (
  <ProtectedRoute>
    <LayoutWrapper currentPageName={currentPageName}>
      <Page />
    </LayoutWrapper>
  </ProtectedRoute>
);

// Rotas com caminhos personalizados: [caminho, componente, nome usado no menu]
const EXTRA_ROUTES = [
  ["/fiscal", FiscalSettings, "fiscal"],
  ["/invoices", Invoices, "invoices"],
  ["/bank-reconciliation", BankReconciliation, "bank-reconciliation"],
  ["/exports", Exports, "exports"],
  ["/bank-accounts", BankAccounts, "bank-accounts"],
  ["/accounts-payable", AccountsPayable, "accounts-payable"],
  ["/accounting-backup", AccountingBackup, "accounting-backup"],
  ["/dre", DRE, "DRE"],
  ["/finance-dashboard", FinanceDashboard, "Financial"],
  ["/cash-flow", CashFlow, "CashFlow"],
  ["/company-settings", CompanySettings, "CompanySettings"],
  ["/recorrencias", RecurringTemplates, "RecurringTemplates"],
  ["/orcamento", Budget, "Budget"],
  ["/ferias-ausencias", LeaveCalendar, "LeaveCalendar"],
  ["/regras-fiscais", FiscalPositions, "FiscalPositions"],
  ["/centros-de-custo", CostCenters, "CostCenters"],
  ["/privacidade-lgpd", Privacy, "Privacy"],
];

const AuthenticatedApp = () => {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
      <Route path="/logout-success" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Até breve!</h2>
            <p className="text-gray-600">Você saiu do sistema com sucesso.</p>
            <a href="/login" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg">
              Fazer login novamente
            </a>
          </div>
        </div>
      } />

      {/* Rota principal */}
      {MainPage && <Route path="/" element={protectedPage(MainPage, mainPageKey)} />}

      {/* Rotas das páginas config (exclui AcceptInvite que já tem rota pública) */}
      {Object.entries(Pages).filter(([path]) => path !== "AcceptInvite").map(([path, Page]) => (
        <Route key={path} path={`/${path}`} element={protectedPage(Page, path)} />
      ))}

      {EXTRA_ROUTES.map(([path, Page, name]) => (
        <Route key={path} path={path} element={protectedPage(Page, name)} />
      ))}

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
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
