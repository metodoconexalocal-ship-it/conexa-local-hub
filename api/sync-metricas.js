// 📊 Sincronização de Métricas do Google
const express = require('express');
const { db, collections, isConnected } = require('../lib/firebase-config');
const router = express.Router();

/**
 * POST /api/sync-metricas/trigger
 * Dispara sincronização de métricas do Google
 */
router.post('/trigger', async (req, res) => {
  try {
    const { usuarioId, perfilId } = req.body;

    if (!usuarioId || !perfilId) {
      return res.status(400).json({ error: 'usuarioId e perfilId são obrigatórios' });
    }

    // Simular dados do Google (depois será real via Google My Business API)
    const metricas = {
      perfilId,
      data: new Date().toISOString().split('T')[0],
      chamadas: Math.floor(Math.random() * 100),
      mensagens: Math.floor(Math.random() * 50),
      direcoes: Math.floor(Math.random() * 80),
      websiteClicks: Math.floor(Math.random() * 150),
      visualizacoes: Math.floor(Math.random() * 500),
      buscasLocais: Math.floor(Math.random() * 300),
      timestamp: new Date(),
      sincronizadoEm: new Date()
    };

    // Salvar no Firebase se conectado
    if (isConnected() && db) {
      try {
        await db.collection(collections.METRICAS)
          .doc(`${perfilId}_${metricas.data}`)
          .set(metricas);
      } catch (error) {
        console.warn('⚠️  Erro ao salvar no Firebase:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Sincronização completada',
      usuarioId,
      perfilId,
      metricas
    });
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sync-metricas/:perfilId
 * Recuperar métricas do último mês
 */
router.get('/:perfilId', async (req, res) => {
  try {
    const { perfilId } = req.params;
    let metricas = [];

    // Buscar no Firebase se conectado
    if (isConnected() && db) {
      try {
        const query = await db.collection(collections.METRICAS)
          .where('perfilId', '==', perfilId)
          .orderBy('data', 'desc')
          .limit(30)
          .get();

        metricas = query.docs.map(doc => doc.data());
      } catch (error) {
        console.warn('⚠️  Erro ao buscar do Firebase:', error.message);
      }
    }

    res.json({
      perfilId,
      total: metricas.length,
      metricas
    });
  } catch (error) {
    console.error('Erro ao recuperar métricas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sync-metricas/:perfilId/hoje
 * Recuperar métricas de hoje
 */
router.get('/:perfilId/hoje', async (req, res) => {
  try {
    const { perfilId } = req.params;
    const hoje = new Date().toISOString().split('T')[0];
    let metricas = null;

    // Buscar no Firebase se conectado
    if (isConnected() && db) {
      try {
        const doc = await db.collection(collections.METRICAS)
          .doc(`${perfilId}_${hoje}`)
          .get();

        if (doc.exists) {
          metricas = doc.data();
        }
      } catch (error) {
        console.warn('⚠️  Erro ao buscar do Firebase:', error.message);
      }
    }

    res.json({
      perfilId,
      data: hoje,
      metricas: metricas || {
        chamadas: 0,
        mensagens: 0,
        direcoes: 0,
        websiteClicks: 0,
        visualizacoes: 0,
        buscasLocais: 0
      }
    });
  } catch (error) {
    console.error('Erro ao recuperar métricas de hoje:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
