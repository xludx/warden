import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { getToken, setToken } from './lib/api';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Applications from './pages/Applications';
import ServiceAccounts from './pages/ServiceAccounts';
import ApiKeys from './pages/ApiKeys';
import Audit from './pages/Audit';

function OAuthCapture() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (token) {
    setToken(token);
    // Remove token from URL without triggering a navigation
    window.history.replaceState({}, '', window.location.pathname);
  }

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <OAuthCapture />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="users" element={<Users />} />
                  <Route path="applications" element={<Applications />} />
                  <Route path="service-accounts" element={<ServiceAccounts />} />
                  <Route path="api-keys" element={<ApiKeys />} />
                  <Route path="audit" element={<Audit />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
