// 📝 Endpoints públicos dos formulários do sistema.
// GET  /api/formularios/:tipo  → perguntas (para montar a página)
// POST /api/formularios/:tipo  → valida, guarda a resposta e cria o cliente novo
const crypto = require('crypto');
const express = require('express');
const f = require('../lib/formularios');
const { db, isConnected } = require('../lib/firebase-config');

const router = express.Router();

// Limite simples por endereço: evita enxurrada de envios falsos
const envios = new Map();
const LIMITE = 10;
const JANELA_MS = 10 * 60 * 1000;
function dentroDoLimite(ip) {
  const agora = Date.now();
  const lista = (envios.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  if (lista.length >= LIMITE) { envios.set(ip, lista); return false; }
  lista.push(agora);
  envios.set(ip, lista);
  return true;
}

router.get('/:tipo', (req, res) => {
  const d = f.descrever(req.params.tipo);
  if (!d) return res.status(404).json({ erro: 'Formulário não encontrado' });
  res.json(d);
});

router.post('/:tipo', async (req, res) => {
  try {
    const tipo = req.params.tipo;
    if (!f.FORMULARIOS[tipo]) return res.status(404).json({ erro: 'Formulário não encontrado' });

    // Campo escondido que pessoas não veem: se vier preenchido, é robô
    if (req.body?.website) return res.json({ ok: true, protocolo: 'recebido' });

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!dentroDoLimite(ip)) {
      return res.status(429).json({ erro: 'Muitos envios em pouco tempo. Tente de novo em alguns minutos.' });
    }

    const resultado = f.validar(tipo, req.body);
    if (!resultado.ok) return res.status(400).json({ erro: 'Confira os campos destacados.', erros: resultado.erros });

    if (!isConnected()) {
      return res.status(503).json({ erro: 'O sistema não está pronto para receber cadastros. Avise a equipe.' });
    }

    const protocolo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const clienteId = 'cli_f' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const agora = new Date();
    const cliente = { id: clienteId, ...f.paraCliente(tipo, resultado.dados, agora), importado: false };

    // A resposta completa fica guardada (com o que foi enviado) e o cliente entra na fila de importação
    await db.collection('gmn_formularios_respostas').doc(protocolo).set({
      tipo,
      protocolo,
      dados: resultado.dados,
      clienteId,
      criadoEm: agora,
      lida: false,
    });
    await db.collection('gmn_clientes_novos').doc(clienteId).set({ ...cliente, criadoEm: agora });

    res.json({ ok: true, protocolo });
  } catch (e) {
    console.error('[formularios]', e.message);
    res.status(500).json({ erro: 'Não foi possível salvar agora. Tente de novo.' });
  }
});

module.exports = router;
