/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Relatórios do Perfil (Antes → Aprovação → Prévia)
   Página: gmn-relatorios (chamada pelo showPage do app.js → Relatorios.abrir()).
   Coleções:
     ghub_relatorios            relatório interno (dados, status, perfilId, token)   [login]
     ghub_relatorios_public     cópia publicada para o cliente, id = token           [leitura pública]
     ghub_relatorios_img        imagens comprimidas (data URL), id aleatório          [leitura pública]
     ghub_relatorios_respostas  aprovação do cliente, id = token                     [cliente grava]
   Imagens dentro de "dados" ficam como "img:<id>".
   Importação: arquivo .json gerado pelo Claude (montar.js --hub), com imagens em data URL.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const COL = 'ghub_relatorios', PUB = 'ghub_relatorios_public', IMG = 'ghub_relatorios_img', RESP = 'ghub_relatorios_respostas';
  const STATUS = {
    rascunho: { l: 'Rascunho', c: 'var(--text-muted)' },
    enviado: { l: 'Enviado ao cliente', c: 'var(--blue)' },
    respondido: { l: 'Cliente respondeu', c: 'var(--yellow)' },
    ajustes: { l: 'Em ajustes', c: 'var(--orange)' },
    aprovado: { l: 'Aprovado', c: 'var(--green)' },
    publicado: { l: 'No ar no Google', c: 'var(--accent)' },
  };
  const ABAS = [['geral', 'Geral'], ['antes', 'Antes'], ['aprovacao', 'Aprovação'], ['previa', 'Prévia'], ['respostas', 'Respostas'], ['json', 'Avançado']];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const genId = (n = 24) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const r = crypto.getRandomValues(new Uint8Array(n)); return Array.from(r, (x) => a[x % a.length]).join(''); };
  const hoje = () => new Date().toLocaleDateString('pt-BR');
  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const toast = (m) => { if (window.UI && UI.toast) return UI.toast(m); const t = document.createElement('div'); t.className = 'gmn-toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600); };
  const linkCliente = (token) => location.origin + '/relatorio.html?r=' + token;

  // estilo dos campos do editor (o Hub só estiliza inputs dentro de .form-row)
  const css = document.createElement('style');
  css.textContent = '#rel-editor input.form-input,#rel-editor textarea.form-input,#rel-editor select.form-input{background:var(--bg-base);border:1px solid var(--border-bright);border-radius:8px;color:var(--text-primary);font-family:var(--font);font-size:12.5px;padding:8px 10px;outline:none;line-height:1.5;box-sizing:border-box}#rel-editor .form-input:focus{border-color:var(--accent)}#rel-editor label{min-width:0}';
  document.head.appendChild(css);

  const S = { lista: [], perfis: [], respostas: {}, atual: null, aba: 'geral', sujo: false, imgs: {}, abertoItem: null };

  /* ── Modelo vazio ───────────────────────────────────────────────────────── */
  function dadosVazios(nome) {
    return {
      cliente: { nome: nome || '', nicho: '', cidade: '' }, data: hoje(), responsavel: 'Amanda · Conexa Local', introducao: '',
      antes: { resumo: '', nota: { atual: 0, max: 0, rotulo: 'itens do perfil preenchidos' }, numerosTitulo: 'O que o painel do Google mostra', numeros: [], pontosTitulo: 'Item por item', pontos: [], prints: [] },
      aprovacao: { instrucao: '', itens: [] },
      previa: { nome: nome || '', categoria: '', cidade: '', nota: '', avaliacoes: '', endereco: '', horario: '', telefone: '', site: '', atributos: [], logo: '', logoTexto: '', capa: '', fotos: [], fotosSugeridas: [], descricao: '', texto: '', destaques: [], produtos: [], servicos: [], posts: [] },
    };
  }

  /* ── Caminhos (data-p="antes.pontos.0.texto") ───────────────────────────── */
  const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setP(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }

  /* ── Imagens: comprime no navegador e guarda no Firestore ───────────────── */
  function carregarImagem(src) { return new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Imagem inválida')); i.src = src; }); }
  async function comprimir(src) {
    const im = await carregarImagem(src);
    let max = 1600, q = 0.82, out = '';
    for (let t = 0; t < 6; t++) {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 700000) break; // limite do documento do Firestore é 1 MB
      max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.06);
    }
    return out;
  }
  const lerArquivo = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(f); });
  async function salvarImagem(src, relId) {
    const data = await comprimir(src);
    const id = genId(20);
    await window.dbSet(IMG, id, { data, relatorioId: relId });
    S.imgs[id] = data;
    return 'img:' + id;
  }
  async function urlImg(ref) {
    if (!ref || typeof ref !== 'string') return '';
    if (ref.indexOf('img:') !== 0) return ref;
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
  async function precarregar(dados) { await Promise.all(refsImagens(dados).map((id) => urlImg('img:' + id))); }
  const thumb = (ref, h = 80) => { const u = ref && ref.indexOf('img:') === 0 ? S.imgs[ref.slice(4)] : ref; return u ? `<img src="${esc(u)}" style="height:${h}px;width:${h}px;object-fit:cover;border-radius:8px;border:1px solid var(--border);display:block">` : `<div style="height:${h}px;width:${h}px;border-radius:8px;border:1px dashed var(--border-bright);display:grid;place-items:center;color:var(--text-muted);font-size:10px;text-align:center">sem foto</div>`; };

  /* ── Carga ──────────────────────────────────────────────────────────────── */
  async function carregarLista() {
    const [lista, perfis] = await Promise.all([window.dbList(COL, 'updatedAt'), window.dbList('gmn_perfis', 'createdAt')]);
    S.lista = lista.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    S.perfis = perfis;
    await Promise.all(S.lista.filter((r) => r.token).map(async (r) => { S.respostas[r.token] = await window.dbGet(RESP, r.token).catch(() => null); }));
  }
  function resumoResp(r) {
    const resp = r.token && S.respostas[r.token];
    const itens = ((r.dados || {}).aprovacao || {}).itens || [];
    if (!resp || !resp.respostas) return null;
    let ok = 0, aj = 0;
    itens.forEach((it, i) => { const s = resp.respostas[it.id || 'A' + (i + 1)]; if (s && s.st === 'ok') ok++; else if (s && s.st === 'aj') aj++; });
    return { ok, aj, total: itens.length, enviado: !!resp.enviado, em: resp.enviadoEm || resp.atualizadoEm };
  }

  /* ── Roteamento ─────────────────────────────────────────────────────────── */
  const R = {};
  window.Relatorios = R;
  R.abrir = async () => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Carregando relatórios…</div>';
    S.atual = null;
    await carregarLista();
    renderLista();
  };

  function renderLista() {
    const cards = S.lista.map((r) => {
      const rr = resumoResp(r), d = r.dados || {};
      const st = STATUS[(rr && rr.enviado && r.status === 'enviado') ? 'respondido' : r.status] || STATUS.rascunho;
      const perfil = S.perfis.find((p) => p.id === r.perfilId);
      return `<div class="card" style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-card);display:flex;flex-direction:column;gap:8px;cursor:pointer" onclick="Relatorios.editar('${esc(r.id)}')">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div><div style="font-weight:700;font-size:15px">${esc((d.cliente || {}).nome || 'Sem nome')}</div>
          <div style="color:var(--text-muted);font-size:12px">${perfil ? '<i class="bi bi-geo-alt"></i> ' + esc(perfil.nome) : 'Sem perfil GMN ligado'}</div></div>
          <span style="font-size:11px;font-weight:700;color:${st.c};border:1px solid ${st.c};border-radius:20px;padding:2px 9px;white-space:nowrap">${st.l}</span>
        </div>
        <div style="color:var(--text-secondary);font-size:12.5px">${(((d.aprovacao || {}).itens) || []).length} itens para aprovar · atualizado ${fmt(r.updatedAt)}</div>
        ${rr ? `<div style="font-size:12.5px"><span style="color:var(--green)">✓ ${rr.ok} aprovados</span> · <span style="color:var(--yellow)">✎ ${rr.aj} ajustes</span> · ${rr.total - rr.ok - rr.aj} sem resposta ${rr.enviado ? '· <b>enviado ' + fmt(rr.em) + '</b>' : '(rascunho do cliente)'}</div>` : (r.token ? '<div style="font-size:12.5px;color:var(--text-muted)">Cliente ainda não respondeu</div>' : '')}
        ${r.token ? `<div style="display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()"><button class="btn btn-ghost" style="font-size:12px;padding:5px 10px" onclick="Relatorios.copiarLink('${esc(r.token)}')"><i class="bi bi-link-45deg"></i> Copiar link do cliente</button><a class="btn btn-ghost" style="font-size:12px;padding:5px 10px" target="_blank" rel="noopener" href="${esc(linkCliente(r.token))}"><i class="bi bi-box-arrow-up-right"></i> Abrir</a></div>` : ''}
      </div>`;
    }).join('');
    $('main-content').innerHTML = `<div class="page-wrap">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <div><h2 style="margin:0;font-size:20px">Relatórios do Perfil</h2>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:4px">Antes → Aprovação → Prévia. O cliente aprova pelo link e a resposta aparece aqui.</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn btn-ghost" style="cursor:pointer"><i class="bi bi-upload"></i> Importar do Claude (.json)<input type="file" accept=".json,application/json" style="display:none" onchange="Relatorios.importar(this.files[0]);this.value=''"></label>
          <button class="btn btn-primary" onclick="Relatorios.novo()"><i class="bi bi-plus-lg"></i> Novo relatório</button>
        </div>
      </div>
      ${S.lista.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">${cards}</div>` : `<div style="border:1px dashed var(--border-bright);border-radius:var(--radius-lg);padding:40px 20px;text-align:center;color:var(--text-secondary)"><div style="font-size:30px"><i class="bi bi-file-earmark-richtext"></i></div><p>Nenhum relatório ainda.</p><p style="font-size:13px">Crie um do zero ou importe o arquivo que o Claude gerou a partir da pasta de prints do cliente.</p></div>`}
      <div id="rel-progresso" style="margin-top:14px;color:var(--text-secondary);font-size:13px"></div>
    </div>`;
  }

  R.copiarLink = (token) => { const u = linkCliente(token); navigator.clipboard.writeText(u).then(() => toast('Link do cliente copiado!'), () => prompt('Copie o link:', u)); };

  R.novo = async () => {
    const nome = prompt('Nome do cliente:');
    if (!nome) return;
    const id = genId(20);
    await window.dbSet(COL, id, { status: 'rascunho', perfilId: '', token: '', dados: dadosVazios(nome.trim()), createdAt: new Date().toISOString() });
    await R.editar(id);
  };

  R.importar = async (file) => {
    if (!file) return;
    const prog = (t) => { const el = $('rel-progresso'); if (el) el.textContent = t; };
    try {
      prog('Lendo o arquivo…');
      const pacote = JSON.parse(await file.text());
      const dados = pacote.dados || pacote;
      if (!dados.cliente) throw new Error('O arquivo não parece um relatório (falta "cliente").');
      const id = genId(20);
      const fontes = [];
      (function walk(v, p) {
        if (typeof v === 'string') { if (v.indexOf('data:image/') === 0) fontes.push(p); }
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, p ? p + '.' + i : String(i)));
        else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walk(v[k], p ? p + '.' + k : k));
      })(dados, '');
      const vistos = {};
      for (let i = 0; i < fontes.length; i++) {
        prog(`Guardando imagens ${i + 1} de ${fontes.length}…`);
        const src = getP(dados, fontes[i]);
        const chave = src.length + ':' + src.slice(-64);
        if (!vistos[chave]) vistos[chave] = await salvarImagem(src, id);
        setP(dados, fontes[i], vistos[chave]);
      }
      // caminho que não virou imagem (arquivo não encontrado) fica vazio
      (function limpa(v, p) {
        if (typeof v === 'string') { if (/\.(png|jpe?g|webp|gif|svg)$/i.test(v) && !/^https?:/.test(v)) setP(dados, p, ''); }
        else if (Array.isArray(v)) v.forEach((x, i) => limpa(x, p + '.' + i));
        else if (v && typeof v === 'object') Object.keys(v).forEach((k) => limpa(v[k], p ? p + '.' + k : k));
      })(dados, '');
      const nome = (dados.cliente.nome || '').toLowerCase();
      const perfil = S.perfis.find((p) => nome && (p.nome || '').toLowerCase().includes(nome.split(' ')[0]));
      await window.dbSet(COL, id, { status: 'rascunho', perfilId: perfil ? perfil.id : '', token: '', dados, origem: 'claude', createdAt: new Date().toISOString() });
      prog('');
      toast('Relatório importado!');
      await R.editar(id);
    } catch (e) { console.error(e); prog(''); alert('Não consegui importar: ' + e.message); }
  };

  /* ── Editor ─────────────────────────────────────────────────────────────── */
  R.editar = async (id) => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Abrindo relatório…</div>';
    const r = await window.dbGet(COL, id);
    if (!r) { toast('Relatório não encontrado'); return R.abrir(); }
    if (!S.perfis.length) S.perfis = await window.dbList('gmn_perfis', 'createdAt');
    S.atual = r; S.sujo = false; S.aba = S.aba || 'geral';
    await precarregar(r.dados);
    if (r.token) S.respostas[r.token] = await window.dbGet(RESP, r.token).catch(() => null);
    renderEditor();
  };

  const campo = (p, label, opt = {}) => {
    const v = getP(S.atual.dados, p);
    const val = Array.isArray(v) ? v.join('\n') : (v ?? '');
    const kind = opt.lines ? 'lines' : opt.num ? 'num' : 'text';
    const inp = opt.area || opt.lines
      ? `<textarea class="form-input" data-p="${p}" data-k="${kind}" rows="${opt.rows || 3}" style="width:100%;resize:vertical">${esc(val)}</textarea>`
      : `<input class="form-input" data-p="${p}" data-k="${kind}" value="${esc(val)}" style="width:100%">`;
    return `<label style="display:block;margin-bottom:10px;${opt.w ? 'flex:' + opt.w : ''}"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">${label}${opt.lines ? ' <span style="color:var(--text-muted)">(um por linha)</span>' : ''}</span>${inp}${opt.dica ? `<span style="display:block;font-size:11px;color:var(--text-muted);margin-top:2px">${opt.dica}</span>` : ''}</label>`;
  };
  const linha = (...h) => `<div style="display:flex;gap:10px;flex-wrap:wrap">${h.join('')}</div>`;
  const bloco = (titulo, corpo, extra = '') => `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><div style="font-weight:700">${titulo}</div>${extra}</div>${corpo}</div>`;
  const btnMini = (txt, on, cls = 'btn-ghost') => `<button class="btn ${cls}" style="font-size:11.5px;padding:4px 9px" onclick="${on}">${txt}</button>`;
  const upload = (onchange, txt = 'Enviar foto', multiple = false) => `<label class="btn btn-ghost" style="font-size:11.5px;padding:4px 9px;cursor:pointer"><i class="bi bi-image"></i> ${txt}<input type="file" accept="image/*" ${multiple ? 'multiple' : ''} style="display:none" onchange="${onchange}"></label>`;

  // lista de linhas (rows) genérica: path de um array de objetos e os campos de cada linha
  function linhas(path, cols, opt = {}) {
    const arr = getP(S.atual.dados, path) || [];
    const rows = arr.map((row, i) => `<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--border)">
      ${opt.img ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:center">${thumb(row[opt.img], 64)}${upload(`Relatorios.uploadPara('${path}.${i}.${opt.img}', this.files[0])`, 'Foto')}${row[opt.img] ? btnMini('Tirar', `Relatorios.set('${path}.${i}.${opt.img}','')`) : ''}</div>` : ''}
      <div style="flex:1;display:flex;gap:8px;flex-wrap:wrap">${cols.map((c) => {
        const p = `${path}.${i}.${c.k}`, v = row[c.k] ?? '';
        if (c.sel) return `<label style="flex:${c.w || 1};min-width:110px"><span style="font-size:11px;color:var(--text-muted)">${c.l}</span><select class="form-input" data-p="${p}" data-k="text" style="width:100%">${c.sel.map((o) => `<option value="${o[0]}" ${o[0] === v ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
        return `<label style="flex:${c.w || 1};min-width:${c.min || 140}px"><span style="font-size:11px;color:var(--text-muted)">${c.l}</span>${c.area ? `<textarea class="form-input" data-p="${p}" data-k="text" rows="2" style="width:100%;resize:vertical">${esc(v)}</textarea>` : `<input class="form-input" data-p="${p}" data-k="text" value="${esc(v)}" style="width:100%">`}</label>`;
      }).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:3px">${btnMini('↑', `Relatorios.mover('${path}',${i},-1)`)}${btnMini('↓', `Relatorios.mover('${path}',${i},1)`)}${btnMini('<i class="bi bi-trash"></i>', `Relatorios.remover('${path}',${i})`)}</div>
    </div>`).join('');
    return rows + `<div style="margin-top:8px">${btnMini('<i class="bi bi-plus"></i> ' + (opt.add || 'Adicionar'), `Relatorios.adicionar('${path}')`)}</div>`;
  }
  const NOVOS = {
    'antes.numeros': () => ({ valor: '', label: '', tom: '' }), 'antes.pontos': () => ({ tipo: 'falta', texto: '' }), 'antes.prints': () => ({ img: '', titulo: '', observacao: '' }),
    'previa.produtos': () => ({ categoria: '', nome: '', preco: '', descricao: '', foto: '', botao: 'Pedir pelo WhatsApp', img: '' }),
    'previa.servicos': () => ({ nome: '', preco: '', descricao: '' }), 'previa.posts': () => ({ img: '', foto: '', data: '', texto: '', botao: '' }),
  };
  const novoPara = (path) => {
    if (NOVOS[path]) return NOVOS[path]();
    if (/\.produtos$/.test(path)) return { categoria: '', nome: '', preco: '', descricao: '', foto: '', img: '' };
    if (/\.imagens$/.test(path)) return { img: '', legenda: '' };
    return {};
  };

  function abaGeral() {
    const d = S.atual;
    return bloco('Cliente', linha(campo('cliente.nome', 'Nome', { w: 2 }), campo('cliente.nicho', 'Nicho'), campo('cliente.cidade', 'Cidade')) +
      linha(campo('data', 'Data do relatório'), campo('responsavel', 'Feito por')) +
      campo('introducao', 'Texto de abertura (aparece no topo)', { area: true, rows: 3 })) +
      bloco('Ligações', `<div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="flex:1;min-width:220px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Perfil no GMN Hub</span>
        <select class="form-input" style="width:100%" onchange="Relatorios.setRoot('perfilId',this.value)"><option value="">— nenhum —</option>${S.perfis.map((p) => `<option value="${esc(p.id)}" ${p.id === d.perfilId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <label style="flex:1;min-width:220px"><span style="display:block;font-size:11.5px;color:var(--text-secondary);margin-bottom:3px">Etapa</span>
        <select class="form-input" style="width:100%" onchange="Relatorios.setRoot('status',this.value)">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === (d.status || 'rascunho') ? 'selected' : ''}>${v.l}</option>`).join('')}</select></label></div>
        <div style="margin-top:10px">${btnMini('<i class="bi bi-trash"></i> Apagar este relatório', 'Relatorios.apagar()', 'btn-ghost')}</div>`);
  }
  function abaAntes() {
    return bloco('Resumo', campo('antes.resumo', 'Resumo de como o perfil está hoje', { area: true, rows: 3 }) +
      linha(campo('antes.nota.atual', 'Itens preenchidos', { num: true }), campo('antes.nota.max', 'De quantos', { num: true }), campo('antes.nota.rotulo', 'Legenda da nota', { w: 2 }))) +
      bloco('Números do painel', campo('antes.numerosTitulo', 'Título') + linhas('antes.numeros', [{ k: 'valor', l: 'Número', w: 1, min: 90 }, { k: 'label', l: 'O que significa', w: 4 }, { k: 'tom', l: 'Cor', sel: [['', 'Neutro'], ['good', 'Verde (bom)'], ['alert', 'Vermelho (alerta)']] }], { add: 'Adicionar número' })) +
      bloco('Item por item', campo('antes.pontosTitulo', 'Título') + linhas('antes.pontos', [{ k: 'tipo', l: 'Situação', sel: [['falta', 'Faltando'], ['fraco', 'Pode melhorar'], ['ok', 'Está bom']] }, { k: 'texto', l: 'Texto', w: 5, area: true }], { add: 'Adicionar ponto' })) +
      bloco('Prints do perfil', linhas('antes.prints', [{ k: 'titulo', l: 'Título' }, { k: 'observacao', l: 'Observação', w: 2 }], { img: 'img', add: 'Adicionar print vazio' }),
        upload("Relatorios.uploadVarios('antes.prints', this.files)", 'Enviar vários prints', true));
  }
  function abaAprovacao() {
    const itens = getP(S.atual.dados, 'aprovacao.itens') || [];
    const cards = itens.map((it, i) => {
      const p = 'aprovacao.itens.' + i, aberto = S.abertoItem === i;
      const lista = (k) => Array.isArray(it[k]);
      const cab = `<div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="Relatorios.abrirItem(${i})"><span style="font-weight:700;color:var(--blue);font-size:12px">${esc(it.id || 'A' + (i + 1))}</span><span style="font-weight:600;flex:1">${esc(it.titulo || 'Sem título')}</span><span style="color:var(--text-muted);font-size:11px">${esc(it.secao || '')}</span><i class="bi bi-chevron-${aberto ? 'up' : 'down'}"></i></div>`;
      if (!aberto) return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:8px">${cab}</div>`;
      const fld = (k, l) => `<div style="flex:1;min-width:260px">${campo(p + '.' + k, l + ` <label style="font-size:11px;color:var(--text-muted);margin-left:6px"><input type="checkbox" ${lista(k) ? 'checked' : ''} onchange="Relatorios.alternarLista('${p}.${k}',this.checked)"> em lista</label>`, lista(k) ? { lines: true, rows: 5 } : { area: true, rows: 5 })}</div>`;
      return `<div style="background:var(--bg-card);border:1px solid var(--border-bright);border-radius:var(--radius);padding:14px;margin-bottom:8px">${cab}<div style="margin-top:12px">
        ${linha(campo(p + '.id', 'Código', { w: '0 0 90px' }), campo(p + '.secao', 'Seção'), campo(p + '.titulo', 'Título', { w: 3 }))}
        ${campo(p + '.porque', 'Por que essa mudança (explicação para o cliente)', { area: true, rows: 2 })}
        <div style="display:flex;gap:10px;flex-wrap:wrap">${fld('antes', 'Hoje')}${fld('depois', 'Proposta')}</div>
        ${linha(campo(p + '.limite', 'Limite de caracteres (opcional)', { num: true, w: '0 0 200px' }), campo(p + '.pergunta', 'Pergunta para o cliente (opcional)', { area: true, rows: 2, w: 3 }))}
        <div style="font-weight:600;font-size:12.5px;margin:6px 0 2px">Produtos deste item</div>${linhas(p + '.produtos', [{ k: 'categoria', l: 'Categoria' }, { k: 'nome', l: 'Nome', w: 2 }, { k: 'preco', l: 'Preço' }, { k: 'descricao', l: 'Descrição', w: 3, area: true }, { k: 'foto', l: 'Foto sugerida (sem imagem)', w: 2 }], { img: 'img', add: 'Adicionar produto' })}
        <div style="font-weight:600;font-size:12.5px;margin:12px 0 2px">Fotos deste item</div>${linhas(p + '.imagens', [{ k: 'legenda', l: 'Legenda', w: 3 }], { img: 'img', add: 'Adicionar foto' })}
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">${btnMini('↑ Subir item', `Relatorios.mover('aprovacao.itens',${i},-1)`)}${btnMini('↓ Descer item', `Relatorios.mover('aprovacao.itens',${i},1)`)}${btnMini('<i class="bi bi-trash"></i> Remover item', `Relatorios.remover('aprovacao.itens',${i})`)}</div>
      </div></div>`;
    }).join('');
    return bloco('Instrução para o cliente', campo('aprovacao.instrucao', 'Texto acima dos itens', { area: true, rows: 2 })) +
      bloco('Itens para aprovar', cards || '<div style="color:var(--text-muted);font-size:13px">Nenhum item ainda.</div>', btnMini('<i class="bi bi-plus"></i> Novo item', 'Relatorios.novoItem()', 'btn-primary'));
  }
  function abaPrevia() {
    const v = S.atual.dados.previa || {};
    const fotos = v.fotos || [];
    return bloco('Cabeçalho do perfil', linha(campo('previa.nome', 'Nome no Google', { w: 3 }), campo('previa.categoria', 'Categoria', { w: 2 }), campo('previa.cidade', 'Cidade')) +
      linha(campo('previa.nota', 'Nota'), campo('previa.avaliacoes', 'Nº de avaliações'), campo('previa.logoTexto', 'Letra do logo (sem imagem)')) +
      `<div style="display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 10px"><div><div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:4px">Logo</div>${thumb(v.logo, 70)}<div style="margin-top:4px">${upload("Relatorios.uploadPara('previa.logo', this.files[0])", 'Trocar')}</div></div>
       <div><div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:4px">Capa</div>${thumb(v.capa, 70)}<div style="margin-top:4px">${upload("Relatorios.uploadPara('previa.capa', this.files[0])", 'Trocar')}</div></div>
       <div style="flex:1;min-width:240px"><div style="font-size:11.5px;color:var(--text-secondary);margin-bottom:4px">Fotos do perfil (${fotos.length})</div><div style="display:flex;gap:6px;flex-wrap:wrap">${fotos.map((f, i) => `<div style="position:relative">${thumb(f, 60)}<button onclick="Relatorios.remover('previa.fotos',${i})" style="position:absolute;top:-6px;right:-6px;border:0;border-radius:50%;width:18px;height:18px;background:var(--red);color:#fff;font-size:10px;cursor:pointer">✕</button></div>`).join('')}</div><div style="margin-top:6px">${upload("Relatorios.uploadVarios('previa.fotos', this.files, true)", 'Adicionar fotos', true)}</div></div></div>` +
      campo('previa.fotosSugeridas', 'Legendas da capa enquanto não há foto (até 3)', { lines: true, rows: 3 })) +
      bloco('Visão geral', campo('previa.descricao', 'Descrição', { area: true, rows: 5, dica: `${String(v.descricao || '').length} de 750 caracteres` }) +
        linha(campo('previa.endereco', 'Endereço', { w: 2 }), campo('previa.horario', 'Horário')) + linha(campo('previa.telefone', 'Telefone'), campo('previa.site', 'Site')) +
        campo('previa.atributos', 'Atributos', { lines: true, rows: 3 })) +
      bloco('Produtos', linhas('previa.produtos', [{ k: 'categoria', l: 'Categoria' }, { k: 'nome', l: 'Nome', w: 2 }, { k: 'preco', l: 'Preço' }, { k: 'botao', l: 'Botão' }, { k: 'descricao', l: 'Descrição', w: 3, area: true }, { k: 'foto', l: 'Foto sugerida', w: 2 }], { img: 'img', add: 'Adicionar produto' }),
        btnMini('<i class="bi bi-arrow-repeat"></i> Copiar dos itens de aprovação', 'Relatorios.copiarProdutos()')) +
      bloco('Serviços', linhas('previa.servicos', [{ k: 'nome', l: 'Nome', w: 2 }, { k: 'preco', l: 'Preço' }, { k: 'descricao', l: 'Descrição', w: 3 }], { add: 'Adicionar serviço' })) +
      bloco('Atualizações (posts)', linhas('previa.posts', [{ k: 'data', l: 'Data' }, { k: 'texto', l: 'Texto', w: 4, area: true }, { k: 'botao', l: 'Botão' }, { k: 'foto', l: 'Foto sugerida' }], { img: 'img', add: 'Adicionar post' })) +
      bloco('Texto ao lado do celular', campo('previa.texto', 'Explicação', { area: true, rows: 2 }) + campo('previa.destaques', 'Destaques', { lines: true, rows: 4 }));
  }
  function abaRespostas() {
    const r = S.atual, resp = r.token && S.respostas[r.token];
    if (!r.token) return bloco('Respostas do cliente', '<div style="color:var(--text-secondary);font-size:13px">O relatório ainda não foi enviado. Use “Gerar link do cliente” no topo.</div>');
    if (!resp) return bloco('Respostas do cliente', `<div style="color:var(--text-secondary);font-size:13px">O cliente ainda não respondeu. Link: <a href="${esc(linkCliente(r.token))}" target="_blank" rel="noopener">${esc(linkCliente(r.token))}</a></div>`, btnMini('<i class="bi bi-arrow-clockwise"></i> Atualizar', 'Relatorios.recarregarRespostas()'));
    const itens = (r.dados.aprovacao || {}).itens || [];
    const rows = itens.map((it, i) => {
      const code = it.id || 'A' + (i + 1), s = (resp.respostas || {})[code] || {};
      const st = s.st === 'ok' ? '<span style="color:var(--green);font-weight:700">✓ Aprovado</span>' : s.st === 'aj' ? '<span style="color:var(--yellow);font-weight:700">✎ Ajustar</span>' : '<span style="color:var(--text-muted)">Sem resposta</span>';
      return `<tr><td style="padding:8px;border-top:1px solid var(--border);white-space:nowrap;font-weight:700;color:var(--blue)">${esc(code)}</td><td style="padding:8px;border-top:1px solid var(--border)">${esc(it.titulo)}${it.pergunta ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">Pergunta: ${esc(it.pergunta)}</div>` : ''}</td><td style="padding:8px;border-top:1px solid var(--border);white-space:nowrap">${st}</td><td style="padding:8px;border-top:1px solid var(--border);white-space:pre-wrap">${esc(s.nota || '')}</td></tr>`;
    }).join('');
    return bloco('Respostas do cliente', `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">${resp.enviado ? `<b style="color:var(--green)">Enviado pelo cliente em ${fmt(resp.enviadoEm)}</b>` : 'O cliente começou a responder, mas ainda não clicou em enviar.'} · última alteração ${fmt(resp.atualizadoEm)}</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:var(--text-muted);font-size:11.5px"><th style="padding:6px 8px">Item</th><th style="padding:6px 8px">O quê</th><th style="padding:6px 8px">Resposta</th><th style="padding:6px 8px">Comentário</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      btnMini('<i class="bi bi-arrow-clockwise"></i> Atualizar', 'Relatorios.recarregarRespostas()') + ' ' + btnMini('<i class="bi bi-clipboard"></i> Copiar resumo', 'Relatorios.copiarResumo()'));
  }
  function abaJson() {
    return bloco('Dados completos (avançado)', `<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Mesmo formato do dados.json. Imagens aparecem como img:&lt;id&gt;. Edite com cuidado e clique em “Aplicar”.</div>
      <textarea id="rel-json" class="form-input" rows="22" style="width:100%;font-family:var(--mono);font-size:12px">${esc(JSON.stringify(S.atual.dados, null, 2))}</textarea>`,
      btnMini('Aplicar', 'Relatorios.aplicarJson()', 'btn-primary') + ' ' + btnMini('<i class="bi bi-download"></i> Baixar .json', 'Relatorios.baixarJson()'));
  }

  function renderEditor() {
    const r = S.atual, d = r.dados, st = STATUS[r.status] || STATUS.rascunho;
    const corpo = { geral: abaGeral, antes: abaAntes, aprovacao: abaAprovacao, previa: abaPrevia, respostas: abaRespostas, json: abaJson }[S.aba]();
    const rr = resumoResp(r);
    $('main-content').innerHTML = `<div class="page-wrap" id="rel-editor">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0"><button class="btn btn-ghost" onclick="Relatorios.voltar()"><i class="bi bi-arrow-left"></i></button>
          <div style="min-width:0"><div style="font-weight:700;font-size:17px">${esc((d.cliente || {}).nome || 'Sem nome')}</div><div style="font-size:12px;color:${st.c}">${st.l}${rr ? ` · ✓ ${rr.ok} · ✎ ${rr.aj} de ${rr.total}` : ''}</div></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span id="rel-sujo" style="font-size:12px;color:var(--yellow)">${S.sujo ? 'Alterações não salvas' : ''}</span>
          <button class="btn btn-ghost" onclick="Relatorios.verPrevia()"><i class="bi bi-eye"></i> Ver como o cliente</button>
          <button class="btn btn-ghost" onclick="Relatorios.salvar()"><i class="bi bi-save"></i> Salvar</button>
          <button class="btn btn-primary" onclick="Relatorios.publicar()"><i class="bi bi-send"></i> ${r.token ? 'Atualizar link do cliente' : 'Gerar link do cliente'}</button>
        </div>
      </div>
      ${r.token ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--accent-soft);border:1px solid var(--border-bright);border-radius:var(--radius);padding:9px 12px;margin-bottom:12px;font-size:12.5px"><i class="bi bi-link-45deg"></i><span style="overflow-wrap:anywhere;flex:1">${esc(linkCliente(r.token))}</span>${btnMini('Copiar', `Relatorios.copiarLink('${esc(r.token)}')`)}<a class="btn btn-ghost" style="font-size:11.5px;padding:4px 9px" target="_blank" rel="noopener" href="${esc(linkCliente(r.token))}">Abrir</a>${r.publicadoEm ? `<span style="color:${r.naoPublicado ? 'var(--yellow)' : 'var(--text-muted)'}">publicado ${fmt(r.publicadoEm)}${r.naoPublicado ? ' · há mudanças que o cliente ainda não vê: clique em “Atualizar link do cliente”' : ''}</span>` : ''}</div>` : ''}
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;overflow-x:auto">${ABAS.map(([k, l]) => `<button onclick="Relatorios.aba('${k}')" style="background:none;border:0;border-bottom:2px solid ${S.aba === k ? 'var(--accent)' : 'transparent'};color:${S.aba === k ? 'var(--text-primary)' : 'var(--text-secondary)'};padding:9px 12px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;white-space:nowrap">${l}</button>`).join('')}</div>
      ${corpo}
      <div id="rel-previa-wrap" style="display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.7);padding:20px"><div style="height:100%;max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;color:#fff"><b>Prévia: é assim que o cliente vê</b><button class="btn btn-ghost" onclick="document.getElementById('rel-previa-wrap').style.display='none'">Fechar</button></div><iframe id="rel-previa" style="flex:1;border:0;border-radius:12px;background:#05030d;width:100%"></iframe></div></div>
    </div>`;
  }

  // edição: um listener para todos os campos
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!S.atual || !t.closest || !t.closest('#rel-editor') || !t.dataset || !t.dataset.p) return;
    let v = t.value;
    if (t.dataset.k === 'lines') v = v.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (t.dataset.k === 'num') v = v === '' ? '' : Number(String(v).replace(',', '.'));
    setP(S.atual.dados, t.dataset.p, v);
    marcarSujo();
  });
  document.addEventListener('change', (e) => { const t = e.target; if (t.tagName === 'SELECT' && t.dataset && t.dataset.p && S.atual && t.closest('#rel-editor')) { setP(S.atual.dados, t.dataset.p, t.value); marcarSujo(); } });
  function marcarSujo() { S.sujo = true; if (S.atual && S.atual.token) S.atual.naoPublicado = true; const el = $('rel-sujo'); if (el) el.textContent = 'Alterações não salvas'; clearTimeout(S._auto); S._auto = setTimeout(() => R.salvar(true), 4000); }
  const reRender = () => { const y = window.scrollY, m = document.querySelector('.main'); const ym = m ? m.scrollTop : 0; renderEditor(); window.scrollTo(0, y); if (m) m.scrollTop = ym; };

  R.aba = (k) => { S.aba = k; renderEditor(); };
  R.abrirItem = (i) => { S.abertoItem = S.abertoItem === i ? null : i; reRender(); };
  R.set = (p, v) => { setP(S.atual.dados, p, v); marcarSujo(); reRender(); };
  R.setRoot = (k, v) => { S.atual[k] = v; marcarSujo(); };
  R.adicionar = (path) => { const a = getP(S.atual.dados, path) || []; a.push(novoPara(path)); setP(S.atual.dados, path, a); marcarSujo(); reRender(); };
  R.remover = (path, i) => { const a = getP(S.atual.dados, path) || []; if (path === 'aprovacao.itens' && !confirm('Remover este item?')) return; a.splice(i, 1); if (path === 'aprovacao.itens') S.abertoItem = null; marcarSujo(); reRender(); };
  R.mover = (path, i, d) => { const a = getP(S.atual.dados, path) || []; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; if (path === 'aprovacao.itens') S.abertoItem = j; marcarSujo(); reRender(); };
  R.alternarLista = (p, emLista) => { const v = getP(S.atual.dados, p); setP(S.atual.dados, p, emLista ? String(v || '').split('\n').map((x) => x.trim()).filter(Boolean) : (Array.isArray(v) ? v.join('\n') : v || '')); marcarSujo(); reRender(); };
  R.novoItem = () => { const a = getP(S.atual.dados, 'aprovacao.itens') || []; a.push({ id: 'A' + (a.length + 1), secao: '', titulo: 'Novo item', porque: '', antes: '', depois: '', pergunta: '' }); setP(S.atual.dados, 'aprovacao.itens', a); S.abertoItem = a.length - 1; marcarSujo(); reRender(); };
  R.copiarProdutos = () => {
    const it = ((S.atual.dados.aprovacao || {}).itens || []).find((x) => (x.produtos || []).length);
    if (!it) return toast('Nenhum item de aprovação tem produtos.');
    if ((S.atual.dados.previa.produtos || []).length && !confirm('Trocar os produtos da prévia pelos do item ' + (it.id || '') + '?')) return;
    S.atual.dados.previa.produtos = it.produtos.map((p) => ({ botao: 'Pedir pelo WhatsApp', ...p }));
    marcarSujo(); reRender();
  };
  R.uploadPara = async (path, file) => {
    if (!file) return;
    try { toast('Enviando foto…'); setP(S.atual.dados, path, await salvarImagem(await lerArquivo(file), S.atual.id)); marcarSujo(); reRender(); }
    catch (e) { alert('Não consegui enviar a foto: ' + e.message); }
  };
  R.uploadVarios = async (path, files, soRef) => {
    const a = getP(S.atual.dados, path) || [];
    for (const f of Array.from(files || [])) {
      try { toast('Enviando ' + f.name + '…'); const ref = await salvarImagem(await lerArquivo(f), S.atual.id); a.push(soRef ? ref : { img: ref, titulo: f.name.replace(/\.[^.]+$/, '').replace(/^\d+\s*/, ''), observacao: '' }); }
      catch (e) { alert('Falhou ' + f.name + ': ' + e.message); }
    }
    setP(S.atual.dados, path, a); marcarSujo(); reRender();
  };
  R.aplicarJson = () => { try { S.atual.dados = JSON.parse($('rel-json').value); marcarSujo(); toast('Aplicado. Lembre de salvar.'); } catch (e) { alert('JSON inválido: ' + e.message); } };
  R.baixarJson = () => { const b = new Blob([JSON.stringify(S.atual.dados, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'relatorio-' + ((S.atual.dados.cliente || {}).nome || 'cliente').replace(/\W+/g, '-').toLowerCase() + '.json'; a.click(); };

  R.salvar = async (silencioso) => {
    clearTimeout(S._auto);
    if (!S.atual) return;
    const { id, ...rest } = S.atual;
    try {
      await window.dbSet(COL, id, rest);
      S.atual.updatedAt = new Date().toISOString();
      S.sujo = false; const el = $('rel-sujo'); if (el) el.textContent = silencioso ? 'Salvo automaticamente' : '';
      if (!silencioso) toast('Relatório salvo');
    } catch (e) { console.error(e); alert('Erro ao salvar: ' + e.message); }
  };
  R.publicar = async () => {
    const r = S.atual;
    if (!((r.dados.aprovacao || {}).itens || []).length && !confirm('O relatório não tem itens para aprovar. Gerar o link assim mesmo?')) return;
    if (!r.token) r.token = genId(24);
    const agora = new Date().toISOString();
    try {
      await window.dbSet(PUB, r.token, { dados: r.dados, relatorioId: r.id, publicadoEm: agora });
      r.publicadoEm = agora; r.naoPublicado = false;
      if (!r.status || r.status === 'rascunho') r.status = 'enviado';
      await R.salvar(true);
      R.copiarLink(r.token);
      reRender();
    } catch (e) { console.error(e); alert('Não consegui gerar o link: ' + e.message + '\n\nSe for "permission-denied", as regras novas do Firestore ainda não foram publicadas.'); }
  };
  R.verPrevia = async () => {
    const dados = await window.RelatorioRender.resolverImagens(S.atual.dados, (id) => urlImg('img:' + id));
    const wrap = $('rel-previa-wrap'), fr = $('rel-previa');
    wrap.style.display = 'block';
    const envia = (e) => { if (e.origin === location.origin && e.data && e.data.tipo === 'relatorio-previa-pronta') { fr.contentWindow.postMessage({ tipo: 'relatorio-previa', dados, respostas: (S.respostas[S.atual.token] || {}).respostas }, location.origin); window.removeEventListener('message', envia); } };
    window.addEventListener('message', envia);
    fr.src = 'relatorio.html?previa=1&t=' + Date.now();
  };
  R.recarregarRespostas = async () => { if (S.atual.token) S.respostas[S.atual.token] = await window.dbGet(RESP, S.atual.token).catch(() => null); reRender(); };
  R.copiarResumo = () => { const resp = S.respostas[S.atual.token]; const t = (resp && resp.texto) || JSON.stringify((resp || {}).respostas || {}, null, 1); navigator.clipboard.writeText(t).then(() => toast('Resumo copiado')); };
  R.voltar = async () => { if (S.sujo) await R.salvar(true); R.abrir(); };
  R.apagar = async () => {
    const r = S.atual;
    if (!confirm('Apagar o relatório de ' + ((r.dados.cliente || {}).nome || '') + '? O link do cliente para de funcionar. Não dá para desfazer.')) return;
    for (const id of refsImagens(r.dados)) await window.dbRemove(IMG, id);
    if (r.token) { await window.dbRemove(PUB, r.token); }
    await window.dbRemove(COL, r.id);
    S.sujo = false; toast('Relatório apagado'); R.abrir();
  };
})();
