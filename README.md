# Perícias — aplicativo de gestão

Aplicativo de uso exclusivo da perita Larissa Mendes Henrrique: processos, prazos com avisos, fases da perícia,
honorários e painel. O plano completo está no projeto "Perícias" do Claude (`claude/plano_aplicativo_pericias.md`).

## Como é montado

| Parte | Onde fica | Para que serve |
|---|---|---|
| Servidor | `src/index.ts` | Login e todas as regras (Cloudflare Workers + Hono) |
| Telas | `public/` | O que aparece no iPhone e no computador (Preact, sem etapa de compilação) |
| Banco | `migrations/` | Estrutura do banco `pericias-db` (Cloudflare D1) |

Não há armazenamento de arquivos: o app não recebe arquivos.

## Acesso

- Uma única usuária. O banco recusa uma segunda conta (gatilho `usuario_unico`) e não existe tela de cadastro.
- A senha é criada pela própria usuária num link de primeiro acesso: uso único, 24 horas, só o hash do código fica no
  banco (`convites`). O link tem a forma `/#/acesso/<código>`; o código fica depois do `#` e não chega aos registros do
  servidor.
- Senha guardada com PBKDF2-SHA256 (100.000 rodadas, sal próprio). Mínimo de 8 caracteres, com letras e números.
- Sessão de 30 dias por aparelho, em cookie `lm_sessao` (HttpOnly, Secure, SameSite=Lax); no banco fica só o hash.
- 5 senhas erradas bloqueiam novas entradas por 15 minutos. Sessões já abertas continuam valendo.
- Criar a senha (ou uma nova) derruba as sessões abertas e invalida outros links pendentes.
- Esqueceu a senha: `bash scripts/novo-acesso.sh <endereço do app> redefinir_senha` mostra o link e o SQL; o SQL é
  rodado no `pericias-db` pelo conector do Cloudflare e o link vai para a Larissa.
- Toda rota de `/api/*` exige login, menos entrar, sair, "quem sou eu" e o link de acesso.

## Visual

Paleta da logomarca: framboesa `#C5215F` (principal), cinza da logo `#A2A0A1` (só linhas e ícones), rosé `#E7E0E4`
(cartões), grafite `#2B2729` (texto). Modo escuro acompanha o aparelho. O ícone (`public/icone.svg`) é o monograma LM
redesenhado em vetor a partir da logo; `public/logo.png` é a logo completa com fundo transparente.

## Atalhos

- iPhone: Safari → Compartilhar → Adicionar à Tela de Início. O app instalado tem login próprio (entra uma vez).
- Computador: Chrome ou Edge → ícone de instalar na barra de endereço; Safari no Mac → Arquivo → Adicionar ao Dock.
- `public/sw.js` guarda só as telas do app, nunca os dados.

## Publicação

O Cloudflare publica sozinho a cada alteração enviada à branch `main` (Workers Builds, comando `npx wrangler deploy`).
Mudanças na estrutura do banco são aplicadas à parte e ficam registradas em `migrations/`.

## Rodar e testar no computador

```sh
npm install
npx wrangler d1 migrations apply pericias-db --local
npx wrangler d1 execute pericias-db --local --file scripts/seed-local.sql
NO_PROXY=127.0.0.1,localhost npx wrangler dev --local   # abre em http://127.0.0.1:8787
bash scripts/teste-local.sh                              # testes do servidor (banco local recém-criado)
```

`scripts/seed-local.sql` cria dados só para teste. Não use em produção.

## Contas

O app fica nas contas próprias da Larissa: GitHub `larissamendeshenrrique-glitch` e Cloudflare (banco `pericias-db`,
id `207f9f00-c35a-40e7-9baf-5964ccc0156a`). Não tem nenhuma ligação com a Nova Forma.
