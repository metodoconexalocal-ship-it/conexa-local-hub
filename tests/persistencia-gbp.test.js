const assert = require('assert');
const path = require('path');
const p = require(path.join(__dirname, '..', 'lib', 'persistencia-gbp'));

// Firestore simulado: coleções em memória com a API usada no código
function fakeDb() {
  const cols = {};
  const col = (n) => (cols[n] ||= {});
  return {
    cols,
    collection(name) {
      const c = col(name);
      return {
        doc: (id) => ({ id, _col: c, _id: id }),
        where: (campo, op, valor) => ({
          get: async () => ({ docs: Object.entries(c).filter(([, d]) => d[campo] === valor).map(([id, d]) => ({ id, data: () => d })) }),
        }),
        get: async () => ({ docs: [] }),
      };
    },
    batch() {
      const ops = [];
      return {
        set: (ref, dados, opts) => ops.push({ ref, dados, opts }),
        commit: async () => {
          for (const { ref, dados, opts } of ops) {
            ref._col[ref._id] = opts?.merge ? { ...(ref._col[ref._id] || {}), ...dados } : dados;
          }
        },
      };
    },
  };
}
const fdb = fakeDb();
// doc() do fakeDb precisa ser acessível pelo collection().doc(): ajusta o método
const origCollection = fdb.collection.bind(fdb);
fdb.collection = (name) => {
  const c = origCollection(name);
  const base = c.doc;
  c.doc = (id) => { const d = base(id); const colRef = fdb.cols[name]; return { ...d, _col: colRef, _id: id, get: async () => ({ exists: !!colRef[id], data: () => colRef[id] }) }; };
  return c;
};

(async () => {
  // 1) Salva métricas: só dias com dados, ids perfilId_data, campos corretos
  const porDia = {
    '2026-10-20': { CALL_CLICKS: 3, BUSINESS_CONVERSATIONS: 1, BUSINESS_IMPRESSIONS_MOBILE_MAPS: 50 },
    '2026-10-21': { CALL_CLICKS: 5 },
    '2026-09-01': { CALL_CLICKS: 9 }, // fora da janela de leitura
  };
  const n = await p.salvarMetricas(fdb, 'dono@x.com', '555', porDia);
  assert.equal(n, 3);
  const doc = fdb.cols[p.COL_METRICAS]['555_2026-10-20'];
  assert.equal(doc.chamadas, 3);
  assert.equal(doc.mensagens, 1);
  assert.equal(doc.visualizacoes, 50);
  assert.equal(doc.coletadoPor, 'dono@x.com');
  assert.ok(doc.coletadoEm instanceof Date);
  assert.equal(fdb.cols[p.COL_METRICAS]['555_2026-10-22'], undefined, 'dia sem dado não é gravado');

  // 2) Histórico filtra por janela e ordena; não expõe perfilId/coletadoPor cru
  const hist = await p.lerHistorico(fdb, '555', '2026-10-16', '2026-10-22');
  assert.deepEqual(hist.map(h => h.data), ['2026-10-20', '2026-10-21']);
  assert.equal(hist[0].perfilId, undefined);
  assert.equal(hist[0].coletadoPor, 'dono@x.com');
  assert.equal(typeof hist[0].coletadoEm, 'string', 'data vira texto ISO');

  // 3) Outro perfil não aparece
  await p.salvarMetricas(fdb, 'dono@x.com', '999', { '2026-10-20': { CALL_CLICKS: 1 } });
  const outro = await p.lerHistorico(fdb, '555', '2026-10-16', '2026-10-22');
  assert.equal(outro.length, 2);

  // 4) Perfis: merge preserva campos e registra quem atualizou
  await p.salvarPerfis(fdb, 'dono@x.com', [{ id: '555', nome: 'Loja A', endereco: 'Rua 1', telefone: '1', site: '', conta: 'accounts/1' }]);
  const ult = await p.ultimaSincronizacao(fdb, '555');
  assert.equal(ult.atualizadoPor, 'dono@x.com');
  assert.ok(ult.atualizadoEm);
  assert.equal(fdb.cols[p.COL_PERFIS]['555'].nome, 'Loja A');

  console.log('TESTES DO BANCO PASSARAM');
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
