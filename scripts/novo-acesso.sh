#!/usr/bin/env bash
# Gera um link de primeiro acesso (ou de nova senha) para a usuária do app.
# Uso: bash scripts/novo-acesso.sh https://endereco-do-app [primeiro_acesso|redefinir_senha]
# Mostra o link (para mandar à Larissa) e o SQL a rodar no banco pericias-db (pelo conector do Cloudflare).
# O link vale 24 horas e uma única vez; só o hash do código fica no banco.
set -euo pipefail
BASE="${1:?informe o endereço do app}"
TIPO="${2:-primeiro_acesso}"
TOKEN=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')
HASH=$(printf %s "$TOKEN" | sha256sum | cut -d' ' -f1)
EXPIRA=$(date -u -d '+24 hours' +%Y-%m-%dT%H:%M:%SZ)
echo "LINK: ${BASE%/}/#/acesso/${TOKEN}"
echo "SQL:"
echo "INSERT INTO convites (usuario_id, token_hash, tipo, expira_em) VALUES ((SELECT id FROM usuarios LIMIT 1), '${HASH}', '${TIPO}', '${EXPIRA}');"
