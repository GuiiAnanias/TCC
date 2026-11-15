/**
 * [COMPONENTE] Equipe inicial opcional no cadastro de projeto: escolha dos colaboradores com papel
 * e data de entrada.
 */

import React, { useEffect, useState } from "react";
import { api } from "../../api/conexao.js";
import { PaginacaoTabela, usePaginacao } from "../comum/PaginacaoTabela.jsx";

export function EquipeInicialProjeto({ members, onChange, projectStart, disabled }) {
  const [people, setPeople] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/colaboradores", { params: { status: "ATIVO" }, signal: controller.signal }),
      api.get("/projetos/papeis", { signal: controller.signal }),
    ])
      .then(([persons, projectRoles]) => {
        if (controller.signal.aborted) return;
        setPeople(persons.data);
        setRoles(projectRoles.data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Não foi possível carregar a equipe. Tente novamente ou cadastre o projeto sem integrantes.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  function toggle(person, checked) {
    onChange(
      checked
        ? [...members, { colaboradorId: person.id, papel: "", dataEntrada: projectStart || "" }]
        : members.filter((member) => member.colaboradorId !== person.id),
    );
  }
  function update(id, changes) {
    onChange(
      members.map((member) => (member.colaboradorId === id ? { ...member, ...changes } : member)),
    );
  }
  const visible = people.filter((person) =>
    `${person.nomeCompleto} ${person.email}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const paginacaoVisiveis = usePaginacao(visible);

  return (
    <fieldset className="initial-project-team" disabled={disabled}>
      <legend>Equipe inicial (opcional)</legend>
      <p>
        Selecione os integrantes e informe o papel e a entrada de cada um. Sem equipe válida, o
        projeto fica disponível para planejamento e consulta, mas não recebe novas horas.
      </p>
      {loading && <p role="status">Carregando colaboradores e papéis…</p>}
      {error && (
        <div role="alert" className="feedback error">
          {error}{" "}
          <button
            type="button"
            className="secondary-button"
            onClick={() => setAttempt((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      <details>
        <summary>Selecionar colaboradores ({members.length})</summary>
        <label className="field">
          <span>Buscar colaborador</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={loading || Boolean(error)}
          />
        </label>
        <div className="initial-team-choices">
          {paginacaoVisiveis.itensPaginados.map((person) => (
            <label key={person.id} className="initial-team-choice" title={`${person.nomeCompleto} (${person.email})`}>
              <input
                type="checkbox"
                checked={members.some((member) => member.colaboradorId === person.id)}
                onChange={(event) => toggle(person, event.target.checked)}
                disabled={loading || Boolean(error)}
              />
              <span>
                {person.nomeCompleto}
                <small>{person.email}</small>
              </span>
            </label>
          ))}
          {!loading && !error && !visible.length && <p>Nenhum colaborador ativo encontrado.</p>}
        </div>
        <PaginacaoTabela
          pagina={paginacaoVisiveis.pagina}
          totalPaginas={paginacaoVisiveis.totalPaginas}
          totalItens={paginacaoVisiveis.totalItens}
          inicio={paginacaoVisiveis.inicio}
          fim={paginacaoVisiveis.fim}
          onPageChange={paginacaoVisiveis.setPagina}
          rotulo="Páginas de colaboradores da equipe inicial"
        />
      </details>
      <div className="initial-team-members">
        {members.map((member) => {
          const name =
            people.find((person) => person.id === member.colaboradorId)?.nomeCompleto ||
            `Colaborador #${member.colaboradorId}`;
          return (
            <section className="initial-team-member" key={member.colaboradorId}>
              <strong>{name}</strong>
              <div className="form-grid">
                <label className="field">
                  <span>Papel de {name}</span>
                  <select
                    required
                    value={member.papel}
                    onChange={(event) =>
                      update(member.colaboradorId, { papel: event.target.value })
                    }
                  >
                    <option value="">Selecione…</option>
                    {roles.map((role) => (
                      <option value={role} key={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Entrada de {name}</span>
                  <input
                    type="date"
                    required
                    value={member.dataEntrada}
                    onChange={(event) =>
                      update(member.colaboradorId, { dataEntrada: event.target.value })
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  onChange(members.filter((row) => row.colaboradorId !== member.colaboradorId))
                }
                aria-label={`Remover ${name} da equipe inicial`}
              >
                Remover da seleção
              </button>
            </section>
          );
        })}
      </div>
    </fieldset>
  );
}
