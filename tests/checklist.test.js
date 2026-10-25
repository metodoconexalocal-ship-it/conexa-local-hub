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

  console.log('TESTES DO CHECKLIST PASSARAM');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
