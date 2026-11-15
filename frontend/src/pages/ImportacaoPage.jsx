/**
 * [TELA] Importar horas (/importacao): baixar o modelo, escolher o .xlsx, conferir as linhas (sem
 * gravar) e importar. Mensagens: "Importação realizada com sucesso" ou "Falha ao importar arquivo".
 * Embaixo, o Histórico de Importações.
 */

import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileUp,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { api } from "../api/conexao.js";
import { AcoesPagina } from "../components/comum/AcoesPagina.jsx";
import { DialogoAjuda } from "../components/comum/DialogoAjuda.jsx";
import { PaginacaoTabela, usePaginacao } from "../components/comum/PaginacaoTabela.jsx";
import { HistoricoImportacoes } from "../components/importacao/HistoricoImportacoes.jsx";
import { date, number } from "../components/dashboard/DashboardOperacional.jsx";
import { mensagemDeErro, salvarArquivo } from "../utils/baixarArquivos.js";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const PREVIA = 20;
const STATUS = { PENDENTE: "Pendente", APROVADO: "Aprovado", FATURADO: "Faturado" };
const plural = (quantidade, singular, varios) =>
  `${number(quantidade)} ${quantidade === 1 ? singular : varios}`;
const periodo = (intervalo) =>
  !intervalo
    ? "—"
    : intervalo.inicio === intervalo.fim
      ? date(intervalo.inicio)
      : `${date(intervalo.inicio)} a ${date(intervalo.fim)}`;

function AjudaImportacao() {
  return (
    <DialogoAjuda title="Ajuda — Importar horas">
      <section>
        <h3>Como funciona</h3>
        <p>
          Baixe o modelo, preencha uma linha por apontamento e envie o arquivo. O sistema confere
          todas as linhas antes de gravar e mostra o problema de cada uma, com o número da linha do
          Excel. Nada é gravado até você confirmar a importação.
        </p>
        <p>
          A importação é tudo ou nada: se uma linha tiver erro, nenhuma é gravada. Corrija no Excel,
          salve e escolha o arquivo de novo.
        </p>
      </section>
      <section>
        <h3>Regras</h3>
        <p>
          Valem as mesmas regras do cadastro manual: data até hoje, horas de 0,01 a 24 com até duas
          casas, no máximo 24 h por colaborador no dia (somando o que já está no sistema) e tarefa
          ativa do mesmo projeto. Linhas iguais a apontamentos já gravados são recusadas, para
          evitar importar a mesma planilha duas vezes.
        </p>
        <p>
          Avisos não impedem a importação. Eles indicam horas que entram com custo incompleto no
          dashboard: colaborador fora da equipe do projeto na data ou sem valor/hora vigente.
        </p>
      </section>
      <section>
        <h3>Histórico de Importações</h3>
        <p>
          Cada vez que você confirma uma importação, ela fica registrada no fim da tela com data,
          quem importou, arquivo, projetos e status. As que falharam também aparecem, com o motivo e
          as primeiras linhas com erro. Conferir a planilha sem importar não entra no histórico, e o
          arquivo em si não é guardado.
        </p>
      </section>
    </DialogoAjuda>
  );
}

function Resumo({ resumo }) {
  const itens = [
    ["Linhas lidas", number(resumo.linhas)],
    ["Prontas para importar", number(resumo.validas)],
    ["Com erro", number(resumo.comErro)],
    ["Horas a importar", `${number(resumo.horas)} h`],
    ["Período", periodo(resumo.periodo)],
  ];
  return (
    <dl className="import-stats">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// [TELA] Erros por linha do Excel.
function TabelaErros({ erros }) {
  const paginacao = usePaginacao(erros, PREVIA);
  return (
    <div className="table-panel">
      <div className="table-wrap">
        <table className="import-table">
          <thead>
            <tr>
              <th>Linha</th>
              <th>Coluna</th>
              <th>O que corrigir</th>
            </tr>
          </thead>
          <tbody>
            {paginacao.itensPaginados.map((erro, indice) => (
              <tr key={`${erro.linha}-${erro.campo}-${indice}`}>
                <td>{erro.linha}</td>
                <td>{erro.coluna}</td>
                <td className="import-message" title={erro.mensagem}>
                  <span className="cell-clamp">{erro.mensagem}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginacaoTabela
        pagina={paginacao.pagina}
        totalPaginas={paginacao.totalPaginas}
        totalItens={paginacao.totalItens}
        inicio={paginacao.inicio}
        fim={paginacao.fim}
        onPageChange={paginacao.setPagina}
        rotulo="Páginas de erros da planilha"
      />
    </div>
  );
}

// [TELA] Prévia das linhas reconhecidas, com os avisos de custo incompleto.
function TabelaPrevia({ linhas }) {
  const paginacao = usePaginacao(linhas, PREVIA);
  return (
    <div className="table-panel">
      <div className="table-wrap">
        <table className="import-table">
          <thead>
            <tr>
              <th>Linha</th>
              <th>Data</th>
              <th>Colaborador</th>
              <th>Projeto</th>
              <th>Tarefa</th>
              <th>Horas</th>
              <th>Status</th>
              <th>Avisos</th>
            </tr>
          </thead>
          <tbody>
            {paginacao.itensPaginados.map((linha) => {
              const textoAvisos = linha.avisos.join(" ");
              return (
                <tr key={linha.linha}>
                  <td>{linha.linha}</td>
                  <td>{date(linha.data)}</td>
                  <td title={linha.colaborador.nome}>{linha.colaborador.nome}</td>
                  <td title={linha.projeto.nome}>{linha.projeto.nome}</td>
                  <td title={linha.tarefa?.titulo ?? "Sem tarefa"}>
                    {linha.tarefa?.titulo ?? "Sem tarefa"}
                  </td>
                  <td>{number(linha.horas)}</td>
                  <td>{STATUS[linha.status]}</td>
                  <td className="import-message" title={textoAvisos || undefined}>
                    {linha.avisos.length ? (
                      <span className="import-warning">{textoAvisos}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginacaoTabela
        pagina={paginacao.pagina}
        totalPaginas={paginacao.totalPaginas}
        totalItens={paginacao.totalItens}
        inicio={paginacao.inicio}
        fim={paginacao.fim}
        onPageChange={paginacao.setPagina}
        rotulo="Páginas da prévia de importação"
      />
      {linhas.length > PREVIA && (
        <p className="import-footnote">
          Mostrando {paginacao.inicio}–{paginacao.fim} de {number(linhas.length)} apontamentos.
          Todos serão importados.
        </p>
      )}
    </div>
  );
}

// [TELA] Componente da tela.
export function ImportacaoPage() {
  const input = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [importado, setImportado] = useState(null);
  const [etapa, setEtapa] = useState("");
  const [error, setError] = useState("");
  // Muda a cada tentativa de importação (ou ao atualizar a tela) para recarregar o histórico.
  const [versaoHistorico, setVersaoHistorico] = useState(0);
  const ocupado = Boolean(etapa);

  function recomecar() {
    setArquivo(null);
    setResultado(null);
    setError("");
    if (input.current) input.current.value = "";
  }

  // [REQUISICAO] GET do modelo .xlsx.
  async function baixarModelo() {
    setEtapa("modelo");
    setError("");
    try {
      const response = await api.get("/importacoes/apontamentos/modelo", {
        responseType: "blob",
      });
      salvarArquivo(response, "modelo-importacao-apontamentos.xlsx");
    } catch (err) {
      setError(await mensagemDeErro(err, "Não foi possível baixar o modelo. Tente novamente."));
    } finally {
      setEtapa("");
    }
  }

  // [REQUISICAO][VALIDACAO] Envia o arquivo para conferência (POST .../validacao); nada é gravado.
  async function escolher(event) {
    const escolhido = event.target.files?.[0];
    event.target.value = "";
    if (!escolhido) return;
    setImportado(null);
    setResultado(null);
    setError("");
    if (!escolhido.name.toLowerCase().endsWith(".xlsx")) {
      setArquivo(null);
      setError("Escolha um arquivo do Excel com extensão .xlsx.");
      return;
    }
    if (escolhido.size > TAMANHO_MAXIMO) {
      setArquivo(null);
      setError("O arquivo passa de 5 MB. Divida os apontamentos em mais arquivos.");
      return;
    }
    setArquivo(escolhido);
    setEtapa("validando");
    try {
      const response = await api.post("/importacoes/apontamentos/validacao", escolhido, {
        headers: { "Content-Type": XLSX },
      });
      setResultado(response.data);
    } catch (err) {
      setError(await mensagemDeErro(err, "Não foi possível conferir a planilha."));
    } finally {
      setEtapa("");
    }
  }

  // [REQUISICAO] Importa (POST /importacoes/apontamentos) com o nome do arquivo no cabeçalho
  // X-Nome-Arquivo e atualiza o histórico.
  async function importar() {
    setEtapa("importando");
    setError("");
    try {
      const response = await api.post("/importacoes/apontamentos", arquivo, {
        // O nome vai codificado: cabeçalhos HTTP não aceitam acentos diretamente.
        headers: { "Content-Type": XLSX, "X-Nome-Arquivo": encodeURIComponent(arquivo.name) },
      });
      setImportado({ ...response.data, arquivo: arquivo.name });
      recomecar();
    } catch (err) {
      // 422: algo mudou desde a conferência (ex.: horas lançadas nesse meio-tempo).
      if (err.response?.status === 422 && err.response.data?.details)
        setResultado(err.response.data.details);
      setError(`Falha ao importar arquivo. ${await mensagemDeErro(err, "Tente novamente.")}`);
    } finally {
      setEtapa("");
      setVersaoHistorico((versao) => versao + 1);
    }
  }

  const resumo = resultado?.resumo;
  const validas = resultado?.linhas.filter((linha) => linha.valida) ?? [];

  return (
    <section className="content-panel import-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dados</span>
          <div className="dashboard-title-row">
            <h1>Importar horas do Excel</h1>
            <AjudaImportacao />
          </div>
        </div>
        <AcoesPagina
          onRefresh={() => {
            recomecar();
            setVersaoHistorico((versao) => versao + 1);
          }}
          loading={ocupado}
        />
      </header>

      <ol className="import-steps">
        <li className="form-panel">
          <span className="import-step-number">1</span>
          <div>
            <h2>Baixe o modelo</h2>
            <p>Traz um passo a passo e as listas do sistema, e marca em vermelho o que faltar.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={baixarModelo}
              disabled={ocupado}
            >
              <Download size={16} aria-hidden="true" />
              {etapa === "modelo" ? "Gerando modelo…" : "Baixar modelo"}
            </button>
          </div>
        </li>
        <li className="form-panel">
          <span className="import-step-number">2</span>
          <div>
            <h2>Preencha no Excel</h2>
            <p>
              Uma linha por apontamento: data, e-mail do colaborador, projeto, horas e descrição.
              Tarefa e status são opcionais.
            </p>
          </div>
        </li>
        <li className="form-panel">
          <span className="import-step-number">3</span>
          <div>
            <h2>Envie para conferir</h2>
            <p>O sistema confere todas as linhas. Nada é gravado até você confirmar.</p>
            <input
              ref={input}
              id="arquivo-importacao"
              className="visually-hidden"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={escolher}
              disabled={ocupado}
            />
            <label
              htmlFor="arquivo-importacao"
              className={`primary-button import-file-button${ocupado ? " is-disabled" : ""}`}
              aria-disabled={ocupado}
            >
              <Upload size={16} aria-hidden="true" />
              {etapa === "validando" ? "Conferindo…" : "Escolher arquivo .xlsx"}
            </label>
          </div>
        </li>
      </ol>

      {error && (
        <div className="feedback error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {importado && (
        <div className="feedback success" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <span>
            Importação realizada com sucesso:{" "}
            {plural(importado.importados, "apontamento importado", "apontamentos importados")} de{" "}
            {importado.arquivo}, {number(importado.horas)} h, {periodo(importado.periodo)}.{" "}
            <Link to="/dashboard">Ver no Dashboard</Link> ·{" "}
            <Link to="/apontamentos">Ver apontamentos</Link>
          </span>
        </div>
      )}

      {etapa === "validando" && (
        <p className="dashboard-scope" role="status">
          Conferindo {arquivo?.name}…
        </p>
      )}

      {resultado && !etapa && (
        <section className="import-result" aria-label="Resultado da conferência">
          <div className="import-file-name">
            <FileSpreadsheet size={18} aria-hidden="true" />
            <strong>{arquivo?.name ?? "Planilha enviada"}</strong>
            <span>aba {resultado.aba}</span>
          </div>
          <Resumo resumo={resumo} />

          {resumo.comErro > 0 ? (
            <>
              <div className="feedback error" role="alert">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>
                  {plural(resumo.comErro, "linha precisa", "linhas precisam")} de correção. Nenhum
                  apontamento foi gravado. Corrija no Excel, salve e escolha o arquivo de novo.
                </span>
              </div>
              <TabelaErros erros={resultado.erros} />
            </>
          ) : (
            <>
              <div className="feedback success" role="status">
                <CircleCheck size={18} aria-hidden="true" />
                <span>
                  Tudo certo: {plural(resumo.validas, "apontamento pronto", "apontamentos prontos")}{" "}
                  para importar.
                </span>
              </div>
              {resumo.comAviso > 0 && (
                <div className="feedback warning" role="status">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>
                    {plural(resumo.comAviso, "apontamento vai", "apontamentos vão")} entrar com
                    custo incompleto no dashboard. Veja a coluna Avisos.
                  </span>
                </div>
              )}
              <TabelaPrevia linhas={validas} />
            </>
          )}

          <div className="import-actions">
            {resumo.comErro === 0 && (
              <button type="button" className="primary-button" onClick={importar}>
                <FileUp size={16} aria-hidden="true" />
                Importar {plural(resumo.validas, "apontamento", "apontamentos")}
              </button>
            )}
            <button type="button" className="secondary-button" onClick={recomecar}>
              <X size={16} aria-hidden="true" />
              Cancelar
            </button>
          </div>
        </section>
      )}

      {etapa === "importando" && (
        <p className="dashboard-scope" role="status">
          Importando {plural(resumo?.validas ?? 0, "apontamento", "apontamentos")}…
        </p>
      )}

      <HistoricoImportacoes versao={versaoHistorico} />
    </section>
  );
}
