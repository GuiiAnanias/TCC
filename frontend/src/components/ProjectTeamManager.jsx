import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, Save, UserMinus, UsersRound, X } from "lucide-react";
import { api } from "../api/client.js";
import { StatusBadge } from "./StatusBadge.jsx";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function memberName(vinculo) {
  return vinculo.colaborador?.nomeCompleto || "Colaborador";
}

export function ProjectTeamManager({ project, onChanged, onClose }) {
  const [team, setTeam] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    colaboradorId: "",
    papel: "",
    dataEntrada: today()
  });
  const [editingRoles, setEditingRoles] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamStatusFilter, setTeamStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isInactive = project?.status === "INATIVO";
  const activeTeamCount = team.filter((member) => !member.dataSaida).length;

  const activeCollaborators = useMemo(() => {
    const activeMemberIds = new Set(
      team.filter((member) => !member.dataSaida).map((member) => Number(member.colaboradorId))
    );

    return collaborators.filter((collaborator) => !activeMemberIds.has(Number(collaborator.id)));
  }, [collaborators, team]);

  const filteredTeam = useMemo(() => {
    if (teamStatusFilter === "ATIVO") {
      return team.filter((member) => !member.dataSaida);
    }

    if (teamStatusFilter === "INATIVO") {
      return team.filter((member) => member.dataSaida);
    }

    return team;
  }, [team, teamStatusFilter]);

  const loadTeam = useCallback(async () => {
    if (!project?.id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [teamResponse, collaboratorsResponse, rolesResponse] = await Promise.all([
        api.get(`/projetos/${project.id}/equipe`),
        api.get("/colaboradores", { params: { status: "ATIVO" } }),
        api.get("/projetos/papeis")
      ]);

      setTeam(teamResponse.data);
      setCollaborators(collaboratorsResponse.data);
      setRoles(rolesResponse.data);
      setEditingRoles(
        Object.fromEntries(teamResponse.data.map((member) => [member.id, member.papel]))
      );

    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível carregar a equipe do projeto.");
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    setTeam([]);
    setMessage("");
    setError("");
    setTeamStatusFilter("");
    setFormData({
      colaboradorId: "",
      papel: "",
      dataEntrada: today()
    });
    loadTeam();
  }, [loadTeam]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isInactive) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api.post(`/projetos/${project.id}/equipe`, formData);
      setMessage("Colaborador vinculado ao projeto.");
      setFormData({
        colaboradorId: "",
        papel: "",
        dataEntrada: today()
      });
      await loadTeam();
      await onChanged?.();
    } catch (requestError) {
      const response = requestError.response?.data;
      const validationMessage = response?.errors?.[0]?.message;
      setError(validationMessage || response?.message || "Não foi possível vincular o colaborador.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(member) {
    if (isInactive) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api.put(`/projetos/${project.id}/equipe/${member.id}`, {
        papel: editingRoles[member.id]
      });
      setMessage("Papel atualizado.");
      await loadTeam();
      await onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível atualizar o papel.");
    }
  }

  async function closeParticipation(member) {
    if (isInactive) {
      return;
    }

    if (!window.confirm(`Encerrar participação de ${memberName(member)} neste projeto?`)) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api.delete(`/projetos/${project.id}/equipe/${member.id}`);
      setMessage("Participação encerrada e histórico preservado.");
      await loadTeam();
      await onChanged?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível encerrar a participação.");
    }
  }

  return (
    <section className="team-panel">
      <header className="team-header">
        <div>
          <span className="eyebrow">Equipe vinculada</span>
          <h2>{project.nome}</h2>
        </div>
        <div className="team-header-actions">
          <span className="team-count">
            <UsersRound size={17} />
            {activeTeamCount} ativo{activeTeamCount === 1 ? "" : "s"}
          </span>
          <button className="icon-button" type="button" onClick={onClose} title="Fechar equipe">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="feedback-row">
        {isInactive ? (
          <div className="feedback warning">
            <AlertTriangle size={18} />
            Projeto inativo: a equipe fica disponível para consulta, mas bloqueada para alterações.
          </div>
        ) : null}
        {message ? (
          <div className="feedback success">
            <Check size={18} />
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="feedback error">
            <X size={18} />
            {error}
          </div>
        ) : null}
      </div>

      <form className="team-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Colaborador</span>
          <select
            value={formData.colaboradorId}
            required
            disabled={isInactive || loading}
            onChange={(event) =>
              setFormData((current) => ({ ...current, colaboradorId: event.target.value }))
            }
          >
            <option value="">Selecione</option>
            {activeCollaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.nomeCompleto}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Papel no projeto</span>
          <select
            value={formData.papel}
            required
            disabled={isInactive || loading}
            onChange={(event) => setFormData((current) => ({ ...current, papel: event.target.value }))}
          >
            <option value="">Selecione</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Data de entrada</span>
          <input
            type="date"
            value={formData.dataEntrada}
            required
            disabled={isInactive || loading}
            onChange={(event) =>
              setFormData((current) => ({ ...current, dataEntrada: event.target.value }))
            }
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={isInactive || saving || loading || activeCollaborators.length === 0}
          title="Vincular"
        >
          <Link2 size={18} />
          Vincular
        </button>
      </form>

      <div className="team-table-toolbar">
        <select
          value={teamStatusFilter}
          onChange={(event) => setTeamStatusFilter(event.target.value)}
          title="Filtrar equipe por status"
        >
          <option value="">Todos os vínculos</option>
          <option value="ATIVO">Ativos</option>
          <option value="INATIVO">Inativos</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Cargo/Função</th>
              <th>Papel no projeto</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeam.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan="7">
                  {loading ? "Carregando equipe" : "Nenhum colaborador encontrado"}
                </td>
              </tr>
            ) : (
              filteredTeam.map((member) => (
                <tr key={member.id}>
                  <td>{memberName(member)}</td>
                  <td>{member.colaborador?.cargo || "-"}</td>
                  <td>
                    {member.dataSaida ? (
                      member.papel
                    ) : (
                      <select
                        value={editingRoles[member.id] || member.papel}
                        disabled={isInactive}
                        onChange={(event) =>
                          setEditingRoles((current) => ({
                            ...current,
                            [member.id]: event.target.value
                          }))
                        }
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>{formatDate(member.dataEntrada)}</td>
                  <td>{formatDate(member.dataSaida)}</td>
                  <td>
                    <StatusBadge status={member.dataSaida ? "INATIVO" : "ATIVO"} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {!member.dataSaida && !isInactive ? (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => updateRole(member)}
                            title="Salvar papel"
                          >
                            <Save size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => closeParticipation(member)}
                            title="Encerrar participação"
                          >
                            <UserMinus size={17} />
                          </button>
                        </>
                      ) : (
                        "-"
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
