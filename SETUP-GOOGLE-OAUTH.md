# 🔐 SETUP GOOGLE OAUTH - Guia Completo

**Tempo:** 20 minutos  
**Dificuldade:** Fácil  

---

## ✅ PASSO 1: Criar Google Cloud Project

1. Ir para [console.cloud.google.com](https://console.cloud.google.com)
2. Clique em **"Select a Project"** (topo esquerdo)
3. Clique em **"New Project"**
4. Nome: `conexa-local-hub-oauth`
5. Clique **"Create"**

✅ Projeto criado!

---

## ✅ PASSO 2: Habilitar APIs

### 2a. Google My Business API
```
Google Cloud Console:
→ APIs & Services → Library
→ Procurar: "Google My Business API"
→ Click → "Enable"
```

### 2b. People API (para ler perfil)
```
→ Procurar: "People API"
→ Click → "Enable"
```

### 2c. Search Console API (opcional, mas bom ter)
```
→ Procurar: "Google Search Console API"
→ Click → "Enable"
```

✅ APIs habilitadas!

---

## ✅ PASSO 3: Criar OAuth 2.0 Credentials

```
Google Cloud Console:
→ APIs & Services → Credentials
→ "Create Credentials" (botão azul topo)
→ "OAuth 2.0 Client ID"
→ Application Type: "Web application"
→ Name: "Conexa Local Hub"
→ Authorized JavaScript origins:
     http://localhost:3000
     https://seu-dominio.com
→ Authorized redirect URIs:
     http://localhost:3000/api/auth/google/callback
     https://seu-dominio.com/api/auth/google/callback
→ "Create"
```

✅ Credenciais criadas!

### Copiar Client ID e Secret:
```
ID do Cliente (Client ID):      xxx.apps.googleusercontent.com
Senha do Cliente (Secret):       xxxxxxxxxxxxxxxx
```

---

## ✅ PASSO 4: Adicionar ao .env

Criar arquivo `.env` na raiz do projeto (ou editar existente):

```env
# 🔐 GOOGLE OAUTH
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000

# Firebase (já deve ter)
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_API_KEY=xxxx
# ... resto do firebase
```

✅ Variáveis configuradas!

---

## ✅ PASSO 5: Instalar Dependências

```bash
npm install googleapis
npm install google-auth-library
```

✅ Dependências instaladas!

---

## ✅ PASSO 6: Testar no Navegador

### 6a. Iniciar servidor
```bash
npm run dev
# ou
node server.js
```

### 6b. Abrir no navegador
```
http://localhost:3000
```

### 6c. Clicar em "Conectar Google"
- Redirecionará para Google
- Usuário faz login
- Google redireciona de volta
- Token é salvo no Firestore

✅ OAuth funcionando!

---

## 📋 PRÓXIMO PASSO: Puxar Métricas

Depois de conectar ao Google, você pode:

1. Listar business profiles do usuário
2. Sincronizar métricas (chamadas, mensagens, etc)
3. Salvar no Firestore
4. Mostrar na dashboard

---

## 🔧 Troubleshooting

### Erro: "Invalid redirect_uri"
→ Verificar se URI no código bate com Google Cloud Console

### Erro: "Access Denied"
→ Verificar se APIs estão habilitadas (Passo 2)

### Erro: "Refresh token not found"
→ Fazer login novamente (primeiro login pode não ter refresh token)

---

## 📁 Arquivos Criados

```
lib/google-oauth.js        ← Lógica OAuth
api/auth-google.js         ← Endpoints
.env                       ← Variáveis (criar)
```

---

## ✅ CHECKLIST

- [ ] Google Cloud Project criado
- [ ] APIs habilitadas (My Business + People)
- [ ] OAuth Credentials criadas
- [ ] .env preenchido
- [ ] npm install googleapis
- [ ] Servidor rodando
- [ ] Login testado

---

**Status:** ✅ PRONTO PARA PUXAR MÉTRICAS

Próximo: `/api/sync-metricas` (puxar dados do Google)
