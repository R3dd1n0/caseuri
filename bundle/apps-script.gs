/**
 * ============================================================================
 *  BACKEND COMPLETO — cole TUDO isto no editor do Apps Script (um arquivo só).
 *  Gerado por bundle/build.mjs a partir de backend/*.gs — NÃO edite à mão:
 *  edite os módulos em backend/ e rode `node bundle/build.mjs` de novo.
 * ============================================================================
 */

// ===== Codigo.gs ======================================================

/**
 * Codigo.gs — ponto de entrada do Web App e roteamento.
 *
 * O Apps Script só expõe doGet/doPost. Tudo é roteado pelo campo `action`.
 * Nenhum conteúdo/segredo mora aqui: segredos vêm de Script Properties
 * (ver `configSegredo`) e o conteúdo do site mora no frontend.
 */

// Mapa de ações -> função handler. Cada handler recebe (params) e devolve objeto.
var ROTAS = {
  identificar:      acaoIdentificar,      // Identidade.gs
  sessao:           acaoSessao,           // Identidade.gs
  rsvpSalvar:       acaoRsvpSalvar,       // Rsvp.gs
  presentesListar:  acaoPresentesListar,  // Presentes.gs
  presenteReservar: acaoPresenteReservar, // Presentes.gs
  contribuirLivre:  acaoContribuirLivre,  // Presentes.gs
  pagamentoStatus:  acaoPagamentoStatus   // Presentes.gs
};

/** GET: ações de leitura (query string). */
function doGet(e) {
  return rotear(e, (e && e.parameter) || {});
}

/**
 * POST: ações de escrita (corpo text/plain com JSON) e o webhook do Mercado Pago.
 * O webhook é tratado à parte porque não segue o formato { action, ... }.
 */
function doPost(e) {
  var corpo = lerCorpoJson(e);
  // Ação conhecida do frontend -> roteia. Qualquer outra coisa (inclusive o
  // corpo do webhook do Mercado Pago, que traz action="payment.updated") é
  // tratada como notificação de pagamento.
  if (corpo.action && ROTAS[corpo.action]) return rotear(e, corpo);
  return webhookMercadoPago(e, corpo); // MercadoPago.gs
}

/** Despacha para o handler certo com base em `action`. */
function rotear(e, params) {
  try {
    var acao = params.action;
    var handler = ROTAS[acao];
    if (!handler) return jsonResposta({ ok: false, erro: 'dados_invalidos' });
    var resultado = handler(params) || {};
    if (resultado.ok === undefined) resultado.ok = true;
    return jsonResposta(resultado);
  } catch (err) {
    console.error('Erro em rotear: ' + (err && err.stack || err));
    return jsonResposta({ ok: false, erro: 'interno' });
  }
}

// ---------------------------------------------------------------------------
// Helpers de I/O
// ---------------------------------------------------------------------------

/** Serializa a resposta como JSON. */
function jsonResposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Lê o corpo do POST como JSON (text/plain evita preflight de CORS). */
function lerCorpoJson(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (err) {
    console.warn('Corpo POST não é JSON válido: ' + err);
  }
  return {};
}

// ---------------------------------------------------------------------------
// Token de sessão (HMAC) — identidade não-secreta, porém à prova de adulteração
// ---------------------------------------------------------------------------

/** Gera token = base64url(conviteId) + "." + hmac. */
function assinarToken(conviteId) {
  var id = String(conviteId);
  var assinatura = _hmac(id);
  return _b64url(id) + '.' + assinatura;
}

/** Verifica o token e devolve o conviteId, ou null se inválido. */
function verificarToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  var partes = token.split('.');
  var id;
  try { id = _b64urlDecode(partes[0]); } catch (e) { return null; }
  var esperado = _hmac(id);
  // Comparação simples; volume é baixíssimo (timing não é ameaça relevante aqui).
  return esperado === partes[1] ? id : null;
}

function _hmac(texto) {
  var chave = configSegredo('TOKEN_SECRET');
  var bytes = Utilities.computeHmacSha256Signature(texto, chave);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
function _b64url(s) {
  return Utilities.base64EncodeWebSafe(s).replace(/=+$/, '');
}
function _b64urlDecode(s) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString();
}

/** Exige token válido; lança erro amigável se inválido. */
function exigirConvite(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) { var e = new Error('token_invalido'); e.amigavel = true; throw e; }
  return conviteId;
}

// ===== Planilha.gs ====================================================

/**
 * Planilha.gs — acesso à planilha (o "banco de dados" + painel do casal),
 * setup das abas e leitura de configuração/segredos.
 *
 * Todas as funções .gs compartilham o mesmo escopo global no Apps Script,
 * então a ordem entre arquivos não importa.
 */

// Nomes das abas e seus cabeçalhos (ordem = ordem das colunas).
var ABAS = {
  CONVIDADOS: {
    nome: 'Convidados',
    // Lista NOMINAL: uma linha por PESSOA. Acompanhantes também são nomeados.
    // Pessoas do mesmo convite compartilham o mesmo convite_id (uma pessoa
    // confirma por todas do seu convite). Não existe "número de acompanhantes".
    colunas: [
      'id',                 // id único da pessoa (chave da linha)
      'convite_id',         // agrupa pessoas do mesmo convite
      'grupo',              // rótulo do convite, ex.: "Família Silva" (opcional)
      'nome',               // nome completo da pessoa (usado no match e exibição)
      'categoria',          // adulto | crianca_meia | crianca_gratis
      'rsvp_status',        // pendente | confirmado | recusado (por pessoa)
      'rsvp_obs',           // recado / restrição alimentar (por pessoa, opcional)
      'rsvp_atualizado_em'  // timestamp ISO
    ]
  },
  PRESENTES: {
    nome: 'Presentes',
    colunas: [
      'id', 'titulo', 'descricao', 'valor', 'tipo',
      'status',        // disponivel | reservado | esgotado
      'reservado_por', // conviteId que reservou (soft-lock)
      'reservado_em',  // timestamp ISO do soft-lock
      'pago_por',      // grupo que pagou
      'payment_id',    // id do pagamento no Mercado Pago
      'data_pgto',     // timestamp ISO
      'mensagem'       // recado opcional de quem presenteou
    ]
  },
  PAGAMENTOS: {
    nome: 'Pagamentos',
    colunas: [
      'payment_id',   // id no Mercado Pago (chave)
      'convite_id',   // quem pagou
      'grupo',        // rótulo para leitura humana
      'tipo',         // item | livre
      'presente_id',  // preenchido quando tipo=item
      'titulo',       // descrição legível
      'valor',
      'status',       // pendente | confirmado | expirado
      'mensagem',
      'criado_em',
      'confirmado_em'
    ]
  },
  CONFIG: {
    nome: 'Config',
    colunas: ['chave', 'valor']
  }
};

/** Abre a planilha: a ativa (script vinculado) ou por SHEET_ID nas propriedades. */
function planilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Sem planilha ativa e sem SHEET_ID configurado.');
  return SpreadsheetApp.openById(id);
}

/** Retorna (criando se preciso) a aba pelo objeto de ABAS. */
function aba(def) {
  var ss = planilha();
  var sh = ss.getSheetByName(def.nome);
  if (!sh) {
    sh = ss.insertSheet(def.nome);
    sh.getRange(1, 1, 1, def.colunas.length).setValues([def.colunas]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Lê uma aba inteira como lista de objetos { coluna: valor } + metadados
 * para escrita posterior (índice da linha na planilha).
 */
function lerTabela(def) {
  var sh = aba(def);
  var valores = sh.getDataRange().getValues();
  var headers = valores.shift() || def.colunas;
  var chave = headers[0]; // 1ª coluna identifica a linha (id, payment_id, chave)
  var linhas = valores.map(function (linha, i) {
    var obj = { _linha: i + 2 }; // +2: 1 do header, 1 porque é 1-indexado
    headers.forEach(function (h, c) { obj[h] = linha[c]; });
    return obj;
  }).filter(function (o) { return String(o[chave] || '').trim() !== ''; });
  return { sheet: sh, headers: headers, linhas: linhas };
}

/** Acrescenta uma linha (objeto { coluna: valor }) ao fim da aba. */
function inserirLinha(def, objeto) {
  var sh = aba(def);
  var valores = def.colunas.map(function (col) {
    return objeto.hasOwnProperty(col) ? objeto[col] : '';
  });
  sh.appendRow(valores);
}

/** Atualiza campos de uma linha existente (obj._linha) na aba. */
function atualizarLinha(def, numeroLinha, patch) {
  var sh = aba(def);
  var colunas = def.colunas;
  var range = sh.getRange(numeroLinha, 1, 1, colunas.length);
  var atual = range.getValues()[0];
  colunas.forEach(function (col, i) {
    if (patch.hasOwnProperty(col)) atual[i] = patch[col];
  });
  range.setValues([atual]);
}

// ---------------------------------------------------------------------------
// Configuração e segredos
// ---------------------------------------------------------------------------

/** Segredo obrigatório (Script Properties). Lança se ausente. */
function configSegredo(chave) {
  var v = PropertiesService.getScriptProperties().getProperty(chave);
  if (!v) throw new Error('Falta a Script Property: ' + chave + ' (ver docs/SETUP.md)');
  return v;
}

/**
 * Valor de configuração operacional (não-secreto), com precedência:
 * aba Config -> Script Property -> padrão do código.
 */
function configValor(chave, padrao) {
  try {
    var t = lerTabela(ABAS.CONFIG);
    var achou = t.linhas.filter(function (r) { return r.chave === chave; })[0];
    if (achou && String(achou.valor).trim() !== '') return achou.valor;
  } catch (e) { /* aba pode não existir ainda */ }
  var prop = PropertiesService.getScriptProperties().getProperty(chave);
  return (prop !== null && prop !== undefined) ? prop : padrao;
}

// ---------------------------------------------------------------------------
// Setup (rodar UMA vez no editor do Apps Script)
// ---------------------------------------------------------------------------

/** Cria as abas com cabeçalhos e algumas linhas-exemplo de presentes. */
function setupPlanilha() {
  aba(ABAS.CONVIDADOS);
  aba(ABAS.PRESENTES);
  aba(ABAS.PAGAMENTOS);
  aba(ABAS.CONFIG);

  // Config inicial (valores podem ser editados na planilha depois).
  var cfg = lerTabela(ABAS.CONFIG);
  if (cfg.linhas.length === 0) {
    cfg.sheet.getRange(2, 1, 3, 2).setValues([
      ['SOFTLOCK_MINUTOS', '30'],
      ['PAYER_EMAIL', 'convidados@example.com'],
      ['MP_DESCRICAO_PREFIXO', 'Presente de casamento']
    ]);
  }

  // Exemplos de presentes (PLACEHOLDER — a lista real entra depois).
  var pres = lerTabela(ABAS.PRESENTES);
  if (pres.linhas.length === 0) {
    pres.sheet.getRange(2, 1, 3, ABAS.PRESENTES.colunas.length).setValues([
      ['p001', 'Presente exemplo A', 'Descrição exemplo', 150, 'item', 'disponivel', '', '', '', '', '', ''],
      ['p002', 'Presente exemplo B', 'Descrição exemplo', 300, 'item', 'disponivel', '', '', '', '', '', ''],
      ['luademel', 'Contribuição livre', 'Ajude na lua de mel', '', 'livre', 'disponivel', '', '', '', '', '', '']
    ]);
  }

  // Convite-exemplo (PLACEHOLDER): um convite com DUAS pessoas nomeadas.
  var conv = lerTabela(ABAS.CONVIDADOS);
  if (conv.linhas.length === 0) {
    conv.sheet.getRange(2, 1, 2, ABAS.CONVIDADOS.colunas.length).setValues([
      ['p001', 'c001', 'Família Exemplo', 'Fulano de Tal da Silva', 'adulto', 'pendente', '', ''],
      ['p002', 'c001', 'Família Exemplo', 'Beltrana Exemplo Souza', 'adulto', 'pendente', '', '']
    ]);
  }

  SpreadsheetApp.getActive() && SpreadsheetApp.flush();
}

// ===== Identidade.gs ==================================================

/**
 * Identidade.gs — landing/gate por nome (lista NOMINAL, uma linha por pessoa).
 *
 * Regra de match (spec §6.1): primeiro nome obrigatório + qualquer subconjunto
 * dos sobrenomes (em qualquer ordem), ignorando acentos e partículas.
 * A pessoa é identificada; a sessão vale para o CONVITE dela (todas as pessoas
 * nomeadas no mesmo convite_id).
 */

var PARTICULAS = { 'de': 1, 'da': 1, 'do': 1, 'das': 1, 'dos': 1, 'e': 1, 'di': 1, 'du': 1 };

/** minúsculas, sem acento, sem pontuação, espaços colapsados. */
function normalizarTexto(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra em tokens já sem partículas. */
function tokensNome(s) {
  return normalizarTexto(s).split(' ').filter(function (t) {
    return t && !PARTICULAS[t];
  });
}

/**
 * O que a pessoa digitou casa com um nome completo?
 * digitado = [primeiro, ...sobrenomes]; alvo = [PRIMEIRO, ...SOBRENOMES].
 * Casa se primeiro==PRIMEIRO e todos os sobrenomes digitados existem no alvo.
 */
function nomeCasa(digitado, alvo) {
  var d = tokensNome(digitado);
  var a = tokensNome(alvo);
  if (d.length === 0 || a.length === 0) return false;
  if (d[0] !== a[0]) return false;

  var sobrenomesAlvo = {};
  for (var i = 1; i < a.length; i++) sobrenomesAlvo[a[i]] = true;
  for (var j = 1; j < d.length; j++) {
    if (!sobrenomesAlvo[d[j]]) return false;
  }
  return true;
}

/** POST identificar */
function acaoIdentificar(params) {
  var digitado = params && params.nome;
  if (!digitado || tokensNome(digitado).length === 0) {
    return { ok: false, erro: 'dados_invalidos' };
  }

  var t = lerTabela(ABAS.CONVIDADOS);
  var convitesCasados = {};
  t.linhas.forEach(function (p) {
    // Crianças não logam: não entram na busca por nome (mas ficam no convite).
    if (String(p.categoria || 'adulto').indexOf('crianca') === 0) return;
    if (nomeCasa(digitado, p.nome)) convitesCasados[p.convite_id] = true;
  });
  var ids = Object.keys(convitesCasados);

  if (ids.length === 0) return { ok: false, erro: 'nome_nao_encontrado' };
  if (ids.length > 1) {
    return { ok: true, resultado: 'multiplo', erro: 'precisa_desambiguar' };
  }

  var resp = conviteResposta(ids[0]);
  resp.resultado = 'unico';
  resp.token = assinarToken(ids[0]);
  return resp;
}

/** POST sessao — revalida token salvo no dispositivo. */
function acaoSessao(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };
  var info = conviteInfo(conviteId);
  if (!info) return { ok: false, erro: 'token_invalido' };
  return conviteResposta(conviteId);
}

/** Monta a resposta pública de um convite (sem _linha). */
function conviteResposta(conviteId) {
  var info = conviteInfo(conviteId);
  return {
    ok: true,
    grupo: info ? info.grupo : '',
    pessoas: (info ? info.pessoas : []).map(function (p) {
      return { id: p.id, nome: p.nome, categoria: p.categoria, status: p.status, obs: p.obs };
    }),
    deuPresente: conviteDeuPresente(conviteId)
  };
}

/** Lê um convite: rótulo + pessoas (com _linha para escrita). */
function conviteInfo(conviteId) {
  var t = lerTabela(ABAS.CONVIDADOS);
  var pessoas = t.linhas.filter(function (p) {
    return String(p.convite_id) === String(conviteId);
  }).map(function (p) {
    return {
      id: p.id, nome: p.nome, grupo: p.grupo, categoria: p.categoria || 'adulto',
      status: p.rsvp_status || 'pendente', obs: p.rsvp_obs || '', _linha: p._linha
    };
  });
  if (pessoas.length === 0) return null;
  return { conviteId: conviteId, grupo: pessoas[0].grupo || '', pessoas: pessoas };
}

/** Rótulo do convite (para registrar em Pagamentos). */
function grupoDoConvite(conviteId) {
  var info = conviteInfo(conviteId);
  return info ? (info.grupo || conviteId) : conviteId;
}

/** O convite já deu presente? Derivado do livro-razão (pagamento confirmado). */
function conviteDeuPresente(conviteId) {
  var t = lerTabela(ABAS.PAGAMENTOS);
  return t.linhas.some(function (pg) {
    return String(pg.convite_id) === String(conviteId) && pg.status === 'confirmado';
  });
}

// ===== Rsvp.gs ========================================================

/**
 * Rsvp.gs — confirmar / recusar presença POR PESSOA (lista nominal).
 *
 * Recebe uma lista de respostas [{ id, status, obs? }], uma por pessoa do
 * convite. Cada id precisa pertencer ao convite do token (não dá para editar
 * pessoas de outro convite).
 */

/** POST rsvpSalvar */
function acaoRsvpSalvar(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var respostas = params.respostas;
  if (!respostas || !respostas.length) return { ok: false, erro: 'dados_invalidos' };

  var info = conviteInfo(conviteId);
  if (!info) return { ok: false, erro: 'token_invalido' };

  // Índice das pessoas deste convite, por id (barra edição cruzada).
  var porId = {};
  info.pessoas.forEach(function (p) { porId[String(p.id)] = p; });

  var agora = new Date().toISOString();
  var atualizou = false;

  respostas.forEach(function (r) {
    var pessoa = porId[String(r && r.id)];
    var status = String(r && r.status || '').toLowerCase();
    if (!pessoa) return;
    if (status !== 'confirmado' && status !== 'recusado' && status !== 'pendente') return;
    atualizarLinha(ABAS.CONVIDADOS, pessoa._linha, {
      rsvp_status: status,
      rsvp_obs: String(r.obs || '').slice(0, 500),
      rsvp_atualizado_em: agora
    });
    atualizou = true;
  });

  if (!atualizou) return { ok: false, erro: 'dados_invalidos' };
  return conviteResposta(conviteId);
}

// ===== Presentes.gs ===================================================

/**
 * Presentes.gs — catálogo, reserva (soft-lock), contribuição livre e status.
 *
 * Fluxo: reservar/contribuir cria uma cobrança PIX no Mercado Pago e registra
 * um pagamento PENDENTE no livro-razão (aba Pagamentos). A confirmação real
 * acontece no webhook / na trigger de poll (MercadoPago.gs), que é a fonte da
 * verdade — aqui nunca marcamos "esgotado" por conta própria.
 */

/** GET presentesListar — catálogo público (sem expor quem pagou). */
function acaoPresentesListar() {
  liberarReservasExpiradas(); // higiene: devolve itens com soft-lock vencido
  var t = lerTabela(ABAS.PRESENTES);
  var presentes = t.linhas.map(function (p) {
    return {
      id: p.id,
      titulo: p.titulo,
      descricao: p.descricao,
      valor: p.valor === '' ? null : Number(p.valor),
      tipo: p.tipo || 'item',
      status: p.status || 'disponivel'
    };
  });
  return { ok: true, presentes: presentes };
}

/** POST presenteReservar — escolhe um item e gera o PIX. */
function acaoPresenteReservar(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var presenteId = params.presenteId;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  var presente;
  try {
    liberarReservasExpiradas();
    presente = acharPresente(presenteId);
    if (!presente) return { ok: false, erro: 'dados_invalidos' };

    if (presente.tipo === 'item') {
      if (presente.status !== 'disponivel') {
        return { ok: false, erro: 'presente_indisponivel' };
      }
      // Soft-lock: marca reservado ANTES de gerar o PIX (impede corrida).
      atualizarLinha(ABAS.PRESENTES, presente._linha, {
        status: 'reservado',
        reservado_por: conviteId,
        reservado_em: new Date().toISOString()
      });
    }
  } finally {
    lock.releaseLock();
  }

  var valor = Number(presente.valor);
  if (!valor || valor <= 0) {
    if (presente.tipo === 'item') {
      atualizarLinha(ABAS.PRESENTES, presente._linha, {
        status: 'disponivel', reservado_por: '', reservado_em: ''
      });
    }
    return { ok: false, erro: 'dados_invalidos' };
  }

  return gerarCobranca(conviteId, {
    tipo: presente.tipo === 'livre' ? 'livre' : 'item',
    presenteId: presente.id,
    titulo: presente.titulo,
    valor: valor,
    mensagem: params.mensagem || '',
    revertePresente: presente.tipo === 'item' ? presente : null
  });
}

/** POST contribuirLivre — PIX de valor livre (nunca esgota). */
function acaoContribuirLivre(params) {
  var conviteId = verificarToken(params && params.token);
  if (!conviteId) return { ok: false, erro: 'token_invalido' };

  var valor = Number(params.valor);
  if (!valor || valor <= 0) return { ok: false, erro: 'dados_invalidos' };

  return gerarCobranca(conviteId, {
    tipo: 'livre',
    presenteId: params.presenteId || 'livre',
    titulo: 'Contribuição livre',
    valor: valor,
    mensagem: params.mensagem || '',
    revertePresente: null
  });
}

/** GET pagamentoStatus — o frontend faz polling até confirmar. */
function acaoPagamentoStatus(params) {
  var pg = acharPagamento(params && params.paymentId);
  if (!pg) return { ok: false, erro: 'pagamento_nao_encontrado' };
  return { ok: true, status: pg.status || 'pendente' };
}

// ---------------------------------------------------------------------------
// Núcleo compartilhado
// ---------------------------------------------------------------------------

/** Cria a cobrança no MP + registra pagamento pendente. Reverte item se falhar. */
function gerarCobranca(conviteId, dados) {
  var grupo = grupoDoConvite(conviteId);
  var descricao = (configValor('MP_DESCRICAO_PREFIXO', 'Presente de casamento')) +
    ' - ' + dados.titulo;

  var cobranca;
  try {
    cobranca = mpCriarPagamentoPix(dados.valor, descricao, conviteId + ':' + dados.presenteId);
  } catch (err) {
    console.error('Falha ao criar cobrança MP: ' + err);
    if (dados.revertePresente) {
      atualizarLinha(ABAS.PRESENTES, dados.revertePresente._linha, {
        status: 'disponivel', reservado_por: '', reservado_em: ''
      });
    }
    return { ok: false, erro: 'interno' };
  }

  inserirLinha(ABAS.PAGAMENTOS, {
    payment_id: cobranca.paymentId,
    convite_id: conviteId,
    grupo: grupo,
    tipo: dados.tipo,
    presente_id: dados.presenteId,
    titulo: dados.titulo,
    valor: dados.valor,
    status: 'pendente',
    mensagem: dados.mensagem,
    criado_em: new Date().toISOString(),
    confirmado_em: ''
  });

  return {
    ok: true,
    pagamento: {
      paymentId: cobranca.paymentId,
      qrCode: cobranca.qrCode,
      qrCodeBase64: cobranca.qrCodeBase64,
      copiaCola: cobranca.qrCode,
      valor: dados.valor,
      expiraEm: cobranca.expiraEm || ''
    }
  };
}

function acharPresente(id) {
  var t = lerTabela(ABAS.PRESENTES);
  return t.linhas.filter(function (p) { return String(p.id) === String(id); })[0] || null;
}

function acharPagamento(paymentId) {
  var t = lerTabela(ABAS.PAGAMENTOS);
  return t.linhas.filter(function (p) { return String(p.payment_id) === String(paymentId); })[0] || null;
}

/** Devolve ao catálogo itens cujo soft-lock venceu sem pagamento confirmado. */
function liberarReservasExpiradas() {
  var minutos = Number(configValor('SOFTLOCK_MINUTOS', 30)) || 30;
  var limite = Date.now() - minutos * 60 * 1000;
  var t = lerTabela(ABAS.PRESENTES);
  t.linhas.forEach(function (p) {
    if (p.status === 'reservado' && p.reservado_em) {
      var quando = Date.parse(p.reservado_em);
      if (quando && quando < limite) {
        atualizarLinha(ABAS.PRESENTES, p._linha, {
          status: 'disponivel', reservado_por: '', reservado_em: ''
        });
        marcarPagamentosExpirados(p.id, p.reservado_por);
      }
    }
  });
}

/** Marca como expirado o(s) pagamento(s) pendente(s) daquele item/convite. */
function marcarPagamentosExpirados(presenteId, conviteId) {
  var t = lerTabela(ABAS.PAGAMENTOS);
  t.linhas.forEach(function (pg) {
    if (pg.status === 'pendente' && String(pg.presente_id) === String(presenteId) &&
        String(pg.convite_id) === String(conviteId)) {
      atualizarLinha(ABAS.PAGAMENTOS, pg._linha, { status: 'expirado' });
    }
  });
}

// ===== MercadoPago.gs =================================================

/**
 * MercadoPago.gs — cria cobranças PIX, recebe o webhook e confirma pagamentos.
 *
 * Princípio de robustez: NUNCA confiar cegamente no POST do webhook. Sempre
 * re-consultar o pagamento na API do MP. Além disso, uma trigger por tempo
 * (verificarPagamentosPendentes) varre pendentes como rede de segurança.
 *
 * Credenciais ficam em Script Properties (ver docs/SETUP.md):
 *   MP_ACCESS_TOKEN  — token de acesso da conta Mercado Pago (pessoa física)
 *   WEBHOOK_URL      — a URL do próprio Web App (para notification_url)
 */

var MP_API = 'https://api.mercadopago.com';

/** Cria uma cobrança PIX e devolve os dados do QR. */
function mpCriarPagamentoPix(valor, descricao, externalReference) {
  var token = configSegredo('MP_ACCESS_TOKEN');
  var body = {
    transaction_amount: Math.round(Number(valor) * 100) / 100,
    description: descricao,
    payment_method_id: 'pix',
    external_reference: externalReference,
    payer: { email: configValor('PAYER_EMAIL', 'convidados@example.com') }
  };
  var notif = configValor('WEBHOOK_URL', '');
  if (notif) body.notification_url = notif;

  var resp = UrlFetchApp.fetch(MP_API + '/v1/payments', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Idempotency-Key': Utilities.getUuid()
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var json = JSON.parse(resp.getContentText() || '{}');
  if (code >= 300) {
    throw new Error('MP erro ' + code + ': ' + (json.message || resp.getContentText()));
  }

  var tx = (json.point_of_interaction && json.point_of_interaction.transaction_data) || {};
  return {
    paymentId: String(json.id),
    qrCode: tx.qr_code || '',
    qrCodeBase64: tx.qr_code_base64 || '',
    expiraEm: json.date_of_expiration || ''
  };
}

/** Consulta o status de um pagamento. Devolve o status "cru" do MP. */
function mpConsultarPagamento(paymentId) {
  var token = configSegredo('MP_ACCESS_TOKEN');
  var resp = UrlFetchApp.fetch(MP_API + '/v1/payments/' + encodeURIComponent(paymentId), {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) return null;
  return JSON.parse(resp.getContentText() || '{}');
}

/** Traduz o status do MP para o nosso vocabulário. */
function traduzStatusMp(mpStatus) {
  switch (mpStatus) {
    case 'approved': return 'confirmado';
    case 'pending':
    case 'in_process':
    case 'authorized': return 'pendente';
    default: return 'expirado'; // rejected, cancelled, refunded, charged_back...
  }
}

/** Entrada do webhook do Mercado Pago (chamada por doPost). */
function webhookMercadoPago(e, corpo) {
  try {
    var p = (e && e.parameter) || {};
    var tipo = p.type || p.topic || corpo.type || (corpo.action ? String(corpo.action).split('.')[0] : '');
    var id = p['data.id'] || p.id ||
      (corpo.data && corpo.data.id) || corpo['data.id'] || corpo.id;

    if (tipo && String(tipo).indexOf('payment') < 0) {
      return ContentService.createTextOutput('ignorado'); // outros tópicos
    }
    if (id) sincronizarPagamento(String(id));
  } catch (err) {
    console.error('Webhook MP falhou: ' + (err && err.stack || err));
    // Ainda respondemos 200: a trigger de poll é a rede de segurança.
  }
  return ContentService.createTextOutput('ok');
}

/** Consulta o MP e reconcilia UM pagamento no livro-razão. */
function sincronizarPagamento(paymentId) {
  var pg = acharPagamento(paymentId);
  if (!pg || pg.status === 'confirmado') return;

  var mp = mpConsultarPagamento(paymentId);
  if (!mp) return;
  var novo = traduzStatusMp(mp.status);

  if (novo === 'confirmado') {
    confirmarPagamento(pg);
  } else if (novo === 'expirado') {
    atualizarLinha(ABAS.PAGAMENTOS, pg._linha, { status: 'expirado' });
    if (pg.tipo === 'item') liberarItem(pg.presente_id);
  }
}

/** Efetiva um pagamento confirmado: marca o pagamento e esgota o item. */
function confirmarPagamento(pg) {
  atualizarLinha(ABAS.PAGAMENTOS, pg._linha, {
    status: 'confirmado',
    confirmado_em: new Date().toISOString()
  });

  if (pg.tipo === 'item') {
    var presente = acharPresente(pg.presente_id);
    if (presente) {
      atualizarLinha(ABAS.PRESENTES, presente._linha, {
        status: 'esgotado',
        pago_por: pg.grupo,
        payment_id: pg.payment_id,
        data_pgto: new Date().toISOString(),
        reservado_por: '',
        reservado_em: ''
      });
    }
  }
  // "deuPresente" é derivado do livro-razão (status confirmado); nada a gravar
  // na aba Convidados (que agora é uma linha por pessoa).
}

/** Devolve um item ao catálogo (reserva não paga). */
function liberarItem(presenteId) {
  var presente = acharPresente(presenteId);
  if (presente && presente.status === 'reservado') {
    atualizarLinha(ABAS.PRESENTES, presente._linha, {
      status: 'disponivel', reservado_por: '', reservado_em: ''
    });
  }
}

// ---------------------------------------------------------------------------
// Rede de segurança: trigger por tempo
// ---------------------------------------------------------------------------

/** Varre pagamentos pendentes e reconcilia. Também libera reservas vencidas. */
function verificarPagamentosPendentes() {
  liberarReservasExpiradas();
  var t = lerTabela(ABAS.PAGAMENTOS);
  t.linhas.forEach(function (pg) {
    if (pg.status === 'pendente' && pg.payment_id) {
      sincronizarPagamento(String(pg.payment_id));
    }
  });
}

/** Instala (uma vez) a trigger de poll a cada 5 minutos, sem duplicar. */
function instalarTriggerPagamentos() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'verificarPagamentosPendentes') {
      ScriptApp.deleteTrigger(tr);
    }
  });
  ScriptApp.newTrigger('verificarPagamentosPendentes')
    .timeBased().everyMinutes(5).create();
}

