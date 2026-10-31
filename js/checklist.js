/**
 * Projetos — tarefas do dia por cliente.
 * Projetos podem ser agrupados, reordenados por arrastar, vinculados a um cliente
 * da base e receber etiquetas. Ditado por voz cria tarefas no projeto certo.
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
  let pendente = null; // { projetoId, texto, falado } aguardando confirmação
  let arrastando = null;

  const $ = (id) => document.getElementById(id);
  const main = () => $('main-content');
  const porOrdem = (lista) => [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const clientes = () => (typeof clientsData !== 'undefined' ? clientsData : [])
    .filter((c) => !c.archived)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  const projetoPorId = (id) => projetos.find((p) => p.id === id);
  const grupoPorId = (id) => grupos.find((g) => g.id === id);

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
  function cardHTML(p) {
    const total = p.tarefas.length;
    const feitas = p.tarefas.filter((t) => t.feita).length;
    const cliente = clientes().find((c) => c.id === p.clienteId);
    return `
    <div class="ck-card" draggable="true" ondragstart="Checklist.dragStart(event,'${p.id}')" ondragend="Checklist.dragEnd()" ondragover="Checklist.dragOver(event)" ondrop="Checklist.dropCard(event,'${p.id}')">
      <div class="ck-card-head">
        <h3 title="Clique para renomear" onclick="Checklist.renomearProjeto('${p.id}')">${esc(p.nome)}</h3>
        <button class="ck-x" title="Excluir projeto" onclick="Checklist.excluirProjeto('${p.id}')"><i class="bi bi-trash"></i></button>
      </div>
      <div class="ck-meta">
        <select title="Cliente da base" onchange="Checklist.definirCliente('${p.id}', this.value)">
          <option value="">Sem cliente vinculado</option>
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
      <div class="ck-prog">${feitas}/${total} feitas</div>
      ${total ? p.tarefas.map((t) => `
        <div class="ck-item ${t.feita ? 'feita' : ''}">
          <input type="checkbox" ${t.feita ? 'checked' : ''} onchange="Checklist.alternar('${p.id}','${t.id}')">
          <span>${esc(t.texto)}</span>
          <button class="ck-x" title="Remover" onclick="Checklist.remover('${p.id}','${t.id}')">✕</button>
        </div>`).join('') : '<div class="ck-vazio">Sem tarefas</div>'}
      <div class="ck-add">
        <input id="add-${p.id}" placeholder="Nova tarefa" onkeydown="if(event.key==='Enter')Checklist.adicionar('${p.id}')">
        <button class="ck-btn" onclick="Checklist.adicionar('${p.id}')">+</button>
      </div>
      ${cliente ? `<div class="ck-cliente"><i class="bi bi-person"></i> ${esc(cliente.nome)}</div>` : ''}
    </div>`;
  }

  function secaoHTML(g) {
    const lista = porOrdem(projetos.filter((p) => (p.grupo || '') === g.id));
    return `
    <section class="ck-secao" ondragover="Checklist.dragOver(event)" ondrop="Checklist.dropSecao(event,'${g.id}')">
      <div class="ck-secao-head">
        <span>${esc(g.nome)}</span>
        <small>${lista.length} projeto${lista.length !== 1 ? 's' : ''}</small>
        ${g.id ? `<button class="ck-btn ck-btn-sm" onclick="Checklist.excluirGrupo('${g.id}')"><i class="bi bi-trash"></i> Excluir grupo</button>` : ''}
      </div>
      <div class="ck-grid">
        ${lista.map(cardHTML).join('') || '<div class="ck-vazio ck-drop">Arraste projetos para este grupo</div>'}
      </div>
    </section>`;
  }

  function render() {
    const total = projetos.reduce((t, p) => t + p.tarefas.length, 0);
    const feitas = projetos.reduce((t, p) => t + p.tarefas.filter((x) => x.feita).length, 0);
    const semGrupo = { id: '', nome: 'Sem grupo' };
    main().innerHTML = `
    <div class="page-wrap">
      <style>
        .ck-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .ck-title{font-size:18px;font-weight:700;color:var(--text-primary);flex:1}
        .ck-btn{border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}
        .ck-btn-sm{padding:4px 10px;font-size:11px}
        .ck-btn-primary{background:linear-gradient(135deg,#7c5cfc,#41e7f3);color:#fff;border:none}
        .ck-btn-rec{background:#ef4444;color:#fff;border:none}
        .ck-secao{margin-bottom:22px}
        .ck-secao-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:14px;font-weight:700;color:var(--text-primary)}
        .ck-secao-head small{font-weight:500;color:var(--text-muted)}
        .ck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px;min-height:40px}
        .ck-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:grab}
        .ck-card:active{cursor:grabbing}
        .ck-card-head{display:flex;align-items:center;gap:8px}
        .ck-card-head h3{font-size:14px;margin:0;color:var(--text-primary);flex:1;cursor:text}
        .ck-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}
        .ck-meta select,.ck-tag-input,.ck-add input,.ck-pend input,.ck-pend select{padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card2);color:var(--text-primary);font-size:12px;min-width:0}
        .ck-etiquetas{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px}
        .ck-tag{font-size:11px;background:rgba(124,92,252,.15);color:#a78bfa;padding:2px 8px;border-radius:999px}
        .ck-tag button{background:none;border:none;color:inherit;cursor:pointer;padding:0 0 0 2px}
        .ck-tag-input{width:90px}
        .ck-prog{font-size:11px;color:var(--text-muted);margin:4px 0 8px}
        .ck-item{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;color:var(--text-primary)}
        .ck-item.feita span{text-decoration:line-through;color:var(--text-muted)}
        .ck-item span{flex:1}
        .ck-x{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px}
        .ck-add{display:flex;gap:6px;margin-top:8px}
        .ck-add input{flex:1}
        .ck-cliente{font-size:11px;color:var(--text-muted);margin-top:8px}
        .ck-vazio{font-size:12px;color:var(--text-muted);padding:6px 2px}
        .ck-drop{border:1px dashed var(--border);border-radius:10px;padding:14px;text-align:center}
        .ck-pend{background:var(--bg-card);border:1px solid #7c5cfc;border-radius:12px;padding:14px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px}
        .ck-hist{margin-top:22px;font-size:12px;color:var(--text-secondary)}
        .ck-hist li{margin-bottom:4px}
        .ck-speech{font-size:12px;color:var(--text-muted);margin-top:6px;min-height:16px}
      </style>

      <div class="ck-head">
        <div class="ck-title"><i class="bi bi-kanban"></i> Projetos — tarefas do dia</div>
        <div style="font-size:12px;color:var(--text-muted)">${feitas}/${total} feitas</div>
        <button class="ck-btn" onclick="Checklist.novoGrupo()"><i class="bi bi-folder-plus"></i> Novo grupo</button>
        <button class="ck-btn" onclick="Checklist.novoProjeto()"><i class="bi bi-plus-lg"></i> Novo projeto</button>
        <button class="ck-btn ${gravando ? 'ck-btn-rec' : 'ck-btn-primary'}" onclick="Checklist.alternarDitado()">
          <i class="bi ${gravando ? 'bi-stop-circle' : 'bi-mic'}"></i> ${gravando ? 'Parar' : 'Ditar tarefa'}
        </button>
      </div>
      <div class="ck-speech" id="ck-speech"></div>

      ${pendente ? `
      <div class="ck-pend">
        <div style="font-size:12px;color:var(--text-muted)">Confira antes de salvar:</div>
        <select id="ck-pend-proj">
          <option value="">— escolha o projeto —</option>
          ${projetos.map((p) => `<option value="${esc(p.id)}" ${p.id === pendente.projetoId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
        </select>
        <input id="ck-pend-texto" value="${esc(pendente.texto)}" placeholder="Texto da tarefa">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="ck-btn" onclick="Checklist.descartarDitado()">Descartar</button>
          <button class="ck-btn ck-btn-primary" onclick="Checklist.confirmarDitado()">Salvar tarefa</button>
        </div>
      </div>` : ''}

      ${grupos.map(secaoHTML).join('')}
      ${secaoHTML(semGrupo)}

      <div class="ck-hist">
        <strong>Últimas tarefas criadas por ditado</strong>
        <ul>${ditados.slice(0, 15).map((d) => `<li>${esc(new Date(d.criadoEm).toLocaleString('pt-BR'))} — <b>${esc(d.projetoNome)}</b>: ${esc(d.texto)} <i style="color:var(--text-muted)">(falou: “${esc(d.falado)}”)</i></li>`).join('') || '<li>Nenhuma ainda.</li>'}</ul>
      </div>
    </div>`;
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

  // ── Projetos ───────────────────────────────────────────────────────────────
  async function novoProjeto() {
    const nome = prompt('Nome do projeto (ex.: nome do cliente ou da empresa):');
    if (!nome || !nome.trim()) return;
    const campos = { nome: nome.trim(), ordem: projetos.length, grupo: '', etiquetas: [], tarefas: [] };
    const id = await window.dbSave(COL, campos);
    projetos.push({ id, ...campos });
    render();
  }

  async function renomearProjeto(id) {
    const p = projetoPorId(id);
    const nome = prompt('Novo nome do projeto:', p.nome);
    if (!nome || !nome.trim() || nome.trim() === p.nome) return;
    await salvar(p, { nome: nome.trim() });
    render();
  }

  async function excluirProjeto(id) {
    const p = projetoPorId(id);
    if (!confirm(`Excluir o projeto "${p.nome}" e todas as tarefas dele?`)) return;
    await window.dbDelete(COL, id);
    projetos = projetos.filter((x) => x.id !== id);
    render();
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

  // ── Grupos ─────────────────────────────────────────────────────────────────
  async function novoGrupo() {
    const nome = prompt('Nome do grupo (ex.: Recorrente, Implementação):');
    if (!nome || !nome.trim()) return;
    const campos = { nome: nome.trim(), ordem: grupos.length };
    const id = await window.dbSave(COL_GRUPOS, campos);
    grupos.push({ id, ...campos });
    render();
  }

  async function excluirGrupo(id) {
    const g = grupoPorId(id);
    if (!confirm(`Excluir o grupo "${g.nome}"? Os projetos dele voltam para "Sem grupo".`)) return;
    await window.dbDelete(COL_GRUPOS, id);
    grupos = grupos.filter((x) => x.id !== id);
    for (const p of projetos.filter((x) => x.grupo === id)) await salvar(p, { grupo: '' });
    render();
  }

  async function moverParaGrupo(id, grupoId) {
    await salvar(projetoPorId(id), { grupo: grupoId || '' });
    render();
  }

  // ── Arrastar e soltar ──────────────────────────────────────────────────────
  function dragStart(ev, id) {
    arrastando = id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', id);
  }
  function dragEnd() { arrastando = null; }
  function dragOver(ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; }

  // Solta um projeto antes de outro, herdando o grupo dele
  function dropCard(ev, alvoId) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!arrastando || arrastando === alvoId) return;
    reposicionar(arrastando, { antesDe: alvoId, grupo: projetoPorId(alvoId).grupo || '' });
  }

  // Solta um projeto dentro de um grupo (fica no fim dele)
  function dropSecao(ev, grupoId) {
    ev.preventDefault();
    if (!arrastando) return;
    reposicionar(arrastando, { antesDe: null, grupo: grupoId || '' });
  }

  async function reposicionar(id, { antesDe, grupo }) {
    // Guarda o estado original para saber, no fim, quais documentos precisam ser gravados
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
    arrastando = null;
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
      $('ck-speech').textContent = 'Este navegador não tem ditado. Use o Chrome ou o Edge.';
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
      $('ck-speech').textContent = `Ouvindo: ${final}${parcial}`;
    };
    r.onerror = (e) => { $('ck-speech').textContent = 'Erro no ditado: ' + e.error; gravando = null; render(); };
    r.onend = () => {
      gravando = null;
      const falado = final.trim();
      if (falado) {
        pendente = { ...interpretar(falado), falado };
        $('ck-speech').textContent = `Entendi: “${falado}”. Confira abaixo.`;
      } else {
        $('ck-speech').textContent = 'Não entendi nada. Tente de novo.';
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
    if (!projetoId) return alert('Escolha o projeto.');
    if (!texto) return alert('A tarefa está vazia.');
    const p = projetoPorId(projetoId);
    const falado = pendente.falado;
    await salvar(p, { tarefas: [...p.tarefas, { id: uid(), texto, feita: false }] });
    const registro = { criadoEm: new Date().toISOString(), projetoId, projetoNome: p.nome, texto, falado };
    await window.dbSave(COL_DITADOS, registro);
    ditados.unshift(registro);
    pendente = null;
    $('ck-speech').textContent = '';
    render();
  }

  // ── Faixa dentro das atualizações de uma tarefa do CRM ─────────────────────
  // Mostra os projetos do cliente dessa tarefa e permite marcar tarefas sem sair do CRM.
  let blocoNome = '';
  let blocoProjetos = [];

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
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px"><i class="bi bi-kanban"></i> Tarefas do dia · ${esc(blocoNome)}</div>
        ${blocoProjetos.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
          ${blocoProjetos.map((p) => {
            const feitas = p.tarefas.filter((t) => t.feita).length;
            return `<div style="border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg-card)">
              <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px">${esc(p.nome)}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${feitas}/${p.tarefas.length} feitas</div>
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
    novoProjeto, renomearProjeto, excluirProjeto, definirCliente, adicionarEtiqueta, removerEtiqueta,
    novoGrupo, excluirGrupo, moverParaGrupo,
    dragStart, dragEnd, dragOver, dropCard, dropSecao,
    alternarDitado, descartarDitado, confirmarDitado,
    montarBlocoCliente, alternarBloco,
    interpretar, // exposto para teste
  };
})();
