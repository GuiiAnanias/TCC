/**
 * [COMPONENTE] Personalizar relatório: monta uma nova prévia com outros blocos ou projetos (só é
 * gravada ao salvar). [VALIDACAO]
 * Exige ao menos um bloco e um projeto ou cliente.
 */

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BLOCOS } from "../../config/blocosRelatorio.js";

export function DialogoPersonalizacaoRelatorio({ relatorio, onClose, onApply }) {
  const dialog = useRef(null);
  const titleId = useId();
  const projetos = relatorio.conteudo.projetos;
  const [selecionados, setSelecionados] = useState(projetos.map((p) => p.id));
  const [blocos, setBlocos] = useState(relatorio.conteudo.blocos);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Fotografias antigas não têm clienteId. Nelas cada projeto permanece independente.
  const clientes = new Map();
  for (const projeto of projetos) {
    const key = projeto.clienteId ?? `projeto:${projeto.id}`;
    if (!clientes.has(key)) clientes.set(key, { nome: projeto.cliente, ids: [] });
    clientes.get(key).ids.push(projeto.id);
  }

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function alternarProjetos(ids, marcar) {
    setSelecionados((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (marcar) next.add(id);
        else next.delete(id);
      }
      return projetos.map((p) => p.id).filter((id) => next.has(id));
    });
    setErro("");
  }

  async function aplicar(event) {
    event.preventDefault();
    if (salvando) return;
    if (!blocos.length) {
      setErro("Selecione ao menos um bloco de dados para o relatório.");
      return;
    }
    if (!selecionados.length) {
      setErro("Selecione ao menos um projeto ou cliente.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await onApply({
        projetoIds: selecionados.map(String),
        clienteIds: [],
        dataInicio: relatorio.conteudo.filtros.dataInicio ?? "",
        dataFim: relatorio.conteudo.filtros.dataFim ?? "",
        blocos,
      });
    } catch (error) {
      setErro(
        error.response?.data?.errors?.[0]?.message ||
          error.response?.data?.message ||
          "Não foi possível personalizar o relatório. Tente novamente.",
      );
      setSalvando(false);
    }
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="dashboard-help-dialog report-customization"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!salvando) onClose();
      }}
    >
      <header className="dashboard-help-header">
        <h2 id={titleId}>Personalizar relatório</h2>
        <button type="button" className="secondary-button" disabled={salvando} onClick={onClose}>
          Fechar
        </button>
      </header>
      <form className="dashboard-help-content" onSubmit={aplicar}>
        <p>
          Escolha os projetos e os blocos da nova prévia. Ao aplicar, os dados atuais serão
          consultados e a prévia aparece para conferência; ela só entra no histórico quando você
          clicar em Salvar no histórico. O relatório nº {relatorio.id} permanece preservado.
        </p>
        <fieldset disabled={salvando} className="report-customization-fields">
          <legend>Clientes e projetos do recorte</legend>
          <p>
            Marcar um cliente seleciona todos os projetos dele neste relatório. Horas, custos e
            inconsistências acompanham os projetos escolhidos.
          </p>
          {[...clientes.entries()].map(([key, cliente]) => (
            <section className="report-client-group" key={key}>
              <label className="tasks-check">
                <input
                  type="checkbox"
                  aria-label={`Cliente: ${cliente.nome}`}
                  checked={cliente.ids.every((id) => selecionados.includes(id))}
                  ref={(element) => {
                    if (element)
                      element.indeterminate =
                        cliente.ids.some((id) => selecionados.includes(id)) &&
                        !cliente.ids.every((id) => selecionados.includes(id));
                  }}
                  onChange={(event) => alternarProjetos(cliente.ids, event.target.checked)}
                />
                <strong>
                  {cliente.nome} · {cliente.ids.length} projeto(s)
                </strong>
              </label>
              {projetos
                .filter((p) => cliente.ids.includes(p.id))
                .map((projeto) => (
                  <label className="tasks-check report-project-choice" key={projeto.id}>
                    <input
                      type="checkbox"
                      aria-label={`Projeto: ${projeto.nome}`}
                      checked={selecionados.includes(projeto.id)}
                      onChange={(event) => alternarProjetos([projeto.id], event.target.checked)}
                    />
                    <span>{projeto.nome}</span>
                  </label>
                ))}
            </section>
          ))}
        </fieldset>
        <fieldset className="report-blocks" disabled={salvando}>
          <legend>Blocos da nova prévia</legend>
          <div>
            {BLOCOS.map((bloco) => (
              <label className="tasks-check report-block" key={bloco.key}>
                <input
                  type="checkbox"
                  checked={blocos.includes(bloco.key)}
                  onChange={() => {
                    setBlocos((current) =>
                      BLOCOS.map((b) => b.key).filter((key) =>
                        key === bloco.key ? !current.includes(key) : current.includes(key),
                      ),
                    );
                    setErro("");
                  }}
                />
                <span>
                  <strong>{bloco.label}</strong>
                  <small>{bloco.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p role="status">
          {selecionados.length} de {projetos.length} projeto(s) selecionado(s).
        </p>
        {erro && (
          <p className="feedback error" role="alert">
            {erro}
          </p>
        )}
        <div className="report-customization-actions">
          <button type="button" className="secondary-button" disabled={salvando} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={salvando}>
            {salvando ? "Gerando…" : "Gerar nova prévia"}
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
