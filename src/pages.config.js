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
import AcceptInvite from './pages/AcceptInvite';
import AccessDeniedPage from './pages/AccessDeniedPage';
import AccountsReceivable from './pages/AccountsReceivable';
import Alerts from './pages/Alerts';
import AllowanceReceipts from './pages/AllowanceReceipts';
import CRM from './pages/CRM';
import Contracts from './pages/Contracts';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Financial from './pages/Financial';
import HomePage from './pages/HomePage';
import IndirectCosts from './pages/IndirectCosts';
import LogoutSuccess from './pages/LogoutSuccess';
import Marketing from './pages/Marketing';
import Marketplace from './pages/Marketplace';
import Measurements from './pages/Measurements';
import OS from './pages/OS';
import Oficios from './pages/Oficios';
import Patrimony from './pages/Patrimony';
import Profile from './pages/Profile';
import ReajusteContratual from './pages/ReajusteContratual';
import Recognitions from './pages/Recognitions';
import Reports from './pages/Reports';
import SegurosLaudos from './pages/SegurosLaudos';
import Supplies from './pages/Supplies';
import Support from './pages/Support';
import Tasks from './pages/Tasks';
import TaskTemplates from './pages/TaskTemplates';
import TaskAutomations from './pages/TaskAutomations';
import TaskReports from './pages/TaskReports';
import Uniforms from './pages/Uniforms';
import UserProfiles from './pages/UserProfiles';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcceptInvite": AcceptInvite,
    "AccessDeniedPage": AccessDeniedPage,
    "AccountsReceivable": AccountsReceivable,
    "Alerts": Alerts,
    "AllowanceReceipts": AllowanceReceipts,
    "CRM": CRM,
    "Contracts": Contracts,
    "Dashboard": Dashboard,
    "Employees": Employees,
    "Financial": Financial,
    "HomePage": HomePage,
    "IndirectCosts": IndirectCosts,
    "LogoutSuccess": LogoutSuccess,
    "Marketing": Marketing,
    "Marketplace": Marketplace,
    "Measurements": Measurements,
    "OS": OS,
    "Oficios": Oficios,
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