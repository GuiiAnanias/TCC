/**
 * [REQUISICAO] Controle de requisições em andamento por tela: cancela a anterior quando outra do
 * mesmo tipo começa e cancela todas ao sair da tela. Evita que uma resposta atrasada sobrescreva
 * dados mais novos.
 */

import { useLayoutEffect, useMemo, useRef } from "react";

// Cria o escopo; begin(chave) devolve o signal do AbortController e isCurrent() para conferir se a
// resposta ainda vale.
export function useEscopoRequisicao(context) {
  const scope = useMemo(() => {
    const requests = new Map();
    const cancel = (key) => {
      requests.get(key)?.abort();
      requests.delete(key);
    };
    return {
      owner: context,
      cancel,
      cancelAll() {
        for (const key of requests.keys()) cancel(key);
      },
      begin(key) {
        cancel(key);
        const controller = new AbortController();
        requests.set(key, controller);
        return {
          signal: controller.signal,
          isCurrent: () => requests.get(key) === controller && !controller.signal.aborted,
        };
      },
    };
  }, [context]);
  useLayoutEffect(() => () => scope.cancelAll(), [scope]);
  return scope;
}

// Guarda sempre o valor mais recente numa ref, para funções assíncronas lerem o estado atual.
export function useValorMaisRecente(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
