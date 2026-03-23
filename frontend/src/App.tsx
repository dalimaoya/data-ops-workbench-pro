import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import DatasourceList from './pages/datasource/DatasourceList';
import DatasourceForm from './pages/datasource/DatasourceForm';
import TableConfigList from './pages/table-config/TableConfigList';
import TableConfigCreate from './pages/table-config/TableConfigCreate';
import TableConfigDetail from './pages/table-config/TableConfigDetail';
import FieldConfigPage from './pages/table-config/FieldConfigPage';
import MaintenanceList from './pages/data-maintenance/MaintenanceList';
import DataBrowse from './pages/data-maintenance/DataBrowse';
import ImportPage from './pages/data-maintenance/ImportPage';
import DiffPreview from './pages/data-maintenance/DiffPreview';
import LogCenter from './pages/log-center/LogCenter';
import VersionRollback from './pages/version-rollback/VersionRollback';
import UserManagement from './pages/user-management/UserManagement';
import About from './pages/About';

function RequireAuth({ children }: { children: React.JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.JSX.Element }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/datasource" element={<RequireRole roles={['admin']}><DatasourceList /></RequireRole>} />
        <Route path="/datasource/create" element={<RequireRole roles={['admin']}><DatasourceForm /></RequireRole>} />
        <Route path="/datasource/edit/:id" element={<RequireRole roles={['admin']}><DatasourceForm /></RequireRole>} />
        <Route path="/table-config" element={<TableConfigList />} />
        <Route path="/table-config/create" element={<TableConfigCreate />} />
        <Route path="/table-config/detail/:id" element={<TableConfigDetail />} />
        <Route path="/table-config/fields/:id" element={<FieldConfigPage />} />
        <Route path="/data-maintenance" element={<MaintenanceList />} />
        <Route path="/data-maintenance/browse/:id" element={<DataBrowse />} />
        <Route path="/data-maintenance/import/:id" element={<ImportPage />} />
        <Route path="/data-maintenance/diff/:taskId" element={<DiffPreview />} />
        <Route path="/log-center" element={<LogCenter />} />
        <Route path="/version-rollback" element={<RequireRole roles={['admin']}><VersionRollback /></RequireRole>} />
        <Route path="/user-management" element={<RequireRole roles={['admin']}><UserManagement /></RequireRole>} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
