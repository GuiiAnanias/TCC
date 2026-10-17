import React from "react";
import { NavLink, Navigate, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { DatabaseZap, LayoutDashboard } from "lucide-react";
import { resources } from "./config/resources.jsx";
import { CrudPage } from "./pages/CrudPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";

export function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}

function AppRoutes() {
  const auth = useAuth();
  if (auth.loading) return <main className="login-page" role="status">Verificando sessão…</main>;
  if (auth.error) return <main className="login-page"><div className="login-card"><p role="alert">{auth.error}</p><button className="primary-button" onClick={() => auth.restore()}>Tentar novamente</button><button className="secondary-button" onClick={auth.logout}>Voltar ao login</button></div></main>;
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      {resources.map((resource) => <Route key={resource.key} path={`/${resource.key}`} element={<CrudPage config={resource} />} />)}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>;
}

function ProtectedLayout() {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <DatabaseZap size={28} />
          <div>
            <strong>CODE BI</strong>
            <span>Gestão de projetos</span>
          </div>
        </div>

        <nav className="nav-list">
          <NavLink to="/dashboard" className="nav-link">
            <LayoutDashboard size={19} />
            Dashboard
          </NavLink>
          {resources.map((resource) => {
            const Icon = resource.icon;

            return (
              <NavLink key={resource.key} to={`/${resource.key}`} className="nav-link">
                <Icon size={19} />
                {resource.title}
              </NavLink>
            );
          })}
        </nav>
        <div className="session-panel"><span>{auth.user.nomeUsuario.charAt(0).toLocaleUpperCase("pt-BR") + auth.user.nomeUsuario.slice(1)}</span><button className="secondary-button" onClick={auth.logout}>Sair</button></div>
      </aside>

      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
 
