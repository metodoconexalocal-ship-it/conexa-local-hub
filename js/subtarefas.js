/**
 * Subtarefas de uma tarefa da agenda (Calendário e Minha Agenda).
 * Abre um painel com a lista de subtarefas para ir marcando.
 *   Subtarefas.abrir('agencia' | 'pessoal', id)
 * Dados: campo `subtarefas` [{id, texto, feita}] no próprio documento da tarefa.
 */
window.Subtarefas = (() => {
  const CSS = `
  #st-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:19000;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .15s}
  #st-overlay.show{opacity:1}
  .st-box{width:440px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.35);color:var(--text-primary)}
  .st-head{display:flex;align-items:flex-start;gap:10px;padding:16px 18px 10px}
  .st-head .st-titulo{flex:1;font-size:15px;font-weight:600;line-height:1.35}
  .st-meta{font-size:12px;color:var(--text-muted);margin-top:3px}
  .st-x{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:2px 4px}
  .st-prog{display:flex;align-items:center;gap:10px;padding:4px 18px 12px;font-size:12px;color:var(--text-muted)}
  .st-barra{flex:1;height:5px;background:var(--bg-card2);border-radius:5px;overflow:hidden}
  .st-barra div{height:100%;background:var(--accent);transition:width .2s}
  .st-lista{overflow:auto;padding:0 18px;flex:1;min-height:40px}
  .st-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}
  .st-item:last-child{border-bottom:none}
  .st-item input{width:16px;height:16px;cursor:pointer;accent-color:var(--accent)}
  .st-item span{flex:1;word-break:break-word}
  .st-item.feita span{text-decoration:line-through;color:var(--text-muted)}
  .st-vazio{font-size:12px;color:var(--text-muted);padding:10px 0}
  .st-add{display:flex;gap:8px;padding:12px 18px}
  .st-add input{flex:1;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card2);color:var(--text-primary);font-size:13px}
  .st-add input:focus{outline:none;border-color:var(--accent)}
  .st-btn{border:1px solid var(--border);background:transparent;color:var(--text-primary);border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer}
  .st-btn:hover{border-color:var(--text-muted)}
  .st-btn-ok{background:var(--accent);border-color:var(--accent);color:#fff}
  .st-rodape{display:flex;justify-content:space-between;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--border)}
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  let atual = null; // { origem, id }

  function estilo() {
    if (document.getElementById('st-css')) return;
    const s = document.createElement('style');
    s.id = 'st-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Tarefa atual, nos dois lugares em que ela pode estar
  function tarefa() {
    if (!atual) return null;
    if (atual.origem === 'pessoal') return (typeof _AG !== 'undefined' ? _AG.personal : []).find((t) => t.id === atual.id) || null;
    return (typeof _calTasks !== 'undefined' ? _calTasks : []).find((t) => t.id === atual.id) || null;
  }

  async function gravar(t) {
    if (atual.origem === 'pessoal') {
      if (window.savePersonalTask) await window.savePersonalTask(t);
    } else if (window.updateCalTask) {
      await window.updateCalTask(t.id, { subtarefas: t.subtarefas });
    }
    atualizarAgenda();
  }

  // Redesenha a tela que estiver aberta
  function atualizarAgenda() {
    try {
      if (typeof currentPage !== 'undefined' && currentPage === 'minha-agenda' && typeof _agRenderCal === 'function') _agRenderCal();
      else if (typeof currentPage !== 'undefined' && currentPage === 'calendario' && typeof _calRender === 'function') _calRender();
    } catch (e) { /* a tela será redesenhada na próxima ação */ }
    desenhar();
  }

  function fechar() {
    const el = document.getElementById('st-overlay');
    if (el) {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 150);
    }
    atual = null;
  }

  function desenhar() {
    const t = tarefa();
    const el = document.getElementById('st-overlay');
    if (!t || !el) return;
    const lista = t.subtarefas || [];
    const feitas = lista.filter((x) => x.feita).length;
    const pct = lista.length ? Math.round((feitas / lista.length) * 100) : 0;
    const titulo = t.titulo || t.title || 'Tarefa';
    const meta = [t.data || t.date || '', t.hora || t.time || ''].filter(Boolean).join(' · ');
    el.querySelector('.st-box').innerHTML = `
      <div class="st-head">
        <div style="flex:1;min-width:0">
          <div class="st-titulo">${esc(titulo)}</div>
          ${meta ? `<div class="st-meta">${esc(meta)}</div>` : ''}
        </div>
        <button class="st-x" title="Fechar" onclick="Subtarefas.fechar()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="st-prog">
        <span>${feitas} de ${lista.length} feitas</span>
        <div class="st-barra"><div style="width:${pct}%"></div></div>
      </div>
      <div class="st-lista">
        ${lista.length ? lista.map((x) => `
          <div class="st-item ${x.feita ? 'feita' : ''}">
            <input type="checkbox" ${x.feita ? 'checked' : ''} onchange="Subtarefas.alternar('${x.id}')">
            <span>${esc(x.texto)}</span>
            <button class="st-x" title="Remover" onclick="Subtarefas.remover('${x.id}')"><i class="bi bi-trash"></i></button>
          </div>`).join('') : '<div class="st-vazio">Nenhuma subtarefa ainda. Digite abaixo para adicionar.</div>'}
      </div>
      <div class="st-add">
        <input id="st-novo" placeholder="Nova subtarefa" onkeydown="if(event.key==='Enter'){event.preventDefault();Subtarefas.adicionar()}">
        <button class="st-btn st-btn-ok" onclick="Subtarefas.adicionar()">Adicionar</button>
      </div>
      <div class="st-rodape">
        <button class="st-btn" onclick="Subtarefas.editar()"><i class="bi bi-pencil"></i> Editar tarefa</button>
        <button class="st-btn" onclick="Subtarefas.fechar()">Fechar</button>
      </div>`;
  }

  function abrir(origem, id) {
    estilo();
    atual = { origem, id };
    if (!tarefa()) { atual = null; return; }
    let el = document.getElementById('st-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'st-overlay';
      el.innerHTML = '<div class="st-box"></div>';
      el.addEventListener('click', (ev) => { if (ev.target === el) fechar(); });
      document.body.appendChild(el);
    }
    desenhar();
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { const i = document.getElementById('st-novo'); if (i) i.focus(); }, 60);
  }

  async function alternar(subId) {
    const t = tarefa();
    const s = t?.subtarefas?.find((x) => x.id === subId);
    if (!s) return;
    s.feita = !s.feita;
    await gravar(t);
  }

  async function adicionar() {
    const t = tarefa();
    const campo = document.getElementById('st-novo');
    const texto = campo ? campo.value.trim() : '';
    if (!t || !texto) return;
    t.subtarefas = [...(t.subtarefas || []), { id: uid(), texto, feita: false }];
    await gravar(t);
    const novo = document.getElementById('st-novo');
    if (novo) novo.focus();
  }

  async function remover(subId) {
    const t = tarefa();
    if (!t) return;
    t.subtarefas = (t.subtarefas || []).filter((x) => x.id !== subId);
    await gravar(t);
  }

  // Abre a edição completa da tarefa, na janela que já existe
  function editar() {
    const origem = atual?.origem, id = atual?.id;
    fechar();
    if (origem === 'pessoal' && typeof _agOpenEditModal === 'function') _agOpenEditModal(id);
    else if (typeof _calOpenEditModal === 'function') _calOpenEditModal(id);
  }

  return { abrir, fechar, alternar, adicionar, remover, editar };
})();
