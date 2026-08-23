/**
 * GMN OAuth — Gerenciamento de autenticação Google My Business
 * Lida com token, perfis conectados e sincronização de dados
 */

window.GMNOAuth = (() => {
  const state = {
    usuarioId: null,
    tokens: [],
    perfisConectados: [],
    carregando: false
  };

  /**
   * Inicializar com ID do usuário
   */
  async function inicializar(usuarioId) {
    state.usuarioId = usuarioId;
    await carregarTokensSalvos();
    if (state.tokens.length > 0) {
      await carregarPerfisParaTodosTokens();
    }
  }

  /**
   * Carregar tokens salvos do Firebase para este usuário
   */
  async function carregarTokensSalvos() {
    try {
      const response = await fetch(`/api/auth/google/perfis-do-usuario?usuarioId=${encodeURIComponent(state.usuarioId)}`);
      const data = await response.json();
      state.tokens = data.perfis || [];
      return state.tokens;
    } catch (error) {
      console.error('Erro ao carregar tokens:', error);
      return [];
    }
  }

  /**
   * Carregar perfis do GMB para todos os tokens disponíveis
   */
  async function carregarPerfisParaTodosTokens() {
    if (state.tokens.length === 0) return [];

    state.carregando = true;
    state.perfisConectados = [];

    for (const token of state.tokens) {
      if (token.accessToken) {
        await buscarPerfisGMB(token.accessToken);
      }
    }

    state.carregando = false;
    return state.perfisConectados;
  }

  /**
   * Buscar perfis reais do GMB usando um token específico
   */
  async function buscarPerfisGMB(accessToken) {
    try {
      const response = await fetch(`/api/auth/google/buscar-perfis?accessToken=${encodeURIComponent(accessToken)}&usuarioId=${encodeURIComponent(state.usuarioId)}`);
      const data = await response.json();

      if (data.sucesso && data.perfis && data.perfis.length > 0) {
        state.perfisConectados.push(...data.perfis);
        salvarPerfisNoFirebase(data.perfis);
      }

      return data.perfis || [];
    } catch (error) {
      console.error('Erro ao buscar perfis GMB:', error);
      return [];
    }
  }

  /**
   * Salvar perfis no Firebase para cache local
   */
  async function salvarPerfisNoFirebase(perfis) {
    try {
      // Simples: armazenar no localStorage também como backup
      localStorage.setItem(`gmn_perfis_${state.usuarioId}`, JSON.stringify({
        perfis,
        sincronizadoEm: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Erro ao salvar perfis no cache:', error);
    }
  }

  /**
   * Obter perfis conectados
   */
  function obterPerfisConectados() {
    return state.perfisConectados;
  }

  /**
   * Verificar se há tokens conectados
   */
  function temTokensConectados() {
    return state.tokens.length > 0;
  }

  /**
   * Fazer login com Google
   */
  async function fazerLoginGoogle() {
    try {
      const response = await fetch(`/api/auth/google/url?usuarioId=${encodeURIComponent(state.usuarioId)}`);
      const data = await response.json();

      if (data.url) {
        // Redirecionar para Google OAuth
        window.location.href = data.url;
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao fazer login Google:', error);
      alert('Erro ao conectar com Google: ' + error.message);
    }
  }

  /**
   * Desconectar uma conta
   */
  async function desconectar(tokenId) {
    try {
      const response = await fetch(`/api/auth/google/desconectar?tokenId=${encodeURIComponent(tokenId)}&usuarioId=${encodeURIComponent(state.usuarioId)}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        // Recarregar tokens e perfis
        await carregarTokensSalvos();
        state.perfisConectados = [];
        if (state.tokens.length > 0) {
          await carregarPerfisParaTodosTokens();
        }
        return true;
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
    }
    return false;
  }

  /**
   * Sincronizar métricas de um perfil
   */
  async function sincronizarMetricas(perfilId) {
    try {
      const response = await fetch(`/api/sync-metricas/sincronizar?perfilId=${encodeURIComponent(perfilId)}&usuarioId=${encodeURIComponent(state.usuarioId)}`, {
        method: 'POST'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao sincronizar métricas:', error);
      return null;
    }
  }

  return {
    inicializar,
    carregarTokensSalvos,
    carregarPerfisParaTodosTokens,
    buscarPerfisGMB,
    obterPerfisConectados,
    temTokensConectados,
    fazerLoginGoogle,
    desconectar,
    sincronizarMetricas,
    getState: () => state
  };
})();
