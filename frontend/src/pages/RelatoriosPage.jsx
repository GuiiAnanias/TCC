import React, { useState, useEffect, useRef } from "react";
import { Download, Play, X, TriangleAlert, CircleCheck, Search, Edit3, Check } from "lucide-react";
import { api } from "../api/client.js";
import { FloatingActions } from "../components/FloatingActions.jsx";
import { HelpDialog } from "../components/HelpDialog.jsx";
import { number } from "../components/OperationalDashboard.jsx";
import { mensagemDeErro } from "../utils/download.js";

function AjudaRelatorios() {
  return (
    <HelpDialog title="Ajuda — Relatórios e Prévia">
      <section>
        <h3>Como funciona</h3>
        <p>
          Utilize a barra de pesquisa unificada para filtrar por <strong>Projeto</strong> ou{" "}
          <strong>Cliente</strong>. Após gerar a prévia, clique em <strong>Editar Prévia</strong>{" "}
          para selecionar exatamente quais itens deseja manter ou remover.
        </p>
      </section>
    </HelpDialog>
  );
}

export function RelatoriosPage() {
  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    projetoId: "",
    clienteId: "",
  });

  const [listaProjetos, setListaProjetos] = useState([]);
  const [listaClientes, setListaClientes] = useState([]);

  const [termoBusca, setTermoBusca] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const [blocos, setBlocos] = useState({
    projetos: true,
    clientes: true,
    horas: true,
    custos: true,
    ocorrencias: true,
  });

  // Dados originais retornados pela API e dados customizados pelo usuário no modal
  const [previaOriginal, setPreviaOriginal] = useState(null);
  const [previaEditada, setPreviaEditada] = useState(null);

  // Controle do Modal de Edição da Prévia
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [selecaoModal, setSelecaoModal] = useState({
    projetosIds: [],
    clientesNomes: [],
    ocorrenciasIndices: [],
  });

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [erro, setErro] = useState("");

  const containerRef = useRef(null);

  useEffect(() => {
    async function carregarDados() {
      try {
        const [resProjetos, resClientes] = await Promise.all([
          api.get("/projetos"),
          api.get("/clientes"),
        ]);
        setListaProjetos(resProjetos.data.dados || resProjetos.data || []);
        setListaClientes(resClientes.data.dados || resClientes.data || []);
      } catch {
        // Silencia erros na listagem inicial
      }
    }
    carregarDados();
  }, []);

  function toggleBloco(chave) {
    setBlocos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  function selecionarItem(item) {
    setTermoBusca(item.nome);
    setMostrarSugestoes(false);

    if (item.tipo === "projeto") {
      const clienteNome = typeof item.cliente === "string" ? item.cliente : item.cliente?.nome;
      const clienteObj = listaClientes.find((c) => c.nome === clienteNome);

      setFiltros((prev) => ({
        ...prev,
        projetoId: item.id,
        clienteId: clienteObj ? clienteObj.id : "",
      }));
    } else {
      setFiltros((prev) => ({
        ...prev,
        clienteId: item.id,
        projetoId: "",
      }));
    }
  }

  function limparBusca() {
    setTermoBusca("");
    setFiltros((prev) => ({ ...prev, projetoId: "", clienteId: "" }));
  }

  async function gerarPrevia(e) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    setMensagemSucesso("");
    try {
      const params = {};
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;
      if (filtros.projetoId) params.projetoIds = [filtros.projetoId];
      if (filtros.clienteId) params.clienteId = filtros.clienteId;

      const response = await api.get("/relatorios/previa", { params });
      const dados = response.data;

      setPreviaOriginal(dados);
      setPreviaEditada(dados);

      // Inicializa o modal marcando todos por padrão
      setSelecaoModal({
        projetosIds: dados.projetos ? dados.projetos.map((p) => p.id || p.nome) : [],
        clientesNomes: dados.clientes ? dados.clientes.map((c) => c.nome) : [],
        ocorrenciasIndices: dados.ocorrencias ? dados.ocorrencias.map((_, idx) => idx) : [],
      });
    } catch (err) {
      setErro(await mensagemDeErro(err, "Não foi possível carregar a prévia do relatório."));
    } finally {
      setCarregando(false);
    }
  }

  // Abre o modal de refinamento
  function abrirModalEdicao() {
    setModalEdicaoAberto(true);
  }

  // Salva as alterações feitas no modal e recalcula os totais da prévia exibida
  function salvarEdicaoModal() {
    if (!previaOriginal) return;

    const projetosFiltrados = (previaOriginal.projetos || []).filter((p) =>
      selecaoModal.projetosIds.includes(p.id || p.nome),
    );

    const clientesFiltrados = (previaOriginal.clientes || []).filter((c) =>
      selecaoModal.clientesNomes.includes(c.nome),
    );

    const ocorrenciasFiltradas = (previaOriginal.ocorrencias || []).filter((_, idx) =>
      selecaoModal.ocorrenciasIndices.includes(idx),
    );

    // Recalcula horas e custos com base nos projetos mantidos
    const totalHoras = projetosFiltrados.reduce((acc, p) => acc + (Number(p.horas) || 0), 0);
    const totalCusto = projetosFiltrados.reduce((acc, p) => acc + (Number(p.custo) || 0), 0);

    setPreviaEditada({
      ...previaOriginal,
      resumo: { horas: totalHoras, custo: totalCusto },
      projetos: projetosFiltrados,
      clientes: clientesFiltrados,
      ocorrencias: ocorrenciasFiltradas,
    });

    setModalEdicaoAberto(false);
    setMensagemSucesso("Prévia personalizada com sucesso!");
  }

  async function salvarFotografiaSnapshot() {
    setSalvando(true);
    setErro("");
    try {
      const params = {};
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;
      if (filtros.projetoId) params.projetoIds = [filtros.projetoId];
      if (filtros.clienteId) params.clienteId = filtros.clienteId;

      await api.post("/relatorios/fotografia", { filtros: params });
      setMensagemSucesso("Fotografia (snapshot) do relatório salva com sucesso no histórico!");
    } catch (err) {
      setErro(await mensagemDeErro(err, "Não foi possível salvar a fotografia do relatório."));
    } finally {
      setSalvando(false);
    }
  }

  function limparTudo() {
    setFiltros({ dataInicio: "", dataFim: "", projetoId: "", clienteId: "" });
    setTermoBusca("");
    setPreviaOriginal(null);
    setPreviaEditada(null);
    setErro("");
    setMensagemSucesso("");
  }

  const itensUnificados = [
    ...listaProjetos.map((p) => ({ ...p, tipo: "projeto", rotuloTipo: "Projeto" })),
    ...listaClientes.map((c) => ({ ...c, tipo: "cliente", rotuloTipo: "Cliente" })),
  ];

  const sugestoesFiltradas = itensUnificados.filter((item) =>
    item.nome.toLowerCase().includes(termoBusca.toLowerCase()),
  );

  return (
    <section className="content-panel relatorios-page" ref={containerRef}>
      <header className="page-header">
        <div>
          <span className="eyebrow">Relatórios</span>
          <div className="dashboard-title-row">
            <h1>Gerar Relatório</h1>
            <AjudaRelatorios />
          </div>
        </div>
        <FloatingActions onRefresh={limparTudo} loading={carregando || salvando} />
      </header>

      <form onSubmit={gerarPrevia} className="form-panel">
        <h2>Filtros e Escopo do Relatório</h2>

        <div className="form-grid" style={{ marginBottom: "1.5rem" }}>
          <label>
            <span>Data Início</span>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
            />
          </label>

          <label>
            <span>Data Fim</span>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
            />
          </label>
        </div>

        <div style={{ marginBottom: "1.5rem", position: "relative" }}>
          <label style={{ display: "block", marginBottom: "0.4rem" }}>
            <span>Pesquisar por Projeto ou Cliente</span>
          </label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Digite o nome do projeto ou cliente…"
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value);
                setMostrarSugestoes(true);
                if (!e.target.value) limparBusca();
              }}
              onFocus={() => setMostrarSugestoes(true)}
              style={{ width: "100%", paddingRight: "2.5rem" }}
            />
            {termoBusca ? (
              <button
                type="button"
                onClick={limparBusca}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={16} />
              </button>
            ) : (
              <Search
                size={16}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {mostrarSugestoes && termoBusca && sugestoesFiltradas.length > 0 && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-panel, #1e293b)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                maxHeight: "220px",
                overflowY: "auto",
                zIndex: 10,
                listStyle: "none",
                padding: "0.5rem 0",
                marginTop: "0.25rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              {sugestoesFiltradas.map((item) => (
                <li
                  key={`${item.tipo}-${item.id}`}
                  onClick={() => selecionarItem(item)}
                  style={{
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div>
                    <strong>{item.nome}</strong>
                    {item.tipo === "projeto" && (
                      <span
                        style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)" }}
                      >
                        Cliente: {item.cliente?.nome || item.cliente || "Sem vínculo"}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      backgroundColor:
                        item.tipo === "projeto"
                          ? "rgba(59, 130, 246, 0.2)"
                          : "rgba(16, 185, 129, 0.2)",
                      color: item.tipo === "projeto" ? "#60a5fa" : "#34d399",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.rotuloTipo}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <h3>Blocos Selecionáveis</h3>
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            flexWrap: "wrap",
            margin: "1rem 0",
            alignItems: "center",
          }}
        >
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={blocos.projetos}
              onChange={() => toggleBloco("projetos")}
              style={{ width: "18px", height: "18px" }}
            />
            Projetos
          </label>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={blocos.clientes}
              onChange={() => toggleBloco("clientes")}
              style={{ width: "18px", height: "18px" }}
            />
            Clientes
          </label>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={blocos.horas}
              onChange={() => toggleBloco("horas")}
              style={{ width: "18px", height: "18px" }}
            />
            Horas Totais
          </label>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={blocos.custos}
              onChange={() => toggleBloco("custos")}
              style={{ width: "18px", height: "18px" }}
            />
            Custo Total
          </label>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={blocos.ocorrencias}
              onChange={() => toggleBloco("ocorrencias")}
              style={{ width: "18px", height: "18px" }}
            />
            Inconsistências / Ocorrências
          </label>
        </div>

        <div
          className="import-actions"
          style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}
        >
          <button type="submit" className="primary-button" disabled={carregando}>
            <Play size={16} aria-hidden="true" />
            {carregando ? "Gerando prévia…" : "Gerar prévia"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={limparTudo}
            disabled={carregando}
          >
            <X size={16} aria-hidden="true" />
            Limpar / Cancelar
          </button>
        </div>
      </form>

      {erro && (
        <div className="feedback error" role="alert" style={{ marginTop: "1rem" }}>
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{erro}</span>
        </div>
      )}

      {mensagemSucesso && (
        <div className="feedback success" role="status" style={{ marginTop: "1rem" }}>
          <CircleCheck size={18} aria-hidden="true" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {previaEditada && (
        <section
          className="import-result"
          aria-label="Prévia do Relatório"
          style={{ marginTop: "2rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <h2>Prévia dos Resultados</h2>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" className="secondary-button" onClick={abrirModalEdicao}>
                <Edit3 size={16} aria-hidden="true" />
                Editar Prévia
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={salvarFotografiaSnapshot}
                disabled={salvando}
              >
                <Download size={16} aria-hidden="true" />
                {salvando ? "Salvando fotografia…" : "Salvar fotografia (Snapshot)"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "2rem",
            }}
          >
            {blocos.horas && previaEditada.resumo && (
              <div
                className="form-panel"
                style={{
                  padding: "1.2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span className="eyebrow">Horas Totais</span>
                <strong style={{ fontSize: "1.6rem" }}>
                  {number(previaEditada.resumo.horas)} h
                </strong>
              </div>
            )}
            {blocos.custos && previaEditada.resumo && (
              <div
                className="form-panel"
                style={{
                  padding: "1.2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <span className="eyebrow">Custo Total</span>
                <strong style={{ fontSize: "1.6rem" }}>
                  R$ {number(previaEditada.resumo.custo)}
                </strong>
              </div>
            )}
          </div>

          {blocos.projetos && previaEditada.projetos && previaEditada.projetos.length > 0 && (
            <div className="table-panel" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>
                Projetos no Recorte ({previaEditada.projetos.length})
              </h3>
              <div className="table-wrap">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>Projeto</th>
                      <th>Cliente</th>
                      <th>Status</th>
                      <th>Horas</th>
                      <th>Custo (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previaEditada.projetos.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.nome}</td>
                        <td>{p.cliente}</td>
                        <td>{p.status}</td>
                        <td>{number(p.horas)}</td>
                        <td>R$ {number(p.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {blocos.clientes && previaEditada.clientes && previaEditada.clientes.length > 0 && (
            <div className="table-panel" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>
                Clientes Atendidos ({previaEditada.clientes.length})
              </h3>
              <div className="table-wrap">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Projetos</th>
                      <th>Horas</th>
                      <th>Custo (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previaEditada.clientes.map((c, idx) => (
                      <tr key={idx}>
                        <td>{c.nome}</td>
                        <td>{number(c.projetos)}</td>
                        <td>{number(c.horas)}</td>
                        <td>R$ {number(c.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {blocos.ocorrencias &&
            previaEditada.ocorrencias &&
            previaEditada.ocorrencias.length > 0 && (
              <div className="table-panel" style={{ padding: "1.5rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>
                  Inconsistências Encontradas ({previaEditada.ocorrencias.length})
                </h3>
                <div className="table-wrap">
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Projeto</th>
                        <th>Colaborador</th>
                        <th>Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previaEditada.ocorrencias.map((o, idx) => (
                        <tr key={idx}>
                          <td>{o.tipo}</td>
                          <td>{o.projeto}</td>
                          <td>{o.colaborador ?? "—"}</td>
                          <td>{o.descricao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </section>
      )}

      {/* Modal de Edição da Prévia (Prévia da Prévia) */}
      {modalEdicaoAberto && previaOriginal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            className="form-panel"
            style={{
              width: "100%",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "var(--bg-panel, #1e293b)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2>Editar Elementos da Prévia</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModalEdicaoAberto(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-main)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
              Selecione quais itens devem permanecer no relatório final. Desmarque aqueles que
              deseja ocultar.
            </p>

            {/* Seção de Projetos no Modal */}
            {previaOriginal.projetos && previaOriginal.projetos.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "1rem",
                    marginBottom: "0.75rem",
                    borderBottom: "1px solid var(--border-color)",
                    paddingBottom: "0.4rem",
                  }}
                >
                  Projetos
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {previaOriginal.projetos.map((p) => {
                    const idProj = p.id || p.nome;
                    const selecionado = selecaoModal.projetosIds.includes(idProj);
                    return (
                      <label
                        key={idProj}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => {
                            setSelecaoModal((prev) => ({
                              ...prev,
                              projetosIds: selecionado
                                ? prev.projetosIds.filter((id) => id !== idProj)
                                : [...prev.projetosIds, idProj],
                            }));
                          }}
                          style={{ width: "16px", height: "16px" }}
                        />
                        <span>
                          {p.nome} —{" "}
                          <strong style={{ color: "var(--text-muted)" }}>{p.cliente}</strong>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seção de Clientes no Modal */}
            {previaOriginal.clientes && previaOriginal.clientes.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "1rem",
                    marginBottom: "0.75rem",
                    borderBottom: "1px solid var(--border-color)",
                    paddingBottom: "0.4rem",
                  }}
                >
                  Clientes
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {previaOriginal.clientes.map((c) => {
                    const selecionado = selecaoModal.clientesNomes.includes(c.nome);
                    return (
                      <label
                        key={c.nome}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => {
                            setSelecaoModal((prev) => ({
                              ...prev,
                              clientesNomes: selecionado
                                ? prev.clientesNomes.filter((nome) => nome !== c.nome)
                                : [...prev.clientesNomes, c.nome],
                            }));
                          }}
                          style={{ width: "16px", height: "16px" }}
                        />
                        <span>{c.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ações do Modal */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
                marginTop: "2rem",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalEdicaoAberto(false)}
              >
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={salvarEdicaoModal}>
                <Check size={16} aria-hidden="true" />
                Salvar e Atualizar Prévia
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
