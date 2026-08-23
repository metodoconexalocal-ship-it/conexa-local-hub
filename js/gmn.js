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
      'gmn-dashboard': renderDash, 'gmn-dashboard-filtrada': renderDashboardFiltrada, 'gmn-tarefas': renderTarefas, 'gmn-perfis': renderPerfis, 'gmn-postagens': renderPosts,
      'gmn-avaliacoes': renderAvals, 'gmn-ranking': renderRank, 'gmn-auditoria': renderAuditoria, 'gmn-auditoria-detalhes': renderAuditoriaDetalhes,
      'gmn-metricas': renderGMNMetricas,
    }[pagina];
    if (fn) $g('main-content').innerHTML = fn();
  }
  GMN.render = render;

  /* ── Seletor de perfil para auditoria ─────────────────────────────────── */
  GMN.setPerfilAuditoria = (perfilId) => {
    pagina = 'gmn-auditoria-detalhes';
    F.perfilAuditoria = perfilId;
    render();
  };

  /* ── Helpers de dados ───────────────────────────────────────────────────── */
  const perfilById = (id) => S.perfis.find((p) => p.id === id);
  const perfilNome = (id) => (perfilById(id) || {}).nome || '(perfil removido)';
  function checklistPct(p) {
    const c = p.checklist || {};
    const checkPct = CHECKLIST.filter((i) => c[i.k]).length / CHECKLIST.length;
    const subElements = (p.subElementos || []);
    const subPct = subElements.length ? subElements.filter((s) => s.feito).length / subElements.length : 0;
    const pctMedia = subElements.length ? (checkPct + subPct) / 2 : checkPct;
    return Math.round(pctMedia * 100);
  }

  function getSubElementos(perfilId) {
    const p = perfilById(perfilId);
    return (p && p.subElementos) || [];
  }

  function subElementosStats(perfilId) {
    const subs = getSubElementos(perfilId);
    const total = subs.length;
    const feitos = subs.filter((s) => s.feito).length;
    return { total, feitos, pct: total ? Math.round((feitos / total) * 100) : 0 };
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

  /* ══════════════ DASHBOARD FILTRADA (RECORRÊNCIA VS IMPLEMENTAÇÃO) ════════ */
  function renderDashboardFiltrada() {
    const abaTipo = F.abaTipo || 'recorrencia';
    const filtrados = S.perfis.filter((p) => (p.tipo || 'recorrencia') === abaTipo);

    const stats = {
      total: filtrados.length,
      emDia: filtrados.filter((p) => !p.deadline || new Date(p.deadline) >= new Date()).length,
      atrasados: filtrados.filter((p) => p.deadline && new Date(p.deadline) < new Date() && checklistPct(p) < 100).length,
      completos: filtrados.filter((p) => checklistPct(p) === 100).length,
    };

    const hoje = new Date();
    const semanaProxima = new Date(hoje);
    semanaProxima.setDate(hoje.getDate() + 7);

    const proximosVencer = filtrados
      .filter((p) => p.deadline && new Date(p.deadline) >= hoje && new Date(p.deadline) <= semanaProxima && checklistPct(p) < 100)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    return `<div class="page-wrap">
      <div style="display:flex;gap:12px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px">
        <button class="btn ${abaTipo === 'recorrencia' ? 'btn-primary' : 'btn-ghost'}" onclick="GMN.setF('abaTipo','recorrencia');GMN.render()" style="font-size:13px">
          <i class="bi bi-arrow-repeat"></i> Recorrência
        </button>
        <button class="btn ${abaTipo === 'implementacao' ? 'btn-primary' : 'btn-ghost'}" onclick="GMN.setF('abaTipo','implementacao');GMN.render()" style="font-size:13px">
          <i class="bi bi-rocket-takeoff"></i> Implementação
        </button>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-val">${stats.total}</div></div>
        <div class="stat-card"><div class="stat-label">Em dia</div><div class="stat-val green">${stats.emDia}</div></div>
        <div class="stat-card"><div class="stat-label">Atrasados</div><div class="stat-val ${stats.atrasados ? '' : 'green'}">${stats.atrasados}</div></div>
        <div class="stat-card"><div class="stat-label">Completos</div><div class="stat-val green">${stats.completos}</div></div>
      </div>

      ${proximosVencer.length > 0 ? `
        <div class="gmn-panel" style="margin-bottom:16px">
          <div class="gmn-panel-title"><i class="bi bi-exclamation-triangle" style="color:var(--yellow)"></i> Prazos próximos de vencer (7 dias)</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${proximosVencer.map((p) => `
              <div class="gmn-card-compact" onclick="GMN.openPerfilDetalhe('${p.id}')" style="cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div style="font-weight:600;font-size:13px">${esc(p.nome)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${fmtData(p.deadline)}</div>
                </div>
                <div style="background:var(--bg-base);height:16px;border-radius:4px;overflow:hidden;border:1px solid var(--border)">
                  <div style="height:100%;background:var(--accent);width:${checklistPct(p)}%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff">${checklistPct(p)}%</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="gmn-panel">
        <div class="gmn-panel-title">
          ${abaTipo === 'recorrencia' ? '🔄 Perfis em Recorrência' : '🚀 Perfis em Implementação'}
          <span style="font-size:12px;color:var(--text-muted)">(${filtrados.length})</span>
        </div>
        ${filtrados.length === 0
          ? `<div class="gmn-empty">Nenhum perfil nesta categoria</div>`
          : `<div class="gmn-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${filtrados.map((p) => {
              const pct = checklistPct(p);
              const st = STATUS_PERFIL[p.status] || STATUS_PERFIL['nao-verificado'];
              const hoje = new Date();
              const deadlineAtrasado = p.deadline && new Date(p.deadline) < hoje && pct < 100;
              return `
                <div class="gmn-card" onclick="GMN.openPerfilDetalhe('${p.id}')">
                  <div class="gmn-card-top">
                    <div>
                      <div class="gmn-card-nome">${esc(p.nome)}</div>
                      <div class="gmn-card-sub">${esc(p.categoria || '—')}${p.cliente ? ' · ' + esc(p.cliente) : ''}</div>
                    </div>
                    <span class="badge ${st.c}">${st.l}</span>
                  </div>
                  <div style="margin:10px 0;padding:10px;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                      <span style="font-size:12px;font-weight:600">${pct}% completo</span>
                      ${p.deadline ? `<span style="font-size:11px;color:${deadlineAtrasado ? 'var(--red)' : 'var(--text-muted)'}">${fmtData(p.deadline)}</span>` : ''}
                    </div>
                    <div style="height:12px;background:var(--bg-card);border-radius:4px;overflow:hidden;border:1px solid var(--border)">
                      <div style="height:100%;background:${deadlineAtrasado ? 'var(--red)' : 'var(--accent)'};width:${pct}%"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}</div>`}
      </div>
    </div>`;
  }

  /* ══════════════ VISÃO SEMANAL/DIÁRIA DE TAREFAS ═══════════════════════════ */
  function renderTarefas() {
    const periodoAba = F.periodoAba || 'hoje';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay() + (hoje.getDay() === 0 ? -6 : 1));

    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    const inicioProxSemana = new Date(fimSemana);
    inicioProxSemana.setDate(fimSemana.getDate() + 1);

    const fimProxSemana = new Date(inicioProxSemana);
    fimProxSemana.setDate(inicioProxSemana.getDate() + 6);

    const isoHoje = hoje.toISOString().split('T')[0];
    const isoAmanha = amanha.toISOString().split('T')[0];
    const isoInicioSemana = inicioSemana.toISOString().split('T')[0];
    const isoFimSemana = fimSemana.toISOString().split('T')[0];
    const isoInicioProx = inicioProxSemana.toISOString().split('T')[0];
    const isoFimProx = fimProxSemana.toISOString().split('T')[0];

    const getTarefas = (dataInicio, dataFim) => {
      const tarefas = [];

      // Sub-elementos pendentes
      S.perfis.forEach((p) => {
        (p.subElementos || []).filter((s) => !s.feito).forEach((sub) => {
          tarefas.push({
            tipo: 'sub-elemento',
            titulo: sub.titulo,
            perfil: p.nome,
            perfilId: p.id,
            data: sub.criadoEm ? sub.criadoEm.split('T')[0] : isoHoje,
            prioridade: p.deadline && new Date(p.deadline) < today ? 'urgente' : 'normal',
            deadline: p.deadline,
          });
        });
      });

      // Posts pendentes
      S.posts.filter((p) => p.data >= dataInicio && p.data <= dataFim && p.status !== 'feito').forEach((post) => {
        tarefas.push({
          tipo: 'post',
          titulo: `Post: ${post.titulo || post.descricao?.substring(0, 50) || 'Sem título'}`,
          perfil: perfilNome(post.perfilId),
          perfilId: post.perfilId,
          data: post.data,
          prioridade: post.data < isoHoje ? 'urgente' : 'normal',
          deadline: post.data,
        });
      });

      // Avaliações não respondidas
      S.avaliacoes.filter((a) => !a.respondida).forEach((aval) => {
        tarefas.push({
          tipo: 'avaliacao',
          titulo: `Responder avaliação (${aval.nota}⭐)`,
          perfil: perfilNome(aval.perfilId),
          perfilId: aval.perfilId,
          data: aval.criadoEm ? aval.criadoEm.split('T')[0] : isoHoje,
          prioridade: 'alta',
          deadline: null,
        });
      });

      // Checklists não completos
      S.perfis.filter((p) => checklistPct(p) < 100).forEach((p) => {
        tarefas.push({
          tipo: 'checklist',
          titulo: `Completar checklist (${checklistPct(p)}%)`,
          perfil: p.nome,
          perfilId: p.id,
          data: isoHoje,
          prioridade: p.deadline && new Date(p.deadline) < today ? 'urgente' : 'normal',
          deadline: p.deadline,
        });
      });

      return tarefas.filter((t) => t.data >= dataInicio && t.data <= dataFim).sort((a, b) => {
        const prioridadeMap = { urgente: 0, alta: 1, normal: 2 };
        if (prioridadeMap[a.prioridade] !== prioridadeMap[b.prioridade]) {
          return prioridadeMap[a.prioridade] - prioridadeMap[b.prioridade];
        }
        return a.data.localeCompare(b.data);
      });
    };

    const tarefasHoje = getTarefas(isoHoje, isoHoje);
    const tarefasEstaSemana = getTarefas(isoInicioSemana, isoFimSemana);
    const tarefasProxSemana = getTarefas(isoInicioProx, isoFimProx);
    const tarefasAtrasadas = S.perfis
      .filter((p) => p.deadline && new Date(p.deadline) < hoje && checklistPct(p) < 100)
      .map((p) => ({
        tipo: 'deadline',
        titulo: `⚠️ Prazo vencido: ${checklistPct(p)}% completo`,
        perfil: p.nome,
        perfilId: p.id,
        data: p.deadline,
        prioridade: 'urgente',
        deadline: p.deadline,
      }));

    const renderTarefasList = (list) => {
      if (list.length === 0) {
        return `<div class="gmn-empty">Nenhuma tarefa neste período</div>`;
      }

      return `<div style="display:flex;flex-direction:column;gap:8px">
        ${list.map((t) => {
          const iconMap = { 'sub-elemento': 'bi-check2-square', post: 'bi-calendar2-week', avaliacao: 'bi-star', checklist: 'bi-list-check', deadline: 'bi-exclamation-triangle' };
          const corPrio = { urgente: 'var(--red)', alta: 'var(--yellow)', normal: 'var(--text-muted)' };
          return `
            <div style="padding:10px;background:var(--bg-base);border-left:3px solid ${corPrio[t.prioridade]};border-radius:4px;cursor:pointer" onclick="GMN.openPerfilDetalhe('${t.perfilId}')">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <i class="bi ${iconMap[t.tipo] || 'bi-task'}"></i>
                <span style="flex:1;font-weight:500;font-size:13px">${esc(t.titulo)}</span>
                <span style="font-size:11px;color:var(--text-muted)">${fmtData(t.data)}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-left:24px">${esc(t.perfil)}</div>
            </div>
          `;
        }).join('')}
      </div>`;
    };

    return `<div class="page-wrap">
      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px;overflow-x:auto">
        <button class="btn ${periodoAba === 'hoje' ? 'btn-primary' : 'btn-ghost'}" onclick="GMN.setF('periodoAba','hoje');GMN.render()" style="font-size:12px;white-space:nowrap">
          📅 Hoje (${tarefasHoje.length})
        </button>
        <button class="btn ${periodoAba === 'semana' ? 'btn-primary' : 'btn-ghost'}" onclick="GMN.setF('periodoAba','semana');GMN.render()" style="font-size:12px;white-space:nowrap">
          📆 Esta semana (${tarefasEstaSemana.length})
        </button>
        <button class="btn ${periodoAba === 'proxsemana' ? 'btn-primary' : 'btn-ghost'}" onclick="GMN.setF('periodoAba','proxsemana');GMN.render()" style="font-size:12px;white-space:nowrap">
          ➡️ Próx. semana (${tarefasProxSemana.length})
        </button>
        <button class="btn ${periodoAba === 'atrasadas' ? 'btn-primary' : 'btn-ghost'}" onclick="GMN.setF('periodoAba','atrasadas');GMN.render()" style="font-size:12px;white-space:nowrap;color:var(--red)">
          🔴 Atrasadas (${tarefasAtrasadas.length})
        </button>
      </div>

      <div class="gmn-panel">
        <div class="gmn-panel-title">
          ${periodoAba === 'hoje' ? '📅 Tarefas de hoje' : periodoAba === 'semana' ? '📆 Esta semana' : periodoAba === 'proxsemana' ? '➡️ Próxima semana' : '🔴 Tarefas atrasadas'}
        </div>
        ${
          periodoAba === 'hoje' ? renderTarefasList(tarefasHoje)
          : periodoAba === 'semana' ? renderTarefasList(tarefasEstaSemana)
          : periodoAba === 'proxsemana' ? renderTarefasList(tarefasProxSemana)
          : renderTarefasList(tarefasAtrasadas)
        }
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
      <div style="margin-bottom:20px;padding:12px;background:var(--bg-base);border-radius:8px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:600;font-size:13px">Progresso de otimização</div>
          <div style="font-size:12px;color:var(--text-muted)">${p.deadline ? 'Prazo: ' + fmtData(p.deadline) : 'Sem prazo definido'}</div>
        </div>
        <div style="background:var(--bg-card);height:24px;border-radius:6px;overflow:hidden;border:1px solid var(--border)">
          <div style="height:100%;background:linear-gradient(90deg, var(--accent), var(--accent2));width:${pct}%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff">${pct > 10 ? pct + '%' : ''}</div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Tipo: <strong>${p.tipo === 'recorrencia' ? '🔄 Recorrência' : '🚀 Implementação'}</strong></div>
      </div>

      <div class="gmn-panel-title" style="margin-bottom:10px">Checklist de otimização
        <span style="font-family:var(--mono);font-size:12px;color:${pct === 100 ? 'var(--green)' : 'var(--accent)'}">${pct}%</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto;margin-bottom:16px">
        ${CHECKLIST.map((i) => {
          const done = (p.checklist || {})[i.k];
          return `<label class="checklist-item ${done ? 'done' : ''}">
            <input type="checkbox" class="task-check" ${done ? 'checked' : ''} onchange="GMN.toggleCheck('${p.id}','${i.k}',this.checked)">
            <span class="check-label">${i.l}</span>
          </label>`;
        }).join('')}
      </div>

      <div class="gmn-panel-title" style="margin-bottom:10px">
        Sub-elementos customizados
        <span style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${(p.subElementos || []).filter((s) => s.feito).length}/${(p.subElementos || []).length}</span>
        <button class="btn btn-primary" style="float:right;font-size:11px;padding:4px 8px" onclick="GMN.addSubElemento('${p.id}')"><i class="bi bi-plus"></i> Novo</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;margin-bottom:16px">
        ${(p.subElementos || []).length === 0
          ? `<div style="font-size:12px;color:var(--text-muted);padding:12px;text-align:center">Nenhum sub-elemento criado ainda</div>`
          : (p.subElementos || []).map((sub) => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-base);border-radius:6px;border:1px solid var(--border)">
              <input type="checkbox" ${sub.feito ? 'checked' : ''} onchange="GMN.toggleSubElemento('${p.id}','${sub.id}')" style="cursor:pointer">
              <span style="flex:1;font-size:12px;${sub.feito ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${esc(sub.titulo)}</span>
              <button class="btn btn-ghost" style="font-size:11px;padding:2px 6px" onclick="GMN.delSubElemento('${p.id}','${sub.id}')"><i class="bi bi-trash"></i></button>
            </div>`).join('')}
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

  /* ══════════════ SUB-ELEMENTOS CUSTOMIZADOS ═════════════════════════════ */
  GMN.addSubElemento = async (perfilId) => {
    const titulo = prompt('Nome do sub-elemento (ex: Fotos de pratos, Descrição, Categoria)');
    if (!titulo) return;
    const p = perfilById(perfilId);
    if (!p) return;
    p.subElementos = p.subElementos || [];
    const newSub = { id: Date.now().toString(), titulo: titulo.trim(), feito: false, criadoEm: new Date().toISOString() };
    p.subElementos.push(newSub);
    await window.dbSave('gmn_perfis', { id: p.id, subElementos: p.subElementos });
    await refresh(); toast('✅ Sub-elemento adicionado');
  };

  GMN.toggleSubElemento = async (perfilId, subId) => {
    const p = perfilById(perfilId);
    if (!p || !p.subElementos) return;
    const sub = p.subElementos.find((s) => s.id === subId);
    if (sub) {
      sub.feito = !sub.feito;
      await window.dbSave('gmn_perfis', { id: p.id, subElementos: p.subElementos });
      await refresh();
    }
  };

  GMN.delSubElemento = async (perfilId, subId) => {
    const p = perfilById(perfilId);
    if (!p || !p.subElementos) return;
    p.subElementos = p.subElementos.filter((s) => s.id !== subId);
    await window.dbSave('gmn_perfis', { id: p.id, subElementos: p.subElementos });
    await refresh(); toast('🗑️ Sub-elemento removido');
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

  /* ═════════════════════════════════ AUDITORIA GBP ═══════════════════════════ */

  /* Helpers para cálculos de auditoria */
  function getAvaliacoesPerfil(perfilId) {
    return S.avaliacoes.filter((a) => a.perfilId === perfilId);
  }
  function getPostsPerfil(perfilId, dias = 30) {
    const d = new Date(); d.setDate(d.getDate() - dias);
    const dataLimite = d.toISOString().split('T')[0];
    return S.posts.filter((p) => p.perfilId === perfilId && p.data >= dataLimite);
  }

  /* Scoring Engine - 10 dimensões */
  const ScoringEngine = {
    calcularScore: (perfil) => {
      const scores = {
        infoBasica: ScoringEngine.scoreInfoBasica(perfil),
        conteudoVisual: ScoringEngine.scoreConteudoVisual(perfil),
        conteudoTextual: ScoringEngine.scoreConteudoTextual(perfil),
        reputacao: ScoringEngine.scoreReputacao(perfil),
        atividade: ScoringEngine.scoreAtividade(perfil),
        engajamento: ScoringEngine.scoreEngajamento(perfil),
        otimizacao: ScoringEngine.scoreOtimizacao(perfil),
        avaliacoes: ScoringEngine.scoreAvaliacoes(perfil),
        posicionamento: ScoringEngine.scorePosicionamento(perfil),
        conformidade: ScoringEngine.scoreConformidade(perfil),
      };

      const pesos = {
        infoBasica: 0.10, conteudoVisual: 0.12, conteudoTextual: 0.10,
        reputacao: 0.15, atividade: 0.08, engajamento: 0.10,
        otimizacao: 0.08, avaliacoes: 0.08, posicionamento: 0.10, conformidade: 0.09,
      };

      let scoreGeral = 0;
      Object.entries(scores).forEach(([k, v]) => { scoreGeral += v * pesos[k]; });
      scoreGeral = Math.round(scoreGeral);

      const categoria = scoreGeral < 25 ? 'critico' : scoreGeral < 50 ? 'fraco' : scoreGeral < 75 ? 'razoavel' : scoreGeral < 90 ? 'bom' : 'excelente';

      return { scoreGeral, scores, categoria, recomendacoes: ScoringEngine.gerarRecomendacoes(scores, perfil) };
    },

    scoreInfoBasica: (p) => {
      let s = 0;
      if (p.nome && p.nome.length > 0) s += 15;
      if (p.cidade) s += 10;
      if (p.linkPerfil) s += 15;
      if (p.obs && p.obs.length > 50) s += 20;
      if (p.categoria) s += 15;
      if (p.cliente) s += 10;
      if (p.deadline) s += 15;
      return Math.min(s, 100);
    },

    scoreConteudoVisual: (p) => {
      let s = 0;
      const pct = checklistPct(p);
      if (pct >= 80) s += 30;
      else if (pct >= 60) s += 20;
      else if (pct >= 40) s += 15;
      else if (pct > 0) s += 10;

      if (p.checklist && p.checklist.logo_capa) s += 20;
      if (p.checklist && p.checklist.fotos) s += 20;
      if (p.checklist && p.checklist.servicos) s += 20;

      return Math.min(s, 100);
    },

    scoreConteudoTextual: (p) => {
      let s = 0;
      if (p.checklist && p.checklist.descricao) s += 25;
      if (p.checklist && p.checklist.servicos) s += 20;

      const posts30 = getPostsPerfil(p.id, 30).length;
      if (posts30 >= 8) s += 25;
      else if (posts30 >= 4) s += 20;
      else if (posts30 > 0) s += 10;

      if (p.checklist && p.checklist.post_inicial) s += 20;

      return Math.min(s, 100);
    },

    scoreReputacao: (p) => {
      let s = 0;
      const avals = getAvaliacoesPerfil(p.id);
      const avCount = avals.length;

      if (avCount >= 50) s += 20;
      else if (avCount >= 20) s += 15;
      else if (avCount >= 5) s += 10;

      if (avCount > 0) {
        const media = avals.reduce((sum, a) => sum + (Number(a.nota) || 0), 0) / avCount;
        if (media >= 4.5) s += 25;
        else if (media >= 4.0) s += 20;
        else if (media >= 3.5) s += 15;
        else if (media >= 3.0) s += 10;
      }

      const respondidas = avals.filter((a) => a.respondida).length;
      if (respondidas === avCount && avCount > 0) s += 25;
      else if (respondidas > 0) s += 10;

      return Math.min(s, 100);
    },

    scoreAtividade: (p) => {
      let s = 0;
      const posts30 = getPostsPerfil(p.id, 30).length;
      if (posts30 >= 8) s += 35;
      else if (posts30 >= 4) s += 25;
      else if (posts30 > 0) s += 15;

      const avals = getAvaliacoesPerfil(p.id);
      if (avals.length > 0) {
        const taxaResp = avals.filter((a) => a.respondida).length / avals.length;
        if (taxaResp >= 0.8) s += 35;
        else if (taxaResp >= 0.5) s += 20;
      }

      const subs = getSubElementos(p.id);
      const subFeit = subs.filter((s) => s.feito).length;
      if (subFeit > 0) s += 30;

      return Math.min(s, 100);
    },

    scoreEngajamento: (p) => {
      let s = 0;
      const subElements = getSubElementos(p.id);
      const totalSubs = subElements.length;

      if (totalSubs >= 10) s += 30;
      else if (totalSubs >= 5) s += 20;
      else if (totalSubs > 0) s += 10;

      const subFeit = subElements.filter((s) => s.feito).length;
      const subPct = totalSubs ? (subFeit / totalSubs) : 0;
      if (subPct >= 0.8) s += 30;
      else if (subPct >= 0.5) s += 20;

      s += 20;

      return Math.min(s, 100);
    },

    scoreOtimizacao: (p) => {
      let s = 0;
      if (p.categoria) s += 20;
      if (p.checklist && p.checklist.horarios) s += 15;
      if (p.linkPerfil) s += 15;

      const checklist = p.checklist || {};
      const checkCount = Object.keys(checklist).filter((k) => checklist[k]).length;
      if (checkCount >= 10) s += 15;
      else if (checkCount >= 5) s += 10;
      else if (checkCount > 0) s += 5;

      if (p.checklist && p.checklist.atributos) s += 15;

      return Math.min(s, 100);
    },

    scoreAvaliacoes: (p) => {
      let s = 0;
      const avals = getAvaliacoesPerfil(p.id);

      if (avals.length > 0) {
        const respondidas = avals.filter((a) => a.respondida).length;
        const taxaResp = respondidas / avals.length;
        if (taxaResp === 1) s += 30;
        else if (taxaResp >= 0.8) s += 25;
        else if (taxaResp >= 0.5) s += 15;
      }

      if (p.checklist && p.checklist.aval_resp) s += 30;
      if (p.checklist && p.checklist.aval_inicial) s += 20;

      s += 20;

      return Math.min(s, 100);
    },

    scorePosicionamento: (p) => {
      let s = 0;
      const avals = getAvaliacoesPerfil(p.id);
      const avCount = avals.length;

      if (avCount >= 50) s += 30;
      else if (avCount >= 20) s += 20;
      else if (avCount >= 5) s += 10;

      if (avCount > 0) {
        const media = avals.reduce((sum, a) => sum + (Number(a.nota) || 0), 0) / avCount;
        if (media >= 4.5) s += 35;
        else if (media >= 4.0) s += 25;
        else if (media >= 3.5) s += 15;
      }

      const posts30 = getPostsPerfil(p.id, 30).length;
      if (posts30 > 0) s += 20;

      s += 15;

      return Math.min(s, 100);
    },

    scoreConformidade: (p) => {
      let s = 0;
      if (p.linkPerfil && p.linkAvaliacao) s += 35;
      else if (p.linkPerfil || p.linkAvaliacao) s += 20;

      s += 30;
      if (p.nome && p.categoria && p.cidade) s += 20;
      s += 15;

      return Math.min(s, 100);
    },

    gerarRecomendacoes: (scores, perfil) => {
      const recs = [];

      if (scores.infoBasica < 40) {
        recs.push({ titulo: 'Completar informações básicas', prioridade: 'critica', impacto: 15, acao: 'Preencha: nome, cidade, categoria, cliente' });
      }

      const pct = checklistPct(perfil);
      if (pct < 30) {
        recs.push({ titulo: 'Ativar checklist de otimização', prioridade: 'critica', impacto: 25, acao: `Apenas ${pct}% do checklist preenchido. Comece pelos itens críticos.` });
      }

      const avals = getAvaliacoesPerfil(perfil.id);
      if (avals.length < 5) {
        recs.push({ titulo: 'Coletar avaliações iniciais', prioridade: 'critica', impacto: 20, acao: `Você tem ${avals.length} avaliações. Meta: 50+. Solicite avaliações aos clientes.` });
      }

      const posts30 = getPostsPerfil(perfil.id, 30).length;
      if (posts30 === 0) {
        recs.push({ titulo: 'Publicar primeiro post', prioridade: 'importante', impacto: 15, acao: 'Poste regularmente 2x por semana para aumentar visibilidade' });
      }

      if (avals.length > 0) {
        const respondidas = avals.filter((a) => a.respondida).length;
        if (respondidas < avals.length) {
          recs.push({ titulo: 'Responder avaliações pendentes', prioridade: 'importante', impacto: 14, acao: `${avals.length - respondidas} avaliações sem resposta. Responda 100%.` });
        }
      }

      if (!perfil.linkAvaliacao) {
        recs.push({ titulo: 'Adicionar link de avaliação', prioridade: 'valiosa', impacto: 10, acao: 'Cole o link do seu perfil Google no campo de link de avaliação' });
      }

      if (pct > 30 && pct < 80) {
        recs.push({ titulo: 'Completar checklist pendente', prioridade: 'valiosa', impacto: 12, acao: `${100 - pct}% do checklist ainda não feito. Continue a otimização.` });
      }

      const subs = getSubElementos(perfil.id);
      if (subs.length === 0) {
        recs.push({ titulo: 'Criar sub-elementos de ação', prioridade: 'legal', impacto: 8, acao: 'Quebra as ações em tarefas menores para acompanhar o progresso' });
      }

      recs.sort((a, b) => {
        const prio = { critica: 0, importante: 1, valiosa: 2, legal: 3 };
        return (prio[a.prioridade] || 999) - (prio[b.prioridade] || 999) || b.impacto - a.impacto;
      });

      return recs.slice(0, 10);
    },
  };

  /* Renderizar auditoria (tela de seleção) */
  function renderAuditoria() {
    const perfisHtml = S.perfis.map(p => `
      <div class="gmn-card" onclick="GMN.setPerfilAuditoria('${p.id}')" style="cursor:pointer">
        <div class="gmn-card-top">
          <div>
            <div class="gmn-card-nome">${esc(p.nome)}</div>
            <div class="gmn-card-sub">${esc(p.categoria || '—')}</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted)">
            <i class="bi bi-chevron-right"></i>
          </div>
        </div>
      </div>
    `).join('');

    return `<div class="page-wrap">
      <div class="page-header">
        <h1>🔍 Auditoria GBP</h1>
        <p>Análise detalhada de cada perfil Google Business</p>
      </div>

      <div style="margin-bottom:20px">
        <div class="gmn-alert">
          <i class="bi bi-info-circle"></i> Clique em um perfil para ver análise completa com score automático e recomendações.
        </div>
      </div>

      <div class="gmn-grid">
        ${perfisHtml}
      </div>
    </div>`;
  }

  /* Renderizar detalhes da auditoria */
  function renderAuditoriaDetalhes() {
    const perfilId = F.perfilAuditoria;
    const p = perfilById(perfilId);
    if (!p) return '<div class="page-wrap"><p style="color:var(--text-muted)">Perfil não encontrado</p></div>';

    const resultado = ScoringEngine.calcularScore(p);
    const { scoreGeral, scores, categoria, recomendacoes } = resultado;

    const catColors = {
      critico: { cor: 'var(--red)', label: '🔴 Crítico', bg: 'rgba(220,38,38,.1)' },
      fraco: { cor: 'var(--orange)', label: '🟠 Fraco', bg: 'rgba(234,88,12,.1)' },
      razoavel: { cor: 'var(--yellow)', label: '🟡 Razoável', bg: 'rgba(202,138,4,.1)' },
      bom: { cor: 'var(--green)', label: '🟢 Bom', bg: 'rgba(34,197,94,.1)' },
      excelente: { cor: 'var(--green)', label: '💚 Excelente', bg: 'rgba(45,206,137,.1)' },
    };

    const catInfo = catColors[categoria] || catColors.critico;

    const scoreCards = [
      { nome: 'Info. Básicas', val: scores.infoBasica },
      { nome: 'Conteúdo Visual', val: scores.conteudoVisual },
      { nome: 'Conteúdo Textual', val: scores.conteudoTextual },
      { nome: 'Reputação', val: scores.reputacao },
      { nome: 'Atividade', val: scores.atividade },
      { nome: 'Engajamento', val: scores.engajamento },
      { nome: 'Otimização', val: scores.otimizacao },
      { nome: 'Avaliações', val: scores.avaliacoes },
      { nome: 'Posicionamento', val: scores.posicionamento },
      { nome: 'Conformidade', val: scores.conformidade },
    ];

    const prioCores = {
      critica: { emoji: '🔴', bg: 'rgba(220,38,38,.1)', border: 'var(--red)' },
      importante: { emoji: '🟠', bg: 'rgba(234,88,12,.1)', border: 'var(--orange)' },
      valiosa: { emoji: '🟡', bg: 'rgba(202,138,4,.1)', border: 'var(--yellow)' },
      legal: { emoji: '🟢', bg: 'rgba(34,197,94,.1)', border: 'var(--green)' },
    };

    return `<div class="page-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <h1 style="margin:0;margin-bottom:4px">${esc(p.nome)}</h1>
          <p style="margin:0;color:var(--text-muted);font-size:13px">${esc(p.categoria || '—')} · Auditoria GBP</p>
        </div>
        <button class="btn btn-ghost" onclick="pagina='gmn-auditoria';render()"><i class="bi bi-arrow-left"></i> Voltar</button>
      </div>

      <div style="background:${catInfo.bg};border:1.5px solid ${catInfo.cor};border-radius:var(--radius-lg);padding:20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:11px;font-weight:700;color:${catInfo.cor};text-transform:uppercase;letter-spacing:.5px">Score Geral</div>
          <div style="font-size:42px;font-weight:900;color:${catInfo.cor};line-height:1">${scoreGeral}</div>
        </div>
        <div style="text-align:right;color:${catInfo.cor}">
          <div style="font-weight:700;font-size:16px">${catInfo.label}</div>
          <div style="font-size:12px;opacity:.8">0-100</div>
        </div>
      </div>

      <div class="gmn-panel" style="margin-bottom:20px">
        <div class="gmn-panel-title"><i class="bi bi-grid-3x2-gap"></i> Scores por Dimensão</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          ${scoreCards.map(sc => {
            const cor = sc.val >= 75 ? 'var(--green)' : sc.val >= 50 ? 'var(--yellow)' : 'var(--red)';
            const bg = sc.val >= 75 ? 'rgba(34,197,94,.1)' : sc.val >= 50 ? 'rgba(202,138,4,.1)' : 'rgba(220,38,38,.1)';
            return `
              <div style="background:${bg};border:1px solid ${cor};border-radius:10px;padding:12px">
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">${sc.nome}</div>
                <div style="font-size:28px;font-weight:900;color:${cor};margin-top:4px">${sc.val}</div>
                <div style="height:4px;background:var(--bg-base);border-radius:99px;margin-top:8px;overflow:hidden">
                  <div style="height:100%;background:${cor};width:${sc.val}%;border-radius:99px"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="gmn-panel">
        <div class="gmn-panel-title"><i class="bi bi-lightbulb"></i> Recomendações</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${recomendacoes.length ? recomendacoes.map((rec, i) => {
            const prio = prioCores[rec.prioridade] || prioCores.legal;
            return `
              <div style="background:${prio.bg};border-left:3px solid ${prio.border};border-radius:8px;padding:12px;border-top-left-radius:0;border-bottom-left-radius:0">
                <div style="font-weight:700;font-size:13px;margin-bottom:4px">${prio.emoji} ${rec.titulo}</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">${rec.acao}</div>
                <div style="font-size:11px;font-weight:600;color:var(--text-muted)">Impacto: +${rec.impacto}% no score</div>
              </div>
            `;
          }).join('') : '<div class="gmn-empty" style="color:var(--green)">✅ Nenhuma recomendação crítica!</div>'}
        </div>
      </div>
    </div>`;
  }

  /* ── DASHBOARD DE MÉTRICAS ──────────────────────────────────────────────── */
  function renderGMNMetricas() {
    const currentUser = window.currentRole || 'user';
    const usuarioId = currentUser === 'admin' ? (F.perfilMetricasUser || 'amanda') : currentUser;

    // Estado para armazenar perfis conectados
    if (!window._gmnMetricasState) {
      window._gmnMetricasState = {
        usuarioId: usuarioId,
        perfisConectados: [],
        carregando: false
      };

      // Inicializar OAuth e carregar perfis conectados
      if (window.GMNOAuth) {
        window.GMNOAuth.inicializar(usuarioId).then(() => {
          const perfis = window.GMNOAuth.obterPerfisConectados();
          window._gmnMetricasState.perfisConectados = perfis;
          // Renderizar novamente se houver perfis
          if (perfis.length > 0) {
            const container = document.querySelector('[data-page="gmn-metricas"]');
            if (container) {
              container.innerHTML = renderGMNMetricas();
            }
          }
        });
      }
    }

    return `
    <div class="page-wrap">
      <style>
        .gmn-metricas-header {
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .gmn-metricas-header-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px 0;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-primary);
        }
        .gmn-metricas-header-title i {
          color: #667eea;
          font-size: 22px;
        }
        .gmn-metricas-header-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
          font-weight: 500;
        }
        .gmn-metricas-controls {
          background: var(--bg-card);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          border: 1px solid var(--border);
        }
        .gmn-metricas-input-group {
          display: flex;
          gap: 10px;
          flex: 1;
          min-width: 300px;
          align-items: center;
        }
        .gmn-metricas-input-group input {
          flex: 1;
          padding: 9px 13px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 13px;
          background: var(--bg-base);
          color: var(--text-primary);
          font-family: var(--font);
        }
        .gmn-metricas-input-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .gmn-metricas-btn {
          padding: 9px 18px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .gmn-metricas-btn-primary {
          background: #667eea;
          color: white;
        }
        .gmn-metricas-btn-primary:hover {
          background: #5568d3;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        .gmn-metricas-btn-sync {
          background: #10b981;
          color: white;
        }
        .gmn-metricas-btn-sync:hover {
          background: #059669;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .gmn-metricas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .gmn-metricas-card {
          background: var(--bg-card);
          padding: 24px;
          border-radius: 12px;
          border: 1px solid var(--border);
          transition: all 0.3s;
        }
        .gmn-metricas-card:hover {
          transform: translateY(-4px);
          border-color: #667eea;
          box-shadow: 0 8px 16px rgba(0,0,0,0.08);
        }
        .gmn-metricas-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 12px;
        }
        .gmn-metricas-card-icon.icon-chamadas { background: #fce7f3; color: #ec4899; }
        .gmn-metricas-card-icon.icon-mensagens { background: #e9d5ff; color: #a855f7; }
        .gmn-metricas-card-icon.icon-direcoes { background: #dbeafe; color: #0284c7; }
        .gmn-metricas-card-icon.icon-website { background: #dcfce7; color: #16a34a; }
        .gmn-metricas-card-icon.icon-visualizacoes { background: #fee2e2; color: #dc2626; }
        .gmn-metricas-card-icon.icon-buscas { background: #fef3c7; color: #d97706; }
        .gmn-metricas-card-title {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .gmn-metricas-card-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .gmn-metricas-score-card {
          grid-column: 1 / -1;
          background: var(--bg-card);
          border: 2px solid #667eea;
          color: var(--text-primary);
          padding: 28px 32px;
          border-radius: 12px;
        }
        .gmn-metricas-score-card .gmn-metricas-card-title {
          color: var(--text-muted);
        }
        .gmn-metricas-score-card .gmn-metricas-card-value {
          font-size: 48px;
          color: #667eea;
          font-weight: 800;
        }
        .gmn-metricas-score-label {
          font-size: 12px;
          color: rgba(255,255,255,0.8);
          margin-top: 16px;
          font-weight: 500;
        }
        .gmn-metricas-chart {
          background: var(--bg-card);
          padding: 28px;
          border-radius: 12px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }
        .gmn-metricas-chart-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 20px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .gmn-metricas-chart-placeholder {
          height: 300px;
          background: var(--bg-base);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .gmn-metricas-status {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          margin-top: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .gmn-metricas-status.loading {
          background: #dbeafe;
          color: #0c4a6e;
        }
        .gmn-metricas-status.success {
          background: #d1fae5;
          color: #065f46;
        }
        .gmn-metricas-status.error {
          background: #fee2e2;
          color: #991b1b;
        }
        .gmn-metricas-panel {
          background: var(--bg-card);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid var(--border);
          margin-bottom: 24px;
        }
        .gmn-metricas-perfil-card {
          background: var(--bg-base);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
        }
        .gmn-metricas-perfil-card:hover {
          border-color: #667eea;
          background: var(--bg-card);
          transform: translateY(-2px);
        }
        .gmn-metricas-perfil-nome {
          font-weight: 600;
          font-size: 12px;
          color: var(--text-primary);
          margin-top: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gmn-metricas-perfil-id {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }
      </style>

      <div class="gmn-metricas-header">
        <div class="gmn-metricas-header-title">
          <i class="bi bi-speedometer2"></i>
          Métricas em Tempo Real
        </div>
        <div class="gmn-metricas-header-subtitle">Google My Business - Análise de desempenho do perfil</div>
      </div>

      <!-- Seção de Autenticação Google -->
      <div class="gmn-metricas-panel">
        <div style="display: flex; align-items: center; gap: 16px; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <i class="bi bi-google" style="font-size: 20px; color: #4285f4;"></i>
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Conectar com Google My Business</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Autentique para ver seus perfis e métricas em tempo real</div>
            </div>
          </div>
          <button class="gmn-metricas-btn gmn-metricas-btn-primary" onclick="if(window.GMNOAuth) window.GMNOAuth.fazerLoginGoogle()" style="white-space: nowrap;">
            <i class="bi bi-link-45deg"></i> Conectar
          </button>
        </div>
      </div>

      <!-- Perfis Conectados - Seleção -->
      <div id="gmn-perfis-conectados" style="display: none; margin-bottom: 24px;">
        <div class="gmn-metricas-panel">
          <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="bi bi-check-circle" style="color: #10b981;"></i>
            Selecione um Perfil para Gerenciar
          </div>
          <div id="gmn-perfis-lista" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;"></div>
        </div>
      </div>

      <!-- Perfil Selecionado - Header -->
      <div id="gmn-perfil-selecionado-header" style="display: none; margin-bottom: 24px;">
        <div class="gmn-metricas-panel" style="background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(65,231,243,0.1)); border: 1px solid var(--border-bright);">
          <div style="display: flex; align-items: center; gap: 16px; justify-content: space-between;">
            <div>
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Perfil Gerenciado</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);" id="gmn-perfil-nome">—</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;" id="gmn-perfil-endereco">—</div>
            </div>
            <div style="text-align: right;">
              <button class="gmn-metricas-btn gmn-metricas-btn-sync" onclick="if(window.GMNOAuth && window._gmnPerfilSelecionado) window.GMNOAuth.sincronizarMetricas(window._gmnPerfilSelecionado.perfilId)" style="white-space: nowrap;">
                <i class="bi bi-arrow-repeat"></i> Sincronizar Agora
              </button>
              <button class="gmn-metricas-btn" style="background: transparent; border: 1px solid var(--border); color: var(--text-primary); margin-top: 8px;" onclick="GMN.selecionarOutroPerfil()">
                <i class="bi bi-arrow-left"></i> Trocar Perfil
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="gmn-metricas-grid">
        <div class="gmn-metricas-card gmn-metricas-score-card">
          <div class="gmn-metricas-card-title">Score Geral do Perfil</div>
          <div class="gmn-metricas-card-value" id="scoreValue">--</div>
          <div class="gmn-metricas-score-label">Última atualização: <span id="lastUpdate">--</span></div>
        </div>

        <div class="gmn-metricas-card">
          <div class="gmn-metricas-card-icon icon-chamadas">
            <i class="bi bi-telephone"></i>
          </div>
          <div class="gmn-metricas-card-title">Chamadas</div>
          <div class="gmn-metricas-card-value" id="chamadas">0</div>
        </div>

        <div class="gmn-metricas-card">
          <div class="gmn-metricas-card-icon icon-mensagens">
            <i class="bi bi-chat-dots"></i>
          </div>
          <div class="gmn-metricas-card-title">Mensagens</div>
          <div class="gmn-metricas-card-value" id="mensagens">0</div>
        </div>

        <div class="gmn-metricas-card">
          <div class="gmn-metricas-card-icon icon-direcoes">
            <i class="bi bi-compass"></i>
          </div>
          <div class="gmn-metricas-card-title">Direções</div>
          <div class="gmn-metricas-card-value" id="direcoes">0</div>
        </div>

        <div class="gmn-metricas-card">
          <div class="gmn-metricas-card-icon icon-website">
            <i class="bi bi-globe"></i>
          </div>
          <div class="gmn-metricas-card-title">Website Clicks</div>
          <div class="gmn-metricas-card-value" id="websiteClicks">0</div>
        </div>

        <div class="gmn-metricas-card">
          <div class="gmn-metricas-card-icon icon-visualizacoes">
            <i class="bi bi-eye"></i>
          </div>
          <div class="gmn-metricas-card-title">Visualizações</div>
          <div class="gmn-metricas-card-value" id="visualizacoes">0</div>
        </div>

        <div class="gmn-metricas-card">
          <div class="gmn-metricas-card-icon icon-buscas">
            <i class="bi bi-search"></i>
          </div>
          <div class="gmn-metricas-card-title">Buscas Locais</div>
          <div class="gmn-metricas-card-value" id="buscasLocais">0</div>
        </div>
      </div>

      <div class="gmn-metricas-chart">
        <div class="gmn-metricas-chart-title">
          <i class="bi bi-graph-up"></i>
          Evolução das Métricas
        </div>
        <div class="gmn-metricas-chart-placeholder">Gráfico de evolução (próxima versão)</div>
      </div>

      <div id="metricas-status"></div>
    </div>
    `;
  }

  // Adicionar hook para inicializar após renderizar
  const originalRender = GMN.render;
  GMN.render = function() {
    const result = originalRender.call(this);
    if (pagina === 'gmn-metricas') {
      setTimeout(() => {
        if (window.GMN && window.GMN.inicializarDashboardMetricas) {
          window.GMN.inicializarDashboardMetricas();
        }
      }, 100);
    }
    return result;
  };

  /* ── Funções de API para Métricas ────────────────────────────────────────── */
  GMN.carregarMetricas = async function() {
    const perfilId = document.getElementById('perfilIdInput')?.value;
    if (!perfilId) {
      GMN.mostrarStatusMetrica('Por favor, digite um ID de perfil', 'error');
      return;
    }

    GMN.mostrarStatusMetrica('Carregando...', 'loading');

    try {
      const response = await fetch(`/api/sync-metricas/${perfilId}/hoje`);
      const data = await response.json();

      if (data.metricas) {
        GMN.atualizarDashboardMetricas(data.metricas);
        GMN.mostrarStatusMetrica('✅ Métricas carregadas com sucesso!', 'success');
      } else {
        GMN.mostrarStatusMetrica('Nenhuma métrica encontrada para este perfil', 'error');
      }
    } catch (error) {
      GMN.mostrarStatusMetrica('❌ Erro ao carregar: ' + error.message, 'error');
    }
  };

  GMN.sincronizarMetricas = async function() {
    const perfilId = document.getElementById('perfilIdInput')?.value;
    if (!perfilId) {
      GMN.mostrarStatusMetrica('Por favor, digite um ID de perfil', 'error');
      return;
    }

    GMN.mostrarStatusMetrica('Sincronizando com Google...', 'loading');

    try {
      const response = await fetch('/api/sync-metricas/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: window.currentRole || 'user',
          perfilId: perfilId
        })
      });

      const data = await response.json();

      if (data.success && data.metricas) {
        GMN.atualizarDashboardMetricas(data.metricas);
        GMN.mostrarStatusMetrica('✅ Sincronização completa!', 'success');
      } else {
        GMN.mostrarStatusMetrica('❌ Erro na sincronização', 'error');
      }
    } catch (error) {
      GMN.mostrarStatusMetrica('❌ Erro: ' + error.message, 'error');
    }
  };

  GMN.atualizarDashboardMetricas = function(metricas) {
    document.getElementById('chamadas').textContent = metricas.chamadas || 0;
    document.getElementById('mensagens').textContent = metricas.mensagens || 0;
    document.getElementById('direcoes').textContent = metricas.direcoes || 0;
    document.getElementById('websiteClicks').textContent = metricas.websiteClicks || 0;
    document.getElementById('visualizacoes').textContent = metricas.visualizacoes || 0;
    document.getElementById('buscasLocais').textContent = metricas.buscasLocais || 0;

    const total = (metricas.chamadas || 0) + (metricas.mensagens || 0) + (metricas.direcoes || 0);
    const score = Math.min(100, Math.floor((total / 10)));
    document.getElementById('scoreValue').textContent = score;

    const agora = new Date().toLocaleString('pt-BR');
    document.getElementById('lastUpdate').textContent = agora;
  };

  GMN.mostrarStatusMetrica = function(mensagem, tipo) {
    const statusDiv = document.getElementById('metricas-status');
    if (statusDiv) {
      statusDiv.innerHTML = `<div class="metricas-status ${tipo}">${mensagem}</div>`;
    }
  };

  /* ── OAuth Google ─────────────────────────────────────────────────────── */
  GMN.conectarGoogle = async function() {
    try {
      GMN.mostrarStatusMetrica('Redirecionando para Google...', 'loading');

      // Obter URL de autenticação do servidor
      const response = await fetch(`/api/auth/google/url?usuarioId=${encodeURIComponent(window._gmnMetricasState.usuarioId)}`);
      const data = await response.json();

      if (data.url) {
        // Redirecionar para Google OAuth
        window.location.href = data.url;
      } else if (data.error) {
        // Mostrar erro claro se credenciais não estão configuradas
        let mensagem = data.error;
        if (data.message) mensagem += '\n' + data.message;
        if (data.docs) mensagem += '\n\nConsulte: ' + data.docs;
        GMN.mostrarStatusMetrica(mensagem, 'error');
      } else {
        GMN.mostrarStatusMetrica('Erro ao obter URL de autenticação', 'error');
      }
    } catch (error) {
      GMN.mostrarStatusMetrica('Erro ao conectar Google: ' + error.message, 'error');
    }
  };

  /* ── Carregar Perfis Conectados ──────────────────────────────────────── */
  GMN.carregarPerfisConectados = async function() {
    try {
      const response = await fetch(`/api/auth/google/perfis-do-usuario?usuarioId=${encodeURIComponent(window._gmnMetricasState.usuarioId)}`);
      const data = await response.json();

      if (data.perfis && data.perfis.length > 0) {
        window._gmnMetricasState.perfisConectados = data.perfis;
        GMN.renderizarPerfisConectados();

        // Se houver tokens com accessToken, buscar perfis reais do GMB
        const perfisComToken = data.perfis.filter(p => p.accessToken);
        if (perfisComToken.length > 0) {
          GMN.buscarPerfisGMBReais(perfisComToken[0].accessToken);
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar perfis:', error);
    }
  };

  /* ── Renderizar Perfis Conectados ───────────────────────────────────── */
  GMN.renderizarPerfisConectados = function() {
    const perfis = window._gmnMetricasState.perfisConectados;
    const container = document.getElementById('gmn-perfis-conectados');
    const lista = document.getElementById('gmn-perfis-lista');

    if (!perfis || perfis.length === 0) {
      if (container) container.style.display = 'none';
      return;
    }

    if (container) container.style.display = 'block';

    if (lista) {
      lista.innerHTML = perfis.map(perfil => {
        const id = perfil.perfilId || perfil.id || '';
        const nome = perfil.nomeExibicao || perfil.displayName || 'Sem nome';
        const endereco = perfil.endereco || perfil.address?.addressLines?.[0] || '';
        const telefone = perfil.telefone || perfil.primaryPhone || '';
        const nomeEscapado = nome.replace(/'/g, "\\'");

        return `
        <div class="gmn-metricas-perfil-card" onclick="if(window.GMN) window.GMN.selecionarPerfil('${id}', '${nomeEscapado}')">
          <div style="font-size: 24px; margin-bottom: 8px; color: #667eea;">
            <i class="bi bi-shop"></i>
          </div>
          <div class="gmn-metricas-perfil-nome" title="${nome}">${nome}</div>
          ${endereco ? `<div class="gmn-metricas-perfil-id" title="${endereco}" style="font-size: 11px; margin-top: 4px;"><i class="bi bi-geo-alt" style="font-size: 10px; margin-right: 3px;"></i>${endereco.substring(0, 25)}${endereco.length > 25 ? '...' : ''}</div>` : ''}
          ${telefone ? `<div class="gmn-metricas-perfil-id" style="font-size: 11px; margin-top: 2px;"><i class="bi bi-telephone" style="font-size: 10px; margin-right: 3px;"></i>${telefone}</div>` : ''}
        </div>
        `;
      }).join('');
    }
  };

  /* ── Selecionar Perfil ──────────────────────────────────────────────── */
  GMN.selecionarPerfil = function(perfilId, nomeExibicao) {
    // Armazenar perfil selecionado
    window._gmnPerfilSelecionado = {
      perfilId,
      nomeExibicao
    };

    // Procurar dados do perfil na lista
    const perfis = window._gmnMetricasState.perfisConectados || [];
    const perfilDados = perfis.find(p => (p.perfilId || p.id) === perfilId);

    // Mostrar header com informações do perfil
    const headerContainer = document.getElementById('gmn-perfil-selecionado-header');
    const listaContainer = document.getElementById('gmn-perfis-conectados');

    if (headerContainer) {
      document.getElementById('gmn-perfil-nome').textContent = nomeExibicao || 'Carregando...';
      document.getElementById('gmn-perfil-endereco').textContent = perfilDados?.endereco || '';
      headerContainer.style.display = 'block';
    }

    // Esconder lista de perfis
    if (listaContainer) {
      listaContainer.style.display = 'none';
    }

    // Carregar métricas do perfil
    document.getElementById('perfilIdInput').value = perfilId;
    GMN.carregarMetricas();
  };

  /* ── Selecion Outro Perfil ──────────────────────────────────────────── */
  GMN.selecionarOutroPerfil = function() {
    window._gmnPerfilSelecionado = null;
    const headerContainer = document.getElementById('gmn-perfil-selecionado-header');
    const listaContainer = document.getElementById('gmn-perfis-conectados');

    if (headerContainer) headerContainer.style.display = 'none';
    if (listaContainer) listaContainer.style.display = 'block';
  };

  /* ── Buscar Perfis Reais do Google My Business ──────────────────────── */
  GMN.buscarPerfisGMBReais = async function(accessToken) {
    try {
      const response = await fetch(`/api/auth/google/buscar-perfis?accessToken=${encodeURIComponent(accessToken)}`);
      const data = await response.json();

      if (data.sucesso && data.perfis && data.perfis.length > 0) {
        // Combinar com perfis já armazenados, priorizando os reais
        const perfisReais = data.perfis.map(p => ({
          ...p,
          id: p.perfilId,
          tipo: 'real'
        }));

        window._gmnMetricasState.perfisConectados = perfisReais;
        GMN.renderizarPerfisConectados();
      }
    } catch (error) {
      console.warn('Erro ao buscar perfis reais do GMB:', error);
    }
  };

  /* ── Inicializar Dashboard ──────────────────────────────────────────── */
  GMN.inicializarDashboardMetricas = function() {
    // Verificar se há um accessToken no sessionStorage (após OAuth)
    const accessToken = sessionStorage.getItem('gmnAccessToken');
    if (accessToken) {
      // Buscar perfis reais do Google My Business
      GMN.buscarPerfisGMBReais(accessToken);
      sessionStorage.removeItem('gmnAccessToken'); // Limpar após usar
    } else {
      // Carregar perfis conectados ao abrir o dashboard
      GMN.carregarPerfisConectados();
    }
  };
})();
