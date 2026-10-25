// 🔐 Google Business Profile — endpoints (multi-conta por navegador, tokens só no servidor)
const crypto = require('crypto');
const express = require('express');
const g = require('../lib/google-oauth');
const m = require('../lib/metricas-gbp');
const persistencia = require('../lib/persistencia-gbp');
const { db, isConnected } = require('../lib/firebase-config');

const router = express.Router();

const URL_CONTAS = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const URL_LOCAIS = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const URL_PERFORMANCE = 'https://businessprofileperformance.googleapis.com/v1';

const bancoNaoConectado = (res) =>
  res.status(503).json({
    erro: 'Banco de dados não conectado no servidor.',
    dica: 'Configure FIREBASE_SERVICE_ACCOUNT_JSON na Vercel e faça um redeploy.',
  });

// Busca métricas do Google para um período e devolve a resposta já convertida
async function buscarMetricas(token, locationId, dias) {
  const { inicio, fim } = m.periodo(dias);
  const bruto = await g.googleGet(token, m.urlMetricas(URL_PERFORMANCE, locationId, inicio, fim));
  const porDia = m.agruparPorDia(bruto);
  return { inicio, fim, porDia, ...m.montarSerie(porDia, inicio, fim) };
}

const sessaoNaoConectada = (res) =>
  res.status(401).json({ erro: 'Conta Google não conectada. Clique em "Conectar" novamente.' });

function tratarErro(res, e) {
  const motivo = e.response?.data?.error || e.message;
  console.error('[Google API]', e.status || '', motivo);
  if (String(motivo).includes('invalid_grant')) {
    return res.status(401).json({ erro: 'Sessão Google expirada. Clique em "Conectar" novamente.' });
  }
  if (e.status === 403) {
    return res.status(403).json({
      erro: `Google recusou o acesso: ${e.message}`,
      dica: 'Confirme que as APIs "My Business Account Management", "My Business Business Information" e "Business Profile Performance" estão ativadas no projeto e que a conta conectada tem acesso de gerente ao perfil.',
    });
  }
  res.status(e.status || 500).json({ erro: e.message });
}

function formatarPerfil(local, conta) {
  const end = local.storefrontAddress || {};
  const endereco = [...(end.addressLines || []), end.locality, end.administrativeArea]
    .filter(Boolean)
    .join(', ');
  return {
    id: local.name.split('/').pop(),
    nome: local.title || 'Sem nome',
    endereco,
    telefone: local.phoneNumbers?.primaryPhone || '',
    site: local.websiteUri || '',
    mapsUri: local.metadata?.mapsUri || '',
    conta: conta.accountName || conta.name,
  };
}

// GET /api/auth/google/login — redireciona para o consentimento do Google
router.get('/google/login', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não configurados no servidor.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  g.definirCookie(req, res, g.COOKIE_STATE, state, g.MAX_AGE_STATE);
  res.redirect(g.urlLogin(req, state));
});

// GET /api/auth/google/callback — troca o código por tokens e guarda só o refresh token (cifrado)
router.get('/google/callback', async (req, res) => {
  const voltar = (query) => res.redirect(`/?tab=gmn-metricas&${query}`);
  try {
    const { code, state, error } = req.query;
    const stateEsperado = g.lerCookie(req, g.COOKIE_STATE);
    g.limparCookie(req, res, g.COOKIE_STATE);

    if (error) return voltar(`oauth=erro&motivo=${encodeURIComponent(error)}`);
    if (!code || !state || !stateEsperado || state !== stateEsperado) {
      return voltar('oauth=erro&motivo=state_invalido');
    }

    const client = g.criarClient(req);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      // Google só emite refresh_token quando o consentimento é dado; sem ele a sessão não dura.
      return voltar('oauth=erro&motivo=sem_refresh_token');
    }

    const usuario = await g.buscarUsuarioGoogle(tokens.access_token);
    g.definirCookie(
      req,
      res,
      g.COOKIE_SESSAO,
      g.criptografar({ refreshToken: tokens.refresh_token, email: usuario.email, nome: usuario.name || '' }),
      g.MAX_AGE_SESSAO
    );
    voltar('oauth=ok');
  } catch (e) {
    console.error('[OAuth callback]', e.message);
    voltar(`oauth=erro&motivo=${encodeURIComponent(e.message)}`);
  }
});

// GET /api/auth/google/status
router.get('/google/status', (req, res) => {
  const sessao = g.sessaoAtual(req);
  res.json({
    conectado: !!sessao?.refreshToken,
    email: sessao?.email || null,
    nome: sessao?.nome || null,
  });
});

// POST /api/auth/google/desconectar — revoga o token no Google e limpa o cookie
router.post('/google/desconectar', async (req, res) => {
  const sessao = g.sessaoAtual(req);
  if (sessao?.refreshToken) {
    try { await g.revogarToken(sessao.refreshToken); } catch (e) { console.warn('[revoke]', e.message); }
  }
  g.limparCookie(req, res, g.COOKIE_SESSAO);
  res.json({ ok: true });
});

// GET /api/auth/google/perfis — todos os perfis (locais) de todas as contas GBP acessíveis
router.get('/google/perfis', async (req, res) => {
  try {
    const sess = await g.accessTokenDaSessao(req);
    if (!sess) return sessaoNaoConectada(res);

    const { accounts = [] } = await g.googleGet(sess.token, URL_CONTAS);
    const perfis = [];

    for (const conta of accounts) {
      let pageToken;
      do {
        const url = new URL(`${URL_LOCAIS}/${conta.name}/locations`);
        url.searchParams.set('readMask', 'name,title,storefrontAddress,phoneNumbers,websiteUri,metadata');
        url.searchParams.set('pageSize', '100');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const pagina = await g.googleGet(sess.token, url.toString());
        for (const local of pagina.locations || []) perfis.push(formatarPerfil(local, conta));
        pageToken = pagina.nextPageToken;
      } while (pageToken);
    }

    perfis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Guarda a lista no banco, se houver. Sem banco, a tela funciona mas avisa que não salvou.
    let salvos = 0;
    if (isConnected()) {
      salvos = await persistencia.salvarPerfis(db, sess.sessao.email, perfis);
    }
    res.json({
      ok: true,
      conta: sess.sessao.email,
      total: perfis.length,
      perfis,
      salvo: isConnected(),
      perfisSalvos: salvos,
    });
  } catch (e) {
    tratarErro(res, e);
  }
});

// GET /api/auth/google/metricas?locationId=123&dias=30 — leitura ao vivo do Google (não grava)
router.get('/google/metricas', async (req, res) => {
  try {
    const locationId = String(req.query.locationId || '').replace(/\D/g, '');
    if (!locationId) return res.status(400).json({ erro: 'locationId inválido' });
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 90);

    const sess = await g.accessTokenDaSessao(req);
    if (!sess) return sessaoNaoConectada(res);

    const { inicio, fim, serie, totais } = await buscarMetricas(sess.token, locationId, dias);
    res.json({
      ok: true,
      locationId,
      periodo: { inicio: m.formatarData(inicio), fim: m.formatarData(fim), dias },
      totais,
      serie,
    });
  } catch (e) {
    tratarErro(res, e);
  }
});

// POST /api/auth/google/sincronizar/:locationId?dias=30
// Busca no Google e GRAVA no banco os dias que o Google devolveu com dados.
router.post('/google/sincronizar/:locationId', async (req, res) => {
  try {
    if (!isConnected()) return bancoNaoConectado(res);
    const locationId = req.params.locationId.replace(/\D/g, '');
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 90);

    const sess = await g.accessTokenDaSessao(req);
    if (!sess) return sessaoNaoConectada(res);

    const { inicio, fim, porDia } = await buscarMetricas(sess.token, locationId, dias);
    const diasGravados = await persistencia.salvarMetricas(db, sess.sessao.email, locationId, porDia);

    res.json({
      ok: true,
      locationId,
      periodo: { inicio: m.formatarData(inicio), fim: m.formatarData(fim) },
      diasComDados: diasGravados,
      sincronizadoEm: new Date().toISOString(),
      sincronizadoPor: sess.sessao.email,
    });
  } catch (e) {
    tratarErro(res, e);
  }
});

// GET /api/auth/google/historico/:locationId?dias=30 — o que está salvo no banco
router.get('/google/historico/:locationId', async (req, res) => {
  try {
    if (!isConnected()) return bancoNaoConectado(res);
    const locationId = req.params.locationId.replace(/\D/g, '');
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 365);
    const { inicio, fim } = m.periodo(dias);
    const ini = m.formatarData(inicio);
    const f = m.formatarData(fim);

    const registros = await persistencia.lerHistorico(db, locationId, ini, f);
    const ultima = await persistencia.ultimaSincronizacao(db, locationId);
    res.json({ ok: true, locationId, periodo: { inicio: ini, fim: f }, registros, ...ultima });
  } catch (e) {
    console.error('[historico]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// GET /api/auth/google/saude — situação das duas conexões (Google e banco)
router.get('/google/saude', (req, res) => {
  const sessao = g.sessaoAtual(req);
  res.json({
    banco: isConnected(),
    google: !!sessao?.refreshToken,
    email: sessao?.email || null,
  });
});


// ── Edição do perfil ────────────────────────────────────────────────────────
// Só estes campos podem ser gravados. Cada um vira uma entrada do updateMask.
const CAMPOS_EDITAVEIS = {
  title: { mascara: 'title', corpo: (v) => ({ title: String(v).slice(0, 200) }) },
  telefone: { mascara: 'phoneNumbers', corpo: (v) => ({ phoneNumbers: { primaryPhone: String(v).slice(0, 30) } }) },
  site: { mascara: 'websiteUri', corpo: (v) => ({ websiteUri: String(v).slice(0, 2048) }) },
  descricao: { mascara: 'profile', corpo: (v) => ({ profile: { description: String(v).slice(0, 750) } }) },
};

// GET /api/auth/google/perfil/:locationId — dados atuais para o formulário de edição
router.get('/google/perfil/:locationId', async (req, res) => {
  try {
    const id = req.params.locationId.replace(/\D/g, '');
    const sess = await g.accessTokenDaSessao(req);
    if (!sess) return sessaoNaoConectada(res);

    const url = new URL(`${URL_LOCAIS}/locations/${id}`);
    url.searchParams.set('readMask', 'title,phoneNumbers,websiteUri,profile');
    const local = await g.googleGet(sess.token, url.toString());

    res.json({
      ok: true,
      perfil: {
        id,
        nome: local.title || '',
        telefone: local.phoneNumbers?.primaryPhone || '',
        site: local.websiteUri || '',
        descricao: local.profile?.description || '',
      },
    });
  } catch (e) {
    tratarErro(res, e);
  }
});

// PATCH /api/auth/google/perfil/:locationId — grava no Google os campos enviados
router.patch('/google/perfil/:locationId', async (req, res) => {
  try {
    const id = req.params.locationId.replace(/\D/g, '');
    const sess = await g.accessTokenDaSessao(req);
    if (!sess) return sessaoNaoConectada(res);

    const corpo = {};
    const mascara = [];
    for (const [campo, valor] of Object.entries(req.body || {})) {
      const regra = CAMPOS_EDITAVEIS[campo];
      if (!regra || valor === undefined || valor === null) continue;
      Object.assign(corpo, regra.corpo(valor));
      mascara.push(regra.mascara);
    }
    if (!mascara.length) return res.status(400).json({ erro: 'Nenhum campo válido para atualizar' });

    const url = new URL(`${URL_LOCAIS}/locations/${id}`);
    url.searchParams.set('updateMask', mascara.join(','));
    await g.googleRequest(sess.token, 'PATCH', url.toString(), corpo);

    res.json({ ok: true, atualizado: mascara });
  } catch (e) {
    tratarErro(res, e);
  }
});

module.exports = router;
