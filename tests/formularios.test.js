// Testa validação e conversão dos formulários do sistema
const assert = require('assert');
const path = require('path');
const f = require(path.join(__dirname, '..', 'lib', 'formularios'));

// Briefing: obrigatórios e formatos
const vazio = f.validar('briefing', {});
assert.equal(vazio.ok, false);
assert.equal(vazio.erros.nome_empresa, 'Campo obrigatório');
assert.equal(vazio.erros.cnpj, 'Campo obrigatório');

const ruim = f.validar('briefing', { nome_empresa: 'Loja', endereco: 'Rua 1', email_profissional: 'nao-e-email', telefone: '48 9999', whatsapp: '48999999999', cnpj: '12.345', data_abertura: '2020-01-01' });
assert.equal(ruim.erros.email_profissional, 'E-mail inválido');
assert.equal(ruim.erros.cnpj, 'CNPJ deve ter 14 números');
assert.equal(ruim.erros.telefone, 'Telefone incompleto');

const boa = { nome_empresa: ' Ótica Visão ', endereco: 'Rua 1, 10 - Centro', email_profissional: 'contato@otica.com.br', telefone: '(48) 3333-4444', whatsapp: '(48) 99999-8888', cnpj: '12.345.678/0001-90', data_abertura: '2015-03-10' };
const okBriefing = f.validar('briefing', boa);
assert.equal(okBriefing.ok, true, JSON.stringify(okBriefing.erros));
assert.equal(okBriefing.dados.nome_empresa, 'Ótica Visão', 'espaços são cortados');

// Conversão para cliente: campos certos do cadastro
const cliB = f.paraCliente('briefing', okBriefing.dados, new Date('2026-11-13T10:00:00Z'));
assert.equal(cliB.nome, 'Ótica Visão');
assert.equal(cliB.empresa, 'Ótica Visão');
assert.equal(cliB.emailEmp, 'contato@otica.com.br');
assert.equal(cliB.tel, '(48) 99999-8888', 'WhatsApp vai para o telefone de contato');
assert.equal(cliB.telEmp, '(48) 3333-4444', 'telefone vai para o telefone da empresa');
assert.equal(cliB.dtAbertura, '2015-03-10');
assert.equal(cliB.statusCli, 'Lead');
assert.equal(cliB.origem, 'Formulário · Briefing');
assert.equal(cliB.archived, false);

// Contrato: CPF válido e conversão
const contrato = f.validar('contrato', { nome_completo: 'Maria Silva', telefone: '(48) 99999-0000', cpf: '123.456.789-09', endereco_completo: 'Rua X, 5', email_contrato: 'maria@x.com', razao_social: 'Maria ME', cnpj: '12345678000190' });
assert.equal(contrato.ok, true, JSON.stringify(contrato.erros));
const cliC = f.paraCliente('contrato', contrato.dados);
assert.equal(cliC.nome, 'Maria Silva');
assert.equal(cliC.empresa, 'Maria ME');
assert.equal(cliC.cpf, '123.456.789-09');
assert.equal(cliC.email, 'maria@x.com');
assert.equal(cliC.endPessoal, 'Rua X, 5');

// CPF curto é recusado
assert.equal(f.validar('contrato', { nome_completo: 'A', telefone: '48999990000', cpf: '123', endereco_completo: 'x', email_contrato: 'a@b.co' }).erros.cpf, 'CPF deve ter 11 números');

// Formulário inexistente
assert.equal(f.validar('nao-existe', {}).ok, false);
assert.equal(f.descrever('nao-existe'), null);

// Descrição pública não expõe a função de conversão
const d = f.descrever('contrato');
assert.equal(d.campos.length, 10);
assert.equal(typeof d.campos[0].paraCliente, 'undefined');

console.log('TESTES DOS FORMULÁRIOS PASSARAM');
