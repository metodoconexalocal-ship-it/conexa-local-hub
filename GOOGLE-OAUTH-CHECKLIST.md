# ✅ GOOGLE OAUTH - CHECKLIST DE AÇÃO

**Status:** 🟡 Pronto para configurar  
**Tempo total:** 30 minutos  

---

## 🎯 O QUE FOI CRIADO

```
✅ lib/google-oauth.js         (Lógica OAuth + tokens)
✅ api/auth-google.js          (Endpoints de autenticação)
✅ api/sync-metricas.js        (Puxar dados do Google)
✅ SETUP-GOOGLE-OAUTH.md       (Guia de configuração)
```

---

## 📋 PASSO A PASSO (Execute na Ordem)

### 1️⃣ GOOGLE CLOUD SETUP (5 min)
```
□ Ir para console.cloud.google.com
□ Criar projeto: "conexa-local-hub-oauth"
□ Enable: Google My Business API
□ Enable: People API
□ Create OAuth 2.0 Credentials (Web)
□ Copiar Client ID e Secret
□ Salvar em .env
```

**Resultado esperado:**
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

---

### 2️⃣ INSTALAR DEPENDÊNCIAS (2 min)
```bash
npm install googleapis google-auth-library
```

---

### 3️⃣ REGISTRAR ENDPOINTS NO SERVER (3 min)

No arquivo `server.js` ou seu arquivo principal de Express:

```javascript
// Adicionar antes de app.listen()
const authGoogleRouter = require('./api/auth-google');
const syncMetricasRouter = require('./api/sync-metricas');

app.use('/api/auth', authGoogleRouter);
app.use('/api/sync-metricas', syncMetricasRouter);
```

---

### 4️⃣ ADICIONAR BOTÃO NO FRONTEND (5 min)

No HTML/interface (onde o usuário vê os perfis):

```html
<!-- Botão para conectar Google -->
<button onclick="conectarGoogle()">
  <i class="bi bi-google"></i> Conectar com Google
</button>

<script>
function conectarGoogle() {
  // Puxar URL de autenticação
  fetch('/api/auth/google/url')
    .then(r => r.json())
    .then(data => {
      window.location.href = data.url; // Redireciona para Google
    });
}

// Após retornar do Google (no callback)
function vincularPerfilAoGoogle() {
  const usuarioId = getCurrentUserId(); // Sua função
  const perfilId = getCurrentPerfilId(); // Sua função

  fetch('/api/auth/google/vincular-perfil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioId, perfilId }),
  })
  .then(r => r.json())
  .then(data => {
    console.log('✅ Perfil vinculado!', data);
    // Agora pode sincronizar métricas
  });
}
</script>
```

---

### 5️⃣ CRIAR NOVA COLLECTION NO FIRESTORE (2 min)

Você pode deixar criar automaticamente, mas criar agora é mais seguro:

```
Firestore Console:
→ Collections → New Collection
→ Nome: "gmn_metricas"
→ First Document: {
    "perfilId": "sample",
    "data": "2026-08-22",
    "chamadas": 0,
    "mensagens": 0,
    "direcoes": 0,
    "websiteClicks": 0,
    "visualizacoes": 0,
    "buscasLocais": 0
  }

→ Salvar
```

---

### 6️⃣ TESTAR (10 min)

```bash
# 1. Iniciar servidor
npm run dev

# 2. Abrir no navegador
http://localhost:3000

# 3. Clicar em "Conectar com Google"

# 4. Fazer login com conta Google

# 5. Será redirecionado de volta

# 6. Clicar em "Vincular ao Perfil"

# 7. Verificar Firestore → gmn_google_tokens
```

---

## 🔗 ENDPOINTS DISPONÍVEIS

```
GET  /api/auth/google/url
     → Retorna URL para fazer login

GET  /api/auth/google/callback
     → Callback do Google (automático)

POST /api/auth/google/vincular-perfil
     → Vincula tokens ao perfil
     Body: { usuarioId, perfilId }

POST /api/sync-metricas/trigger
     → Sincroniza métricas manualmente
     Body: { usuarioId, perfilId }

GET  /api/sync-metricas/:perfilId
     → Recupera últimas 30 métricas

GET  /api/sync-metricas/:perfilId/hoje
     → Recupera métricas de hoje
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

Adicionar ao `.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000

# Firebase (já deve ter)
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_API_KEY=xxxx
# ... resto
```

---

## 📊 FLUXO COMPLETO

```
1. Usuário clica "Conectar com Google"
   ↓
2. Redirecionado para Google Login
   ↓
3. Google redireciona para callback com código
   ↓
4. Sistema troca código por tokens
   ↓
5. Tokens salvos em gmn_google_tokens no Firestore
   ↓
6. Usuário clica "Vincular ao Perfil"
   ↓
7. Tokens vinculados ao perfilId específico
   ↓
8. Clicar "Sincronizar Métricas"
   ↓
9. Sistema puxa dados do Google API
   ↓
10. Métricas salvas em gmn_metricas
   ↓
11. Dashboard mostra os dados! 📊
```

---

## ✅ PRÓXIMOS PASSOS

- [ ] Configurar Google Cloud
- [ ] Instalar dependências
- [ ] Registrar endpoints
- [ ] Adicionar botão no frontend
- [ ] Criar collection Firestore
- [ ] Testar fluxo completo
- [ ] Criar dashboard para mostrar métricas

---

## 🎯 DEPOIS DISSO (Passo 2)

Quando tudo estiver funcionando, vamos:

1. **Criar Cloud Scheduler** para sincronizar automaticamente (diariamente)
2. **Atualizar Dashboard** para mostrar as métricas em tempo real
3. **Atualizar Scoring** para usar dados reais do Google

---

## 📞 SE TIVER ERRO

### "Invalid redirect_uri"
→ Verificar Google Cloud Console se URI está exatamente igual

### "API not enabled"
→ Ir em Google Cloud e habilitar "Google My Business API"

### "Access denied"
→ Verificar se escopos estão corretos em `google-oauth.js`

### Tokens não salvam
→ Verificar se Firestore permite escrever em `gmn_google_tokens`

---

**Status:** 🟢 **PRONTO PARA COMEÇAR!**

Comece pelo **Passo 1** (Google Cloud Setup)
