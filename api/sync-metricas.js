// 📊 SINCRONIZAR MÉTRICAS - Puxar dados reais do Google

const express = require('express');
const { google } = require('googleapis');
const googleOAuth = require('../lib/google-oauth');
const { db } = require('../js/firebase-config');
const router = express.Router();

/**
 * POST /api/sync-metricas/trigger
 * Dispara sincronização manual das métricas
 */
router.post('/trigger', async (req, res) => {
  try {
    const { usuarioId, perfilId } = req.body;

    if (!usuarioId || !perfilId) {
      return res.status(400).json({ error: 'usuarioId e perfilId obrigatórios' });
    }

    // Executar sincronização
    const result = await sincronizarMetricas(usuarioId, perfilId);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Função principal de sincronização
 */
async function sincronizarMetricas(usuarioId, perfilId) {
  try {
    console.log(`📊 Sincronizando métricas para ${perfilId}...`);

    // 1. Configurar client com token válido
    const authClient = await googleOAuth.configurarClientComToken(usuarioId, perfilId);

    // 2. Recuperar dados do perfil GMN
    const perfilDoc = await db.collection('gmn_perfis').doc(perfilId).get();
    const perfil = perfilDoc.data();

    if (!perfil.linkPerfil) {
      throw new Error('Perfil do Google não vinculado (linkPerfil vazio)');
    }

    // 3. Extrair business ID do link
    const businessId = extrairBusinessId(perfil.linkPerfil);

    // 4. Puxar dados do Google My Business
    const metricas = await puxarMetricasGoogle(authClient, businessId);

    // 5. Salvar no Firestore
    await salvarMetricasFirestore(perfilId, metricas);

    // 6. Atualizar data de sincronização
    await db.collection('gmn_perfis').doc(perfilId).update({
      google_sync_date: new Date(),
      google_sync_status: 'success',
    });

    console.log(`✅ Métricas sincronizadas para ${perfilId}`);

    return metricas;
  } catch (error) {
    console.error('Erro na sincronização:', error);

    // Atualizar status de erro
    await db.collection('gmn_perfis').doc(perfilId).update({
      google_sync_status: 'error',
      google_sync_error: error.message,
    });

    throw error;
  }
}

/**
 * Extrair Business ID do link do Google
 * Ex: https://www.google.com/maps/place/.../ → ChIJXXXXXXXXXXXXXXXXX
 */
function extrairBusinessId(linkPerfil) {
  // Padrão Google Maps
  const match = linkPerfil.match(/place\/[^/]+\/\@[^,]+,([^z]+)z/);
  if (match) return match[1];

  // Padrão alternativo
  const match2 = linkPerfil.match(/ChIJ[A-Za-z0-9_-]+/);
  if (match2) return match2[0];

  return linkPerfil; // Retornar como está se não conseguir extrair
}

/**
 * Puxar dados do Google My Business API
 */
async function puxarMetricasGoogle(authClient, businessId) {
  try {
    const mybusiness = google.mybusiness('v4');

    // Formato de data para os últimos 30 dias
    const dataFim = new Date();
    const dataInicio = new Date(dataFim.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    const dataFimStr = dataFim.toISOString().split('T')[0];

    // Puxar métricas
    const response = await mybusiness.locations.reports.list({
      auth: authClient,
      parent: `accounts/*/locations/${businessId}`,
      startDate: { year: dataInicio.getFullYear(), month: dataInicio.getMonth() + 1, day: dataInicio.getDate() },
      endDate: { year: dataFim.getFullYear(), month: dataFim.getMonth() + 1, day: dataFim.getDate() },
      pageSize: 100,
    });

    const metrics = response.data.locationMetrics || [];

    // Processar dados
    const metricas = processarMetricas(metrics);

    return metricas;
  } catch (error) {
    console.error('Erro ao puxar métricas do Google:', error);

    // Se API falhar, retornar zeros (para não quebrar o fluxo)
    return {
      chamadas: 0,
      mensagens: 0,
      direcoes: 0,
      websiteClicks: 0,
      visualizacoes: 0,
      buscasLocais: 0,
      posts: [],
      fotos: [],
      videos: [],
      error: error.message,
    };
  }
}

/**
 * Processar métricas brutos do Google
 */
function processarMetricas(metrics) {
  const metricas = {
    chamadas: 0,
    mensagens: 0,
    direcoes: 0,
    websiteClicks: 0,
    visualizacoes: 0,
    buscasLocais: 0,
    posts: [],
    fotos: [],
    videos: [],
    timestamp: new Date(),
  };

  // Processar cada métrica
  if (metrics.length > 0) {
    const metric = metrics[0];

    // Actions (interações)
    if (metric.actionMetrics) {
      metric.actionMetrics.forEach((action) => {
        switch (action.actionType) {
          case 'CALL':
            metricas.chamadas = action.count || 0;
            break;
          case 'MESSAGE':
            metricas.mensagens = action.count || 0;
            break;
          case 'DIRECTION':
            metricas.direcoes = action.count || 0;
            break;
          case 'WEBSITE':
            metricas.websiteClicks = action.count || 0;
            break;
        }
      });
    }

    // Views (visualizações)
    if (metric.viewMetrics) {
      metric.viewMetrics.forEach((view) => {
        if (view.viewType === 'PROFILE_VIEWS') {
          metricas.visualizacoes = view.count || 0;
        } else if (view.viewType === 'SEARCH_VIEWS') {
          metricas.buscasLocais = view.count || 0;
        }
      });
    }
  }

  return metricas;
}

/**
 * Salvar métricas no Firestore
 */
async function salvarMetricasFirestore(perfilId, metricas) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Coleção gmn_metricas com data como documento
    await db.collection('gmn_metricas').doc(`${perfilId}_${today}`).set({
      perfilId,
      data: today,
      chamadas: metricas.chamadas || 0,
      mensagens: metricas.mensagens || 0,
      direcoes: metricas.direcoes || 0,
      websiteClicks: metricas.websiteClicks || 0,
      visualizacoes: metricas.visualizacoes || 0,
      buscasLocais: metricas.buscasLocais || 0,
      posts: metricas.posts || [],
      fotos: metricas.fotos || [],
      videos: metricas.videos || [],
      timestamp: metricas.timestamp,
    });

    console.log(`✅ Métricas salvas: ${perfilId} - ${today}`);
  } catch (error) {
    console.error('Erro ao salvar no Firestore:', error);
    throw error;
  }
}

/**
 * GET /api/sync-metricas/:perfilId
 * Recuperar métricas do último mês
 */
router.get('/:perfilId', async (req, res) => {
  try {
    const { perfilId } = req.params;

    // Puxar últimos 30 docs
    const query = await db
      .collection('gmn_metricas')
      .where('perfilId', '==', perfilId)
      .orderBy('data', 'desc')
      .limit(30)
      .get();

    const metricas = query.docs.map((doc) => doc.data());

    res.json({ metricas });
  } catch (error) {
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
    const today = new Date().toISOString().split('T')[0];

    const doc = await db.collection('gmn_metricas').doc(`${perfilId}_${today}`).get();

    if (!doc.exists) {
      return res.json({ metricas: null, mensagem: 'Nenhuma métrica para hoje' });
    }

    res.json({ metricas: doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.sincronizarMetricas = sincronizarMetricas;
