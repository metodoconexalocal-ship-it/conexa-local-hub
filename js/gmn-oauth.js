/**
 * GMNOAuth — cliente do Google Business Profile.
 * Não guarda token nenhum: a sessão Google fica no cookie httpOnly do servidor.
 */
window.GMNOAuth = (() => {
  async function chamar(url, opcoes = {}) {
    const resp = await fetch(url, { credentials: 'same-origin', ...opcoes });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || `Erro HTTP ${resp.status}`);
    return dados;
  }

  return {
    status: () => chamar('/api/auth/google/status'),
    conectar: () => { window.location.href = '/api/auth/google/login'; },
    desconectar: () => chamar('/api/auth/google/desconectar', { method: 'POST' }),
    listarPerfis: () => chamar('/api/auth/google/perfis'),
    saude: () => chamar('/api/auth/google/saude'),
    sincronizar: (id, dias = 30) => chamar(`/api/auth/google/sincronizar/${encodeURIComponent(id)}?dias=${dias}`, { method: 'POST' }),
    historico: (id, dias = 30) => chamar(`/api/auth/google/historico/${encodeURIComponent(id)}?dias=${dias}`),
    perfilEditavel: (id) => chamar(`/api/auth/google/perfil/${encodeURIComponent(id)}`),
    salvarPerfil: (id, campos) => chamar(`/api/auth/google/perfil/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    }),
    metricas: (locationId, dias = 30) =>
      chamar(`/api/auth/google/metricas?locationId=${encodeURIComponent(locationId)}&dias=${dias}`),
  };
})();
