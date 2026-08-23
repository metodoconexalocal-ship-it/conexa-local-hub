// 📊 Sincronização de Métricas do Google
const express = require('express');
const router = express.Router();

// POST /api/sync-metricas/trigger - Disparar sincronização
router.post('/trigger', (req, res) => {
  res.json({
    success: true,
    message: 'Sincronização iniciada',
    usuarioId: req.body.usuarioId,
    perfilId: req.body.perfilId
  });
});

// GET /api/sync-metricas/:perfilId - Recuperar métricas
router.get('/:perfilId', (req, res) => {
  res.json({
    perfilId: req.params.perfilId,
    metricas: {
      chamadas: 0,
      mensagens: 0,
      direcoes: 0,
      websiteClicks: 0,
      visualizacoes: 0,
      buscasLocais: 0
    }
  });
});

// GET /api/sync-metricas/:perfilId/hoje - Métricas de hoje
router.get('/:perfilId/hoje', (req, res) => {
  res.json({
    perfilId: req.params.perfilId,
    data: new Date().toISOString().split('T')[0],
    metricas: {
      chamadas: 0,
      mensagens: 0,
      direcoes: 0,
      websiteClicks: 0,
      visualizacoes: 0,
      buscasLocais: 0
    }
  });
});

module.exports = router;
