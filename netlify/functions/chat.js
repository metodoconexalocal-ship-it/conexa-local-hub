/**
 * DC Hub — Função serverless de IA
 * Protegida contra: abuso de origem, payloads gigantes, ausência de chave
 */

// ── Rate limiting simples em memória ────────────────────────────────────────
// Netlify reutiliza containers por alguns minutos, então isso tem efeito real
const _requests = new Map();
const RATE_LIMIT   = 20;    // máximo de requisições
const RATE_WINDOW  = 60000; // por 60 segundos

function checkRateLimit(ip) {
  const now  = Date.now();
  const data = _requests.get(ip) || { count: 0, start: now };

  if (now - data.start > RATE_WINDOW) {
    // Janela expirou — reinicia
    _requests.set(ip, { count: 1, start: now });
    return true;
  }

  if (data.count >= RATE_LIMIT) return false; // bloqueado

  data.count++;
  _requests.set(ip, data);
  return true;
}

// ── Origens permitidas ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://digitalcreatehub.netlify.app',
  'https://digitalcreate.com.br',
  'https://www.digitalcreate.com.br',
  'http://localhost:3000',   // desenvolvimento local
  'http://127.0.0.1:5500',   // Live Server VS Code
  'http://127.0.0.1:8080',
];

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';

  const headers = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };

  // ── Preflight CORS ─────────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // ── Apenas POST ────────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Verificar chave da API ─────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[chat] ANTHROPIC_API_KEY não configurada');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuração interna ausente' }) };
  }

  // ── Rate limiting por IP ───────────────────────────────────────────────────
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || event.headers['client-ip']
           || 'unknown';

  if (!checkRateLimit(ip)) {
    return {
      statusCode: 429,
      headers: { ...headers, 'Retry-After': '60' },
      body: JSON.stringify({ error: 'Muitas requisições. Aguarde 1 minuto.' }),
    };
  }

  // ── Validar body ───────────────────────────────────────────────────────────
  let messages, systemPrompt;
  try {
    if (!event.body || event.body.length > 32768) { // máx 32KB
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payload muito grande' }) };
    }
    ({ messages, systemPrompt } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  // ── Validar estrutura dos dados ────────────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensagens inválidas' }) };
  }

  // Cada mensagem não pode ser gigante
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Formato de mensagem inválido' }) };
    }
    if (msg.content.length > 8000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensagem muito longa' }) };
    }
  }

  // ── Chamar Claude ──────────────────────────────────────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          process.env.ANTHROPIC_API_KEY,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system:     typeof systemPrompt === 'string' ? systemPrompt.substring(0, 2000) : '',
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[chat] Erro Anthropic:', data.error);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.error?.message || 'Erro na IA' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ content: data.content[0].text }),
    };

  } catch (e) {
    console.error('[chat] Exceção:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
    };
  }
};
