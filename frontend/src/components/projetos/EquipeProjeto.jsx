/**
 * [COMPONENTE] Equipe do projeto (ação Equipe na lista de projetos): vincular colaborador, trocar
 * papel a partir de uma data e encerrar participação.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Link2, Save, UserMinus, UsersRound, X } from "lucide-react";
import { api } from "../../api/conexao.js";
import { useValorMaisRecente, useEscopoRequisicao } from "../../hooks/useEscopoRequisicao.js";
import { DialogoAjuda } from "../comum/DialogoAjuda.jsx";
import { DialogoConfirmacao } from "../comum/DialogoConfirmacao.jsx";
import { PaginacaoTabela, usePaginacao } from "../comum/PaginacaoTabela.jsx";
import { EtiquetaStatus } from "../comum/EtiquetaStatus.jsx";
import { SelecaoComBusca } from "../comum/SelecaoComBusca.jsx";
import { contemBusca } from "../../utils/textoBusca.js";
import { todayBusinessDate as today } from "../../utils/datasEmpresa.js";
import { dataBr, situacaoNaEquipe } from "../../utils/pendencias.js";

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

// `pendencia` vem do Dashboard Geral ({ colaboradorId, data }): horas lançadas por alguém
// fora da equipe naquela data. A tela explica o ajuste e, se a pessoa nunca participou do
// projeto, já preenche o formulário com ela e a data.
export function EquipeProjeto({ project, onChanged, onClose, pendencia = null }) {
  const requestScope = useEscopoRequisicao(project?.id);
  const callbacks = useValorMaisRecente({ onChanged });
  const [loadError, setLoadError] = useState("");
  const [selectionErrors, setSelectionErrors] = useState({});
  const [team, setTeam] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    colaboradorId: "",
    papel: "",
    dataEntrada: today(),
  });
  const [editingRoles, setEditingRoles] = useState({});
  const [editingEntryDates, setEditingEntryDates] = useState({});
  const [roleEffectiveDate, setRoleEffectiveDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingMember, setClosingMember] = useState(null);
  const [teamStatusFilter, setTeamStatusFilter] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isInactive = project?.status !== "ATIVO";
  const activeTeamCount = team.filter((member) => !member.dataSaida).length;

  const activeCollaborators = useMemo(() => {
    const activeMemberIds = new Set(
      team.filter((member) => !member.dataSaida).map((member) => Number(member.colaboradorId)),
    );

    return collaborators.filter((collaborator) => !activeMemberIds.has(Number(collaborator.id)));
  }, [collaborators, team]);

  const preenchido = useRef("");
  const situacao =
    pendencia && !loading && !loadError
      ? situacaoNaEquipe(team, pendencia.colaboradorId, pendencia.data)
      : null;
  const nomePendencia =
    collaborators.find((person) => String(person.id) === String(pendencia?.colaboradorId))
      ?.nomeCompleto ||
    situacao?.participacoes[0]?.colaborador?.nomeCompleto ||
    "O colaborador";

  useEffect(() => {
    if (situacao?.situacao !== "sem-vinculo") return;
    const chave = `${project?.id}:${pendencia.colaboradorId}:${pendencia.data}`;
    if (preenchido.current === chave) return;
    if (!collaborators.some((person) => String(person.id) === String(pendencia.colaboradorId)))
      return;
    preenchido.current = chave;
    setFormData((current) => ({
      ...current,
      colaboradorId: String(pendencia.colaboradorId),
      dataEntrada: pendencia.data,
    }));
  }, [situacao?.situacao, pendencia, project?.id, collaborators]);

  const filteredTeam = useMemo(
    () =>
      team.filter(
        (member) =>
          (teamStatusFilter !== "ATIVO" || !member.dataSaida) &&
          (teamStatusFilter !== "INATIVO" || member.dataSaida) &&
          contemBusca(teamSearch, memberName(member), member.colaborador?.cargo, member.papel),
      ),
    [team, teamStatusFilter, teamSearch],
  );
  const paginacaoEquipe = usePaginacao(filteredTeam);

  // [REQUISICAO] GET /projetos/:id/equipe: participações atuais e passadas.
  const loadTeam = useCallback(async () => {
    if (!project?.id) {
      return;
    }

    const request = requestScope.begin("load");
    setLoadError("");
    setLoading(true);
    setError("");

    try {
      const [teamResponse, collaboratorsResponse, rolesResponse] = await Promise.all([
        api.get(`/projetos/${project.id}/equipe`, { signal: request.signal }),
        api.get("/colaboradores", { params: { status: "ATIVO" }, signal: request.signal }),
        api.get("/projetos/papeis", { signal: request.signal }),
      ]);

      if (!request.isCurrent()) return;
      setTeam(teamResponse.data);
      setCollaborators(collaboratorsResponse.data);
      setRoles(rolesResponse.data);
      setEditingRoles(
        Object.fromEntries(teamResponse.data.map((member) => [member.id, member.papel])),
      );
      setEditingEntryDates(
        Object.fromEntries(
          teamResponse.data.map((member) => [member.id, toInputDate(member.dataEntrada)]),
        ),
      );
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setTeam([]);
      setCollaborators([]);
      setRoles([]);
      setLoadError(
        requestError.response?.data?.message || "Não foi possível carregar a equipe do projeto.",
      );
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [project?.id, requestScope]);

  useEffect(() => {
    setTeam([]);
    setCollaborators([]);
    setRoles([]);
    setEditingRoles({});
    setEditingEntryDates({});
    setRoleEffectiveDate(today());
    setSelectionErrors({});
    setSaving(false);
    setClosingMember(null);
    setLoadError("");
    setMessage("");
    setError("");
    setTeamStatusFilter("");
    setFormData({
      colaboradorId: "",
      papel: "",
      dataEntrada: today(),
    });
    loadTeam();
  }, [loadTeam]);

  // [REQUISICAO] Vincula um colaborador (POST /projetos/:id/equipe). Erros da API aparecem no
  // formulário.
  async function handleSubmit(event) {
    event.preventDefault();

    if (isInactive || saving || loading || loadError) {
      return;
    }

    const missing = {};
    if (!activeCollaborators.some((person) => String(person.id) === String(formData.colaboradorId)))
      missing.colaboradorId = "Selecione um colaborador disponível.";
    if (!roles.includes(formData.papel)) missing.papel = "Selecione um papel no projeto.";
    setSelectionErrors(missing);
    if (Object.keys(missing).length) {
      document.getElementById(`team-${Object.keys(missing)[0]}`)?.focus();
      return;
    }
    const request = requestScope.begin("mutation");
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api.post(`/projetos/${project.id}/equipe`, formData);
      if (!request.isCurrent()) return;
      setMessage("Colaborador vinculado ao projeto.");
      setFormData({
        colaboradorId: "",
        papel: "",
        dataEntrada: today(),
      });
      await loadTeam();
      if (request.isCurrent()) await callbacks.current.onChanged?.();
    } catch (requestError) {
      if (!request.isCurrent()) return;
      const response = requestError.response?.data;
      const validationMessage = response?.errors?.[0]?.message;
      setError(
        validationMessage || response?.message || "Não foi possível vincular o colaborador.",
      );
    } finally {
      if (request.isCurrent()) setSaving(false);
    }
  }

  // [REQUISICAO] Troca de papel a partir de uma data (PUT /projetos/:id/equipe/:vinculoId).
  async function updateRole(member) {
    if (isInactive || saving || loading || loadError) {
      return;
    }

    if (!String(editingRoles[member.id] ?? "").trim()) {
      setSelectionErrors((current) => ({ ...current, [`role-${member.id}`]: true }));
      setError("Selecione o papel do vínculo antes de salvar.");
      document.getElementById(`team-role-${member.id}`)?.focus();
      return;
    }
    if (editingRoles[member.id] !== member.papel && !roleEffectiveDate) {
      setSelectionErrors((current) => ({ ...current, vigencia: true }));
      setError("Informe a vigência da troca de papel.");
      document.getElementById("team-role-date")?.focus();
      return;
    }
    const request = requestScope.begin("mutation");
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api.put(`/projetos/${project.id}/equipe/${member.id}`, {
        ...(editingRoles[member.id] !== member.papel
          ? { papel: editingRoles[member.id], dataVigencia: roleEffectiveDate }
          : { dataEntrada: editingEntryDates[member.id] }),
      });
      if (!request.isCurrent()) return;
      setMessage("Vínculo atualizado. Trocas de papel preservam o histórico.");
      await loadTeam();
      if (request.isCurrent()) await callbacks.current.onChanged?.();
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError.response?.data?.message || "Não foi possível atualizar o papel.");
    } finally {
      if (request.isCurrent()) setSaving(false);
    }
  }

  // [REQUISICAO] Encerra a participação hoje, após confirmação no modal (DELETE).
  function closeParticipation(member) {
    if (isInactive || saving || loading || loadError) return;
    setClosingMember(member);
  }

  async function confirmCloseParticipation() {
    const member = closingMember;
    if (!member || isInactive || saving || loading || loadError) return;
    setClosingMember(null);

    const request = requestScope.begin("mutation");
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await api.delete(`/projetos/${project.id}/equipe/${member.id}`);
      if (!request.isCurrent()) return;
      setMessage("Participação encerrada e histórico preservado.");
      await loadTeam();
      if (request.isCurrent()) await callbacks.current.onChanged?.();
    } catch (requestError) {
      if (!request.isCurrent()) return;
      setError(requestError.response?.data?.message || "Não foi possível encerrar a participação.");
    } finally {
      if (request.isCurrent()) setSaving(false);
    }
  }

  return (
    <section className="team-panel">
      <header className="team-header">
        <div>
          <span className="eyebrow">Equipe vinculada</span>
          <div className="dashboard-title-row">
            <h2>{project.nome}</h2>
            <DialogoAjuda title="Ajuda — Equipe do projeto">
              <section>
                <h3>Papel no projeto</h3>
                <p>
                  O papel descreve a atuação neste projeto e pode ter bonificação própria. Ele não
                  altera o cargo nem a faixa de remuneração do colaborador.
                </p>
              </section>
              <section>
                <h3>Participação e histórico</h3>
                <p>
                  Selecione o colaborador, o papel e a data de entrada para vincular à equipe. Para
                  trocar um papel, defina a data no campo Vigência ao alterar um papel e salve o
                  vínculo. A troca preserva o histórico anterior.
                </p>
                <p>
                  Encerrar participação mantém o vínculo no histórico. Use o filtro para consultar
                  vínculos ativos ou inativos.
                </p>
              </section>
            </DialogoAjuda>
          </div>
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
        {situacao && (
          <div
            className={`feedback ${situacao.situacao === "coberto" ? "success" : "warning"} pending-fix`}
            role="status"
          >
            <strong>Pendência do dashboard</strong>
            {situacao.situacao === "sem-vinculo" && (
              <span>
                {nomePendencia} lançou horas em {dataBr(pendencia.data)} neste projeto, mas não faz
                parte da equipe. O formulário abaixo já vem com {nomePendencia} e essa data: escolha
                o papel e clique em Vincular.
              </span>
            )}
            {situacao.situacao === "fora-do-periodo" && (
              <span>
                {nomePendencia} lançou horas em {dataBr(pendencia.data)}, fora do período em que
                participou do projeto (linha destacada na tabela). Ajuste a data de entrada para{" "}
                {dataBr(pendencia.data)} ou antes e clique em Salvar vínculo.
              </span>
            )}
            {situacao.situacao === "coberto" && (
              <span>
                Resolvido: {nomePendencia} já participa da equipe em {dataBr(pendencia.data)}.
                Atualize o Dashboard Geral para ver o custo completo.
              </span>
            )}
          </div>
        )}
        {loadError && (
          <div className="feedback error" role="alert">
            {loadError}
            <button type="button" onClick={loadTeam}>
              Tentar novamente
            </button>
          </div>
        )}
        {isInactive ? (
          <div className="feedback warning">
            <AlertTriangle size={18} />
            Reative o projeto para alterar a equipe. O histórico continua disponível para consulta.
          </div>
        ) : null}
        {message ? (
          <div className="feedback success">
            <Check size={18} />
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="feedback error" id="team-operation-error" role="alert">
            <X size={18} />
            {error}
          </div>
        ) : null}
      </div>

      <form className="team-form" onSubmit={handleSubmit}>
        <div className="field">
          <span>Colaborador</span>
          <SelecaoComBusca
            id="team-colaboradorId"
            name="colaboradorId"
            placeholder="Selecione"
            error={selectionErrors.colaboradorId}
            value={formData.colaboradorId}
            required
            disabled={isInactive || loading || saving || Boolean(loadError)}
            onChange={(event) => {
              setSelectionErrors((current) => ({ ...current, colaboradorId: "" }));
              setFormData((current) => ({ ...current, colaboradorId: event.target.value }));
            }}
            options={activeCollaborators.map((collaborator) => ({
              value: String(collaborator.id),
              label: collaborator.nomeCompleto,
            }))}
          />
          {selectionErrors.colaboradorId && (
            <small id="team-colaboradorId-error" role="alert">
              {selectionErrors.colaboradorId}
            </small>
          )}
        </div>

        <label className="field">
          <span>Papel no projeto</span>
          <select
            id="team-papel"
            aria-invalid={Boolean(selectionErrors.papel)}
            aria-describedby={selectionErrors.papel ? "team-papel-error" : undefined}
            value={formData.papel}
            required
            disabled={isInactive || loading || saving || Boolean(loadError)}
            onChange={(event) => {
              setSelectionErrors((current) => ({ ...current, papel: "" }));
              setFormData((current) => ({ ...current, papel: event.target.value }));
            }}
          >
            <option value="">Selecione</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {selectionErrors.papel && (
            <small id="team-papel-error" role="alert">
              {selectionErrors.papel}
            </small>
          )}
        </label>

        <label className="field">
          <span>Data de entrada</span>
          <input
            type="date"
            value={formData.dataEntrada}
            required
            disabled={isInactive || loading || saving || Boolean(loadError)}
            onChange={(event) =>
              setFormData((current) => ({ ...current, dataEntrada: event.target.value }))
            }
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={
            isInactive ||
            saving ||
            loading ||
            Boolean(loadError) ||
            activeCollaborators.length === 0
          }
          title="Vincular"
        >
          <Link2 size={18} />
          Vincular
        </button>
      </form>

      <div className="team-table-toolbar">
        <label className="field">
          <span>Vigência ao alterar um papel</span>
          <input
            type="date"
            required
            value={roleEffectiveDate}
            id="team-role-date"
            aria-invalid={Boolean(selectionErrors.vigencia)}
            aria-describedby={selectionErrors.vigencia ? "team-operation-error" : undefined}
            onChange={(event) => {
              setSelectionErrors((current) => ({ ...current, vigencia: false }));
              setRoleEffectiveDate(event.target.value);
            }}
            disabled={isInactive || loading || saving || Boolean(loadError)}
          />
        </label>
        <label className="field">
          <span>Buscar na equipe</span>
          <input
            value={teamSearch}
            onChange={(event) => {
              setTeamSearch(event.target.value);
              paginacaoEquipe.setPagina(1);
            }}
            placeholder="Nome, cargo ou papel"
          />
        </label>
        <label className="field">
          <span>Mostrar</span>
          <select
            value={teamStatusFilter}
            onChange={(event) => {
              setTeamStatusFilter(event.target.value);
              paginacaoEquipe.setPagina(1);
            }}
            title="Filtrar equipe por status"
          >
            <option value="">Todos os vínculos</option>
            <option value="ATIVO">Ativos</option>
            <option value="INATIVO">Inativos</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Cargo</th>
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
              paginacaoEquipe.itensPaginados.map((member) => (
                <tr
                  key={member.id}
                  className={
                    situacao?.situacao === "fora-do-periodo" &&
                    String(member.colaboradorId) === String(pendencia.colaboradorId)
                      ? "team-row-pending"
                      : undefined
                  }
                >
                  <td title={memberName(member)}>{memberName(member)}</td>
                  <td title={member.colaborador?.cargo || "-"}>
                    {member.colaborador?.cargo || "-"}
                  </td>
                  <td>
                    {member.dataSaida ? (
                      member.papel
                    ) : (
                      <select
                        id={`team-role-${member.id}`}
                        aria-invalid={Boolean(selectionErrors[`role-${member.id}`])}
                        aria-describedby={
                          selectionErrors[`role-${member.id}`] ? "team-operation-error" : undefined
                        }
                        value={editingRoles[member.id] ?? member.papel}
                        disabled={isInactive || loading || saving || Boolean(loadError)}
                        onChange={(event) => {
                          setSelectionErrors((current) => ({
                            ...current,
                            [`role-${member.id}`]: false,
                          }));
                          setEditingRoles((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }));
                        }}
                      >
                        {!roles.includes(member.papel) && (
                          <option value={member.papel}>{member.papel}</option>
                        )}
                        <option value="">Selecione o papel</option>
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {!member.dataSaida && !isInactive ? (
                      <input
                        type="date"
                        aria-label={`Entrada de ${memberName(member)}`}
                        value={editingEntryDates[member.id] || toInputDate(member.dataEntrada)}
                        onChange={(event) =>
                          setEditingEntryDates((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      formatDate(member.dataEntrada)
                    )}
                  </td>
                  <td>{formatDate(member.dataSaida)}</td>
                  <td>
                    <EtiquetaStatus status={member.dataSaida ? "INATIVO" : "ATIVO"} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {!member.dataSaida && !isInactive ? (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => updateRole(member)}
                            title="Salvar vínculo"
                            disabled={saving || loading || Boolean(loadError)}
                          >
                            <Save size={17} />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => closeParticipation(member)}
                            title="Encerrar participação"
                            disabled={saving || loading || Boolean(loadError)}
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
      <PaginacaoTabela
        pagina={paginacaoEquipe.pagina}
        totalPaginas={paginacaoEquipe.totalPaginas}
        totalItens={paginacaoEquipe.totalItens}
        inicio={paginacaoEquipe.inicio}
        fim={paginacaoEquipe.fim}
        onPageChange={paginacaoEquipe.setPagina}
        rotulo="Páginas da equipe do projeto"
      />
      {closingMember && (
        <DialogoConfirmacao
          title="Encerrar participação na equipe"
          description={`Encerrar a participação de ${memberName(closingMember)} neste projeto? O vínculo anterior e o histórico serão preservados.`}
          confirmLabel="Encerrar participação"
          danger
          busy={saving}
          onConfirm={confirmCloseParticipation}
          onCancel={() => setClosingMember(null)}
        />
      )}
    </section>
  );
}
