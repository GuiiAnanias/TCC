import { act } from "react";

export function controlRequests(api) {
  const original = api.get;
  const requests = [];
  api.get = (url, options = {}) => {
    const pending = Promise.withResolvers();
    requests.push({ url, options, ...pending });
    return pending.promise;
  };
  return {
    requests,
    resolve: (request, data) => act(async () => request.resolve({ data })),
    reject: (request) => act(async () => request.reject(new Error("Falha antiga"))),
    restore: () => {
      api.get = original;
    },
  };
}
