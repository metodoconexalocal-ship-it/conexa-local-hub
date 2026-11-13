/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Entrega Final: desenho dos slides (16:9, 1280×720)
   EntregaRender.slides(dados, pacotes)  → HTML de todos os slides ativos
   EntregaRender.roteiro(dados, pacotes) → HTML do roteiro da reunião (só para a Amanda)
   EntregaRender.documento(corpoHtml, titulo, opt) → página completa para imprimir em PDF
   As imagens chegam já resolvidas (data URL ou http).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lista = (a) => (Array.isArray(a) ? a : a ? String(a).split('\n') : []).map((x) => (typeof x === 'string' ? x.trim() : x)).filter(Boolean);
  const br = (t) => esc(t).replace(/\n/g, '<br>');
  const brl = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR');
  const ORIGEM = () => (typeof location !== 'undefined' && /^https?:/.test(location.origin) ? location.origin + '/' : '');

  const head = (s) => `${s.kicker ? `<div class="ef-kicker">${esc(s.kicker)}</div>` : ''}${s.titulo ? `<h2 class="ef-h2">${esc(s.titulo)}</h2>` : ''}`;
  const txt = (s) => (s.texto ? `<p class="ef-txt">${br(s.texto)}</p>` : '');
  const pts = (s, cls = '') => { const p = lista(s.pontos); return p.length ? `<ul class="ef-pts ${cls}">${p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };
  const fig = (im, cls = '') => (im && im.img ? `<figure class="ef-fig ${cls}"><div class="ef-fig-box"><img src="${esc(im.img)}" alt=""></div>${im.legenda ? `<figcaption>${esc(im.legenda)}</figcaption>` : ''}</figure>` : im && im.legenda ? `<figure class="ef-fig ef-fig-vazia ${cls}"><div class="ef-fig-box"><span>${esc(im.legenda)}</span></div></figure>` : '');
  const imgsDe = (s) => (s.imagens || []).filter((i) => i && (i.img || i.legenda));

  const TIPOS = {
    capa(s, d) {
      const c = d.cliente || {};
      return `<div class="ef-capa"><div class="ef-capa-glow"></div>
        <img class="ef-capa-sym" src="${ORIGEM()}img/relatorio-sym.png" alt="">
        <div class="ef-kicker">${esc(s.kicker || 'Relatório de apresentação')}</div>
        <h1 class="ef-h1">${br(s.titulo || 'Entrega Final')}</h1>
        ${s.texto ? `<p class="ef-capa-sub">${br(s.texto)}</p>` : ''}
        <div class="ef-capa-info">
          ${c.empresa ? `<div><span>Empresa</span><b>${esc(c.empresa)}</b></div>` : ''}
          ${c.nome ? `<div><span>Cliente</span><b>${esc(c.nome)}</b></div>` : ''}
          ${d.responsavel ? `<div><span>Feito por</span><b>${esc(d.responsavel)}</b></div>` : ''}
          ${d.data ? `<div><span>Data</span><b>${esc(d.data)}</b></div>` : ''}
        </div></div>`;
    },
    texto(s) {
      const im = imgsDe(s);
      if (!im.length) return `<div class="ef-um">${head(s)}${txt(s)}${pts(s, 'ef-pts-grid')}</div>`;
      return `<div class="ef-duas ${im.length > 1 ? 'ef-duas-larga' : ''}"><div class="ef-col-txt">${head(s)}${txt(s)}${pts(s)}</div>
        <div class="ef-col-img ef-n${Math.min(im.length, 4)}">${im.slice(0, 4).map((i) => fig(i)).join('')}</div></div>`;
    },
    galeria(s) {
      const im = imgsDe(s).slice(0, 8);
      const cols = im.length <= 2 ? im.length || 1 : im.length <= 3 ? 3 : im.length <= 4 ? 4 : im.length <= 6 ? 3 : 4;
      return `<div class="ef-um">${head(s)}${txt(s)}<div class="ef-grade" style="--cols:${cols};--rows:${Math.ceil(im.length / cols) || 1}">${im.map((i) => fig(i)).join('')}</div>${pts(s, 'ef-pts-linha')}</div>`;
    },
    produtos(s) {
      const grupos = {};
      (s.itens || []).forEach((p) => { const k = p.categoria || 'Produtos'; (grupos[k] = grupos[k] || []).push(p); });
      const im = imgsDe(s);
      return `<div class="ef-duas ${im.length ? '' : 'ef-sem-img'}"><div class="ef-col-txt">${head(s)}${txt(s)}
        <div class="ef-cats">${Object.entries(grupos).map(([k, arr]) => `<div class="ef-cat"><div class="ef-cat-t">${esc(k)}</div>${arr.map((p) => `<div class="ef-cat-i">${esc(p.nome)}</div>`).join('')}</div>`).join('')}</div>${pts(s)}</div>
        ${im.length ? `<div class="ef-col-img ef-n${Math.min(im.length, 4)}">${im.slice(0, 4).map((i) => fig(i)).join('')}</div>` : ''}</div>`;
    },
    metricas(s) {
      const n = (s.numeros || []).filter((x) => x.valor || x.label);
      return `<div class="ef-um">${head(s)}${txt(s)}
        <div class="ef-nums" style="--cols:${Math.min(Math.max(n.length, 1), 4)}">${n.map((x) => `<div class="ef-num ${x.tom === 'good' ? 'ef-good' : x.tom === 'alert' ? 'ef-alert' : ''}"><b>${esc(x.valor)}</b><span>${esc(x.label)}</span></div>`).join('')}</div>
        ${pts(s, 'ef-pts-grid')}${imgsDe(s).length ? `<div class="ef-grade ef-grade-baixa" style="--cols:${Math.min(imgsDe(s).length, 4)};--rows:1">${imgsDe(s).slice(0, 4).map((i) => fig(i)).join('')}</div>` : ''}</div>`;
    },
    cards(s) {
      const it = (s.itens || []).filter((x) => x.titulo || x.texto);
      const cols = it.length <= 3 ? Math.max(it.length, 1) : it.length === 4 ? 4 : it.length <= 6 ? 3 : 4;
      return `<div class="ef-um">${head(s)}${txt(s)}<div class="ef-cards" style="--cols:${cols}">${it.map((x, i) => `<div class="ef-card">${x.tag ? `<span class="ef-tag">${esc(x.tag)}</span>` : `<span class="ef-card-n">${String(i + 1).padStart(2, '0')}</span>`}<b>${esc(x.titulo)}</b>${x.texto ? `<p>${br(x.texto)}</p>` : ''}</div>`).join('')}</div>${pts(s, 'ef-pts-linha')}</div>`;
    },
    pacotes(s, d, pacotes) {
      const ps = (pacotes || []).filter((p) => p.ativo !== false);
      const rec = d.pacoteRecomendado;
      return `<div class="ef-um">${head(s)}${txt(s)}
        <div class="ef-pacs" style="--cols:${Math.max(ps.length, 1)}">${ps.map((p) => `<div class="ef-pac ${p.id === rec ? 'ef-pac-rec' : ''}">
          ${p.id === rec ? '<span class="ef-pac-selo">Indicado para você</span>' : ''}
          <div class="ef-pac-nome">${esc(p.nome)}</div>
          <div class="ef-pac-preco">${brl(p.preco)}<small>/mês</small></div>
          ${p.chamada ? `<div class="ef-pac-cham">${esc(p.chamada)}</div>` : ''}
          <ul>${lista(p.inclui).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          ${p.alinhamento ? `<div class="ef-pac-alin">${esc(p.alinhamento)}</div>` : ''}
        </div>`).join('')}</div>${s.nota ? `<div class="ef-nota">${br(s.nota)}</div>` : ''}</div>`;
    },
    encerramento(s) {
      return `<div class="ef-fim"><div class="ef-capa-glow"></div>${head(s)}${txt(s)}${pts(s, 'ef-pts-fim')}<img class="ef-fim-wm" src="${ORIGEM()}img/relatorio-wm.png" alt=""></div>`;
    },
  };
  TIPOS.nfc = TIPOS.texto;

  function ativos(d) { return (d.slides || []).filter((s) => s && s.ativo !== false); }

  function slides(d, pacotes) {
    const arr = ativos(d), tot = arr.length, emp = (d.cliente || {}).empresa || '';
    return arr.map((s, i) => {
      const f = TIPOS[s.tipo] || TIPOS.texto;
      const pe = s.tipo === 'capa' ? '' : `<div class="ef-foot"><img src="${ORIGEM()}img/relatorio-wm.png" alt=""><span>${esc(emp)}</span><span>${i + 1} / ${tot}</span></div>`;
      return `<section class="ef-slide ef-t-${esc(s.tipo || 'texto')}" data-i="${i}">${f(s, d, pacotes)}${pe}</section>`;
    }).join('');
  }

  function roteiro(d, pacotes) {
    const arr = ativos(d), c = d.cliente || {};
    const pac = (pacotes || []).find((p) => p.id === d.pacoteRecomendado);
    return `<div class="ef-rot"><h1>Roteiro da reunião · ${esc(c.empresa || c.nome || '')}</h1>
      <p class="ef-rot-sub">${esc(d.data || '')} · ${arr.length} slides${pac ? ` · pacote indicado: <b>${esc(pac.nome)} (${brl(pac.preco)}/mês)</b>` : ''}. Documento interno, não enviar ao cliente.</p>
      ${lista(d.notasInternas).length ? `<div class="ef-rot-box"><h3>Antes da reunião</h3><ul>${lista(d.notasInternas).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${(() => { const h = d.historico || {}, ch = (h.chamados || []).map((x) => (x && x.id) || x).filter((x) => typeof x === 'string' && x.trim()); return h.descricao || ch.length ? `<div class="ef-rot-box"><h3>Histórico do perfil</h3>${h.descricao ? `<p style="margin:4px 0">${br(h.descricao)}</p>` : ''}${ch.length ? `<p style="margin:4px 0"><b>Chamados:</b> ${ch.map(esc).join(' · ')}</p>` : ''}</div>` : ''; })()}
      ${arr.map((s, i) => `<div class="ef-rot-item"><div class="ef-rot-n">${i + 1}</div><div><div class="ef-rot-t">${esc(s.titulo || s.kicker || s.tipo)}</div>${s.fala ? `<div class="ef-rot-f">${br(s.fala)}</div>` : '<div class="ef-rot-f ef-rot-vazio">(sem roteiro)</div>'}</div></div>`).join('')}</div>`;
  }

  function documento(corpo, titulo, opt = {}) {
    const base = ORIGEM();
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="${base}css/entrega.css?v=2">
      <style>${opt.roteiro ? '@page{size:A4;margin:14mm}body{background:#fff}' : '@page{size:1280px 720px;margin:0}body{margin:0;background:#05030d}.ef-slide{break-after:page;page-break-after:always}'}</style></head>
      <body class="${opt.roteiro ? 'ef-print-rot' : 'ef-print'}">${corpo}
      <script>(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>Promise.all([].slice.call(document.images).map(i=>i.decode?i.decode().catch(()=>0):0))).then(()=>setTimeout(()=>window.print(),400));<\/script></body></html>`;
  }

  window.EntregaRender = { slides, roteiro, documento, ativos, TIPOS: Object.keys(TIPOS) };
})();
