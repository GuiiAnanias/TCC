import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client.js";

const labels = {
  equipe: "Participações na equipe (incluindo encerradas)",
  tarefas: "Tarefas (incluindo arquivadas)",
  sprints: "Sprints (incluindo arquivadas)",
  apontamentos: "Apontamentos de horas",
  avaliacoes: "Referências em avaliações de premiação",
  relatorios: "Relatórios gerados",
};

export function ProjectDeletionDialog({ project, onClose, onDeleted }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setInfo(null);
    setError("");
    api
      .get(`/projetos/${project.id}/exclusao`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setInfo(data);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(
            requestError.response?.data?.message ||
              "Não foi possível conferir os vínculos do projeto.",
          );
      });
    return () => controller.abort();
  }, [project.id, attempt]);

  async function confirm() {
    if (saving || !info?.podeExcluir) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/projetos/${project.id}/permanente`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Não foi possível excluir o projeto.");
      if (requestError.response?.status === 409) setInfo(null);
      setSaving(false);
      return;
    }
    if (dialog.current?.open) onDeleted(project);
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="dashboard-help-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <header className="dashboard-help-header">
        <h2 id={titleId}>Excluir projeto definitivamente</h2>
      </header>
      <div className="dashboard-help-content">
        <p>
          Projeto: <strong>{project.nome}</strong>
        </p>
        <p>
          A exclusão é permanente e não pode ser desfeita. Só é permitida para um cadastro sem
          vínculos nem histórico.
        </p>
        {!info && !error && <p role="status">Conferindo vínculos e histórico…</p>}
        {info && (
          <>
            <dl>
              {Object.entries(labels).map(([key, label]) => (
                <React.Fragment key={key}>
                  <dt>{label}</dt>
                  <dd>{info.vinculos[key]}</dd>
                </React.Fragment>
              ))}
            </dl>
            <p>
              {info.podeExcluir
                ? "Nenhum vínculo encontrado. Confirma a exclusão deste cadastro?"
                : "Este projeto possui vínculos ou histórico. Preserve o cadastro e use a alteração de estado."}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="feedback error">
            {error}
          </p>
        )}
        <div className="actions-row">
          <button
            type="button"
            className="secondary-button"
            disabled={saving}
            onClick={onClose}
            autoFocus
          >
            Cancelar
          </button>
          {error && (
            <button
              type="button"
              className="secondary-button"
              disabled={saving}
              onClick={() => setAttempt((value) => value + 1)}
            >
              Conferir novamente
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={saving || !info?.podeExcluir}
            onClick={confirm}
          >
            {saving ? "Excluindo…" : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
