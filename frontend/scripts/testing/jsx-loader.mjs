import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".jsx")) return nextLoad(url, context);
  const { code } = await transform(await readFile(new URL(url), "utf8"), {
    loader: "jsx",
    format: "esm",
    jsx: "automatic",
    sourcefile: url,
  });
  return { format: "module", source: code, shortCircuit: true };
}
