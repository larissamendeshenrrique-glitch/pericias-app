#!/usr/bin/env bash
# Testes do servidor contra o ambiente local (wrangler dev --local, com scripts/seed-local.sql aplicado).
# Uso: bash scripts/teste-local.sh
set -u
B=http://127.0.0.1:8787
c() { curl -s --noproxy '*' "$@"; }
OK=0; FALHA=0
confere() { if [ "$2" = "$3" ]; then OK=$((OK+1)); echo "  ok    $1"; else FALHA=$((FALHA+1)); echo "  FALHA $1 (esperado: $2, obtido: $3)"; fi; }
cod() { c -o /dev/null -w '%{http_code}' "$@"; }
J='Content-Type: application/json'
campo() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1" 2>/dev/null; }
sql() { npx wrangler d1 execute pericias-db --local --json --command "$1" 2>/dev/null; }
T=teste-token-local-123456789
EMAIL=teste@exemplo.local

echo "Sem login"
confere "rotas protegidas exigem login" 401 "$(cod $B/api/processos)"
confere "quem sou eu sem login responde vazio" None "$(c $B/api/auth/eu | campo "['usuario']")"
confere "entrar sem senha criada é recusado" 401 "$(cod -X POST -H "$J" -d "{\"email\":\"$EMAIL\",\"senha\":\"qualquer123\"}" $B/api/auth/entrar)"

echo "Primeiro acesso"
confere "link válido abre" 200 "$(cod $B/api/acesso/$T)"
confere "link mostra o e-mail" "$EMAIL" "$(c $B/api/acesso/$T | campo "['email']")"
confere "link inexistente é recusado" 404 "$(cod $B/api/acesso/nao-existe-este-codigo-aqui)"
confere "link com caracteres estranhos é recusado" 404 "$(cod "$B/api/acesso/abc%27%20OR%201=1")"
confere "senha curta é recusada" 400 "$(cod -X POST -H "$J" -d '{"senha":"abc1"}' $B/api/acesso/$T)"
confere "senha sem número é recusada" 400 "$(cod -X POST -H "$J" -d '{"senha":"somenteletras"}' $B/api/acesso/$T)"
confere "pedido vindo de outro site é recusado" 403 "$(cod -X POST -H "$J" -H 'Origin: https://site-malicioso.example' -d '{"senha":"Pericia2026ok"}' $B/api/acesso/$T)"
CK=$(c -D - -o /dev/null -X POST -H "$J" -d '{"senha":"Pericia2026ok"}' $B/api/acesso/$T | grep -i '^set-cookie' | sed 's/.*lm_sessao=\([^;]*\).*/\1/' | tr -d '\r')
confere "senha criada abre sessão" 1 "$([ -n "$CK" ] && echo 1 || echo 0)"
confere "link não pode ser usado de novo" 404 "$(cod $B/api/acesso/$T)"
A="Cookie: lm_sessao=$CK"
confere "sessão identifica a usuária" "$EMAIL" "$(c -H "$A" $B/api/auth/eu | campo "['usuario']['email']")"
confere "com login, rota inexistente dá 404 (não 401)" 404 "$(cod -H "$A" $B/api/qualquer-coisa)"
confere "senha não fica guardada em texto" 1 "$(sql "SELECT senha_hash FROM usuarios WHERE id=1" | grep -c 'pbkdf2\$100000\$')"

echo "Entrar"
confere "senha errada é recusada" 401 "$(cod -X POST -H "$J" -d "{\"email\":\"$EMAIL\",\"senha\":\"errada123\"}" $B/api/auth/entrar)"
confere "e-mail inexistente dá a mesma resposta" 401 "$(cod -X POST -H "$J" -d '{"email":"ninguem@exemplo.local","senha":"errada123"}' $B/api/auth/entrar)"
confere "senha certa entra (e-mail em maiúsculas)" 200 "$(cod -X POST -H "$J" -d '{"email":"TESTE@exemplo.local","senha":"Pericia2026ok"}' $B/api/auth/entrar)"
C2=$(c -D - -o /dev/null -X POST -H "$J" -d "{\"email\":\"$EMAIL\",\"senha\":\"Pericia2026ok\"}" $B/api/auth/entrar | grep -i '^set-cookie' | tr -d '\r')
confere "cookie é HttpOnly, Secure e SameSite" 1 "$(echo "$C2" | grep -c 'HttpOnly; Secure; SameSite=Lax; Max-Age=2592000')"

echo "Bloqueio após 5 tentativas"
for i in 1 2 3 4 5; do cod -X POST -H "$J" -d "{\"email\":\"$EMAIL\",\"senha\":\"errada$i\"}" $B/api/auth/entrar >/dev/null; done
confere "sexta tentativa fica bloqueada" 429 "$(cod -X POST -H "$J" -d "{\"email\":\"$EMAIL\",\"senha\":\"errada6\"}" $B/api/auth/entrar)"
confere "nem a senha certa entra durante o bloqueio" 429 "$(cod -X POST -H "$J" -d "{\"email\":\"$EMAIL\",\"senha\":\"Pericia2026ok\"}" $B/api/auth/entrar)"
confere "sessão já aberta continua valendo" "$EMAIL" "$(c -H "$A" $B/api/auth/eu | campo "['usuario']['email']")"
sql "UPDATE usuarios SET bloqueado_ate = NULL, tentativas_falhas = 0 WHERE id = 1" >/dev/null

echo "Conta única"
confere "o banco recusa uma segunda usuária" 1 "$(npx wrangler d1 execute pericias-db --local --command "INSERT INTO usuarios (nome, email) VALUES ('Outra', 'outra@exemplo.local')" 2>&1 | grep -c 'única usuária')"

echo "Sair"
confere "sair responde ok" 200 "$(cod -X POST -H "$A" $B/api/auth/sair)"
confere "depois de sair a sessão não vale mais" None "$(c -H "$A" $B/api/auth/eu | campo "['usuario']")"
confere "rota protegida volta a exigir login" 401 "$(cod -H "$A" $B/api/processos)"

echo "Proteções das telas"
H=$(c -D - -o /dev/null $B/)
confere "página tem política de segurança (CSP)" 1 "$(echo "$H" | grep -ci "content-security-policy: default-src 'self'")"
confere "página não pode ser embutida em outro site" 1 "$(echo "$H" | grep -ci 'x-frame-options: DENY')"
confere "API não fica em cache" 1 "$(c -D - -o /dev/null $B/api/auth/eu | grep -ci 'cache-control: no-store')"
confere "atalho (manifest) disponível" 200 "$(cod $B/manifest.webmanifest)"
confere "ícone do iPhone disponível" 200 "$(cod $B/icone-180.png)"

echo
echo "Resultado: $OK ok, $FALHA falha(s)"
[ "$FALHA" = 0 ]
