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
app.use(express.urlencoded({ extended: true }));

// ─── ROTAS DE AUTENTICAÇÃO (Google OAuth) ───────────────────────
const authGoogleRouter = require('./api/auth-google');
app.use('/api/auth', authGoogleRouter);

// ─── ROTAS DE SINCRONIZAÇÃO (Métricas) ──────────────────────────
const syncMetricasRouter = require('./api/sync-metricas');
app.use('/api/sync-metricas', syncMetricasRouter);

// ─── ROTA TESTE ──────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    status: 'Servidor rodando!',
    timestamp: new Date(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});

// ─── SERVIR ARQUIVO ESTÁTICO (CSS, JS, IMG, etc) ───────────────
app.use(express.static(__dirname, {
  maxAge: '1d',
  etag: false
}));

// ─── SERVIR PÁGINA INICIAL ──────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── MIDDLEWARE 404 ─────────────────────────────────────────────
app.use((req, res) => {
  if (!res.headersSent) {
    res.status(404).json({ error: 'Rota não encontrada' });
  }
});

// ─── INICIAR SERVIDOR (apenas em desenvolvimento local) ─────────
if (require.main === module) {
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
}

// ─── EXPORTAR PARA VERCEL ────────────────────────────────────────
module.exports = app;
