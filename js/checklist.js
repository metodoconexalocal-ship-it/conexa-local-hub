/**
 * Checklist de projetos — tarefas do dia por cliente, com ditado por voz.
 * Dados em Firestore (coleção gmn_checklist_projetos), via dbList/dbSave.
 */
window.Checklist = (() => {
  const COL = 'gmn_checklist_projetos';
  const COL_DITADOS = 'gmn_checklist_ditados';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const uid = () => Math.random().toString(36).slice(2, 10);

  // Transcrição da folha (letra manuscrita: itens marcados com ? podem precisar de ajuste)
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
  let ditados = [];
  let gravando = null;
  let pendente = null; // { projetoId, texto } aguardando confirmação

  const $ = (id) => document.getElementById(id);
  const main = () => $('main-content');

  async function carregar() {
    projetos = (await window.dbList(COL, 'ordem', 'asc')) || [];
    if (!projetos.length && !localStorage.getItem('_checklistSeedFeito')) {
      localStorage.setItem('_checklistSeedFeito', '1');
      for (let i = 0; i < SEED.length; i++) {
        const [nome, lista] = SEED[i];
        const tarefas = lista.map((t) => ({ id: uid(), texto: t, feita: false }));
        await window.dbSave(COL, { nome, ordem: i, tarefas });
      }
      projetos = (await window.dbList(COL, 'ordem', 'asc')) || [];
    }
    ditados = (await window.dbList(COL_DITADOS, 'criadoEm', 'desc').catch(() => [])) || [];
  }

  async function salvarProjeto(p) {
    await window.dbSave(COL, { id: p.id, tarefas: p.tarefas });
  }

  function render() {
    const total = projetos.reduce((t, p) => t + p.tarefas.length, 0);
    const feitas = projetos.reduce((t, p) => t + p.tarefas.filter((x) => x.feita).length, 0);
    main().innerHTML = `
    <div class="page-wrap">
      <style>
        .ck-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}
        .ck-title{font-size:18px;font-weight:700;color:var(--text-primary);flex:1}
        .ck-btn{border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}
        .ck-btn-primary{background:linear-gradient(135deg,#7c5cfc,#41e7f3);color:#fff;border:none}
        .ck-btn-rec{background:#ef4444;color:#fff;border:none}
        .ck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
        .ck-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px}
        .ck-card h3{font-size:14px;margin:0 0 4px;color:var(--text-primary)}
        .ck-prog{font-size:11px;color:var(--text-muted);margin-bottom:10px}
        .ck-item{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;color:var(--text-primary)}
        .ck-item.feita span{text-decoration:line-through;color:var(--text-muted)}
        .ck-item span{flex:1}
        .ck-x{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px}
        .ck-add{display:flex;gap:6px;margin-top:8px}
        .ck-add input,.ck-pend input,.ck-pend select{flex:1;padding:7px 9px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card2);color:var(--text-primary);font-size:13px}
        .ck-pend{background:var(--bg-card);border:1px solid #7c5cfc;border-radius:12px;padding:14px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px}
        .ck-hist{margin-top:22px;font-size:12px;color:var(--text-secondary)}
        .ck-hist li{margin-bottom:4px}
        .ck-speech{font-size:12px;color:var(--text-muted);margin-top:6px;min-height:16px}
      </style>

      <div class="ck-head">
        <div class="ck-title"><i class="bi bi-kanban"></i> Projetos — tarefas do dia</div>
        <div style="font-size:12px;color:var(--text-muted)">${feitas}/${total} feitas</div>
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

      <div class="ck-grid">
        ${projetos.map((p) => `
        <div class="ck-card">
          <h3>${esc(p.nome)}</h3>
          <div class="ck-prog">${p.tarefas.filter((t) => t.feita).length}/${p.tarefas.length} feitas</div>
          ${p.tarefas.length ? p.tarefas.map((t) => `
            <div class="ck-item ${t.feita ? 'feita' : ''}">
              <input type="checkbox" ${t.feita ? 'checked' : ''} onchange="Checklist.alternar('${esc(p.id)}','${esc(t.id)}')">
              <span>${esc(t.texto)}</span>
              <button class="ck-x" title="Remover" onclick="Checklist.remover('${esc(p.id)}','${esc(t.id)}')">✕</button>
            </div>`).join('') : '<div style="font-size:12px;color:var(--text-muted)">Sem tarefas</div>'}
          <div class="ck-add">
            <input id="add-${esc(p.id)}" placeholder="Nova tarefa" onkeydown="if(event.key==='Enter')Checklist.adicionar('${esc(p.id)}')">
            <button class="ck-btn" onclick="Checklist.adicionar('${esc(p.id)}')">+</button>
          </div>
        </div>`).join('')}
      </div>

      <div class="ck-hist">
        <strong>Últimas tarefas criadas por ditado</strong>
        <ul>${ditados.slice(0, 15).map((d) => `<li>${esc(new Date(d.criadoEm).toLocaleString('pt-BR'))} — <b>${esc(d.projetoNome)}</b>: ${esc(d.texto)} <i style="color:var(--text-muted)">(falou: “${esc(d.falado)}”)</i></li>`).join('') || '<li>Nenhuma ainda.</li>'}</ul>
      </div>
    </div>`;
  }

  function projetoPorId(id) { return projetos.find((p) => p.id === id); }

  async function alternar(projetoId, tarefaId) {
    const p = projetoPorId(projetoId);
    const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!t) return;
    t.feita = !t.feita;
    await salvarProjeto(p);
    render();
  }

  async function remover(projetoId, tarefaId) {
    const p = projetoPorId(projetoId);
    if (!p) return;
    p.tarefas = p.tarefas.filter((x) => x.id !== tarefaId);
    await salvarProjeto(p);
    render();
  }

  async function adicionar(projetoId) {
    const input = $(`add-${projetoId}`);
    const texto = input?.value.trim();
    if (!texto) return;
    const p = projetoPorId(projetoId);
    p.tarefas.push({ id: uid(), texto, feita: false });
    await salvarProjeto(p);
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
    p.tarefas.push({ id: uid(), texto, feita: false });
    await salvarProjeto(p);
    const registro = { criadoEm: new Date().toISOString(), projetoId, projetoNome: p.nome, texto, falado };
    await window.dbSave(COL_DITADOS, registro);
    ditados.unshift(registro);
    pendente = null;
    $('ck-speech').textContent = '';
    render();
  }

  async function abrir() {
    main().innerHTML = '<div style="padding:24px;color:var(--text-muted)">Carregando projetos…</div>';
    await carregar();
    render();
  }

  return {
    abrir, alternar, remover, adicionar, alternarDitado, descartarDitado, confirmarDitado,
    interpretar, // exposto para teste
  };
})();
