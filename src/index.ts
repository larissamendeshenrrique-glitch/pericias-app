// Perícias — servidor do aplicativo
// Etapa 1: entrar, sair, link de primeiro acesso e trava de login em todo o resto de /api.
import { Hono } from 'hono';
import type { Context, Next } from 'hono';

type Env = { DB: any };
type Usuario = { id: number; nome: string; email: string };
type Ctx = { Bindings: Env; Variables: { u: Usuario } };
type C = Context<Ctx>;

const app = new Hono<Ctx>();

const COOKIE = 'lm_sessao';
const DIAS_SESSAO = 30;
const ITERACOES = 100_000;
const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

// ---------- utilidades ----------

class Erro extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}
const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
const agora = () => iso(new Date());
const daqui = (ms: number) => iso(new Date(Date.now() + ms));
const DIA = 864e5;
const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deB64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))]
    .map((x) => x.toString(16).padStart(2, '0')).join('');
const novoToken = () =>
  b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function derivar(senha: string, sal: Uint8Array, iteracoes: number) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, chave, 256);
  return new Uint8Array(bits);
}
async function hashSenha(senha: string) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERACOES}$${b64(sal)}$${b64(await derivar(senha, sal, ITERACOES))}`;
}
// Faz o mesmo trabalho mesmo quando não existe senha guardada, para não revelar se o e-mail existe.
async function conferirSenha(senha: string, guardado: string | null) {
  const partes = (guardado ?? '').split('$');
  const valido = partes.length === 4 && partes[0] === 'pbkdf2';
  const sal = valido ? deB64(partes[2]) : new Uint8Array(16);
  const esperado = valido ? deB64(partes[3]) : new Uint8Array(32);
  const calculado = await derivar(senha, sal, valido ? Number(partes[1]) : ITERACOES);
  let dif = valido ? 0 : 1;
  for (let i = 0; i < calculado.length; i++) dif |= calculado[i] ^ (esperado[i] ?? 0);
  return dif === 0;
}
function validarSenha(senha: unknown): string {
  if (typeof senha !== 'string' || senha.length < 8 || !/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
    throw new Erro(400, 'A senha precisa ter pelo menos 8 caracteres, com letras e números.');
  }
  if (senha.length > 200) throw new Erro(400, 'A senha é longa demais.');
  return senha;
}

async function corpo(c: C): Promise<Record<string, any>> {
  try {
    const d = await c.req.json();
    if (d && typeof d === 'object' && !Array.isArray(d)) return d;
  } catch { /* cai no erro abaixo */ }
  throw new Erro(400, 'Dados inválidos.');
}
const ip = (c: C) => c.req.header('CF-Connecting-IP') ?? null;

async function auditar(c: C, acao: string, usuarioId: number | null, detalhes: unknown = null) {
  await c.env.DB.prepare('INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes, ip) VALUES (?,?,?,?,?,?)')
    .bind(usuarioId, acao, 'usuario', usuarioId, detalhes ? JSON.stringify(detalhes) : null, ip(c)).run();
}

// ---------- sessão ----------

function cookieSessao(token: string, segundos: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${segundos}`;
}
async function abrirSessao(c: C, usuarioId: number) {
  const token = novoToken();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sessoes (id, usuario_id, expira_em, ultimo_uso_em, ip, user_agent) VALUES (?,?,?,?,?,?)')
      .bind(await sha256(token), usuarioId, daqui(DIAS_SESSAO * DIA), agora(), ip(c),
        (c.req.header('User-Agent') ?? '').slice(0, 300)),
    c.env.DB.prepare('UPDATE usuarios SET ultimo_acesso_em = ?, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?')
      .bind(agora(), usuarioId),
    c.env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?').bind(agora()),
  ]);
  c.header('Set-Cookie', cookieSessao(token, DIAS_SESSAO * 86400));
}
function tokenDoCookie(c: C) {
  const m = (c.req.header('Cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
async function carregarUsuario(c: C): Promise<Usuario | null> {
  const token = tokenDoCookie(c);
  if (!token) return null;
  const id = await sha256(token);
  const r = await c.env.DB.prepare(
    `SELECT u.id, u.nome, u.email, s.ultimo_uso_em
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id = ? AND s.expira_em > ? AND u.ativo = 1`).bind(id, agora()).first();
  if (!r) return null;
  if (!r.ultimo_uso_em || Date.now() - Date.parse(r.ultimo_uso_em) > 36e5) {
    await c.env.DB.prepare('UPDATE sessoes SET ultimo_uso_em = ? WHERE id = ?').bind(agora(), id).run();
  }
  return { id: r.id, nome: r.nome, email: r.email };
}
const exigirLogin = async (c: C, next: Next) => {
  const u = await carregarUsuario(c);
  if (!u) return c.json({ erro: 'Entre para continuar.' }, 401);
  c.set('u', u);
  await next();
};

// ---------- proteções gerais ----------

app.onError((e, c) => {
  if (e instanceof Erro) return c.json({ erro: e.message }, e.status as any);
  console.error(e);
  return c.json({ erro: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }, 500);
});

app.use('*', async (c, next) => {
  // Alterações só são aceitas quando partem do próprio aplicativo.
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const origem = c.req.header('Origin');
    let outroSite = false;
    try { outroSite = !!origem && new URL(origem).host !== new URL(c.req.url).host; } catch { outroSite = true; }
    if (outroSite) return c.json({ erro: 'Origem não permitida.' }, 403);
  }
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
  c.header('Cache-Control', 'no-store');
});

// ---------- entrar, sair e primeiro acesso (sem login) ----------

app.post('/api/auth/entrar', async (c) => {
  const d = await corpo(c);
  const email = String(d.email ?? '').trim().toLowerCase();
  const senha = String(d.senha ?? '');
  if (!email || !senha) throw new Erro(400, 'Informe e-mail e senha.');
  if (email.length > 200 || senha.length > 200) throw new Erro(401, 'E-mail ou senha incorretos.');
  const u = await c.env.DB.prepare(
    'SELECT id, senha_hash, ativo, tentativas_falhas, bloqueado_ate FROM usuarios WHERE email = ?').bind(email).first();
  if (u?.bloqueado_ate && u.bloqueado_ate > agora()) {
    throw new Erro(429, `Muitas tentativas. Aguarde ${MINUTOS_BLOQUEIO} minutos e tente de novo.`);
  }
  const ok = await conferirSenha(senha, u?.ativo ? u.senha_hash : null);
  if (!ok) {
    if (u) {
      const tentativas = (u.tentativas_falhas ?? 0) + 1;
      const bloquear = tentativas >= MAX_TENTATIVAS;
      await c.env.DB.prepare('UPDATE usuarios SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id = ?')
        .bind(bloquear ? 0 : tentativas, bloquear ? daqui(MINUTOS_BLOQUEIO * 6e4) : null, u.id).run();
      await auditar(c, bloquear ? 'login_bloqueado' : 'login_recusado', u.id);
    }
    throw new Erro(401, 'E-mail ou senha incorretos.');
  }
  await abrirSessao(c, u.id);
  await auditar(c, 'login', u.id);
  return c.json({ ok: true });
});

app.post('/api/auth/sair', async (c) => {
  const token = tokenDoCookie(c);
  if (token) await c.env.DB.prepare('DELETE FROM sessoes WHERE id = ?').bind(await sha256(token)).run();
  c.header('Set-Cookie', cookieSessao('', 0));
  return c.json({ ok: true });
});

app.get('/api/auth/eu', async (c) => {
  const u = await carregarUsuario(c);
  return c.json({ usuario: u ? { nome: u.nome, email: u.email } : null });
});

async function buscarConvite(c: C, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new Erro(404, 'Este link não vale mais. Peça um novo ao Claude.');
  const r = await c.env.DB.prepare(
    `SELECT v.id, v.usuario_id, v.tipo, u.nome, u.email
       FROM convites v JOIN usuarios u ON u.id = v.usuario_id
      WHERE v.token_hash = ? AND v.usado_em IS NULL AND v.expira_em > ? AND u.ativo = 1`)
    .bind(await sha256(token), agora()).first();
  if (!r) throw new Erro(404, 'Este link não vale mais. Peça um novo ao Claude.');
  return r;
}
app.get('/api/acesso/:token', async (c) => {
  const v = await buscarConvite(c, c.req.param('token'));
  return c.json({ nome: v.nome, email: v.email, tipo: v.tipo });
});
app.post('/api/acesso/:token', async (c) => {
  const v = await buscarConvite(c, c.req.param('token'));
  const senha = validarSenha((await corpo(c)).senha);
  // Nova senha derruba as sessões abertas em outros aparelhos e invalida qualquer outro link pendente.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE usuarios SET senha_hash = ?, senha_definida_em = ?, tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?')
      .bind(await hashSenha(senha), agora(), v.usuario_id),
    c.env.DB.prepare('UPDATE convites SET usado_em = ? WHERE usuario_id = ? AND usado_em IS NULL')
      .bind(agora(), v.usuario_id),
    c.env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ?').bind(v.usuario_id),
  ]);
  await abrirSessao(c, v.usuario_id);
  await auditar(c, 'senha_definida', v.usuario_id, { tipo: v.tipo });
  return c.json({ ok: true });
});

// ---------- daqui para baixo, tudo exige login ----------

app.use('/api/*', exigirLogin);

// As próximas etapas registram as rotas aqui (processos, prazos, fases, financeiro, painel).

app.all('/api/*', (c) => c.json({ erro: 'Endereço não encontrado.' }, 404));

export default { fetch: app.fetch };
