// 🔐 GOOGLE OAUTH - Autenticação e Tokens

const { google } = require('googleapis');
const { db, collections } = require('../lib/firebase-config');

// Configurar OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // http://localhost:3000/api/auth/google/callback
);

// 1️⃣ GERAR URL DE AUTENTICAÇÃO
function gerarUrlAutenticacao() {
  const scopes = [
    'https://www.googleapis.com/auth/business.manage', // Google My Business
    'https://www.googleapis.com/auth/plus.me', // Perfil do usuário
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  return url;
}

// 2️⃣ TROCAR CÓDIGO POR TOKEN
async function trocarCodigoPorToken(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Erro ao trocar código por token:', error);
    throw error;
  }
}

// 3️⃣ SALVAR TOKENS NO FIRESTORE
async function salvarTokensFirestore(usuarioId, perfilId, tokens) {
  try {
    const doc = await db.collection('gmn_google_tokens').doc(`${usuarioId}_${perfilId}`).set({
      usuarioId,
      perfilId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expiry_date,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Erro ao salvar tokens:', error);
    throw error;
  }
}

// 4️⃣ RECUPERAR TOKENS DO FIRESTORE
async function recuperarTokensFirestore(usuarioId, perfilId) {
  try {
    const doc = await db.collection('gmn_google_tokens').doc(`${usuarioId}_${perfilId}`).get();

    if (!doc.exists) return null;

    const data = doc.data();
    return {
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expiry_date: data.expiresIn,
    };
  } catch (error) {
    console.error('Erro ao recuperar tokens:', error);
    throw error;
  }
}

// 5️⃣ REFRESCAR TOKEN (quando expirar)
async function refrescarToken(usuarioId, perfilId) {
  try {
    const tokens = await recuperarTokensFirestore(usuarioId, perfilId);

    if (!tokens || !tokens.refresh_token) {
      throw new Error('Refresh token não encontrado. Faça login novamente.');
    }

    oauth2Client.setCredentials(tokens);
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Atualizar tokens no Firestore
    await db.collection('gmn_google_tokens').doc(`${usuarioId}_${perfilId}`).update({
      accessToken: credentials.access_token,
      expiresIn: credentials.expiry_date,
      atualizadoEm: new Date(),
    });

    return credentials;
  } catch (error) {
    console.error('Erro ao refrescar token:', error);
    throw error;
  }
}

// 6️⃣ CONFIGURAR CLIENT COM TOKEN VÁLIDO
async function configurarClientComToken(usuarioId, perfilId) {
  try {
    let tokens = await recuperarTokensFirestore(usuarioId, perfilId);

    if (!tokens) {
      throw new Error('Tokens não encontrados. Faça login no Google.');
    }

    // Verificar se token expirou
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      tokens = await refrescarToken(usuarioId, perfilId);
    }

    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  } catch (error) {
    console.error('Erro ao configurar client:', error);
    throw error;
  }
}

module.exports = {
  gerarUrlAutenticacao,
  trocarCodigoPorToken,
  salvarTokensFirestore,
  recuperarTokensFirestore,
  refrescarToken,
  configurarClientComToken,
  oauth2Client,
};
