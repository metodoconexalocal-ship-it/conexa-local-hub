// Firebase Admin SDK Configuration (Temporário - será configurado depois)
let db = null;
let auth = null;
let admin = null;

// Tentar carregar Firebase se disponível
try {
  admin = require('firebase-admin');

  const serviceAccountKey = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  db = admin.firestore();
  auth = admin.auth();
} catch (err) {
  console.warn('⚠️  Firebase não configurado ainda. Use os endpoints sem Firebase por enquanto.');
}

module.exports = { admin, db, auth };
