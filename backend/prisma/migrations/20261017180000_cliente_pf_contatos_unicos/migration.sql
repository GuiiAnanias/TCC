-- A transação evita aplicar só uma das restrições se houver duplicados legados.
-- Contatos já repetidos precisam ser corrigidos antes de aplicar esta migração.
BEGIN;

CREATE UNIQUE INDEX "clientes_pf_email_key"
ON "clientes" (lower(btrim("email")))
WHERE "tipoPessoa" = 'PF' AND "email" IS NOT NULL AND btrim("email") <> '';

CREATE UNIQUE INDEX "clientes_pf_telefone_key"
ON "clientes" (regexp_replace("telefone", '[^0-9]', '', 'g'))
WHERE "tipoPessoa" = 'PF' AND "telefone" IS NOT NULL
  AND regexp_replace("telefone", '[^0-9]', '', 'g') <> '';

COMMIT;
