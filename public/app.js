// Perícias — telas do aplicativo
// Etapa 1: entrar, criar a senha pelo link de primeiro acesso, estrutura das telas e instalação no aparelho.
import { html, render, useState, useEffect } from './vendor/preact-htm.js';

// ---------- utilidades ----------

async function api(url, { method = 'GET', body } = {}) {
  const falha = (texto, status) => Object.assign(new Error(texto), { status });
  let r;
  try {
    r = await fetch(url, {
      method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw falha('Sem conexão. Confira a internet e tente de novo.', 0);
  }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/api/auth/')) dispatchEvent(new Event('sessao-encerrada'));
  if (!r.ok) throw falha(d.erro || 'Não foi possível concluir. Tente de novo.', r.status);
  return d;
}

function useRota() {
  const ler = () => location.hash.replace(/^#/, '') || '/';
  const [rota, setRota] = useState(ler());
  useEffect(() => {
    const mudou = () => { setRota(ler()); window.scrollTo(0, 0); };
    addEventListener('hashchange', mudou);
    return () => removeEventListener('hashchange', mudou);
  }, []);
  return rota;
}

const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IOS_FORA_DO_SAFARI = IOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
const INSTALADO = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// O navegador do computador (Chrome ou Edge) oferece a instalação por este evento; guardamos para o botão.
let pedidoInstalacao = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalacao = e; dispatchEvent(new Event('pode-instalar')); });

if ('serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// ---------- ícones do menu ----------

const ICONE = {
  painel: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>`,
  processos: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.4l2 2h8.6A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>`,
  prazos: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3M12 13v3l2 1.5"/></svg>`,
  financeiro: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 8.8c-.6-.8-1.7-1.3-3-1.3-1.8 0-3 .9-3 2.2 0 3.1 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.2-1.5M12 6v1.5M12 16.5V18"/></svg>`,
  ajustes: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
};

const MENU = [
  ['/', 'Painel', 'painel'],
  ['/processos', 'Processos', 'processos'],
  ['/prazos', 'Prazos', 'prazos'],
  ['/financeiro', 'Financeiro', 'financeiro'],
  ['/ajustes', 'Ajustes', 'ajustes'],
];

// ---------- campos ----------

function CampoSenha({ id, rotulo, valor, mudar, autocomplete }) {
  const [ver, setVer] = useState(false);
  return html`<div class="campo">
    <label for=${id}>${rotulo}</label>
    <div class="senha">
      <input id=${id} type=${ver ? 'text' : 'password'} value=${valor} autocomplete=${autocomplete}
        onInput=${(e) => mudar(e.currentTarget.value)} required />
      <button type="button" onClick=${() => setVer(!ver)} aria-label=${ver ? 'Esconder a senha' : 'Mostrar a senha'}>
        ${ver ? 'Esconder' : 'Mostrar'}</button>
    </div>
  </div>`;
}

// ---------- entrar ----------

function Entrar({ entrou }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try {
      await api('/api/auth/entrar', { method: 'POST', body: { email, senha } });
      await entrou();
    } catch (x) {
      setErro(x.message);
      setEnviando(false);
    }
  };
  return html`<main class="entrada">
    <form class="entrada-caixa" onSubmit=${enviar} novalidate>
      <img class="entrada-logo" src="/logo.png" alt="Larissa Mendes · Perícia Contábil" width="1135" height="738" />
      <h1>Entrar</h1>
      ${erro && html`<div class="erro" role="alert">${erro}</div>`}
      <div class="campo">
        <label for="email">E-mail</label>
        <input id="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none"
          value=${email} onInput=${(e) => setEmail(e.currentTarget.value)} required />
      </div>
      <${CampoSenha} id="senha" rotulo="Senha" valor=${senha} mudar=${setSenha} autocomplete="current-password" />
      <button class="botao largo" type="submit" disabled=${enviando}>${enviando ? 'Entrando…' : 'Entrar'}</button>
      <p class="rodape discreto">Esqueceu a senha? Peça ao Claude um novo link de acesso.</p>
    </form>
  </main>`;
}

// ---------- primeiro acesso (criar a senha) ----------

function PrimeiroAcesso({ token, entrou }) {
  const [convite, setConvite] = useState(null);
  const [erroLink, setErroLink] = useState('');
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    api(`/api/acesso/${encodeURIComponent(token)}`).then(setConvite).catch((x) => setErroLink(x.message));
  }, [token]);
  const regras = [
    ['Pelo menos 8 caracteres', senha.length >= 8],
    ['Pelo menos uma letra', /[A-Za-zÀ-ÿ]/.test(senha)],
    ['Pelo menos um número', /\d/.test(senha)],
  ];
  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!regras.every(([, ok]) => ok)) return setErro('A senha ainda não cumpre as regras abaixo do campo.');
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    setEnviando(true);
    try {
      await api(`/api/acesso/${encodeURIComponent(token)}`, { method: 'POST', body: { senha } });
      await entrou();
      // troca o endereço do link (que não vale mais) pela tela de Ajustes, sem deixar o link no histórico
      location.replace('/#/ajustes');
    } catch (x) {
      setErro(x.message);
      setEnviando(false);
    }
  };
  return html`<main class="entrada">
    <div class="entrada-caixa">
      <img class="entrada-logo" src="/logo.png" alt="Larissa Mendes · Perícia Contábil" width="1135" height="738" />
      ${erroLink ? html`
        <h1>Link sem validade</h1>
        <div class="erro" role="alert">${erroLink}</div>
        <a class="botao secundario largo" href="/#/">Ir para a tela de entrada</a>`
      : !convite ? html`<p class="carregando">Conferindo o link…</p>`
      : html`<form onSubmit=${enviar} novalidate>
        <h1>${convite.tipo === 'redefinir_senha' ? 'Criar uma nova senha' : 'Criar sua senha'}</h1>
        <p class="discreto" style="text-align:center">Acesso de <strong>${convite.email}</strong></p>
        ${erro && html`<div class="erro" role="alert">${erro}</div>`}
        <input type="email" value=${convite.email} autocomplete="username" class="oculto" readonly tabindex="-1" aria-hidden="true" />
        <${CampoSenha} id="nova" rotulo="Nova senha" valor=${senha} mudar=${setSenha} autocomplete="new-password" />
        <ul class="regras">${regras.map(([t, ok]) => html`<li class=${ok ? 'cumprida' : ''}>${ok ? '✓' : '○'} ${t}</li>`)}</ul>
        <${CampoSenha} id="repetir" rotulo="Repita a senha" valor=${repetir} mudar=${setRepetir} autocomplete="new-password" />
        <button class="botao largo" type="submit" disabled=${enviando}>${enviando ? 'Salvando…' : 'Salvar senha e entrar'}</button>
        <p class="rodape discreto">O link vale uma única vez. A senha fica guardada de forma que nem o Claude consegue lê-la.</p>
      </form>`}
    </div>
  </main>`;
}

// ---------- telas que chegam nas próximas etapas ----------

function EmBreve({ titulo, etapa, itens }) {
  return html`<div>
    <h1>${titulo}</h1>
    <div class="cartao">
      <span class="etiqueta">Etapa ${etapa}</span>
      <p>Esta parte do aplicativo chega na Etapa ${etapa}. Ela vai trazer:</p>
      <ul class="lista-simples">${itens.map((t) => html`<li>${t}</li>`)}</ul>
    </div>
  </div>`;
}

const PAGINAS = {
  '/': () => html`<${EmBreve} titulo="Painel" etapa="7" itens=${[
    'Processos ativos, prazos dos próximos 7 dias, honorários pendentes e receita do mês',
    'Distribuição dos processos por status e por estado',
    'Próximos prazos com selo de cor: Vencido, Hoje, Amanhã, N dias',
  ]} />`,
  '/processos': () => html`<${EmBreve} titulo="Processos" etapa="2" itens=${[
    'Cadastro com número CNJ conferido, tribunal, comarca, vara, partes, advogados e juiz',
    'Lista separada por estado, só com os estados que têm processo',
    'Busca por número, parte ou comarca, e histórico de alterações',
  ]} />`,
  '/prazos': () => html`<${EmBreve} titulo="Prazos" etapa="3 e 4" itens=${[
    'Contagem em dias úteis a partir da intimação, com ajuste à mão',
    'Avisos 7 dias antes, 3 dias antes, na véspera e no dia, a partir das 10h',
    'Botão Concluir, prorrogação com histórico e Calendário do iPhone',
  ]} />`,
  '/financeiro': () => html`<${EmBreve} titulo="Financeiro" etapa="6" itens=${[
    'Honorários propostos, arbitrados, contratados e recebidos',
    'Parcelas, adiantamentos, retenções, despesas e reembolsos',
    'Receita por mês e por ano, bruta e líquida',
  ]} />`,
};

// ---------- ajustes ----------

function Instalar() {
  const [instalado, setInstalado] = useState(INSTALADO());
  const [podeInstalar, setPodeInstalar] = useState(!!pedidoInstalacao);
  useEffect(() => {
    const pode = () => setPodeInstalar(true);
    const foi = () => { setInstalado(true); setPodeInstalar(false); };
    addEventListener('pode-instalar', pode);
    addEventListener('appinstalled', foi);
    return () => { removeEventListener('pode-instalar', pode); removeEventListener('appinstalled', foi); };
  }, []);
  const instalar = async () => {
    if (!pedidoInstalacao) return;
    pedidoInstalacao.prompt();
    await pedidoInstalacao.userChoice.catch(() => {});
    pedidoInstalacao = null;
    setPodeInstalar(false);
  };
  if (instalado) {
    return html`<div class="cartao"><h2>Atalho neste aparelho</h2>
      <div class="ok">O app está aberto pelo atalho. Tudo certo neste aparelho.</div></div>`;
  }
  if (IOS) {
    return html`<div class="cartao"><h2>Atalho no iPhone</h2>
      ${IOS_FORA_DO_SAFARI && html`<div class="erro">No iPhone, o atalho só pode ser criado pelo <strong>Safari</strong>. Abra este endereço no Safari.</div>`}
      <ol class="passos">
        <li>No Safari, toque no botão <strong>Compartilhar</strong> (o quadrado com a seta para cima).</li>
        <li>Role e toque em <strong>Adicionar à Tela de Início</strong>.</li>
        <li>Confira o nome <strong>Perícias</strong> e toque em <strong>Adicionar</strong>.</li>
        <li>Abra o app pelo novo ícone <strong>LM</strong> e entre com seu e-mail e senha uma vez.</li>
      </ol>
      <p class="discreto">O atalho é necessário para os avisos de prazo chegarem no iPhone (Etapa 4).</p></div>`;
  }
  return html`<div class="cartao"><h2>Atalho no computador</h2>
    ${podeInstalar ? html`<p>Seu navegador permite instalar o app com um clique.</p>
      <button class="botao" onClick=${instalar}>Instalar no computador</button>`
    : html`<ol class="passos">
        <li><strong>Chrome ou Edge:</strong> clique no ícone de instalar, no fim da barra de endereço, e depois em <strong>Instalar</strong>.</li>
        <li><strong>Safari no Mac:</strong> menu <strong>Arquivo → Adicionar ao Dock</strong>.</li>
      </ol>
      <p class="discreto">Depois disso, o app abre numa janela própria, com o ícone LM na barra de tarefas ou no Dock.</p>`}
  </div>`;
}

function Ajustes({ usuario, saiu }) {
  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    setSaindo(true);
    try { await api('/api/auth/sair', { method: 'POST' }); } catch { /* sai do aparelho mesmo sem resposta */ }
    saiu();
  };
  return html`<div>
    <h1>Ajustes</h1>
    <div class="cartao">
      <h2>Conta</h2>
      <div class="linha-info"><span>Nome</span><span>${usuario.nome}</span></div>
      <div class="linha-info"><span>E-mail</span><span>${usuario.email}</span></div>
    </div>
    <${Instalar} />
    <div class="cartao">
      <h2>Sair</h2>
      <p class="discreto">Encerra o acesso só neste aparelho. Os outros continuam conectados.</p>
      <button class="botao secundario" onClick=${sair} disabled=${saindo}>${saindo ? 'Saindo…' : 'Sair deste aparelho'}</button>
    </div>
  </div>`;
}

// ---------- estrutura ----------

function Estrutura({ rota, usuario, saiu }) {
  const base = '/' + (rota.split('/')[1] || '');
  const pagina = base === '/ajustes'
    ? html`<${Ajustes} usuario=${usuario} saiu=${saiu} />`
    : (PAGINAS[base] || PAGINAS['/'])();
  return html`<div class="app">
    <header class="topo">
      <img src="/icone.svg" alt="" />
      <div class="nome">Perícias<small>Larissa Mendes</small></div>
    </header>
    <nav class="menu" aria-label="Menu principal">
      ${MENU.map(([href, nome, icone]) => html`<a href=${'#' + href} class=${base === href ? 'ativo' : ''}
        aria-current=${base === href ? 'page' : undefined}>${ICONE[icone]}<span>${nome}</span></a>`)}
    </nav>
    <main class="conteudo">${pagina}</main>
  </div>`;
}

function App() {
  const rota = useRota();
  const [usuario, setUsuario] = useState(undefined); // undefined: ainda conferindo
  const [erroInicio, setErroInicio] = useState('');
  const conferir = async () => {
    try {
      const d = await api('/api/auth/eu');
      setUsuario(d.usuario);
      setErroInicio('');
    } catch (x) {
      setErroInicio(x.message);
    }
  };
  useEffect(() => {
    conferir();
    const encerrada = () => setUsuario(null);
    addEventListener('sessao-encerrada', encerrada);
    return () => removeEventListener('sessao-encerrada', encerrada);
  }, []);

  const acesso = rota.match(/^\/acesso\/([^/?#]+)/);
  if (acesso) return html`<${PrimeiroAcesso} token=${decodeURIComponent(acesso[1])} entrou=${conferir} />`;
  if (usuario === undefined) {
    return html`<main class="entrada"><div class="entrada-caixa">
      <img class="entrada-logo" src="/logo.png" alt="Larissa Mendes · Perícia Contábil" width="1135" height="738" />
      ${erroInicio ? html`<div class="erro" role="alert">${erroInicio}</div>
        <button class="botao largo" onClick=${conferir}>Tentar de novo</button>`
      : html`<p class="carregando">Abrindo…</p>`}
    </div></main>`;
  }
  if (!usuario) return html`<${Entrar} entrou=${conferir} />`;
  return html`<${Estrutura} rota=${rota} usuario=${usuario} saiu=${() => { setUsuario(null); location.hash = '/'; }} />`;
}

render(html`<${App} />`, document.getElementById('app'));
