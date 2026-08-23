// 🔐 Google OAuth Endpoints
const express = require('express');
const googleOAuth = require('../lib/google-oauth');
const router = express.Router();

/**
 * GET /api/auth/google/url
 * Retorna URL para fazer login no Google
 */
router.get('/google/url', (req, res) => {
  try {
    const url = googleOAuth.gerarUrlAutenticacao();
    res.json({
      url,
      message: 'Clique neste link para fazer login com Google'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/callback
 * Recebe o código do Google e troca por token
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Código de autenticação não recebido' });
    }

    // Trocar código por tokens
    const tokens = await googleOAuth.trocarCodigoPorToken(code);

    // Armazenar tokens temporariamente (será vinculado ao perfil depois)
    // Por enquanto, retornar os tokens
    res.json({
      success: true,
      message: 'Autenticação bem-sucedida',
      tokens: {
        access_token: tokens.access_token ? '✓ obtido' : '✗ erro',
        refresh_token: tokens.refresh_token ? '✓ obtido' : '✗ erro',
        expiry_date: tokens.expiry_date
      }
    });
  } catch (error) {
    console.error('Erro no callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/google/vincular-perfil
 * Vincula tokens do Google ao perfil GMN
 */
router.post('/google/vincular-perfil', async (req, res) => {
  try {
    const { usuarioId, perfilId, accessToken, refreshToken } = req.body;

    if (!usuarioId || !perfilId) {
      return res.status(400).json({ error: 'usuarioId e perfilId são obrigatórios' });
    }

    // Salvar tokens (quando Firebase estiver conectado)
    // await googleOAuth.salvarTokensFirestore(usuarioId, perfilId, {
    //   access_token: accessToken,
    //   refresh_token: refreshToken
    // });

    res.json({
      success: true,
      message: 'Perfil vinculado ao Google com sucesso',
      usuarioId,
      perfilId
    });
  } catch (error) {
    console.error('Erro ao vincular perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/google/desconectar
 * Desvincula Google do perfil
 */
router.post('/google/desconectar', async (req, res) => {
  try {
    const { usuarioId, perfilId } = req.body;

    if (!usuarioId || !perfilId) {
      return res.status(400).json({ error: 'usuarioId e perfilId são obrigatórios' });
    }

    // Deletar tokens quando Firebase estiver conectado
    // await db.collection('gmn_google_tokens').doc(`${usuarioId}_${perfilId}`).delete();

    res.json({
      success: true,
      message: 'Desconectado do Google com sucesso'
    });
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/status/:usuarioId/:perfilId
 * Verifica status da conexão Google
 */
router.get('/google/status/:usuarioId/:perfilId', async (req, res) => {
  try {
    const { usuarioId, perfilId } = req.params;

    // Quando Firebase estiver conectado:
    // const tokens = await googleOAuth.recuperarTokensFirestore(usuarioId, perfilId);

    res.json({
      conectado: false, // Por enquanto false (Firebase não conectado)
      ultimaSincronizacao: null,
      usuarioId,
      perfilId,
      message: 'Firebase não conectado ainda'
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
