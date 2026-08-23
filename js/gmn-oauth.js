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

    // Primeiro, verificar se há um accessToken no sessionStorage (vindo do OAuth callback)
    const accessTokenDoCallback = sessionStorage.getItem('gmnAccessToken');
    if (accessTokenDoCallback) {
      console.log('✓ Token do OAuth callback encontrado, puxando perfis...');
      await buscarPerfisGMB(accessTokenDoCallback);
      sessionStorage.removeItem('gmnAccessToken'); // Limpar após usar
    } else {
      // Se não há token novo, carregar tokens salvos
      await carregarTokensSalvos();
      if (state.tokens.length > 0) {
        await carregarPerfisParaTodosTokens();
      }
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
      console.log(`✓ ${state.tokens.length} token(s) carregado(s) do Firebase`);
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
      state.carregando = true;
      const response = await fetch(`/api/auth/google/buscar-perfis?accessToken=${encodeURIComponent(accessToken)}&usuarioId=${encodeURIComponent(state.usuarioId)}`);
      const data = await response.json();

      if (data.sucesso && data.perfis && data.perfis.length > 0) {
        console.log(`✓ ${data.perfis.length} perfil(is) encontrado(s) no Google My Business`);
        state.perfisConectados = data.perfis;
        salvarPerfisNoFirebase(data.perfis);
        return data.perfis;
      } else if (!data.sucesso) {
        console.warn('⚠️ Erro ao buscar perfis:', data.message);
        return [];
      }

      return [];
    } catch (error) {
      console.error('Erro ao buscar perfis GMB:', error);
      return [];
    } finally {
      state.carregando = false;
    }
  }

  /**
   * Salvar perfis no Firebase para cache local
   */
  async function salvarPerfisNoFirebase(perfis) {
    try {
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
    return state.perfisConectados || [];
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
      state.carregando = true;
      const response = await fetch(`/api/auth/google/url?usuarioId=${encodeURIComponent(state.usuarioId)}`);
      const data = await response.json();

      if (data.url) {
        console.log('→ Redirecionando para Google OAuth...');
        window.location.href = data.url;
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      state.carregando = false;
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
