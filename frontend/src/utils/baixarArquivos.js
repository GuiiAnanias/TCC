// Salva no computador a resposta binária da API (axios com responseType "blob").
export function salvarArquivo(response, nomePadrao) {
  const disposicao = response.headers?.["content-disposition"] ?? "";
  const nome = /filename="?([^";]+)"?/i.exec(disposicao)?.[1] ?? nomePadrao;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nome;
}

// Com responseType "blob", até a resposta de erro chega como Blob: lê a mensagem JSON dela.
export async function mensagemDeErro(error, padrao) {
  let data = error.response?.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      return padrao;
    }
  }
  return data?.errors?.[0]?.message || data?.message || padrao;
}
