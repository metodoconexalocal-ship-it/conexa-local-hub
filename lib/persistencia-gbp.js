// 🗄️ Persistência dos perfis e métricas do Business Profile no Firestore.
// Grava só o que o Google devolveu, com data da coleta e e-mail de quem sincronizou.
// Coleções:
//   gmn_gbp_perfis/{perfilId}            → dados do perfil (último estado visto)
//   gmn_gbp_metricas/{perfilId}_{AAAA-MM-DD} → métricas de um dia

const { linhaDoDia } = require('./metricas-gbp');

const COL_PERFIS = 'gmn_gbp_perfis';
const COL_METRICAS = 'gmn_gbp_metricas';
const LOTE = 400; // limite do Firestore é 500 operações por batch

const paraISO = (v) => (v?.toDate ? v.toDate().toISOString() : v || null);

async function gravarEmLotes(db, operacoes) {
  for (let i = 0; i < operacoes.length; i += LOTE) {
    const batch = db.batch();
    for (const op of operacoes.slice(i, i + LOTE)) batch.set(op.ref, op.dados, { merge: true });
    await batch.commit();
  }
}

// Perfis: um documento por perfil, com o estado mais recente
async function salvarPerfis(db, email, perfis) {
  const agora = new Date();
  const ops = perfis.map((p) => ({
    ref: db.collection(COL_PERFIS).doc(p.id),
    dados: {
      nome: p.nome,
      endereco: p.endereco,
      telefone: p.telefone,
      site: p.site,
      conta: p.conta,
      atualizadoEm: agora,
      atualizadoPor: email,
    },
  }));
  await gravarEmLotes(db, ops);
  return ops.length;
}

// Métricas: um documento por dia que o Google devolveu com dados
async function salvarMetricas(db, email, perfilId, porDia) {
  const agora = new Date();
  const ops = Object.entries(porDia).map(([data, dia]) => {
    const { data: _ignorar, ...valores } = linhaDoDia(data, dia);
    return {
      ref: db.collection(COL_METRICAS).doc(`${perfilId}_${data}`),
      dados: { perfilId, data, ...valores, coletadoEm: agora, coletadoPor: email },
    };
  });
  await gravarEmLotes(db, ops);
  return ops.length;
}

// Histórico salvo de um perfil entre duas datas (AAAA-MM-DD), em ordem de dia.
// Filtra no código para não exigir índice composto no Firestore.
async function lerHistorico(db, perfilId, inicio, fim) {
  const snap = await db.collection(COL_METRICAS).where('perfilId', '==', perfilId).get();
  return snap.docs
    .map((d) => d.data())
    .filter((d) => d.data >= inicio && d.data <= fim)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .map(({ perfilId: _p, coletadoEm, coletadoPor, ...linha }) => ({
      ...linha,
      coletadoEm: paraISO(coletadoEm),
      coletadoPor,
    }));
}

async function ultimaSincronizacao(db, perfilId) {
  const doc = await db.collection(COL_PERFIS).doc(perfilId).get();
  if (!doc.exists) return null;
  const d = doc.data();
  return { atualizadoEm: paraISO(d.atualizadoEm), atualizadoPor: d.atualizadoPor || null };
}

module.exports = { salvarPerfis, salvarMetricas, lerHistorico, ultimaSincronizacao, COL_PERFIS, COL_METRICAS };
