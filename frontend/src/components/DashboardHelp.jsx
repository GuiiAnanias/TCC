/**
 * [COMPONENTE] Ajuda do dashboard: explica como cada indicador é calculado (fórmulas de custo e
 * assertividade).
 */

import React from "react";
import { HelpDialog } from "./HelpDialog.jsx";

export function DashboardHelp() {
  return (
    <HelpDialog title="Como os indicadores são calculados">
      <section>
        <h3>Custo e horas por projeto</h3>
        <p>
          O comparativo mostra custo de mão de obra, bonificação e horas por projeto. A tabela
          apresenta os valores exatos.
        </p>
        <p className="dashboard-help-formula">
          Custo por colaborador = horas × custo/hora × (1 + bonificação percentual do papel no
          projeto).
        </p>
        <p>
          O cálculo usa as vigências de cada apontamento. O total do projeto soma os custos dos
          colaboradores. Uma bonificação de 10% entra na fórmula como 0,10.
        </p>
        <p>
          O valor/hora vem do valor preservado na configuração financeira do colaborador válida na
          data das horas. Editar a tabela de remuneração não altera as vigências já criadas. Se não
          houver remuneração vigente nessa data, essas horas ficam sem custo e o total é apresentado
          como parcial.
        </p>
        <p>
          A bonificação é opcional: sem regra vigente, aplica-se 0%. Benefícios cadastrados são
          apenas informativos, e rateio de ociosidade não faz parte do modelo: o custo apurado
          considera somente as horas registradas.
        </p>
      </section>
      <section>
        <h3>Assertividade do orçamento</h3>
        <p className="dashboard-help-formula">
          Assertividade do orçamento = valor orçado ÷ custo realizado × 100.
        </p>
        <p>
          Com orçamento de R$ 100, um custo de R$ 50 resulta em 200%; R$ 100, em 100%; R$ 200, em
          50%. Acima de 100%, o custo registrado está abaixo do orçamento. Durante a execução, o
          resultado é provisório.
        </p>
        <p>O cartão geral apresenta a média dos percentuais dos projetos com base de cálculo.</p>
        <p>
          A comparação exige horas registradas, orçamento e custo positivos e remuneração completa.
          Com filtro de período ou equipe, fica indisponível para evitar comparar custo parcial com
          orçamento integral.
        </p>
      </section>
      <section>
        <h3>Auditoria e inconsistências</h3>
        <p>
          A auditoria identifica remuneração ausente e vínculos de equipe a conferir. A ausência de
          uma regra de bonificação não é uma inconsistência.
        </p>
        <p>
          Quando não há participação de equipe válida na data das horas, o custo usa o valor/hora
          sem bonificação. Confira a equipe e as datas de participação em Projetos.
        </p>
      </section>
      <section>
        <h3>Indicadores de tarefas</h3>
        <p>
          Os indicadores operacionais usam as tarefas do recorte e são independentes dos custos.
          Tarefas canceladas são excluídas das contagens, mas horas efetivamente trabalhadas
          continuam no custo e no percentual de correções. Arquivamento preserva o histórico.
        </p>
        <p>
          A assertividade das estimativas é a razão dos totais das tarefas concluídas com estimativa
          e horas, nunca uma média dos percentuais. Tarefas em andamento ou sem horas não entram
          nessa comparação.
        </p>
        <p>
          Com período aplicado, a tarefa entra no recorte se teve apontamento, início ou conclusão
          nele. Para comparar estimativa e execução, exige-se conclusão no período e todas as horas
          da tarefa dentro dele. Tarefas concluídas sem data de conclusão não entram nas contagens
          de concluídas por período. Tarefas sem datas e sem apontamentos ficam fora de recortes de
          período.
        </p>
        <p>
          Equipe continua significando departamento. No filtro de equipe ou no dashboard individual,
          a tarefa entra por responsabilidade ou por trabalho registrado. A estimativa não é
          dividida entre pessoas: a assertividade de contexto usa as horas completas das tarefas,
          enquanto horas e custos do colaborador usam somente seus apontamentos.
        </p>
        <p>
          Correções usam as horas de correção divididas por todas as horas do recorte. Havendo horas
          sem tarefa, o resultado é parcial: essa parcela não pode ser classificada. Sem nenhuma
          hora vinculada a uma tarefa, o percentual fica indisponível.
        </p>
        <p>
          A auditoria apresenta ocorrências por tarefa ou apontamento, com acesso ao registro. Uma
          mesma tarefa pode ter mais de uma pendência. Custos base e bônus são arredondados para
          centavos em cada apontamento antes da soma, permitindo conferir os totais nos detalhes.
        </p>
        <dl>
          <dt>Assertividade das estimativas</dt>
          <dd>Horas estimadas ÷ horas realizadas × 100.</dd>
          <dt>Percentual de correções</dt>
          <dd>Horas em tarefas de correção ÷ horas totais × 100.</dd>
          <dt>Tarefas executadas sem horas</dt>
          <dd>Tarefas executadas sem apontamento ÷ total de tarefas executadas × 100.</dd>
          <dt>Tarefas sem estimativa</dt>
          <dd>Tarefas sem estimativa ÷ total de tarefas × 100.</dd>
        </dl>
      </section>
      <section>
        <h3>Visão em gráficos</h3>
        <p>
          Os gráficos usam o mesmo recorte dos cartões e respondem aos mesmos filtros. Passe o mouse
          sobre uma barra ou fatia para ver os valores; eles também estão nas tabelas das seções de
          detalhe.
        </p>
        <ul>
          <li>Custo por mês: custo base e bonificação dos apontamentos de cada mês.</li>
          <li>
            Orçamento × custo por projeto: o orçamento é o valor integral do projeto. Com filtro de
            período, equipe, colaborador ou sprint, o custo é só o do recorte.
          </li>
          <li>Horas por status: quanto das horas está pendente, aprovado ou faturado.</li>
          <li>Tarefas por status: planejadas, em andamento, concluídas e canceladas.</li>
          <li>
            Custo por cliente, horas por equipe e ocorrências por tipo: do maior para o menor; com
            muitas categorias, as menores são somadas em "Outros".
          </li>
        </ul>
      </section>
    </HelpDialog>
  );
}
