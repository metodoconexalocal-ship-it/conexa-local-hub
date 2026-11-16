/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Visual do Diagnóstico (mesmo modelo da Central de Diagnósticos)
   DiagRender.html(d)       → relatório para mostrar dentro do Hub (tema escuro Conexa)
   DiagRender.documento(d)  → página completa, tema claro, pronta para imprimir/salvar em PDF
   "d" é o objeto "diagnostico" do JSON gerado pelo Claude (central-conexa/diagnosticos/*.json).
   Seções opcionais (avaliacoes, buscas, concorrencia.tabela, onboarding) só aparecem quando existem.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arr = (v) => (Array.isArray(v) ? v : []);
  const ORIGEM = () => (typeof location !== 'undefined' && /^https?:/.test(location.origin) ? location.origin + '/' : '');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataLonga = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : esc(iso); };
  const dataCurta = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso); };

  const STAGES = [
    { k: 'encontrado', eixo: 'Estratégia', t: 'Ser encontrado', q: 'Eu encontrei essa empresa?' },
    { k: 'compreendido', eixo: 'Estrutura', t: 'Ser compreendido', q: 'Eu entendi o que ela faz?' },
    { k: 'valorizado', eixo: 'Comunicação', t: 'Ser valorizado', q: 'Eu percebi por que ela vale mais?' },
    { k: 'escolhido', eixo: 'Percepção', t: 'Ser escolhido', q: 'Eu confio o suficiente para chamar?' },
  ];
  const NIVEL = { 1: 'Crítico', 2: 'Precisa de atenção', 3: 'Razoável', 4: 'Forte' };
  const GRAV = { critica: ['Crítica', 'c-crit'], alta: ['Alta', 'c-high'], media: ['Média', 'c-med'], baixa: ['Baixa', 'c-low'] };
  const POT = { alto: ['Alto', 'c-ok'], medio: ['Médio', 'c-med'], baixo: ['Baixo', 'c-low'] };
  const MARK = { ok: ['✓', 'c-ok'], atencao: ['!', 'c-med'], critico: ['✕', 'c-crit'] };

  const CSS = `
.dg-report{--bg:#05030d;--bg2:#0a0820;--card:#0f0d24;--border:rgba(167,96,253,.14);--border-hi:rgba(167,96,253,.34);--text:#f0ecfb;--muted:#b2accf;--dim:#7872a0;--accent:#a760fd;--cyan:#65e7f3;--soft:rgba(167,96,253,.10);--crit:#ff6b81;--high:#ffa94d;--med:#ffc83d;--ok:#4ade80;--grad:linear-gradient(135deg,#a760fd,#65e7f3);--gtext:linear-gradient(130deg,#c084fc,#67e8f9);--bar:rgba(178,172,207,.35);--track:rgba(255,255,255,.06);
  background:var(--bg);color:var(--text);font-family:'Inter',system-ui,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;border-radius:18px;overflow:hidden;border:1px solid var(--border);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.dg-report.light{--bg:#fff;--bg2:#f3f0fc;--card:#faf9fe;--border:rgba(110,60,200,.16);--border-hi:rgba(124,58,237,.35);--text:#17132b;--muted:#4e4870;--dim:#77719b;--accent:#7c3aed;--cyan:#0b8fa0;--soft:rgba(124,58,237,.07);--crit:#d23250;--high:#cf6a12;--med:#a77905;--ok:#15913f;--gtext:linear-gradient(130deg,#7c3aed,#0b8fa0);--bar:rgba(78,72,112,.28);--track:rgba(23,19,43,.07);border:0;border-radius:0}
.dg-report *{box-sizing:border-box}
.dg-report h1,.dg-report h2,.dg-report h3{font-family:'Sora','Inter',system-ui,sans-serif;line-height:1.15;letter-spacing:-.02em;margin:0}
.dg-report p{margin:0}
.dg-report .num{font-variant-numeric:tabular-nums}
.dg-wrap{padding-left:34px;padding-right:34px}
.dg-eyebrow{display:inline-flex;font-family:'Sora',sans-serif;font-weight:600;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);background:var(--soft);border:1px solid var(--border-hi);padding:5px 13px;border-radius:100px;justify-self:start}
.dg-gtext{background:var(--gtext);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.dg-cover{background:radial-gradient(circle at 92% -10%,rgba(167,96,253,.38),transparent 45%),#05030d;color:#f0ecfb}
.dg-cover .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:18px;padding-bottom:18px;border-bottom:1px solid rgba(167,96,253,.14);flex-wrap:wrap}
.dg-cover .logo{display:flex;align-items:center;gap:9px}.dg-cover .logo img{display:block;width:auto}
.dg-cover .meta{color:#7872a0;font-size:12px;text-align:right}
.dg-cover .body{display:grid;gap:14px;padding-top:30px;padding-bottom:30px}
.dg-cover .dg-eyebrow{color:#a760fd;background:rgba(167,96,253,.10);border-color:rgba(167,96,253,.32)}
.dg-cover h1{font-size:30px;font-weight:800}
.dg-cover .dg-gtext{background:linear-gradient(130deg,#c084fc,#67e8f9);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.dg-cover .lede{color:#b2accf;font-size:15px;max-width:66ch}
.dg-facts{display:flex;flex-wrap:wrap;gap:6px 18px;color:#b2accf;font-size:12.5px}.dg-facts b{color:#f0ecfb}
.dg-sec{padding-top:28px;padding-bottom:28px;border-top:1px solid var(--border)}
.dg-head{display:grid;gap:9px;margin-bottom:18px}.dg-head h2{font-size:21px}.dg-head p{color:var(--muted);max-width:68ch}
.dg-box{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;min-width:0}
.dg-box.hl{border-color:var(--border-hi);background:linear-gradient(160deg,var(--soft),var(--card) 60%)}
.dg-box h3{font-size:15px;margin-bottom:10px}
.dg-verdict{display:grid;grid-template-columns:1.1fr 1fr;gap:14px}
.dg-verdict .big{font-family:'Sora',sans-serif;font-weight:800;font-size:20px;line-height:1.2;margin-bottom:8px}
.dg-verdict .sub{color:var(--muted)}
.dg-verdict .strength{margin-top:14px;padding-top:14px;border-top:1px solid var(--border);color:var(--muted)}.dg-verdict .strength b{color:var(--cyan)}
.dg-prio{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.dg-prio li{display:grid;grid-template-columns:28px 1fr;gap:10px}
.dg-prio .n{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:700;color:#fff;background:var(--grad)}
.dg-prio b{display:block}.dg-prio span{color:var(--muted);font-size:13px}
.dg-stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.dg-stage{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;display:grid;gap:7px;align-content:start}
.dg-stage .axis{color:var(--cyan);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.dg-stage h3{font-size:15px}.dg-stage .q{color:var(--dim);font-size:12px;font-style:italic}.dg-stage p{color:var(--muted);font-size:12.5px}
.dg-meter{display:flex;gap:4px}.dg-meter i{flex:1;height:6px;border-radius:3px;background:var(--track)}.dg-meter i.f{background:currentColor}
.lv1{color:var(--crit)}.lv2{color:var(--high)}.lv3{color:var(--med)}.lv4{color:var(--ok)}
.dg-state{font-size:11.5px;font-weight:600}
.dg-tbl{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--card);margin-bottom:10px}
.dg-report table{width:100%;border-collapse:collapse;font-size:13px}
.dg-report th,.dg-report td{text-align:left;padding:10px 13px;vertical-align:top;border-bottom:1px solid var(--border)}
.dg-report th{font-family:'Sora',sans-serif;font-weight:600;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);background:var(--bg2)}
.dg-report tr:last-child td{border-bottom:0}.dg-report td{color:var(--muted)}.dg-report td:first-child{color:var(--text);font-weight:500}
.dg-report tr.me td{background:var(--soft)}
.dg-chip{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:100px;white-space:nowrap;border:1px solid currentColor}
.c-crit{color:var(--crit)}.c-high{color:var(--high)}.c-med{color:var(--med)}.c-low{color:var(--dim)}.c-ok{color:var(--ok)}
.dg-mark{display:inline-block;width:16px;font-weight:700}
.dg-bars{display:grid;gap:9px}
.dg-bar{display:grid;grid-template-columns:minmax(0,240px) 1fr 50px;gap:12px;align-items:center;font-size:13px}
.dg-bar .name{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg-bar .track,.dg-dist .track{height:12px;border-radius:6px;background:var(--track);overflow:hidden;display:block}
.dg-bar .fill,.dg-dist .fill{height:100%;border-radius:6px;background:var(--bar);display:block}
.dg-bar .val{text-align:right;font-weight:600}
.dg-bar.cliente .name{color:var(--text);font-weight:600}.dg-bar.cliente .fill{background:var(--grad);min-width:5px}.dg-bar.cliente .val{color:var(--cyan)}
.dg-bar.referencia .fill{background:rgba(101,231,243,.4)}
.dg-note{color:var(--dim);font-size:12.5px;margin-top:14px;max-width:72ch}
.dg-callout{margin-top:16px;padding:14px 16px;border-radius:12px;border:1px solid var(--border-hi);background:var(--soft);color:var(--muted)}.dg-callout b{color:var(--text)}
.dg-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.dg-kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:grid;gap:3px}
.dg-kpi .v{font-family:'Sora',sans-serif;font-weight:700;font-size:22px;line-height:1.1}.dg-kpi .l{color:var(--muted);font-size:12px}
.dg-kpi.alert .v{color:var(--crit)}.dg-kpi.good .v{color:var(--ok)}
.dg-dist{display:grid;gap:6px;margin-top:14px}
.dg-dist .row{display:grid;grid-template-columns:32px 1fr 70px;gap:10px;align-items:center;font-size:12.5px}
.dg-dist .row span:first-child{color:var(--muted)}.dg-dist .val{text-align:right;font-weight:600}
.dg-dist .fill{background:var(--grad);min-width:3px}.dg-dist .row.neg .fill{background:rgba(255,107,129,.55)}
.dg-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.dg-themes{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.dg-themes li{display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:8px;font-size:13px;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:7px}
.dg-themes li:last-child{border-bottom:0}.dg-themes li b{text-align:right;color:var(--text)}
.dg-chips{display:flex;flex-wrap:wrap;gap:6px}.dg-chips span{font-size:12px;padding:3px 10px;border-radius:100px;border:1px solid var(--border-hi);background:var(--soft);color:var(--text)}.dg-chips small{color:var(--dim);margin-left:4px}
.dg-subh{font-family:'Sora',sans-serif;font-weight:600;font-size:14px;margin:18px 0 10px}
.dg-pos{font-weight:700}.dg-pos.p1{color:var(--ok)}.dg-pos.p2{color:var(--med)}.dg-pos.p3{color:var(--high)}.dg-pos.p0{color:var(--crit)}
.dg-plan{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.dg-plan h3{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.dg-plan h3 small{font-family:'Inter',sans-serif;font-weight:500;font-size:11px;color:var(--dim)}
.dg-tasks{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.dg-tasks li{display:grid;gap:2px;padding-bottom:10px;border-bottom:1px solid var(--border)}.dg-tasks li:last-child{border-bottom:0;padding-bottom:0}
.dg-tasks b{font-size:13.5px}.dg-tasks span{color:var(--muted);font-size:12.5px}
.dg-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px}.dg-tag{font-size:10.5px;padding:1px 8px;border-radius:100px;background:var(--track);color:var(--muted)}
.dg-check{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}
.dg-check li{display:grid;grid-template-columns:16px 1fr;gap:8px;font-size:13px;color:var(--muted)}
.dg-check li::before{content:"";width:13px;height:13px;border:1.5px solid var(--accent);border-radius:4px;margin-top:4px}
.dg-foot{border-top:1px solid var(--border);padding-top:20px;padding-bottom:24px;color:var(--dim);font-size:12px;display:grid;gap:10px}
@media (max-width:820px){.dg-verdict,.dg-plan,.dg-cols,.dg-check{grid-template-columns:1fr}.dg-stages,.dg-kpis{grid-template-columns:1fr 1fr}.dg-wrap{padding-left:18px;padding-right:18px}}
.dg-report.light .dg-stages{grid-template-columns:repeat(4,minmax(0,1fr))}
.dg-report.light .dg-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
.dg-report.light .dg-verdict,.dg-report.light .dg-plan,.dg-report.light .dg-cols,.dg-report.light .dg-check{grid-template-columns:1fr 1fr}
`;

  function head(eyebrow, titulo, texto) {
    return `<div class="dg-head"><span class="dg-eyebrow">${esc(eyebrow)}</span><h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}</div>`;
  }
  const table = (cols, rows) => (rows.length ? `<div class="dg-tbl"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '');

  function corpo(d) {
    const p = d.perfil || {}, m = d.manchete || {}, v = d.veredito || {}, e = d.etapas || {}, c = d.concorrencia || {}, pl = d.plano || {};
    const itens = arr(c.itens), max = Math.max(1, ...itens.map((i) => +i.avaliacoes || 0));
    const prio = arr(d.prioridades).map((x, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(x.titulo)}</b><span>${esc(x.texto)}</span></div></li>`).join('');
    const stages = STAGES.map((s) => { const x = e[s.k] || {}; const n = Math.min(4, Math.max(1, +x.nivel || 1));
      return `<div class="dg-stage"><span class="axis">${s.eixo}</span><h3>${s.t}</h3><span class="q">"${s.q}"</span><div class="dg-meter lv${n}">${[1, 2, 3, 4].map((i) => `<i${i <= n ? ' class="f"' : ''}></i>`).join('')}</div><span class="dg-state lv${n}">${NIVEL[n]}</span><p>${esc(x.texto)}</p></div>`; }).join('');
    const raiox = arr(d.raiox).map((r) => { const mk = MARK[r.status] || MARK.atencao; return `<tr><td>${esc(r.item)}</td><td class="num">${esc(r.situacao)}</td><td><span class="dg-mark ${mk[1]}">${mk[0]}</span>${esc(r.leitura)}</td></tr>`; });
    const probs = arr(d.problemas).map((r) => { const g = GRAV[r.gravidade] || GRAV.media; return `<tr><td>${esc(r.onde)}</td><td>${esc(r.problema)}</td><td><span class="dg-chip ${g[1]}">${g[0]}</span></td><td>${esc(r.correcao)}</td></tr>`; });
    const kws = arr(d.palavras).map((r) => { const pt = POT[r.potencial] || POT.medio; return `<tr><td>${esc(r.busca)}</td><td>${esc(r.concorrencia)}</td><td><span class="dg-chip ${pt[1]}">${pt[0]}</span></td><td>${esc(r.onde)}</td></tr>`; });
    const bars = itens.map((i) => { const n = +i.avaliacoes || 0, tipo = ['cliente', 'referencia'].includes(i.tipo) ? i.tipo : 'concorrente';
      return `<div class="dg-bar ${tipo}"><span class="name">${esc(i.nome)}</span><span class="track"><span class="fill" style="width:${(n / max * 100).toFixed(1)}%"></span></span><span class="val num">${n.toLocaleString('pt-BR')}</span></div>`; }).join('');
    const tasks = (l) => arr(l).map((t) => `<li><b>${esc(t.titulo)}</b><span>${esc(t.texto)}</span><div class="dg-tags">${t.impacto ? `<span class="dg-tag">${esc(t.impacto)}</span>` : ''}${t.esforco ? `<span class="dg-tag">${esc(t.esforco)}</span>` : ''}</div></li>`).join('');
    const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '–');

    const av = d.avaliacoes;
    let secAv = '';
    if (av) {
      const dist = arr(av.distribuicao), dmax = Math.max(1, ...dist.map((n) => +n || 0));
      const distRows = [5, 4, 3, 2, 1].map((n) => { const x = +dist[n - 1] || 0; return `<div class="row${n <= 3 ? ' neg' : ''}"><span>${n} ★</span><span class="track"><span class="fill" style="width:${(x / dmax * 100).toFixed(1)}%"></span></span><span class="val num">${x} · ${pct(x, av.total)}</span></div>`; }).join('');
      const per = arr(av.periodos).map((q) => `<tr><td>${esc(q.label)}</td><td class="num">${esc(q.n)}</td><td class="num">${esc(String(q.media).replace('.', ','))}</td><td class="num">${esc(q.neg)}</td><td class="num">${esc(q.resp)} de ${esc(q.n)} <span class="${+q.resp / Math.max(1, +q.n) < 0.2 ? 'c-crit' : 'c-ok'}" style="font-weight:700;margin-left:4px">${pct(+q.resp, +q.n)}</span></td></tr>`);
      const temas = (l) => `<ul class="dg-themes">${arr(l).map((t) => `<li><span>${esc(t.tema)}</span><b class="num">${esc(t.n)}</b></li>`).join('')}</ul>`;
      const kp = arr(av.kpis).map((k) => `<div class="dg-kpi ${['alert', 'good'].includes(k.tom) ? k.tom : ''}"><span class="v num">${esc(k.valor)}</span><span class="l">${esc(k.label)}</span></div>`).join('');
      secAv = `<section class="dg-sec">${head('Avaliações', av.titulo || 'O que os clientes dizem', av.texto)}
        ${kp ? `<div class="dg-kpis">${kp}</div>` : ''}<div class="dg-dist">${distRows}</div>
        ${av.destaque ? `<div class="dg-callout"><b>Atenção:</b> ${esc(av.destaque)}</div>` : ''}
        ${per.length ? `<p class="dg-subh">Avaliações e respostas por período</p>${table(['Quando', 'Avaliações', 'Nota média', 'Negativas (1–3★)', 'Respondidas'], per)}` : ''}
        <div class="dg-cols"><div class="dg-box"><h3>Mais elogiado (4–5★)</h3>${temas(av.temasPositivos)}</div><div class="dg-box"><h3>Mais criticado (1–3★)</h3>${temas(av.temasNegativos)}</div></div>
        ${arr(av.termos).length ? `<p class="dg-subh">Termos que os clientes mais usam</p><div class="dg-chips">${arr(av.termos).map((t) => `<span>${esc(t.termo)}<small>${esc(t.n)}</small></span>`).join('')}</div>${av.termosNota ? `<p class="dg-note">${esc(av.termosNota)}</p>` : ''}` : ''}
      </section>`;
    }
    const posCls = (s) => { const n = parseInt(s, 10); return !n ? 'p0' : n === 1 ? 'p1' : n <= 3 ? 'p2' : 'p3'; };
    const bs = arr(d.buscas);
    const secBuscas = bs.length ? `<section class="dg-sec">${head('Buscas no Google', d.buscasTitulo || 'Onde o perfil aparece hoje', d.buscasTexto)}${table(['Busca', 'Posição do perfil', 'Quem aparece antes'], bs.map((b) => `<tr><td>${esc(b.busca)}</td><td><span class="dg-pos ${posCls(b.posicao)}">${esc(b.posicao)}</span></td><td>${esc(b.lider)}</td></tr>`))}</section>` : '';
    const tab = arr(c.tabela);
    const secTab = tab.length ? `<p class="dg-subh">${esc(c.tabelaTitulo || 'Comparativo')}</p>${table(['Perfil', 'Nota', 'Avaliações', 'Últimos ~2 anos', 'Nota recente', 'Respondidas', 'Leitura'], tab.map((t) => `<tr${t.tipo === 'cliente' ? ' class="me"' : ''}><td>${esc(t.nome)}</td><td class="num">${esc(t.nota)}</td><td class="num">${esc(t.avaliacoes)}</td><td class="num">${esc(t.recentes)}</td><td class="num">${esc(t.mediaRecente)}</td><td class="num">${esc(t.respRecentes)}</td><td>${esc(t.leitura)}</td></tr>`))}` : '';
    const ob = arr(d.onboarding);
    const secOb = ob.length ? `<section class="dg-sec">${head('Onboarding', d.onboardingTitulo || 'O que confirmar com o acesso ao painel', d.onboardingTexto)}<div class="dg-box"><ul class="dg-check">${ob.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>` : '';

    const sym = ORIGEM() + 'img/relatorio-sym.png', wm = ORIGEM() + 'img/relatorio-wm.png';
    return `
    <div class="dg-cover">
      <div class="dg-wrap bar"><div class="logo"><img src="${sym}" alt="" style="height:32px"><img src="${wm}" alt="CONEXA LOCAL" style="height:19px"></div><div class="meta">Diagnóstico de Posicionamento Local<br>${dataLonga(d.data)}</div></div>
      <div class="dg-wrap body">
        <span class="dg-eyebrow">Perfil da Empresa no Google</span>
        <h1>${esc(m.titulo)} <span class="dg-gtext">${esc(m.destaque)}</span></h1>
        <p class="lede">${esc(m.texto)}</p>
        <div class="dg-facts">${p.endereco ? `<span><b>Endereço:</b> ${esc(p.endereco)}</span>` : ''}${p.categoria ? `<span><b>Categoria:</b> ${esc(p.categoria)}</span>` : ''}<span class="num"><b>Nota:</b> ${esc(p.nota)} com ${esc(p.avaliacoes)} avaliações</span>${p.fotos !== undefined && p.fotos !== '' ? `<span class="num"><b>Fotos:</b> ${esc(p.fotos)}</span>` : ''}</div>
      </div>
    </div>
    <div class="dg-wrap">
      <section class="dg-sec" style="border-top:0"><div class="dg-verdict">
        <div class="dg-box hl"><p class="big">${esc(v.titulo)}</p><p class="sub">${esc(v.texto)}</p>${v.ativo ? `<p class="strength"><b>Maior ativo:</b> ${esc(v.ativo)}</p>` : ''}</div>
        <div class="dg-box"><h3>As ${arr(d.prioridades).length} prioridades</h3><ol class="dg-prio">${prio}</ol></div>
      </div></section>
      <section class="dg-sec">${head('Método Conexa Local™', 'Onde o perfil está em cada etapa da escolha', 'O cliente percorre quatro etapas antes de chamar. ' + (e.resumo || ''))}<div class="dg-stages">${stages}</div></section>
      ${raiox.length ? `<section class="dg-sec">${head('Raio-X', 'O que o perfil mostra hoje', '')}${table(['Item', 'Situação', 'Leitura'], raiox)}</section>` : ''}
      ${secAv}
      ${probs.length ? `<section class="dg-sec">${head('Pontos de correção', 'O que está segurando o perfil', 'Ordenado pela gravidade.')}${table(['Onde', 'Problema', 'Gravidade', 'Como corrigir'], probs)}</section>` : ''}
      ${secBuscas}
      ${itens.length || tab.length ? `<section class="dg-sec">${head('Concorrência', c.titulo || 'Concorrência no Google Maps', c.texto)}${bars ? `<div class="dg-bars">${bars}</div>` : ''}${c.nota ? `<p class="dg-note">${esc(c.nota)}</p>` : ''}${c.oportunidade ? `<div class="dg-callout"><b>Espaço livre:</b> ${esc(c.oportunidade)}</div>` : ''}${secTab}</section>` : ''}
      ${kws.length ? `<section class="dg-sec">${head('Buscas', 'Palavras-chave para trabalhar', '')}${table(['Busca', 'Concorrência', 'Potencial', 'Onde usar'], kws)}</section>` : ''}
      ${arr(pl.semana).length || arr(pl.trimestre).length ? `<section class="dg-sec">${head('Plano de ação', 'Do ajuste rápido ao posicionamento', '')}<div class="dg-plan"><div class="dg-box hl"><h3>Esta semana ${pl.semanaResumo ? `<small>${esc(pl.semanaResumo)}</small>` : ''}</h3><ul class="dg-tasks">${tasks(pl.semana)}</ul></div><div class="dg-box"><h3>Neste trimestre <small>investimento estratégico</small></h3><ul class="dg-tasks">${tasks(pl.trimestre)}</ul></div></div></section>` : ''}
      ${secOb}
      <div class="dg-foot"><div style="display:flex;align-items:center;gap:8px"><img src="${sym}" alt="" style="height:22px"><b style="letter-spacing:.08em">CONEXA LOCAL™</b></div>${d.fontes ? `<p>${esc(d.fontes)}</p>` : ''}</div>
    </div>`;
  }

  let cssPosto = false;
  function html(d) {
    if (!cssPosto && typeof document !== 'undefined') { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); cssPosto = true; }
    return `<div class="dg-report">${corpo(d)}</div>`;
  }

  function documento(d, titulo) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo || 'Diagnóstico')}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap">
<style>${CSS}
@page{size:A4;margin:10mm}
body{margin:0;background:#fff}
.dg-sec{break-inside:auto}.dg-head,.dg-box,.dg-stage,.dg-kpi,.dg-callout,tr,.dg-bar{break-inside:avoid}.dg-head{break-after:avoid}
thead{display:table-header-group}
.acoes{position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:9}
.acoes button{font:600 13px Inter,sans-serif;padding:9px 16px;border-radius:10px;border:0;cursor:pointer;background:linear-gradient(135deg,#a760fd,#65e7f3);color:#fff}
@media print{.acoes{display:none}}
</style></head><body>
<div class="acoes"><button onclick="window.print()">Salvar em PDF / imprimir</button></div>
<div class="dg-report light">${corpo(d)}</div>
<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},400)})<\/script>
</body></html>`;
  }

  window.DiagRender = { html, documento, dataCurta };
})();
