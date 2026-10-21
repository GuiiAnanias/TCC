import { TasksPage } from "./pages/TasksPage.jsx";
import React, { useState } from "react";
import { NavLink, Navigate, Route, Routes, Outlet, useLocation } from "react-router-dom";
import { DatabaseZap, LayoutDashboard, PanelLeftClose, PanelLeftOpen, LogOut, ListTodo } from "lucide-react";
import { resources } from "./config/resources.jsx";
import { CrudPage } from "./pages/CrudPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";

export function App() {
  return <ThemeProvider><AuthProvider><AppRoutes /></AuthProvider></ThemeProvider>;
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
      <Route path="/tarefas" element={<TasksPage />} />
      {resources.map((resource) => <Route key={resource.key} path={`/${resource.key}`} element={<CrudPage config={resource} />} />)}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>;
}

function ProtectedLayout() {
  const auth = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("code-bi-sidebar-collapsed");
      if (saved !== null) return saved === "true";
    } catch {
      // Mantém o controle disponível mesmo sem armazenamento local.
    }
    return window.matchMedia("(max-width: 860px)").matches;
  });
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("code-bi-sidebar-collapsed", String(next)); } catch { /* Preferência apenas nesta sessão. */ }
  }
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  const sidebarToggle = (
    <button className="icon-button sidebar-toggle" type="button" onClick={toggleSidebar}
      aria-expanded={!collapsed} aria-controls="sidebar-navigation"
      aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}>
      {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
    </button>
  );
  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-row">
            <div className="brand">
              <DatabaseZap size={28} aria-hidden="true" />
              <div className="brand-copy">
                <strong>CODE BI</strong>
                <span>Gestão de projetos</span>
              </div>
            </div>
            {sidebarToggle}
          </div>
        </div>

        <nav className="nav-list" id="sidebar-navigation" aria-label="Menu principal">
          <NavLink to="/dashboard" className="nav-link" title="Dashboard" aria-label="Dashboard">
            <LayoutDashboard size={19} aria-hidden="true" />
            <span className="sidebar-label">Dashboard</span>
          </NavLink>
          {resources.map((resource) => {
            const Icon = resource.icon;

            return (
              <NavLink key={resource.key} to={`/${resource.key}`} className="nav-link" title={resource.title} aria-label={resource.title}>
                <Icon size={19} aria-hidden="true" />
                <span className="sidebar-label">{resource.title}</span>
              </NavLink>
            );
          })}
          <NavLink to="/tarefas" className="nav-link" title="Tarefas e sprints" aria-label="Tarefas e sprints"><ListTodo size={19} aria-hidden="true" /><span className="sidebar-label">Tarefas e sprints</span></NavLink>
        </nav>
        <div className="sidebar-actions-slot" aria-hidden="true" />
        <div className="session-panel">
          <span className="session-name" title={auth.user.nomeUsuario}>{auth.user.nomeUsuario.charAt(0).toLocaleUpperCase("pt-BR") + auth.user.nomeUsuario.slice(1)}</span>
          <button className="secondary-button logout-button" type="button" onClick={auth.logout} title="Sair" aria-label="Sair">
            <LogOut size={18} aria-hidden="true" /><span className="sidebar-label">Sair</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
 
