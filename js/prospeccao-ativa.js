/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Prospecção ativa (campanhas de abordagem pelo WhatsApp)
   Página: prospeccao (aba "Prospecção ativa"; a aba "Leads (CRM)" é o renderProspeccao antigo).
   Coleções (todas com login, regra padrão isAuth):
     ghub_prosp_campanhas  id = slug · { nome, tipo, descricao, preco, texto1, textosNicho{}, texto2, extras[], equipe[],
                                        porPeriodo, ativa, jornada[], linkPagamento, linkAgenda, promptDemanda }
     ghub_prosp_empresas   id = campanhaId + '_' + tel · { campanhaId, nome, curto, tel, nicho, cat, end, cidade, nota, aval, insta,
                                                          responsavel, whatsapp, dia, periodo, ordem, status, hist[], ficha{}, previa,
                                                          enviadoPor, enviadoEm, sessaoId, reuniao, atualizado }
     ghub_prosp_sessoes    id = auto · { campanhaId, responsavel, whatsapp, dia, periodo, inicio, fim, enviadas, login }
   Caminho do lead (jornada): cada etapa tem quem faz (equipe | amanda), o texto a enviar e para onde o lead vai.
   Etapas da Amanda aparecem em "Demandas da Prospecção" (e no Dashboard); as da equipe em "Próximos passos".
   Importação: .json gerado pelo Claude ({ campanha?: {...}, empresas?: [...] }).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const C_CAMP = 'ghub_prosp_campanhas', C_EMP = 'ghub_prosp_empresas', C_SES = 'ghub_prosp_sessoes';
  const TIPOS = { site: 'Site', google: 'Perfil no Google', outro: 'Outro' };
  const CAMPOS = [['responsavel', 'Nome de quem respondeu'], ['google', 'Link do perfil no Google'], ['instagram', 'Link do Instagram'],
    ['facebook', 'Link do Facebook'], ['outras', 'Outras redes ou links'], ['resumo', 'Resumo da empresa (IA do Google)', 1], ['obs', 'Observações da conversa', 1]];
  const PERIODOS = ['Manhã', 'Tarde'];
  const CORES = ['var(--text-muted)', 'var(--blue)', 'var(--yellow)', 'var(--accent)', 'var(--orange)', 'var(--purple)', 'var(--blue)', 'var(--orange)', 'var(--yellow)', 'var(--green)'];

  // ── caminho padrão do lead (usado quando a campanha ainda não tem jornada própria) ──
  const T_PREVIA = 'Oi{CONTATO_VIRG}! Tudo bem? 😊\n\nFicou pronta a prévia do site da {NOME}:\n{PREVIA}\n\nMontei com as informações, as fotos e os serviços de vocês. Dá uma olhada com calma e me conta:\n\n1. O que achou do visual?\n2. Tem algum serviço ou informação que vocês gostariam de destacar mais?\n3. Vocês já têm um domínio (um endereço tipo www.suaempresa.com.br)?\n\nSe gostar, o próximo passo é simples: uma conversa rápida de 15 minutos para eu explicar o que preciso de vocês para colocar o site no ar.';
  const T_REUNIAO = 'Que bom que você gostou! 🙌\n\nO próximo passo é uma conversa rápida de 15 minutos (chamada de vídeo ou ligação) para eu explicar o que vou precisar de vocês, como funciona o domínio e fechar os detalhes.\n\nQual o melhor dia e horário para você?{AGENDA_LINHA}';
  const T_PAGAMENTO = 'Perfeito{CONTATO_VIRG}! Como combinamos, segue o link para o pagamento do site:\n{PAGAMENTO}\n\nO valor é {PRECO}. Assim que o pagamento for confirmado, eu começo a finalizar o site de vocês e te aviso cada etapa por aqui. 😊';
  const JORNADA_PADRAO = [
    { key: 'a_enviar', nome: 'A enviar', quem: 'equipe', texto: '{TEXTO1}', dica: 'Abordagem: abrir o WhatsApp com o Texto 1, enviar e marcar como enviada.', saidas: [['enviada', 'Enviei ✓'], ['sem_whatsapp', 'Sem WhatsApp']] },
    { key: 'enviada', nome: 'Abordagem enviada', quem: 'equipe', dica: 'Aguardando resposta. Respondeu que quer ver? Clique em Disse SIM.', saidas: [['quer_previa', 'Disse SIM'], ['respondeu', 'Respondeu'], ['sem_interesse', 'Sem interesse']] },
    { key: 'quer_previa', nome: 'Disse SIM · montar prévia', quem: 'amanda', texto: '{TEXTO2}', dica: 'Equipe: envie o Texto 2 e preencha a ficha. Amanda: copie a ficha com o prompt, monte a prévia e cole o link.', saidas: [['previa_pronta', 'Prévia pronta']] },
    { key: 'previa_pronta', nome: 'Prévia pronta · enviar ao cliente', quem: 'equipe', texto: T_PREVIA, dica: 'Envie o link da prévia com as perguntas.', saidas: [['previa_enviada', 'Enviei a prévia ✓']] },
    { key: 'previa_enviada', nome: 'Prévia enviada · aguardando', quem: 'equipe', dica: 'Aguardando o que o cliente achou da prévia.', saidas: [['gostou', 'Gostou, quer seguir'], ['respondeu', 'Pediu ajustes / dúvidas'], ['sem_interesse', 'Não quis']] },
    { key: 'gostou', nome: 'Gostou · marcar reunião de 15 min', quem: 'equipe', texto: T_REUNIAO, dica: 'Combine dia e horário da reunião e registre abaixo.', saidas: [['reuniao', 'Reunião marcada ✓']] },
    { key: 'reuniao', nome: 'Reunião de 15 min', quem: 'amanda', dica: 'Reunião: o que o cliente precisa enviar, domínio e fechamento de valores.', saidas: [['pagamento', 'Reunião feita · enviar pagamento'], ['sem_interesse', 'Não fechou']] },
    { key: 'pagamento', nome: 'Enviar link de pagamento', quem: 'equipe', texto: T_PAGAMENTO, dica: 'Envie o link de pagamento combinado na reunião.', saidas: [['aguardando_pagamento', 'Enviei o link ✓']] },
    { key: 'aguardando_pagamento', nome: 'Aguardando pagamento', quem: 'equipe', dica: 'Confirme o pagamento antes de marcar como fechado.', saidas: [['fechou', 'Pagou · fechou 🎉']] },
    { key: 'fechou', nome: 'Fechou', quem: '', dica: 'Cliente fechado. Agora é produção do site.', saidas: [] },
  ];
  const EXTRAS = { respondeu: { nome: 'Respondeu · ver conversa', quem: 'equipe', cor: 'var(--purple)', dica: 'Leia a conversa e escolha o próximo passo.', saidas: [['quer_previa', 'Disse SIM'], ['gostou', 'Gostou da prévia'], ['sem_interesse', 'Sem interesse']] }, sem_interesse: { nome: 'Sem interesse', quem: '', cor: 'var(--red)', saidas: [['a_enviar', 'Voltar para a lista']] }, sem_whatsapp: { nome: 'Sem WhatsApp', quem: '', cor: 'var(--red)', saidas: [['a_enviar', 'Voltar para a lista']] } };
  const PROMPT_SITE = 'Monte a prévia do site desta empresa para a prospecção "{CAMPANHA}" da Conexa Local.\n\n1. Pesquise a empresa no perfil do Google e nas redes (links da ficha abaixo). Use só informações reais: nome, logo, paleta de cores, fontes, fotos, serviços, horários, endereço e avaliações.\n2. Monte um site de uma página no visual da marca da empresa: topo com chamada e botão de WhatsApp, serviços, sobre/equipe, fotos da estrutura, depoimentos reais do Google, localização com mapa e contato. Coloque no topo a faixa "Prévia exclusiva preparada para {NOME}" e marque a página como noindex.\n3. Salve em Documents\\CONEXA LOCAL\\Prospecção\\<nicho e cidade>\\previas\\<empresa> e publique no Netlify da conta digitalcreateagency com o nome <empresa>-previa.\n4. Me devolva o link publicado para eu colar no Hub.\n\n{FICHA}';
  const PROMPT_GOOGLE = 'Faça a análise do perfil no Google desta empresa para a prospecção "{CAMPANHA}" da Conexa Local, no formato da Central de Diagnósticos (com prints marcados de cada ponto), e me devolva o link ou o PDF para eu colar no Hub.\n\n{FICHA}';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  // aviso rápido que some sozinho (alert() trava a página até alguém clicar em OK)
  const toast = (m) => {
    let el = document.getElementById('pa-toast');
    if (!el) { el = document.createElement('div'); el.id = 'pa-toast'; el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;background:var(--bg-card);color:var(--text-primary);border:1px solid var(--accent);border-radius:10px;padding:10px 16px;font-size:13px;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,.4)'; document.body.appendChild(el); }
    el.textContent = m; el.style.display = 'block';
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.style.display = 'none'; }, /erro|não|nao/i.test(m) ? 9000 : 3000);
  };
  const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const agora = () => new Date().toISOString();
  const fmtTel = (t) => (t && t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t || '');
  const fmtData = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const perKey = (e) => (e.dia ? e.dia + '|' + e.periodo : '');
  const perNome = (k) => { if (!k) return 'Sem período'; const [d, p] = k.split('|'); const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + p; };
  const perOrdem = (a, b) => a.split('|')[0].localeCompare(b.split('|')[0]) || (a.endsWith('Manhã') ? -1 : 1);
  const meuNome = () => String((window.currentUser || {}).name || '').trim();
  const souAdmin = () => window.currentRole === 'admin';
  const mesmaPessoa = (a, b) => { const x = String(a || '').toLowerCase().trim(), y = String(b || '').toLowerCase().trim(); return !!x && !!y && (x === y || x.split(' ')[0] === y.split(' ')[0]); };
  const sel = 'background:var(--bg-base);border:1px solid var(--border-bright);border-radius:8px;color:var(--text-primary);padding:8px 10px;font-size:13px;font-family:var(--font)';
  const caixa = 'background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg)';

  const S = { camps: [], emps: [], sess: [], camp: null, aba: 'fila', pessoa: null, per: null, filtro: '', busca: '', abertos: new Set(), editando: null, carregado: 0 };
  const P = {};
  window.ProspAtiva = P;

  // ── jornada ────────────────────────────────────────────────────────────
  const jornada = (c) => {
    if (c && Array.isArray(c.jornada) && c.jornada.length) return c.jornada;
    return JORNADA_PADRAO.map((j) => (c && c.tipo === 'google' && j.key === 'quer_previa' ? { ...j, nome: 'Disse SIM · montar análise' } : j));
  };
  function etapa(c, key) {
    const js = jornada(c); const i = js.findIndex((j) => j.key === key);
    if (i >= 0) return { ...js[i], idx: i, cor: js[i].key === 'fechou' ? 'var(--green)' : CORES[i % CORES.length] };
    const x = EXTRAS[key]; if (x) return { key, idx: 99, ...x };
    return { key, nome: key, quem: '', cor: 'var(--text-muted)', saidas: [], idx: 98 };
  }
  const campDe = (e) => S.camps.find((c) => c.id === e.campanhaId) || {};
  const ehDemanda = (e) => etapa(campDe(e), e.status || 'a_enviar').quem === 'amanda';
  const ehPassoEquipe = (e) => { const st = e.status || 'a_enviar'; const et = etapa(campDe(e), st); return et.quem === 'equipe' && !['a_enviar', 'enviada', 'previa_enviada', 'aguardando_pagamento'].includes(st); };

  // ── dados ──────────────────────────────────────────────────────────────
  async function carregarCamps() { S.camps = (await window.dbList(C_CAMP)).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); }
  async function carregarEmps() { S.emps = await window.dbList(C_EMP); }
  async function carregarSess() { S.sess = (await window.dbList(C_SES)).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))); }
  async function carregarTudo() { await Promise.all([carregarCamps(), carregarEmps(), carregarSess()]); S.carregado = Date.now(); }
  const salvarEmp = (e) => window.dbSet(C_EMP, e.id, e);
  const empsDa = (cid) => S.emps.filter((e) => e.campanhaId === cid);

  function nomeMsg(e) { return String(e.curto || e.nome || '').replace(/^(o |a )?(consultório|clínica) d[ao]s? /i, '').trim(); }
  function preencher(c, e, t) {
    const contato = ((e.ficha || {}).responsavel || '').split(/[\s,(]/)[0];
    return String(t || '')
      .replace(/\{TEXTO1\}/g, (c.textosNicho && c.textosNicho[e.nicho]) || c.texto1 || '')
      .replace(/\{TEXTO2\}/g, c.texto2 || '')
      .replace(/\{AGENDA_LINHA\}/g, c.linkAgenda ? `\n\nSe preferir, já pode escolher um horário aqui: ${c.linkAgenda}` : '')
      .replace(/\{CONTATO_VIRG\}/g, contato ? ', ' + contato : '')
      .replace(/\{CONTATO\}/g, contato)
      .replace(/\{NOME\}/g, nomeMsg(e))
      .replace(/\{NICHO\}/g, e.nicho || '')
      .replace(/\{CIDADE\}/g, (e.cidade || '').split('/')[0])
      .replace(/\{PREVIA\}/g, e.previa || '[link da prévia]')
      .replace(/\{PAGAMENTO\}/g, c.linkPagamento || '[link de pagamento]')
      .replace(/\{AGENDA\}/g, c.linkAgenda || '')
      .replace(/\{PRECO\}/g, c.preco || '');
  }
  const texto1 = (c, e) => preencher(c, e, '{TEXTO1}');
  const waLink = (tel, txt) => `https://web.whatsapp.com/send?phone=55${tel}${txt ? '&text=' + encodeURIComponent(txt) : ''}`;
  const mapsLink = (e) => (e.ficha && e.ficha.google) || `https://www.google.com/maps/search/${encodeURIComponent((e.nome || '') + ' ' + (e.cidade || ''))}`;
  async function copiar(t) {
    try { await navigator.clipboard.writeText(t); toast('Copiado'); }
    catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (x) { toast('Selecione e copie com Ctrl+C'); } a.remove(); }
  }
  function fichaTexto(e) {
    const f = e.ficha || {}, c = campDe(e);
    const linhas = [
      'FICHA DA EMPRESA',
      `Empresa: ${e.nome}`, `Nicho: ${e.nicho || ''}${e.cat ? ' (' + e.cat + ')' : ''}`, `WhatsApp: ${fmtTel(e.tel)}`,
      `Endereço: ${[e.end, e.cidade].filter(Boolean).join(' · ')}`,
      `Google: nota ${e.nota || '-'} com ${e.aval || '0'} avaliações · ${mapsLink(e)}`,
      e.insta ? 'No Google, o lugar do site aponta para o Instagram.' : '',
      `Prospecção: ${c.nome || ''} · prospectado por ${e.enviadoPor || e.responsavel || ''}`,
      ...CAMPOS.map(([k, n]) => `${n}: ${f[k] || '-'}`),
    ].filter(Boolean);
    return linhas.join('\n');
  }
  const promptDemanda = (e) => { const c = campDe(e); return preencher(c, e, c.promptDemanda || (c.tipo === 'google' ? PROMPT_GOOGLE : PROMPT_SITE)).replace(/\{CAMPANHA\}/g, c.nome || '').replace(/\{FICHA\}/g, fichaTexto(e)); };
  function sessaoAtiva(cid, pessoa) { return S.sess.find((s) => s.campanhaId === cid && !s.fim && (!pessoa || mesmaPessoa(s.responsavel, pessoa)) && s.dia === hojeISO()); }
  function usuarios() { try { return JSON.parse(localStorage.getItem('dc_all_users') || '[]'); } catch (e) { return []; } }
  function notificar(filtro, titulo, corpo) {
    if (!window.sendFirebaseNotif) return;
    usuarios().filter((u) => u.uid && u.uid !== (window.currentUser || {}).uid && filtro(u)).forEach((u) => {
      window.sendFirebaseNotif(u.uid, { id: Date.now() + Math.random(), title: titulo, body: corpo, type: 'prospeccao', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), read: false });
    });
  }

  // ── abas da página Prospecção ─────────────────────────────────────────
  P.abas = (atual) => `<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:18px">
      ${[['ativa', 'Prospecção ativa', 'bi-send'], ['leads', 'Leads (CRM)', 'bi-person-lines-fill']].map(([k, l, i]) => `<button onclick="window._prspTab='${k}';renderProspeccao()" style="background:none;border:0;border-bottom:2px solid ${atual === k ? 'var(--accent)' : 'transparent'};color:${atual === k ? 'var(--text-primary)' : 'var(--text-muted)'};font-family:var(--font);font-weight:600;font-size:13px;padding:9px 14px;cursor:pointer"><i class="bi ${i}"></i> ${l}</button>`).join('')}
    </div>`;

  // ── widget do Dashboard ───────────────────────────────────────────────
  P.widget = async (id) => {
    const alvo = $(id); if (!alvo) return;
    if (Date.now() - S.carregado > 60000) { try { await carregarTudo(); } catch (e) { return; } }
    if (!$(id)) return;
    const demandas = souAdmin() ? S.emps.filter(ehDemanda) : [];
    const meus = S.emps.filter((e) => ehPassoEquipe(e) && mesmaPessoa(e.responsavel, meuNome()));
    if (!demandas.length && !meus.length) { $(id).innerHTML = ''; return; }
    const linha = (e) => { const et = etapa(campDe(e), e.status); return `<div onclick="ProspAtiva.irPara('${esc(e.id)}')" style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--border);border-radius:10px;cursor:pointer;background:var(--bg-card2,var(--bg-base))">
        <div style="min-width:0"><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.nome)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(e.nicho || '')} · ${esc(campDe(e).nome || '')} · ${esc(e.responsavel || '')}</div></div>
        <span style="font-size:10.5px;font-weight:700;color:${et.cor};border:1px solid ${et.cor};border-radius:20px;padding:1px 8px;white-space:nowrap">${esc(et.nome)}</span></div>`; };
    const bloco = (titulo, icone, cor, itens, dica) => `<div style="${caixa};padding:18px;border-color:${cor}">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px"><i class="bi ${icone}" style="color:${cor}"></i> ${titulo} <span style="background:${cor};color:#fff;border-radius:20px;padding:0 8px;font-size:11px">${itens.length}</span>
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;margin-left:auto" onclick="window._prspTab='ativa';showPage('prospeccao')">Abrir prospecção</button></div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:10px">${dica}</div>
        <div style="display:grid;gap:6px">${itens.slice(0, 6).map(linha).join('')}${itens.length > 6 ? `<div style="font-size:11px;color:var(--text-muted)">e mais ${itens.length - 6}…</div>` : ''}</div></div>`;
    $(id).innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px;margin-bottom:24px">
      ${demandas.length ? bloco('Demandas da Prospecção', 'bi-stars', 'var(--yellow)', demandas, 'Quem disse SIM e está esperando você: montar prévia ou fazer a reunião.') : ''}
      ${meus.length ? bloco('Seus próximos passos na prospecção', 'bi-whatsapp', 'var(--green)', meus, 'Empresas que voltaram para você enviar a próxima mensagem.') : ''}
    </div>`;
  };
  // abre a prospecção já na empresa (usado pelo Dashboard e pelos atalhos)
  P.irPara = (id) => {
    S.pendente = id; window._prspTab = 'ativa';
    const pag = typeof currentPage !== 'undefined' ? currentPage : ''; // let global do app.js
    if (typeof showPage === 'function' && pag !== 'prospeccao') showPage('prospeccao'); else P.abrir();
  };
  function abrirPendente() {
    const id = S.pendente; S.pendente = null;
    const e = S.emps.find((x) => x.id === id); if (!e) return false;
    S.camp = S.camps.find((c) => c.id === e.campanhaId); if (!S.camp) return false;
    const dem = ehDemanda(e);
    S.pessoa = dem ? null : e.responsavel; S.aba = dem ? 'demandas' : (ehPassoEquipe(e) || e.status === 'respondeu' ? 'passos' : 'todas'); S.abertos.add(id);
    if (S.aba === 'todas') { S.busca = e.nome || ''; S.filtro = ''; }
    tela(); window.scrollTo(0, 0);
    return true;
  }

  // ── tela inicial: campanhas ───────────────────────────────────────────
  P.abrir = async () => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Carregando prospecções…</div>';
    S.camp = null;
    await carregarTudo();
    if (S.pendente && abrirPendente()) return;
    inicio();
  };

  function inicio() {
    const eu = meuNome();
    const demandas = S.emps.filter(ehDemanda);
    const cards = S.camps.map((c) => {
      const es = empsDa(c.id);
      const n = (ks) => es.filter((e) => ks.includes(e.status || 'a_enviar')).length;
      const minhas = es.filter((e) => mesmaPessoa(e.responsavel, eu));
      const minhasPend = minhas.filter((e) => (e.status || 'a_enviar') === 'a_enviar').length;
      const meusPassos = minhas.filter(ehPassoEquipe).length;
      const dem = es.filter(ehDemanda).length;
      const equipe = (c.equipe || []).map((p) => `<span style="font-size:11.5px;border:1px solid var(--border-bright);border-radius:20px;padding:2px 9px">${esc(p.nome)} · <i class="bi bi-whatsapp" style="color:var(--green)"></i> ${esc(p.whatsapp || '')}</span>`).join(' ');
      const ativas = S.sess.filter((s) => s.campanhaId === c.id && !s.fim && s.dia === hojeISO());
      const js = jornada(c);
      const iSim = js.findIndex((j) => j.key === 'quer_previa');
      const depoisSim = js.slice(iSim >= 0 ? iSim : 2).map((j) => j.key).filter((k) => k !== 'fechou');
      return `<div class="card" style="padding:18px;${caixa};display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div><div style="font-weight:700;font-size:16px">${esc(c.nome)}</div>
          <div style="color:var(--text-muted);font-size:12px">${esc(TIPOS[c.tipo] || c.tipo || '')}${c.preco ? ' · ' + esc(c.preco) : ''}${c.ativa === false ? ' · pausada' : ''}</div></div>
          <button class="btn btn-ghost" style="font-size:12px;padding:5px 10px" onclick="ProspAtiva.editar('${esc(c.id)}')"><i class="bi bi-gear"></i> Configurar</button>
        </div>
        ${c.descricao ? `<div style="font-size:12.5px;color:var(--text-secondary)">${esc(c.descricao)}</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${[['A enviar', n(['a_enviar']), 'var(--text-muted)'], ['Abordadas', es.length - n(['a_enviar']), 'var(--blue)'], ['Em andamento', n(depoisSim.concat(['respondeu'])), 'var(--yellow)'], ['Fecharam', n(['fechou']), 'var(--green)']].map(([l, v, cor]) => `<div style="background:var(--bg-base);border:1px solid var(--border);border-radius:10px;padding:8px 10px"><div style="font-size:18px;font-weight:700;color:${cor}">${v}</div><div style="font-size:11px;color:var(--text-muted)">${l}</div></div>`).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${equipe || '<span style="font-size:12px;color:var(--text-muted)">Sem equipe definida</span>'}</div>
        ${ativas.length ? `<div style="font-size:12px;color:var(--green)"><i class="bi bi-broadcast"></i> Prospectando agora: ${ativas.map((s) => `<b>${esc(s.responsavel)}</b> (${esc(s.whatsapp)}, desde ${fmtHora(s.inicio)})`).join(', ')}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">
          <button class="btn btn-primary" onclick="ProspAtiva.campanha('${esc(c.id)}')"><i class="bi bi-play-fill"></i> ${minhas.length ? `Minha lista (${minhasPend} a enviar)` : 'Abrir'}</button>
          ${meusPassos ? `<button class="btn btn-ghost" style="border-color:var(--green);color:var(--green)" onclick="ProspAtiva.campanha('${esc(c.id)}',null,'passos')"><i class="bi bi-whatsapp"></i> Próximos passos (${meusPassos})</button>` : ''}
          ${dem && souAdmin() ? `<button class="btn btn-ghost" style="border-color:var(--yellow);color:var(--yellow)" onclick="ProspAtiva.campanha('${esc(c.id)}','__todos','demandas')"><i class="bi bi-stars"></i> Demandas (${dem})</button>` : ''}
          ${minhas.length ? `<button class="btn btn-ghost" onclick="ProspAtiva.campanha('${esc(c.id)}','__todos','andamento')">Andamento geral</button>` : ''}
        </div>
      </div>`;
    }).join('');
    const blocoDem = demandas.length && souAdmin() ? `<div style="${caixa};border-color:var(--yellow);padding:16px;margin-bottom:16px">
        <div style="font-weight:700;margin-bottom:8px;display:flex;gap:8px;align-items:center"><i class="bi bi-stars" style="color:var(--yellow)"></i> Demandas da Prospecção <span style="background:var(--yellow);color:#000;border-radius:20px;padding:0 8px;font-size:11px">${demandas.length}</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px">${demandas.map((e) => `<div onclick="ProspAtiva.irPara('${esc(e.id)}')" style="border:1px solid var(--border);border-radius:10px;padding:9px 11px;cursor:pointer;background:var(--bg-base)"><div style="font-weight:600;font-size:13px">${esc(e.nome)}</div><div style="font-size:11.5px;color:var(--text-muted)">${esc(etapa(campDe(e), e.status).nome)} · ${esc(campDe(e).nome || '')} · ${esc(e.responsavel || '')}</div></div>`).join('')}</div>
      </div>` : '';
    $('main-content').innerHTML = `<div class="page-wrap">
      ${P.abas('ativa')}
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <div><h2 style="margin:0;font-size:20px">Prospecção ativa</h2>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:4px">Cada prospecção tem os textos, a equipe, o caminho do lead até o fechamento e a lista de empresas da semana.</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn btn-ghost" style="cursor:pointer"><i class="bi bi-upload"></i> Importar empresas do Claude (.json)<input type="file" accept=".json,application/json" multiple style="display:none" onchange="ProspAtiva.importar(this.files);this.value=''"></label>
          <button class="btn btn-primary" onclick="ProspAtiva.editar(null)"><i class="bi bi-plus-lg"></i> Nova prospecção</button>
        </div>
      </div>
      ${blocoDem}
      ${cards ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px">${cards}</div>`
        : `<div class="card" style="padding:40px;text-align:center;border:1px dashed var(--border-bright);border-radius:var(--radius-lg);color:var(--text-secondary)">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Nenhuma prospecção ainda</div>
          Crie uma em <b>Nova prospecção</b> (textos, equipe e WhatsApp de cada pessoa) ou importe o arquivo .json que o Claude gera com a campanha e as empresas.</div>`}
    </div>`;
  }

  // ── criar / configurar campanha ───────────────────────────────────────
  P.editar = (id) => {
    const c = id ? JSON.parse(JSON.stringify(S.camps.find((x) => x.id === id) || {})) : { nome: '', tipo: 'site', preco: '', descricao: '', texto1: '', textosNicho: {}, texto2: '', extras: [], equipe: [{ nome: meuNome(), whatsapp: '', nichos: '' }], porPeriodo: 50, ativa: true };
    if (!Array.isArray(c.jornada) || !c.jornada.length) c.jornada = JSON.parse(JSON.stringify(jornada(c)));
    S.editando = c;
    const nichos = Object.entries(c.textosNicho || {});
    const linhaNicho = (n, t) => `<div class="pa-nicho" style="display:grid;gap:6px;border:1px solid var(--border);border-radius:10px;padding:10px">
        <div style="display:flex;gap:8px;align-items:center"><input class="pa-nicho-nome" value="${esc(n)}" placeholder="Nicho (ex.: Estética)" style="${sel};flex:1"><button class="btn btn-ghost" style="padding:4px 9px" onclick="this.closest('.pa-nicho').remove()"><i class="bi bi-trash"></i></button></div>
        <textarea class="pa-nicho-texto" rows="6" style="${sel};resize:vertical">${esc(t)}</textarea></div>`;
    const linhaEquipe = (p) => `<div class="pa-pessoa" style="display:grid;grid-template-columns:1fr 1fr 1.4fr auto;gap:8px;align-items:center">
        <input class="pa-p-nome" value="${esc(p.nome)}" placeholder="Nome (ex.: Fernanda)" style="${sel}">
        <input class="pa-p-wpp" value="${esc(p.whatsapp)}" placeholder="WhatsApp usado (ex.: Conexa Local)" style="${sel}">
        <input class="pa-p-nichos" value="${esc(Array.isArray(p.nichos) ? p.nichos.join(', ') : p.nichos || '')}" placeholder="Nichos, separados por vírgula" style="${sel}">
        <button class="btn btn-ghost" style="padding:4px 9px" onclick="this.closest('.pa-pessoa').remove()"><i class="bi bi-trash"></i></button></div>`;
    const linhaExtra = (x) => `<div class="pa-extra" style="display:grid;gap:6px;border:1px solid var(--border);border-radius:10px;padding:10px">
        <div style="display:flex;gap:8px"><input class="pa-x-tit" value="${esc(x.titulo)}" placeholder="Quando usar (ex.: secretária respondeu)" style="${sel};flex:1"><button class="btn btn-ghost" style="padding:4px 9px" onclick="this.closest('.pa-extra').remove()"><i class="bi bi-trash"></i></button></div>
        <textarea class="pa-x-txt" rows="3" style="${sel};resize:vertical">${esc(x.texto)}</textarea></div>`;
    const linhaEtapa = (j, i) => `<div class="pa-etapa" data-key="${esc(j.key)}" style="display:grid;gap:6px;border:1px solid var(--border);border-left:3px solid ${j.quem === 'amanda' ? 'var(--yellow)' : j.quem === 'equipe' ? 'var(--green)' : 'var(--border)'};border-radius:10px;padding:10px">
        <div style="display:grid;grid-template-columns:28px 1fr 170px;gap:8px;align-items:center"><b style="color:var(--text-muted)">${i + 1}</b>
          <input class="pa-e-nome" value="${esc(j.nome)}" style="${sel}">
          <select class="pa-e-quem" style="${sel}"><option value="equipe"${j.quem === 'equipe' ? ' selected' : ''}>Quem faz: equipe</option><option value="amanda"${j.quem === 'amanda' ? ' selected' : ''}>Quem faz: Amanda</option><option value=""${!j.quem ? ' selected' : ''}>Fim do caminho</option></select></div>
        <input class="pa-e-dica" value="${esc(j.dica || '')}" placeholder="O que fazer nesta etapa" style="${sel}">
        ${j.texto === '{TEXTO1}' || j.texto === '{TEXTO2}' ? `<div style="font-size:12px;color:var(--text-muted)">Mensagem: usa o ${j.texto === '{TEXTO1}' ? 'Texto 1' : 'Texto 2'} acima.</div><input type="hidden" class="pa-e-texto" value="${esc(j.texto)}">`
          : `<textarea class="pa-e-texto" rows="${j.texto ? 6 : 2}" placeholder="Mensagem desta etapa (opcional)" style="${sel};resize:vertical">${esc(j.texto || '')}</textarea>`}
        <div style="font-size:11.5px;color:var(--text-muted)">Próximos caminhos: ${(j.saidas || []).map(([k, l]) => esc(l)).join(' · ') || 'nenhum (fim)'}</div></div>`;
    P._linhas = { linhaNicho, linhaEquipe, linhaExtra };
    const lbl = (t, d) => `<div style="font-weight:600;font-size:13px">${t}</div>${d ? `<div style="font-size:12px;color:var(--text-muted);margin:-4px 0 2px">${d}</div>` : ''}`;
    $('main-content').innerHTML = `<div class="page-wrap" style="max-width:940px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><button class="btn btn-ghost" onclick="ProspAtiva.abrir()"><i class="bi bi-arrow-left"></i> Prospecção ativa</button>
      <h2 style="margin:0;font-size:19px">${id ? 'Configurar prospecção' : 'Nova prospecção'}</h2></div>
      <div class="card" style="padding:20px;${caixa};display:grid;gap:14px">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
          <label style="display:grid;gap:6px">${lbl('Nome da prospecção')}<input id="pa-nome" value="${esc(c.nome)}" placeholder="Ex.: Site R$ 600" style="${sel}"></label>
          <label style="display:grid;gap:6px">${lbl('Tipo')}<select id="pa-tipo" style="${sel}">${Object.entries(TIPOS).map(([k, l]) => `<option value="${k}"${c.tipo === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label style="display:grid;gap:6px">${lbl('Preço / oferta')}<input id="pa-preco" value="${esc(c.preco)}" placeholder="R$ 600 ou 6x" style="${sel}"></label>
        </div>
        <label style="display:grid;gap:6px">${lbl('Informação base', 'O que estamos oferecendo e para quem. Aparece para a equipe no topo da lista.')}<textarea id="pa-desc" rows="3" style="${sel};resize:vertical">${esc(c.descricao)}</textarea></label>
        <label style="display:grid;gap:6px">${lbl('Texto 1 · abordagem (padrão)', 'Use {NOME} para o nome da empresa e {CIDADE} para a cidade.')}<textarea id="pa-t1" rows="8" style="${sel};resize:vertical">${esc(c.texto1)}</textarea></label>
        <div style="display:grid;gap:8px">${lbl('Texto 1 por nicho (opcional)', 'Se o nicho da empresa tiver um texto aqui, ele substitui o padrão.')}
          <div id="pa-nichos" style="display:grid;gap:8px">${nichos.map(([n, t]) => linhaNicho(n, t)).join('')}</div>
          <button class="btn btn-ghost" style="justify-self:start" onclick="document.getElementById('pa-nichos').insertAdjacentHTML('beforeend',ProspAtiva._linhas.linhaNicho('',''))"><i class="bi bi-plus"></i> Texto para um nicho</button></div>
        <label style="display:grid;gap:6px">${lbl('Texto 2 · quando a pessoa disser SIM')}<textarea id="pa-t2" rows="4" style="${sel};resize:vertical">${esc(c.texto2)}</textarea></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label style="display:grid;gap:6px">${lbl('Link de pagamento', 'Entra no lugar de {PAGAMENTO}.')}<input id="pa-pag" value="${esc(c.linkPagamento || '')}" placeholder="https://…" style="${sel}"></label>
          <label style="display:grid;gap:6px">${lbl('Link da agenda (opcional)', 'Para o cliente escolher o horário da reunião.')}<input id="pa-agenda" value="${esc(c.linkAgenda || '')}" placeholder="https://calendly.com/…" style="${sel}"></label>
        </div>
        <div style="display:grid;gap:8px">${lbl('Caminho do lead até o fechamento', 'Cada etapa diz quem faz (equipe ou Amanda) e a mensagem a enviar. Nas mensagens: {NOME}, {CONTATO}, {PREVIA}, {PAGAMENTO}, {PRECO}, {AGENDA}. Etapas da Amanda caem em Demandas da Prospecção; as da equipe em Próximos passos.')}
          <div id="pa-jornada" style="display:grid;gap:8px">${c.jornada.map(linhaEtapa).join('')}</div></div>
        <label style="display:grid;gap:6px">${lbl('Prompt para o Claude (vai junto com a ficha)', 'Quando você copia uma demanda, este prompt vem antes da ficha. {FICHA} é onde entra a ficha da empresa.')}<textarea id="pa-prompt" rows="8" style="${sel};resize:vertical">${esc(c.promptDemanda || (c.tipo === 'google' ? PROMPT_GOOGLE : PROMPT_SITE))}</textarea></label>
        <div style="display:grid;gap:8px">${lbl('Respostas extras', 'Textos prontos para situações comuns (secretária, sem interesse, pergunta de preço).')}
          <div id="pa-extras" style="display:grid;gap:8px">${(c.extras || []).map(linhaExtra).join('')}</div>
          <button class="btn btn-ghost" style="justify-self:start" onclick="document.getElementById('pa-extras').insertAdjacentHTML('beforeend',ProspAtiva._linhas.linhaExtra({titulo:'',texto:''}))"><i class="bi bi-plus"></i> Resposta extra</button></div>
        <div style="display:grid;gap:8px">${lbl('Equipe e WhatsApp de cada pessoa', 'As empresas importadas são distribuídas por nicho. Deixe os nichos vazios para quem pega o resto.')}
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
    c.linkPagamento = $('pa-pag').value.trim(); c.linkAgenda = $('pa-agenda').value.trim(); c.promptDemanda = $('pa-prompt').value;
    c.textosNicho = {}; document.querySelectorAll('.pa-nicho').forEach((d) => { const n = d.querySelector('.pa-nicho-nome').value.trim(); if (n) c.textosNicho[n] = d.querySelector('.pa-nicho-texto').value; });
    c.extras = [...document.querySelectorAll('.pa-extra')].map((d) => ({ titulo: d.querySelector('.pa-x-tit').value.trim(), texto: d.querySelector('.pa-x-txt').value })).filter((x) => x.titulo || x.texto);
    c.equipe = [...document.querySelectorAll('.pa-pessoa')].map((d) => ({ nome: d.querySelector('.pa-p-nome').value.trim(), whatsapp: d.querySelector('.pa-p-wpp').value.trim(), nichos: d.querySelector('.pa-p-nichos').value.split(',').map((s) => s.trim()).filter(Boolean) })).filter((p) => p.nome);
    const antes = Object.fromEntries((c.jornada || []).map((j) => [j.key, j]));
    c.jornada = [...document.querySelectorAll('.pa-etapa')].map((d) => ({ ...(antes[d.dataset.key] || { key: d.dataset.key, saidas: [] }), nome: d.querySelector('.pa-e-nome').value.trim(), quem: d.querySelector('.pa-e-quem').value, dica: d.querySelector('.pa-e-dica').value.trim(), texto: d.querySelector('.pa-e-texto').value }));
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
    const pessoas = [...new Set(novas.filter((e) => !e.dia).map((e) => e.responsavel || ''))];
    pessoas.forEach((pes) => {
      const ja = empsDa(camp.id).filter((e) => (e.responsavel || '') === pes && e.dia);
      const cont = {}; ja.forEach((e) => { cont[perKey(e)] = (cont[perKey(e)] || 0) + 1; });
      const d = new Date(hojeISO() + 'T12:00:00'); let pi = 0;
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
    let nCamp = 0, nEmp = 0, nIgual = 0, nFicha = 0; const erros = [];
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
          const novas = []; const fichas = [];
          for (const e0 of j.empresas) {
            const tel = String(e0.tel || e0.whatsapp || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
            if (!tel) continue;
            const id = camp.id + '_' + tel;
            const existe = S.emps.find((x) => x.id === id);
            // empresa que já está na lista: só completa a ficha (campos vazios), sem mexer em etapa e histórico
            if (existe && e0.ficha && !j.substituir) {
              const f = { ...(existe.ficha || {}) }; let mudou = false;
              Object.entries(e0.ficha).forEach(([k, v]) => { if (v && !String(f[k] || '').trim()) { f[k] = v; mudou = true; } });
              if (mudou) fichas.push({ ...existe, ficha: f, hist: [...(existe.hist || []), { d: agora(), t: 'Ficha preenchida pelo Claude (Google, redes e resumo).', por: 'Claude' }] });
              else nIgual++;
              continue;
            }
            if (existe && !j.substituir) { nIgual++; continue; }
            novas.push({ status: 'a_enviar', hist: [{ d: agora(), t: 'Importada para a prospecção.' }], ...e0, tel, id, campanhaId: camp.id });
          }
          distribuir(camp, novas);
          let i = 0;
          for (const e of novas) { await salvarEmp(e); i++; if (i % 10 === 0 && $('pa-imp')) $('pa-imp').textContent = `Importando ${i} de ${novas.length} empresas…`; }
          nEmp += novas.length;
          let k = 0;
          for (const e of fichas) { await salvarEmp(e); k++; if (k % 10 === 0 && $('pa-imp')) $('pa-imp').textContent = `Preenchendo fichas: ${k} de ${fichas.length}…`; }
          nFicha += fichas.length;
          await carregarEmps();
        }
      } catch (e) { erros.push(f.name + ' (' + e.message + ')'); }
    }
    toast(`${nCamp ? nCamp + ' prospecção(ões) e ' : ''}${nEmp} empresa(s) importada(s)` + (nFicha ? `, ${nFicha} ficha(s) preenchida(s)` : '') + (nIgual ? `, ${nIgual} sem mudança` : '') + (erros.length ? `. Erros: ${erros.join(', ')}` : ''));
    if (S.camp) P.campanha(S.camp.id, S.pessoa || '__todos'); else inicio();
  };

  // ── tela da campanha ──────────────────────────────────────────────────
  P.campanha = async (id, pessoa, aba) => {
    if (!S.emps.length || !S.camps.length) await carregarTudo();
    const c = S.camps.find((x) => x.id === id); if (!c) return P.abrir();
    S.camp = c; S.per = null; S.filtro = ''; S.busca = '';
    const eu = meuNome();
    const pessoas = [...new Set(empsDa(c.id).map((e) => e.responsavel).filter(Boolean))];
    S.pessoa = pessoa === '__todos' ? null : (pessoa || pessoas.find((p) => mesmaPessoa(p, eu)) || null);
    S.aba = aba || 'fila';
    tela();
  };
  P.pessoa = (v) => { S.pessoa = v || null; S.per = null; tela(); };
  P.aba = (v) => { S.aba = v; tela(); };
  P.periodo = (v) => { S.per = v; tela(); };
  P.filtrar = (v) => { S.filtro = S.filtro === v ? '' : v; tela(); };
  P.buscar = (v) => { S.busca = v; tela(); const b = $('pa-busca'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } };
  P.atualizar = async () => { await carregarTudo(); S.camp = S.camps.find((c) => c.id === S.camp.id) || S.camp; tela(); toast('Lista atualizada'); };

  function tela() {
    const c = S.camp; const todas = empsDa(c.id);
    const base = todas.filter((e) => !S.pessoa || mesmaPessoa(e.responsavel, S.pessoa));
    const pessoas = [...new Set(todas.map((e) => e.responsavel).filter(Boolean))];
    const ses = sessaoAtiva(c.id, S.pessoa);
    const minhaEquipe = (c.equipe || []).find((p) => mesmaPessoa(p.nome, S.pessoa));
    const nPassos = base.filter(ehPassoEquipe).length, nDem = todas.filter(ehDemanda).length;
    const abas = [['fila', 'Lista do período'], ['passos', `Próximos passos${nPassos ? ' (' + nPassos + ')' : ''}`], ['demandas', `Demandas da Prospecção${nDem ? ' (' + nDem + ')' : ''}`], ['andamento', 'Andamento'], ['todas', 'Todas as empresas'], ['sessoes', 'Quem prospectou']];
    const topo = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="ProspAtiva.abrir()"><i class="bi bi-arrow-left"></i> Prospecções</button>
          <div><div style="font-weight:700;font-size:17px">${esc(c.nome)}</div><div style="color:var(--text-muted);font-size:12px">${esc(TIPOS[c.tipo] || '')}${c.preco ? ' · ' + esc(c.preco) : ''} · ${base.length} empresas</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <label style="font-size:12px;color:var(--text-muted)">Lista de</label>
          <select onchange="ProspAtiva.pessoa(this.value)" style="${sel}"><option value="">Todos</option>${pessoas.map((p) => `<option value="${esc(p)}"${S.pessoa === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
          <button class="btn btn-ghost" title="Atualizar" onclick="ProspAtiva.atualizar()"><i class="bi bi-arrow-clockwise"></i></button>
          <label class="btn btn-ghost" style="cursor:pointer"><i class="bi bi-upload"></i> Importar<input type="file" accept=".json,application/json" multiple style="display:none" onchange="ProspAtiva.importar(this.files);this.value=''"></label>
          <button class="btn btn-ghost" onclick="ProspAtiva.editar('${esc(c.id)}')"><i class="bi bi-gear"></i></button>
        </div>
      </div>
      ${c.descricao ? `<div style="font-size:12.5px;color:var(--text-secondary);${caixa};padding:10px 12px;margin-bottom:12px"><b>Informação base:</b> ${esc(c.descricao)}</div>` : ''}
      ${S.pessoa && minhaEquipe ? `<div style="font-size:12.5px;margin-bottom:12px"><i class="bi bi-whatsapp" style="color:var(--green)"></i> ${esc(S.pessoa)} envia pelo WhatsApp <b>${esc(minhaEquipe.whatsapp || '—')}</b>. Deixe esse WhatsApp aberto no WhatsApp Web, numa aba só.</div>` : ''}
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;overflow-x:auto">
        ${abas.map(([k, l]) => `<button onclick="ProspAtiva.aba('${k}')" style="background:none;border:0;border-bottom:2px solid ${S.aba === k ? 'var(--accent)' : 'transparent'};color:${S.aba === k ? 'var(--text-primary)' : 'var(--text-muted)'};font-family:var(--font);font-weight:600;font-size:13px;padding:8px 12px;cursor:pointer;white-space:nowrap">${l}</button>`).join('')}
      </div>`;
    let corpo = '';
    if (S.aba === 'fila') corpo = telaFila(c, base, ses);
    else if (S.aba === 'passos') corpo = `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Empresas que estão com a equipe para enviar a próxima mensagem (prévia pronta, marcar reunião, link de pagamento) ou que responderam.</div>` + lista(base.filter((e) => ehPassoEquipe(e) || e.status === 'respondeu').sort(porAtualizacao), 'Nada esperando por você agora.');
    else if (S.aba === 'demandas') corpo = `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Quem disse SIM e está esperando a Amanda: copiar a ficha com o prompt, montar e colar o link. Também aparecem as reuniões marcadas.</div>` + lista(todas.filter(ehDemanda).sort(porAtualizacao), 'Nenhuma demanda agora.');
    else if (S.aba === 'andamento') corpo = telaAndamento(c, base);
    else if (S.aba === 'todas') corpo = telaTodas(c, base);
    else corpo = telaSessoes(c);
    $('main-content').innerHTML = `<div class="page-wrap" style="max-width:1120px">${topo}${corpo}</div>`;
  }
  const porAtualizacao = (a, b) => String(b.atualizado || '').localeCompare(String(a.atualizado || ''));

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
        : `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;${caixa};border:1px dashed var(--accent);padding:10px 12px">
            <span style="font-size:12.5px">Antes de enviar, registre quem está prospectando esta lista.</span>
            <button class="btn btn-primary" style="margin-left:auto" onclick="ProspAtiva.iniciar()"><i class="bi bi-play-fill"></i> Iniciar prospecção do período</button></div>`;
    return `<div style="display:grid;gap:12px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:12px;color:var(--text-muted)">Período</span>${seletor}
        <span style="font-size:12px;color:var(--text-muted);margin-left:auto">${feitos} de ${fila.length} abordadas · espere 1 a 2 minutos entre uma e outra</span></div>
      <div style="height:8px;border-radius:99px;background:var(--bg-base);overflow:hidden"><i style="display:block;height:100%;width:${fila.length ? Math.round(feitos / fila.length * 100) : 0}%;background:var(--accent-grad)"></i></div>
      ${sesBox}
      ${lista(fila, 'Nenhuma empresa neste período.', true)}
    </div>`;
  }

  function telaAndamento(c, base) {
    const js = jornada(c);
    const cols = [...js.filter((j) => j.key !== 'a_enviar'), { key: 'respondeu', ...EXTRAS.respondeu }, { key: 'sem_interesse', ...EXTRAS.sem_interesse }];
    const porPessoa = {};
    base.filter((e) => (e.status || 'a_enviar') !== 'a_enviar').forEach((e) => { const p = e.responsavel || '—'; porPessoa[p] = porPessoa[p] || { abordadas: 0, andamento: 0, fechou: 0 }; porPessoa[p].abordadas++; if (!['enviada', 'sem_interesse', 'sem_whatsapp', 'fechou'].includes(e.status)) porPessoa[p].andamento++; if (e.status === 'fechou') porPessoa[p].fechou++; });
    const resumo = Object.entries(porPessoa).map(([p, v]) => `<div style="${caixa};padding:10px 12px;min-width:170px"><div style="font-weight:700">${esc(p)}</div><div style="font-size:12px;color:var(--text-muted)">${v.abordadas} abordadas · ${v.andamento} em andamento · ${v.fechou} fecharam</div></div>`).join('');
    const colunas = cols.map((j) => {
      const et = etapa(c, j.key); const itens = base.filter((e) => (e.status || 'a_enviar') === j.key).sort(porAtualizacao);
      return `<div style="min-width:230px;max-width:260px;flex:0 0 auto;${caixa};padding:10px;display:flex;flex-direction:column;gap:6px">
        <div style="font-size:12px;font-weight:700;color:${et.cor}">${esc(et.nome)} <span style="color:var(--text-muted)">(${itens.length})</span></div>
        <div style="font-size:10.5px;color:var(--text-muted)">${et.quem === 'amanda' ? 'Com a Amanda' : et.quem === 'equipe' ? 'Com a equipe' : ''}</div>
        ${itens.slice(0, 40).map((e) => `<div onclick="ProspAtiva.irPara('${esc(e.id)}')" style="border:1px solid var(--border);border-radius:8px;padding:7px 9px;cursor:pointer;background:var(--bg-base)"><div style="font-size:12px;font-weight:600;overflow-wrap:anywhere">${esc(e.nome)}</div><div style="font-size:10.5px;color:var(--text-muted)">${esc(e.responsavel || '')}${e.atualizado ? ' · ' + esc(fmtData(e.atualizado)) : ''}</div></div>`).join('')}
        ${itens.length > 40 ? `<div style="font-size:11px;color:var(--text-muted)">e mais ${itens.length - 40}</div>` : ''}
      </div>`;
    }).join('');
    return `<div style="display:grid;gap:12px">
      <div style="font-size:12.5px;color:var(--text-muted)">Até onde cada empresa já chegou no caminho até o fechamento, e com quem está.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${resumo || '<span style="font-size:12.5px;color:var(--text-muted)">Ninguém abordado ainda.</span>'}</div>
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;align-items:flex-start">${colunas}</div>
    </div>`;
  }

  function telaTodas(c, base) {
    const ks = [...jornada(c).map((j) => j.key), 'respondeu', 'sem_interesse', 'sem_whatsapp'];
    const cont = Object.fromEntries(ks.map((k) => [k, 0])); base.forEach((e) => { const k = e.status || 'a_enviar'; cont[k] = (cont[k] || 0) + 1; });
    const q = S.busca.toLowerCase();
    const vis = base.filter((e) => (!S.filtro || (e.status || 'a_enviar') === S.filtro) && (!q || [e.nome, e.tel, e.end, e.nicho].join(' ').toLowerCase().includes(q)));
    return `<div style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px">${ks.map((k) => { const et = etapa(c, k); return `<button onclick="ProspAtiva.filtrar('${k}')" style="text-align:left;background:var(--bg-card);border:1px solid ${S.filtro === k ? et.cor : 'var(--border)'};border-radius:10px;padding:9px 11px;cursor:pointer;color:var(--text-primary);font-family:var(--font)"><div style="font-size:19px;font-weight:700;color:${et.cor}">${cont[k] || 0}</div><div style="font-size:11px;color:var(--text-muted)">${esc(et.nome)}</div></button>`; }).join('')}</div>
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
    const c = campDe(e); const st = e.status || 'a_enviar', et = etapa(c, st);
    const aberto = S.abertos.has(e.id);
    const apagado = numerar && st !== 'a_enviar';
    return `<div id="pa-e-${esc(e.id)}" style="background:var(--bg-card);border:1px solid ${aberto ? 'var(--border-bright)' : 'var(--border)'};border-radius:12px;${apagado ? 'opacity:.6' : ''}">
      <div onclick="ProspAtiva.toggle('${esc(e.id)}')" style="display:grid;grid-template-columns:${numerar ? '30px ' : ''}1fr auto;gap:12px;align-items:center;padding:11px 14px;cursor:pointer">
        ${numerar ? `<span style="font-weight:700;color:var(--text-muted);text-align:right">${esc(e.ordem || '')}</span>` : ''}
        <div style="min-width:0"><div style="font-weight:600;overflow-wrap:anywhere">${esc(e.nome)}</div>
          <div style="color:var(--text-muted);font-size:12px;display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:2px"><span style="color:var(--accent)">${esc(e.nicho || '')}</span><span>${esc(fmtTel(e.tel))}</span>${e.nota ? `<span>★ ${esc(e.nota)} (${esc(e.aval)})</span>` : ''}${e.insta ? '<span>só Instagram</span>' : ''}${!S.pessoa && e.responsavel ? `<span><i class="bi bi-person"></i> ${esc(e.responsavel)}</span>` : ''}${e.enviadoPor ? `<span>abordada por ${esc(e.enviadoPor)}</span>` : ''}${e.reuniao ? `<span style="color:var(--purple)"><i class="bi bi-calendar-event"></i> ${esc(e.reuniao)}</span>` : ''}</div></div>
        <span style="font-size:11.5px;font-weight:700;color:${et.cor};border:1px solid ${et.cor};border-radius:20px;padding:2px 10px;white-space:nowrap">${esc(et.nome)}</span>
      </div>
      ${aberto ? detalhe(e) : ''}
    </div>`;
  }

  function detalhe(e) {
    const c = campDe(e), st = e.status || 'a_enviar', et = etapa(c, st), f = e.ficha || {}, id = esc(e.id);
    const btn = (acao, txt, cor, extra) => `<button class="btn btn-ghost" style="font-size:12.5px;${cor ? `border-color:${cor};color:${cor}` : ''}" onclick="ProspAtiva.${acao}('${id}'${extra ? ',' + extra : ''})">${txt}</button>`;
    const msg = et.texto ? preencher(c, e, et.texto) : '';
    const precisaPrevia = /\{PREVIA\}/.test(et.texto || '') && !e.previa;
    const precisaPag = /\{PAGAMENTO\}/.test(et.texto || '') && !c.linkPagamento;
    // passo atual
    const passo = `<div style="border:1px solid ${et.cor};border-radius:10px;padding:12px;display:grid;gap:10px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">Passo atual</span><b style="color:${et.cor}">${esc(et.nome)}</b>
          <span style="font-size:11.5px;color:var(--text-muted)">${et.quem === 'amanda' ? '· com a Amanda' : et.quem === 'equipe' ? '· com ' + esc(e.responsavel || 'a equipe') : ''}</span></div>
        ${et.dica ? `<div style="font-size:12.5px;color:var(--text-secondary)">${esc(et.dica)}</div>` : ''}
        ${msg ? `<div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:12.5px;white-space:pre-wrap;max-height:170px;overflow:auto;color:var(--text-secondary)">${esc(msg)}</div>` : ''}
        ${precisaPrevia ? '<div style="font-size:12px;color:var(--red)">Falta o link da prévia nesta empresa.</div>' : ''}
        ${precisaPag ? '<div style="font-size:12px;color:var(--red)">Falta o link de pagamento na configuração da prospecção (engrenagem).</div>' : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${msg ? `<a class="btn btn-ghost" style="font-size:12.5px;border-color:var(--green);color:var(--green);text-decoration:none;font-weight:700" href="${esc(waLink(e.tel, msg))}" target="whatsapp" rel="noopener"><i class="bi bi-whatsapp"></i> Abrir no WhatsApp com o texto</a>${btn('copiarPasso', 'Copiar texto')}` : `<a class="btn btn-ghost" style="font-size:12.5px;border-color:var(--green);color:var(--green);text-decoration:none" href="${esc(waLink(e.tel))}" target="whatsapp" rel="noopener"><i class="bi bi-whatsapp"></i> Abrir conversa</a>`}
          ${st === 'gostou' ? `<input id="pr-${id}" value="${esc(e.reuniao || '')}" placeholder="Dia e hora da reunião (ex.: qui 20/11 às 14h)" style="${sel};min-width:240px">` : ''}
          ${(et.saidas || []).filter(([k]) => !(st === 'quer_previa' && k === 'previa_pronta')).map(([k, l], i) => btn('marcar', esc(l), i === 0 ? et.cor : (k === 'sem_interesse' || k === 'sem_whatsapp' ? 'var(--red)' : ''), `'${k}'`)).join('')}
        </div>
      </div>`;
    // demanda da Amanda: ficha completa + prompt + link
    const demanda = st === 'quer_previa' ? `<div style="border:1px solid var(--yellow);border-radius:10px;padding:12px;display:grid;gap:10px">
        <div style="font-weight:700;color:var(--yellow)"><i class="bi bi-stars"></i> Demanda: montar ${c.tipo === 'google' ? 'a análise' : 'a prévia'}</div>
        <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:12px;white-space:pre-wrap;max-height:220px;overflow:auto;color:var(--text-secondary)">${esc(fichaTexto(e))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('copiarDemanda', '<i class="bi bi-clipboard-check"></i> Copiar ficha + prompt para o Claude', 'var(--yellow)')}${btn('copiarFicha', 'Copiar só a ficha')}
          <a class="btn btn-ghost" style="font-size:12.5px;text-decoration:none" href="${esc(mapsLink(e))}" target="_blank" rel="noopener"><i class="bi bi-geo-alt"></i> Perfil no Google</a>
          ${f.instagram ? `<a class="btn btn-ghost" style="font-size:12.5px;text-decoration:none" href="${esc(f.instagram)}" target="_blank" rel="noopener"><i class="bi bi-instagram"></i> Instagram</a>` : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="pv-${id}" value="${esc(e.previa || '')}" placeholder="Colar link da prévia aqui" style="${sel};flex:1;min-width:240px">${btn('entregarPrevia', '<i class="bi bi-send"></i> Salvar e devolver para ' + esc(e.responsavel || 'a equipe'), 'var(--green)')}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">Ao salvar, a empresa volta para ${esc(e.responsavel || 'a equipe')} em "Próximos passos" com o texto da prévia pronto para enviar.</div>
      </div>` : '';
    const mostraFicha = !['a_enviar', 'enviada', 'sem_whatsapp'].includes(st);
    const ficha = mostraFicha ? `<details ${st === 'quer_previa' && !f.google ? 'open' : ''} style="border:1px solid var(--border);border-radius:10px;padding:10px 12px"><summary style="cursor:pointer;font-weight:600;font-size:13px"><i class="bi bi-clipboard"></i> Ficha da empresa (equipe preenche)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">${CAMPOS.map(([k, n, full]) => `<label style="display:grid;gap:4px;font-size:12px;color:var(--text-muted);${full ? 'grid-column:1/-1' : ''}">${n}${full ? `<textarea id="pf-${k}-${id}" rows="3" style="${sel};resize:vertical">${esc(f[k] || '')}</textarea>` : `<input id="pf-${k}-${id}" value="${esc(f[k] || '')}" style="${sel}">`}</label>`).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">${btn('salvarFicha', '<i class="bi bi-check-lg"></i> Salvar ficha', 'var(--accent)')}</div></details>` : '';
    const extras = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:11.5px;color:var(--text-muted)">Copiar:</span>${btn('copiarTexto', 'Texto 1', '', "'t1'")}${btn('copiarTexto', 'Texto 2', '', "'t2'")}${(c.extras || []).map((x, i) => btn('copiarTexto', esc(x.titulo || 'Resposta ' + (i + 1)), '', `'x${i}'`)).join('')}
        <a class="btn btn-ghost" style="font-size:12.5px;text-decoration:none" href="${esc(mapsLink(e))}" target="_blank" rel="noopener"><i class="bi bi-geo-alt"></i> Ver no Google</a>
        ${e.previa ? `<a class="btn btn-ghost" style="font-size:12.5px;text-decoration:none" href="${esc(e.previa)}" target="_blank" rel="noopener"><i class="bi bi-window"></i> Ver prévia</a>` : ''}
        <select onchange="ProspAtiva.marcar('${id}',this.value)" title="Mudar etapa à mão" style="${sel};font-size:12px;padding:6px 8px;margin-left:auto">${[...jornada(c).map((j) => j.key), 'respondeu', 'sem_interesse', 'sem_whatsapp'].map((k) => `<option value="${k}"${k === st ? ' selected' : ''}>${esc(etapa(c, k).nome)}</option>`).join('')}</select></div>`;
    const hist = (e.hist || []).slice().reverse().map((h) => `<div style="display:grid;grid-template-columns:92px 1fr;gap:10px;font-size:12.5px"><span style="color:var(--text-muted)">${esc(fmtData(h.d))}</span><span style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(h.t)}${h.por ? ` <span style="color:var(--text-muted)">· ${esc(h.por)}</span>` : ''}</span></div>`).join('');
    return `<div style="border-top:1px solid var(--border);padding:12px 14px;display:grid;gap:12px">
      ${passo}${demanda}${ficha}${extras}
      ${e.end ? `<div style="font-size:12px;color:var(--text-muted)"><i class="bi bi-geo"></i> ${esc(e.end)} · ${esc(e.cidade || '')}${e.cat ? ' · ' + esc(e.cat) : ''}</div>` : ''}
      <div style="display:grid;gap:6px"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)">Histórico</div>${hist || '<span style="font-size:12.5px;color:var(--text-muted)">Nenhum contato ainda.</span>'}</div>
      <div style="display:flex;gap:8px"><input id="pn-${id}" placeholder="Anotar o que aconteceu (ex.: secretária vai repassar para a dentista)" style="${sel};flex:1" onkeydown="if(event.key==='Enter')ProspAtiva.anotar('${id}')">${btn('anotar', 'Anotar', 'var(--accent)')}</div>
    </div>`;
  }

  // ── ações ─────────────────────────────────────────────────────────────
  P.toggle = (id) => { if (S.abertos.has(id)) S.abertos.delete(id); else S.abertos.add(id); redesenhar(id); };
  function redesenhar(id) {
    const e = S.emps.find((x) => x.id === id); const el = $('pa-e-' + id);
    if (e && el) el.outerHTML = card(e, S.aba === 'fila'); else tela();
  }
  function quem() { const s = S.camp && sessaoAtiva(S.camp.id, S.pessoa); return (s && s.responsavel) || meuNome() || 'Equipe'; }
  async function registrar(e, patch, nota) {
    Object.assign(e, patch, { atualizado: agora() });
    if (nota) e.hist = [...(e.hist || []), { d: agora(), t: nota, por: quem() }];
    try { await salvarEmp(e); return true; } catch (x) { toast('Não salvou: ' + x.message); return false; }
  }
  function lerFicha(id) { const f = {}; let achou = false; CAMPOS.forEach(([k]) => { const el = $('pf-' + k + '-' + id); if (el) { achou = true; f[k] = el.value.trim(); } }); return achou ? f : null; }

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

  P.marcar = async (id, st) => {
    const e = S.emps.find((x) => x.id === id); if (!e || e.status === st) return;
    const c = campDe(e); const novo = etapa(c, st);
    const patch = { status: st };
    let ses = null;
    if (st === 'enviada' && !e.enviadoEm) {
      ses = sessaoAtiva(c.id, S.pessoa || e.responsavel);
      Object.assign(patch, { enviadoPor: quem(), enviadoEm: agora(), sessaoId: ses ? ses.id : null });
    }
    if (st === 'reuniao') { const r = (($('pr-' + id) || {}).value || '').trim(); if (r) patch.reuniao = r; }
    const f = lerFicha(id); if (f) patch.ficha = { ...(e.ficha || {}), ...f };
    const nota = { enviada: 'Abordagem enviada no WhatsApp.', quer_previa: 'Disse SIM. Texto 2 enviado; demanda para a Amanda.', previa_enviada: 'Prévia enviada ao cliente.', gostou: 'Gostou da prévia e quer seguir.', reuniao: 'Reunião marcada' + (patch.reuniao ? ': ' + patch.reuniao : '') + '.', pagamento: 'Reunião feita. Enviar link de pagamento.', aguardando_pagamento: 'Link de pagamento enviado.', fechou: 'Pagou. Fechou! 🎉', sem_interesse: 'Sem interesse.', sem_whatsapp: 'Número sem WhatsApp.', respondeu: 'Respondeu (ver conversa).', a_enviar: 'Voltou para a lista de envio.' }[st] || ('Etapa: ' + novo.nome);
    if (!(await registrar(e, patch, nota))) return;
    if (ses) { ses.enviadas = (ses.enviadas || 0) + 1; window.dbSet(C_SES, ses.id, ses); }
    if (novo.quem === 'amanda') notificar((u) => u.role === 'admin', '<i class="bi bi-stars"></i> Demanda da Prospecção', `${e.nome}: ${novo.nome} (${quem()}).`);
    if (st === 'fechou') notificar((u) => u.role === 'admin', '<i class="bi bi-trophy"></i> Fechou!', `${e.nome} fechou na prospecção ${c.nome}.`);
    if (S.aba === 'fila' && st === 'enviada') S.abertos.delete(id);
    toast(novo.nome);
    tela();
  };
  P.entregarPrevia = async (id) => {
    const e = S.emps.find((x) => x.id === id); const v = (($('pv-' + id) || {}).value || '').trim(); if (!e) return;
    if (!/^https?:\/\//i.test(v)) return toast('Cole o link completo da prévia (começando com https://)');
    if (!(await registrar(e, { previa: v, status: 'previa_pronta' }, 'Prévia pronta: ' + v + '. Voltou para ' + (e.responsavel || 'a equipe') + ' enviar.'))) return;
    notificar((u) => mesmaPessoa(u.name, e.responsavel), '<i class="bi bi-whatsapp"></i> Prévia pronta para enviar', `${e.nome}: a prévia ficou pronta. Envie o link pelo WhatsApp.`);
    toast('Prévia salva e devolvida para ' + (e.responsavel || 'a equipe'));
    tela();
  };
  P.anotar = async (id) => {
    const e = S.emps.find((x) => x.id === id); const inp = $('pn-' + id); const t = (inp && inp.value || '').trim(); if (!e || !t) return;
    if (await registrar(e, {}, t)) redesenhar(id);
  };
  P.salvarFicha = async (id) => {
    const e = S.emps.find((x) => x.id === id); const f = lerFicha(id); if (!e || !f) return;
    if (await registrar(e, { ficha: { ...(e.ficha || {}), ...f } }, 'Ficha atualizada.')) { toast('Ficha salva'); redesenhar(id); }
  };
  P.copiarPasso = (id) => { const e = S.emps.find((x) => x.id === id); if (!e) return; const c = campDe(e); copiar(preencher(c, e, etapa(c, e.status || 'a_enviar').texto)); };
  P.copiarFicha = (id) => { const e = S.emps.find((x) => x.id === id); if (e) copiar(fichaTexto(e)); };
  P.copiarDemanda = (id) => { const e = S.emps.find((x) => x.id === id); if (e) copiar(promptDemanda(e)); };
  P.copiarTexto = (id, qual) => {
    const e = S.emps.find((x) => x.id === id); if (!e) return; const c = campDe(e);
    if (qual === 't1') return copiar(texto1(c, e));
    if (qual === 't2') return copiar(c.texto2 || '');
    const x = (c.extras || [])[parseInt(String(qual).slice(1), 10)]; if (x) copiar(preencher(c, e, x.texto || ''));
  };
})();
