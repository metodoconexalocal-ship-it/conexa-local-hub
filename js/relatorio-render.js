/* ═══════════════════════════════════════════════════════════════════════════
   Relatório do Perfil — renderizador (Antes → Aprovação → Prévia)
   Usado pela página do cliente (relatorio.html) e pela prévia no Hub.
   RelatorioRender.render(D, { app, nav, state, onState, onEnviar, enviado, modoPrevia })
   D = mesmo formato do dados.json do modelo (ver relatorio-perfil/COMO-USAR.md).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var img = function (src, alt, ph) { return src ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy">' : '<div class="ph-img">' + esc(ph ? '📷 ' + ph : 'sem imagem') + '</div>'; };
  var gimg = function (src, ph) { return src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<div class="gph">' + esc(ph || '') + '</div>'; };

  function render(D, o) {
    o = o || {};
    var root = o.app, navEl = o.nav;
    var C = D.cliente || {}, A = D.antes || null, P = D.aprovacao || null, V = D.previa || null;
    var parts = [], nav = [];
    var temAntes = A && ((A.prints || []).length || (A.pontos || []).length || (A.numeros || []).length);
    var itens = (P && P.itens) || [];
    var stepsDef = [
      temAntes && { id: 'antes', t: 'Como está hoje', d: 'O retrato do perfil antes do nosso trabalho.' },
      itens.length && { id: 'aprovacao', t: 'Para aprovar', d: itens.length + ' itens para você conferir e aprovar.' },
      V && { id: 'previa', t: 'Prévia no ar', d: 'Como o perfil vai aparecer para quem procura.' }
    ].filter(Boolean);

    parts.push('<section class="hero"><div class="wrap">' +
      '<div class="eyebrow">' + esc(D.tipo || 'Relatório do Perfil da Empresa no Google') + '</div>' +
      '<h1><span class="gt">' + esc(C.nome || 'Cliente') + '</span></h1>' +
      '<p class="lead">' + esc(D.introducao || 'Aqui está tudo o que vamos mudar no seu perfil: como ele está hoje, o que preparamos para você aprovar e uma prévia de como vai ficar no ar.') + '</p>' +
      '<div class="meta">' +
        (C.nicho ? '<span class="chip">Nicho <b>' + esc(C.nicho) + '</b></span>' : '') +
        (C.cidade ? '<span class="chip">Cidade <b>' + esc(C.cidade) + '</b></span>' : '') +
        (D.data ? '<span class="chip">Data <b>' + esc(D.data) + '</b></span>' : '') +
        (D.responsavel ? '<span class="chip">Feito por <b>' + esc(D.responsavel) + '</b></span>' : '') +
      '</div><div class="steps">' + stepsDef.map(function (s, i) {
        nav.push('<a href="#' + s.id + '">' + esc(s.t) + '</a>');
        return '<a class="step" href="#' + s.id + '"><div class="n gt">0' + (i + 1) + '</div><h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></a>';
      }).join('') + '</div></div></section>');

    if (temAntes) {
      var nota = A.nota;
      var pct = nota && nota.max ? Math.round(nota.atual / nota.max * 100) : null;
      var h = '<section class="part" id="antes"><div class="wrap"><div class="shead"><div><div class="eyebrow">Etapa 01</div><h2>Como o seu perfil está hoje</h2>' +
        (A.resumo ? '<p>' + esc(A.resumo) + '</p>' : '') + '</div>' +
        (pct != null ? '<div class="score"><div class="ring" style="--p:' + pct + '"><span class="num">' + pct + '%</span></div><div><b>' + esc(nota.atual) + ' de ' + esc(nota.max) + '</b><small>' + esc(nota.rotulo || 'itens bem preenchidos') + '</small></div></div>' : '') +
        '</div>';
      if ((A.numeros || []).length) {
        if (A.numerosTitulo) h += '<div class="subt">' + esc(A.numerosTitulo) + '</div>';
        h += '<div class="kpis">' + A.numeros.map(function (k) { return '<div class="kpi ' + esc(k.tom || '') + '"><b class="num">' + esc(k.valor) + '</b><span>' + esc(k.label) + '</span></div>'; }).join('') + '</div>';
      }
      if ((A.pontos || []).length) {
        if (A.pontosTitulo) h += '<div class="subt">' + esc(A.pontosTitulo) + '</div>';
        h += '<div class="legend"><span><i class="dot falta"></i>Faltando</span><span><i class="dot fraco"></i>Pode melhorar</span><span><i class="dot ok"></i>Está bom</span></div>';
        h += '<div class="pontos">' + A.pontos.map(function (p) { return '<div class="ponto"><i class="dot ' + esc(p.tipo || 'fraco') + '"></i><div>' + esc(p.texto) + '</div></div>'; }).join('') + '</div>';
      }
      if ((A.prints || []).length) {
        h += '<div class="subt">' + esc(A.printsTitulo || 'Os prints do perfil hoje (toque para ampliar)') + '</div><div class="prints">' + A.prints.map(function (p) {
          return '<button class="print" data-lb="' + esc(p.img || '') + '" data-cap="' + esc(p.titulo || '') + '"><div class="ph">' + img(p.img, p.titulo) + '</div><div class="cap"><b>' + esc(p.titulo || '') + '</b>' + (p.observacao ? '<span>' + esc(p.observacao) + '</span>' : '') + '</div></button>';
        }).join('') + '</div>';
      }
      parts.push(h + '</div></section>');
    }

    if (itens.length) {
      var renderVal = function (v, vazio) {
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '<div class="txt empty">' + esc(vazio || 'Não preenchido') + '</div>';
        if (Array.isArray(v)) return '<ul>' + v.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
        return '<div class="txt">' + esc(v) + '</div>';
      };
      var h2 = '<section class="part" id="aprovacao"><div class="wrap"><div class="shead"><div><div class="eyebrow">Etapa 02</div><h2>O que preparamos para você aprovar</h2>' +
        '<p>' + esc(P.instrucao || 'Confira cada item. Toque em “Aprovado” ou em “Quero ajustar” e escreva o que mudar. No fim, envie sua resposta.') + '</p></div></div><div class="items">';
      itens.forEach(function (it, i) {
        var code = it.id || ('A' + (i + 1)); it._code = code;
        h2 += '<article class="item" data-code="' + esc(code) + '"><div class="ih"><div><div class="code">ITEM ' + esc(code) + (it.secao ? ' · ' + esc(it.secao).toUpperCase() : '') + '</div><h3>' + esc(it.titulo) + '</h3></div></div>' +
          (it.porque ? '<p class="why">' + esc(it.porque) + '</p>' : '');
        if (it.antes !== undefined || it.depois !== undefined) {
          var cnt = typeof it.depois === 'string' && it.limite ? '<div class="cnt">' + it.depois.length + ' de ' + it.limite + ' caracteres</div>' : '';
          h2 += '<div class="cmp">' + (it.antes !== undefined ? '<div class="box"><div class="lbl">Hoje</div>' + renderVal(it.antes, 'Não existe hoje') + '</div>' : '') +
            '<div class="box new"><div class="lbl">Proposta</div>' + renderVal(it.depois) + cnt + '</div></div>';
        }
        if ((it.produtos || []).length) {
          h2 += '<div class="prods">' + it.produtos.map(function (p) {
            return '<div class="prod"><div class="pi">' + img(p.img, p.nome, p.foto) + '</div><div class="pb">' + (p.categoria ? '<div class="pc">' + esc(p.categoria) + '</div>' : '') + '<b>' + esc(p.nome) + '</b>' + (p.preco ? '<div class="pr">' + esc(p.preco) + '</div>' : '') + (p.descricao ? '<p>' + esc(p.descricao) + '</p>' : '') + '</div></div>';
          }).join('') + '</div>';
        }
        if ((it.imagens || []).length) {
          h2 += '<div class="gal">' + it.imagens.map(function (g) {
            var x = typeof g === 'string' ? { img: g } : g;
            return '<button class="g" data-lb="' + esc(x.img) + '" data-cap="' + esc(x.legenda || '') + '">' + img(x.img, x.legenda) + (x.legenda ? '<span>' + esc(x.legenda) + '</span>' : '') + '</button>';
          }).join('') + '</div>';
        }
        if (it.pergunta) h2 += '<div class="ask"><b>Precisamos da sua resposta</b>' + esc(it.pergunta) + '</div>';
        h2 += '<div class="act"><button class="btn ok" data-st="ok">✓ Aprovado</button><button class="btn aj" data-st="aj">✎ Quero ajustar</button></div>' +
          '<textarea class="note" placeholder="O que você quer mudar neste item? Se o item tem pergunta, responda aqui."></textarea></article>';
      });
      h2 += '</div><div id="sentbox"></div><div class="resp"><div class="bar"><b id="rcount">0 de ' + itens.length + '</b> itens respondidos <span class="saving" id="saving"></span><div class="track"><i id="rtrack"></i></div></div>' +
        (o.onEnviar ? '<button class="btn primary" id="enviar">Enviar minha aprovação</button>' : '') +
        '<button class="btn" id="copy">Copiar resposta</button><span class="toast" id="toast"></span></div></div></section>';
      parts.push(h2);
    }

    if (V) {
      var fotos = V.fotos || [], prods = V.produtos || [], cats = [];
      prods.forEach(function (p) { var c = p.categoria || 'Produtos'; if (cats.indexOf(c) < 0) cats.push(c); });
      var stars = function (n) { n = parseFloat(String(n).replace(',', '.')) || 0; var s = ''; for (var i = 1; i <= 5; i++) s += i <= Math.round(n) ? '★' : '☆'; return s; };
      var tabs = [['visao', 'Visão geral'], prods.length && ['produtos', 'Produtos'], (V.servicos || []).length && ['servicos', 'Serviços'], fotos.length && ['fotos', 'Fotos'], (V.posts || []).length && ['posts', 'Atualizações']].filter(Boolean);
      var aba = V.abaInicial || (prods.length ? 'produtos' : 'visao');
      var ph = V.fotosSugeridas || [];
      var h3 = '<section class="part" id="previa"><div class="wrap"><div class="prev"><div class="side"><div class="eyebrow">Etapa 03</div>' +
        '<h2 style="font-size:clamp(1.5rem,3.4vw,2.1rem);margin-top:8px">Prévia: o seu perfil no ar</h2>' +
        '<p>' + esc(V.texto || 'Uma simulação de como o perfil vai aparecer depois das mudanças aprovadas. Toque nas abas do celular para navegar, e nos produtos para ver os detalhes.') + '</p>' +
        ((V.destaques || []).length ? '<ul>' + V.destaques.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
        '<p style="font-size:.8rem;color:var(--dim);margin-top:18px">Simulação feita pela Conexa Local. O visual real muda um pouco conforme o aparelho e as atualizações do Google.</p></div>' +
        '<div class="phone"><div class="screen-wrap"><div class="screen"><div class="sim">PRÉVIA · SIMULAÇÃO</div><div class="scr">' +
        '<div class="cover">' + [0, 1, 2].map(function (i) { return '<div>' + gimg(i === 0 ? (V.capa || fotos[0]) : fotos[i], ph[i]) + '</div>'; }).join('') + '</div>' +
        '<div class="ghead">' + (V.logo || V.logoTexto ? '<div class="glogo">' + (V.logo ? gimg(V.logo) : '<div class="gph" style="font-weight:700;font-size:13px;color:#5f6368">' + esc(V.logoTexto) + '</div>') + '</div>' : '') +
        '<div><div class="gname">' + esc(V.nome || C.nome) + '</div>' +
        (V.nota ? '<div class="grate"><b>' + esc(V.nota) + '</b> <span class="st">' + stars(V.nota) + '</span> (' + esc(V.avaliacoes || 0) + ')</div>' : '') +
        '<div class="grate">' + esc(V.categoria || '') + (V.cidade || C.cidade ? ' · ' + esc(V.cidade || C.cidade) : '') + '</div></div></div>' +
        '<div class="gbtns"><span>Rotas</span><span>Ligar</span>' + (V.site ? '<span>Site</span>' : '') + '<span>Salvar</span><span>Compartilhar</span></div>' +
        '<div class="gtabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '"' + (t[0] === aba ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>';
      h3 += '<div class="gpane' + (aba === 'visao' ? ' on' : '') + '" data-pane="visao">' +
        (V.descricao ? '<div class="gdesc"><h4>Da empresa</h4><p>' + esc(V.descricao) + '</p></div>' : '') +
        (V.endereco ? '<div class="grow"><span class="ic">⌖</span><div>' + esc(V.endereco) + '</div></div>' : '') +
        (V.horario ? '<div class="grow"><span class="ic">◷</span><div>' + esc(V.horario) + '</div></div>' : '') +
        (V.telefone ? '<div class="grow"><span class="ic">✆</span><div>' + esc(V.telefone) + '</div></div>' : '') +
        (V.site ? '<div class="grow"><span class="ic">⊕</span><div style="color:#1a73e8">' + esc(V.site) + '</div></div>' : '') +
        ((V.atributos || []).length ? '<div class="grow"><span class="ic">✓</span><div>' + V.atributos.map(esc).join(' · ') + '</div></div>' : '') + '</div>';
      if (prods.length) {
        h3 += '<div class="gpane' + (aba === 'produtos' ? ' on' : '') + '" data-pane="produtos"><div class="gsec" style="padding-bottom:8px"><h4>Produtos</h4></div>' +
          (cats.length > 1 ? '<div class="gcats"><button class="on" data-cat="">Todos</button>' + cats.map(function (c) { return '<button data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') +
          '<div class="gprods">' + prods.map(function (p, i) {
            return '<button class="gprod" data-pi="' + i + '" data-c="' + esc(p.categoria || 'Produtos') + '"><div class="gi">' + gimg(p.img, p.foto) + '</div><div class="gt2">' + esc(p.nome) + (p.preco ? '<div class="gp">' + esc(p.preco) + '</div>' : '') + '</div></button>';
          }).join('') + '</div></div>';
      }
      if ((V.servicos || []).length) {
        h3 += '<div class="gpane' + (aba === 'servicos' ? ' on' : '') + '" data-pane="servicos"><div class="gsec" style="padding-bottom:0"><h4>Serviços</h4></div>' + V.servicos.map(function (s) {
          return '<div class="gserv"><b>' + esc(s.nome) + '</b>' + (s.preco ? '<span>' + esc(s.preco) + '</span>' : '') + (s.descricao ? '<div style="color:#5f6368;font-size:13px;margin-top:3px">' + esc(s.descricao) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      }
      if (fotos.length) h3 += '<div class="gpane" data-pane="fotos"><div class="gfotos">' + fotos.map(function (f) { return '<div>' + gimg(f) + '</div>'; }).join('') + '</div></div>';
      if ((V.posts || []).length) {
        h3 += '<div class="gpane" data-pane="posts">' + V.posts.map(function (p) {
          return '<div class="gpost">' + (p.img ? '<img src="' + esc(p.img) + '" alt="">' : (p.foto ? '<div class="gph" style="aspect-ratio:4/3">📷 ' + esc(p.foto) + '</div>' : '')) + '<div class="gpb">' + (p.data ? '<div class="gpd">' + esc(p.data) + '</div>' : '') + esc(p.texto || '') + (p.botao ? '<br><span class="gcta">' + esc(p.botao) + '</span>' : '') + '</div></div>';
        }).join('') + '</div>';
      }
      h3 += '</div></div><div class="gmodal"><div class="gm"></div></div></div></div></div></div></section>';
      parts.push(h3);
    }

    root.innerHTML = parts.join('') + '<div class="lb"><div><img alt=""><p></p></div></div>';
    if (navEl) navEl.innerHTML = nav.join('');

    // lightbox
    var lb = root.querySelector('.lb');
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lb]');
      if (t && t.getAttribute('data-lb')) { lb.querySelector('img').src = t.getAttribute('data-lb'); lb.querySelector('p').textContent = t.getAttribute('data-cap') || ''; lb.classList.add('on'); }
    });
    lb.addEventListener('click', function () { lb.classList.remove('on'); });

    // aprovação
    if (itens.length) {
      var state = o.state || {};
      var enviado = !!o.enviado;
      var msg = function () {
        var ok = [], aj = [], pend = [];
        itens.forEach(function (it) {
          var s = state[it._code] || {};
          if (s.st === 'ok') ok.push(it._code + (s.nota ? ' (' + s.nota + ')' : ''));
          else if (s.st === 'aj') aj.push('• ' + it._code + ' ' + it.titulo + (s.nota ? ': ' + s.nota : ''));
          else pend.push(it._code);
        });
        var t = 'Aprovação do perfil – ' + (C.nome || '') + '\n\n';
        if (ok.length) t += '✅ Aprovados: ' + ok.join(', ') + '\n';
        if (aj.length) t += '\n✏️ Ajustes:\n' + aj.join('\n') + '\n';
        if (pend.length) t += '\n⏳ Sem resposta: ' + pend.join(', ') + '\n';
        return t;
      };
      var showSent = function () {
        var sb = root.querySelector('#sentbox');
        sb.innerHTML = enviado ? '<div class="sentbox"><b>Resposta enviada. Obrigado!</b><br>A equipe da Conexa Local já recebeu. Se mudar de ideia em algum item, é só ajustar aqui e enviar de novo.</div>' : '';
      };
      var refresh = function () {
        var n = 0;
        root.querySelectorAll('.item').forEach(function (el) {
          var s = state[el.getAttribute('data-code')] || {};
          el.classList.toggle('st-ok', s.st === 'ok'); el.classList.toggle('st-aj', s.st === 'aj');
          el.querySelector('.btn.ok').classList.toggle('on', s.st === 'ok');
          el.querySelector('.btn.aj').classList.toggle('on', s.st === 'aj');
          if (s.st) n++;
        });
        root.querySelector('#rcount').textContent = n + ' de ' + itens.length;
        root.querySelector('#rtrack').style.width = (n / itens.length * 100) + '%';
      };
      var mudou = function () { refresh(); if (o.onState) o.onState(state, root.querySelector('#saving')); };
      root.querySelectorAll('.item').forEach(function (el) {
        var code = el.getAttribute('data-code'), ta = el.querySelector('.note');
        ta.value = (state[code] && state[code].nota) || '';
        if (ta.value) ta.style.display = 'block';
        el.querySelectorAll('[data-st]').forEach(function (b) {
          b.addEventListener('click', function () {
            var s = state[code] || {}; var v = b.getAttribute('data-st');
            s.st = s.st === v ? null : v; state[code] = s; mudou();
            if (s.st === 'aj') ta.focus();
          });
        });
        ta.addEventListener('input', function () { state[code] = state[code] || {}; state[code].nota = ta.value; mudou(); });
      });
      root.querySelector('#copy').addEventListener('click', function () {
        var t = msg(), toast = root.querySelector('#toast');
        var done = function () { toast.textContent = 'Copiado!'; setTimeout(function () { toast.textContent = ''; }, 3000); };
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { prompt('Copie sua resposta:', t); }); else prompt('Copie sua resposta:', t);
      });
      var envBtn = root.querySelector('#enviar');
      if (envBtn) envBtn.addEventListener('click', function () {
        var n = Object.keys(state).filter(function (k) { return state[k] && state[k].st; }).length;
        if (n < itens.length && !confirm('Faltam ' + (itens.length - n) + ' itens sem resposta. Enviar assim mesmo?')) return;
        envBtn.disabled = true; envBtn.textContent = 'Enviando…';
        Promise.resolve(o.onEnviar(state, msg())).then(function () {
          enviado = true; showSent(); envBtn.disabled = false; envBtn.textContent = 'Enviar de novo';
          root.querySelector('#sentbox').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, function (e) { envBtn.disabled = false; envBtn.textContent = 'Enviar minha aprovação'; alert('Não foi possível enviar agora. Tente de novo ou use “Copiar resposta”.\n\n' + (e && e.message || '')); });
      });
      if (enviado && envBtn) envBtn.textContent = 'Enviar de novo';
      refresh(); showSent();
    }

    // prévia
    if (V) {
      var prodsV = V.produtos || [];
      root.querySelectorAll('.gtabs button').forEach(function (b) {
        b.addEventListener('click', function () {
          root.querySelectorAll('.gtabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
          root.querySelectorAll('.gpane').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === b.getAttribute('data-tab')); });
        });
      });
      root.querySelectorAll('.gcats button').forEach(function (b) {
        b.addEventListener('click', function () {
          var c = b.getAttribute('data-cat');
          root.querySelectorAll('.gcats button').forEach(function (x) { x.classList.toggle('on', x === b); });
          root.querySelectorAll('.gprod').forEach(function (p) { p.style.display = !c || p.getAttribute('data-c') === c ? '' : 'none'; });
        });
      });
      var gm = root.querySelector('.gmodal'), gmc = root.querySelector('.gm');
      root.querySelectorAll('.gprod').forEach(function (b) {
        b.addEventListener('click', function () {
          var p = prodsV[+b.getAttribute('data-pi')];
          gmc.innerHTML = (p.img ? '<img src="' + esc(p.img) + '" alt="">' : '') + '<div class="gmb"><button class="gx" aria-label="Fechar">✕</button><h5>' + esc(p.nome) + '</h5>' +
            (p.preco ? '<div style="margin-top:4px;color:#202124">' + esc(p.preco) + '</div>' : '') + (p.categoria ? '<div style="color:#70757a;font-size:13px;margin-top:2px">' + esc(p.categoria) + '</div>' : '') +
            (p.descricao ? '<p style="color:#3c4043;font-size:13.5px">' + esc(p.descricao) + '</p>' : '') + (p.botao ? '<span style="color:#1a73e8;font-weight:600;font-size:13px">' + esc(p.botao) + '</span>' : '') + '</div>';
          gm.classList.add('on');
        });
      });
      gm.addEventListener('click', function (e) { if (e.target === gm || e.target.closest('.gx')) gm.classList.remove('on'); });
    }
  }

  // Troca "img:<id>" por data URLs buscando na coleção de imagens (getImg: id → Promise<dataUrl>)
  async function resolverImagens(D, getImg) {
    var ids = [];
    (function walk(v) {
      if (typeof v === 'string') { if (v.indexOf('img:') === 0) ids.push(v.slice(4)); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(D);
    var mapa = {};
    await Promise.all(ids.filter(function (x, i) { return ids.indexOf(x) === i; }).map(function (id) {
      return Promise.resolve(getImg(id)).then(function (u) { mapa[id] = u || ''; }, function () { mapa[id] = ''; });
    }));
    return (function tr(v) {
      if (typeof v === 'string') return v.indexOf('img:') === 0 ? mapa[v.slice(4)] : v;
      if (Array.isArray(v)) return v.map(tr);
      if (v && typeof v === 'object') { var r = {}; Object.keys(v).forEach(function (k) { r[k] = tr(v[k]); }); return r; }
      return v;
    })(D);
  }

  window.RelatorioRender = { render: render, resolverImagens: resolverImagens, esc: esc };
})();
