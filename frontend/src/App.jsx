import React from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { DatabaseZap, LayoutDashboard } from "lucide-react";
import { resources } from "./config/resources.jsx";
import { CrudPage } from "./pages/CrudPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";

export function App() {
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
      </aside>

      <main className="main-area">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {resources.map((resource) => (
            <Route key={resource.key} path={`/${resource.key}`} element={<CrudPage config={resource} />} />
          ))}
        </Routes>
      </main>
    </div>
  );
}
 
