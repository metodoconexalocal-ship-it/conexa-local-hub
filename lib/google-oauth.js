// 🔐 Google OAuth 2.0 (server-side)
// Os tokens NUNCA vão para o navegador. O refresh token fica num cookie httpOnly
// criptografado (AES-256-GCM). Cada navegador conecta as próprias contas Google.

const crypto = require('crypto');
const { OAuth2Client } = require("google-auth-library");

const SCOPES = [
  'https://www.googleapis.com/auth/business.manage', // Account Management + Business Information + Performance
  'openid',
  'email',
  'profile',
];

const COOKIE_SESSAO = 'gmn_google';
const COOKIE_STATE = 'gmn_google_state';
const MAX_AGE_SESSAO = 60 * 60 * 24 * 30; // 30 dias
const MAX_AGE_STATE = 60 * 10;            // 10 minutos

// Base pública do app: PUBLIC_BASE_URL (se definida) ou o host da própria requisição
function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${proto}://${req.headers.host}`;
}

function criarClient(req) {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl(req)}/api/auth/google/callback`
  );
}

function urlLogin(req, state) {
  return criarClient(req).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // garante refresh_token em todo consentimento
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });
}

// ── Criptografia do cookie de sessão ────────────────────────────────────────
function chave() {
  const segredo = process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!segredo) throw new Error('Defina SESSION_SECRET ou GOOGLE_CLIENT_SECRET no servidor');
  return crypto.createHash('sha256').update(segredo).digest();
}

function criptografar(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

function descriptografar(valor) {
  if (!valor) return null;
  try {
    const buf = Buffer.from(valor, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const texto = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
    return JSON.parse(texto);
  } catch {
    return null; // cookie adulterado ou chave trocada
  }
}

// ── Cookies ─────────────────────────────────────────────────────────────────
function lerCookie(req, nome) {
  for (const par of (req.headers.cookie || '').split(';')) {
    const [k, ...resto] = par.trim().split('=');
    if (k === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

function definirCookie(req, res, nome, valor, maxAge) {
  const seguro = baseUrl(req).startsWith('https://');
  res.append('Set-Cookie', `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro ? '; Secure' : ''}`);
}

function limparCookie(req, res, nome) {
  definirCookie(req, res, nome, '', 0);
}

function sessaoAtual(req) {
  return descriptografar(lerCookie(req, COOKIE_SESSAO));
}

// ── Chamadas à API do Google ────────────────────────────────────────────────
// Devolve um access token novo a partir do refresh token guardado no cookie.
async function accessTokenDaSessao(req) {
  const sessao = sessaoAtual(req);
  if (!sessao?.refreshToken) return null;
  const client = criarClient(req);
  client.setCredentials({ refresh_token: sessao.refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Google não devolveu access token');
  return { token, sessao };
}

async function googleGet(token, url) {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const texto = await resp.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { dados = { erro: texto.slice(0, 200) }; }
  if (!resp.ok) {
    const erro = new Error(dados.error?.message || dados.erro || `HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}

// Chamada genérica com corpo JSON (PATCH/POST)
async function googleRequest(token, metodo, url, corpo) {
  const resp = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resp.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { dados = { erro: texto.slice(0, 200) }; }
  if (!resp.ok) {
    const erro = new Error(dados.error?.message || dados.erro || `HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}

async function buscarUsuarioGoogle(accessToken) {
  return googleGet(accessToken, 'https://openidconnect.googleapis.com/v1/userinfo');
}

async function revogarToken(refreshToken) {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
  });
}

module.exports = {
  COOKIE_SESSAO,
  COOKIE_STATE,
  MAX_AGE_SESSAO,
  MAX_AGE_STATE,
  criarClient,
  urlLogin,
  criptografar,
  descriptografar,
  lerCookie,
  definirCookie,
  limparCookie,
  sessaoAtual,
  accessTokenDaSessao,
  googleGet,
  googleRequest,
  buscarUsuarioGoogle,
  revogarToken,
};
