/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage'));
const AccountsReceivable = lazy(() => import('./pages/AccountsReceivable'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AllowanceReceipts = lazy(() => import('./pages/AllowanceReceipts'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const Financial = lazy(() => import('./pages/Financial'));
const HomePage = lazy(() => import('./pages/HomePage'));
const IndirectCosts = lazy(() => import('./pages/IndirectCosts'));
const LogoutSuccess = lazy(() => import('./pages/LogoutSuccess'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Patrimony = lazy(() => import('./pages/Patrimony'));
const Profile = lazy(() => import('./pages/Profile'));
const ReajusteContratual = lazy(() => import('./pages/ReajusteContratual'));
const Recognitions = lazy(() => import('./pages/Recognitions'));
const Reports = lazy(() => import('./pages/Reports'));
const SegurosLaudos = lazy(() => import('./pages/SegurosLaudos'));
const Supplies = lazy(() => import('./pages/Supplies'));
const Support = lazy(() => import('./pages/Support'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskTemplates = lazy(() => import('./pages/TaskTemplates'));
const TaskAutomations = lazy(() => import('./pages/TaskAutomations'));
const TaskReports = lazy(() => import('./pages/TaskReports'));
const Uniforms = lazy(() => import('./pages/Uniforms'));
const UserProfiles = lazy(() => import('./pages/UserProfiles'));
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcceptInvite": AcceptInvite,
    "AccessDeniedPage": AccessDeniedPage,
    "AccountsReceivable": AccountsReceivable,
    "Alerts": Alerts,
    "AllowanceReceipts": AllowanceReceipts,
    "Contracts": Contracts,
    "Dashboard": Dashboard,
    "Employees": Employees,
    "Financial": Financial,
    "HomePage": HomePage,
    "IndirectCosts": IndirectCosts,
    "LogoutSuccess": LogoutSuccess,
    "Marketing": Marketing,
    "Marketplace": Marketplace,
    "Patrimony": Patrimony,
    "Profile": Profile,
    "ReajusteContratual": ReajusteContratual,
    "Recognitions": Recognitions,
    "Reports": Reports,
    "SegurosLaudos": SegurosLaudos,
    "Supplies": Supplies,
    "Support": Support,
    "Tasks": Tasks,
    "TaskTemplates": TaskTemplates,
    "TaskAutomations": TaskAutomations,
    "TaskReports": TaskReports,
    "Uniforms": Uniforms,
    "UserProfiles": UserProfiles,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
