// 📝 Formulários do sistema: perguntas, validação e conversão em cadastro de cliente.
// Funções puras (sem rede nem banco) para poderem ser testadas.

const CAMPO = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: 'text', obrigatorio: false, ...extra });

// Perguntas de cada formulário, na mesma ordem em que aparecem para o cliente
const FORMULARIOS = {
  briefing: {
    titulo: 'Briefing Estratégico — Perfil no Google',
    descricao: 'Reúne as informações para criar, otimizar ou gerenciar o seu Perfil da Empresa no Google. Leva de 20 a 35 minutos.',
    origem: 'Formulário · Briefing',
    campos: [
      CAMPO('nome_empresa', 'Nome da empresa', { obrigatorio: true, ajuda: 'Digite exatamente como deseja aparecer no Google.' }),
      CAMPO('endereco', 'Endereço completo', { obrigatorio: true }),
      CAMPO('email_profissional', 'E-mail profissional', { obrigatorio: true, tipo: 'email' }),
      CAMPO('telefone', 'Telefone', { obrigatorio: true, tipo: 'tel' }),
      CAMPO('whatsapp', 'WhatsApp', { obrigatorio: true, tipo: 'tel' }),
      CAMPO('cnpj', 'CNPJ', { obrigatorio: true, tipo: 'cnpj' }),
      CAMPO('data_abertura', 'Data de abertura', { obrigatorio: true, tipo: 'date' }),
    ],
    // Campo que vai para cada atributo do cadastro de cliente
    paraCliente: (d) => ({
      nome: d.nome_empresa,
      empresa: d.nome_empresa,
      end: d.endereco,
      emailEmp: d.email_profissional,
      telEmp: d.telefone,
      tel: d.whatsapp,
      cnpj: d.cnpj,
      dtAbertura: d.data_abertura,
    }),
  },
  contrato: {
    titulo: 'Informações para o contrato',
    descricao: 'Para a elaboração correta do contrato, preencha tudo com atenção e precisão. O que não se aplica pode ficar em branco.',
    origem: 'Formulário · Contrato',
    campos: [
      CAMPO('razao_social', 'Razão social', { ajuda: 'Dados da empresa' }),
      CAMPO('nome_fantasia', 'Nome fantasia', { ajuda: 'Dados da empresa' }),
      CAMPO('cnpj', 'CNPJ', { ajuda: 'Dados da empresa', tipo: 'cnpj' }),
      CAMPO('endereco_empresa', 'Endereço completo da empresa (rua, número, bairro, cidade, estado, CEP)', { ajuda: 'Dados da empresa' }),
      CAMPO('telefone_empresa', 'Telefone da empresa', { ajuda: 'Dados da empresa', tipo: 'tel' }),
      CAMPO('nome_completo', 'Nome completo', { obrigatorio: true }),
      CAMPO('telefone', 'Telefone', { obrigatorio: true, tipo: 'tel' }),
      CAMPO('cpf', 'CPF', { obrigatorio: true, tipo: 'cpf' }),
      CAMPO('endereco_completo', 'Endereço completo', { obrigatorio: true }),
      CAMPO('email_contrato', 'E-mail para envio do contrato', { obrigatorio: true, tipo: 'email' }),
    ],
    paraCliente: (d) => ({
      nome: d.nome_completo,
      empresa: d.razao_social,
      fantasia: d.nome_fantasia,
      cnpj: d.cnpj,
      end: d.endereco_empresa,
      telEmp: d.telefone_empresa,
      tel: d.telefone,
      cpf: d.cpf,
      endPessoal: d.endereco_completo,
      email: d.email_contrato,
    }),
  },
};

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

function validarCampo(campo, valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    return campo.obrigatorio ? 'Campo obrigatório' : null;
  }
  const v = String(valor).trim();
  if (v.length > 300) return 'Texto muito longo';
  if (campo.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'E-mail inválido';
  if (campo.tipo === 'cnpj' && soDigitos(v).length !== 14) return 'CNPJ deve ter 14 números';
  if (campo.tipo === 'cpf' && soDigitos(v).length !== 11) return 'CPF deve ter 11 números';
  if (campo.tipo === 'tel' && soDigitos(v).length < 10) return 'Telefone incompleto';
  if (campo.tipo === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Data inválida';
  return null;
}

// Valida e limpa a resposta. Devolve { ok, erros, dados }.
function validar(tipo, corpo) {
  const form = FORMULARIOS[tipo];
  if (!form) return { ok: false, erros: { _: 'Formulário não existe' }, dados: null };
  const erros = {};
  const dados = {};
  for (const campo of form.campos) {
    const bruto = corpo?.[campo.nome];
    const erro = validarCampo(campo, bruto);
    if (erro) erros[campo.nome] = erro;
    dados[campo.nome] = bruto === undefined || bruto === null ? '' : String(bruto).trim();
  }
  return { ok: Object.keys(erros).length === 0, erros, dados };
}

// Monta o cadastro de cliente a partir da resposta validada
function paraCliente(tipo, dados, agora = new Date()) {
  const form = FORMULARIOS[tipo];
  return {
    ...form.paraCliente(dados),
    statusCli: 'Lead',
    origem: form.origem,
    archived: false,
    createdAt: agora.toISOString(),
  };
}

// Descrição pública do formulário (sem a função de conversão)
function descrever(tipo) {
  const form = FORMULARIOS[tipo];
  if (!form) return null;
  return {
    titulo: form.titulo,
    descricao: form.descricao,
    campos: form.campos.map(({ nome, rotulo, tipo: t, obrigatorio, ajuda }) => ({ nome, rotulo, tipo: t, obrigatorio, ajuda: ajuda || '' })),
  };
}

module.exports = { FORMULARIOS, validar, paraCliente, descrever, soDigitos };
