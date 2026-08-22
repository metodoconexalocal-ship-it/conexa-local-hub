// 🔐 ENDPOINT - Google OAuth Callback

const express = require('express');
const googleOAuth = require('../lib/google-oauth');
const { db } = require('../js/firebase-config');
const router = express.Router();

/**
 * GET /api/auth/google/url
 * Retorna URL para o usuário fazer login
 */
router.get('/google/url', (req, res) => {
  try {
    const url = googleOAuth.gerarUrlAutenticacao();
    res.json({ url });
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
      return res.status(400).json({ error: 'Código não fornecido' });
    }

    // 1. Trocar código por token
    const tokens = await googleOAuth.trocarCodigoPorToken(code);

    // 2. Recuperar dados do usuário Google
    const auth = new (require('googleapis').google).auth.OAuth2();
    auth.setCredentials(tokens);
    const people = require('googleapis').google.people('v1');
    const profile = await people.people.get({
      auth,
      resourceName: 'people/me',
      personFields: 'emailAddresses,names',
    });

    const googleId = profile.data.resourceName.split('/')[1];
    const email = profile.data.emailAddresses?.[0]?.value || '';
    const nome = profile.data.names?.[0]?.displayName || 'Usuário';

    // 3. Buscar ou criar usuário no Firestore
    const userRef = db.collection('users').doc(googleId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Criar novo usuário
      await userRef.set({
        googleId,
        email,
        nome,
        criadoEm: new Date(),
        perfilGoogle: {
          conectado: false,
          businessId: null,
        },
      });
    }

    // 4. Salvar tokens temporariamente (será vinculado ao perfil)
    await db.collection('google_temp_tokens').doc(googleId).set({
      googleId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expiry_date,
      criadoEm: new Date(),
    }, { merge: true });

    // 5. Redirecionar de volta para o app
    const redirectUrl = `${process.env.FRONTEND_URL}/?google_auth=success&user_id=${googleId}`;
    res.redirect(redirectUrl);
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
    const { usuarioId, perfilId } = req.body;

    if (!usuarioId || !perfilId) {
      return res.status(400).json({ error: 'usuarioId e perfilId são obrigatórios' });
    }

    // Recuperar tokens temporários
    const tempTokensDoc = await db.collection('google_temp_tokens').doc(usuarioId).get();

    if (!tempTokensDoc.exists) {
      return res.status(400).json({ error: 'Tokens temporários não encontrados. Faça login novamente.' });
    }

    const tempTokens = tempTokensDoc.data();

    // Salvar tokens vinculados ao perfil
    await googleOAuth.salvarTokensFirestore(usuarioId, perfilId, {
      access_token: tempTokens.accessToken,
      refresh_token: tempTokens.refreshToken,
      expiry_date: tempTokens.expiresIn,
    });

    // Atualizar perfil no gmn_perfis
    await db.collection('gmn_perfis').doc(perfilId).update({
      google_conectado: true,
      google_sync_date: new Date(),
    });

    // Deletar tokens temporários
    await db.collection('google_temp_tokens').doc(usuarioId).delete();

    res.json({ success: true, message: 'Perfil vinculado ao Google!' });
  } catch (error) {
    console.error('Erro ao vincular perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/google/desconectar
 * Desvincula tokens do Google
 */
router.post('/google/desconectar', async (req, res) => {
  try {
    const { usuarioId, perfilId } = req.body;

    await db.collection('gmn_google_tokens').doc(`${usuarioId}_${perfilId}`).delete();
    await db.collection('gmn_perfis').doc(perfilId).update({
      google_conectado: false,
    });

    res.json({ success: true, message: 'Desconectado do Google' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/status/:usuarioId/:perfilId
 * Verifica se o perfil está conectado ao Google
 */
router.get('/google/status/:usuarioId/:perfilId', async (req, res) => {
  try {
    const { usuarioId, perfilId } = req.params;

    const tokensDoc = await db.collection('gmn_google_tokens').doc(`${usuarioId}_${perfilId}`).get();

    res.json({
      conectado: tokensDoc.exists,
      ultimaSincronizacao: tokensDoc.data()?.atualizadoEm || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
