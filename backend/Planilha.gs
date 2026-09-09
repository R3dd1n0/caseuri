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
      ['p001', 'c001', 'Família Exemplo', 'Fulano de Tal da Silva', 'pendente', '', ''],
      ['p002', 'c001', 'Família Exemplo', 'Beltrana Exemplo Souza', 'pendente', '', '']
    ]);
  }

  SpreadsheetApp.getActive() && SpreadsheetApp.flush();
}
