/**
 * [TELA][ROTA] Estrutura do front: provedores de tema e login, rotas de cada tela (React Router) e
 * o layout autenticado (menu lateral, barra superior e conteúdo).
 */

import { AwardsPage } from "./pages/AwardsPage.jsx";
import { EntityDashboardPage } from "./pages/EntityDashboardPage.jsx";
import { TasksPage } from "./pages/TasksPage.jsx";
import { ImportacaoPage } from "./pages/ImportacaoPage.jsx";
import { RelatoriosPage } from "./pages/RelatoriosPage.jsx";
import { RelatoriosHistoricoPage } from "./pages/RelatoriosHistoricoPage.jsx";
import React, { useState } from "react";
import { NavLink, Navigate, Route, Routes, Outlet, useLocation } from "react-router-dom";
import {
  ChartNoAxesCombined,
  DatabaseZap,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ListTodo,
  Award,
  FileUp,
  UserRoundSearch,
  FileChartColumn,
} from "lucide-react";
import { resources } from "./config/resources.jsx";
import { CrudPage } from "./pages/CrudPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RedefinirSenhaPage } from "./pages/RedefinirSenhaPage.jsx";
import { EsqueciSenhaPage } from "./pages/EsqueciSenhaPage.jsx";
import { ThemeProvider, ThemeToggle } from "./ThemeContext.jsx";
import { PageActionsSlot } from "./components/PageActions.jsx";
import { FontSizeControl } from "./components/FontSizeControl.jsx";

// Link do menu para um cadastro definido em config/resources.jsx.
const resourceLink = (key) => {
  const resource = resources.find((item) => item.key === key);
  return { to: `/${key}`, label: resource.title, icon: resource.icon };
};

/** Menu lateral em três grupos, na ordem descrita no documento (história 2.4). */
const NAV_GROUPS = [
  {
    title: "Análise",
    links: [
      { to: "/dashboard", label: "Dashboard Geral", icon: LayoutDashboard, end: true },
      { to: "/dashboard/projetos", label: "Visão por projeto", icon: ChartNoAxesCombined },
      { to: "/dashboard/colaboradores", label: "Visão por colaborador", icon: UserRoundSearch },
      { to: "/relatorios", label: "Relatórios", icon: FileChartColumn },
    ],
  },
  {
    title: "Cadastros",
    links: ["clientes", "colaboradores", "remuneracoes", "projetos"].map(resourceLink),
  },
  {
    title: "Operação",
    links: [
      resourceLink("apontamentos"),
      { to: "/tarefas", label: "Tarefas e sprints", icon: ListTodo },
      { to: "/premiacao", label: "Premiação", icon: Award },
      { to: "/importacao", label: "Importar horas", icon: FileUp },
    ],
  },
];

// [TELA] Raiz da aplicação: tema e sessão disponíveis para todas as telas.
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

// [ROTA] Mapa de endereços para telas. Enquanto a sessão é conferida mostra "Verificando sessão…".
function AppRoutes() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <main className="login-page" role="status">
        Verificando sessão…
      </main>
    );
  if (auth.error)
    return (
      <main className="login-page">
        <div className="login-card">
          <p role="alert">{auth.error}</p>
          <button className="primary-button" onClick={() => auth.restore()}>
            Tentar novamente
          </button>
          <button className="secondary-button" onClick={auth.logout}>
            Voltar ao login
          </button>
        </div>
      </main>
    );
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      {/* [SEGURANCA] Rotas internas: só abrem com login (ver ProtectedLayout). */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* Sem o código na URL, o dashboard individual abre na escolha do projeto/colaborador. */}
        <Route path="/dashboard/projetos" element={<EntityDashboardPage type="projetos" />} />
        <Route path="/dashboard/projetos/:id" element={<EntityDashboardPage type="projetos" />} />
        <Route
          path="/dashboard/colaboradores"
          element={<EntityDashboardPage type="colaboradores" />}
        />
        <Route
          path="/dashboard/colaboradores/:id"
          element={<EntityDashboardPage type="colaboradores" />}
        />
        <Route path="/premiacao" element={<AwardsPage />} />
        <Route path="/tarefas" element={<TasksPage />} />
        <Route path="/importacao" element={<ImportacaoPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/relatorios/historico" element={<RelatoriosHistoricoPage />} />
        <Route path="/relatorios/:id" element={<RelatoriosPage />} />
        {resources.map((resource) => (
          <Route
            key={resource.key}
            path={`/${resource.key}`}
            element={<CrudPage key={resource.key} config={resource} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

// [SEGURANCA][TELA] Layout das telas internas. Sem usuário logado, redireciona para /login
// guardando o endereço pedido.
function ProtectedLayout() {
  const auth = useAuth();
  const location = useLocation();
  const [actionsSlot, setActionsSlot] = useState(null);
  // [ESTADO] Menu recolhido ou não; a escolha fica salva no navegador.
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
    try {
      localStorage.setItem("code-bi-sidebar-collapsed", String(next));
    } catch {
      /* Preferência apenas nesta sessão. */
    }
  }
  if (!auth.user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  const sidebarToggle = (
    <button
      className="icon-button sidebar-toggle"
      type="button"
      onClick={toggleSidebar}
      aria-expanded={!collapsed}
      aria-controls="sidebar-navigation"
      aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
    >
      {collapsed ? (
        <PanelLeftOpen size={18} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={18} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-row">
            <div className="brand">
              <DatabaseZap size={22} aria-hidden="true" />
              <div className="brand-copy">
                <strong>CODE BI</strong>
                <span>Gestão de projetos</span>
              </div>
            </div>
            {sidebarToggle}
          </div>
        </div>

        <nav className="nav-list" id="sidebar-navigation" aria-label="Menu principal">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.title} role="group" aria-label={group.title}>
              <span className="nav-group-title" aria-hidden="true">
                {group.title}
              </span>
              {group.links.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="nav-link"
                  title={collapsed ? label : undefined}
                  aria-label={label}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="sidebar-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="session-panel">
          <span className="session-name" title={auth.user.nomeUsuario}>
            {auth.user.nomeUsuario.charAt(0).toLocaleUpperCase("pt-BR") +
              auth.user.nomeUsuario.slice(1)}
          </span>
          <button
            className="secondary-button logout-button"
            type="button"
            onClick={auth.logout}
            title={collapsed ? "Sair" : undefined}
            aria-label="Sair"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="sidebar-label">Sair</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        {/* [TELA] Barra superior: ações da página (Atualizar), tamanho do texto (Aa) e tema. */}
        <header className="topbar">
          <div className="page-actions" ref={setActionsSlot} />
          <div className="topbar-controls" role="group" aria-label="Preferências de exibição">
            <FontSizeControl />
            <ThemeToggle />
          </div>
        </header>
        <div className="main-content">
          <PageActionsSlot.Provider value={actionsSlot}>
            <Outlet />
          </PageActionsSlot.Provider>
        </div>
      </main>
    </div>
  );
}
