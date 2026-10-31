// Testa a interpretação do ditado e o carregamento do checklist, com Firestore simulado
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const colecoes = {};
global.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); } };
global.document = { getElementById: () => ({ innerHTML: '', value: '', textContent: '', style: {} }) };
global.window = {
  dbList: async (col) => (colecoes[col] || []).slice(),
  dbSave: async (col, data) => {
    colecoes[col] ||= [];
    if (data.id) { const d = colecoes[col].find((x) => x.id === data.id); Object.assign(d, data); }
    else colecoes[col].push({ id: 'id' + colecoes[col].length, ...data });
    return data.id || 'novo';
  },
};
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'checklist.js'), 'utf8'));

(async () => {
  await window.Checklist.abrir();
  const projetos = colecoes['gmn_checklist_projetos'];
  assert.equal(projetos.length, 15, 'folha tem 15 blocos de cliente');
  assert.equal(projetos.find((p) => p.nome === 'Aura Bem').tarefas.length, 6);

  const I = window.Checklist.interpretar;
  const aura = I('Aura Bem criativo');
  assert.equal(projetos.find((p) => p.id === aura.projetoId).nome, 'Aura Bem');
  assert.equal(aura.texto, 'Criativo');

  const bni = I('projeto BNI tarefa postar carrossel do Francisco');
  assert.equal(projetos.find((p) => p.id === bni.projetoId).nome, 'BNI');
  assert.equal(bni.texto, 'Postar carrossel do Francisco');

  const semProjeto = I('ligar para o fornecedor amanhã');
  assert.equal(semProjeto.projetoId, '', 'sem projeto reconhecido, fica vazio para escolher');
  assert.equal(semProjeto.texto, 'Ligar para o fornecedor amanhã');

  // "Dra Keytte" com acento/caixa diferentes
  const keytte = I('dra keytte contrato');
  assert.equal(projetos.find((p) => p.id === keytte.projetoId).nome, 'Dra Keytte');

  // ── Arrastar, agrupar e ordenar ────────────────────────────────────────────
  colecoes['gmn_checklist_grupos'] = [{ id: 'g-rec', nome: 'Recorrente', ordem: 0 }];
  await window.Checklist.abrir();
  const ev = (id) => ({ preventDefault() {}, stopPropagation() {}, dataTransfer: { setData() {}, effectAllowed: '', dropEffect: '' } });
  const porNome = (n) => colecoes['gmn_checklist_projetos'].find((p) => p.nome === n);
  const ordemDeTodos = () => colecoes['gmn_checklist_projetos'].slice().sort((a, b) => a.ordem - b.ordem).map((p) => p.nome);

  // Solta "Aura Bem" antes de "Dra Keytte" (grupo sem grupo)
  window.Checklist.dragStart(ev(), porNome('Aura Bem').id);
  window.Checklist.dropCard(ev(), porNome('Dra Keytte').id);
  await new Promise((r) => setTimeout(r, 0));
  const ordemAposDrop = ordemDeTodos();
  assert.equal(ordemAposDrop.indexOf('Aura Bem') + 1, ordemAposDrop.indexOf('Dra Keytte'), 'Aura Bem fica logo antes de Dra Keytte');
  assert.deepEqual(ordemDeTodos().map((_, i) => colecoes['gmn_checklist_projetos'].find((p) => p.ordem === i)?.ordem), ordemDeTodos().map((_, i) => i), 'ordem contínua de 0 a n-1');

  // Solta "DC" dentro do grupo "Recorrente"
  window.Checklist.dragStart(ev(), porNome('DC').id);
  window.Checklist.dropSecao(ev(), 'g-rec');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(porNome('DC').grupo, 'g-rec', 'DC entra no grupo Recorrente');
  assert.equal(porNome('Aura Bem').grupo || '', '', 'Aura Bem continua sem grupo');

  // Solta "BNI" sobre "DC" → herda o grupo de DC
  window.Checklist.dragStart(ev(), porNome('BNI').id);
  window.Checklist.dropCard(ev(), porNome('DC').id);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(porNome('BNI').grupo, 'g-rec', 'soltar sobre um card herda o grupo dele');

  // Etiquetas e vínculo com cliente são gravados no projeto
  await window.Checklist.definirCliente(porNome('DC').id, 'cli-1');
  assert.equal(porNome('DC').clienteId, 'cli-1', 'vínculo com cliente gravado');

  console.log('TESTES DO CHECKLIST PASSARAM');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
