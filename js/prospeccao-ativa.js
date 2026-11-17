/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Prospecção ativa (campanhas de abordagem pelo WhatsApp)
   Página: prospeccao (aba "Prospecção ativa"; a aba "Leads (CRM)" é o renderProspeccao antigo).
   Coleções (todas com login, regra padrão isAuth):
     ghub_prosp_campanhas  id = slug · { nome, tipo, descricao, preco, texto1, textosNicho{}, texto2, extras[], equipe[], porPeriodo, ativa }
     ghub_prosp_empresas   id = campanhaId + '_' + tel · { campanhaId, nome, curto, tel, nicho, cat, end, cidade, nota, aval, insta,
                                                          responsavel, whatsapp, dia, periodo, ordem, status, hist[], ficha{}, previa,
                                                          enviadoPor, enviadoEm, sessaoId }
     ghub_prosp_sessoes    id = auto · { campanhaId, responsavel, whatsapp, dia, periodo, inicio, fim, enviadas, login }
   Importação: .json gerado pelo Claude ({ campanha?: {...}, empresas?: [...] }). Empresas sem responsável
   são distribuídas pela equipe da campanha (por nicho) e, sem dia/período, entram nos próximos períodos livres.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const C_CAMP = 'ghub_prosp_campanhas', C_EMP = 'ghub_prosp_empresas', C_SES = 'ghub_prosp_sessoes';
  const ETAPAS = [
    ['a_enviar', 'A enviar', 'var(--text-muted)'], ['enviada', 'Mensagem enviada', 'var(--blue)'],
    ['respondeu', 'Respondeu', 'var(--purple)'], ['quer_previa', 'Disse SIM · montar', 'var(--yellow)'],
    ['previa_enviada', 'Prévia/proposta enviada', 'var(--orange)'], ['fechou', 'Fechou', 'var(--green)'],
    ['sem_interesse', 'Sem interesse', 'var(--red)'], ['sem_whatsapp', 'Sem WhatsApp', 'var(--red)'],
  ];
  const ET = Object.fromEntries(ETAPAS.map(([k, l, c]) => [k, { l, c }]));
  const TIPOS = { site: 'Site', google: 'Perfil no Google', outro: 'Outro' };
  const CAMPOS = [['responsavel', 'Nome de quem respondeu'], ['google', 'Link do perfil no Google'], ['instagram', 'Link do Instagram'],
    ['facebook', 'Link do Facebook'], ['outras', 'Outras redes ou links'], ['resumo', 'Resumo da empresa (IA do Google)', 1], ['obs', 'Observações da conversa', 1]];
  const PERIODOS = ['Manhã', 'Tarde'];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const toast = (m) => { if (window.UI && UI.toast) return UI.toast(m); alert(m); };
  const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const agora = () => new Date().toISOString();
  const fmtTel = (t) => (t && t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t || '');
  const fmtData = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const perKey = (e) => (e.dia ? e.dia + '|' + e.periodo : '');
  const perNome = (k) => { if (!k) return 'Sem período'; const [d, p] = k.split('|'); const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + p; };
  const perOrdem = (a, b) => a.split('|')[0].localeCompare(b.split('|')[0]) || (a.endsWith('Manhã') ? -1 : 1);
  const meuNome = () => String((window.currentUser || {}).name || '').trim();
  const mesmaPessoa = (a, b) => { const x = String(a || '').toLowerCase().trim(), y = String(b || '').toLowerCase().trim(); return !!x && !!y && (x === y || x.split(' ')[0] === y.split(' ')[0]); };
  const sel = 'background:var(--bg-base);border:1px solid var(--border-bright);border-radius:8px;color:var(--text-primary);padding:8px 10px;font-size:13px;font-family:var(--font)';

  const S = { camps: [], emps: [], sess: [], camp: null, aba: 'fila', pessoa: null, per: null, filtro: '', busca: '', abertos: new Set(), editando: null };
  const P = {};
  window.ProspAtiva = P;

  // ── dados ──────────────────────────────────────────────────────────────
  async function carregarCamps() { S.camps = (await window.dbList(C_CAMP)).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); }
  async function carregarEmps() { S.emps = await window.dbList(C_EMP); }
  async function carregarSess() { S.sess = (await window.dbList(C_SES)).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))); }
  const salvarEmp = (e) => window.dbSet(C_EMP, e.id, e);
  const empsDa = (cid) => S.emps.filter((e) => e.campanhaId === cid);

  function nomeMsg(e) { return String(e.curto || e.nome || '').replace(/^(o |a )?(consultório|clínica) d[ao]s? /i, '').trim(); }
  function texto1(c, e) {
    const t = (c.textosNicho && c.textosNicho[e.nicho]) || c.texto1 || '';
    return t.replace(/\{NOME\}/g, nomeMsg(e)).replace(/\{NICHO\}/g, e.nicho || '').replace(/\{CIDADE\}/g, (e.cidade || '').split('/')[0]);
  }
  const waLink = (tel, txt) => `https://web.whatsapp.com/send?phone=55${tel}${txt ? '&text=' + encodeURIComponent(txt) : ''}`;
  async function copiar(t) {
    try { await navigator.clipboard.writeText(t); toast('Copiado'); }
    catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (x) { toast('Selecione e copie com Ctrl+C'); } a.remove(); }
  }
  function fichaTexto(e) {
    const f = e.ficha || {};
    return `PEDIDO DE PRÉVIA\nEmpresa: ${e.nome}\nNicho: ${e.nicho || ''}\nWhatsApp: ${fmtTel(e.tel)}\nEndereço: ${e.end || ''} · ${e.cidade || ''}\nProspectado por: ${e.enviadoPor || e.responsavel || ''}\n` + CAMPOS.map(([k, n]) => `${n}: ${f[k] || '-'}`).join('\n');
  }
  function sessaoAtiva(cid, pessoa) {
    return S.sess.find((s) => s.campanhaId === cid && !s.fim && (!pessoa || mesmaPessoa(s.responsavel, pessoa)) && s.dia === hojeISO());
  }
  function notificarAdmins(titulo, corpo) {
    if (!window.sendFirebaseNotif) return;
    let users = []; try { users = JSON.parse(localStorage.getItem('dc_all_users') || '[]'); } catch (e) {}
    users.filter((u) => u.role === 'admin' && u.uid && u.uid !== (window.currentUser || {}).uid).forEach((u) => {
      window.sendFirebaseNotif(u.uid, { id: Date.now() + Math.random(), title: titulo, body: corpo, type: 'prospeccao', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), read: false });
    });
  }

  // ── abas da página Prospecção ─────────────────────────────────────────
  P.abas = (atual) => `<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:18px">
      ${[['ativa', 'Prospecção ativa', 'bi-send'], ['leads', 'Leads (CRM)', 'bi-person-lines-fill']].map(([k, l, i]) => `<button onclick="window._prspTab='${k}';renderProspeccao()" style="background:none;border:0;border-bottom:2px solid ${atual === k ? 'var(--accent)' : 'transparent'};color:${atual === k ? 'var(--text-primary)' : 'var(--text-muted)'};font-family:var(--font);font-weight:600;font-size:13px;padding:9px 14px;cursor:pointer"><i class="bi ${i}"></i> ${l}</button>`).join('')}
    </div>`;

  // ── tela inicial: campanhas ───────────────────────────────────────────
  P.abrir = async () => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Carregando prospecções…</div>';
    S.camp = null;
    await Promise.all([carregarCamps(), carregarEmps(), carregarSess()]);
    inicio();
  };

  function inicio() {
    const eu = meuNome();
    const cards = S.camps.map((c) => {
      const es = empsDa(c.id);
      const n = (k) => es.filter((e) => (e.status || 'a_enviar') === k).length;
      const minhas = es.filter((e) => mesmaPessoa(e.responsavel, eu));
      const minhasPend = minhas.filter((e) => (e.status || 'a_enviar') === 'a_enviar').length;
      const equipe = (c.equipe || []).map((p) => `<span style="font-size:11.5px;border:1px solid var(--border-bright);border-radius:20px;padding:2px 9px">${esc(p.nome)} · <i class="bi bi-whatsapp" style="color:var(--green)"></i> ${esc(p.whatsapp || '')}</span>`).join(' ');
      const ativas = S.sess.filter((s) => s.campanhaId === c.id && !s.fim && s.dia === hojeISO());
      return `<div class="card" style="padding:18px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-card);display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div><div style="font-weight:700;font-size:16px">${esc(c.nome)}</div>
          <div style="color:var(--text-muted);font-size:12px">${esc(TIPOS[c.tipo] || c.tipo || '')}${c.preco ? ' · ' + esc(c.preco) : ''}${c.ativa === false ? ' · pausada' : ''}</div></div>
          <button class="btn btn-ghost" style="font-size:12px;padding:5px 10px" onclick="ProspAtiva.editar('${esc(c.id)}')"><i class="bi bi-gear"></i> Configurar</button>
        </div>
        ${c.descricao ? `<div style="font-size:12.5px;color:var(--text-secondary)">${esc(c.descricao)}</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${[['a_enviar', 'A enviar'], ['enviada', 'Enviadas'], ['quer_previa', 'Disseram SIM'], ['fechou', 'Fecharam']].map(([k, l]) => `<div style="background:var(--bg-base);border:1px solid var(--border);border-radius:10px;padding:8px 10px"><div style="font-size:18px;font-weight:700;color:${ET[k].c}">${n(k) + (k === 'quer_previa' ? n('previa_enviada') : 0)}</div><div style="font-size:11px;color:var(--text-muted)">${l}</div></div>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${equipe || '<span style="font-size:12px;color:var(--text-muted)">Sem equipe definida</span>'}</div>
        ${ativas.length ? `<div style="font-size:12px;color:var(--green)"><i class="bi bi-broadcast"></i> Prospectando agora: ${ativas.map((s) => `<b>${esc(s.responsavel)}</b> (${esc(s.whatsapp)}, desde ${fmtHora(s.inicio)})`).join(', ')}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">
          <button class="btn btn-primary" onclick="ProspAtiva.campanha('${esc(c.id)}')"><i class="bi bi-play-fill"></i> ${minhas.length ? `Minha lista (${minhasPend} a enviar)` : 'Abrir'}</button>
          ${minhas.length ? `<button class="btn btn-ghost" onclick="ProspAtiva.campanha('${esc(c.id)}','__todos')">Ver tudo</button>` : ''}
        </div>
      </div>`;
    }).join('');
    $('main-content').innerHTML = `<div class="page-wrap">
      ${P.abas('ativa')}
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <div><h2 style="margin:0;font-size:20px">Prospecção ativa</h2>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:4px">Cada prospecção tem os textos, a equipe e a lista de empresas da semana. Cada pessoa abre a sua lista, inicia o período e vai enviando.</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn btn-ghost" style="cursor:pointer"><i class="bi bi-upload"></i> Importar empresas do Claude (.json)<input type="file" accept=".json,application/json" multiple style="display:none" onchange="ProspAtiva.importar(this.files);this.value=''"></label>
          <button class="btn btn-primary" onclick="ProspAtiva.editar(null)"><i class="bi bi-plus-lg"></i> Nova prospecção</button>
        </div>
      </div>
      ${cards ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px">${cards}</div>`
        : `<div class="card" style="padding:40px;text-align:center;border:1px dashed var(--border-bright);border-radius:var(--radius-lg);color:var(--text-secondary)">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Nenhuma prospecção ainda</div>
          Crie uma em <b>Nova prospecção</b> (textos, equipe e WhatsApp de cada pessoa) ou importe o arquivo .json que o Claude gera com a campanha e as empresas.</div>`}
    </div>`;
  }

  // ── criar / configurar campanha ───────────────────────────────────────
  P.editar = (id) => {
    const c = id ? JSON.parse(JSON.stringify(S.camps.find((x) => x.id === id) || {})) : { nome: '', tipo: 'site', preco: '', descricao: '', texto1: '', textosNicho: {}, texto2: '', extras: [], equipe: [{ nome: meuNome(), whatsapp: '', nichos: '' }], porPeriodo: 50, ativa: true };
    S.editando = c;
    const nichos = Object.entries(c.textosNicho || {});
    const linhaNicho = (n, t, i) => `<div class="pa-nicho" style="display:grid;gap:6px;border:1px solid var(--border);border-radius:10px;padding:10px">
        <div style="display:flex;gap:8px;align-items:center"><input class="pa-nicho-nome" value="${esc(n)}" placeholder="Nicho (ex.: Estética)" style="${sel};flex:1"><button class="btn btn-ghost" style="padding:4px 9px" onclick="this.closest('.pa-nicho').remove()"><i class="bi bi-trash"></i></button></div>
        <textarea class="pa-nicho-texto" rows="6" style="${sel};resize:vertical">${esc(t)}</textarea></div>`;
    const linhaEquipe = (p) => `<div class="pa-pessoa" style="display:grid;grid-template-columns:1fr 1fr 1.4fr auto;gap:8px;align-items:center">
        <input class="pa-p-nome" value="${esc(p.nome)}" placeholder="Nome (ex.: Fernanda)" style="${sel}">
        <input class="pa-p-wpp" value="${esc(p.whatsapp)}" placeholder="WhatsApp usado (ex.: Conexa Local)" style="${sel}">
        <input class="pa-p-nichos" value="${esc(Array.isArray(p.nichos) ? p.nichos.join(', ') : p.nichos || '')}" placeholder="Nichos dela/dele, separados por vírgula" style="${sel}">
        <button class="btn btn-ghost" style="padding:4px 9px" onclick="this.closest('.pa-pessoa').remove()"><i class="bi bi-trash"></i></button></div>`;
    const linhaExtra = (x) => `<div class="pa-extra" style="display:grid;gap:6px;border:1px solid var(--border);border-radius:10px;padding:10px">
        <div style="display:flex;gap:8px"><input class="pa-x-tit" value="${esc(x.titulo)}" placeholder="Quando usar (ex.: secretária respondeu)" style="${sel};flex:1"><button class="btn btn-ghost" style="padding:4px 9px" onclick="this.closest('.pa-extra').remove()"><i class="bi bi-trash"></i></button></div>
        <textarea class="pa-x-txt" rows="3" style="${sel};resize:vertical">${esc(x.texto)}</textarea></div>`;
    P._linhas = { linhaNicho, linhaEquipe, linhaExtra };
    const lbl = (t, d) => `<div style="font-weight:600;font-size:13px">${t}</div>${d ? `<div style="font-size:12px;color:var(--text-muted);margin:-4px 0 2px">${d}</div>` : ''}`;
    $('main-content').innerHTML = `<div class="page-wrap" style="max-width:920px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><button class="btn btn-ghost" onclick="ProspAtiva.abrir()"><i class="bi bi-arrow-left"></i> Prospecção ativa</button>
      <h2 style="margin:0;font-size:19px">${id ? 'Configurar prospecção' : 'Nova prospecção'}</h2></div>
      <div class="card" style="padding:20px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-card);display:grid;gap:14px">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
          <label style="display:grid;gap:6px">${lbl('Nome da prospecção')}<input id="pa-nome" value="${esc(c.nome)}" placeholder="Ex.: Site R$ 600" style="${sel}"></label>
          <label style="display:grid;gap:6px">${lbl('Tipo')}<select id="pa-tipo" style="${sel}">${Object.entries(TIPOS).map(([k, l]) => `<option value="${k}"${c.tipo === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label style="display:grid;gap:6px">${lbl('Preço / oferta')}<input id="pa-preco" value="${esc(c.preco)}" placeholder="R$ 600 ou 6x" style="${sel}"></label>
        </div>
        <label style="display:grid;gap:6px">${lbl('Informação base', 'O que estamos oferecendo e para quem. Aparece para a equipe no topo da lista.')}<textarea id="pa-desc" rows="3" style="${sel};resize:vertical">${esc(c.descricao)}</textarea></label>
        <label style="display:grid;gap:6px">${lbl('Texto 1 · abordagem (padrão)', 'Use {NOME} onde entra o nome da empresa e {CIDADE} para a cidade.')}<textarea id="pa-t1" rows="8" style="${sel};resize:vertical">${esc(c.texto1)}</textarea></label>
        <div style="display:grid;gap:8px">${lbl('Texto 1 por nicho (opcional)', 'Se o nicho da empresa tiver um texto aqui, ele substitui o padrão.')}
          <div id="pa-nichos" style="display:grid;gap:8px">${nichos.map(([n, t], i) => linhaNicho(n, t, i)).join('')}</div>
          <button class="btn btn-ghost" style="justify-self:start" onclick="document.getElementById('pa-nichos').insertAdjacentHTML('beforeend',ProspAtiva._linhas.linhaNicho('','',0))"><i class="bi bi-plus"></i> Texto para um nicho</button></div>
        <label style="display:grid;gap:6px">${lbl('Texto 2 · quando a pessoa disser SIM')}<textarea id="pa-t2" rows="4" style="${sel};resize:vertical">${esc(c.texto2)}</textarea></label>
        <div style="display:grid;gap:8px">${lbl('Respostas extras', 'Textos prontos para situações comuns (secretária, sem interesse, pergunta de preço).')}
          <div id="pa-extras" style="display:grid;gap:8px">${(c.extras || []).map(linhaExtra).join('')}</div>
          <button class="btn btn-ghost" style="justify-self:start" onclick="document.getElementById('pa-extras').insertAdjacentHTML('beforeend',ProspAtiva._linhas.linhaExtra({titulo:'',texto:''}))"><i class="bi bi-plus"></i> Resposta extra</button></div>
        <div style="display:grid;gap:8px">${lbl('Equipe e WhatsApp de cada pessoa', 'As empresas importadas são distribuídas por nicho para cada pessoa. Deixe os nichos vazios para quem pega o resto.')}
          <div id="pa-equipe" style="display:grid;gap:8px">${(c.equipe || []).map(linhaEquipe).join('')}</div>
          <button class="btn btn-ghost" style="justify-self:start" onclick="document.getElementById('pa-equipe').insertAdjacentHTML('beforeend',ProspAtiva._linhas.linhaEquipe({nome:'',whatsapp:'',nichos:''}))"><i class="bi bi-plus"></i> Pessoa</button></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:8px;align-items:center;font-size:13px">Empresas por período <input id="pa-porper" type="number" min="5" max="100" value="${esc(c.porPeriodo || 50)}" style="${sel};width:80px"></label>
          <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input id="pa-ativa" type="checkbox" ${c.ativa !== false ? 'checked' : ''}> Prospecção ativa</label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" onclick="ProspAtiva.abrir()">Cancelar</button><button class="btn btn-primary" onclick="ProspAtiva.salvarCamp()"><i class="bi bi-check-lg"></i> Salvar prospecção</button></div>
      </div></div>`;
  };

  P.salvarCamp = async () => {
    const c = S.editando || {};
    c.nome = $('pa-nome').value.trim(); if (!c.nome) return toast('Dê um nome para a prospecção');
    c.tipo = $('pa-tipo').value; c.preco = $('pa-preco').value.trim(); c.descricao = $('pa-desc').value.trim();
    c.texto1 = $('pa-t1').value; c.texto2 = $('pa-t2').value;
    c.textosNicho = {}; document.querySelectorAll('.pa-nicho').forEach((d) => { const n = d.querySelector('.pa-nicho-nome').value.trim(); if (n) c.textosNicho[n] = d.querySelector('.pa-nicho-texto').value; });
    c.extras = [...document.querySelectorAll('.pa-extra')].map((d) => ({ titulo: d.querySelector('.pa-x-tit').value.trim(), texto: d.querySelector('.pa-x-txt').value })).filter((x) => x.titulo || x.texto);
    c.equipe = [...document.querySelectorAll('.pa-pessoa')].map((d) => ({ nome: d.querySelector('.pa-p-nome').value.trim(), whatsapp: d.querySelector('.pa-p-wpp').value.trim(), nichos: d.querySelector('.pa-p-nichos').value.split(',').map((s) => s.trim()).filter(Boolean) })).filter((p) => p.nome);
    c.porPeriodo = Math.max(5, Math.min(100, parseInt($('pa-porper').value, 10) || 50)); c.ativa = $('pa-ativa').checked;
    c.id = c.id || slug(c.nome);
    await window.dbSet(C_CAMP, c.id, c);
    toast('Prospecção salva');
    await carregarCamps();
    P.campanha(c.id);
  };

  // ── importação do Claude ──────────────────────────────────────────────
  function distribuir(camp, novas) {
    const equipe = camp.equipe || [];
    const porPer = camp.porPeriodo || 50;
    const resto = equipe.find((p) => !(p.nichos || []).length);
    novas.forEach((e) => {
      if (!e.responsavel) {
        const p = equipe.find((x) => (x.nichos || []).some((n) => slug(n) === slug(e.nicho))) || resto || equipe[0];
        if (p) { e.responsavel = p.nome; e.whatsapp = e.whatsapp || p.whatsapp; }
      } else if (!e.whatsapp) { const p = equipe.find((x) => mesmaPessoa(x.nome, e.responsavel)); if (p) e.whatsapp = p.whatsapp; }
    });
    // períodos: por pessoa, continua depois do último período já usado (a partir de hoje)
    const pessoas = [...new Set(novas.filter((e) => !e.dia).map((e) => e.responsavel || ''))];
    pessoas.forEach((pes) => {
      const ja = empsDa(camp.id).filter((e) => (e.responsavel || '') === pes && e.dia);
      const cont = {}; ja.forEach((e) => { cont[perKey(e)] = (cont[perKey(e)] || 0) + 1; });
      let d = new Date(hojeISO() + 'T12:00:00'), pi = 0;
      const prox = () => { pi++; if (pi > 1) { pi = 0; d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); } };
      while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
      novas.filter((e) => !e.dia && (e.responsavel || '') === pes).forEach((e) => {
        let k = d.toISOString().slice(0, 10) + '|' + PERIODOS[pi];
        while ((cont[k] || 0) >= porPer) { prox(); k = d.toISOString().slice(0, 10) + '|' + PERIODOS[pi]; }
        cont[k] = (cont[k] || 0) + 1;
        [e.dia, e.periodo] = k.split('|'); e.ordem = cont[k];
      });
    });
  }

  P.importar = async (files) => {
    const arqs = Array.from(files || []); if (!arqs.length) return;
    $('main-content').insertAdjacentHTML('afterbegin', '<div id="pa-imp" style="position:sticky;top:0;z-index:5;background:var(--bg-card);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;margin:10px">Importando…</div>');
    let nCamp = 0, nEmp = 0, nIgual = 0; const erros = [];
    for (const f of arqs) {
      try {
        const j = JSON.parse(await f.text());
        let camp = null;
        if (j.campanha) {
          const atual = S.camps.find((x) => x.id === (j.campanha.id || slug(j.campanha.nome)));
          camp = { ...(atual || {}), ...j.campanha, id: j.campanha.id || slug(j.campanha.nome) };
          await window.dbSet(C_CAMP, camp.id, camp); nCamp++;
          await carregarCamps();
        }
        const cid = (camp && camp.id) || j.campanhaId || (S.camp && S.camp.id);
        camp = camp || S.camps.find((x) => x.id === cid);
        if (Array.isArray(j.empresas) && j.empresas.length) {
          if (!camp) throw new Error('não diz para qual prospecção são as empresas');
          const novas = [];
          for (const e0 of j.empresas) {
            const tel = String(e0.tel || e0.whatsapp || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
            if (!tel) continue;
            const id = camp.id + '_' + tel;
            const atual = S.emps.find((x) => x.id === id);
            if (atual && !j.substituir) { nIgual++; continue; }
            novas.push({ status: 'a_enviar', hist: [{ d: agora(), t: 'Importada para a prospecção.' }], ...e0, tel, id, campanhaId: camp.id });
          }
          distribuir(camp, novas);
          let i = 0;
          for (const e of novas) { await salvarEmp(e); i++; if (i % 10 === 0 && $('pa-imp')) $('pa-imp').textContent = `Importando ${i} de ${novas.length} empresas…`; }
          nEmp += novas.length;
          await carregarEmps();
        }
      } catch (e) { erros.push(f.name + ' (' + e.message + ')'); }
    }
    toast(`${nCamp ? nCamp + ' prospecção(ões) e ' : ''}${nEmp} empresa(s) importada(s)` + (nIgual ? `, ${nIgual} já estavam na lista` : '') + (erros.length ? `. Erros: ${erros.join(', ')}` : ''));
    if (S.camp) P.campanha(S.camp.id, S.pessoa); else inicio();
  };

  // ── tela da campanha ──────────────────────────────────────────────────
  P.campanha = async (id, pessoa) => {
    const c = S.camps.find((x) => x.id === id); if (!c) return P.abrir();
    if (!S.emps.length) await carregarEmps();
    S.camp = c; S.per = null; S.filtro = ''; S.busca = '';
    const eu = meuNome();
    const pessoas = [...new Set(empsDa(c.id).map((e) => e.responsavel).filter(Boolean))];
    S.pessoa = pessoa === '__todos' ? null : (pessoa || pessoas.find((p) => mesmaPessoa(p, eu)) || null);
    S.aba = 'fila';
    tela();
  };
  P.pessoa = (v) => { S.pessoa = v || null; S.per = null; tela(); };
  P.aba = (v) => { S.aba = v; tela(); };
  P.periodo = (v) => { S.per = v; tela(); };
  P.filtrar = (v) => { S.filtro = S.filtro === v ? '' : v; tela(); };
  P.buscar = (v) => { S.busca = v; tela(); const b = $('pa-busca'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } };

  function tela() {
    const c = S.camp; const todas = empsDa(c.id);
    const base = todas.filter((e) => !S.pessoa || mesmaPessoa(e.responsavel, S.pessoa));
    const pessoas = [...new Set(todas.map((e) => e.responsavel).filter(Boolean))];
    const ses = sessaoAtiva(c.id, S.pessoa);
    const minhaEquipe = (c.equipe || []).find((p) => mesmaPessoa(p.nome, S.pessoa));
    const topo = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="ProspAtiva.abrir()"><i class="bi bi-arrow-left"></i> Prospecções</button>
          <div><div style="font-weight:700;font-size:17px">${esc(c.nome)}</div><div style="color:var(--text-muted);font-size:12px">${esc(TIPOS[c.tipo] || '')}${c.preco ? ' · ' + esc(c.preco) : ''} · ${base.length} empresas</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <label style="font-size:12px;color:var(--text-muted)">Lista de</label>
          <select onchange="ProspAtiva.pessoa(this.value)" style="${sel}"><option value="">Todos</option>${pessoas.map((p) => `<option value="${esc(p)}"${S.pessoa === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
          <label class="btn btn-ghost" style="cursor:pointer"><i class="bi bi-upload"></i> Importar empresas<input type="file" accept=".json,application/json" multiple style="display:none" onchange="ProspAtiva.importar(this.files);this.value=''"></label>
          <button class="btn btn-ghost" onclick="ProspAtiva.editar('${esc(c.id)}')"><i class="bi bi-gear"></i></button>
        </div>
      </div>
      ${c.descricao ? `<div style="font-size:12.5px;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:12px"><b>Informação base:</b> ${esc(c.descricao)}</div>` : ''}
      ${S.pessoa && minhaEquipe ? `<div style="font-size:12.5px;margin-bottom:12px"><i class="bi bi-whatsapp" style="color:var(--green)"></i> ${esc(S.pessoa)} envia pelo WhatsApp <b>${esc(minhaEquipe.whatsapp || '—')}</b>. Deixe esse WhatsApp aberto no WhatsApp Web, numa aba só.</div>` : ''}
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px">
        ${[['fila', 'Lista do período'], ['respostas', 'Respostas e pedidos'], ['todas', 'Todas as empresas'], ['sessoes', 'Quem prospectou']].map(([k, l]) => `<button onclick="ProspAtiva.aba('${k}')" style="background:none;border:0;border-bottom:2px solid ${S.aba === k ? 'var(--accent)' : 'transparent'};color:${S.aba === k ? 'var(--text-primary)' : 'var(--text-muted)'};font-family:var(--font);font-weight:600;font-size:13px;padding:8px 12px;cursor:pointer">${l}</button>`).join('')}
      </div>`;
    let corpo = '';
    if (S.aba === 'fila') corpo = telaFila(c, base, ses);
    else if (S.aba === 'respostas') corpo = lista(base.filter((e) => ['respondeu', 'quer_previa', 'previa_enviada', 'fechou'].includes(e.status)).sort((a, b) => String(b.atualizado || '').localeCompare(String(a.atualizado || ''))), 'Nenhuma resposta registrada ainda.');
    else if (S.aba === 'todas') corpo = telaTodas(base);
    else corpo = telaSessoes(c);
    $('main-content').innerHTML = `<div class="page-wrap" style="max-width:1080px">${topo}${corpo}</div>`;
  }

  function telaFila(c, base, ses) {
    const pers = [...new Set(base.map(perKey).filter(Boolean))].sort(perOrdem);
    if (!S.per || !pers.includes(S.per)) S.per = pers.find((k) => base.some((e) => perKey(e) === k && (e.status || 'a_enviar') === 'a_enviar')) || pers[pers.length - 1] || null;
    const fila = base.filter((e) => perKey(e) === S.per).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.responsavel).localeCompare(String(b.responsavel)));
    const feitos = fila.filter((e) => (e.status || 'a_enviar') !== 'a_enviar').length;
    const seletor = `<select onchange="ProspAtiva.periodo(this.value)" style="${sel}">${pers.map((k) => { const n = base.filter((e) => perKey(e) === k); const p = n.filter((e) => (e.status || 'a_enviar') === 'a_enviar').length; return `<option value="${esc(k)}"${k === S.per ? ' selected' : ''}>${esc(perNome(k))} · ${p ? p + ' a enviar' : 'concluído'}</option>`; }).join('')}</select>`;
    const sesBox = !S.pessoa
      ? `<div style="font-size:12.5px;color:var(--text-muted)">Escolha a pessoa em <b>Lista de</b> para iniciar o período dela.</div>`
      : ses
        ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(45,206,137,.08);border:1px solid var(--green);border-radius:10px;padding:10px 12px">
            <span style="color:var(--green);font-weight:700"><i class="bi bi-broadcast"></i> Prospecção em andamento</span>
            <span style="font-size:12.5px"><b>${esc(ses.responsavel)}</b> · WhatsApp ${esc(ses.whatsapp)} · desde ${fmtHora(ses.inicio)} · ${ses.enviadas || 0} enviadas</span>
            <button class="btn btn-ghost" style="margin-left:auto;font-size:12px" onclick="ProspAtiva.finalizar('${esc(ses.id)}')"><i class="bi bi-stop-fill"></i> Finalizar período</button></div>`
        : `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg-card);border:1px dashed var(--accent);border-radius:10px;padding:10px 12px">
            <span style="font-size:12.5px">Antes de enviar, registre quem está prospectando esta lista.</span>
            <button class="btn btn-primary" style="margin-left:auto" onclick="ProspAtiva.iniciar()"><i class="bi bi-play-fill"></i> Iniciar prospecção do período</button></div>`;
    return `<div style="display:grid;gap:12px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:12px;color:var(--text-muted)">Período</span>${seletor}
        <span style="font-size:12px;color:var(--text-muted);margin-left:auto">${feitos} de ${fila.length} enviadas · espere 1 a 2 minutos entre uma e outra</span></div>
      <div style="height:8px;border-radius:99px;background:var(--bg-base);overflow:hidden"><i style="display:block;height:100%;width:${fila.length ? Math.round(feitos / fila.length * 100) : 0}%;background:var(--accent-grad)"></i></div>
      ${sesBox}
      ${lista(fila, 'Nenhuma empresa neste período.', true)}
    </div>`;
  }

  function telaTodas(base) {
    const cont = Object.fromEntries(ETAPAS.map(([k]) => [k, 0])); base.forEach((e) => cont[e.status || 'a_enviar']++);
    const q = S.busca.toLowerCase();
    const vis = base.filter((e) => (!S.filtro || (e.status || 'a_enviar') === S.filtro) && (!q || [e.nome, e.tel, e.end, e.nicho].join(' ').toLowerCase().includes(q)));
    return `<div style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px">${ETAPAS.map(([k, l, col]) => `<button onclick="ProspAtiva.filtrar('${k}')" style="text-align:left;background:${S.filtro === k ? 'var(--bg-elevated,var(--bg-card))' : 'var(--bg-card)'};border:1px solid ${S.filtro === k ? col : 'var(--border)'};border-radius:10px;padding:9px 11px;cursor:pointer;color:var(--text-primary);font-family:var(--font)"><div style="font-size:19px;font-weight:700;color:${col}">${cont[k]}</div><div style="font-size:11px;color:var(--text-muted)">${l}</div></button>`).join('')}</div>
      <input id="pa-busca" placeholder="Buscar por nome, telefone, rua ou nicho" value="${esc(S.busca)}" oninput="ProspAtiva.buscar(this.value)" style="${sel}">
      ${lista(vis.slice(0, 400), 'Nenhuma empresa nesta etapa.')}
    </div>`;
  }

  function telaSessoes(c) {
    const ss = S.sess.filter((s) => s.campanhaId === c.id && (!S.pessoa || mesmaPessoa(s.responsavel, S.pessoa)));
    if (!ss.length) return '<div class="card" style="padding:28px;text-align:center;border:1px dashed var(--border-bright);border-radius:var(--radius-lg);color:var(--text-secondary)">Ninguém iniciou um período nesta prospecção ainda.</div>';
    return `<div style="overflow-x:auto"><table class="prosp-table"><thead><tr><th>Dia</th><th>Período</th><th>Quem prospectou</th><th>WhatsApp</th><th>Início</th><th>Fim</th><th>Enviadas</th><th>Login</th></tr></thead><tbody>
      ${ss.map((s) => `<tr><td>${esc(new Date(s.dia + 'T12:00:00').toLocaleDateString('pt-BR'))}</td><td>${esc(s.periodo)}</td><td><b>${esc(s.responsavel)}</b></td><td>${esc(s.whatsapp)}</td><td>${fmtHora(s.inicio)}</td><td>${s.fim ? fmtHora(s.fim) : '<span style="color:var(--green)">em andamento</span>'}</td><td>${s.enviadas || 0}</td><td style="font-size:11px;color:var(--text-muted)">${esc(s.login || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function lista(itens, vazio, numerar) {
    if (!itens.length) return `<div class="card" style="padding:28px;text-align:center;border:1px dashed var(--border-bright);border-radius:var(--radius-lg);color:var(--text-secondary)">${vazio}</div>`;
    return `<div style="display:grid;gap:8px">${itens.map((e) => card(e, numerar)).join('')}</div>`;
  }

  function card(e, numerar) {
    const st = e.status || 'a_enviar', et = ET[st] || ET.a_enviar;
    const aberto = S.abertos.has(e.id);
    const apagado = numerar && st !== 'a_enviar';
    return `<div id="pa-e-${esc(e.id)}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;${apagado ? 'opacity:.6' : ''}">
      <div onclick="ProspAtiva.toggle('${esc(e.id)}')" style="display:grid;grid-template-columns:${numerar ? '30px ' : ''}1fr auto;gap:12px;align-items:center;padding:11px 14px;cursor:pointer">
        ${numerar ? `<span style="font-weight:700;color:var(--text-muted);text-align:right">${esc(e.ordem || '')}</span>` : ''}
        <div style="min-width:0"><div style="font-weight:600;overflow-wrap:anywhere">${esc(e.nome)}</div>
          <div style="color:var(--text-muted);font-size:12px;display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:2px"><span style="color:var(--accent)">${esc(e.nicho || '')}</span><span>${esc(fmtTel(e.tel))}</span>${e.nota ? `<span>★ ${esc(e.nota)} (${esc(e.aval)})</span>` : ''}${e.insta ? '<span>só Instagram</span>' : ''}${!S.pessoa && e.responsavel ? `<span><i class="bi bi-person"></i> ${esc(e.responsavel)}</span>` : ''}${e.enviadoPor ? `<span>enviada por ${esc(e.enviadoPor)}</span>` : ''}</div></div>
        <span style="font-size:11.5px;font-weight:700;color:${et.c};border:1px solid ${et.c};border-radius:20px;padding:2px 10px;white-space:nowrap">${et.l}</span>
      </div>
      ${aberto ? detalhe(e) : ''}
    </div>`;
  }

  function detalhe(e) {
    const c = S.camp, st = e.status || 'a_enviar', f = e.ficha || {};
    const t1 = texto1(c, e);
    const btn = (acao, txt, cor, extra) => `<button class="btn btn-ghost" style="font-size:12.5px;${cor ? `border-color:${cor};color:${cor}` : ''}" onclick="ProspAtiva.${acao}('${esc(e.id)}'${extra ? ',' + extra : ''})">${txt}</button>`;
    const ficha = ['quer_previa', 'previa_enviada', 'fechou'].includes(st) ? `<div style="border:1px solid var(--yellow);border-radius:10px;padding:12px;display:grid;gap:10px">
        <div style="font-weight:700;color:var(--yellow)"><i class="bi bi-clipboard-check"></i> Ficha para a Amanda montar</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${CAMPOS.map(([k, n, full]) => `<label style="display:grid;gap:4px;font-size:12px;color:var(--text-muted);${full ? 'grid-column:1/-1' : ''}">${n}${full ? `<textarea id="pf-${k}-${esc(e.id)}" rows="3" style="${sel};resize:vertical">${esc(f[k] || '')}</textarea>` : `<input id="pf-${k}-${esc(e.id)}" value="${esc(f[k] || '')}" style="${sel}">`}</label>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('salvarFicha', '<i class="bi bi-check-lg"></i> Salvar ficha', 'var(--yellow)')}${btn('copiarFicha', '<i class="bi bi-clipboard"></i> Copiar ficha para enviar à Amanda')}
          <input id="pf-previa-${esc(e.id)}" value="${esc(e.previa || '')}" placeholder="Link da prévia (quando estiver pronta)" style="${sel};flex:1;min-width:200px">${btn('salvarPrevia', 'Salvar link')}</div>
      </div>` : '';
    const hist = (e.hist || []).slice().reverse().map((h) => `<div style="display:grid;grid-template-columns:92px 1fr;gap:10px;font-size:12.5px"><span style="color:var(--text-muted)">${esc(fmtData(h.d))}</span><span style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(h.t)}${h.por ? ` <span style="color:var(--text-muted)">· ${esc(h.por)}</span>` : ''}</span></div>`).join('');
    return `<div style="border-top:1px solid var(--border);padding:12px 14px;display:grid;gap:12px">
      ${st === 'a_enviar' ? `<div><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:5px">Texto 1 · abordagem</div><div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:12.5px;white-space:pre-wrap;max-height:130px;overflow:auto;color:var(--text-secondary)">${esc(t1)}</div></div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${st === 'a_enviar'
          ? `<a class="btn btn-ghost" style="font-size:12.5px;border-color:var(--green);color:var(--green);text-decoration:none;font-weight:700" href="${esc(waLink(e.tel, t1))}" target="whatsapp" rel="noopener"><i class="bi bi-whatsapp"></i> 1 · Abrir no WhatsApp com o texto</a>${btn('marcar', '2 · Enviei ✓', 'var(--blue)', "'enviada'")}${btn('marcar', 'Sem WhatsApp', 'var(--red)', "'sem_whatsapp'")}`
          : `<a class="btn btn-ghost" style="font-size:12.5px;border-color:var(--green);color:var(--green);text-decoration:none" href="${esc(waLink(e.tel))}" target="whatsapp" rel="noopener"><i class="bi bi-whatsapp"></i> Abrir conversa</a>`}
        ${['enviada', 'respondeu'].includes(st) ? `${btn('marcar', 'Disse SIM', 'var(--yellow)', "'quer_previa'")}${btn('marcar', 'Respondeu', 'var(--purple)', "'respondeu'")}${btn('marcar', 'Sem interesse', 'var(--red)', "'sem_interesse'")}` : ''}
        ${st === 'quer_previa' ? btn('copiarTexto', 'Copiar Texto 2', '', "'t2'") : ''}
        ${st === 'previa_enviada' ? btn('marcar', 'Fechou 🎉', 'var(--green)', "'fechou'") : ''}
        ${btn('copiarTexto', 'Copiar Texto 1', '', "'t1'")}
        ${(c.extras || []).map((x, i) => btn('copiarTexto', esc(x.titulo || 'Resposta ' + (i + 1)), '', `'x${i}'`)).join('')}
        <a class="btn btn-ghost" style="font-size:12.5px;text-decoration:none" href="https://www.google.com/maps/search/${encodeURIComponent((e.nome || '') + ' ' + (e.cidade || ''))}" target="_blank" rel="noopener"><i class="bi bi-geo-alt"></i> Ver no Google</a>
        ${e.previa ? `<a class="btn btn-ghost" style="font-size:12.5px;text-decoration:none" href="${esc(e.previa)}" target="_blank" rel="noopener"><i class="bi bi-window"></i> Ver prévia</a>` : ''}
        <select onchange="ProspAtiva.marcar('${esc(e.id)}',this.value)" style="${sel};font-size:12px;padding:6px 8px;margin-left:auto">${ETAPAS.map(([k, l]) => `<option value="${k}"${k === st ? ' selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      ${ficha}
      ${e.end ? `<div style="font-size:12px;color:var(--text-muted)"><i class="bi bi-geo"></i> ${esc(e.end)} · ${esc(e.cidade || '')}${e.cat ? ' · ' + esc(e.cat) : ''}</div>` : ''}
      <div style="display:grid;gap:6px"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">Histórico</div>${hist || '<span style="font-size:12.5px;color:var(--text-muted)">Nenhum contato ainda.</span>'}</div>
      <div style="display:flex;gap:8px"><input id="pn-${esc(e.id)}" placeholder="Anotar o que aconteceu (ex.: secretária vai repassar para a dentista)" style="${sel};flex:1" onkeydown="if(event.key==='Enter')ProspAtiva.anotar('${esc(e.id)}')">${btn('anotar', 'Anotar', 'var(--accent)')}</div>
    </div>`;
  }

  // ── ações ─────────────────────────────────────────────────────────────
  P.toggle = (id) => { if (S.abertos.has(id)) S.abertos.delete(id); else S.abertos.add(id); redesenhar(id); };
  function redesenhar(id) {
    const e = S.emps.find((x) => x.id === id); const el = $('pa-e-' + id);
    if (e && el) el.outerHTML = card(e, S.aba === 'fila'); else tela();
  }
  function quem() { const s = sessaoAtiva(S.camp.id, S.pessoa); return (s && s.responsavel) || meuNome() || 'Equipe'; }
  async function registrar(e, patch, nota) {
    Object.assign(e, patch, { atualizado: agora() });
    if (nota) e.hist = [...(e.hist || []), { d: agora(), t: nota, por: quem() }];
    try { await salvarEmp(e); return true; } catch (x) { toast('Não salvou: ' + x.message); return false; }
  }

  P.iniciar = async () => {
    const c = S.camp; const p = (c.equipe || []).find((x) => mesmaPessoa(x.nome, S.pessoa)) || { nome: S.pessoa, whatsapp: '' };
    const ses = { campanhaId: c.id, responsavel: p.nome, whatsapp: p.whatsapp || '', dia: hojeISO(), periodo: new Date().getHours() < 13 ? 'Manhã' : 'Tarde', listaPeriodo: S.per, inicio: agora(), fim: null, enviadas: 0, login: [meuNome(), (window.currentUser || {}).email].filter(Boolean).join(' · ') };
    const id = slug(`${c.id}-${p.nome}-${ses.dia}-${Date.now()}`);
    await window.dbSet(C_SES, id, ses);
    S.sess.unshift({ id, ...ses });
    toast(`Prospecção iniciada por ${p.nome}`);
    tela();
  };
  P.finalizar = async (id) => {
    const s = S.sess.find((x) => x.id === id); if (!s) return;
    s.fim = agora(); await window.dbSet(C_SES, id, s);
    toast('Período finalizado'); tela();
  };

  const NOTAS = { enviada: 'Mensagem de abordagem enviada no WhatsApp.', quer_previa: 'Disse SIM: enviar o Texto 2, preencher a ficha e mandar para a Amanda.', respondeu: 'Respondeu (ver conversa).', sem_interesse: 'Disse que não tem interesse.', sem_whatsapp: 'Número sem WhatsApp.', previa_enviada: 'Prévia/proposta enviada.', fechou: 'Fechou! 🎉', a_enviar: 'Voltou para a lista de envio.' };
  P.marcar = async (id, st) => {
    const e = S.emps.find((x) => x.id === id); if (!e || e.status === st) return;
    const patch = { status: st };
    let ses = null;
    if (st === 'enviada' && !e.enviadoEm) {
      ses = sessaoAtiva(S.camp.id, S.pessoa || e.responsavel);
      Object.assign(patch, { enviadoPor: quem(), enviadoEm: agora(), sessaoId: ses ? ses.id : null });
    }
    if (!(await registrar(e, patch, NOTAS[st] || ('Etapa: ' + (ET[st] || {}).l)))) return;
    if (ses) { ses.enviadas = (ses.enviadas || 0) + 1; window.dbSet(C_SES, ses.id, ses); }
    if (st === 'quer_previa') notificarAdmins('<i class="bi bi-stars"></i> Pedido de prévia', `${e.nome} disse SIM (${quem()}). Ficha na Prospecção ativa.`);
    if (st === 'enviada' && S.aba === 'fila') S.abertos.delete(id);
    toast((ET[st] || {}).l || 'Salvo');
    tela();
  };
  P.anotar = async (id) => {
    const e = S.emps.find((x) => x.id === id); const inp = $('pn-' + id); const t = (inp && inp.value || '').trim(); if (!e || !t) return;
    if (await registrar(e, {}, t)) redesenhar(id);
  };
  P.salvarFicha = async (id) => {
    const e = S.emps.find((x) => x.id === id); if (!e) return;
    const ficha = Object.fromEntries(CAMPOS.map(([k]) => [k, (($('pf-' + k + '-' + id) || {}).value || '').trim()]));
    if (await registrar(e, { ficha }, 'Ficha da prévia preenchida.')) { toast('Ficha salva'); redesenhar(id); }
  };
  P.salvarPrevia = async (id) => {
    const e = S.emps.find((x) => x.id === id); const v = (($('pf-previa-' + id) || {}).value || '').trim(); if (!e) return;
    if (await registrar(e, { previa: v }, v ? 'Link da prévia: ' + v : '')) { toast('Link salvo'); redesenhar(id); }
  };
  P.copiarFicha = (id) => { const e = S.emps.find((x) => x.id === id); if (e) copiar(fichaTexto(e)); };
  P.copiarTexto = (id, qual) => {
    const e = S.emps.find((x) => x.id === id); const c = S.camp; if (!e) return;
    if (qual === 't1') return copiar(texto1(c, e));
    if (qual === 't2') return copiar(c.texto2 || '');
    const x = (c.extras || [])[parseInt(String(qual).slice(1), 10)]; if (x) copiar(x.texto || '');
  };
})();
