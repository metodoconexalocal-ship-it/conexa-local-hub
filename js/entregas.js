/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Entrega Final (apresentação de finalização + proposta de gestão)
   Página: gmn-entregas (showPage → Entregas.abrir()).
   Coleções (todas só com login):
     ghub_entregas        uma entrega por cliente { dados:{cliente, data, slides[]...}, status, perfilId, pacoteFechado }
     ghub_entregas_img    imagens comprimidas (data URL); dentro de "dados" ficam como "img:<id>"
     ghub_config/pacotes_gmn   os pacotes de gestão padrão { itens:[...] }
   Importação: arquivo .hub.json gerado pelo Claude (entrega-final/montar.js), formato "entrega-final/1".
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const COL = 'ghub_entregas', IMG = 'ghub_entregas_img', CFG = 'ghub_config', CFG_ID = 'pacotes_gmn';
  const STATUS = {
    preparando: { l: 'Preparando', c: 'var(--text-muted)' },
    pronta: { l: 'Pronta para apresentar', c: 'var(--blue)' },
    apresentada: { l: 'Apresentada', c: 'var(--yellow)' },
    fechou: { l: 'Fechou gestão', c: 'var(--green)' },
    'nao-fechou': { l: 'Só entregáveis (30 dias)', c: 'var(--orange)' },
  };
  const TIPOS = [['capa', 'Capa'], ['texto', 'Texto + imagens'], ['galeria', 'Galeria de imagens'], ['produtos', 'Produtos por categoria'], ['metricas', 'Números / métricas'], ['nfc', 'Cartão NFC'], ['cards', 'Cartões (lista)'], ['pacotes', 'Proposta de gestão (pacotes)'], ['encerramento', 'Encerramento']];
  const ABAS = [['geral', 'Geral'], ['slides', 'Slides e roteiro'], ['pacotes', 'Pacotes padrão'], ['json', 'Avançado']];

  // Pacotes padrão da Conexa (editáveis na aba "Pacotes padrão"; ficam em ghub_config/pacotes_gmn)
  const PACOTES_PADRAO = [
    { id: 'essencial', nome: 'Gestão Essencial', preco: 450, chamada: 'Manter o perfil ativo e crescendo', ativo: true,
      inclui: ['Gerenciamento completo do Perfil de Empresa', '1 atualização por semana com fotos e vídeos do seu material', 'Gestão de avaliações: respostas e estratégia para conquistar novas', 'Atualização de produtos, serviços, fotos e informações', 'Estratégia de SEO local e palavras-chave', 'Relatório mensal de desempenho'],
      alinhamento: 'Alinhamento por relatório mensal (sem reunião)' },
    { id: 'avancado', nome: 'Gestão Avançada', preco: 700, chamada: 'Conteúdo criado para o Google + Instagram', ativo: true,
      inclui: ['Tudo da Gestão Essencial', '8 conteúdos por mês: 2 por semana (segunda e sexta)', '2 carrosséis por mês (até 4 páginas) criados para o Google', '2 estáticos por mês criados para o Google', 'Conteúdos do Instagram adaptados ao perfil', 'Planejamento de campanhas sazonais (Black Friday, Natal, datas da região)'],
      alinhamento: 'Reunião mensal de alinhamento e planejamento de conteúdo' },
    { id: 'completo', nome: 'Gestão Completa', preco: 950, chamada: 'Presença máxima e autoridade local', ativo: true,
      inclui: ['Tudo da Gestão Avançada', '3 conteúdos por semana (12 por mês)', 'Toda semana: 1 vídeo, 1 carrossel e 1 estático criados por nós', 'Legendas estratégicas com as palavras-chave de busca', 'Métricas e relatórios completos (evolução e posicionamento)', 'Campanhas sazonais planejadas com antecedência'],
      alinhamento: 'Reunião mensal de alinhamento + relatório completo' },
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const genId = (n = 20) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const r = crypto.getRandomValues(new Uint8Array(n)); return Array.from(r, (x) => a[x % a.length]).join(''); };
  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
  const toast = (m) => { if (window.UI && UI.toast) return UI.toast(m); alert(m); };
  const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setP(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }

  // CSS dos slides + campos do editor
  if (!document.querySelector('link[href*="css/entrega.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/entrega.css?v=2'; document.head.appendChild(l); }
  const css = document.createElement('style');
  css.textContent = '#ef-editor input.form-input,#ef-editor textarea.form-input,#ef-editor select.form-input{background:var(--bg-base);border:1px solid var(--border-bright);border-radius:8px;color:var(--text-primary);font-family:var(--font);font-size:12.5px;padding:8px 10px;outline:none;line-height:1.5;box-sizing:border-box}#ef-editor .form-input:focus{border-color:var(--accent)}#ef-editor label{min-width:0}.ef-fala textarea{background:rgba(167,96,253,.07)!important;border-color:rgba(167,96,253,.35)!important}';
  document.head.appendChild(css);

  const S = { lista: [], perfis: [], pacotes: null, atual: null, aba: 'slides', sujo: false, imgs: {}, aberto: null, show: null };

  /* ── Imagens ───────────────────────────────────────────────────────────── */
  function carregarImagem(src) { return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Imagem inválida')); i.src = src; }); }
  async function comprimir(src) {
    const im = await carregarImagem(src);
    let max = 1800, q = 0.85, out = '';
    for (let t = 0; t < 6; t++) {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 700000) break;
      max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.06);
    }
    return out;
  }
  const lerArquivo = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(f); });
  async function salvarImagem(src, entId) { const data = await comprimir(src); const id = genId(20); await window.dbSet(IMG, id, { data, entregaId: entId }); S.imgs[id] = data; return 'img:' + id; }
  async function urlImg(ref) {
    if (!ref || typeof ref !== 'string' || ref.indexOf('img:') !== 0) return ref || '';
    const id = ref.slice(4);
    if (S.imgs[id] === undefined) { const d = await window.dbGet(IMG, id).catch(() => null); S.imgs[id] = (d && d.data) || ''; }
    return S.imgs[id];
  }
  function refsImagens(v, acc = []) {
    if (typeof v === 'string') { if (v.indexOf('img:') === 0) acc.push(v.slice(4)); }
    else if (Array.isArray(v)) v.forEach((x) => refsImagens(x, acc));
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => refsImagens(x, acc));
    return acc;
  }
  async function resolver(v) {
    if (typeof v === 'string') return v.indexOf('img:') === 0 ? urlImg(v) : v;
    if (Array.isArray(v)) return Promise.all(v.map(resolver));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await resolver(v[k]); return o; }
    return v;
  }
  const thumb = (ref, h = 64) => { const u = ref && ref.indexOf('img:') === 0 ? S.imgs[ref.slice(4)] : ref; return u ? `<img src="${esc(u)}" style="height:${h}px;width:${Math.round(h * 1.4)}px;object-fit:contain;background:#fff;border-radius:6px;border:1px solid var(--border);display:block">` : `<div style="height:${h}px;width:${Math.round(h * 1.4)}px;border-radius:6px;border:1px dashed var(--border-bright);display:grid;place-items:center;color:var(--text-muted);font-size:10px;text-align:center">sem imagem</div>`; };

  /* ── Pacotes ───────────────────────────────────────────────────────────── */
  async function carregarPacotes() {
    if (S.pacotes) return S.pacotes;
    const d = await window.dbGet(CFG, CFG_ID).catch(() => null);
    S.pacotes = (d && Array.isArray(d.itens) && d.itens.length) ? d.itens : JSON.parse(JSON.stringify(PACOTES_PADRAO));
    return S.pacotes;
  }

  /* ── Lista ─────────────────────────────────────────────────────────────── */
  const E = {};
  window.Entregas = E;
  E.abrir = async () => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Carregando entregas…</div>';
    S.atual = null;
    const [lista, perfis] = await Promise.all([window.dbList(COL, 'updatedAt'), window.dbList('gmn_perfis', 'createdAt'), carregarPacotes()]);
    S.lista = lista.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    S.perfis = perfis;
    renderLista();
  };
  function renderLista() {
    const pac = (id) => (S.pacotes || []).find((p) => p.id === id);
    const cards = S.lista.map((r) => {
      const d = r.dados || {}, c = d.cliente || {}, st = STATUS[r.status] || STATUS.preparando;
      const rec = pac(d.pacoteRecomendado), fech = pac(r.pacoteFechado);
      return `<div class="card" style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-card);display:flex;flex-direction:column;gap:8px;cursor:pointer" onclick="Entregas.editar('${esc(r.id)}')">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><div style="font-weight:700;font-size:15px">${esc(c.empresa || c.nome || 'Sem nome')}</div><div style="color:var(--text-muted);font-size:12px">${esc(c.nome || '')}${d.data ? ' · ' + esc(d.data) : ''}</div></div>
        <span style="font-size:11px;font-weight:700;color:${st.c};border:1px solid ${st.c};border-radius:20px;padding:2px 9px;white-space:nowrap">${st.l}</span></div>
        <div style="color:var(--text-secondary);font-size:12.5px">${window.EntregaRender.ativos(d).length} slides${rec ? ' · indicado: <b>' + esc(rec.nome) + '</b>' : ''}${fech ? ' · fechou: <b style="color:var(--green)">' + esc(fech.nome) + ' ' + brl(fech.preco) + '</b>' : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()">
          <button class="btn btn-primary" style="font-size:12px;padding:5px 10px" onclick="Entregas.apresentar('${esc(r.id)}')"><i class="bi bi-play-fill"></i> Apresentar</button>
          <button class="btn btn-ghost" style="font-size:12px;padding:5px 10px" onclick="Entregas.pdf('${esc(r.id)}')"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
          <button class="btn btn-ghost" style="font-size:12px;padding:5px 10px" onclick="Entregas.roteiro('${esc(r.id)}')"><i class="bi bi-chat-left-text"></i> Roteiro</button></div>
      </div>`;
    }).join('');
    const colunas = Object.entries(STATUS).map(([k, v]) => `<span style="font-size:12px;color:var(--text-secondary)"><b style="color:${v.c}">${S.lista.filter((r) => (r.status || 'preparando') === k).length}</b> ${v.l}</span>`).join(' · ');
    $('main-content').innerHTML = `<div class="page-wrap">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div><h2 style="margin:0;font-size:20px">Entrega Final</h2><div style="color:var(--text-secondary);font-size:13px;margin-top:4px">Cliente aprovou e implementamos: aqui fica a apresentação final, a proposta de gestão e os entregáveis.</div><div style="margin-top:6px">${colunas}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="Entregas.verPacotes()"><i class="bi bi-box-seam"></i> Pacotes padrão</button>
          <label class="btn btn-ghost" style="cursor:pointer"><i class="bi bi-upload"></i> Importar do Claude (.json)<input type="file" accept=".json,application/json" style="display:none" onchange="Entregas.importar(this.files[0]);this.value=''"></label>
          <button class="btn btn-primary" onclick="Entregas.nova()"><i class="bi bi-plus-lg"></i> Nova entrega</button></div></div>
      ${S.lista.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">${cards}</div>` : `<div style="border:1px dashed var(--border-bright);border-radius:var(--radius-lg);padding:40px 20px;text-align:center;color:var(--text-secondary)"><div style="font-size:30px"><i class="bi bi-gift"></i></div><p>Nenhuma entrega final ainda.</p><p style="font-size:13px">Crie uma do zero (já vem com o roteiro padrão) ou importe a que o Claude montou.</p></div>`}
      <div id="ef-progresso" style="margin-top:14px;color:var(--text-secondary);font-size:13px"></div></div>`;
  }

  /* ── Modelo padrão de apresentação ─────────────────────────────────────── */
  function slidesPadrao(emp) {
    const s = (tipo, kicker, titulo, extra = {}) => ({ id: genId(8), tipo, ativo: true, kicker, titulo, texto: '', pontos: [], imagens: [], fala: '', ...extra });
    return [
      s('capa', 'Relatório de apresentação', 'Finalização das implementações no Perfil de Empresa', { texto: '' }),
      s('texto', 'Apresentação final', 'Primeira impressão estratégica', { pontos: ['Quem é a empresa', 'O que oferece', 'Onde está', 'Como entrar em contato'] }),
      s('texto', 'Visão geral', 'Descrição da empresa'),
      s('galeria', 'Atualizações', 'Conteúdo que apresenta a empresa'),
      s('produtos', 'Produtos', 'Produtos como portas de entrada', { itens: [] }),
      s('texto', 'Serviços', 'Serviços cadastrados'),
      s('galeria', 'Fotos e vídeos', 'Galeria como prova visual'),
      s('texto', 'Avaliações', 'Avaliações como prova social'),
      s('metricas', 'Desempenho', 'O que os números mostram', { numeros: [] }),
      s('nfc', 'Entregável', 'Cartão NFC de avaliação'),
      s('cards', 'Continuidade', 'Jornada da gestão estratégica', { itens: [] }),
      s('pacotes', 'Proposta', 'Gestão do perfil: escolha o ritmo', { nota: '' }),
      s('cards', 'Entregas finais', 'O que você recebe', { itens: [{ titulo: 'Cartão NFC de avaliação', texto: '', tag: '' }, { titulo: 'Guia prático para empresários', texto: '', tag: '' }, { titulo: 'Placa em PDF para avaliação no Google', texto: '', tag: '' }, { titulo: 'Suporte de 30 dias na gestão das avaliações', texto: '', tag: '' }] }),
      s('encerramento', 'Próximos passos', 'Um perfil bem estruturado gera presença. Um perfil fortalecido gera autoridade.'),
    ];
  }
  const dadosVazios = (empresa) => ({ cliente: { empresa: empresa || '', nome: '', cidade: '' }, data: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), responsavel: 'Amanda Sestren Silveira · Conexa Local', pacoteRecomendado: 'avancado', notasInternas: [], historico: { descricao: '', chamados: [{ id: '' }] }, slides: slidesPadrao(empresa) });

  E.nova = async () => {
    const nome = prompt('Nome da empresa:');
    if (!nome) return;
    const id = genId(20);
    await window.dbSet(COL, id, { status: 'preparando', perfilId: '', pacoteFechado: '', dados: dadosVazios(nome.trim()), createdAt: new Date().toISOString() });
    E.editar(id);
  };
  E.importar = async (file) => {
    if (!file) return;
    const prog = (t) => { const el = $('ef-progresso'); if (el) el.textContent = t; };
    try {
      prog('Lendo o arquivo…');
      const pacote = JSON.parse(await file.text());
      const dados = pacote.dados || pacote;
      if (!Array.isArray(dados.slides)) throw new Error('O arquivo não parece uma entrega final (falta "slides").');
      const id = genId(20), fontes = [];
      (function walk(v, p) {
        if (typeof v === 'string') { if (v.indexOf('data:image/') === 0) fontes.push(p); }
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, p ? p + '.' + i : String(i)));
        else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walk(v[k], p ? p + '.' + k : k));
      })(dados, '');
      const vistos = {};
      for (let i = 0; i < fontes.length; i++) {
        prog(`Guardando imagens ${i + 1} de ${fontes.length}…`);
        const src = getP(dados, fontes[i]), chave = src.length + ':' + src.slice(-64);
        if (!vistos[chave]) vistos[chave] = await salvarImagem(src, id);
        setP(dados, fontes[i], vistos[chave]);
      }
      dados.slides.forEach((s) => { if (!s.id) s.id = genId(8); });
      const nome = String((dados.cliente || {}).empresa || '').toLowerCase();
      const perfil = S.perfis.find((p) => nome && (p.nome || '').toLowerCase().includes(nome.split(' ')[0]));
      await window.dbSet(COL, id, { status: 'pronta', perfilId: perfil ? perfil.id : '', pacoteFechado: '', dados, origem: 'claude', createdAt: new Date().toISOString() });
      if (Array.isArray(pacote.pacotes) && pacote.pacotes.length && !(await window.dbGet(CFG, CFG_ID).catch(() => null))) { await window.dbSet(CFG, CFG_ID, { itens: pacote.pacotes }); S.pacotes = pacote.pacotes; }
      prog(''); toast('Entrega importada!');
      E.editar(id);
    } catch (e) { console.error(e); prog(''); alert('Não consegui importar: ' + e.message); }
  };

  /* ── Editor ────────────────────────────────────────────────────────────── */
  E.editar = async (id) => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Abrindo…</div>';
    const r = await window.dbGet(COL, id);
    if (!r) { toast('Entrega não encontrada'); return E.abrir(); }
    if (!S.perfis.length) S.perfis = await window.dbList('gmn_perfis', 'createdAt');
    await carregarPacotes();
    S.atual = r; S.sujo = false;
    await Promise.all(refsImagens(r.dados).map((x) => urlImg('img:' + x)));
    renderEditor();
  };

  const campo = (p, label, opt = {}) => {
    const v = getP(S.atual.dados, p), val = Array.isArray(v) ? v.join('\n') : (v ?? '');
    const kind = opt.lines ? 'lines' : 'text';
    const inp = opt.area || opt.lines ? `<textarea class="form-input" data-p="${p}" data-k="${kind}" rows="${opt.rows || 3}" style="width:100%;resize:vertical">${esc(val)}</textarea>` : `<input class="form-input" data-p="${p}" data-k="${kind}" value="${esc(val)}" style="width:100%">`;
    return `<label class="${opt.cls || ''}" style="display:block;margin-bottom:10px;${opt.w ? 'flex:' + opt.w : 'flex:1'};min-width:${opt.min || 180}px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">${label}${opt.lines ? ' <span style="color:var(--text-muted)">(um por linha)</span>' : ''}</span>${inp}</label>`;
  };
  const linha = (...h) => `<div style="display:flex;gap:10px;flex-wrap:wrap">${h.join('')}</div>`;
  const bloco = (t, corpo, extra = '') => `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap"><div style="font-weight:700">${t}</div><div>${extra}</div></div>${corpo}</div>`;
  const mini = (t, on, cls = 'btn-ghost') => `<button class="btn ${cls}" style="font-size:11.5px;padding:4px 9px" onclick="${on}">${t}</button>`;
  const upload = (on, t = 'Enviar imagem', multi = false) => `<label class="btn btn-ghost" style="font-size:11.5px;padding:4px 9px;cursor:pointer"><i class="bi bi-image"></i> ${t}<input type="file" accept="image/*" ${multi ? 'multiple' : ''} style="display:none" onchange="${on}"></label>`;

  function linhas(path, cols, opt = {}) {
    const arr = getP(S.atual.dados, path) || [];
    return arr.map((row, i) => `<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--border)">
      ${opt.img ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:center">${thumb(row.img, 54)}${upload(`Entregas.uploadPara('${path}.${i}.img', this.files[0])`, 'Trocar')}</div>` : ''}
      <div style="flex:1;display:flex;gap:8px;flex-wrap:wrap">${cols.map((c) => {
        const p = `${path}.${i}.${c.k}`, v = row[c.k] ?? '';
        if (c.sel) return `<label style="flex:${c.w || 1};min-width:110px"><span style="font-size:11px;color:var(--text-muted)">${c.l}</span><select class="form-input" data-p="${p}" style="width:100%">${c.sel.map((o) => `<option value="${o[0]}" ${o[0] === v ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
        return `<label style="flex:${c.w || 1};min-width:${c.min || 140}px"><span style="font-size:11px;color:var(--text-muted)">${c.l}</span>${c.area ? `<textarea class="form-input" data-p="${p}" rows="2" style="width:100%;resize:vertical">${esc(v)}</textarea>` : `<input class="form-input" data-p="${p}" value="${esc(v)}" style="width:100%">`}</label>`;
      }).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:3px">${mini('↑', `Entregas.mover('${path}',${i},-1)`)}${mini('↓', `Entregas.mover('${path}',${i},1)`)}${mini('<i class="bi bi-trash"></i>', `Entregas.remover('${path}',${i})`)}</div></div>`).join('') +
      `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${mini('<i class="bi bi-plus"></i> ' + (opt.add || 'Adicionar'), `Entregas.adicionar('${path}')`)}${opt.img ? upload(`Entregas.uploadVarios('${path}', this.files)`, 'Enviar várias imagens', true) : ''}</div>`;
  }
  const NOVO = { imagens: () => ({ img: '', legenda: '' }), pontos: () => '', itens: () => ({ titulo: '', texto: '', tag: '', categoria: '', nome: '' }), numeros: () => ({ valor: '', label: '', tom: '' }), notasInternas: () => '', chamados: () => ({ id: '' }) };

  function abaGeral() {
    const r = S.atual, d = r.dados;
    return bloco('Cliente', linha(campo('cliente.empresa', 'Empresa', { w: 2 }), campo('cliente.nome', 'Nome do(a) cliente'), campo('cliente.cidade', 'Cidade')) + linha(campo('data', 'Data / mês da reunião'), campo('responsavel', 'Feito por', { w: 2 }))) +
      bloco('Etapa e proposta', `<div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="flex:1;min-width:200px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Etapa</span><select class="form-input" style="width:100%" onchange="Entregas.setRoot('status',this.value)">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === (r.status || 'preparando') ? 'selected' : ''}>${v.l}</option>`).join('')}</select></label>
        <label style="flex:1;min-width:200px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Pacote indicado (destaque no slide)</span><select class="form-input" data-p="pacoteRecomendado" style="width:100%"><option value="">— nenhum —</option>${S.pacotes.map((p) => `<option value="${esc(p.id)}" ${p.id === d.pacoteRecomendado ? 'selected' : ''}>${esc(p.nome)} · ${brl(p.preco)}</option>`).join('')}</select></label>
        <label style="flex:1;min-width:200px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Pacote que o cliente fechou</span><select class="form-input" style="width:100%" onchange="Entregas.fechou(this.value)"><option value="">— ainda não / não fechou —</option>${S.pacotes.map((p) => `<option value="${esc(p.id)}" ${p.id === r.pacoteFechado ? 'selected' : ''}>${esc(p.nome)} · ${brl(p.preco)}</option>`).join('')}</select></label>
        <label style="flex:1;min-width:200px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Perfil no GMN Hub</span><select class="form-input" style="width:100%" onchange="Entregas.setRoot('perfilId',this.value)"><option value="">— nenhum —</option>${S.perfis.map((p) => `<option value="${esc(p.id)}" ${p.id === r.perfilId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label></div>`) +
      bloco('Antes da reunião (só para você, sai no Roteiro)', campo('notasInternas', 'Checklist / pontos de atenção', { lines: true, rows: 8, cls: 'ef-fala' })) +
      bloco('Histórico do perfil (validação, exclusão de perfil e chamados)',
        campo('historico.descricao', 'Como aconteceu: o que era, o que foi feito e como terminou', { area: true, rows: 6 }) +
        `<div style="font-weight:600;font-size:12.5px;margin:4px 0 2px">IDs de chamado do Google</div>` +
        linhas('historico.chamados', [{ k: 'id', l: 'ID do chamado', w: 2 }], { add: 'Adicionar ID de chamado' })) +
      bloco('Apagar', mini('<i class="bi bi-trash"></i> Apagar esta entrega', 'Entregas.apagar()'));
  }

  function editorSlide(s, i) {
    const p = 'slides.' + i, t = s.tipo || 'texto';
    const usaImg = ['texto', 'galeria', 'produtos', 'nfc', 'metricas'].includes(t);
    let esp = '';
    if (t === 'produtos') esp = `<div style="font-weight:600;font-size:12.5px;margin:6px 0 2px">Produtos</div>` + linhas(p + '.itens', [{ k: 'categoria', l: 'Categoria' }, { k: 'nome', l: 'Nome', w: 2 }], { add: 'Adicionar produto' });
    if (t === 'metricas') esp = `<div style="font-weight:600;font-size:12.5px;margin:6px 0 2px">Números</div>` + linhas(p + '.numeros', [{ k: 'valor', l: 'Número', min: 90 }, { k: 'label', l: 'O que significa', w: 4 }, { k: 'tom', l: 'Cor', sel: [['', 'Neutro'], ['good', 'Verde'], ['alert', 'Vermelho']] }], { add: 'Adicionar número' });
    if (t === 'cards') esp = `<div style="font-weight:600;font-size:12.5px;margin:6px 0 2px">Cartões</div>` + linhas(p + '.itens', [{ k: 'titulo', l: 'Título', w: 2 }, { k: 'texto', l: 'Texto', w: 3, area: true }, { k: 'tag', l: 'Etiqueta (opcional)' }], { add: 'Adicionar cartão' });
    if (t === 'pacotes') esp = `<div style="font-size:12.5px;color:var(--text-secondary);margin-bottom:8px">Os pacotes vêm da aba <b>Pacotes padrão</b>; o destaque é o “Pacote indicado” da aba Geral.</div>` + campo(p + '.nota', 'Nota abaixo dos pacotes', { area: true, rows: 2 });
    return `<div style="margin-top:12px">
      ${linha(`<label style="flex:0 0 220px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Tipo de slide</span><select class="form-input" data-p="${p}.tipo" data-rerender="1" style="width:100%">${TIPOS.map(([k, l]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`, campo(p + '.kicker', 'Chamada (texto pequeno)'), campo(p + '.titulo', 'Título', { w: 3 }))}
      ${campo(p + '.texto', t === 'capa' ? 'Subtítulo' : 'Texto', { area: true, rows: 3 })}
      ${t !== 'pacotes' ? campo(p + '.pontos', 'Tópicos', { lines: true, rows: 3 }) : ''}
      ${esp}
      ${usaImg ? `<div style="font-weight:600;font-size:12.5px;margin:10px 0 2px">Imagens <span style="font-weight:400;color:var(--text-muted)">(sem imagem, a legenda vira um quadro “a produzir”)</span></div>` + linhas(p + '.imagens', [{ k: 'legenda', l: 'Legenda', w: 3 }], { img: true, add: 'Adicionar imagem' }) : ''}
      ${campo(p + '.fala', '🎤 Roteiro de fala (só você vê: aparece no modo Apresentar e no Roteiro)', { area: true, rows: 5, cls: 'ef-fala' })}
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${mini('▶ Ver este slide', `Entregas.apresentar(null,${i})`)}${mini('↑ Subir', `Entregas.mover('slides',${i},-1)`)}${mini('↓ Descer', `Entregas.mover('slides',${i},1)`)}${mini('Duplicar', `Entregas.duplicar(${i})`)}${mini('<i class="bi bi-trash"></i> Remover', `Entregas.remover('slides',${i})`)}</div></div>`;
  }
  function abaSlides() {
    const arr = S.atual.dados.slides || [];
    let n = 0;
    const cards = arr.map((s, i) => {
      const ativo = s.ativo !== false, num = ativo ? ++n : '–', aberto = S.aberto === i;
      const tl = (TIPOS.find((x) => x[0] === s.tipo) || [0, s.tipo])[1];
      const cab = `<div style="display:flex;align-items:center;gap:10px"><input type="checkbox" title="Mostrar na apresentação" ${ativo ? 'checked' : ''} onchange="Entregas.alternar(${i},this.checked)">
        <div style="flex:1;display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0" onclick="Entregas.abrirSlide(${i})"><span style="font-weight:800;color:var(--accent);width:22px">${num}</span><span style="font-weight:600;${ativo ? '' : 'opacity:.5;text-decoration:line-through'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.titulo || s.kicker || 'Sem título')}</span>
        <span style="color:var(--text-muted);font-size:11px;white-space:nowrap">${esc(tl)}${s.fala ? ' · 🎤' : ''}${(s.imagens || []).filter((x) => x.img).length ? ' · ' + (s.imagens || []).filter((x) => x.img).length + ' img' : ''}</span><i class="bi bi-chevron-${aberto ? 'up' : 'down'}" style="margin-left:auto"></i></div></div>`;
      return `<div style="background:var(--bg-card);border:1px solid ${aberto ? 'var(--border-bright)' : 'var(--border)'};border-radius:var(--radius);padding:11px 14px;margin-bottom:8px">${cab}${aberto ? editorSlide(s, i) : ''}</div>`;
    }).join('');
    return bloco('Slides da apresentação', `<div style="font-size:12.5px;color:var(--text-secondary);margin-bottom:10px">A caixinha liga/desliga o slide (ex.: esconder os entregáveis se for falar deles depois). Clique no título para editar.</div>` + cards, mini('<i class="bi bi-plus"></i> Novo slide', 'Entregas.novoSlide()', 'btn-primary'));
  }
  function abaPacotes() {
    const ps = S.pacotes;
    return bloco('Pacotes de gestão (padrão para todos os clientes)', `<div style="font-size:12.5px;color:var(--text-secondary);margin-bottom:10px">Valem para todas as entregas. Desmarque “ativo” para não mostrar um pacote.</div>` +
      ps.map((p, i) => `<div style="border-top:1px solid var(--border);padding:12px 0"><div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="flex:2;min-width:180px"><span style="font-size:11px;color:var(--text-muted)">Nome</span><input class="form-input" data-pac="${i}.nome" value="${esc(p.nome)}" style="width:100%"></label>
        <label style="flex:0 0 120px"><span style="font-size:11px;color:var(--text-muted)">Preço/mês (R$)</span><input class="form-input" data-pac="${i}.preco" data-num="1" value="${esc(p.preco)}" style="width:100%"></label>
        <label style="flex:3;min-width:200px"><span style="font-size:11px;color:var(--text-muted)">Chamada</span><input class="form-input" data-pac="${i}.chamada" value="${esc(p.chamada)}" style="width:100%"></label>
        <label style="flex:0 0 70px;font-size:12px;padding-top:18px"><input type="checkbox" ${p.ativo !== false ? 'checked' : ''} onchange="Entregas.pacAtivo(${i},this.checked)"> ativo</label></div>
        <label style="display:block;margin-top:8px"><span style="font-size:11px;color:var(--text-muted)">O que inclui (um por linha)</span><textarea class="form-input" data-pac="${i}.inclui" data-lines="1" rows="6" style="width:100%">${esc((p.inclui || []).join('\n'))}</textarea></label>
        <label style="display:block;margin-top:8px"><span style="font-size:11px;color:var(--text-muted)">Alinhamento</span><input class="form-input" data-pac="${i}.alinhamento" value="${esc(p.alinhamento)}" style="width:100%"></label></div>`).join(''),
      mini('<i class="bi bi-save"></i> Salvar pacotes', 'Entregas.salvarPacotes()', 'btn-primary') + ' ' + mini('Restaurar padrão', 'Entregas.restaurarPacotes()'));
  }
  function abaJson() {
    return bloco('Dados completos (avançado)', `<textarea id="ef-json" class="form-input" rows="22" style="width:100%;font-family:var(--mono);font-size:12px">${esc(JSON.stringify(S.atual.dados, null, 2))}</textarea>`, mini('Aplicar', 'Entregas.aplicarJson()', 'btn-primary'));
  }

  function renderEditor() {
    const r = S.atual, d = r.dados, c = d.cliente || {}, st = STATUS[r.status] || STATUS.preparando;
    const corpo = { geral: abaGeral, slides: abaSlides, pacotes: abaPacotes, json: abaJson }[S.aba]();
    $('main-content').innerHTML = `<div class="page-wrap" id="ef-editor">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0"><button class="btn btn-ghost" onclick="Entregas.voltar()"><i class="bi bi-arrow-left"></i></button>
          <div><div style="font-weight:700;font-size:17px">${esc(c.empresa || c.nome || 'Sem nome')}</div><div style="font-size:12px;color:${st.c}">${st.l}</div></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span id="ef-sujo" style="font-size:12px;color:var(--yellow)">${S.sujo ? 'Alterações não salvas' : ''}</span>
          <button class="btn btn-ghost" onclick="Entregas.salvar()"><i class="bi bi-save"></i> Salvar</button>
          <button class="btn btn-ghost" onclick="Entregas.roteiro()"><i class="bi bi-chat-left-text"></i> Roteiro</button>
          <button class="btn btn-ghost" onclick="Entregas.pdf()"><i class="bi bi-file-earmark-pdf"></i> Gerar PDF</button>
          <button class="btn btn-primary" onclick="Entregas.apresentar()"><i class="bi bi-play-fill"></i> Apresentar</button></div></div>
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;overflow-x:auto">${ABAS.map(([k, l]) => `<button onclick="Entregas.aba('${k}')" style="background:none;border:0;border-bottom:2px solid ${S.aba === k ? 'var(--accent)' : 'transparent'};color:${S.aba === k ? 'var(--text-primary)' : 'var(--text-secondary)'};padding:9px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;white-space:nowrap">${l}</button>`).join('')}</div>
      ${corpo}</div>`;
  }

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!S.atual || !t.closest || !t.closest('#ef-editor') || !t.dataset) return;
    if (t.dataset.pac) { const [i, k] = t.dataset.pac.split('.'); let v = t.value; if (t.dataset.lines) v = v.split('\n').map((x) => x.trim()).filter(Boolean); if (t.dataset.num) v = Number(String(v).replace(/\D/g, '')) || 0; S.pacotes[i][k] = v; S.pacSujo = true; return; }
    if (!t.dataset.p || t.tagName === 'SELECT') return;
    let v = t.value;
    if (t.dataset.k === 'lines') v = v.split('\n').map((x) => x.trim()).filter(Boolean);
    setP(S.atual.dados, t.dataset.p, v); marcarSujo();
  });
  document.addEventListener('change', (e) => { const t = e.target; if (t.tagName === 'SELECT' && t.dataset && t.dataset.p && S.atual && t.closest('#ef-editor')) { setP(S.atual.dados, t.dataset.p, t.value); marcarSujo(); if (t.dataset.rerender) reRender(); } });
  function marcarSujo() { S.sujo = true; const el = $('ef-sujo'); if (el) el.textContent = 'Alterações não salvas'; clearTimeout(S._auto); S._auto = setTimeout(() => E.salvar(true), 4000); }
  const reRender = () => { const m = document.querySelector('.main'), ym = m ? m.scrollTop : 0, y = window.scrollY; renderEditor(); window.scrollTo(0, y); if (m) m.scrollTop = ym; };

  E.aba = (k) => { if (S.pacSujo && S.aba === 'pacotes' && confirm('Salvar as mudanças nos pacotes?')) E.salvarPacotes(); S.aba = k; renderEditor(); };
  E.abrirSlide = (i) => { S.aberto = S.aberto === i ? null : i; reRender(); };
  E.alternar = (i, v) => { S.atual.dados.slides[i].ativo = v; marcarSujo(); reRender(); };
  E.setRoot = (k, v) => { S.atual[k] = v; marcarSujo(); };
  E.fechou = (v) => { S.atual.pacoteFechado = v; if (v) S.atual.status = 'fechou'; marcarSujo(); reRender(); };
  E.adicionar = (path) => { const a = getP(S.atual.dados, path) || []; const k = path.split('.').pop(); a.push(NOVO[k] ? NOVO[k]() : {}); setP(S.atual.dados, path, a); marcarSujo(); reRender(); };
  E.remover = (path, i) => { const a = getP(S.atual.dados, path) || []; if (path === 'slides' && !confirm('Remover este slide?')) return; a.splice(i, 1); if (path === 'slides') S.aberto = null; marcarSujo(); reRender(); };
  E.mover = (path, i, d) => { const a = getP(S.atual.dados, path) || []; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; if (path === 'slides') S.aberto = j; marcarSujo(); reRender(); };
  E.duplicar = (i) => { const a = S.atual.dados.slides; const c = JSON.parse(JSON.stringify(a[i])); c.id = genId(8); a.splice(i + 1, 0, c); S.aberto = i + 1; marcarSujo(); reRender(); };
  E.novoSlide = () => { const a = S.atual.dados.slides; a.push({ id: genId(8), tipo: 'texto', ativo: true, kicker: '', titulo: 'Novo slide', texto: '', pontos: [], imagens: [], fala: '' }); S.aberto = a.length - 1; marcarSujo(); reRender(); };
  E.uploadPara = async (path, file) => { if (!file) return; try { toast('Enviando imagem…'); setP(S.atual.dados, path, await salvarImagem(await lerArquivo(file), S.atual.id)); marcarSujo(); reRender(); } catch (e) { alert('Não consegui enviar: ' + e.message); } };
  E.uploadVarios = async (path, files) => {
    const a = getP(S.atual.dados, path) || [];
    for (const f of Array.from(files || [])) { try { toast('Enviando ' + f.name + '…'); a.push({ img: await salvarImagem(await lerArquivo(f), S.atual.id), legenda: '' }); } catch (e) { alert('Falhou ' + f.name + ': ' + e.message); } }
    setP(S.atual.dados, path, a); marcarSujo(); reRender();
  };
  E.pacAtivo = (i, v) => { S.pacotes[i].ativo = v; S.pacSujo = true; };
  E.salvarPacotes = async () => { try { await window.dbSet(CFG, CFG_ID, { itens: S.pacotes }); S.pacSujo = false; toast('Pacotes salvos'); } catch (e) { alert('Erro ao salvar pacotes: ' + e.message); } };
  E.restaurarPacotes = () => { if (!confirm('Voltar os pacotes para o padrão (R$ 450 / 700 / 950)?')) return; S.pacotes = JSON.parse(JSON.stringify(PACOTES_PADRAO)); E.salvarPacotes(); reRender(); };
  E.verPacotes = async () => { if (!S.lista.length) return alert('Crie ou importe uma entrega primeiro; os pacotes ficam na aba "Pacotes padrão" do editor.'); S.aba = 'pacotes'; E.editar(S.lista[0].id); };
  E.aplicarJson = () => { try { S.atual.dados = JSON.parse($('ef-json').value); marcarSujo(); toast('Aplicado. Lembre de salvar.'); } catch (e) { alert('JSON inválido: ' + e.message); } };

  E.salvar = async (silencioso) => {
    clearTimeout(S._auto);
    if (!S.atual) return;
    const { id, ...rest } = S.atual;
    try { await window.dbSet(COL, id, rest); S.atual.updatedAt = new Date().toISOString(); S.sujo = false; const el = $('ef-sujo'); if (el) el.textContent = silencioso ? 'Salvo automaticamente' : ''; if (!silencioso) toast('Entrega salva'); }
    catch (e) { console.error(e); alert('Erro ao salvar: ' + e.message); }
  };
  E.voltar = async () => { if (S.sujo) await E.salvar(true); if (S.pacSujo && confirm('Salvar as mudanças nos pacotes?')) await E.salvarPacotes(); S.aba = 'slides'; E.abrir(); };
  E.apagar = async () => {
    const r = S.atual;
    if (!confirm('Apagar a entrega final de ' + ((r.dados.cliente || {}).empresa || '') + '? Não dá para desfazer.')) return;
    for (const x of refsImagens(r.dados)) await window.dbRemove(IMG, x);
    await window.dbRemove(COL, r.id); S.sujo = false; toast('Entrega apagada'); E.abrir();
  };

  /* ── Apresentar / PDF / Roteiro ───────────────────────────────────────── */
  async function dadosProntos(id) {
    let r = S.atual;
    if (id && (!r || r.id !== id)) { r = await window.dbGet(COL, id); await carregarPacotes(); }
    else if (S.sujo) await E.salvar(true);
    return { r, dados: await resolver(r.dados) };
  }
  E.apresentar = async (id, inicio) => {
    const { dados } = await dadosProntos(id);
    const html = window.EntregaRender.slides(dados, S.pacotes);
    const ativos = window.EntregaRender.ativos(dados);
    let idx = 0;
    if (inicio != null) { const alvo = (dados.slides || [])[inicio]; idx = Math.max(0, ativos.indexOf(ativos.find((s) => s.id === (alvo || {}).id))); }
    const ov = document.createElement('div'); ov.className = 'ef-show';
    ov.innerHTML = `<div class="ef-show-palco">${html}</div><div class="ef-show-notas" style="display:none"></div>
      <div class="ef-show-barra"><button data-a="sair">✕ Sair (Esc)</button><button data-a="ant">◀</button><span class="ef-show-n"></span><button data-a="prox">▶</button><button data-a="notas">🎤 Roteiro (N)</button><span style="margin-left:auto;opacity:.6">← → para navegar · F para tela cheia</span><button data-a="tela">⛶ Tela cheia</button></div>`;
    document.body.appendChild(ov);
    const sl = Array.from(ov.querySelectorAll('.ef-slide')), palco = ov.querySelector('.ef-show-palco'), notas = ov.querySelector('.ef-show-notas');
    const ajusta = () => { const k = Math.min(palco.clientWidth / 1280, palco.clientHeight / 720) * 0.96; sl.forEach((s) => { s.style.transform = `translate(-50%,-50%) scale(${k})`; }); };
    const mostra = () => { sl.forEach((s, i) => { s.style.display = i === idx ? '' : 'none'; }); ov.querySelector('.ef-show-n').textContent = (idx + 1) + ' / ' + sl.length; notas.textContent = (ativos[idx] || {}).fala || '(sem roteiro para este slide)'; ajusta(); };
    const sair = () => { document.removeEventListener('keydown', tecla); window.removeEventListener('resize', ajusta); if (document.fullscreenElement) document.exitFullscreen(); ov.remove(); };
    const tecla = (e) => { if (e.key === 'Escape') sair(); else if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { idx = Math.min(sl.length - 1, idx + 1); mostra(); e.preventDefault(); } else if (['ArrowLeft', 'PageUp'].includes(e.key)) { idx = Math.max(0, idx - 1); mostra(); } else if (e.key.toLowerCase() === 'n') { notas.style.display = notas.style.display === 'none' ? '' : 'none'; ajusta(); } else if (e.key.toLowerCase() === 'f') ov.requestFullscreen && ov.requestFullscreen(); };
    ov.querySelector('.ef-show-barra').onclick = (e) => { const a = e.target.dataset.a; if (a === 'sair') sair(); if (a === 'ant') { idx = Math.max(0, idx - 1); mostra(); } if (a === 'prox') { idx = Math.min(sl.length - 1, idx + 1); mostra(); } if (a === 'notas') { notas.style.display = notas.style.display === 'none' ? '' : 'none'; ajusta(); } if (a === 'tela') ov.requestFullscreen && ov.requestFullscreen(); };
    palco.onclick = () => { idx = Math.min(sl.length - 1, idx + 1); mostra(); };
    document.addEventListener('keydown', tecla); window.addEventListener('resize', ajusta);
    mostra();
  };
  // a janela abre já no clique (senão o navegador bloqueia) e recebe o conteúdo depois
  async function emJanela(id, montar) {
    const w = window.open('', '_blank');
    if (!w) return alert('O navegador bloqueou a janela. Permita pop-ups para o Hub e tente de novo.');
    w.document.write('<p style="font-family:sans-serif;padding:20px">Montando…</p>');
    const { dados } = await dadosProntos(id);
    w.document.open(); w.document.write(montar(dados, dados.cliente || {})); w.document.close();
  }
  E.pdf = (id) => emJanela(id, (d, c) => window.EntregaRender.documento(window.EntregaRender.slides(d, S.pacotes), 'Apresentação Final - ' + (c.empresa || c.nome || '')));
  E.roteiro = (id) => emJanela(id, (d, c) => window.EntregaRender.documento(window.EntregaRender.roteiro(d, S.pacotes), 'Roteiro - ' + (c.empresa || ''), { roteiro: true }));
})();
