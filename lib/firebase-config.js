// 🔥 Firebase Admin SDK Configuration
const admin = require('firebase-admin');

// Verificar se variáveis de ambiente estão definidas
if (!process.env.FIREBASE_PROJECT_ID) {
  console.warn('⚠️  FIREBASE_PROJECT_ID não configurado. Firebase desativado.');
}

let db = null;
let auth = null;
let initialized = false;

// Tentar inicializar Firebase
try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccountKey = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      db = admin.firestore();
      auth = admin.auth();
      initialized = true;

      console.log('✅ Firebase inicializado com sucesso!');
    }
  }
} catch (error) {
  console.warn('⚠️  Erro ao inicializar Firebase:', error.message);
  console.warn('📌 Firebase desativado. Endpoints funcionarão sem persistência.');
}

module.exports = {
  admin: (admin && admin.apps && admin.apps.length > 0) ? admin : null,
  db,
  auth,
  initialized,

  // Helper functions
  isConnected: () => initialized,

  // Coleções padrão
  collections: {
    PERFIS: 'gmn_perfis',
    METRICAS: 'gmn_metricas',
    GOOGLE_TOKENS: 'gmn_google_tokens',
    USUARIOS: 'usuarios',
  }
};
