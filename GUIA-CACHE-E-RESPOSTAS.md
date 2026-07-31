# 🔧 Guia: Cache do Vercel e Visualização de Respostas

## ❌ PROBLEMA 1: Formulário ainda mostra versão antiga

### Solução: Forçar Rebuild no Vercel

**Método 1: Dashboard Vercel (Recomendado)**
1. Acesse: https://vercel.com/dashboard
2. Clique no projeto: **conexa-local-hub**
3. Vá para aba: **Deployments**
4. Localize o último deploy (topo da lista)
5. Clique nos **3 pontos** (⋯) à direita
6. Selecione: **Redeploy**
7. Confirme: **Redeploy** (isso força rebuild limpando cache)
8. Aguarde ~2-3 minutos
9. Atualize a página: **Ctrl+Shift+R** (cache hard-refresh)

**Status esperado:**
- ✓ Deploy muda para "Ready"
- ✓ Formulário mostra 12 seções
- ✓ Campo "Outro" em Atributos com input de texto
- ✓ Pergunta "Produto mais vendido" aparece
- ✓ Pergunta "Pesquisas da cidade" desapareceu

---

## ✅ PROBLEMA 2: Onde ver as respostas enviadas?

### Localização no CRM

**Caminho:**
1. No CRM, vá para: **Formulários** → **Google Meu Negócio**
2. Você verá: "Google Meu Negócio (editável)"
3. **Subtítulo:** "37 campos - criado em 28/07/2026"
4. Clique no botão azul: **📊 Respostas**

**O que verá:**
- Lista com todos os formulários enviados
- Nome da empresa (identificador principal)
- Categorias indicadas
- Data de envio
- Clique para ver detalhes completos

### Exemplo Visual:
```
Google Meu Negócio (editável)
└─ Cópia editável do formulário Google Meu Negócio
   37 campos · criado em 28/07/2026
   
   [Copiar link] [📊 Respostas] [✏️ Editar]
                  ↑ CLIQUE AQUI
```

### Dados salvos em Firestore:
- **Collection:** `ghub_briefings`
- **Organização:** Por empresa (nome_empresa)
- **Campos:** Todos os 12 seções + timestamp

---

## 🔄 Timeline de Atualização

| Ação | Tempo | Status |
|------|-------|--------|
| Commit realizado | ✓ Agora | Git push para main |
| Deploy iniciado | ~ 10s | Vercel processa |
| Build em progresso | ~ 1-2 min | Compila assets |
| Cache limpo | ~ 2-3 min | CDN atualiza |
| **Versão ao vivo** | **~ 3-5 min** | **✓ Pronto** |

---

## ✨ Mudanças Implementadas

✅ **Campo "Outro" em Atributos**
- Quando marca "Outro", aparece input de texto
- Pergunta: "Especifique outros atributos"
- Dados salvos em campo `outro_atributo`

✅ **Novo campo "Produto mais vendido"**
- Primeira pergunta da seção Serviços
- Antes de "aumentar demanda", "não aumentar", etc
- Ajuda identificar core business

✅ **Removida pergunta redundante**
- "Quer aparecer em pesquisas relacionadas à sua cidade?"
- Motivo: Recorrência (sempre sim para Google Business)

---

## 🧪 Teste Pós-Deploy

Após o rebuild, teste no formulário público:

**URL:** https://gmn-hub.vercel.app/forms/ficha-gmb.html

**Checklist:**
- [ ] Seção 06 mostra "Outro" com input
- [ ] Seção 07 começa com "Produto mais vendido"
- [ ] Seção 10 (Objetivos) tem apenas 3 perguntas
- [ ] Envie teste
- [ ] Respostas aparecem em Formulários → Respostas

---

## 📞 Próximas Mudanças Planejadas

Se precisar adicionar mais:
- Chat do "Outro" em Fotos/Materiais
- Chat de "Outro" em Tipo de Conteúdo
- Campos adicionais por seção

**Documentação de mudanças:**
```
✓ forms/ficha-gmb.html (v2.1) - Novo layout
✓ js/app.js - GMB_SECTIONS atualizado
✓ app.js - Dados salvos em ghub_briefings
```

---

**Status:** ✅ Pronto para produção após rebuild
