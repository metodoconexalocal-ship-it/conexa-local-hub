/* ═══════════════════════════════════════════════════════════════════════════
   GMN HUB — Diagnósticos (visão externa do perfil, feita pelo Claude)
   Página: gmn-diagnosticos (chamada pelo showPage do app.js → Diagnosticos.abrir()).
   Coleção:
     ghub_diagnosticos   id = diagnostico.id · { cliente, diagnostico, status, origem }   [login]
   Importação: um ou vários .json no formato da Central de Diagnósticos
   ({ cliente: {...}, diagnostico: {...} }), os arquivos de central-conexa/diagnosticos/.
   Importar de novo o mesmo diagnóstico (mesmo id) substitui o anterior.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const COL = 'ghub_diagnosticos';
  const STATUS = {
    rascunho: { l: 'Rascunho', c: 'var(--text-muted)' },
    apresentado: { l: 'Apresentado', c: 'var(--blue)' },
    entregue: { l: 'Entregue ao cliente', c: 'var(--green)' },
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const toast = (m) => { if (window.UI && UI.toast) return UI.toast(m); alert(m); };
  const S = { lista: [], atual: null, busca: '', apagar: false };

  async function carregar() {
    const l = await window.dbList(COL);
    S.lista = l.sort((a, b) => String((b.diagnostico || {}).data || '').localeCompare(String((a.diagnostico || {}).data || '')));
  }

  const D = {};
  window.Diagnosticos = D;

  D.abrir = async () => {
    $('main-content').innerHTML = '<div class="page-wrap" style="color:var(--text-muted)"><i class="bi bi-hourglass-split"></i> Carregando diagnósticos…</div>';
    S.atual = null; S.apagar = false;
    await carregar();
    lista();
  };

  function lista() {
    const filtro = S.busca.toLowerCase();
    const itens = S.lista.filter((r) => !filtro || String((r.cliente || {}).nome || '').toLowerCase().includes(filtro));
    // agrupa por cliente: o mais recente primeiro, com o histórico logo abaixo
    const grupos = {};
    itens.forEach((r) => { const k = (r.cliente || {}).id || slug((r.cliente || {}).nome); (grupos[k] = grupos[k] || []).push(r); });
    const cards = Object.values(grupos).map((gs) => {
      const c = gs[0].cliente || {};
      const linhas = gs.map((r) => {
        const d = r.diagnostico || {}, st = STATUS[r.status] || STATUS.rascunho, p = d.perfil || {};
        return `<div onclick="Diagnosticos.ver('${esc(r.id)}')" style="display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--border);border-radius:10px;cursor:pointer;background:var(--bg-base)">
          <span style="font-size:12px;font-weight:600;color:var(--accent)">${esc(window.DiagRender.dataCurta(d.data))}</span>
          <span style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.titulo || 'Diagnóstico')} <span style="color:var(--text-muted)">· ${esc(p.nota || '–')} ★ (${esc(p.avaliacoes ?? '–')})</span></span>
          <span style="font-size:11px;font-weight:700;color:${st.c};border:1px solid ${st.c};border-radius:20px;padding:1px 8px;white-space:nowrap">${st.l}</span>
        </div>`;
      }).join('');
      return `<div class="card" style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-card);display:flex;flex-direction:column;gap:9px">
        <div><div style="font-weight:700;font-size:15px">${esc(c.nome || 'Sem nome')}</div>
        <div style="color:var(--text-muted);font-size:12px">${esc([c.segmento, c.cidade].filter(Boolean).join(' · '))} · ${gs.length} diagnóstico${gs.length > 1 ? 's' : ''}</div></div>
        ${linhas}
      </div>`;
    }).join('');
    $('main-content').innerHTML = `<div class="page-wrap">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <div><h2 style="margin:0;font-size:20px">Diagnósticos</h2>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:4px">Análise externa do perfil no Google, por cliente, com histórico e PDF no visual da Conexa.</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="dg-busca" class="form-input" placeholder="Buscar cliente" value="${esc(S.busca)}" oninput="Diagnosticos.buscar(this.value)" style="background:var(--bg-base);border:1px solid var(--border-bright);border-radius:8px;color:var(--text-primary);padding:8px 10px;font-size:13px">
          <label class="btn btn-primary" style="cursor:pointer"><i class="bi bi-upload"></i> Importar do Claude (.json)<input type="file" accept=".json,application/json" multiple style="display:none" onchange="Diagnosticos.importar(this.files);this.value=''"></label>
        </div>
      </div>
      ${cards ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px">${cards}</div>`
        : `<div class="card" style="padding:40px;text-align:center;border:1px dashed var(--border-bright);border-radius:var(--radius-lg);color:var(--text-secondary)">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px">${S.busca ? 'Nenhum cliente com esse nome.' : 'Nenhum diagnóstico ainda'}</div>
          ${S.busca ? '' : 'Importe os arquivos .json que o Claude gera em <code>central-conexa\\diagnosticos</code>. Dá para selecionar vários de uma vez.'}</div>`}
    </div>`;
    const b = $('dg-busca'); if (b && S.busca) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  }

  D.buscar = (v) => { S.busca = v; lista(); };

  D.importar = async (files) => {
    const arqs = Array.from(files || []);
    if (!arqs.length) return;
    let ok = 0; const erros = [];
    for (const f of arqs) {
      try {
        const j = JSON.parse(await f.text());
        const diag = j.diagnostico || (j.perfil && j.data ? j : null);
        if (!diag || !diag.data) throw new Error('não é um diagnóstico');
        const cli = j.cliente || { nome: (diag.perfil || {}).nome || diag.clienteId };
        cli.id = cli.id || diag.clienteId || slug(cli.nome);
        const id = slug(diag.id || `${cli.id}-${diag.data}`);
        const atual = S.lista.find((r) => r.id === id);
        await window.dbSet(COL, id, { cliente: cli, diagnostico: { ...diag, id }, status: (atual && atual.status) || diag.status || 'rascunho', origem: f.name });
        ok++;
      } catch (e) { erros.push(f.name + ' (' + e.message + ')'); }
    }
    await carregar();
    lista();
    toast(`${ok} diagnóstico${ok === 1 ? '' : 's'} importado${ok === 1 ? '' : 's'}` + (erros.length ? `. Não importados: ${erros.join(', ')}` : ''));
  };

  D.ver = (id) => {
    const r = S.lista.find((x) => x.id === id);
    if (!r) return;
    S.atual = r; S.apagar = false;
    const c = r.cliente || {}, d = r.diagnostico || {};
    $('main-content').innerHTML = `<div class="page-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="Diagnosticos.abrir()"><i class="bi bi-arrow-left"></i> Diagnósticos</button>
          <div><div style="font-weight:700;font-size:16px">${esc(c.nome)}</div><div style="color:var(--text-muted);font-size:12px">${esc(window.DiagRender.dataCurta(d.data))} · ${esc(d.titulo || '')}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select class="form-input" onchange="Diagnosticos.status(this.value)" style="background:var(--bg-base);border:1px solid var(--border-bright);border-radius:8px;color:var(--text-primary);padding:7px 9px;font-size:12.5px">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${(r.status || 'rascunho') === k ? ' selected' : ''}>${v.l}</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="Diagnosticos.pdf()"><i class="bi bi-file-earmark-pdf"></i> Gerar PDF</button>
          <span id="dg-del">${botaoApagar()}</span>
        </div>
      </div>
      ${window.DiagRender.html(d)}
    </div>`;
    window.scrollTo(0, 0);
  };

  const botaoApagar = () => (S.apagar
    ? '<button class="btn btn-ghost" style="color:var(--red)" onclick="Diagnosticos.apagar(true)">Confirmar exclusão</button> <button class="btn btn-ghost" onclick="Diagnosticos.apagar(false)">Cancelar</button>'
    : '<button class="btn btn-ghost" onclick="Diagnosticos.apagar()"><i class="bi bi-trash"></i></button>');

  D.status = async (v) => {
    const r = S.atual; if (!r) return;
    r.status = v;
    await window.dbSet(COL, r.id, { cliente: r.cliente, diagnostico: r.diagnostico, status: v, origem: r.origem || '' });
    toast('Status atualizado');
  };

  D.apagar = async (confirmar) => {
    if (confirmar === undefined) { S.apagar = true; $('dg-del').innerHTML = botaoApagar(); return; }
    if (!confirmar) { S.apagar = false; $('dg-del').innerHTML = botaoApagar(); return; }
    await window.dbRemove(COL, S.atual.id);
    toast('Diagnóstico excluído');
    D.abrir();
  };

  D.pdf = () => {
    const r = S.atual; if (!r) return;
    const w = window.open('', '_blank');
    if (!w) return alert('O navegador bloqueou a janela. Permita pop-ups para o Hub e tente de novo.');
    w.document.open();
    w.document.write(window.DiagRender.documento(r.diagnostico, 'Diagnóstico - ' + ((r.cliente || {}).nome || '') + ' - ' + window.DiagRender.dataCurta(r.diagnostico.data)));
    w.document.close();
  };
})();
