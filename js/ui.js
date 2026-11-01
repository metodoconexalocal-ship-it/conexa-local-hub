/**
 * UI — avisos, confirmações e pedidos de texto no mesmo visual do sistema.
 * Substitui alert / confirm / prompt do navegador.
 *   UI.aviso(msg)                       → aviso que some sozinho
 *   await UI.confirmar(msg | {…})       → true / false
 *   await UI.pedir({titulo, valor, …})  → texto ou null
 */
window.UI = (() => {
  const CSS = `
  #ui-toasts{position:fixed;right:20px;bottom:20px;z-index:20000;display:flex;flex-direction:column;gap:8px;max-width:360px;pointer-events:none}
  .ui-toast{display:flex;gap:10px;align-items:flex-start;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:10px;padding:11px 14px;box-shadow:0 8px 24px rgba(0,0,0,.25);color:var(--text-primary);font-size:13px;line-height:1.4;opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}
  .ui-toast.show{opacity:1;transform:none}
  .ui-toast.ui-erro{border-left-color:var(--red)}
  .ui-toast.ui-sucesso{border-left-color:var(--green)}
  .ui-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:20001;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .15s}
  .ui-overlay.show{opacity:1}
  .ui-box{width:420px;max-width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35);color:var(--text-primary)}
  .ui-titulo{font-size:15px;font-weight:600;margin:0 0 8px}
  .ui-msg{font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0 0 14px;white-space:pre-line}
  .ui-input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card2);color:var(--text-primary);font-size:13px;margin-bottom:14px}
  .ui-input:focus{outline:none;border-color:var(--accent)}
  .ui-acoes{display:flex;gap:8px;justify-content:flex-end}
  .ui-btn{border:1px solid var(--border);background:transparent;color:var(--text-primary);border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer}
  .ui-btn:hover{border-color:var(--text-muted)}
  .ui-btn-ok{background:var(--accent);border-color:var(--accent);color:#fff}
  .ui-btn-ok.perigo{background:var(--red);border-color:var(--red)}
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function estilo() {
    if (document.getElementById('ui-css')) return;
    const s = document.createElement('style');
    s.id = 'ui-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Tipo do aviso pelo texto (erro, sucesso ou informação)
  function tipoDe(msg) {
    const t = String(msg).toLowerCase();
    if (/erro|falh|não foi|nao foi|inválid|invalid|impossível|obrigat|informe|escolha|cadastre|não conect|nao conect|vazi/.test(t)) return 'erro';
    if (/salv|cadastr|import|sincroniz|conclu|feito|atualizad|criad|excluíd|excluid|copiad|desconect/.test(t) && !/erro|falh/.test(t)) return 'sucesso';
    return 'info';
  }

  function container() {
    let c = document.getElementById('ui-toasts');
    if (!c) {
      c = document.createElement('div');
      c.id = 'ui-toasts';
      document.body.appendChild(c);
    }
    return c;
  }

  function aviso(msg, tipo, ms = 4200) {
    estilo();
    const t = document.createElement('div');
    const tp = tipo || tipoDe(msg);
    t.className = `ui-toast ui-${tp}`;
    t.innerHTML = `<div>${esc(msg)}</div>`;
    container().appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 220);
    }, ms);
  }

  // Abre uma janela do sistema e devolve uma Promise com o que o usuário escolheu
  function janela({ titulo, mensagem, campo, valor, placeholder, ok, cancelar, perigo }, resolver) {
    estilo();
    const fundo = document.createElement('div');
    fundo.className = 'ui-overlay';
    fundo.innerHTML = `
      <div class="ui-box" role="dialog" aria-modal="true">
        ${titulo ? `<div class="ui-titulo">${esc(titulo)}</div>` : ''}
        ${mensagem ? `<div class="ui-msg">${esc(mensagem)}</div>` : ''}
        ${campo ? `<input class="ui-input" id="ui-campo" value="${esc(valor || '')}" placeholder="${esc(placeholder || '')}">` : ''}
        <div class="ui-acoes">
          <button class="ui-btn" id="ui-cancelar">${esc(cancelar || 'Cancelar')}</button>
          <button class="ui-btn ui-btn-ok ${perigo ? 'perigo' : ''}" id="ui-ok">${esc(ok || 'Confirmar')}</button>
        </div>
      </div>`;
    document.body.appendChild(fundo);
    requestAnimationFrame(() => fundo.classList.add('show'));

    const campoEl = fundo.querySelector('#ui-campo');
    const fechar = (resultado) => {
      document.removeEventListener('keydown', tecla, true);
      fundo.classList.remove('show');
      setTimeout(() => fundo.remove(), 150);
      resolver(resultado);
    };
    const confirmar = () => fechar(campo ? campoEl.value.trim() : true);
    const recusar = () => fechar(campo ? null : false);
    const tecla = (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); recusar(); }
      if (ev.key === 'Enter') { ev.preventDefault(); confirmar(); }
    };
    document.addEventListener('keydown', tecla, true);
    fundo.querySelector('#ui-ok').onclick = confirmar;
    fundo.querySelector('#ui-cancelar').onclick = recusar;
    fundo.addEventListener('click', (ev) => { if (ev.target === fundo) recusar(); });
    setTimeout(() => (campoEl || fundo.querySelector('#ui-ok')).focus(), 30);
  }

  // Aceita texto simples ou um objeto com as opções
  const opcoes = (x) => (typeof x === 'string' ? { mensagem: x } : x || {});

  function confirmar(x) {
    return new Promise((resolver) => janela({ titulo: 'Confirmar', ok: 'Confirmar', ...opcoes(x) }, resolver));
  }

  function pedir(x) {
    return new Promise((resolver) => janela({ titulo: 'Informe', ok: 'Salvar', campo: true, ...opcoes(x) }, resolver));
  }

  return { aviso, confirmar, pedir };
})();
