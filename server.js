// ════════════════════════════════════════════════════════════════════
// 🚀 SERVIDOR EXPRESS - SAAS GOOGLE MY BUSINESS
// ════════════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// ─── INICIALIZAR EXPRESS ─────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── ROTAS DE AUTENTICAÇÃO (Google OAuth) ───────────────────────
const authGoogleRouter = require('./api/auth-google');
app.use('/api/auth', authGoogleRouter);

// ─── ROTAS DE SINCRONIZAÇÃO (Métricas) ──────────────────────────
const syncMetricasRouter = require('./api/sync-metricas');
app.use('/api/sync-metricas', syncMetricasRouter);

// ─── SERVIR ARQUIVOS ESTÁTICOS (DEPOIS DAS ROTAS) ────────────────
app.use(express.static(path.join(__dirname)));

// ─── ROTA TESTE ──────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    status: 'Servidor rodando!',
    timestamp: new Date(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});

// ─── SERVIR PÁGINA INICIAL ──────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── INICIAR SERVIDOR ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════╗
  ║  🚀 Servidor rodando!                         ║
  ║  http://localhost:${PORT}                         ║
  ║                                                ║
  ║  Pressione Ctrl + C para parar               ║
  ╚════════════════════════════════════════════════╝
  `);
});

module.exports = app;
