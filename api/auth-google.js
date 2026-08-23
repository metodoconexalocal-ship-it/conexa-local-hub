// 🔐 Google OAuth Endpoints
const express = require('express');
const router = express.Router();

// GET /api/auth/google/url - Retorna URL para login
router.get('/google/url', (req, res) => {
  res.json({
    url: 'https://accounts.google.com/o/oauth2/auth',
    message: 'OAuth endpoint disponível'
  });
});

// GET /api/auth/google/callback - Callback do Google
router.get('/google/callback', (req, res) => {
  res.json({
    status: 'Callback endpoint disponível',
    code: req.query.code || 'nenhum código recebido'
  });
});

// POST /api/auth/google/vincular-perfil - Vincular perfil ao Google
router.post('/google/vincular-perfil', (req, res) => {
  res.json({
    success: true,
    message: 'Endpoint vincular-perfil disponível',
    body: req.body
  });
});

// POST /api/auth/google/desconectar - Desconectar Google
router.post('/google/desconectar', (req, res) => {
  res.json({
    success: true,
    message: 'Desconectado com sucesso'
  });
});

// GET /api/auth/google/status/:usuarioId/:perfilId - Status da conexão
router.get('/google/status/:usuarioId/:perfilId', (req, res) => {
  res.json({
    conectado: false,
    ultimaSincronizacao: null,
    usuarioId: req.params.usuarioId,
    perfilId: req.params.perfilId
  });
});

module.exports = router;
