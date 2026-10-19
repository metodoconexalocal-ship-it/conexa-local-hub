// 🔐 Google Business Profile — endpoints (multi-conta por navegador, tokens só no servidor)
const crypto = require('crypto');
const express = require('express');
const g = require('../lib/google-oauth');

const router = express.Router();

const URL_CONTAS = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const URL_LOCAIS = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const URL_PERFORMANCE = 'https://businessprofileperformance.googleapis.com/v1';

// Métricas diárias da Business Profile Performance API
const METRICAS_DIARIAS = [
  'CALL_CLICKS',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_DIRECTION_REQUESTS',
  'WEBSITE_CLICKS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
];
const IMPRESSOES_BUSCA = ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'];
const IMPRESSOES_TOTAIS = [...IMPRESSOES_BUSCA, 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'];

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

const formatarData = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

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
    res.json({ ok: true, conta: sess.sessao.email, total: perfis.length, perfis });
  } catch (e) {
    tratarErro(res, e);
  }
});

// GET /api/auth/google/metricas?locationId=123&dias=30
router.get('/google/metricas', async (req, res) => {
  try {
    const locationId = String(req.query.locationId || '').replace(/\D/g, '');
    if (!locationId) return res.status(400).json({ erro: 'locationId inválido' });
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 90);

    const sess = await g.accessTokenDaSessao(req);
    if (!sess) return sessaoNaoConectada(res);

    // O Google publica métricas com ~2 dias de atraso: o período termina em "ontem - 1"
    const fim = new Date();
    fim.setUTCDate(fim.getUTCDate() - 2);
    const inicio = new Date(fim);
    inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));

    const url = new URL(`${URL_PERFORMANCE}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`);
    METRICAS_DIARIAS.forEach((m) => url.searchParams.append('dailyMetrics', m));
    for (const [prefixo, d] of [['start_date', inicio], ['end_date', fim]]) {
      url.searchParams.set(`dailyRange.${prefixo}.year`, d.getUTCFullYear());
      url.searchParams.set(`dailyRange.${prefixo}.month`, d.getUTCMonth() + 1);
      url.searchParams.set(`dailyRange.${prefixo}.day`, d.getUTCDate());
    }

    const dados = await g.googleGet(sess.token, url.toString());

    // Agrupa por dia: { 'AAAA-MM-DD': { CALL_CLICKS: 3, ... } }
    const porDia = {};
    for (const bloco of dados.multiDailyMetricTimeSeries || []) {
      for (const serie of bloco.dailyMetricTimeSeries || []) {
        for (const ponto of serie.timeSeries?.datedValues || []) {
          const chave = formatarData(new Date(Date.UTC(ponto.date.year, ponto.date.month - 1, ponto.date.day)));
          (porDia[chave] ||= {})[serie.dailyMetric] = Number(ponto.value || 0);
        }
      }
    }

    // Preenche todos os dias do período (dia sem dado = zero)
    const soma = (dia, lista) => lista.reduce((t, m) => t + (dia[m] || 0), 0);
    const serie = [];
    for (let d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
      const data = formatarData(d);
      const dia = porDia[data] || {};
      serie.push({
        data,
        chamadas: dia.CALL_CLICKS || 0,
        mensagens: dia.BUSINESS_CONVERSATIONS || 0,
        direcoes: dia.BUSINESS_DIRECTION_REQUESTS || 0,
        websiteClicks: dia.WEBSITE_CLICKS || 0,
        visualizacoes: soma(dia, IMPRESSOES_TOTAIS),
        buscasLocais: soma(dia, IMPRESSOES_BUSCA),
      });
    }

    const totalDe = (campo) => serie.reduce((t, d) => t + d[campo], 0);
    const totais = {
      chamadas: totalDe('chamadas'),
      mensagens: totalDe('mensagens'),
      direcoes: totalDe('direcoes'),
      websiteClicks: totalDe('websiteClicks'),
      visualizacoes: totalDe('visualizacoes'),
      buscasLocais: totalDe('buscasLocais'),
    };

    res.json({
      ok: true,
      locationId,
      periodo: { inicio: formatarData(inicio), fim: formatarData(fim), dias },
      totais,
      serie,
    });
  } catch (e) {
    tratarErro(res, e);
  }
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
