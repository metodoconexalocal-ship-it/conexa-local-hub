/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Módulos de Google Meu Negócio
   Páginas: gmn-dashboard · gmn-perfis · gmn-postagens · gmn-avaliacoes · gmn-ranking
   Integra-se ao app.js (clonado do DC HUB) via showPage() → GMN.route(page).
   Coleções: gmn_perfis, gmn_posts, gmn_avaliacoes, gmn_ranking
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const GMN = {};
  window.GMN = GMN;

  /* ── Estado ─────────────────────────────────────────────────────────────── */
  const S = { perfis: [], posts: [], avaliacoes: [], rankings: [], loaded: false };
  const F = { buscaPerfis: '', statusPerfis: '', perfilPosts: '', statusPosts: '', perfilAval: '', soNaoRespondidas: false, perfilRank: '' };
  let pagina = 'gmn-dashboard';

  /* ── Checklist padrão de otimização ─────────────────────────────────────── */
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
    verificado:       { l: 'Verificado',      c: 's-feito' },
    pendente:         { l: 'Verif. pendente', c: 's-pendente' },
    'nao-verificado': { l: 'Não verificado',  c: 's-aguardar' },
    suspenso:         { l: 'Suspenso',        c: 's-parado' },
  };

  /* ── Utils ──────────────────────────────────────────────────────────────── */
  const $g = (id) => document.getElementById(id);
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
  function semana(offset = 0) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dow = (now.getDay() + 6) % 7;
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
  GMN.copiar = (texto) => {
    navigator.clipboard.writeText(texto).then(() => toast('✅ Link copiado!')).catch(() => prompt('Copie o link:', texto));
  };
  GMN.setF = (k, v) => { F[k] = v; render(); };

  /* ── Modal próprio (usa #modal-root, não conflita com o modal do CRM) ───── */
  function openModal(html, width) {
    $g('modal-root').innerHTML = `
      <div class="modal-overlay open" onclick="if(event.target===this)GMN.closeModal()">
        <div class="modal" ${width ? `style="width:${width}px"` : ''}>${html}</div>
      </div>`;
  }
  GMN.closeModal = () => { $g('modal-root').innerHTML = ''; };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $g('modal-root') && $g('modal-root').innerHTML) GMN.closeModal();
  });

  /* ── Carga de dados (lazy: na primeira página GMN aberta) ───────────────── */
  async function loadAll() {
    const [perfis, posts, avals, ranks] = await Promise.all([
      window.dbList('gmn_perfis', 'createdAt'),
      window.dbList('gmn_posts', 'data', 'asc'),
      window.dbList('gmn_avaliacoes', 'data'),
      window.dbList('gmn_ranking', 'data'),
    ]);
    S.perfis = perfis; S.posts = posts; S.avaliacoes = avals; S.rankings = ranks;
    S.loaded = true;
  }
  async function refresh() { await loadAll(); render(); }

  /* ── Roteador (chamado pelo showPage do app.js) ─────────────────────────── */
  GMN.route = async (page) => {
    pagina = page;
    if (!S.loaded) {
      $g('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Carregando módulos GMN…</div>';
      await loadAll();
      if (!pagina.startsWith('gmn-')) return; // usuário navegou para outra página enquanto carregava
    }
    render();
  };
  function render() {
    const fn = {
      'gmn-dashboard': renderDash, 'gmn-perfis': renderPerfis, 'gmn-postagens': renderPosts,
      'gmn-avaliacoes': renderAvals, 'gmn-ranking': renderRank,
    }[pagina];
    if (fn) $g('main-content').innerHTML = fn();
  }
  GMN.render = render;

  /* ── Helpers de dados ───────────────────────────────────────────────────── */
  const perfilById = (id) => S.perfis.find((p) => p.id === id);
  const perfilNome = (id) => (perfilById(id) || {}).nome || '(perfil removido)';
  function checklistPct(p) {
    const c = p.checklist || {};
    return Math.round((CHECKLIST.filter((i) => c[i.k]).length / CHECKLIST.length) * 100);
  }
  function avalStats(perfilId) {
    const list = S.avaliacoes.filter((a) => a.perfilId === perfilId);
    const total = list.length;
    const media = total ? (list.reduce((s, a) => s + Number(a.nota || 0), 0) / total) : 0;
    return { total, media, naoResp: list.filter((a) => !a.respondida).length, list };
  }
  function postsDaSemana(perfilId, offset = 0) {
    const { start, end } = semana(offset);
    return S.posts.filter((p) => (!perfilId || p.perfilId === perfilId) && p.data >= start && p.data <= end);
  }
  const selectPerfis = (sel, todos) =>
    (todos ? `<option value="">Todos os perfis</option>` : `<option value="">Selecione o perfil…</option>`) +
    S.perfis.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');

  /* ═══════════════════════════ VISÃO GMN (dashboard) ══════════════════════ */
  function renderDash() {
    const { start, end } = semana();
    const postsPend = S.posts.filter((p) => p.data >= start && p.data <= end && p.status !== 'feito');
    const naoResp = S.avaliacoes.filter((a) => !a.respondida).length;
    const checkMedio = S.perfis.length
      ? Math.round(S.perfis.reduce((s, p) => s + checklistPct(p), 0) / S.perfis.length) : 0;

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
      </div>

      <div class="gmn-dash-cols">
        <div class="gmn-panel">
          <div class="gmn-panel-title"><i class="bi bi-exclamation-triangle" style="color:var(--yellow)"></i> Perfis que precisam de atenção</div>
          ${atencao.length === 0
            ? `<div class="gmn-empty">${S.perfis.length ? '🎉 Tudo em dia! Nenhum perfil precisa de atenção.' : `Nenhum perfil cadastrado. <span style="color:var(--accent);cursor:pointer" onclick="GMN.openPerfilModal()">+ Cadastrar primeiro perfil</span>`}</div>`
            : atencao.map(({ p, motivos }) => `
              <div class="gmn-atencao-item" onclick="GMN.openPerfilDetalhe('${p.id}')">
                <div>
                  <div style="font-weight:600;font-size:13px">${esc(p.nome)}</div>
                  <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${motivos.map(esc).join(' · ')}</div>
                </div>
                <i class="bi bi-chevron-right" style="color:var(--text-muted)"></i>
              </div>`).join('')}
        </div>

        <div class="gmn-panel">
          <div class="gmn-panel-title"><i class="bi bi-calendar2-week" style="color:var(--accent2)"></i> Postagens desta semana (${fmtData(start)} – ${fmtData(end)})</div>
          ${listaPosts(S.posts.filter((p) => p.data >= start && p.data <= end), true)}
        </div>
      </div>
    </div>`;
  }

  /* ═══════════════════════════════ PERFIS ═════════════════════════════════ */
  function renderPerfis() {
    const busca = F.buscaPerfis.toLowerCase();
    const lista = S.perfis.filter((p) =>
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
        <input type="text" placeholder="🔍 Buscar perfil, cliente, cidade…" value="${esc(F.buscaPerfis)}" oninput="GMN.setF('buscaPerfis',this.value)">
        <select onchange="GMN.setF('statusPerfis',this.value)">
          <option value="">Todos os status</option>
          ${Object.entries(STATUS_PERFIL).map(([k, v]) => `<option value="${k}" ${F.statusPerfis === k ? 'selected' : ''}>${v.l}</option>`).join('')}
        </select>
        <div style="flex:1"></div>
        <button class="btn btn-primary" onclick="GMN.openPerfilModal()">+ Novo Perfil</button>
      </div>
      ${lista.length === 0
        ? `<div class="gmn-empty" style="padding:60px 20px;text-align:center">Nenhum perfil ${S.perfis.length ? 'encontrado com esse filtro' : 'cadastrado ainda'}.<br><br><button class="btn btn-primary" onclick="GMN.openPerfilModal()">+ Cadastrar primeiro perfil</button></div>`
        : `<div class="gmn-grid">${lista.map(cardPerfil).join('')}</div>`}
    </div>`;
  }

  function cardPerfil(p) {
    const pct = checklistPct(p);
    const st = STATUS_PERFIL[p.status] || STATUS_PERFIL['nao-verificado'];
    const av = avalStats(p.id);
    const postsSem = postsDaSemana(p.id).length;

    // Status de deadline
    const hoje = new Date();
    const deadlineAtrasado = p.deadline && new Date(p.deadline) < hoje && pct < 100;
    const proximoDeadline = p.deadline ? ` • Prazo: ${fmtData(p.deadline)}` : '';
    const statusAtraso = deadlineAtrasado ? ' 🔴 ATRASADO' : '';

    return `
    <div class="gmn-card" onclick="GMN.openPerfilDetalhe('${p.id}')">
      <div class="gmn-card-top">
        <div>
          <div class="gmn-card-nome">${esc(p.nome)}</div>
          <div class="gmn-card-sub">${esc(p.categoria || '—')}${p.cidade ? ' · ' + esc(p.cidade) : ''}${statusAtraso}</div>
        </div>
        <span class="badge ${st.c}">${st.l}</span>
      </div>
      ${p.cliente ? `<div class="gmn-card-cliente"><i class="bi bi-person"></i> ${esc(p.cliente)}</div>` : ''}
      <div class="gmn-progress-wrap" title="Checklist de otimização: ${pct}%${proximoDeadline}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:12px;font-weight:600">${pct}% completo</span>
          ${p.deadline ? `<span style="font-size:11px;color:var(--text-muted)">${fmtData(p.deadline)}</span>` : ''}
        </div>
        <div class="gmn-progress"><div class="gmn-progress-fill ${pct === 100 ? 'full' : deadlineAtrasado ? 'atrasado' : ''}" style="width:${pct}%"></div></div>
        <span class="gmn-progress-label">${pct}%</span>
      </div>
      <div class="gmn-card-footer">
        <span title="Avaliações">${stars(Math.round(av.media))} <b style="font-size:11px">${av.media ? av.media.toFixed(1) : '—'}</b> (${av.total})</span>
        <span style="font-size:11px;color:${postsSem ? 'var(--green)' : 'var(--yellow)'}" title="Posts nesta semana"><i class="bi bi-calendar2-week"></i> ${postsSem} post${postsSem === 1 ? '' : 's'}</span>
      </div>
    </div>`;
  }

  GMN.openPerfilDetalhe = (id) => {
    const p = perfilById(id); if (!p) return;
    const pct = checklistPct(p);
    const st = STATUS_PERFIL[p.status] || STATUS_PERFIL['nao-verificado'];
    const av = avalStats(id);
    const campo = (lab, val) => `<div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">${lab}</div><div style="font-size:13px">${val}</div></div>`;
    openModal(`
      <div class="modal-header">
        <div class="modal-title">${esc(p.nome)} <span class="badge ${st.c}" style="margin-left:8px">${st.l}</span></div>
        <button class="modal-close" onclick="GMN.closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        ${campo('Cliente', esc(p.cliente || '—'))}
        ${campo('Categoria', esc(p.categoria || '—'))}
        ${campo('Cidade', esc(p.cidade || '—'))}
        ${campo('Telefone', esc(p.telefone || '—'))}
        ${campo('E-mail de acesso', esc(p.emailAcesso || '—'))}
        ${campo('Avaliações', (av.media ? av.media.toFixed(1) + ' ★' : '—') + ' (' + av.total + ')')}
      </div>
      ${p.obs ? `<div style="font-size:12px;color:var(--text-secondary);background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:14px;white-space:pre-wrap">${esc(p.obs)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px">
        ${p.linkPerfil ? `<a class="btn btn-ghost" style="font-size:11.5px;text-decoration:none" href="${esc(p.linkPerfil)}" target="_blank"><i class="bi bi-geo-alt"></i> Abrir no Maps</a>` : ''}
        ${p.linkAvaliacao ? `<button class="btn btn-ghost" style="font-size:11.5px" onclick="GMN.copiar('${esc(p.linkAvaliacao)}')"><i class="bi bi-link-45deg"></i> Copiar link de avaliação</button>` : ''}
        <button class="btn btn-ghost" style="font-size:11.5px" onclick="GMN.closeModal();GMN.setF('perfilAval','${p.id}');showPage('gmn-avaliacoes')"><i class="bi bi-star"></i> Avaliações</button>
        <button class="btn btn-ghost" style="font-size:11.5px" onclick="GMN.closeModal();GMN.setF('perfilRank','${p.id}');showPage('gmn-ranking')"><i class="bi bi-graph-up-arrow"></i> Ranking</button>
        <button class="btn btn-ghost" style="font-size:11.5px" onclick="GMN.closeModal();GMN.setF('perfilPosts','${p.id}');showPage('gmn-postagens')"><i class="bi bi-calendar2-week"></i> Posts</button>
      </div>
      <div class="gmn-panel-title" style="margin-bottom:10px">Checklist de otimização
        <span style="font-family:var(--mono);font-size:12px;color:${pct === 100 ? 'var(--green)' : 'var(--accent)'}">${pct}%</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto">
        ${CHECKLIST.map((i) => {
          const done = (p.checklist || {})[i.k];
          return `<label class="checklist-item ${done ? 'done' : ''}">
            <input type="checkbox" class="task-check" ${done ? 'checked' : ''} onchange="GMN.toggleCheck('${p.id}','${i.k}',this.checked)">
            <span class="check-label">${i.l}</span>
          </label>`;
        }).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger" onclick="GMN.delPerfil('${p.id}')"><i class="bi bi-trash"></i> Excluir</button>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="GMN.closeModal()">Fechar</button>
        <button class="btn btn-primary" onclick="GMN.openPerfilModal('${p.id}')"><i class="bi bi-pencil"></i> Editar dados</button>
      </div>`, 640);
  };

  GMN.toggleCheck = async (perfilId, key, val) => {
    const p = perfilById(perfilId); if (!p) return;
    p.checklist = p.checklist || {};
    p.checklist[key] = val;
    await window.dbSave('gmn_perfis', { id: p.id, checklist: p.checklist });
    render();
  };

  GMN.openPerfilModal = (id) => {
    const p = id ? perfilById(id) : {};
    openModal(`
      <div class="modal-header">
        <div class="modal-title">${id ? 'Editar perfil' : 'Novo perfil GMN'}</div>
        <button class="modal-close" onclick="GMN.closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row" style="grid-column:1/-1"><label>Nome do negócio *</label><input id="pf-nome" value="${esc(p.nome || '')}" placeholder="Ex.: Ótica Visão Clara"></div>
        <div class="form-row"><label>Cliente</label><input id="pf-cliente" value="${esc(p.cliente || '')}" placeholder="Nome do cliente"></div>
        <div class="form-row"><label>Categoria principal</label><input id="pf-categoria" value="${esc(p.categoria || '')}" placeholder="Ex.: Ótica"></div>
        <div class="form-row"><label>Cidade</label><input id="pf-cidade" value="${esc(p.cidade || '')}" placeholder="Ex.: Florianópolis/SC"></div>
        <div class="form-row"><label>Telefone / WhatsApp</label><input id="pf-telefone" value="${esc(p.telefone || '')}" placeholder="(48) 9…"></div>
        <div class="form-row"><label>Prazo máximo de conclusão</label><input id="pf-deadline" type="date" value="${p.deadline || ''}"></div>
        <div class="form-row"><label>Tipo de perfil</label>
          <select id="pf-tipo">
            <option value="recorrencia" ${p.tipo === 'recorrencia' ? 'selected' : ''}>Recorrência (manutenção)</option>
            <option value="implementacao" ${p.tipo === 'implementacao' ? 'selected' : ''}>Implementação/Criação/Regularização</option>
          </select>
        </div>
        <div class="form-row"><label>Status de verificação</label>
          <select id="pf-status">${Object.entries(STATUS_PERFIL).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.l}</option>`).join('')}</select>
        </div>
        <div class="form-row"><label>E-mail de acesso (conta Google)</label><input id="pf-email" value="${esc(p.emailAcesso || '')}" placeholder="conta@gmail.com"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Link do perfil (Google Maps)</label><input id="pf-link" value="${esc(p.linkPerfil || '')}" placeholder="https://maps.google.com/…"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Link para pedir avaliação</label><input id="pf-linkaval" value="${esc(p.linkAvaliacao || '')}" placeholder="https://g.page/r/…/review"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Observações</label><textarea id="pf-obs" placeholder="Anotações internas sobre este perfil…">${esc(p.obs || '')}</textarea></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="GMN.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="GMN.savePerfil('${id || ''}')">${id ? 'Salvar alterações' : 'Cadastrar perfil'}</button>
      </div>`, 640);
  };

  GMN.savePerfil = async (id) => {
    const nome = $g('pf-nome').value.trim();
    if (!nome) { alert('Informe o nome do negócio.'); return; }
    const data = {
      nome,
      cliente: $g('pf-cliente').value.trim(),
      categoria: $g('pf-categoria').value.trim(),
      cidade: $g('pf-cidade').value.trim(),
      telefone: $g('pf-telefone').value.trim(),
      deadline: $g('pf-deadline').value || null,
      tipo: $g('pf-tipo').value,
      status: $g('pf-status').value,
      emailAcesso: $g('pf-email').value.trim(),
      linkPerfil: $g('pf-link').value.trim(),
      linkAvaliacao: $g('pf-linkaval').value.trim(),
      obs: $g('pf-obs').value.trim(),
    };
    if (id) data.id = id;
    const ok = await window.dbSave('gmn_perfis', data);
    if (ok) { GMN.closeModal(); await refresh(); toast(id ? '✅ Perfil atualizado' : '✅ Perfil cadastrado'); }
  };

  GMN.delPerfil = async (id) => {
    if (!confirm('Excluir este perfil?\nPosts, avaliações e ranking dele ficam órfãos. Essa ação não pode ser desfeita.')) return;
    await window.dbDelete('gmn_perfis', id);
    GMN.closeModal(); await refresh(); toast('Perfil excluído');
  };

  /* ═══════════════════════════════ POSTAGENS ══════════════════════════════ */
  function renderPosts() {
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
        <select onchange="GMN.setF('perfilPosts',this.value)">${selectPerfis(F.perfilPosts, true)}</select>
        <select onchange="GMN.setF('statusPosts',this.value)">
          <option value="">Todos</option>
          <option value="planejado" ${F.statusPosts === 'planejado' ? 'selected' : ''}>Planejados</option>
          <option value="feito" ${F.statusPosts === 'feito' ? 'selected' : ''}>Publicados</option>
        </select>
        <div style="flex:1"></div>
        <button class="btn btn-primary" onclick="GMN.openPostModal()">+ Novo Post</button>
      </div>

      ${semPost.length && !F.perfilPosts ? `
        <div class="gmn-alert"><i class="bi bi-exclamation-triangle"></i> Sem post nesta semana:
          ${semPost.map((p) => `<span class="gmn-chip" onclick="GMN.openPostModal(null,'${p.id}')" title="Criar post para ${esc(p.nome)}">${esc(p.nome)} +</span>`).join('')}
        </div>` : ''}

      ${atrasados.length ? `<div class="gmn-panel" style="border-color:rgba(245,54,92,.35)"><div class="gmn-panel-title" style="color:var(--red)"><i class="bi bi-alarm"></i> Atrasados</div>${listaPosts(atrasados)}</div>` : ''}
      <div class="gmn-panel"><div class="gmn-panel-title"><i class="bi bi-calendar2-week" style="color:var(--accent)"></i> Esta semana (${fmtData(start)} – ${fmtData(end)})</div>${listaPosts(estaSemana, true)}</div>
      <div class="gmn-panel"><div class="gmn-panel-title"><i class="bi bi-calendar2-plus" style="color:var(--accent3)"></i> Próxima semana</div>${listaPosts(proxSemana, true)}</div>
      ${futuros.length ? `<div class="gmn-panel"><div class="gmn-panel-title"><i class="bi bi-calendar2"></i> Mais adiante</div>${listaPosts(futuros)}</div>` : ''}
      ${anteriores.length ? `<div class="gmn-panel"><div class="gmn-panel-title" style="color:var(--text-muted)"><i class="bi bi-clock-history"></i> Publicados anteriormente</div>${listaPosts(anteriores)}</div>` : ''}
    </div>`;
  }

  function listaPosts(lista, mostrarVazio) {
    if (!lista.length) return mostrarVazio ? `<div class="gmn-empty">Nenhum post por aqui. <span style="color:var(--accent);cursor:pointer" onclick="GMN.openPostModal()">+ Planejar post</span></div>` : '';
    return lista.map((p) => {
      const feito = p.status === 'feito';
      return `
      <div class="gmn-post-row ${feito ? 'feito' : ''}">
        <input type="checkbox" class="task-check" ${feito ? 'checked' : ''} onchange="GMN.togglePostFeito('${p.id}')" title="${feito ? 'Publicado' : 'Marcar como publicado'}">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:12.5px;${feito ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${esc(p.titulo)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${esc(perfilNome(p.perfilId))} · ${fmtData(p.data)}</div>
        </div>
        <span class="badge ${feito ? 's-feito' : 's-pendente'}">${feito ? 'Publicado' : TIPOS_POST[p.tipo] || 'Planejado'}</span>
        <button class="icon-btn" onclick="GMN.openPostModal('${p.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn" onclick="GMN.delPost('${p.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
      </div>`;
    }).join('');
  }

  GMN.openPostModal = (id, perfilPre) => {
    const p = id ? S.posts.find((x) => x.id === id) : { perfilId: perfilPre || F.perfilPosts || '', data: hojeISO() };
    if (!S.perfis.length) { alert('Cadastre um perfil GMN primeiro.'); return; }
    openModal(`
      <div class="modal-header">
        <div class="modal-title">${id ? 'Editar post' : 'Planejar post'}</div>
        <button class="modal-close" onclick="GMN.closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row" style="grid-column:1/-1"><label>Perfil *</label><select id="po-perfil">${selectPerfis(p.perfilId)}</select></div>
        <div class="form-row" style="grid-column:1/-1"><label>Título / assunto do post *</label><input id="po-titulo" value="${esc(p.titulo || '')}" placeholder="Ex.: Promoção de armações — 30% off"></div>
        <div class="form-row"><label>Tipo</label>
          <select id="po-tipo">${Object.entries(TIPOS_POST).map(([k, v]) => `<option value="${k}" ${p.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="form-row"><label>Data planejada *</label><input id="po-data" type="date" value="${esc(p.data || hojeISO())}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Notas / legenda</label><textarea id="po-notas" placeholder="Texto do post, CTA, imagem a usar…">${esc(p.notas || '')}</textarea></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="GMN.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="GMN.savePost('${id || ''}')">${id ? 'Salvar' : 'Planejar post'}</button>
      </div>`);
  };

  GMN.savePost = async (id) => {
    const perfilId = $g('po-perfil').value, titulo = $g('po-titulo').value.trim(), data = $g('po-data').value;
    if (!perfilId || !titulo || !data) { alert('Preencha perfil, título e data.'); return; }
    const d = { perfilId, titulo, data, tipo: $g('po-tipo').value, notas: $g('po-notas').value.trim() };
    if (id) d.id = id; else d.status = 'planejado';
    const ok = await window.dbSave('gmn_posts', d);
    if (ok) { GMN.closeModal(); await refresh(); toast('✅ Post salvo'); }
  };

  GMN.togglePostFeito = async (id) => {
    const p = S.posts.find((x) => x.id === id); if (!p) return;
    await window.dbSave('gmn_posts', { id, status: p.status === 'feito' ? 'planejado' : 'feito' });
    await refresh();
  };

  GMN.delPost = async (id) => {
    if (!confirm('Excluir este post?')) return;
    await window.dbDelete('gmn_posts', id);
    await refresh(); toast('Post excluído');
  };

  /* ═══════════════════════════════ AVALIAÇÕES ═════════════════════════════ */
  function renderAvals() {
    const perfil = F.perfilAval ? perfilById(F.perfilAval) : null;
    const lista = S.avaliacoes.filter((a) =>
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
        <select onchange="GMN.setF('perfilAval',this.value)">${selectPerfis(F.perfilAval, true)}</select>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer">
          <input type="checkbox" class="task-check" ${F.soNaoRespondidas ? 'checked' : ''} onchange="GMN.setF('soNaoRespondidas',this.checked)"> Só não respondidas
        </label>
        <div style="flex:1"></div>
        ${perfil && perfil.linkAvaliacao ? `<button class="btn btn-ghost" onclick="GMN.copiar('${esc(perfil.linkAvaliacao)}')"><i class="bi bi-link-45deg"></i> Copiar link de avaliação</button>` : ''}
        <button class="btn btn-primary" onclick="GMN.openAvalModal()">+ Registrar avaliação</button>
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
                <td><span class="badge ${a.respondida ? 's-feito' : 's-pendente'}" style="cursor:pointer" onclick="GMN.toggleAvalResp('${a.id}')" title="Clique para alternar">${a.respondida ? 'Respondida' : 'Responder!'}</span></td>
                <td style="white-space:nowrap">
                  <button class="icon-btn" onclick="GMN.openAvalModal('${a.id}')" title="Editar"><i class="bi bi-pencil"></i></button>
                  <button class="icon-btn" onclick="GMN.delAval('${a.id}')" title="Excluir"><i class="bi bi-trash"></i></button>
                </td>
              </tr>`).join('')}</tbody>
          </table></div>`}
    </div>`;
  }

  GMN.openAvalModal = (id) => {
    const a = id ? S.avaliacoes.find((x) => x.id === id) : { perfilId: F.perfilAval || '', data: hojeISO(), nota: 5 };
    if (!S.perfis.length) { alert('Cadastre um perfil GMN primeiro.'); return; }
    openModal(`
      <div class="modal-header">
        <div class="modal-title">${id ? 'Editar avaliação' : 'Registrar avaliação'}</div>
        <button class="modal-close" onclick="GMN.closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row" style="grid-column:1/-1"><label>Perfil *</label><select id="av-perfil">${selectPerfis(a.perfilId)}</select></div>
        <div class="form-row"><label>Autor</label><input id="av-autor" value="${esc(a.autor || '')}" placeholder="Nome de quem avaliou"></div>
        <div class="form-row"><label>Data</label><input id="av-data" type="date" value="${esc(a.data || hojeISO())}"></div>
        <div class="form-row"><label>Nota *</label>
          <select id="av-nota">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${Number(a.nota) === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})</option>`).join('')}</select>
        </div>
        <div class="form-row"><label>Já foi respondida?</label>
          <select id="av-resp"><option value="">Não</option><option value="1" ${a.respondida ? 'selected' : ''}>Sim</option></select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Comentário do cliente</label><textarea id="av-texto">${esc(a.texto || '')}</textarea></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="GMN.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="GMN.saveAval('${id || ''}')">Salvar</button>
      </div>`);
  };

  GMN.saveAval = async (id) => {
    const perfilId = $g('av-perfil').value;
    if (!perfilId) { alert('Selecione o perfil.'); return; }
    const d = {
      perfilId,
      autor: $g('av-autor').value.trim(),
      data: $g('av-data').value || hojeISO(),
      nota: Number($g('av-nota').value),
      respondida: !!$g('av-resp').value,
      texto: $g('av-texto').value.trim(),
    };
    if (id) d.id = id;
    const ok = await window.dbSave('gmn_avaliacoes', d);
    if (ok) { GMN.closeModal(); await refresh(); toast('✅ Avaliação salva'); }
  };

  GMN.toggleAvalResp = async (id) => {
    const a = S.avaliacoes.find((x) => x.id === id); if (!a) return;
    await window.dbSave('gmn_avaliacoes', { id, respondida: !a.respondida });
    await refresh();
  };

  GMN.delAval = async (id) => {
    if (!confirm('Excluir esta avaliação?')) return;
    await window.dbDelete('gmn_avaliacoes', id);
    await refresh();
  };

  /* ═══════════════════════════════ RANKING ════════════════════════════════ */
  function renderRank() {
    const lista = S.rankings.filter((r) => !F.perfilRank || r.perfilId === F.perfilRank);

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
      return { atual, trend, historico: g };
    }).sort((a, b) => Number(a.atual.posicao) - Number(b.atual.posicao));

    const top3 = linhas.filter((l) => Number(l.atual.posicao) <= 3).length;

    return `<div class="page-wrap">
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Palavras monitoradas</div><div class="stat-val">${linhas.length}</div></div>
        <div class="stat-card"><div class="stat-label">No top 3 do mapa</div><div class="stat-val green">${top3}</div></div>
        <div class="stat-card"><div class="stat-label">Registros no total</div><div class="stat-val blue">${lista.length}</div></div>
      </div>
      <div class="toolbar">
        <select onchange="GMN.setF('perfilRank',this.value)">${selectPerfis(F.perfilRank, true)}</select>
        <div style="flex:1"></div>
        <button class="btn btn-primary" onclick="GMN.openRankModal()">+ Registrar posição</button>
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
                  <button class="icon-btn" onclick="GMN.openRankModal(null,'${l.atual.perfilId}','${esc(l.atual.palavra)}')" title="Nova checagem desta palavra"><i class="bi bi-plus-lg"></i></button>
                  <button class="icon-btn" onclick="GMN.delRank('${l.atual.id}')" title="Excluir último registro"><i class="bi bi-trash"></i></button>
                </td>
              </tr>`).join('')}</tbody>
          </table></div>`}
    </div>`;
  }

  GMN.openRankModal = (id, perfilPre, palavraPre) => {
    if (!S.perfis.length) { alert('Cadastre um perfil GMN primeiro.'); return; }
    openModal(`
      <div class="modal-header">
        <div class="modal-title">Registrar posição no mapa</div>
        <button class="modal-close" onclick="GMN.closeModal()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row" style="grid-column:1/-1"><label>Perfil *</label><select id="rk-perfil">${selectPerfis(perfilPre || F.perfilRank)}</select></div>
        <div class="form-row" style="grid-column:1/-1"><label>Palavra-chave pesquisada *</label><input id="rk-palavra" value="${esc(palavraPre || '')}" placeholder="Ex.: ótica florianópolis"></div>
        <div class="form-row"><label>Posição no resultado *</label><input id="rk-pos" type="number" min="1" max="100" placeholder="Ex.: 3"></div>
        <div class="form-row"><label>Data da checagem</label><input id="rk-data" type="date" value="${hojeISO()}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="GMN.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="GMN.saveRank()">Registrar</button>
      </div>`);
  };

  GMN.saveRank = async () => {
    const perfilId = $g('rk-perfil').value, palavra = $g('rk-palavra').value.trim(), pos = $g('rk-pos').value;
    if (!perfilId || !palavra || !pos) { alert('Preencha perfil, palavra-chave e posição.'); return; }
    const ok = await window.dbSave('gmn_ranking', { perfilId, palavra, posicao: Number(pos), data: $g('rk-data').value || hojeISO() });
    if (ok) { GMN.closeModal(); await refresh(); toast('✅ Posição registrada'); }
  };

  GMN.delRank = async (id) => {
    if (!confirm('Excluir este registro de posição?')) return;
    await window.dbDelete('gmn_ranking', id);
    await refresh();
  };
})();
