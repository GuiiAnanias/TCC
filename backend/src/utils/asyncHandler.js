/**
 * [ERRO] Envolve funções async das rotas: se a Promise falhar, o erro vai para next() e chega ao
 * errorHandler, em vez de derrubar a requisição.
 */

export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
