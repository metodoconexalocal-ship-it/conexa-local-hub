/**
 * Projetos — tarefas do dia por cliente.
 * Projetos podem ser agrupados, reordenados por arrastar (com previa do espaço),
 * vinculados a um cliente da base e receber etiquetas. Ditado por voz cria tarefas.
 * Dados em Firestore: gmn_checklist_projetos, gmn_checklist_grupos, gmn_checklist_ditados.
 */
window.Checklist = (() => {
  const COL = 'gmn_checklist_projetos';
  const COL_GRUPOS = 'gmn_checklist_grupos';
  const COL_DITADOS = 'gmn_checklist_ditados';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const uid = () => Math.random().toString(36).slice(2, 10);

  // Transcrição da folha (itens com ? podem precisar de ajuste)
  const SEED = [
    ['Daniele Cenotti', ['Subir tudo', 'Finalizar', 'Cartão + Ebook', 'Continuidade', 'Carrossel']],
    ['Virginia (2 perfis)', ['Diagnóstico', 'Contrato', 'Antes?']],
    ['Dra Keytte', ['Diagnóstico', 'Contrato', 'Antes', 'Onboarding (semana que vem)']],
    ['Adson V', ['Cartão visita', 'PDF', 'Pauta reunião', 'Ebook', 'Apresentação', 'Cartão NFC', 'Aplicações?']],
    ['Fábio Inter', ['IA', 'Whats', 'Apresentação']],
    ['Memnosvika', ['IA', 'Apresentação', 'Verificação lide?']],
    ['Stela', []],
    ['Salete', ['E-commerce?', 'Logo vetor', 'Whatsapp', '45x40 arte']],
    ['Mottaview?', ['Relatório mensal', 'Fazer cliente?', 'OAuth com cartão?']],
    ['Aura Bem', ['Criativo', 'Google', 'Site institucional', 'Perfis meninas', 'Posts', 'Reels editadas']],
    ['Carla Brocco', ['Conversão site', 'Site teste financeiro?', 'Link bio', 'Planilha ebook', 'Ebook', 'Google']],
    ['Bella Verona', ['Proposta']],
    ['DC', ['Google', 'Insta', 'Post', 'Reels']],
    ['BNI', ['Eu indico artes', 'Post aniversário', 'Carrossel Francisco', 'Palestra Cristiano', 'Link da biografia', 'Capa reels', 'Eu indico', 'Passar resultado informativo com orientação', 'Mensagens organização']],
    ['Cherryverse', ['Insta', 'Site', 'Convite']],
  ];

  let projetos = [];
  let grupos = [];
  let ditados = [];
  let gravando = null;
  let pendente = null;      // { projetoId, texto, falado } aguardando confirmação
  let arrastando = null;    // id do projeto que está sendo arrastado
  let previa = null;        // elemento que mostra onde o projeto vai cair
  let alturaArrasto = 0;
  let formulario = null;    // { tipo: 'novo-projeto' | 'novo-grupo' | 'renomear', id? }
  let confirmando = null;   // 'p:<id>' ou 'g:<id>' aguardando segundo clique para excluir
  let blocoNome = '';
  let blocoProjetos = [];

  const $ = (id) => document.getElementById(id);
  const main = () => $('main-content');
  const porOrdem = (lista) => [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const clientes = () => (typeof clientsData !== 'undefined' ? clientsData : [])
    .filter((c) => !c.archived)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  const projetoPorId = (id) => projetos.find((p) => p.id === id);
  const grupoPorId = (id) => grupos.find((g) => g.id === id);
  const aviso = (msg) => { const el = $('ck-speech'); if (el) el.textContent = msg; };

  async function carregar() {
    projetos = porOrdem((await window.dbList(COL, 'ordem', 'asc')) || []);
    grupos = porOrdem((await window.dbList(COL_GRUPOS, 'ordem', 'asc').catch(() => [])) || []);
    if (!projetos.length && !localStorage.getItem('_checklistSeedFeito')) {
      localStorage.setItem('_checklistSeedFeito', '1');
      for (let i = 0; i < SEED.length; i++) {
        const [nome, lista] = SEED[i];
        const tarefas = lista.map((t) => ({ id: uid(), texto: t, feita: false }));
        await window.dbSave(COL, { nome, ordem: i, grupo: '', etiquetas: [], tarefas });
      }
      projetos = porOrdem((await window.dbList(COL, 'ordem', 'asc')) || []);
    }
    ditados = (await window.dbList(COL_DITADOS, 'criadoEm', 'desc').catch(() => [])) || [];
  }

  async function salvar(p, campos) {
    await window.dbSave(COL, { id: p.id, ...campos });
    Object.assign(p, campos);
  }

  // ── Renderização ───────────────────────────────────────────────────────────
  function formularioHTML(tipo) {
    const ph = tipo === 'novo-grupo' ? 'Nome do grupo (ex.: Recorrente)' : 'Nome do projeto (ex.: nome da empresa)';
    const botao = tipo === 'novo-grupo' ? 'Criar grupo' : 'Criar projeto';
    return `
    <div class="ck-form">
      <input id="ck-form-input" placeholder="${ph}" onkeydown="Checklist.teclaForm(event)" autocomplete="off">
      <button class="ck-btn ck-btn-primary" onclick="Checklist.salvarForm()">${botao}</button>
      <button class="ck-btn" onclick="Checklist.cancelarForm()">Cancelar</button>
    </div>`;
  }

  function cardHTML(p) {
    const total = p.tarefas.length;
    const feitas = p.tarefas.filter((t) => t.feita).length;
    const cliente = clientes().find((c) => c.id === p.clienteId);
    const renomeando = formulario && formulario.tipo === 'renomear' && formulario.id === p.id;
    const excluindo = confirmando === 'p:' + p.id;
    return `
    <div class="ck-card" data-id="${p.id}" draggable="true" ondragstart="Checklist.dragStart(event,'${p.id}')" ondragend="Checklist.dragEnd()" ondragover="Checklist.dragOverCard(event,'${p.id}')" ondrop="Checklist.dropCard(event,'${p.id}')">
      <div class="ck-card-head">
        ${renomeando
          ? `<input id="ck-form-input" class="ck-rename" value="${esc(p.nome)}" onkeydown="Checklist.teclaForm(event)" onblur="Checklist.salvarForm()">`
          : `<h3 title="Clique para renomear" onclick="Checklist.abrirForm('renomear','${p.id}')">${esc(p.nome)}</h3>`}
        <button class="ck-x ${excluindo ? 'ck-x-confirmar' : ''}" title="${excluindo ? 'Clique de novo para excluir' : 'Excluir projeto'}" onclick="Checklist.excluirProjeto('${p.id}')">${excluindo ? 'Confirmar' : '<i class="bi bi-trash"></i>'}</button>
      </div>
      <div class="ck-meta">
        <select title="Cliente da base" onchange="Checklist.definirCliente('${p.id}', this.value)">
          <option value="">Sem cliente</option>
          ${clientes().map((c) => `<option value="${esc(c.id)}" ${c.id === p.clienteId ? 'selected' : ''}>${esc(c.nome)}${c.empresa ? ' · ' + esc(c.empresa) : ''}</option>`).join('')}
        </select>
        <select title="Grupo" onchange="Checklist.moverParaGrupo('${p.id}', this.value)">
          <option value="">Sem grupo</option>
          ${grupos.map((g) => `<option value="${esc(g.id)}" ${g.id === p.grupo ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="ck-etiquetas">
        ${(p.etiquetas || []).map((e, i) => `<span class="ck-tag">${esc(e)} <button onclick="Checklist.removerEtiqueta('${p.id}', ${i})">×</button></span>`).join('')}
        <input class="ck-tag-input" placeholder="+ etiqueta" onkeydown="if(event.key==='Enter')Checklist.adicionarEtiqueta('${p.id}', this)">
      </div>
      <div class="ck-prog"><span>${feitas} de ${total} feitas</span>${total ? `<div class="ck-barra"><div style="width:${Math.round((feitas / total) * 100)}%"></div></div>` : ''}</div>
      ${total ? p.tarefas.map((t) => `
        <div class="ck-item ${t.feita ? 'feita' : ''}">
          <input type="checkbox" ${t.feita ? 'checked' : ''} onchange="Checklist.alternar('${p.id}','${t.id}')">
          <span>${esc(t.texto)}</span>
          <button class="ck-x" title="Remover tarefa" onclick="Checklist.remover('${p.id}','${t.id}')">✕</button>
        </div>`).join('') : '<div class="ck-vazio">Sem tarefas</div>'}
      <div class="ck-add">
        <input id="add-${p.id}" placeholder="Nova tarefa" onkeydown="if(event.key==='Enter')Checklist.adicionar('${p.id}')">
        <button class="ck-btn" onclick="Checklist.adicionar('${p.id}')">Adicionar</button>
      </div>
      ${cliente ? `<div class="ck-cliente"><i class="bi bi-person"></i> ${esc(cliente.nome)}</div>` : ''}
    </div>`;
  }

  function secaoHTML(g) {
    const lista = porOrdem(projetos.filter((p) => (p.grupo || '') === g.id));
    const excluindo = g.id && confirmando === 'g:' + g.id;
    return `
    <section class="ck-secao" data-grupo="${g.id}" ondragover="Checklist.dragOverSecao(event)" ondrop="Checklist.dropSecao(event,'${g.id}')">
      <div class="ck-secao-head">
        <span>${esc(g.nome)}</span>
        <small>${lista.length} projeto${lista.length !== 1 ? 's' : ''}</small>
        ${g.id ? `<button class="ck-btn ck-btn-sm ${excluindo ? 'ck-btn-perigo' : ''}" onclick="Checklist.excluirGrupo('${g.id}')">${excluindo ? 'Confirmar exclusão' : 'Excluir grupo'}</button>` : ''}
      </div>
      <div class="ck-grid">
        ${lista.map(cardHTML).join('') || '<div class="ck-vazio ck-drop">Arraste projetos para este grupo</div>'}
      </div>
    </section>`;
  }

  function render() {
    const total = projetos.reduce((t, p) => t + p.tarefas.length, 0);
    const feitas = projetos.reduce((t, p) => t + p.tarefas.filter((x) => x.feita).length, 0);
    main().innerHTML = `
    <div class="page-wrap">
      <style>
        .ck-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .ck-title{font-size:18px;font-weight:700;color:var(--text-primary);flex:1}
        .ck-resumo{font-size:12px;color:var(--text-muted)}
        .ck-btn{border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px}
        .ck-btn:hover{border-color:var(--text-muted)}
        .ck-btn-sm{padding:3px 10px;font-size:11px}
        .ck-btn-primary{background:var(--accent);color:#fff;border-color:var(--accent)}
        .ck-btn-rec{background:#dc2626;color:#fff;border-color:#dc2626}
        .ck-btn-perigo{background:#dc2626;color:#fff;border-color:#dc2626}
        .ck-form{display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px}
        .ck-form input{flex:1;min-width:220px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card2);color:var(--text-primary);font-size:13px}
        .ck-secao{margin-bottom:24px}
        .ck-secao-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:14px;font-weight:600;color:var(--text-primary);padding-bottom:6px;border-bottom:1px solid var(--border)}
        .ck-secao-head small{font-weight:400;color:var(--text-muted)}
        .ck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;min-height:40px;align-items:start}
        .ck-card{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:grab;transition:opacity .15s}
        .ck-card:active{cursor:grabbing}
        .ck-card.ck-dragging{opacity:.35}
        .ck-ph{border:2px dashed var(--accent);border-radius:10px;background:rgba(124,92,252,.06);pointer-events:none;transition:height .12s}
        .ck-card-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
        .ck-card-head h3{font-size:14px;margin:0;color:var(--text-primary);flex:1;cursor:text}
        .ck-rename{flex:1;padding:4px 8px;border-radius:6px;border:1px solid var(--accent);background:var(--bg-card2);color:var(--text-primary);font-size:14px;font-weight:600}
        .ck-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
        .ck-meta select,.ck-tag-input,.ck-add input{padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card2);color:var(--text-primary);font-size:12px;min-width:0}
        .ck-etiquetas{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:8px}
        .ck-tag{font-size:11px;background:var(--bg-card2);color:var(--text-secondary);padding:2px 8px;border-radius:6px;border:1px solid var(--border)}
        .ck-tag button{background:none;border:none;color:inherit;cursor:pointer;padding:0 0 0 2px}
        .ck-tag-input{width:90px}
        .ck-prog{display:flex;align-items:center;gap:8px;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px}
        .ck-barra{flex:1;height:4px;background:var(--bg-card2);border-radius:4px;overflow:hidden;max-width:110px}
        .ck-barra div{height:100%;background:var(--accent)}
        .ck-item{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:var(--text-primary)}
        .ck-item.feita span{text-decoration:line-through;color:var(--text-muted)}
        .ck-item span{flex:1}
        .ck-x{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:2px 4px}
        .ck-x:hover{color:var(--text-primary)}
        .ck-x-confirmar{color:#dc2626;font-size:11px;font-weight:600}
        .ck-add{display:flex;gap:6px;margin-top:8px}
        .ck-add input{flex:1}
        .ck-cliente{font-size:11px;color:var(--text-muted);margin-top:8px}
        .ck-vazio{font-size:12px;color:var(--text-muted);padding:6px 2px}
        .ck-drop{border:1px dashed var(--border);border-radius:10px;padding:14px;text-align:center}
        .ck-pend{background:var(--bg-card);border:1px solid var(--accent);border-radius:10px;padding:14px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px}
        .ck-hist{margin-top:22px;font-size:12px;color:var(--text-secondary)}
        .ck-hist li{margin-bottom:4px}
        .ck-speech{font-size:12px;color:var(--text-muted);margin:6px 0;min-height:16px}
      </style>

      <div class="ck-head">
        <div class="ck-title">Projetos — tarefas do dia</div>
        <div class="ck-resumo">${feitas} de ${total} tarefas feitas</div>
        <button class="ck-btn" onclick="Checklist.abrirForm('novo-grupo')"><i class="bi bi-folder-plus"></i> Novo grupo</button>
        <button class="ck-btn" onclick="Checklist.abrirForm('novo-projeto')"><i class="bi bi-plus-lg"></i> Novo projeto</button>
        <button class="ck-btn ${gravando ? 'ck-btn-rec' : 'ck-btn-primary'}" onclick="Checklist.alternarDitado()">
          <i class="bi ${gravando ? 'bi-stop-circle' : 'bi-mic'}"></i> ${gravando ? 'Parar' : 'Ditar tarefa'}
        </button>
      </div>
      <div class="ck-speech" id="ck-speech"></div>

      ${formulario && formulario.tipo !== 'renomear' ? formularioHTML(formulario.tipo) : ''}

      ${pendente ? `
      <div class="ck-pend">
        <div style="font-size:12px;color:var(--text-muted)">Confira antes de salvar:</div>
        <select id="ck-pend-proj">
          <option value="">Escolha o projeto</option>
          ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === pendente.projetoId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
        </select>
        <input id="ck-pend-texto" value="${esc(pendente.texto)}" placeholder="Texto da tarefa">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="ck-btn" onclick="Checklist.descartarDitado()">Descartar</button>
          <button class="ck-btn ck-btn-primary" onclick="Checklist.confirmarDitado()">Salvar tarefa</button>
        </div>
      </div>` : ''}

      ${grupos.map(secaoHTML).join('')}
      ${secaoHTML({ id: '', nome: 'Sem grupo' })}

      <div class="ck-hist">
        <strong>Últimas tarefas criadas por ditado</strong>
        <ul>${ditados.slice(0, 15).map((d) => `<li>${esc(new Date(d.criadoEm).toLocaleString('pt-BR'))} — <b>${esc(d.projetoNome)}</b>: ${esc(d.texto)} <i style="color:var(--text-muted)">(falou: “${esc(d.falado)}”)</i></li>`).join('') || '<li>Nenhuma ainda.</li>'}</ul>
      </div>
    </div>`;
    if (formulario) setTimeout(() => { const el = $('ck-form-input'); if (el) el.focus(); }, 0);
  }

  // ── Formulários inline (no lugar de janelas do navegador) ─────────────────
  function abrirForm(tipo, id) {
    formulario = { tipo, id };
    render();
  }

  function cancelarForm() {
    formulario = null;
    render();
  }

  function teclaForm(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); salvarForm(); }
    if (ev.key === 'Escape') cancelarForm();
  }

  async function salvarForm() {
    if (!formulario) return;
    const valor = ($('ck-form-input')?.value || '').trim();
    const f = formulario;
    formulario = null;
    if (!valor) return render();
    if (f.tipo === 'novo-grupo') {
      const campos = { nome: valor, ordem: grupos.length };
      const id = await window.dbSave(COL_GRUPOS, campos);
      grupos.push({ id, ...campos });
    } else if (f.tipo === 'novo-projeto') {
      const campos = { nome: valor, ordem: projetos.length, grupo: '', etiquetas: [], tarefas: [] };
      const id = await window.dbSave(COL, campos);
      projetos.push({ id, ...campos });
    } else if (f.tipo === 'renomear') {
      const p = projetoPorId(f.id);
      if (p && valor !== p.nome) await salvar(p, { nome: valor });
    }
    render();
  }

  // ── Tarefas ────────────────────────────────────────────────────────────────
  async function alternar(projetoId, tarefaId) {
    const p = projetoPorId(projetoId);
    const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!t) return;
    t.feita = !t.feita;
    await salvar(p, { tarefas: p.tarefas });
    render();
  }

  async function remover(projetoId, tarefaId) {
    const p = projetoPorId(projetoId);
    if (!p) return;
    await salvar(p, { tarefas: p.tarefas.filter((x) => x.id !== tarefaId) });
    render();
  }

  async function adicionar(projetoId) {
    const texto = $(`add-${projetoId}`)?.value.trim();
    if (!texto) return;
    const p = projetoPorId(projetoId);
    await salvar(p, { tarefas: [...p.tarefas, { id: uid(), texto, feita: false }] });
    render();
  }

  // ── Projetos e grupos ──────────────────────────────────────────────────────
  // Excluir pede um segundo clique (sem janela do navegador)
  function pedirConfirmacao(chave, executar) {
    if (confirmando !== chave) {
      confirmando = chave;
      render();
      setTimeout(() => { if (confirmando === chave) { confirmando = null; render(); } }, 4000);
      return;
    }
    confirmando = null;
    executar();
  }

  async function excluirProjeto(id) {
    pedirConfirmacao('p:' + id, async () => {
      await window.dbDelete(COL, id);
      projetos = projetos.filter((x) => x.id !== id);
      render();
    });
  }

  async function definirCliente(id, clienteId) {
    await salvar(projetoPorId(id), { clienteId: clienteId || '' });
    render();
  }

  async function adicionarEtiqueta(id, input) {
    const texto = input.value.trim();
    if (!texto) return;
    const p = projetoPorId(id);
    await salvar(p, { etiquetas: [...(p.etiquetas || []), texto] });
    render();
  }

  async function removerEtiqueta(id, indice) {
    const p = projetoPorId(id);
    await salvar(p, { etiquetas: (p.etiquetas || []).filter((_, i) => i !== indice) });
    render();
  }

  async function excluirGrupo(id) {
    const g = grupoPorId(id);
    pedirConfirmacao('g:' + id, async () => {
      await window.dbDelete(COL_GRUPOS, id);
      grupos = grupos.filter((x) => x.id !== id);
      for (const p of projetos.filter((x) => x.grupo === id)) await salvar(p, { grupo: '' });
      render();
    });
  }

  async function moverParaGrupo(id, grupoId) {
    await salvar(projetoPorId(id), { grupo: grupoId || '' });
    render();
  }

  // ── Arrastar e soltar com previa ───────────────────────────────────────────
  // Ao passar sobre um projeto, uma caixa tracejada aparece na posição em que ele vai cair,
  // e os outros projetos se afastam para abrir o espaço.
  function obterPrevia() {
    if (!previa) {
      previa = document.createElement('div');
      previa.className = 'ck-ph';
    }
    previa.style.height = alturaArrasto + 'px';
    return previa;
  }

  function limparArrasto() {
    if (previa) previa.remove();
    previa = null;
    arrastando = null;
    document.querySelectorAll('.ck-card.ck-dragging').forEach((el) => el.classList.remove('ck-dragging'));
  }

  function dragStart(ev, id) {
    arrastando = id;
    const card = ev.currentTarget;
    alturaArrasto = card ? card.offsetHeight : 0;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', id);
    // Adia a marcação para o navegador já ter tirado a "foto" do card
    if (card) setTimeout(() => card.classList.add('ck-dragging'), 0);
  }

  function dragEnd() { limparArrasto(); }

  function dragOverCard(ev, id) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!arrastando || id === arrastando) return;
    const card = ev.currentTarget;
    const meio = card.getBoundingClientRect().top + card.offsetHeight / 2;
    const ph = obterPrevia();
    if (ev.clientY > meio) card.after(ph);
    else card.before(ph);
  }

  function dragOverSecao(ev) {
    ev.preventDefault();
    if (!arrastando) return;
    if (ev.target.closest && ev.target.closest('.ck-card')) return; // tratado pelo card
    const grade = ev.currentTarget.querySelector('.ck-grid');
    if (!grade) return;
    // Remove o texto de "arraste aqui" quando a previa entra no grupo
    grade.querySelectorAll('.ck-drop').forEach((el) => el.remove());
    if (!obterPrevia().isConnected || previa.parentElement !== grade) grade.appendChild(obterPrevia());
  }

  // Calcula onde o projeto arrastado vai parar a partir da previa
  function destinoDaPrevia() {
    if (!previa || !previa.isConnected) return null;
    const secao = previa.closest('.ck-secao');
    const grupo = secao?.dataset.grupo || '';
    let proximo = previa.nextElementSibling;
    while (proximo && !(proximo.classList.contains('ck-card') && proximo.dataset.id !== arrastando)) {
      proximo = proximo.nextElementSibling;
    }
    return { antesDe: proximo ? proximo.dataset.id : null, grupo };
  }

  function dropCard(ev, alvoId) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!arrastando) return;
    const id = arrastando;
    const destino = destinoDaPrevia() || { antesDe: alvoId, grupo: projetoPorId(alvoId)?.grupo || '' };
    limparArrasto();
    if (destino.antesDe === id) return;
    reposicionar(id, destino);
  }

  function dropSecao(ev, grupoId) {
    ev.preventDefault();
    if (!arrastando) return;
    const id = arrastando;
    const destino = destinoDaPrevia() || { antesDe: null, grupo: grupoId || '' };
    limparArrasto();
    reposicionar(id, destino);
  }

  async function reposicionar(id, { antesDe, grupo }) {
    const original = new Map(projetos.map((p) => [p.id, { ordem: p.ordem, grupo: p.grupo || '' }]));
    const movido = projetoPorId(id);
    const restantes = projetos.filter((p) => p.id !== id);
    let indice = antesDe ? restantes.findIndex((p) => p.id === antesDe) : -1;
    if (indice < 0) {
      const ultimoDoGrupo = [...restantes].reverse().find((p) => (p.grupo || '') === grupo);
      indice = ultimoDoGrupo ? restantes.indexOf(ultimoDoGrupo) + 1 : restantes.length;
    }
    restantes.splice(indice, 0, movido);
    movido.grupo = grupo;

    const alterados = [];
    restantes.forEach((p, i) => {
      p.ordem = i;
      const antes = original.get(p.id);
      if (antes.ordem !== p.ordem || antes.grupo !== (p.grupo || '')) alterados.push(p);
    });
    projetos = restantes;
    await Promise.all(alterados.map((p) => window.dbSave(COL, { id: p.id, ordem: p.ordem, grupo: p.grupo || '' })));
    render();
  }

  // ── Ditado por voz (Web Speech API, pt-BR, no próprio navegador) ──────────
  // Interpreta: "<nome do projeto> <tarefa>" ou "projeto <nome> tarefa <texto>"
  function interpretar(falado) {
    let texto = falado.trim();
    const n = norm(texto);
    let projetoId = '';
    let melhor = 0;
    for (const p of projetos) {
      const nomeNorm = norm(p.nome.replace(/\(.*?\)|\?/g, '').trim());
      if (nomeNorm && n.includes(nomeNorm) && nomeNorm.length > melhor) {
        melhor = nomeNorm.length;
        projetoId = p.id;
      }
    }
    if (projetoId) {
      const nome = projetoPorId(projetoId).nome.replace(/\(.*?\)|\?/g, '').trim();
      const i = norm(texto).indexOf(norm(nome));
      texto = (texto.slice(0, i) + texto.slice(i + nome.length)).trim();
    }
    texto = texto.replace(/^(projeto|cliente|tarefa|adicionar|adiciona|nova tarefa)[:\s,-]*/i, '')
                 .replace(/^(tarefa)[:\s,-]*/i, '')
                 .trim();
    return { projetoId, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
  }

  function alternarDitado() {
    if (gravando) return pararDitado();
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      aviso('Este navegador não tem ditado. Use o Chrome ou o Edge.');
      return;
    }
    const r = new Rec();
    r.lang = 'pt-BR';
    r.interimResults = true;
    r.continuous = false;
    let final = '';
    r.onresult = (e) => {
      let parcial = '';
      for (const res of e.results) {
        if (res.isFinal) final += res[0].transcript;
        else parcial += res[0].transcript;
      }
      aviso(`Ouvindo: ${final}${parcial}`);
    };
    r.onerror = (e) => { aviso('Erro no ditado: ' + e.error); gravando = null; render(); };
    r.onend = () => {
      gravando = null;
      const falado = final.trim();
      if (falado) {
        pendente = { ...interpretar(falado), falado };
        aviso(`Entendi: “${falado}”. Confira abaixo.`);
      } else {
        aviso('Não entendi nada. Tente de novo.');
      }
      render();
    };
    gravando = r;
    r.start();
    render();
  }

  function pararDitado() {
    if (gravando) gravando.stop();
  }

  function descartarDitado() {
    pendente = null;
    render();
  }

  async function confirmarDitado() {
    const projetoId = $('ck-pend-proj').value;
    const texto = $('ck-pend-texto').value.trim();
    if (!projetoId) return aviso('Escolha o projeto para salvar a tarefa.');
    if (!texto) return aviso('A tarefa está vazia.');
    const p = projetoPorId(projetoId);
    const falado = pendente.falado;
    await salvar(p, { tarefas: [...p.tarefas, { id: uid(), texto, feita: false }] });
    const registro = { criadoEm: new Date().toISOString(), projetoId, projetoNome: p.nome, texto, falado };
    await window.dbSave(COL_DITADOS, registro);
    ditados.unshift(registro);
    pendente = null;
    render();
  }

  // ── Faixa dentro das atualizações de uma tarefa do CRM ─────────────────────
  async function montarBlocoCliente(nomeCliente) {
    blocoNome = nomeCliente || '';
    const corpo = $('updates-body');
    if (!corpo) return;
    let slot = $('updates-checklist');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'updates-checklist';
      corpo.parentNode.insertBefore(slot, corpo);
    }
    if (!blocoNome) { slot.innerHTML = ''; return; }

    const cliente = clientes().find((c) => norm(c.nome) === norm(blocoNome) || norm(c.empresa) === norm(blocoNome));
    const todos = (await window.dbList(COL, 'ordem', 'asc').catch(() => [])) || [];
    blocoProjetos = todos.filter((p) => (cliente ? p.clienteId === cliente.id : norm(p.nome).includes(norm(blocoNome))));

    slot.innerHTML = `
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg-card2)">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px">Tarefas do dia · ${esc(blocoNome)}</div>
        ${blocoProjetos.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
          ${blocoProjetos.map((p) => {
            const feitas = p.tarefas.filter((t) => t.feita).length;
            return `<div style="border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg-card)">
              <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px">${esc(p.nome)}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${feitas} de ${p.tarefas.length} feitas</div>
              ${p.tarefas.slice(0, 8).map((t) => `<label style="display:flex;gap:6px;align-items:center;font-size:11px;color:var(--text-primary);${t.feita ? 'text-decoration:line-through;opacity:.6' : ''}">
                <input type="checkbox" ${t.feita ? 'checked' : ''} onchange="Checklist.alternarBloco('${p.id}','${t.id}')"> ${esc(t.texto)}</label>`).join('')}
              ${p.tarefas.length > 8 ? `<div style="font-size:10px;color:var(--text-muted)">+ ${p.tarefas.length - 8} tarefas no Projetos</div>` : ''}
            </div>`;
          }).join('')}
        </div>` : `<div style="font-size:11px;color:var(--text-muted)">Nenhum projeto vinculado a este cliente. Vincule em Projetos — Tarefas do Dia.</div>`}
      </div>`;
  }

  async function alternarBloco(projetoId, tarefaId) {
    const p = blocoProjetos.find((x) => x.id === projetoId);
    const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!t) return;
    t.feita = !t.feita;
    await window.dbSave(COL, { id: p.id, tarefas: p.tarefas });
    await montarBlocoCliente(blocoNome);
  }

  async function abrir() {
    main().innerHTML = '<div style="padding:24px;color:var(--text-muted)">Carregando projetos…</div>';
    await carregar();
    render();
  }

  return {
    abrir, alternar, remover, adicionar,
    abrirForm, cancelarForm, salvarForm, teclaForm,
    excluirProjeto, definirCliente, adicionarEtiqueta, removerEtiqueta,
    excluirGrupo, moverParaGrupo,
    dragStart, dragEnd, dragOverCard, dragOverSecao, dropCard, dropSecao,
    alternarDitado, descartarDitado, confirmarDitado,
    montarBlocoCliente, alternarBloco,
    interpretar, // exposto para teste
  };
})();
