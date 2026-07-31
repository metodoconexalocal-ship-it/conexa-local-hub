# 📱 Guia: Compartilhar Formulário com Cliente

## ✅ Link CORRETO para Cliente Responder

```
https://conexa-local-hub.vercel.app/forms/ficha-gmb.html
```

**Este é o link que o cliente deve usar para preencher o formulário.**

### Como compartilhar:

**Opção 1: Copiar direto e enviar**
- Copie: `https://conexa-local-hub.vercel.app/forms/ficha-gmb.html`
- Envie por WhatsApp, Email, etc

**Opção 2: No CRM**
1. Vá para: **Formulários** → **Google Meu Negócio**
2. Botão: **Copiar link** (cópia automática do URL correto)
3. Envie para o cliente

---

## ❌ Por que dá erro "Formulário não encontrado"?

**Erro:** "Formulário não encontrado ou link expirado"

**Causas:**
1. ❌ Compartilhando link de portal/customizado inexistente
2. ❌ Link expirou (se era tempo limitado)
3. ❌ URL digitada errada
4. ❌ Cliente usando versão em cache do navegador

**Solução:**
- Use o link **exato** acima
- Envie novo link ao cliente
- Cliente pressiona **Ctrl+Shift+R** para limpar cache

---

## 🔄 Sincronização: HTML vs CRM

### O que é cada um?

| Componente | Função | Visibilidade |
|-----------|--------|-------------|
| **ficha-gmb.html** | Formulário completo (público) | Cliente vê |
| **GMB_SECTIONS** (app.js) | Estrutura/template do form | CRM mostra no editor |

### Como funcionam:

```
Cliente acessa → ficha-gmb.html → Preenche 12 seções
                       ↓
                  Envia dados
                       ↓
                  Firebase salva
                       ↓
CRM mostra → Formulários → Respostas
            (busca em Firebase)
```

### Garantir sincronização:

✅ **HTML tem:** 12 seções × 90+ perguntas
✅ **CRM tem:** GMB_SECTIONS com mesmas 12 seções
✅ **Ambos usam:** Mesmos nomes de campos (keys)

---

## 📊 Campos que Cliente Vê

### Seção 01 — Dados da Empresa
- Nome da empresa
- Endereço completo
- E-mail profissional
- Telefone principal
- WhatsApp
- Data de abertura
- CNPJ

### Seção 02 — Sobre o Negócio
- Categoria principal
- Categorias secundárias
- Palavra-chave principal
- Especialidades
- Como cliente pesquisaria
- Como ajuda o cliente
- História da empresa
- Diferenciais principais
- Público-alvo
- Serviço mais lucrativo

### Seção 03 — Presença Digital
- Site
- Perfil Google
- Instagram
- Facebook
- LinkedIn
- Outras redes
- Possui site? (Sim/Não)
- WhatsApp Business? (Sim/Não)
- Link WhatsApp
- Catálogo virtual? (Sim/Não)
- Identidade visual? (Sim/Não)
- Fotos profissionais? (Sim/Não)
- Vídeos profissionais? (Sim/Não)
- Principais concorrentes

### Seção 04 — Localização e Área de Atendimento
- Localização exata
- Áreas de cobertura
- Cliente vai até empresa? (Sim/Não)
- Atende no endereço do cliente? (Sim/Não)
- Cobrança de deslocamento

### Seção 05 — Funcionamento
- Horário de funcionamento
- Horários especiais/feriados
- Agendamento obrigatório? (Sim/Não)
- Agendamento online? (Sim/Não)
- Link de agendamento
- Idiomas de atendimento
- Atendimento fim de semana? (Sim/Não)
- Atendimento emergencial? (Sim/Não)

### Seção 06 — Atributos da Empresa
- Atributos (Wi-Fi, Pet Friendly, Delivery, etc)
- Especifique outros atributos (se marcar "Outro")

### Seção 07 — Serviços
- **Produto/serviço mais vendido** ⭐ (NOVO)
- Serviços aumentar demanda
- Serviços NÃO aumentar
- Serviços mais procurados
- Produtos/serviços destacar

### Seção 08 — Fotos e Materiais
- Materiais disponíveis (checkboxes)

### Seção 09 — Avaliações
- Possui avaliações Google? (Sim/Não)
- Quantidade de avaliações
- Solicita avaliações? (Sim/Não)
- Responde avaliações? (Sempre/Às vezes/Nunca)
- Cliente para avaliar (texto)

### Seção 10 — Objetivos
- Objetivo principal (Visibilidade/Leads/Vendas/Reputação)
- Meta próximos 3 meses
- Meta de avaliações

### Seção 11 — Conteúdo e Diferenciais
- Vantagem competitiva
- Diferencial único
- Tipo de conteúdo (checkboxes)
- Frequência conteúdo
- Investir conteúdo profissional? (Sim/Não/Talvez)
- Orçamento conteúdo

### Seção 12 — Documentação
- Possui certificados? (Sim/Não)
- Descrição certificados
- Participou Google Ads? (Sim/Não)
- Resultado Google Ads
- Orçamento mensal marketing
- Informações adicionais
- Melhor forma contato
- Responsável projeto

---

## 🧪 Teste Completo

1. **Abra o link:** https://conexa-local-hub.vercel.app/forms/ficha-gmb.html
2. **Pressione:** Ctrl+Shift+R (hard refresh)
3. **Deve aparecer:**
   - Seção 07 com "Produto mais vendido" como primeira pergunta
   - Seção 06 com campo "Outro" em Atributos
   - Todas as 12 seções funcionando
4. **Preencha como teste**
5. **Envie** (Enviar Briefing Completo)
6. **Vê resposta em:** Formulários → Google Meu Negócio → 📊 Respostas

---

## 📞 Checklist de Compartilhamento

- [ ] Link correto: `https://conexa-local-hub.vercel.app/forms/ficha-gmb.html`
- [ ] Cliente consegue abrir sem erro
- [ ] Cliente vê 12 seções completas
- [ ] Cliente consegue preencher e enviar
- [ ] Resposta aparece em "Respostas" do CRM
- [ ] PDF pode ser baixado após envio

**Status:** ✅ Pronto para compartilhar

