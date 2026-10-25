const assert = require('assert');
const path = require('path');
const m = require(path.join(__dirname, '..', 'lib', 'metricas-gbp'));

// 1) Período: hoje fixo 2026-10-24 → fim = 2026-10-22 (atraso de 2 dias), 7 dias → início 2026-10-16
const { inicio, fim } = m.periodo(7, new Date('2026-10-24T15:00:00Z'));
assert.equal(m.formatarData(fim), '2026-10-22');
assert.equal(m.formatarData(inicio), '2026-10-16');

// 2) URL contém as 8 métricas e o intervalo correto
const url = new URL(m.urlMetricas('https://x/v1', '123', inicio, fim));
assert.equal(url.searchParams.getAll('dailyMetrics').length, 8);
assert.equal(url.searchParams.get('dailyRange.start_date.day'), '16');
assert.equal(url.searchParams.get('dailyRange.end_date.day'), '22');
assert.equal(url.searchParams.get('dailyRange.end_date.month'), '10');

// 3) Resposta simulada do Google (formato multiDailyMetricTimeSeries)
const v = (y, mo, d, value) => ({ date: { year: y, month: mo, day: d }, value: String(value) });
const serie = (metric, pontos) => ({ dailyMetric: metric, timeSeries: { datedValues: pontos } });
const resposta = {
  multiDailyMetricTimeSeries: [
    { dailyMetricTimeSeries: [
      serie('CALL_CLICKS', [v(2026, 10, 20, 3), v(2026, 10, 21, 5)]),
      serie('BUSINESS_CONVERSATIONS', [v(2026, 10, 20, 1)]),
      serie('BUSINESS_DIRECTION_REQUESTS', [v(2026, 10, 21, 2)]),
      serie('WEBSITE_CLICKS', [v(2026, 10, 22, 4)]),
      serie('BUSINESS_IMPRESSIONS_DESKTOP_MAPS', [v(2026, 10, 20, 100)]),
      serie('BUSINESS_IMPRESSIONS_MOBILE_MAPS', [v(2026, 10, 20, 50)]),
      serie('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', [v(2026, 10, 20, 30)]),
      serie('BUSINESS_IMPRESSIONS_MOBILE_SEARCH', [v(2026, 10, 20, 20)]),
    ]},
    { dailyMetricTimeSeries: [
      serie('CALL_CLICKS', [v(2026, 10, 20, 2)]), // mesmo dia em outro bloco: deve somar? não — sobrescreve por métrica
    ]},
  ],
};

const porDia = m.agruparPorDia(resposta);
// Dia 20: CALL_CLICKS apareceu duas vezes (3 e depois 2) → o último valor vence (comportamento definido)
assert.equal(porDia['2026-10-20'].CALL_CLICKS, 2);
assert.equal(porDia['2026-10-20'].BUSINESS_CONVERSATIONS, 1);
assert.equal(porDia['2026-10-21'].CALL_CLICKS, 5);
assert.equal(porDia['2026-10-22'].WEBSITE_CLICKS, 4, 'dia 22 tem website clicks = 4');
assert.ok(!porDia['2026-10-17'], 'dia sem dado não entra em agruparPorDia');

// 4) Série contínua e totais
const { serie: linhas, totais } = m.montarSerie(porDia, inicio, fim);
assert.equal(linhas.length, 7, 'período de 7 dias gera 7 linhas');
const dia20 = linhas.find(l => l.data === '2026-10-20');
assert.equal(dia20.visualizacoes, 100 + 50 + 30 + 20, 'visualizações = 4 impressões somadas');
assert.equal(dia20.buscasLocais, 30 + 20, 'buscas locais = só impressões de busca');
assert.equal(dia20.chamadas, 2);
assert.equal(dia20.mensagens, 1);
const dia17 = linhas.find(l => l.data === '2026-10-17');
assert.equal(dia17.chamadas, 0, 'dia sem dado vira 0 só na tela');
assert.equal(totais.chamadas, 2 + 5, 'total de chamadas = soma dos dias');
assert.equal(totais.websiteClicks, 4);
assert.equal(totais.visualizacoes, 200);
assert.equal(totais.buscasLocais, 50);

// 5) Valor ausente / inválido não quebra
const r2 = m.agruparPorDia({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [{ dailyMetric: 'CALL_CLICKS', timeSeries: { datedValues: [{ date: { year: 2026, month: 10, day: 20 } }, { date: {} }] } }] }] });
assert.equal(r2['2026-10-20'].CALL_CLICKS, 0, 'value ausente vira 0');
assert.equal(Object.keys(r2).length, 1, 'data incompleta é ignorada');

console.log('TODOS OS TESTES PASSARAM');
