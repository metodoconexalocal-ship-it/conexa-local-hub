/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Gestão de Google Meu Negócio · DigitalCreate
   Módulos: Dashboard · Perfis GMN · Postagens · Avaliações · Ranking · Tarefas
   Banco: Firebase (crm-digitalcreate), coleções gmn_*
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* ── Estado global ──────────────────────────────────────────────────────── */
const S = { perfis: [], posts: [], avaliacoes: [], rankings: [], tarefas: [] };
let currentPage = 'dashboard';
const F = {                       // filtros de cada página
  buscaPerfis: '', statusPerfis: '',
  perfilPosts: '', statusPosts: '',
  perfilAval: '', soNaoRespondidas: false,
  perfilRank: '',
  catTarefa: '',
};

/* ── Checklist padrão de otimização de um perfil GMN ────────────────────── */
const CHECKLIST = [
  { k: 'nome',        l: 'Nome do negócio correto e otimizado' },
  { k: 'cat_prim',    l: 'Categoria principal correta' },
  { k: 'cat_sec',     l: 'Categorias secundárias adicionadas' },
  { k: 'endereco',    l: 'Endereço / área de cobertura configurados' },
  { k: 'telefone',    l: 'Telefone e WhatsApp corretos' },
  { k: 'site',        l: 'Site ou link na bio vinculado' },
  { k: 'horarios',    l: 'Horários completos (incluindo feriados)' },
  { k: 'descricao',   l: 'Descrição com palavras-chave (750 caracteres)' },
  { k: 'logo_capa',   l: 'Logo e foto de capa enviados' },
  { k: 'fotos',       l: 'Mínimo de 10 fotos reais no perfil' },
  { k: 'servicos',    l: 'Serviços / produtos cadastrados com descrição' },
  { k: 'atributos',   l: 'Atributos preenchidos' },
  { k: 'chat',        l: 'Chat / mensagens ativado' },
  { k: 'qa',          l: 'Perguntas e respostas semeadas' },
  { k: 'aval_inicial',l: 'Primeira leva de avaliações (5+)' },
  { k: 'aval_resp',   l: 'Todas as avaliações respondidas' },
  { k: 'post_inicial',l: 'Post inaugural publicado' },
  { k: 'utm',         l: 'UTM configurado nos links' },
];

const TIPOS_POST = { novidade: 'Novidade', oferta: 'Oferta', evento: 'Evento', produto: 'Produto' };
const STATUS_PERFIL = {
  verificado:     { l: 'Verificado',      c: 's-feito' },
  pendente:       { l: 'Verif. pendente', c: 's-pendente' },
  'nao-verificado': { l: 'Não verificado', c: 's-aguardar' },
  suspenso:       { l: 'Suspenso',        c: 's-parado' },
};

/* ── Utils ──────────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hojeISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
// Semana atual (segunda a domingo), com deslocamento em semanas
function semana(offset = 0) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dow = (now.getDay() + 6) % 7;             // 0 = segunda
  const start = new Date(now); start.setDate(now.getDate() - dow + offset * 7);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const iso = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  return { start: iso(start), end: iso(end) };
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'gmn-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}
function stars(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<i class="bi bi-star${i <= n ? '-fill' : ''}" style="color:${i <= n ? 'var(--yellow)' : 'var(--text-muted)'};font-size:12px"></i>`;
  return h;
}
function copiar(texto) {
  navigator.clipboard.writeText(texto).then(() => toast('✅ Link copiado!')).catch(() => prompt('Copie o link:', texto));
}

/* ── Modal ──────────────────────────────────────────────────────────────── */
function openModal(html, width) {
  $('modal-root').innerHTML = `
    <div class="modal-overlay open" onclick="if(event.target===this)closeModal()">
      <div class="modal" ${width ? `style="width:${width}px"` : ''}>${html}</div>
    </div>`;
}
function closeModal() { $('modal-root').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ── Tema claro/escuro ──────────────────────────────────────────────────── */
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  const ic = $('theme-icon'), lb = $('theme-label');
  if (ic) ic.innerHTML = light ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon"></i>';
  if (lb) lb.textContent = light ? 'Escuro' : 'Claro';
}
function toggleTheme() {
  const light = !document.body.classList.contains('light');
  localStorage.setItem('gmn_theme', light ? 'light' : 'dark');
  applyTheme(light);
}
applyTheme(localStorage.getItem('gmn_theme') === 'light');

/* ── Mobile sidebar ─────────────────────────────────────────────────────── */
function toggleMobileSidebar() {
  document.querySelector('.sidebar').classList.toggle('mobile-open');
  $('mobile-overlay').classList.toggle('open');
}
function closeMobileSidebar() {
  document.querySelector('.sidebar').classList.remove('mobile-open');
  $('mobile-overlay').classList.remove('open');
}

/* ── Navegação ──────────────────────────────────────────────────────────── */
const PAGE_TITLES = {
  dashboard:  '<span>GMN</span> — Dashboard',
  perfis:     '<span>GMN</span> — Perfis',
  postagens:  '<span>GMN</span> — Postagens',
  avaliacoes: '<span>GMN</span> — Avaliações',
  ranking:    '<span>GMN</span> — Ranking no Mapa',
  tarefas:    '<span>Pessoal</span> — Minhas Tarefas',
};
function showPage(p) {
  currentPage = p;
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  const nav = $('nav-' + p); if (nav) nav.classList.add('active');
  document.querySelectorAll('.mob-nav-item').forEach((n) => n.classList.remove('active'));
  const mob = $('mob-' + p); if (mob) mob.classList.add('active');
  $('page-title').innerHTML = PAGE_TITLES[p] || p;
  closeMobileSidebar();
  render();
}
function render() {
  const fn = {
    dashboard: renderDashboard, perfis: renderPerfis, postagens: renderPostagens,
    avaliacoes: renderAvaliacoes, ranking: renderRanking, tarefas: renderTarefas,
  }[currentPage];
  if (fn) $('main-content').innerHTML = fn();
}

/* ── Carga inicial ──────────────────────────────────────────────────────── */
window.addEventListener('gmn-ready', async () => {
  $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)">Carregando dados…</div>';
  await reloadAll();
  showPage('dashboard');
});
async function reloadAll() {
  const [perfis, posts, avals, ranks, tarefas] = await Promise.all([
    dbList('gmn_perfis', 'createdAt'),
    dbList('gmn_posts', 'data', 'asc'),
    dbList('gmn_avaliacoes', 'data'),
    dbList('gmn_ranking', 'data'),
    dbList('gmn_tarefas', 'createdAt'),
  ]);
  S.perfis = perfis;
  S.posts = posts;
  S.avaliacoes = avals;
  S.rankings = ranks;
  S.tarefas = tarefas.filter((t) => t.userId === window.currentUser.uid);
}

/* ── Helpers de dados ───────────────────────────────────────────────────── */
const perfilById = (id) => S.perfis.find((p) => p.id === id);
const perfilNome = (id) => (perfilById(id) || {}).nome || '(perfil removido)';
function checklistPct(p) {
  const c = p.checklist || {};
  const done = CHECKLIST.filter((i) => c[i.k]).length;
  return Math.round((done / CHECKLIST.length) * 100);
}
function avalStats(perfilId) {
  const list = S.avaliacoes.filter((a) => a.perfilId === perfilId);
  const total = list.length;
  const media = total ? (list.reduce((s, a) => s + Number(a.nota || 0), 0) / total) : 0;
  const naoResp = list.filter((a) => !a.respondida).length;
  return { total, media, naoResp, list };
}
function postsDaSemana(perfilId, offset = 0) {
  const { start, end } = semana(offset);
  return S.posts.filter((p) => (!perfilId || p.perfilId === perfilId) && p.data >= start && p.data <= end);
}
const selectPerfis = (selecionado, incluirTodos) =>
  (incluirTodos ? `<option value="">Todos os perfis</option>` : `<option value="">Selecione o perfil…</option>`) +
  S.perfis.map((p) => `<option value="${p.id}" ${p.id === selecionado ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');

/* ═══════════════════════════════════ DASHBOARD ══════════════════════════ */
function renderDashboard() {
  const { start, end } = semana();
  const postsPend = S.posts.filter((p) => p.data >= start && p.data <= end && p.status !== 'feito');
  const naoResp = S.avaliacoes.filter((a) => !a.respondida).length;
  const checkMedio = S.perfis.length
    ? Math.round(S.perfis.reduce((s, p) => s + checklistPct(p), 0) / S.perfis.length) : 0;
  const tarefasPend = S.tarefas.filter((t) => t.status !== 'feito');
  const tarefasHoje = tarefasPend.filter((t) => t.data && t.data <= hojeISO());

  // Perfis que precisam de atenção
  const atencao = [];
  S.perfis.forEach((p) => {
    const motivos = [];
    if (postsDaSemana(p.id).length === 0) motivos.push('sem post nesta semana');
    const av = avalStats(p.id);
    if (av.naoResp > 0) motivos.push(`${av.naoResp} avaliação(ões) sem resposta`);
    const pct = checklistPct(p);
    if (pct < 100) motivos.push(`checklist ${pct}%`);
    if (p.status !== 'verificado') motivos.push(STATUS_PERFIL[p.status]?.l || 'verificação pendente');
    if (motivos.length) atencao.push({ p, motivos });
  });
  atencao.sort((a, b) => b.motivos.length - a.motivos.length);

  return `<div class="page-wrap">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Perfis GMN</div><div class="stat-val">${S.perfis.length}</div></div>
      <div class="stat-card"><div class="stat-label">Checklist médio</div><div class="stat-val ${checkMedio >= 80 ? 'green' : ''}">${checkMedio}%</div></div>
      <div class="stat-card"><div class="stat-label">Posts pendentes (semana)</div><div class="stat-val ${postsPend.length ? '' : 'green'}">${postsPend.length}</div></div>
      <div class="stat-card"><div class="stat-label">Avaliações s/ resposta</div><div class="stat-val ${naoResp ? '' : 'green'}">${naoResp}</div></div>
      <div class="stat-card"><div class="stat-label">Tarefas pendentes</div><div class="stat-val blue">${tarefasPend.length}</div></div>
    </div>

    <div class="gmn-dash-cols">
      <div class="gmn-panel">
        <div class="gmn-panel-title"><i class="bi bi-exclamation-triangle" style="color:var(--yellow)"></i> Perfis que precisam de atenção</div>
        ${atencao.length === 0
          ? `<div class="gmn-empty">🎉 Tudo em dia! Nenhum perfil precisa de atenção.</div>`
          : atencao.map(({ p, motivos }) => `
            <div class="gmn-atencao-item" onclick="openPerfilDetalhe('${p.id}')">
              <div>
                <div style="font-weight:600;font-size:13px">${esc(p.nome)}</div>
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${motivos.map(esc).join(' · ')}</div>
              </div>
              <i class="bi bi-chevron-right" style="color:var(--text-muted)"></i>
            </div>`).join('')}
      </div>

      <div class="gmn-panel">
        <div class="gmn-panel-title"><i class="bi bi-check2-square" style="color:var(--accent)"></i> Minhas tarefas de hoje</div>
        ${tarefasHoje.length === 0
          ? `<div class="gmn-empty">Nenhuma tarefa para hoje. <span style="color:var(--accent);cursor:pointer" onclick="openTarefaModal()">+ Nova tarefa</span></div>`
          : tarefasHoje.map((t) => `
            <div class="gmn-atencao-item">
              <div style="display:flex;align-items:center;gap:10px;flex:1">
                <input type="checkbox" class="task-check" onchange="moveTarefa('${t.id}','feito')">
                <div>
                  <div style="font-weight:600;font-size:13px">${esc(t.titulo)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${fmtData(t.data)} · ${esc(t.categoria || 'geral')}</div>
                </div>
              </div>
              ${t.prioridade === 'alta' ? '<span class="badge s-parado">Alta</span>' : ''}
            </div>`).join('')}
      </div>
    </div>

    <div class="gmn-panel" style="margin-top:16px">
      <div class="gmn-panel-title"><i class="bi bi-calendar2-week" style="color:var(--accent2)"></i> Postagens desta semana (${fmtData(start)} – ${fmtData(end)})</div>
      ${renderListaPosts(S.posts.filter((p) => p.data >= start && p.data <= end), true)}
    </div>
  </div>`;
}

/* ═══════════════════════════════════ PERFIS ═════════════════════════════ */
function renderPerfis() {
  const busca = F.buscaPerfis.toLowerCase();
  let lista = S.perfis.filter((p) =>
    (!busca || `${p.nome} ${p.cliente} ${p.cidade} ${p.categoria}`.toLowerCase().includes(busca)) &&
    (!F.statusPerfis || p.status === F.statusPerfis));

  const verif = S.perfis.filter((p) => p.status === 'verificado').length;

  return `<div class="page-wrap">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Total de perfis</div><div class="stat-val">${S.perfis.length}</div></div>
      <div class="stat-card"><div class="stat-label">Verificados</div><div class="stat-val green">${verif}</div></div>
      <div class="stat-card"><div class="stat-label">Pendentes</div><div class="stat-val">${S.perfis.length - verif}</div></div>
    </div>
    <div class="toolbar">
      <input type="text" placeholder="🔍 Buscar perfil, cliente, cidade…" value="${esc(F.buscaPerfis)}" oninput="F.buscaPerfis=this.value;render()">
      <select onchange="F.statusPerfis=this.value;render()">
        <option value="">Todos os status</option>
        ${Object.entries(STATUS_PERFIL).map(([k, v]) => `<option value="${k}" ${F.statusPerfis === k ? 'selected' : ''}>${v.l}</option>`).join('')}
      </select>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="openPerfilModal()">+ Novo Perfil</button>
    </div>
    ${lista.length === 0
      ? `<div class="gmn-empty" style="padding:60px 20px;text-align:center">Nenhum perfil ${S.perfis.length ? 'encontrado com esse filtro' : 'cadastrado ainda'}.<br><br><button class="btn btn-primary" onclick="openPerfilModal()">+ Cadastrar primeiro perfil</button></div>`
      : `<div class="gmn-grid">${lista.map(cardPerfil).join('')}</div>`}
  </div>`;
}

function cardPerfil(p) {
  const pct = checklistPct(p);
  const st = STATUS_PERFIL[p.status] || STATUS_PERFIL['nao-verificado'];
  const av = avalStats(p.id);
  const postsSem = postsDaSemana(p.id).length;
  return `
  <div class="gmn-card" onclick="openPerfilDetalhe('${p.id}')">
    <div class="gmn-card-top">
      <div>
        <div class="gmn-card-nome">${esc(p.nome)}</div>
        <div class="gmn-card-sub">${esc(p.categoria || '—')}${p.cidade ? ' · ' + esc(p.cidade) : ''}</div>
      </div>
      <span class="badge ${st.c}">${st.l}</span>
    </div>
    ${p.cliente ? `<div class="gmn-card-cliente"><i class="bi bi-person"></i> ${esc(p.cliente)}</div>` : ''}
    <div class="gmn-progress-wrap" title="Checklist de otimização">
      <div class="gmn-progress"><div class="gmn-progress-fill ${pct === 100 ? 'full' : ''}" style="width:${pct}%"></div></div>
      <span class="gmn-progress-label">${pct}%</span>
    </div>
    <div class="gmn-card-footer">
      <span title="Avaliações">${stars(Math.round(av.media))} <b style="font-size:11px">${av.media ? av.media.toFixed(1) : '—'}</b> (${av.total})</span>
      <span style="font-size:11px;color:${postsSem ? 'var(--green)' : 'var(--yellow)'}" title="Posts nesta semana"><i class="bi bi-calendar2-week"></i> ${postsSem} post${postsSem === 1 ? '' : 's'}</span>
    </div>
  </div>`;
}

// Detalhe do perfil: dados + checklist + atalhos
function openPerfilDetalhe(id) {
  const p = perfilById(id); if (!p) return;
  const pct = checklistPct(p);
  const st = STATUS_PERFIL[p.status] || STATUS_PERFIL['nao-verificado'];
  const av = avalStats(id);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${esc(p.nome)} <span class="badge ${st.c}" style="margin-left:8px">${st.l}</span></div>
      <button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div><div class="detail-label" style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Cliente</div><div style="font-size:13px">${esc(p.cliente || '—')}</div></div>
      <div><div class="detail-label" style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Categoria</div><div style="font-size:13px">${esc(p.categoria || '—')}</div></div>
      <div><div class="detail-label" style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Cidade</div><div style="font-size:13px">${esc(p.cidade || '—')}</div></div>
      <div><div class="detail-label" style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Telefone</div><div style="font-size:13px">${esc(p.telefone || '—')}</div></div>
      <div><div class="detail-label" style="font-size:10px;color:var(--text-muted);text-transform:uppercase">E-mail de acesso</div><div style="font-size:13px">${esc(p.emailAcesso || '—')}</div></div>
      <div><div class="detail-label" style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Avaliações</div><div style="font-size:13px">${av.media ? av.media.toFixed(1) + ' ★' : '—'} (${av.total})</div></div>
    </div>
    ${p.obs ? `<div style="font-size:12px;color:var(--text-secondary);background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:14px;white-space:pre-wrap">${esc(p.obs)}</div>` : ''}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">
      ${p.linkPerfil ? `<a class="btn btn-ghost" style="font-size:11.5px;text-decoration:none" href="${esc(p.linkPerfil)}" target="_blank"><i class="bi bi-geo-alt"></i> Abrir no Maps</a>` : ''}
      ${p.linkAvaliacao ? `<button class="btn btn-ghost" style="font-size:11.5px" onclick="copiar('${esc(p.linkAvaliacao)}')"><i class="bi bi-link-45deg"></i> Copiar link de avaliação</button>` : ''}
      <button class="btn btn-ghost" style="font-size:11.5px" onclick="closeModal();F.perfilAval='${p.id}';showPage('avaliacoes')"><i class="bi bi-star"></i> Avaliações</button>
      <button class="btn btn-ghost" style="font-size:11.5px" onclick="closeModal();F.perfilRank='${p.id}';showPage('ranking')"><i class="bi bi-graph-up-arrow"></i> Ranking</button>
      <button class="btn btn-ghost" style="font-size:11.5px" onclick="closeModal();F.perfilPosts='${p.id}';showPage('postagens')"><i class="bi bi-calendar2-week"></i> Posts</button>
    </div>
    <div class="gmn-panel-title" style="margin-bottom:10px">Checklist de otimização
      <span style="font-family:var(--mono);font-size:12px;color:${pct === 100 ? 'var(--green)' : 'var(--accent)'}">${pct}%</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto" id="checklist-box">
      ${CHECKLIST.map((i) => {
        const done = (p.checklist || {})[i.k];
        return `<label class="checklist-item ${done ? 'done' : ''}">
          <input type="checkbox" class="task-check" ${done ? 'checked' : ''} onchange="toggleCheck('${p.id}','${i.k}',this.checked)">
          <span class="check-label">${i.l}</span>
        </label>`;
      }).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="delPerfil('${p.id}')"><i class="bi bi-trash"></i> Excluir</button>
      <div style="flex:1"></div>
      <button class="btn btn-ghost" onclick="closeModal()">Fechar</button>
      <button class="btn btn-primary" onclick="openPerfilModal('${p.id}')"><i class="bi bi-pencil"></i> Editar dados</button>
    </div>`, 640);
}

async function toggleCheck(perfilId, key, val) {
  const p = perfilById(perfilId); if (!p) return;
  p.checklist = p.checklist || {};
  p.checklist[key] = val;
  await dbSave('gmn_perfis', { id: p.id, checklist: p.checklist });
  render();
}

function openPerfilModal(id) {
  const p = id ? perfilById(id) : {};
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id ? 'Editar perfil' : 'Novo perfil GMN'}</div>
      <button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row form-full" style="grid-column:1/-1"><label>Nome do negócio *</label><input id="pf-nome" value="${esc(p.nome || '')}" placeholder="Ex.: Ótica Visão Clara"></div>
      <div class="form-row"><label>Cliente</label><input id="pf-cliente" value="${esc(p.cliente || '')}" placeholder="Nome do cliente"></div>
      <div class="form-row"><label>Categoria principal</label><input id="pf-categoria" value="${esc(p.categoria || '')}" placeholder="Ex.: Ótica"></div>
      <div class="form-row"><label>Cidade</label><input id="pf-cidade" value="${esc(p.cidade || '')}" placeholder="Ex.: Florianópolis/SC"></div>
      <div class="form-row"><label>Telefone / WhatsApp</label><input id="pf-telefone" value="${esc(p.telefone || '')}" placeholder="(48) 9…"></div>
      <div class="form-row"><label>Status de verificação</label>
        <select id="pf-status">${Object.entries(STATUS_PERFIL).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.l}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>E-mail de acesso (conta Google)</label><input id="pf-email" value="${esc(p.emailAcesso || '')}" placeholder="conta@gmail.com"></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Link do perfil (Google Maps)</label><input id="pf-link" value="${esc(p.linkPerfil || '')}" placeholder="https://maps.google.com/…"></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Link para pedir avaliação</label><input id="pf-linkaval" value="${esc(p.linkAvaliacao || '')}" placeholder="https://g.page/r/…/review"></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Observações</label><textarea id="pf-obs" placeholder="Anotações internas sobre este perfil…">${esc(p.obs || '')}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="savePerfil('${id || ''}')">${id ? 'Salvar alterações' : 'Cadastrar perfil'}</button>
    </div>`, 640);
}

async function savePerfil(id) {
  const nome = $('pf-nome').value.trim();
  if (!nome) { alert('Informe o nome do negócio.'); return; }
  const data = {
    nome,
    cliente: $('pf-cliente').value.trim(),
    categoria: $('pf-categoria').value.trim(),
    cidade: $('pf-cidade').value.trim(),
    telefone: $('pf-telefone').value.trim(),
    status: $('pf-status').value,
    emailAcesso: $('pf-email').value.trim(),
    linkPerfil: $('pf-link').value.trim(),
    linkAvaliacao: $('pf-linkaval').value.trim(),
    obs: $('pf-obs').value.trim(),
  };
  if (id) data.id = id;
  const ok = await dbSave('gmn_perfis', data);
  if (ok) { closeModal(); await reloadAll(); render(); toast(id ? '✅ Perfil atualizado' : '✅ Perfil cadastrado'); }
}

async function delPerfil(id) {
  if (!confirm('Excluir este perfil e manter posts/avaliações/ranking órfãos?\nEssa ação não pode ser desfeita.')) return;
  await dbDelete('gmn_perfis', id);
  closeModal(); await reloadAll(); render(); toast('Perfil excluído');
}

/* ═══════════════════════════════════ POSTAGENS ══════════════════════════ */
function renderPostagens() {
  const { start, end } = semana();
  const prox = semana(1);
  const filtro = (p) => (!F.perfilPosts || p.perfilId === F.perfilPosts) && (!F.statusPosts || (p.status || 'planejado') === F.statusPosts);

  const estaSemana = S.posts.filter((p) => filtro(p) && p.data >= start && p.data <= end);
  const proxSemana = S.posts.filter((p) => filtro(p) && p.data >= prox.start && p.data <= prox.end);
  const atrasados  = S.posts.filter((p) => filtro(p) && p.data < start && p.status !== 'feito');
  const futuros    = S.posts.filter((p) => filtro(p) && p.data > prox.end);
  const anteriores = S.posts.filter((p) => filtro(p) && p.data < start && p.status === 'feito').reverse().slice(0, 30);

  const semPost = S.perfis.filter((pf) => postsDaSemana(pf.id).length === 0);
  const feitos = estaSemana.filter((p) => p.status === 'feito').length;

  return `<div class="page-wrap">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Posts esta semana</div><div class="stat-val">${estaSemana.length}</div></div>
      <div class="stat-card"><div class="stat-label">Já publicados</div><div class="stat-val green">${feitos}</div></div>
      <div class="stat-card"><div class="stat-label">Atrasados</div><div class="stat-val ${atrasados.length ? '' : 'green'}">${atrasados.length}</div></div>
      <div class="stat-card"><div class="stat-label">Perfis sem post na semana</div><div class="stat-val ${semPost.length ? '' : 'green'}">${semPost.length}</div></div>
    </div>
    <div class="toolbar">
      <select onchange="F.perfilPosts=this.value;render()">${selectPerfis(F.perfilPosts, true)}</select>
      <select onchange="F.statusPosts=this.value;render()">
        <option value="">Todos</option>
        <option value="planejado" ${F.statusPosts === 'planejado' ? 'selected' : ''}>Planejados</option>
        <option value="feito" ${F.statusPosts === 'feito' ? 'selected' : ''}>Publicados</option>
      </select>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="openPostModal()">+ Novo Post</button>
    </div>

    ${semPost.length && !F.perfilPosts ? `
      <div class="gmn-alert"><i class="bi bi-exclamation-triangle"></i> Sem post nesta semana:
        ${semPost.map((p) => `<span class="gmn-chip" onclick="openPostModal(null,'${p.id}')" title="Criar post para ${esc(p.nome)}">${esc(p.nome)} +</span>`).join('')}
      </div>` : ''}

    ${atrasados.length ? `<div class="gmn-panel" style="border-color:rgba(245,54,92,.35)"><div class="gmn-panel-title" style="color:var(--red)"><i class="bi bi-alarm"></i> Atrasados</div>${renderListaPosts(atrasados)}</div>` : ''}
    <div class="gmn-panel"><div class="gmn-panel-title"><i class="bi bi-calendar2-week" style="color:var(--accent)"></i> Esta semana (${fmtData(start)} – ${fmtData(end)})</div>${renderListaPosts(estaSemana, true)}</div>
    <div class="gmn-panel"><div class="gmn-panel-title"><i class="bi bi-calendar2-plus" style="color:var(--accent3)"></i> Próxima semana</div>${renderListaPosts(proxSemana, true)}</div>
    ${futuros.length ? `<div class="gmn-panel"><div class="gmn-panel-title"><i class="bi bi-calendar2"></i> Mais adiante</div>${renderListaPosts(futuros)}</div>` : ''}
    ${anteriores.length ? `<div class="gmn-panel"><div class="gmn-panel-title" style="color:var(--text-muted)"><i class="bi bi-clock-history"></i> Publicados anteriormente</div>${renderListaPosts(anteriores)}</div>` : ''}
  </div>`;
}

function renderListaPosts(lista, mostrarVazio) {
  if (!lista.length) return mostrarVazio ? `<div class="gmn-empty">Nenhum post por aqui. <span style="color:var(--accent);cursor:pointer" onclick="openPostModal()">+ Planejar post</span></div>` : '';
  return lista.map((p) => {
    const feito = p.status === 'feito';
    return `
    <div class="gmn-post-row ${feito ? 'feito' : ''}">
      <input type="checkbox" class="task-check" ${feito ? 'checked' : ''} onchange="togglePostFeito('${p.id}')" title="${feito ? 'Publicado' : 'Marcar como publicado'}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:12.5px;${feito ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${esc(p.titulo)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${esc(perfilNome(p.perfilId))} · ${fmtData(p.data)}</div>
      </div>
      <span class="badge ${feito ? 's-feito' : 's-pendente'}">${feito ? 'Publicado' : TIPOS_POST[p.tipo] || 'Planejado'}</span>
      <button class="icon-btn" onclick="openPostModal('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
      <button class="icon-btn" onclick="delPost('${p.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
    </div>`;
  }).join('');
}

function openPostModal(id, perfilPre) {
  const p = id ? S.posts.find((x) => x.id === id) : { perfilId: perfilPre || F.perfilPosts || '', data: hojeISO() };
  if (!S.perfis.length) { alert('Cadastre um perfil GMN primeiro.'); return; }
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id ? 'Editar post' : 'Planejar post'}</div>
      <button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row form-full" style="grid-column:1/-1"><label>Perfil *</label><select id="po-perfil">${selectPerfis(p.perfilId)}</select></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Título / assunto do post *</label><input id="po-titulo" value="${esc(p.titulo || '')}" placeholder="Ex.: Promoção de armações — 30% off"></div>
      <div class="form-row"><label>Tipo</label>
        <select id="po-tipo">${Object.entries(TIPOS_POST).map(([k, v]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>Data planejada *</label><input id="po-data" type="date" value="${esc(p.data || hojeISO())}"></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Notas / legenda</label><textarea id="po-notas" placeholder="Texto do post, CTA, imagem a usar…">${esc(p.notas || '')}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="savePost('${id || ''}')">${id ? 'Salvar' : 'Planejar post'}</button>
    </div>`);
}

async function savePost(id) {
  const perfilId = $('po-perfil').value, titulo = $('po-titulo').value.trim(), data = $('po-data').value;
  if (!perfilId || !titulo || !data) { alert('Preencha perfil, título e data.'); return; }
  const d = { perfilId, titulo, data, tipo: $('po-tipo').value, notas: $('po-notas').value.trim() };
  if (id) d.id = id; else d.status = 'planejado';
  const ok = await dbSave('gmn_posts', d);
  if (ok) { closeModal(); await reloadAll(); render(); toast('✅ Post salvo'); }
}

async function togglePostFeito(id) {
  const p = S.posts.find((x) => x.id === id); if (!p) return;
  await dbSave('gmn_posts', { id, status: p.status === 'feito' ? 'planejado' : 'feito' });
  await reloadAll(); render();
}

async function delPost(id) {
  if (!confirm('Excluir este post?')) return;
  await dbDelete('gmn_posts', id);
  await reloadAll(); render(); toast('Post excluído');
}

/* ═══════════════════════════════════ AVALIAÇÕES ═════════════════════════ */
function renderAvaliacoes() {
  const perfil = F.perfilAval ? perfilById(F.perfilAval) : null;
  let lista = S.avaliacoes.filter((a) =>
    (!F.perfilAval || a.perfilId === F.perfilAval) && (!F.soNaoRespondidas || !a.respondida));

  const st = perfil ? avalStats(perfil.id) : {
    total: S.avaliacoes.length,
    media: S.avaliacoes.length ? S.avaliacoes.reduce((s, a) => s + Number(a.nota || 0), 0) / S.avaliacoes.length : 0,
    naoResp: S.avaliacoes.filter((a) => !a.respondida).length,
  };

  return `<div class="page-wrap">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Avaliações registradas</div><div class="stat-val">${st.total}</div></div>
      <div class="stat-card"><div class="stat-label">Nota média</div><div class="stat-val ${st.media >= 4.5 ? 'green' : ''}">${st.media ? st.media.toFixed(1) : '—'}</div></div>
      <div class="stat-card"><div class="stat-label">Sem resposta</div><div class="stat-val ${st.naoResp ? '' : 'green'}">${st.naoResp}</div></div>
    </div>
    <div class="toolbar">
      <select onchange="F.perfilAval=this.value;render()">${selectPerfis(F.perfilAval, true)}</select>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer">
        <input type="checkbox" class="task-check" ${F.soNaoRespondidas ? 'checked' : ''} onchange="F.soNaoRespondidas=this.checked;render()"> Só não respondidas
      </label>
      <div style="flex:1"></div>
      ${perfil && perfil.linkAvaliacao ? `<button class="btn btn-ghost" onclick="copiar('${esc(perfil.linkAvaliacao)}')"><i class="bi bi-link-45deg"></i> Copiar link de avaliação</button>` : ''}
      <button class="btn btn-primary" onclick="openAvalModal()">+ Registrar avaliação</button>
    </div>
    ${lista.length === 0
      ? `<div class="gmn-empty" style="padding:50px;text-align:center">Nenhuma avaliação registrada${F.perfilAval ? ' para este perfil' : ''}.</div>`
      : `<div class="table-wrap"><table class="clients-table">
          <thead><tr><th>Data</th><th>Perfil</th><th>Autor</th><th>Nota</th><th>Comentário</th><th>Status</th><th></th></tr></thead>
          <tbody>${lista.map((a) => `
            <tr>
              <td style="white-space:nowrap">${fmtData(a.data)}</td>
              <td>${esc(perfilNome(a.perfilId))}</td>
              <td>${esc(a.autor || '—')}</td>
              <td style="white-space:nowrap">${stars(Number(a.nota || 0))}</td>
              <td style="max-width:320px;font-size:11.5px;color:var(--text-secondary)">${esc(a.texto || '—')}</td>
              <td><span class="badge ${a.respondida ? 's-feito' : 's-pendente'}" style="cursor:pointer" onclick="toggleAvalResp('${a.id}')" title="Clique para alternar">${a.respondida ? 'Respondida' : 'Responder!'}</span></td>
              <td style="white-space:nowrap">
                <button class="icon-btn" onclick="openAvalModal('${a.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="icon-btn" onclick="delAval('${a.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`).join('')}</tbody>
        </table></div>`}
  </div>`;
}

function openAvalModal(id) {
  const a = id ? S.avaliacoes.find((x) => x.id === id) : { perfilId: F.perfilAval || '', data: hojeISO(), nota: 5 };
  if (!S.perfis.length) { alert('Cadastre um perfil GMN primeiro.'); return; }
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id ? 'Editar avaliação' : 'Registrar avaliação'}</div>
      <button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row form-full" style="grid-column:1/-1"><label>Perfil *</label><select id="av-perfil">${selectPerfis(a.perfilId)}</select></div>
      <div class="form-row"><label>Autor</label><input id="av-autor" value="${esc(a.autor || '')}" placeholder="Nome de quem avaliou"></div>
      <div class="form-row"><label>Data</label><input id="av-data" type="date" value="${esc(a.data || hojeISO())}"></div>
      <div class="form-row"><label>Nota *</label>
        <select id="av-nota">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${Number(a.nota) === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>Já foi respondida?</label>
        <select id="av-resp"><option value="">Não</option><option value="1" ${a.respondida ? 'selected' : ''}>Sim</option></select>
      </div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Comentário do cliente</label><textarea id="av-texto">${esc(a.texto || '')}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAval('${id || ''}')">Salvar</button>
    </div>`);
}

async function saveAval(id) {
  const perfilId = $('av-perfil').value;
  if (!perfilId) { alert('Selecione o perfil.'); return; }
  const d = {
    perfilId,
    autor: $('av-autor').value.trim(),
    data: $('av-data').value || hojeISO(),
    nota: Number($('av-nota').value),
    respondida: !!$('av-resp').value,
    texto: $('av-texto').value.trim(),
  };
  if (id) d.id = id;
  const ok = await dbSave('gmn_avaliacoes', d);
  if (ok) { closeModal(); await reloadAll(); render(); toast('✅ Avaliação salva'); }
}

async function toggleAvalResp(id) {
  const a = S.avaliacoes.find((x) => x.id === id); if (!a) return;
  await dbSave('gmn_avaliacoes', { id, respondida: !a.respondida });
  await reloadAll(); render();
}

async function delAval(id) {
  if (!confirm('Excluir esta avaliação?')) return;
  await dbDelete('gmn_avaliacoes', id);
  await reloadAll(); render();
}

/* ═══════════════════════════════════ RANKING ════════════════════════════ */
function renderRanking() {
  let lista = S.rankings.filter((r) => !F.perfilRank || r.perfilId === F.perfilRank);

  // Agrupa por perfil + palavra-chave; mais recente primeiro
  const grupos = {};
  lista.forEach((r) => {
    const key = r.perfilId + '||' + (r.palavra || '').toLowerCase();
    (grupos[key] = grupos[key] || []).push(r);
  });
  Object.values(grupos).forEach((g) => g.sort((a, b) => (b.data || '').localeCompare(a.data || '')));
  const linhas = Object.values(grupos).map((g) => {
    const atual = g[0], anterior = g[1];
    let trend = '<span style="color:var(--text-muted)">—</span>';
    if (anterior) {
      const diff = Number(anterior.posicao) - Number(atual.posicao);
      if (diff > 0) trend = `<span style="color:var(--green)"><i class="bi bi-arrow-up"></i> +${diff}</span>`;
      else if (diff < 0) trend = `<span style="color:var(--red)"><i class="bi bi-arrow-down"></i> ${diff}</span>`;
      else trend = `<span style="color:var(--text-muted)"><i class="bi bi-dash"></i> estável</span>`;
    }
    return { atual, anterior, trend, historico: g };
  }).sort((a, b) => Number(a.atual.posicao) - Number(b.atual.posicao));

  const top3 = linhas.filter((l) => Number(l.atual.posicao) <= 3).length;

  return `<div class="page-wrap">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Palavras monitoradas</div><div class="stat-val">${linhas.length}</div></div>
      <div class="stat-card"><div class="stat-label">No top 3 do mapa</div><div class="stat-val green">${top3}</div></div>
      <div class="stat-card"><div class="stat-label">Registros no total</div><div class="stat-val blue">${lista.length}</div></div>
    </div>
    <div class="toolbar">
      <select onchange="F.perfilRank=this.value;render()">${selectPerfis(F.perfilRank, true)}</select>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="openRankModal()">+ Registrar posição</button>
    </div>
    ${linhas.length === 0
      ? `<div class="gmn-empty" style="padding:50px;text-align:center">Nenhum registro de posição ainda.<br>Registre a posição do cliente nas buscas locais e acompanhe a evolução aqui.</div>`
      : `<div class="table-wrap"><table class="clients-table">
          <thead><tr><th>Perfil</th><th>Palavra-chave</th><th>Posição atual</th><th>Evolução</th><th>Última checagem</th><th>Histórico</th><th></th></tr></thead>
          <tbody>${linhas.map((l) => `
            <tr>
              <td>${esc(perfilNome(l.atual.perfilId))}</td>
              <td style="font-weight:600">${esc(l.atual.palavra)}</td>
              <td><span class="gmn-pos ${Number(l.atual.posicao) <= 3 ? 'top' : ''}">#${esc(l.atual.posicao)}</span></td>
              <td>${l.trend}</td>
              <td style="white-space:nowrap">${fmtData(l.atual.data)}</td>
              <td style="font-size:11px;color:var(--text-muted)">${l.historico.slice(0, 6).map((h) => '#' + h.posicao).join(' ← ')}</td>
              <td style="white-space:nowrap">
                <button class="icon-btn" onclick="openRankModal(null,'${l.atual.perfilId}','${esc(l.atual.palavra)}')" title="Nova checagem desta palavra"><i class="bi bi-plus-lg"></i></button>
                <button class="icon-btn" onclick="delRank('${l.atual.id}')" title="Excluir último registro"><i class="bi bi-trash"></i></button>
              </td>
            </tr>`).join('')}</tbody>
        </table></div>`}
  </div>`;
}

function openRankModal(id, perfilPre, palavraPre) {
  if (!S.perfis.length) { alert('Cadastre um perfil GMN primeiro.'); return; }
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Registrar posição no mapa</div>
      <button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row form-full" style="grid-column:1/-1"><label>Perfil *</label><select id="rk-perfil">${selectPerfis(perfilPre || F.perfilRank)}</select></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Palavra-chave pesquisada *</label><input id="rk-palavra" value="${esc(palavraPre || '')}" placeholder="Ex.: ótica florianópolis"></div>
      <div class="form-row"><label>Posição no resultado *</label><input id="rk-pos" type="number" min="1" max="100" placeholder="Ex.: 3"></div>
      <div class="form-row"><label>Data da checagem</label><input id="rk-data" type="date" value="${hojeISO()}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveRank()">Registrar</button>
    </div>`);
}

async function saveRank() {
  const perfilId = $('rk-perfil').value, palavra = $('rk-palavra').value.trim(), pos = $('rk-pos').value;
  if (!perfilId || !palavra || !pos) { alert('Preencha perfil, palavra-chave e posição.'); return; }
  const ok = await dbSave('gmn_ranking', { perfilId, palavra, posicao: Number(pos), data: $('rk-data').value || hojeISO() });
  if (ok) { closeModal(); await reloadAll(); render(); toast('✅ Posição registrada'); }
}

async function delRank(id) {
  if (!confirm('Excluir este registro de posição?')) return;
  await dbDelete('gmn_ranking', id);
  await reloadAll(); render();
}

/* ═══════════════════════════════════ TAREFAS ════════════════════════════ */
const CATS_TAREFA = { gmn: 'GMN / Clientes', trabalho: 'Trabalho', pessoal: 'Pessoal' };
const COLS_TAREFA = [
  { k: 'pendente', l: 'A fazer', icon: 'bi-circle', cor: 'var(--yellow)' },
  { k: 'fazendo',  l: 'Fazendo', icon: 'bi-play-circle', cor: 'var(--blue)' },
  { k: 'feito',    l: 'Feito',   icon: 'bi-check-circle', cor: 'var(--green)' },
];

function renderTarefas() {
  const lista = S.tarefas.filter((t) => !F.catTarefa || t.categoria === F.catTarefa);
  const atrasadas = lista.filter((t) => t.status !== 'feito' && t.data && t.data < hojeISO()).length;

  return `<div class="page-wrap">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Pendentes</div><div class="stat-val">${lista.filter((t) => t.status !== 'feito').length}</div></div>
      <div class="stat-card"><div class="stat-label">Atrasadas</div><div class="stat-val ${atrasadas ? '' : 'green'}">${atrasadas}</div></div>
      <div class="stat-card"><div class="stat-label">Concluídas</div><div class="stat-val green">${lista.filter((t) => t.status === 'feito').length}</div></div>
    </div>
    <div class="toolbar">
      <select onchange="F.catTarefa=this.value;render()">
        <option value="">Todas as categorias</option>
        ${Object.entries(CATS_TAREFA).map(([k, v]) => `<option value="${k}" ${F.catTarefa === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="openTarefaModal()">+ Nova Tarefa</button>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin:-8px 0 14px"><i class="bi bi-shield-lock"></i> Suas tarefas são visíveis apenas para você.</div>
    <div class="gmn-kanban">
      ${COLS_TAREFA.map((col) => {
        const items = lista.filter((t) => (t.status || 'pendente') === col.k)
          .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));
        return `
        <div class="gmn-kanban-col">
          <div class="gmn-kanban-head" style="color:${col.cor}"><i class="bi ${col.icon}"></i> ${col.l} <span class="gmn-kanban-count">${items.length}</span></div>
          ${items.map((t) => cardTarefa(t, col.k)).join('') || '<div class="gmn-empty" style="font-size:11.5px;padding:14px">Vazio</div>'}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function cardTarefa(t, colKey) {
  const atrasada = t.status !== 'feito' && t.data && t.data < hojeISO();
  const mover = COLS_TAREFA.filter((c) => c.k !== colKey);
  return `
  <div class="gmn-tarefa ${t.status === 'feito' ? 'feita' : ''}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="font-weight:600;font-size:12.5px;flex:1">${esc(t.titulo)}</div>
      ${t.prioridade === 'alta' ? '<span class="badge s-parado" style="font-size:9.5px">Alta</span>' : t.prioridade === 'baixa' ? '<span class="badge s-aguardar" style="font-size:9.5px">Baixa</span>' : ''}
    </div>
    ${t.descricao ? `<div style="font-size:11.5px;color:var(--text-secondary);margin-top:4px;white-space:pre-wrap">${esc(t.descricao)}</div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:10.5px;color:${atrasada ? 'var(--red)' : 'var(--text-muted)'}">
      ${t.data ? `<span><i class="bi bi-calendar3"></i> ${fmtData(t.data)}${atrasada ? ' · atrasada' : ''}</span>` : ''}
      <span>${CATS_TAREFA[t.categoria] || ''}</span>
      <div style="flex:1"></div>
      ${mover.map((c) => `<button class="icon-btn" style="font-size:12px" onclick="moveTarefa('${t.id}','${c.k}')" title="Mover para ${c.l}"><i class="bi ${c.icon}" style="color:${c.cor}"></i></button>`).join('')}
      <button class="icon-btn" style="font-size:12px" onclick="openTarefaModal('${t.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
      <button class="icon-btn" style="font-size:12px" onclick="delTarefa('${t.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
    </div>
  </div>`;
}

function openTarefaModal(id) {
  const t = id ? S.tarefas.find((x) => x.id === id) : { data: hojeISO(), categoria: 'gmn' };
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${id ? 'Editar tarefa' : 'Nova tarefa'}</div>
      <button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row form-full" style="grid-column:1/-1"><label>Título *</label><input id="tf-titulo" value="${esc(t.titulo || '')}" placeholder="O que precisa ser feito?"></div>
      <div class="form-row"><label>Categoria</label>
        <select id="tf-cat">${Object.entries(CATS_TAREFA).map(([k, v]) => `<option value="${k}" ${t.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>Prioridade</label>
        <select id="tf-prio">
          <option value="normal" ${t.prioridade === 'normal' || !t.prioridade ? 'selected' : ''}>Normal</option>
          <option value="alta" ${t.prioridade === 'alta' ? 'selected' : ''}>Alta</option>
          <option value="baixa" ${t.prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
        </select>
      </div>
      <div class="form-row"><label>Data</label><input id="tf-data" type="date" value="${esc(t.data || '')}"></div>
      <div class="form-row form-full" style="grid-column:1/-1"><label>Descrição</label><textarea id="tf-desc" style="min-height:70px">${esc(t.descricao || '')}</textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveTarefa('${id || ''}')">Salvar</button>
    </div>`);
}

async function saveTarefa(id) {
  const titulo = $('tf-titulo').value.trim();
  if (!titulo) { alert('Informe o título da tarefa.'); return; }
  const d = {
    titulo,
    categoria: $('tf-cat').value,
    prioridade: $('tf-prio').value,
    data: $('tf-data').value,
    descricao: $('tf-desc').value.trim(),
    userId: window.currentUser.uid,
  };
  if (id) d.id = id; else d.status = 'pendente';
  const ok = await dbSave('gmn_tarefas', d);
  if (ok) { closeModal(); await reloadAll(); render(); toast('✅ Tarefa salva'); }
}

async function moveTarefa(id, status) {
  await dbSave('gmn_tarefas', { id, status });
  await reloadAll(); render();
  if (status === 'feito') toast('✅ Tarefa concluída!');
}

async function delTarefa(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  await dbDelete('gmn_tarefas', id);
  await reloadAll(); render();
}
