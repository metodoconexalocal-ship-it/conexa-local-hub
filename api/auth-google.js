// 🔐 Google OAuth Endpoints — Multi-Tenant (por usuário logado)
const express = require('express');
const googleOAuth = require('../lib/google-oauth');
const { db, collections, isConnected } = require('../lib/firebase-config');
const router = express.Router();

/**
 * Middleware: Obter usuário logado da sessão
 */
const getLoggedInUser = (req) => {
  return req.headers['x-user-id'] || req.query.usuarioId || 'usuario-padrao';
};

/**
 * GET /api/auth/google/url
 * Retorna URL para fazer login no Google (vinculado ao usuário logado)
 */
router.get('/google/url', (req, res) => {
  try {
    // Validar se credenciais do Google estão configuradas
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(400).json({
        error: 'Credenciais do Google não configuradas',
        message: 'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no arquivo .env',
        detalhes: 'Veja .env.example para referência',
        docs: 'https://console.cloud.google.com/apis/credentials'
      });
    }

    const usuarioId = getLoggedInUser(req);
    const url = googleOAuth.gerarUrlAutenticacao();

    // Armazenar usuarioId na sessão para recuperar no callback
    res.json({
      url,
      message: 'Clique neste link para fazer login com Google',
      usuarioId: usuarioId,
      callbackUrl: `/api/auth/google/callback?usuarioId=${encodeURIComponent(usuarioId)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/callback
 * Recebe o código do Google e troca por token, vincula ao usuário
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, usuarioId } = req.query;
    const usuarioLogado = usuarioId || getLoggedInUser(req);

    if (!code) {
      return res.status(400).json({ error: 'Código de autenticação não recebido' });
    }

    // Trocar código por tokens
    const tokens = await googleOAuth.trocarCodigoPorToken(code);

    // Salvar tokens no Firebase vinculados ao usuário logado
    if (isConnected() && db && tokens.access_token) {
      try {
        const tokenDocId = `${usuarioLogado}_${Date.now()}`;
        await db.collection(collections.GOOGLE_TOKENS).doc(tokenDocId).set({
          usuarioId: usuarioLogado,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresIn: tokens.expiry_date,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          ativo: true
        });

        return res.json({
          success: true,
          message: 'Google vinculado com sucesso ao seu usuário',
          usuarioId: usuarioLogado,
          tokens: {
            access_token: tokens.access_token ? '✓ obtido' : '✗ erro',
            refresh_token: tokens.refresh_token ? '✓ obtido' : '✗ erro',
            expiry_date: tokens.expiry_date
          }
        });
      } catch (fbError) {
        console.warn('⚠️  Erro ao salvar tokens no Firebase:', fbError.message);
      }
    }

    res.json({
      success: true,
      message: 'Autenticação bem-sucedida (sem persistência Firebase)',
      usuarioId: usuarioLogado,
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
 * Vincula um perfil GMN ao Google OAuth do usuário logado
 */
router.post('/google/vincular-perfil', async (req, res) => {
  try {
    const { perfilId, nomeExibicao } = req.body;
    const usuarioId = getLoggedInUser(req);

    if (!perfilId) {
      return res.status(400).json({ error: 'perfilId é obrigatório' });
    }

    if (isConnected() && db) {
      try {
        const docId = `${usuarioId}_${perfilId}`;
        await db.collection(collections.GOOGLE_TOKENS).doc(docId).update({
          perfilId: perfilId,
          nomeExibicao: nomeExibicao || perfilId,
          atualizadoEm: new Date()
        });

        return res.json({
          success: true,
          message: 'Perfil vinculado ao Google com sucesso',
          usuarioId,
          perfilId
        });
      } catch (fbError) {
        console.warn('⚠️  Erro ao vincular perfil:', fbError.message);
      }
    }

    res.json({
      success: true,
      message: 'Perfil vinculado (sem persistência)',
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
 * Desvincula Google do perfil do usuário logado
 */
router.post('/google/desconectar', async (req, res) => {
  try {
    const { perfilId } = req.body;
    const usuarioId = getLoggedInUser(req);

    if (!perfilId) {
      return res.status(400).json({ error: 'perfilId é obrigatório' });
    }

    if (isConnected() && db) {
      try {
        const docId = `${usuarioId}_${perfilId}`;
        await db.collection(collections.GOOGLE_TOKENS).doc(docId).update({
          ativo: false,
          desconectadoEm: new Date()
        });

        return res.json({
          success: true,
          message: 'Desconectado do Google com sucesso',
          usuarioId,
          perfilId
        });
      } catch (fbError) {
        console.warn('⚠️  Erro ao desconectar:', fbError.message);
      }
    }

    res.json({
      success: true,
      message: 'Desconectado com sucesso',
      usuarioId,
      perfilId
    });
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/perfis-do-usuario
 * Lista todos os perfis Google vinculados ao usuário logado
 */
router.get('/google/perfis-do-usuario', async (req, res) => {
  try {
    const usuarioId = getLoggedInUser(req);
    let perfis = [];

    if (isConnected() && db) {
      try {
        const query = await db.collection(collections.GOOGLE_TOKENS)
          .where('usuarioId', '==', usuarioId)
          .where('ativo', '==', true)
          .get();

        perfis = query.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (fbError) {
        console.warn('⚠️  Erro ao buscar perfis:', fbError.message);
      }
    }

    res.json({
      usuarioId,
      perfis: perfis,
      total: perfis.length
    });
  } catch (error) {
    console.error('Erro ao buscar perfis:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/buscar-perfis
 * Busca perfis reais do Google My Business usando access token
 */
router.get('/google/buscar-perfis', async (req, res) => {
  try {
    const { accessToken } = req.query;
    const usuarioId = getLoggedInUser(req);

    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken é obrigatório' });
    }

    try {
      // 🚀 DEMO MODE: Usar dados mock enquanto permissões do Google não estão configuradas
      // TODO: Substituir por chamadas à API real quando Google My Business estiver autorizada

      console.log('[GMB] Modo Demo - Retornando perfis mock');

      // Dados mock para demonstração
      const perfis = [
        {
          perfilId: 'conexa-local-001',
          nomeExibicao: 'Conexa Local | SEO Local e Google Empresas | Amanda Sestren Silveira',
          endereco: 'Rua das Flores, 123 - Palhoça, SC 88055-300',
          telefone: '(48) 99698-9531',
          website: 'https://conexalocal.com.br',
          sincronizadoEm: new Date().toISOString()
        },
        {
          perfilId: 'dc-agency-001',
          nomeExibicao: 'DigitalCreate Agency | Agência de Marketing Digital',
          endereco: 'Centro - São José, SC',
          telefone: '(48) 3244-5050',
          website: 'https://digitalcreate.com.br',
          sincronizadoEm: new Date().toISOString()
        }
      ];

      res.json({
        sucesso: true,
        usuarioId,
        perfis: perfis,
        total: perfis.length,
        message: `✓ Carregados ${perfis.length} perfil(is) (DEMO MODE)`
      });
    } catch (gmError) {
      console.error('Erro ao buscar perfis:', gmError.message);
      res.json({
        sucesso: false,
        usuarioId,
        perfis: [],
        message: 'Erro ao buscar perfis',
        erro: gmError.message
      });
    }
  } catch (error) {
    console.error('Erro ao buscar perfis:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/google/status/:perfilId
 * Verifica status da conexão Google para um perfil específico
 */
router.get('/google/status/:perfilId', async (req, res) => {
  try {
    const { perfilId } = req.params;
    const usuarioId = getLoggedInUser(req);
    let conectado = false;
    let ultimaSincronizacao = null;

    if (isConnected() && db) {
      try {
        const docId = `${usuarioId}_${perfilId}`;
        const doc = await db.collection(collections.GOOGLE_TOKENS).doc(docId).get();

        if (doc.exists) {
          const data = doc.data();
          conectado = data.ativo && !!data.accessToken;
          ultimaSincronizacao = data.atualizadoEm;
        }
      } catch (fbError) {
        console.warn('⚠️  Erro ao verificar status:', fbError.message);
      }
    }

    res.json({
      conectado,
      ultimaSincronizacao,
      usuarioId,
      perfilId
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
