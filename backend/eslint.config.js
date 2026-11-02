import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "prisma/migrations/"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // Desestruturar para descartar um campo ({ campo, ...resto }) é intencional.
      "no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
    },
  },
];
