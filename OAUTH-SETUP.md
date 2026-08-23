# Configuração Google OAuth - GMN Hub

## 🔧 Pré-requisitos

- Uma conta Google (pessoal ou G Suite)
- Acesso ao Google Cloud Console

---

## ⚙️ Passo 1: Criar Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Clique no seletor de projeto no topo → **Novo Projeto**
3. Nome: `GMN Hub` (ou outro nome de sua preferência)
4. Clique em **CRIAR**

---

## 📱 Passo 2: Configurar Credenciais OAuth 2.0

### 2.1 Ativar Google My Business API

1. No Cloud Console, acesse **APIs e Serviços** → **Biblioteca**
2. Procure por `Google My Business`
3. Clique no resultado
4. Clique em **ATIVAR**

### 2.2 Criar Tela de Consentimento OAuth

1. Acesse **APIs e Serviços** → **Tela de Consentimento**
2. Selecione **Externo** (ou **Interno** se usar G Suite)
3. Preencha os campos obrigatórios:
   - **Nome do aplicativo**: `GMN Hub`
   - **Email de suporte**: seu email
   - **Emails de contato**: seu email
4. Clique em **SALVAR E CONTINUAR**
5. Na seção de escopos, clique em **SALVAR E CONTINUAR**
6. Na seção de usuários de teste, clique em **SALVAR E CONTINUAR**

### 2.3 Criar Credenciais OAuth Client ID

1. Acesse **APIs e Serviços** → **Credenciais**
2. Clique em **+ CRIAR CREDENCIAIS** → **ID do cliente OAuth**
3. Tipo de aplicação: **Aplicativo da web**
4. Preencha:
   - **Nome**: `GMN Hub Local` (ou `GMN Hub Prod` para produção)
   
5. **URIs autorizados de redirecionamento**:
   
   **Para desenvolvimento (localhost)**:
   ```
   http://localhost:3000/oauth-callback.html
   ```
   
   **Para produção (Vercel)**:
   ```
   https://seu-dominio.vercel.app/oauth-callback.html
   ```
   
   *(Você pode adicionar ambos)*

6. Clique em **CRIAR**
7. Uma caixa de diálogo mostrará seus dados

---

## 🔑 Passo 3: Copiar Credenciais

Na caixa de diálogo, você verá:

- **ID do cliente** (Client ID)
- **Chave secreta do cliente** (Client Secret)

Copie esses dois valores.

---

## 📝 Passo 4: Configurar Arquivo .env

1. Na raiz do projeto, abra o arquivo `.env`
   *(Se não existir, copie de `.env.example`)*

2. Adicione/atualize as linhas:

```bash
GOOGLE_CLIENT_ID=seu_client_id_aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth-callback.html
```

**Exemplo real:**
```bash
GOOGLE_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoP
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth-callback.html
```

3. **Salve o arquivo**
4. **Reinicie o servidor** Node.js

---

## ✅ Passo 5: Testar OAuth

1. Acesse: `http://localhost:3000`
2. Vá para: **Google Meu Negócio** → **Métricas em Tempo Real**
3. Clique em **Conectar com Google My Business**
4. Você deve ser redirecionado para Google
5. Selecione sua conta Google
6. Conceda permissões
7. Você será redirecionado de volta ao Dashboard
8. Seus perfis devem aparecer automaticamente ✅

---

## 🚀 Para Produção (Vercel)

1. Acesse seu projeto no Vercel
2. Vá para **Settings** → **Environment Variables**
3. Adicione as mesmas 3 variáveis:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://seu-dominio.vercel.app/oauth-callback.html`

4. Clique em **Save**
5. Vercel fará redeploy automaticamente

---

## 🔒 Segurança

- **Nunca commite o arquivo `.env`** ✅ (está no `.gitignore`)
- **Nunca compartilhe sua `GOOGLE_CLIENT_SECRET`**
- Se a chave for exposta, regenere no Google Cloud Console

---

## ❓ Troubleshooting

### Erro: "Credenciais do Google não configuradas"

**Solução**: 
- Verifique se `.env` existe
- Verifique se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão preenchidos
- Reinicie o servidor Node.js

### Erro: "redirect_uri_mismatch"

**Solução**:
- A `GOOGLE_REDIRECT_URI` no `.env` deve ser **exatamente igual** ao URI configurado no Google Cloud
- Verifique espaços em branco
- Para localhost: `http://localhost:3000/oauth-callback.html`

### Perfis não aparecem

**Solução**:
- Aguarde alguns segundos após autenticar
- Sua conta Google precisa ter acesso a perfis Google My Business
- Se não tiver perfis, crie um em https://business.google.com

---

## 📞 Suporte

Para problemas com Google OAuth, consulte:
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google My Business API](https://developers.google.com/my-business)

---

**Pronto!** 🎉 Seu sistema GMN Hub está configurado e pronto para usar.
