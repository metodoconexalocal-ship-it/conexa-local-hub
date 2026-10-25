// 📊 Métricas diárias do Business Profile: montagem da requisição e conversão da resposta.
// Funções puras (sem rede e sem banco) para poderem ser testadas isoladamente.

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

const pad = (n) => String(n).padStart(2, '0');
const formatarData = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// Período que termina 2 dias antes de hoje: o Google publica métricas com esse atraso.
function periodo(dias, hoje = new Date()) {
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  fim.setUTCDate(fim.getUTCDate() - 2);
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));
  return { inicio, fim };
}

// Monta a URL do fetchMultiDailyMetricsTimeSeries para um período.
function urlMetricas(baseUrl, locationId, inicio, fim) {
  const url = new URL(`${baseUrl}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`);
  METRICAS_DIARIAS.forEach((m) => url.searchParams.append('dailyMetrics', m));
  for (const [prefixo, d] of [['start_date', inicio], ['end_date', fim]]) {
    url.searchParams.set(`dailyRange.${prefixo}.year`, d.getUTCFullYear());
    url.searchParams.set(`dailyRange.${prefixo}.month`, d.getUTCMonth() + 1);
    url.searchParams.set(`dailyRange.${prefixo}.day`, d.getUTCDate());
  }
  return url.toString();
}

// Converte a resposta bruta do Google em { 'AAAA-MM-DD': { CALL_CLICKS: n, ... } }.
// Só entram dias que o Google devolveu com valor; dia ausente não vira zero aqui.
function agruparPorDia(resposta) {
  const porDia = {};
  for (const bloco of resposta.multiDailyMetricTimeSeries || []) {
    for (const serie of bloco.dailyMetricTimeSeries || []) {
      for (const ponto of serie.timeSeries?.datedValues || []) {
        const d = ponto.date || {};
        if (!d.year || !d.month || !d.day) continue;
        const chave = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
        const valor = Number(ponto.value ?? 0);
        (porDia[chave] ||= {})[serie.dailyMetric] = valor;
      }
    }
  }
  return porDia;
}

// Linha de um dia já com as colunas do sistema.
function linhaDoDia(data, dia) {
  const soma = (lista) => lista.reduce((t, m) => t + (dia[m] || 0), 0);
  return {
    data,
    chamadas: dia.CALL_CLICKS || 0,
    mensagens: dia.BUSINESS_CONVERSATIONS || 0,
    direcoes: dia.BUSINESS_DIRECTION_REQUESTS || 0,
    websiteClicks: dia.WEBSITE_CLICKS || 0,
    visualizacoes: soma(IMPRESSOES_TOTAIS),
    buscasLocais: soma(IMPRESSOES_BUSCA),
  };
}

// Série contínua do período (dia sem dado aparece como 0) e totais.
// Usado na tela. Os totais são a soma exata dos dias da série.
function montarSerie(porDia, inicio, fim) {
  const serie = [];
  for (let d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const data = formatarData(d);
    serie.push(linhaDoDia(data, porDia[data] || {}));
  }
  const soma = (campo) => serie.reduce((t, l) => t + l[campo], 0);
  const totais = {
    chamadas: soma('chamadas'),
    mensagens: soma('mensagens'),
    direcoes: soma('direcoes'),
    websiteClicks: soma('websiteClicks'),
    visualizacoes: soma('visualizacoes'),
    buscasLocais: soma('buscasLocais'),
  };
  return { serie, totais };
}

module.exports = {
  METRICAS_DIARIAS,
  periodo,
  urlMetricas,
  agruparPorDia,
  linhaDoDia,
  montarSerie,
  formatarData,
};
