const express = require("express");
const app = express();
var cors = require("cors");
var request = require('request');
const { json } = require("express");
const db = require("./db");

// GERAR CÓD REFERENCIA DO PEDIDO
var generator = require('generate-password');

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

app.post("/pagamentos/credito/:id", async (req, res) => {
  // TODO: -> Verificar erro ao processar pagamento com o token do cartão (o cartão foi ultilizado muitas vezes);

  const INCLUDE_PATH = "https://sandbox.asaas.com/";
  const INCLUDE_KEY = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwMzc4OTg6OiRhYWNoXzQzNzI2NTBhLTZmZjktNDg0Yi04Y2VlLWU3MDZhZDVlZmRlNA";
  try {
    // CONTANTES DA REQUISIÇÃO
    const dados_metodoPagamento = req.params.id;
    const dados_contato = req.body.dados_comprador;
    const dados_comprador = (dados_metodoPagamento == 'token') ? { creditCardToken: req.body.dados_cartao.card_token } : {
      creditCard: {
        holderName: req.body.dados_cartao.nome,
        number: req.body.dados_cartao.cardNumber,
        expiryMonth: req.body.dados_cartao.expiryMonth,
        expiryYear: req.body.dados_cartao.expiryYear,
        ccv: req.body.dados_cartao.ccvNumber
      },
      creditCardHolderInfo: {
        name: req.body.dados_cartao.nome,
        email: req.body.dados_comprador.email,
        cpfCnpj: req.body.dados_cartao.cpf,
        postalCode: req.body.dados_contato.endereco.cep,
        addressNumber: req.body.dados_contato.endereco.numero,
        addressComplement: (req.body.dados_contato.endereco.complemento.length) ? req.body.dados_contato.endereco.complemento : null,
        phone: req.body.dados_contato.telefones.principal
      }
    }
    const dados_cobranca = req.body.dados_cobranca;
    const dados_tokenizarCartao = req.body.tokenizar;
    const dados_pedido = req.body.dados_pedido;
    // VERIFICAÇÃO DE EXISTENCIA DE CONTA
    request({
      method: 'GET',
      url: INCLUDE_PATH + 'api/v3/customers?name=' + dados_contato.full_name + '&cpfCnpj=' + dados_contato.cpf + '&limit=1',
      headers: {
        'access_token': INCLUDE_KEY
      }
    }, async (requisicaoExistenciaConta, respostaExistenciaConta) => {
      try {
        const existenciaConta = await JSON.parse(respostaExistenciaConta.body).data; // RETORNO DA VERIFICAÇÃO DE EXISTENCIA DE CONTA

        // VERIFICAR RETORNO DA EXISTENCIA DE cadastro (EXISTE: VAMOS CRIAR UM PAGAMENTO || !EXISTE: VAMOS CRIAR UM CADASTRO)
        if (existenciaConta && existenciaConta.length) { // ESTE COMPRADOR JÁ POSSUI UMA CONTA
          // GERAR ***COBRANÇA***
          const dados_contaExistente = existenciaConta[0]; // DADOS DA CONTA RECUPERADA
          const { creditCard, creditCardHolderInfo, creditCardToken } = dados_comprador;

          const obj_req = (() => {
            if (dados_cobranca.installmentCount > 1 && dados_metodoPagamento == 'token') { // PARCELADO (TOKEN)
              return ({
                customer: dados_contaExistente.id,
                billingType: dados_cobranca.billingType,
                installmentCount: dados_cobranca.installmentCount,
                totalValue: dados_cobranca.totalValue,
                dueDate: dados_cobranca.vencimento,
                value: dados_cobranca.totalValue,
                description: dados_cobranca.description,
                externalReference: 'E' + generator.generate({
                  length: 15,
                  numbers: true,
                  lowercase: false,
                  uppercase: true,
                  exclude: 'ç',
                  symbols: false
                }) + 'P',
                creditCardToken
              })
            } else if (dados_cobranca.installmentCount > 1 && dados_metodoPagamento != 'token') { // PARCELADO (CARTAO)
              return ({
                customer: dados_contaExistente.id,
                billingType: dados_cobranca.billingType,
                installmentCount: dados_cobranca.installmentCount,
                totalValue: dados_cobranca.totalValue,
                dueDate: dados_cobranca.vencimento,
                value: dados_cobranca.totalValue,
                description: dados_cobranca.description,
                externalReference: 'E' + generator.generate({
                  length: 15,
                  numbers: true,
                  lowercase: false,
                  uppercase: true,
                  exclude: 'ç',
                  symbols: false
                }) + 'P',
                creditCard,
                creditCardHolderInfo
              })
            } else if (dados_cobranca.installmentCount == 1 && dados_metodoPagamento == 'token') { // Á VISTA (TOKEN)
              return ({
                customer: dados_contaExistente.id,
                billingType: dados_cobranca.billingType,
                dueDate: dados_cobranca.vencimento,
                value: dados_cobranca.totalValue,
                description: dados_cobranca.description,
                externalReference: 'E' + generator.generate({
                  length: 15,
                  numbers: true,
                  lowercase: false,
                  uppercase: true,
                  exclude: 'ç',
                  symbols: false
                }) + 'P',
                creditCardToken
              })
            } else if (dados_cobranca.installmentCount == 1 && dados_metodoPagamento != 'token') { // Á VISTA (CARTAO)
              return ({
                customer: dados_contaExistente.id,
                billingType: dados_cobranca.billingType,
                dueDate: dados_cobranca.vencimento,
                value: dados_cobranca.totalValue,
                description: dados_cobranca.description,
                externalReference: 'E' + generator.generate({
                  length: 15,
                  numbers: true,
                  lowercase: false,
                  uppercase: true,
                  exclude: 'ç',
                  symbols: false
                }) + 'P',
                creditCard,
                creditCardHolderInfo
              })
            } else {
              res.send({
                error: 'Error',
                object: 'payment',
                message: "Não foi possivel definir os dados de pagamento"
              })
            }
          })()

          // GERAÇÃO DE COBRANÇA ***USUARIO CADASTRADO***
          request({
            method: 'POST',
            url: INCLUDE_PATH + 'api/v3/payments',
            headers: {
              'Content-Type': 'application/json',
              'access_token': INCLUDE_KEY
            },
            body: JSON.stringify(obj_req)
          }, async (requisicaoNovaCobranca, respostaNovaCobranca) => {
            try {
              const novaCobranca = await JSON.parse(respostaNovaCobranca.body);
              // VERIFICANDO A EXISTENCIA DE ERROS INTERNOS - PAGAMENTOS/CLIENTE EXISTENTE
              if (novaCobranca.errors) { // EXISTE ERROS INTERNOS
                res.send({
                  error: 'Error',
                  object: 'payment',
                  message: novaCobranca.errors
                })
              } else { // NÃO EXISTE NENHUM ERRO INTERNO (SUCESSO | FIM)
                // CADASTRAR PEDIDO NO BANCO DE DADOS
                (async () => {
                  let dadosPedido = {
                    dados_cobranca: novaCobranca,
                    dados_pedido: dados_pedido
                  }
                  const result = await db.cadastrarPedido(dadosPedido);
                  if (result.status == "success") {
                    res.send({
                      success: 'Success',
                      object: novaCobranca.object,
                      message: novaCobranca
                    })
                  } else {
                    res.send({
                      success: 'Error',
                      message: result.message
                    })
                  }
                })();
              }
            } catch (errorNovaCobranca) {
              res.send({
                error: 'Error',
                message: errorNovaCobranca.message
              })
            }
          });
        } else { // NÃO EXISTE NENHUM CADASTRO PARA ESTE COMPRADOR
          // GERAR ***CADASTRO***
          let dados_novo_usuario = {
            name: req.body.dados_comprador.full_name,
            email: req.body.dados_comprador.email,
            mobilePhone: req.body.dados_comprador.telefone,
            cpfCnpj: req.body.dados_comprador.cpf,
            postalCode: req.body.dados_contato.endereco.cep,
            address: req.body.dados_contato.endereco.tipo_logradouro + ' ' + req.body.dados_contato.endereco.logradouro,
            addressNumber: req.body.dados_contato.endereco.numero,
            complement: (req.body.dados_contato.endereco.complemento.length) ? req.body.dados_contato.endereco.complemento : null,
            province: req.body.dados_contato.endereco.bairro,
            notificationDisabled: false,
            observations: req.body.dados_contato.endereco.referencia
          }
          request({
            method: 'POST',
            url: INCLUDE_PATH + 'api/v3/customers',
            headers: {
              'Content-Type': 'application/json',
              'access_token': INCLUDE_KEY
            },
            body: JSON.stringify(dados_novo_usuario)
          }, async (requisicaoNovoCadastro, respostaNovoCadastro) => {
            try {
              const novoCadastro = await JSON.parse(respostaNovoCadastro.body);

              // VERIFICANDO A EXISTENCIA DE ERROS INTERNOS - NOVO CLIENTE
              if (novoCadastro.errors) { // EXISTE ERROS INTERNOS
                res.send({
                  error: 'Error',
                  object: 'account',
                  message: novoCadastro.errors
                })
              } else { // NÃO EXISTE NENHUM ERRO INTERNO
                // console.log(novoCadastro)
                const obj_req = (() => {
                  if (dados_cobranca.installmentCount > 1 && dados_metodoPagamento == 'token') { // PARCELADO (TOKEN)
                    return ({
                      customer: dados_contaExistente.id,
                      billingType: dados_cobranca.billingType,
                      installmentCount: dados_cobranca.installmentCount,
                      totalValue: dados_cobranca.totalValue,
                      dueDate: dados_cobranca.vencimento,
                      value: dados_cobranca.totalValue,
                      description: dados_cobranca.description,
                      externalReference: 'E' + generator.generate({
                        length: 15,
                        numbers: true,
                        lowercase: false,
                        uppercase: true,
                        exclude: 'ç',
                        symbols: false
                      }) + 'P',
                      creditCardToken
                    })
                  } else if (dados_cobranca.installmentCount > 1 && dados_metodoPagamento != 'token') { // PARCELADO (CARTAO)
                    return ({
                      customer: dados_contaExistente.id,
                      billingType: dados_cobranca.billingType,
                      installmentCount: dados_cobranca.installmentCount,
                      totalValue: dados_cobranca.totalValue,
                      dueDate: dados_cobranca.vencimento,
                      value: dados_cobranca.totalValue,
                      description: dados_cobranca.description,
                      externalReference: 'E' + generator.generate({
                        length: 15,
                        numbers: true,
                        lowercase: false,
                        uppercase: true,
                        exclude: 'ç',
                        symbols: false
                      }) + 'P',
                      creditCard,
                      creditCardHolderInfo
                    })
                  } else if (dados_cobranca.installmentCount == 1 && dados_metodoPagamento == 'token') { // Á VISTA (TOKEN)
                    return ({
                      customer: dados_contaExistente.id,
                      billingType: dados_cobranca.billingType,
                      dueDate: dados_cobranca.vencimento,
                      value: dados_cobranca.totalValue,
                      description: dados_cobranca.description,
                      externalReference: 'E' + generator.generate({
                        length: 15,
                        numbers: true,
                        lowercase: false,
                        uppercase: true,
                        exclude: 'ç',
                        symbols: false
                      }) + 'P',
                      creditCardToken
                    })
                  } else if (dados_cobranca.installmentCount == 1 && dados_metodoPagamento != 'token') { // Á VISTA (CARTAO)
                    return ({
                      customer: dados_contaExistente.id,
                      billingType: dados_cobranca.billingType,
                      dueDate: dados_cobranca.vencimento,
                      value: dados_cobranca.totalValue,
                      description: dados_cobranca.description,
                      externalReference: 'E' + generator.generate({
                        length: 15,
                        numbers: true,
                        lowercase: false,
                        uppercase: true,
                        exclude: 'ç',
                        symbols: false
                      }) + 'P',
                      creditCard,
                      creditCardHolderInfo
                    })
                  } else {
                    res.send({
                      error: 'Error',
                      object: 'payment',
                      message: "Não foi possivel definir os dados de pagamento"
                    })
                  }
                })()

                // GERAÇÃO DE COBRANÇA ***USUARIO CADASTRADO***
                request({
                  method: 'POST',
                  url: INCLUDE_PATH + 'api/v3/payments',
                  headers: {
                    'Content-Type': 'application/json',
                    'access_token': INCLUDE_KEY
                  },
                  body: JSON.stringify(obj_req)
                }, async (requisicaoNovaCobranca, respostaNovaCobranca) => {
                  try {
                    const novaCobranca = await JSON.parse(respostaNovaCobranca.body);
                    // VERIFICANDO A EXISTENCIA DE ERROS INTERNOS - PAGAMENTOS/NOVO CLIENTE
                    if (novaCobranca.errors) { // EXISTE ERROS INTERNOS
                      res.send({
                        error: 'Error',
                        object: 'payment',
                        message: novaCobranca.errors
                      })
                    } else { // NÃO EXISTE NENHUM ERRO INTERNO (SUCESSO | FIM)
                      res.send({
                        success: 'Success',
                        object: novaCobranca.object,
                        message: novaCobranca
                      })
                    }
                  } catch (errorNovaCobranca) {
                    res.send({
                      error: 'Error',
                      message: errorNovaCobranca.message
                    })
                  }
                });
              }
            } catch (errorNovoCadastro) {
              res.send({
                error: 'Error',
                message: errorNovoCadastro.message
              })
            }
          });
        }
      } catch (errorExistenciaConta) {
        res.send({
          error: 'Error',
          message: errorExistenciaConta.message
        })
      }

    })
  } catch (error) {
    res.send({
      error: 'Error',
      message: error.message
    })
  }

});

app.post("/pagamentos/boleto_pix", async (req, res) => {

  const INCLUDE_PATH = "https://sandbox.asaas.com/";
  const INCLUDE_KEY = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwMzc4OTg6OiRhYWNoXzQzNzI2NTBhLTZmZjktNDg0Yi04Y2VlLWU3MDZhZDVlZmRlNA";

  try {
    // CONTANTES DA REQUISIÇÃO
    const dados_metodoPagamento = req.params.id;
    const dados_contato = req.body.dados_comprador;
    const dados_cobranca = req.body.dados_cobranca;
    const dados_pedido = req.body.dados_pedido;

    // VERIFICAÇÃO DE EXISTENCIA DE CONTA
    request({
      method: 'GET',
      url: INCLUDE_PATH + 'api/v3/customers?name=' + dados_contato.full_name + '&cpfCnpj=' + dados_contato.cpf + '&limit=1',
      headers: {
        'access_token': INCLUDE_KEY
      }
    }, async (requisicaoExistenciaConta, respostaExistenciaConta) => {
      try {
        const existenciaConta = await JSON.parse(respostaExistenciaConta.body).data; // RETORNO DA VERIFICAÇÃO DE EXISTENCIA DE CONTA

        // VERIFICAR RETORNO DA EXISTENCIA DE cadastro (EXISTE: VAMOS CRIAR UM PAGAMENTO || !EXISTE: VAMOS CRIAR UM CADASTRO)
        if (existenciaConta && existenciaConta.length) { // ESTE COMPRADOR JÁ POSSUI UMA CONTA
          // GERAR ***COBRANÇA***
          const dados_contaExistente = existenciaConta[0]; // DADOS DA CONTA RECUPERADA

          const obj_req = {
            customer: dados_contaExistente.id,
            billingType: dados_cobranca.billingType,
            value: dados_cobranca.totalValue,
            dueDate: dados_cobranca.vencimento,
            description: dados_cobranca.description,
            externalReference: 'E' + generator.generate({
              length: 15,
              numbers: true,
              lowercase: false,
              uppercase: true,
              exclude: 'ç',
              symbols: false
            }) + 'P'
          }

          // GERAÇÃO DE COBRANÇA ***USUARIO CADASTRADO***
          request({
            method: 'POST',
            url: INCLUDE_PATH + 'api/v3/payments',
            headers: {
              'Content-Type': 'application/json',
              'access_token': INCLUDE_KEY
            },
            body: JSON.stringify(obj_req)
          }, async (requisicaoNovaCobranca, respostaNovaCobranca) => {
            try {
              const novaCobranca = await JSON.parse(respostaNovaCobranca.body);
              // VERIFICANDO A EXISTENCIA DE ERROS INTERNOS - PAGAMENTOS/CLIENTE EXISTENTE
              if (novaCobranca.errors) { // EXISTE ERROS INTERNOS
                res.send({
                  error: 'Error',
                  object: 'payment',
                  message: novaCobranca.errors
                })
              } else { // NÃO EXISTE NENHUM ERRO INTERNO (SUCESSO | FIM)
                // CADASTRAR PEDIDO NO BANCO DE DADOS
                (async () => {
                  console.log('Começou!');

                  let dadosPedido = {
                    dados_cobranca: novaCobranca,
                    dados_pedido: dados_pedido
                  }
                  const result = await db.cadastrarPedido(dadosPedido);
                  if (result.status == "success") {
                    res.send({
                      success: 'Success',
                      object: novaCobranca.object,
                      message: novaCobranca
                    })
                  } else {
                    res.send({
                      success: 'Error',
                      message: result.message
                    })
                  }
                })();
              }
            } catch (errorNovaCobranca) {
              res.send({
                error: 'Error',
                message: errorNovaCobranca.message
              })
            }
          });
        } else { // NÃO EXISTE NENHUM CADASTRO PARA ESTE COMPRADOR
          // GERAR ***CADASTRO***
          // console.log("não existe uma conta");
          let dados_novo_usuario = {
            name: req.body.dados_comprador.full_name,
            email: req.body.dados_comprador.email,
            mobilePhone: req.body.dados_comprador.telefone,
            cpfCnpj: req.body.dados_comprador.cpf,
            postalCode: req.body.dados_contato.endereco.cep,
            address: req.body.dados_contato.endereco.tipo_logradouro + ' ' + req.body.dados_contato.endereco.logradouro,
            addressNumber: req.body.dados_contato.endereco.numero,
            complement: (req.body.dados_contato.endereco.complemento.length) ? req.body.dados_contato.endereco.complemento : null,
            province: req.body.dados_contato.endereco.bairro,
            notificationDisabled: false,
            observations: req.body.dados_contato.endereco.referencia
          }
          request({
            method: 'POST',
            url: INCLUDE_PATH + 'api/v3/customers',
            headers: {
              'Content-Type': 'application/json',
              'access_token': INCLUDE_KEY
            },
            body: JSON.stringify(dados_novo_usuario)
          }, async (requisicaoNovoCadastro, respostaNovoCadastro) => {
            try {
              const novoCadastro = await JSON.parse(respostaNovoCadastro.body);

              // VERIFICANDO A EXISTENCIA DE ERROS INTERNOS - NOVO CLIENTE
              if (novoCadastro.errors) { // EXISTE ERROS INTERNOS
                res.send({
                  error: 'Error',
                  object: 'account',
                  message: novoCadastro.errors
                })
              } else { // NÃO EXISTE NENHUM ERRO INTERNO

                const obj_req = {
                  customer: dados_contaExistente.id,
                  billingType: dados_cobranca.billingType,
                  value: dados_cobranca.totalValue,
                  dueDate: dados_cobranca.vencimento,
                  description: dados_cobranca.description,
                  externalReference: 'E' + generator.generate({
                    length: 15,
                    numbers: true,
                    lowercase: false,
                    uppercase: true,
                    exclude: 'ç',
                    symbols: false
                  }) + 'P'
                }

                // GERAÇÃO DE COBRANÇA ***USUARIO CADASTRADO***
                request({
                  method: 'POST',
                  url: INCLUDE_PATH + 'api/v3/payments',
                  headers: {
                    'Content-Type': 'application/json',
                    'access_token': INCLUDE_KEY
                  },
                  body: JSON.stringify(obj_req)
                }, async (requisicaoNovaCobranca, respostaNovaCobranca) => {
                  try {
                    const novaCobranca = await JSON.parse(respostaNovaCobranca.body);
                    // VERIFICANDO A EXISTENCIA DE ERROS INTERNOS - PAGAMENTOS/NOVO CLIENTE
                    if (novaCobranca.errors) { // EXISTE ERROS INTERNOS
                      res.send({
                        error: 'Error',
                        object: 'payment',
                        message: novaCobranca.errors
                      })
                    } else { // NÃO EXISTE NENHUM ERRO INTERNO (SUCESSO | FIM)
                      // CADASTRAR PEDIDO NO BANCO DE DADOS
                      (async () => {
                        console.log('Começou!');

                        let dadosPedido = {
                          dados_cobranca: novaCobranca,
                          dados_pedido: dados_pedido
                        }
                        const result = await db.cadastrarPedido(dadosPedido);
                        if (result.status == "success") {
                          res.send({
                            success: 'Success',
                            object: novaCobranca.object,
                            message: novaCobranca
                          })
                        } else {
                          res.send({
                            success: 'Error',
                            object: result.object,
                            message: result.message
                          })
                        }
                      })();
                    }
                  } catch (errorNovaCobranca) {
                    res.send({
                      error: 'Error',
                      message: errorNovaCobranca.message
                    })
                  }
                });
              }
            } catch (errorNovoCadastro) {
              res.send({
                error: 'Error',
                message: errorNovoCadastro.message
              })
            }
          });
        }
      } catch (errorExistenciaConta) {
        res.send({
          error: 'Error',
          message: errorExistenciaConta.message
        })
      }

    })
  } catch (error) {
    res.send({
      error: 'Error',
      message: error.message
    })
  }
  // console.log(req.body);
});

app.post("/cobrancas", async (req, res) => {
  const INCLUDE_PATH = "https://sandbox.asaas.com/";
  const INCLUDE_KEY = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwMzc4OTg6OiRhYWNoXzQzNzI2NTBhLTZmZjktNDg0Yi04Y2VlLWU3MDZhZDVlZmRlNA";

  request({
    method: 'GET',
    url: INCLUDE_PATH + 'api/v3/payments?externalReference=' + req.body.numeroReferencia,
    headers: {
      'access_token': INCLUDE_KEY
    }
  }, function (reqCobranca, resCobranca) {
    // res.send(JSON.parse(resCobranca.body).data)
    if (JSON.parse(resCobranca.body).data[0].billingType == "PIX") {
      request({
        method: 'GET',
        url: INCLUDE_PATH + 'api/v3/payments/' + JSON.parse(resCobranca.body).data[0].id + '/pixQrCode',
        headers: {
          'Content-Type': 'application/json',
          'access_token': INCLUDE_KEY
        }
      }, async (reqPIX, resPIX) => {
        try {
          await res.send({
            dados_cobranca: JSON.parse(resCobranca.body).data[0],
            dados_pagamento: JSON.parse(resPIX.body)
          })
        } catch (errorPIX) {
          res.send({
            error: 'Error',
            message: errorPIX.message
          })
        }
      });
    } else if (JSON.parse(resCobranca.body).data[0].billingType == "BOLETO") {
      request({
        method: 'GET',
        url: INCLUDE_PATH + 'api/v3/payments/' + JSON.parse(resCobranca.body).data[0].id + '/identificationField',
        headers: {
          'Content-Type': 'application/json',
          'access_token': INCLUDE_KEY
        }
      }, async (reqBoleto, resBoleto) => {
        try {
          await res.send({
            dados_cobranca: JSON.parse(resCobranca.body).data[0],
            dados_pagamento: JSON.parse(resBoleto.body)
          })
        } catch (errorBoleto) {
          res.send({
            error: 'Error',
            message: errorBoleto.message
          })
        }
      });
    } else if (JSON.parse(resCobranca.body).data[0].billingType == "CREDIT_CARD") {
      request({
        method: 'GET',
        url: INCLUDE_PATH + 'api/v3/payments/' + JSON.parse(resCobranca.body).data[0].id + '/identificationField',
        headers: {
          'Content-Type': 'application/json',
          'access_token': INCLUDE_KEY
        }
      }, async (reqCreditCard, resCreditCard) => {
        try {
          await res.send({
            dados_cobranca: JSON.parse(resCobranca.body).data[0],
            dados_pagamento: JSON.parse(resCreditCard.body)
          })
        } catch (errorCreditCard) {
          res.send({
            error: 'Error',
            message: errorCreditCard.message
          })
        }
      });
    }
  });
});

app.post("/pedidos", async (req, res) => {
  const INCLUDE_PATH = "https://sandbox.asaas.com/";
  const INCLUDE_KEY = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwMzc4OTg6OiRhYWNoXzQzNzI2NTBhLTZmZjktNDg0Yi04Y2VlLWU3MDZhZDVlZmRlNA";

  request({
    method: 'GET',
    url: INCLUDE_PATH + 'api/v3/customers?name=' + req.body.nome + '&cpfCnpj=' + req.body.cpf,
    headers: {
      'access_token': INCLUDE_KEY
    }
  }, async (reqCliente, resCliente) => {
    try {
      let clienteId = await JSON.parse(resCliente.body).data[0].id;
      if (clienteId && clienteId.length) {
        // O ID DO CLIENTE FOI RECUPERADO NO ASAAS -> REALIZAR A CONSULTA PELAS COBRANÇAS PELO ID DO CLIENTE
        request({
          method: 'GET',
          url: INCLUDE_PATH + 'api/v3/payments?customer=' + clienteId + '&offset=' + req.body.offset + '&limit=' + req.body.limit,
          headers: {
            'access_token': INCLUDE_KEY
          }
        }, async (reqCobranca, resCobranca) => {
          try {
            await res.send(JSON.parse(resCobranca.body));
          } catch (errorCobranca) {
            res.send({
              error: 'Error',
              message: 'Ocorreu um erro ao recuperar os dados do seu pedido'
            })
          }
        });
      } else {
        res.send({
          error: 'Error',
          message: 'O cliente não foi encontrado em nossa base de dados'
        })
      }
    } catch (errorRecuperaCliente) {
      res.send({
        error: 'Error',
        message: errorRecuperaCliente.message
      })
    }
  });
});

app.post("/recuperar-pedido", async (req, res) => {
  (async () => {
    console.log('Começou a recuperar!');
    const result = await db.recuperarPedido(req.body.pedido, req.body.referencia);
    if (result.status == "success") {
      res.send(result);
    } else {
      res.send({
        success: 'Error',
        object: result.object,
        message: result.message
      })
    }
  })();
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000 do projeto 1.0.2!"));
